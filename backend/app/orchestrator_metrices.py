"""
orchestrator_metrics.py
-----------------------
Drop-in performance metrics layer for the LangGraph HR Orchestrator.
Tracks latency, token usage, tool call stats, and success/failure rates.

Usage:
    from orchestrator_metrics import MetricsCollector, track_orchestration

    # 1. Wrap stream_orchestrate
    async for event in track_orchestration(stream_orchestrate, user_input, thread_id, collector):
        ...

    # 2. Wrap generate_plan / execute_plan
    result = await collector.track_async_call("generate_plan", generate_plan, user_query, thread_id)

    # 3. Print or export a report
    collector.print_report()
    collector.export_json("metrics_report.json")
"""

import time
import json
import asyncio
import logging
from typing import Any, AsyncIterator, Callable, Dict, List, Optional
from dataclasses import dataclass, field
from datetime import datetime, timezone
from collections import defaultdict

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Data classes
# ---------------------------------------------------------------------------

@dataclass
class ToolCallRecord:
    tool_name: str
    start_time: float
    end_time: Optional[float] = None
    success: bool = True
    error: Optional[str] = None
    input_summary: Optional[str] = None
    output_summary: Optional[str] = None

    @property
    def latency_ms(self) -> Optional[float]:
        if self.end_time is not None:
            return round((self.end_time - self.start_time) * 1000, 2)
        return None


@dataclass
class OrchestrationRecord:
    thread_id: str
    user_input: str
    start_time: float = field(default_factory=time.monotonic)
    end_time: Optional[float] = None
    success: bool = True
    error: Optional[str] = None
    tool_calls: List[ToolCallRecord] = field(default_factory=list)
    total_input_tokens: int = 0
    total_output_tokens: int = 0
    reasoning_steps: int = 0          # number of LLM reasoning turns
    content_chunks: int = 0           # streamed content chunks received

    @property
    def latency_ms(self) -> Optional[float]:
        if self.end_time is not None:
            return round((self.end_time - self.start_time) * 1000, 2)
        return None

    @property
    def total_tokens(self) -> int:
        return self.total_input_tokens + self.total_output_tokens


# ---------------------------------------------------------------------------
# Core collector
# ---------------------------------------------------------------------------

class MetricsCollector:
    """
    Thread-safe (asyncio-safe) collector that accumulates records across
    multiple orchestration runs and exposes aggregate stats.
    """

    def __init__(self):
        self.runs: List[OrchestrationRecord] = []
        self._lock = asyncio.Lock()

    # ------------------------------------------------------------------
    # Context manager for a single orchestration run
    # ------------------------------------------------------------------

    class _RunContext:
        """Returned by MetricsCollector.run() — use as async context manager."""

        def __init__(self, collector: "MetricsCollector", record: OrchestrationRecord):
            self._collector = collector
            self.record = record
            self._tool_stack: Dict[str, ToolCallRecord] = {}  # tool_name -> current open record

        async def __aenter__(self):
            return self

        async def __aexit__(self, exc_type, exc_val, exc_tb):
            self.record.end_time = time.monotonic()
            if exc_type is not None:
                self.record.success = False
                self.record.error = str(exc_val)
            async with self._collector._lock:
                self._collector.runs.append(self.record)
            return False  # don't suppress exceptions

        # -- event hooks called by track_orchestration --

        def on_tool_start(self, tool_name: str, tool_input: Any):
            tc = ToolCallRecord(
                tool_name=tool_name,
                start_time=time.monotonic(),
                input_summary=str(tool_input)[:200] if tool_input else None,
            )
            self._tool_stack[tool_name] = tc
            self.record.tool_calls.append(tc)

        def on_tool_end(self, tool_name: str, tool_output: Any):
            tc = self._tool_stack.pop(tool_name, None)
            if tc:
                tc.end_time = time.monotonic()
                tc.output_summary = str(tool_output)[:200] if tool_output else None
                tc.success = True

        def on_tool_error(self, tool_name: str, error: str):
            tc = self._tool_stack.pop(tool_name, None)
            if tc:
                tc.end_time = time.monotonic()
                tc.success = False
                tc.error = error

        def on_llm_chunk(self):
            self.record.content_chunks += 1

        def on_reasoning_step(self):
            self.record.reasoning_steps += 1

        def on_token_usage(self, input_tokens: int = 0, output_tokens: int = 0):
            self.record.total_input_tokens += input_tokens
            self.record.total_output_tokens += output_tokens

    def run(self, thread_id: str, user_input: str) -> "_RunContext":
        record = OrchestrationRecord(thread_id=thread_id, user_input=user_input[:120])
        return self._RunContext(self, record)

    # ------------------------------------------------------------------
    # Convenience wrapper for non-streaming async calls
    # ------------------------------------------------------------------

    async def track_async_call(
        self,
        label: str,
        coro_func: Callable,
        *args,
        **kwargs,
    ) -> Any:
        """
        Wraps any async function call (e.g. generate_plan / execute_plan)
        and records its latency + success/failure.
        Returns the function's result unchanged.
        """
        start = time.monotonic()
        record = OrchestrationRecord(
            thread_id=kwargs.get("thread_id", args[1] if len(args) > 1 else "unknown"),
            user_input=label,
            start_time=start,
        )
        try:
            result = await coro_func(*args, **kwargs)
            record.success = result.get("status") != "error" if isinstance(result, dict) else True
            if isinstance(result, dict) and result.get("status") == "error":
                record.error = result.get("response", "unknown error")
        except Exception as e:
            record.success = False
            record.error = str(e)
            raise
        finally:
            record.end_time = time.monotonic()
            async with self._lock:
                self.runs.append(record)

        return result

    # ------------------------------------------------------------------
    # Aggregate stats
    # ------------------------------------------------------------------

    def summary(self) -> Dict[str, Any]:
        if not self.runs:
            return {"message": "No runs recorded yet."}

        total = len(self.runs)
        successful = sum(1 for r in self.runs if r.success)
        failed = total - successful

        latencies = [r.latency_ms for r in self.runs if r.latency_ms is not None]
        avg_latency = round(sum(latencies) / len(latencies), 2) if latencies else None
        p95_latency = round(sorted(latencies)[int(len(latencies) * 0.95)], 2) if len(latencies) >= 2 else None

        # Per-tool aggregates
        tool_stats: Dict[str, Dict] = defaultdict(lambda: {
            "calls": 0, "successes": 0, "failures": 0,
            "latencies_ms": [], "errors": []
        })
        for run in self.runs:
            for tc in run.tool_calls:
                s = tool_stats[tc.tool_name]
                s["calls"] += 1
                if tc.success:
                    s["successes"] += 1
                else:
                    s["failures"] += 1
                    if tc.error:
                        s["errors"].append(tc.error)
                if tc.latency_ms is not None:
                    s["latencies_ms"].append(tc.latency_ms)

        tool_report = {}
        for tool_name, s in tool_stats.items():
            lats = s["latencies_ms"]
            tool_report[tool_name] = {
                "total_calls": s["calls"],
                "success_rate_pct": round(s["successes"] / s["calls"] * 100, 1),
                "avg_latency_ms": round(sum(lats) / len(lats), 2) if lats else None,
                "max_latency_ms": max(lats) if lats else None,
                "recent_errors": s["errors"][-3:],
            }

        token_totals = {
            "total_input_tokens": sum(r.total_input_tokens for r in self.runs),
            "total_output_tokens": sum(r.total_output_tokens for r in self.runs),
            "avg_tokens_per_run": round(
                sum(r.total_tokens for r in self.runs) / total, 1
            ),
        }

        return {
            "generated_at": datetime.now(timezone.utc).isoformat(),
            "overall": {
                "total_runs": total,
                "successful_runs": successful,
                "failed_runs": failed,
                "success_rate_pct": round(successful / total * 100, 1),
                "avg_latency_ms": avg_latency,
                "p95_latency_ms": p95_latency,
                "avg_tool_calls_per_run": round(
                    sum(len(r.tool_calls) for r in self.runs) / total, 2
                ),
                "avg_reasoning_steps_per_run": round(
                    sum(r.reasoning_steps for r in self.runs) / total, 2
                ),
            },
            "token_usage": token_totals,
            "per_tool": tool_report,
        }

    def print_report(self):
        s = self.summary()
        print("\n" + "=" * 60)
        print("  ORCHESTRATOR PERFORMANCE REPORT")
        print("=" * 60)
        print(json.dumps(s, indent=2))
        print("=" * 60 + "\n")

    def export_json(self, path: str = "metrics_report.json"):
        with open(path, "w") as f:
            json.dump(self.summary(), f, indent=2)
        logger.info(f"Metrics exported to {path}")

    def reset(self):
        self.runs.clear()


# ---------------------------------------------------------------------------
# Streaming wrapper — plug into stream_orchestrate
# ---------------------------------------------------------------------------

async def track_orchestration(
    stream_fn: Callable[..., AsyncIterator],
    user_input: str,
    thread_id: str,
    collector: MetricsCollector,
) -> AsyncIterator[Dict[str, Any]]:
    """
    Wraps stream_orchestrate (or any astream_events-based generator),
    hooking into tool_start / tool_end / content_chunk events to record metrics.

    Yields every event unchanged so your Streamlit UI is unaffected.

    Example:
        async for event in track_orchestration(stream_orchestrate, prompt, tid, collector):
            handle(event)
    """
    async with collector.run(thread_id=thread_id, user_input=user_input) as ctx:
        try:
            async for event in stream_fn(user_input, thread_id):
                event_type = event.get("type", "")

                if event_type == "content_chunk":
                    ctx.on_llm_chunk()

                elif event_type == "thought":
                    data: str = event.get("data", "")
                    # Detect tool start/end from the emoji markers your code emits
                    if "Executing Agent Action" in data:
                        # Extract tool name between backticks
                        parts = data.split("`")
                        tool_name = parts[1] if len(parts) >= 2 else "unknown"
                        tool_input = data.split("*Input:")[-1].strip("* ") if "*Input:" in data else None
                        ctx.on_tool_start(tool_name, tool_input)
                        ctx.on_reasoning_step()

                    elif "Completed:" in data:
                        parts = data.split("`")
                        tool_name = parts[1] if len(parts) >= 2 else "unknown"
                        tool_output = data.split("*Output:")[-1].strip("* ") if "*Output:" in data else None
                        ctx.on_tool_end(tool_name, tool_output)

                yield event

        except Exception as e:
            ctx.record.success = False
            ctx.record.error = str(e)
            raise


# ---------------------------------------------------------------------------
# Optional: lightweight LLM callback to capture token usage from Groq
# ---------------------------------------------------------------------------

from langchain_core.callbacks.base import BaseCallbackHandler

class MetricsCallbackHandler(BaseCallbackHandler):
    """
    Attach to ChatGroq to capture token usage automatically.

    Usage:
        handler = MetricsCallbackHandler(collector, thread_id="my-thread")
        llm = ChatGroq(..., callbacks=[handler])
    """

    def __init__(self, collector: MetricsCollector, thread_id: str = "default"):
        self.collector = collector
        self.thread_id = thread_id

    def on_llm_end(self, response, **kwargs):
        try:
            usage = response.llm_output.get("token_usage", {}) if response.llm_output else {}
            input_tokens = usage.get("prompt_tokens", 0)
            output_tokens = usage.get("completion_tokens", 0)
            # Find the most recent run for this thread and update it
            for run in reversed(self.collector.runs):
                if run.thread_id == self.thread_id:
                    run.total_input_tokens += input_tokens
                    run.total_output_tokens += output_tokens
                    break
        except Exception as e:
            logger.warning(f"MetricsCallbackHandler: failed to read token usage — {e}")


# ---------------------------------------------------------------------------
# Visualization dashboard
# ---------------------------------------------------------------------------

def launch_dashboard(report_path: str = "metrics_report.json"):
    """
    Reads the exported metrics JSON and launches an interactive
    Plotly Dash dashboard at http://127.0.0.1:8050

    Install deps once:  pip install plotly dash
    """
    try:
        from dash import Dash, dcc, html, Input, Output
        import plotly.graph_objects as go
    except ImportError:
        print("Run:  pip install plotly dash   — then try again.")
        return

    with open(report_path) as f:
        data = json.load(f)

    overall  = data["overall"]
    tok      = data["token_usage"]
    per_tool = data["per_tool"]
    runs     = data.get("_runs", [])

    # ── colour palette ──────────────────────────────────────────────────────
    C = {
        "blue":   "#3266ad", "green":  "#2e8b57", "red":    "#c0392b",
        "amber":  "#e6a817", "gray":   "#73726c", "purple": "#7F77DD",
        "teal":   "#1D9E75", "coral":  "#D85A30", "bg":     "#F4F6FA",
        "card":   "#FFFFFF", "border": "#E2E8F0", "text":   "#1A202C",
        "muted":  "#718096",
    }
    TOOL_PAL = ["#3266ad","#7F77DD","#1D9E75","#D85A30","#e6a817","#2e8b57","#73726c"]

    tool_names  = list(per_tool.keys())
    tool_colors = [TOOL_PAL[i % len(TOOL_PAL)] for i in range(len(tool_names))]

    LAYOUT = dict(
        paper_bgcolor="rgba(0,0,0,0)", plot_bgcolor="rgba(0,0,0,0)",
        font=dict(family="Segoe UI, Arial, sans-serif", color=C["text"], size=12),
        margin=dict(l=40, r=20, t=30, b=40),
    )
    CFG = {"displayModeBar": False}

    def card(*children, flex=1, min_w="220px"):
        return html.Div(children, style={
            "background": C["card"], "borderRadius": "14px",
            "border": f"1px solid {C['border']}", "padding": "20px 22px",
            "flex": str(flex), "minWidth": min_w,
            "boxShadow": "0 1px 6px rgba(0,0,0,0.06)",
        })

    def kpi(label, value, sub="", color=None):
        return html.Div([
            html.P(label, style={"fontSize":"11px","color":C["muted"],
                                  "textTransform":"uppercase","letterSpacing":"0.07em",
                                  "marginBottom":"6px","fontWeight":"600"}),
            html.P(str(value), style={"fontSize":"28px","fontWeight":"700",
                                       "color": color or C["text"],"margin":"0","lineHeight":"1"}),
            html.P(sub, style={"fontSize":"11px","color":C["muted"],"marginTop":"5px"}),
        ], style={"background":C["bg"],"borderRadius":"10px","padding":"16px 18px",
                  "flex":"1","minWidth":"130px","border":f"1px solid {C['border']}"})

    # ── figures ─────────────────────────────────────────────────────────────

    # 1. Run latency line
    sr_color = overall["success_rate_pct"]
    if runs:
        r_ids  = [r["run_id"]    for r in runs]
        r_lats = [r["latency_ms"] for r in runs]
        r_cols = [C["green"] if r["success"] else C["red"] for r in runs]
    else:
        r_ids, r_lats, r_cols = ["(no run data)"], [0], [C["gray"]]

    fig_line = go.Figure()
    fig_line.add_trace(go.Scatter(
        x=r_ids, y=r_lats, mode="lines+markers",
        line=dict(color=C["blue"], width=2.5),
        marker=dict(color=r_cols, size=9, line=dict(color="white", width=1.5)),
        hovertemplate="<b>%{x}</b><br>Latency: %{y} ms<extra></extra>",
    ))
    fig_line.add_hline(
        y=overall["avg_latency_ms"] or 0, line_dash="dot", line_color=C["muted"],
        annotation_text=f"avg {overall['avg_latency_ms']} ms",
        annotation_font=dict(size=11, color=C["muted"]),
    )
    fig_line.update_layout(**LAYOUT, showlegend=False,
        xaxis=dict(showgrid=False, tickfont=dict(size=10)),
        yaxis=dict(gridcolor="#EDF2F7", tickfont=dict(size=10), title="ms"),
    )

    # 2. Token donut
    fig_donut = go.Figure(go.Pie(
        labels=["Input tokens","Output tokens"],
        values=[tok["total_input_tokens"], tok["total_output_tokens"]],
        hole=0.60, marker=dict(colors=[C["blue"], C["amber"]]),
        textinfo="percent+label", textfont=dict(size=11),
        hovertemplate="%{label}: %{value:,}<extra></extra>",
    ))
    fig_donut.update_layout(**LAYOUT, showlegend=False,
        annotations=[dict(text=f"{tok['total_input_tokens']+tok['total_output_tokens']:,}<br>tokens",
                          x=0.5, y=0.5, font=dict(size=13, color=C["text"]),
                          showarrow=False)]
    )

    # 3. Tool avg latency horizontal bar
    t_avgs = [per_tool[t]["avg_latency_ms"] or 0 for t in tool_names]
    t_maxs = [per_tool[t]["max_latency_ms"] or 0 for t in tool_names]
    fig_lat_bar = go.Figure()
    fig_lat_bar.add_trace(go.Bar(
        y=tool_names, x=t_avgs, orientation="h", name="Avg",
        marker=dict(color=tool_colors, opacity=0.88),
        hovertemplate="%{y}<br>Avg: %{x} ms<extra></extra>",
    ))
    fig_lat_bar.add_trace(go.Scatter(
        y=tool_names, x=t_maxs, mode="markers", name="Max",
        marker=dict(symbol="diamond", size=10, color=C["red"],
                    line=dict(color="white", width=1)),
        hovertemplate="%{y}<br>Max: %{x} ms<extra></extra>",
    ))
    fig_lat_bar.update_layout(**LAYOUT, barmode="overlay", showlegend=True,
        legend=dict(orientation="h", x=0, y=1.08, font=dict(size=10)),
        xaxis=dict(gridcolor="#EDF2F7", tickfont=dict(size=10), title="ms"),
        yaxis=dict(showgrid=False, tickfont=dict(size=10)),
        height=max(250, len(tool_names) * 42 + 60),
    )

    # 4. Tool success rate bar
    t_sr = [per_tool[t]["success_rate_pct"] for t in tool_names]
    sr_bar_colors = [C["green"] if v==100 else C["amber"] if v>=80 else C["red"] for v in t_sr]
    fig_sr = go.Figure(go.Bar(
        y=tool_names, x=t_sr, orientation="h",
        marker=dict(color=sr_bar_colors, opacity=0.88),
        text=[f"{v}%" for v in t_sr], textposition="outside",
        textfont=dict(size=11),
        hovertemplate="%{y}: %{x}%<extra></extra>",
    ))
    fig_sr.update_layout(**LAYOUT, showlegend=False,
        xaxis=dict(range=[0,115], showgrid=False, tickfont=dict(size=10), title="%"),
        yaxis=dict(showgrid=False, tickfont=dict(size=10)),
        height=max(250, len(tool_names) * 42 + 60),
    )

    # 5. Token grouped bar per run
    if runs:
        fig_tok_bar = go.Figure()
        fig_tok_bar.add_trace(go.Bar(
            x=r_ids, y=[r["input_tokens"]  for r in runs], name="Input",
            marker=dict(color=C["blue"], opacity=0.85),
            hovertemplate="%{x}<br>Input: %{y}<extra></extra>",
        ))
        fig_tok_bar.add_trace(go.Bar(
            x=r_ids, y=[r["output_tokens"] for r in runs], name="Output",
            marker=dict(color=C["amber"], opacity=0.85),
            hovertemplate="%{x}<br>Output: %{y}<extra></extra>",
        ))
        fig_tok_bar.update_layout(**LAYOUT, barmode="group", showlegend=True,
            legend=dict(orientation="h", x=0, y=1.08, font=dict(size=10)),
            xaxis=dict(showgrid=False, tickfont=dict(size=9)),
            yaxis=dict(gridcolor="#EDF2F7", tickfont=dict(size=10), title="tokens"),
        )
    else:
        fig_tok_bar = go.Figure()
        fig_tok_bar.add_annotation(text="No per-run data in report",
                                    xref="paper", yref="paper", x=0.5, y=0.5,
                                    showarrow=False, font=dict(size=13, color=C["muted"]))
        fig_tok_bar.update_layout(**LAYOUT)

    # 6. Tool calls pie
    t_calls = [per_tool[t]["total_calls"] for t in tool_names]
    fig_pie = go.Figure(go.Pie(
        labels=tool_names, values=t_calls, hole=0.45,
        marker=dict(colors=tool_colors),
        textinfo="percent+label", textfont=dict(size=10),
        hovertemplate="%{label}: %{value} calls<extra></extra>",
    ))
    fig_pie.update_layout(**LAYOUT, showlegend=False)

    # 7. Summary table
    err_counts = [len(per_tool[t]["recent_errors"]) for t in tool_names]
    cell_fill  = [[C["green"] if v==100 else C["amber"] if v>=80 else C["red"] for v in t_sr]]
    fig_table = go.Figure(go.Table(
        columnwidth=[180, 70, 100, 120, 120, 70],
        header=dict(
            values=["<b>Tool</b>","<b>Calls</b>","<b>Success %</b>",
                    "<b>Avg latency</b>","<b>Max latency</b>","<b>Errors</b>"],
            fill_color="#EEF2FF", align="left",
            font=dict(size=12, color=C["text"]),
            line_color=C["border"], height=36,
        ),
        cells=dict(
            values=[
                tool_names,
                t_calls,
                [f"{v}%" for v in t_sr],
                [f"{per_tool[t]['avg_latency_ms']} ms" for t in tool_names],
                [f"{per_tool[t]['max_latency_ms']} ms" for t in tool_names],
                err_counts,
            ],
            fill_color=["white","white", cell_fill[0], "white","white","white"],
            font=dict(size=12, color=["white" if c in (C["green"],C["red"],C["amber"]) else C["text"]
                                       for c in (["white"]*len(tool_names))]),
            align="left", line_color=C["border"], height=32,
        ),
    ))
    fig_table.update_layout(paper_bgcolor="rgba(0,0,0,0)",
                             margin=dict(l=0,r=0,t=0,b=0),
                             font=dict(family="Segoe UI, Arial"))

    # ── KPI values ──────────────────────────────────────────────────────────
    success_color = C["green"] if overall["success_rate_pct"]==100 \
                    else C["amber"] if overall["success_rate_pct"]>=80 else C["red"]

    # ── layout ───────────────────────────────────────────────────────────────
    app = Dash(__name__, title="HR Orchestrator — Metrics")

    ROW  = {"display":"flex","gap":"16px","flexWrap":"wrap","marginBottom":"16px"}
    HEAD = {"fontSize":"11px","fontWeight":"600","color":C["muted"],
            "textTransform":"uppercase","letterSpacing":"0.07em","marginBottom":"10px"}

    app.layout = html.Div([

        # header
        html.Div([
            html.H1("HR Orchestrator — Performance Dashboard",
                    style={"fontSize":"20px","fontWeight":"700",
                           "color":C["text"],"margin":"0"}),
            html.P(f"Generated: {data.get('generated_at','')[:19].replace('T',' ')} UTC",
                   style={"fontSize":"12px","color":C["muted"],"margin":"4px 0 0"}),
        ], style={"marginBottom":"22px","paddingTop":"8px"}),

        # ── KPI row
        html.Div([
            kpi("Total runs",       overall["total_runs"],
                f"{overall['successful_runs']} ok / {overall['failed_runs']} failed"),
            kpi("Success rate",     f"{overall['success_rate_pct']}%",
                "across all runs",  color=success_color),
            kpi("Avg latency",      f"{overall['avg_latency_ms']} ms",
                f"P95: {overall['p95_latency_ms']} ms"),
            kpi("Avg tokens / run", tok["avg_tokens_per_run"],
                f"{tok['total_input_tokens']+tok['total_output_tokens']:,} total"),
            kpi("Tool calls / run", overall["avg_tool_calls_per_run"]),
            kpi("Reasoning steps",  overall["avg_reasoning_steps_per_run"], "per run"),
        ], style={**ROW}),

        # ── row 1 : latency line + token donut
        html.Div([
            card(html.P("Run latency (ms)", style=HEAD),
                 dcc.Graph(figure=fig_line, config=CFG, style={"height":"230px"}),
                 flex=3, min_w="320px"),
            card(html.P("Token split", style=HEAD),
                 dcc.Graph(figure=fig_donut, config=CFG, style={"height":"230px"}),
                 flex=1, min_w="220px"),
        ], style=ROW),

        # ── row 2 : tool latency + success rate
        html.Div([
            card(html.P("Avg latency per tool (ms)", style=HEAD),
                 dcc.Graph(figure=fig_lat_bar, config=CFG,
                           style={"height": f"{max(250, len(tool_names)*42+60)}px"}),
                 flex=1, min_w="300px"),
            card(html.P("Success rate per tool (%)", style=HEAD),
                 dcc.Graph(figure=fig_sr, config=CFG,
                           style={"height": f"{max(250, len(tool_names)*42+60)}px"}),
                 flex=1, min_w="300px"),
        ], style=ROW),

        # ── row 3 : token per run + tool calls pie
        html.Div([
            card(html.P("Tokens per run — input vs output", style=HEAD),
                 dcc.Graph(figure=fig_tok_bar, config=CFG, style={"height":"250px"}),
                 flex=2, min_w="300px"),
            card(html.P("Tool call share", style=HEAD),
                 dcc.Graph(figure=fig_pie, config=CFG, style={"height":"250px"}),
                 flex=1, min_w="220px"),
        ], style=ROW),

        # ── row 4 : summary table
        card(html.P("Per-tool summary", style=HEAD),
             dcc.Graph(figure=fig_table, config=CFG,
                       style={"height": f"{len(tool_names)*32+50}px"}),
             flex=1, min_w="100%"),

    ], style={
        "fontFamily":"Segoe UI, Arial, sans-serif",
        "background": C["bg"],
        "minHeight":"100vh",
        "padding":"24px 32px",
        "color": C["text"],
    })

    print("\n" + "="*52)
    print("  HR Orchestrator — Metrics Dashboard")
    print("  Open → http://127.0.0.1:8050")
    print("  Stop → Ctrl+C")
    print("="*52 + "\n")
    app.run(debug=False, port=8050)


# ---------------------------------------------------------------------------
# Quick smoke test  ➜  exports JSON  ➜  launches dashboard
# ---------------------------------------------------------------------------

if __name__ == "__main__":
    import random

    async def _smoke_test():
        collector = MetricsCollector()

        tools_pool = [
            "screen_resume", "schedule_interview", "generate_offer_letter",
            "onboard_employee", "send_email", "schedule_meeting", "execute_mongo_query",
        ]

        for i in range(12):
            thread_id = f"thread-{i}"
            async with collector.run(thread_id=thread_id,
                                     user_input=f"HR workflow query #{i}") as ctx:
                await asyncio.sleep(random.uniform(0.05, 0.35))

                for tool in random.sample(tools_pool, k=random.randint(2, 4)):
                    ctx.on_tool_start(tool, {"candidate": "Alice"})
                    await asyncio.sleep(random.uniform(0.02, 0.12))
                    if random.random() > 0.12:
                        ctx.on_tool_end(tool, "OK")
                    else:
                        ctx.on_tool_error(tool, "Timeout")

                ctx.on_token_usage(
                    input_tokens=random.randint(250, 900),
                    output_tokens=random.randint(100, 450),
                )
                for _ in range(random.randint(1, 3)):
                    ctx.on_reasoning_step()

        # also attach per-run detail so token bar chart works
        runs_detail = []
        for r in collector.runs:
            runs_detail.append({
                "run_id":       r.thread_id,
                "latency_ms":   r.latency_ms or 0,
                "success":      r.success,
                "input_tokens": r.total_input_tokens,
                "output_tokens":r.total_output_tokens,
                "tool_calls":   [{"tool_name": tc.tool_name,
                                   "latency_ms": tc.latency_ms or 0,
                                   "success": tc.success} for tc in r.tool_calls],
                "reasoning_steps": r.reasoning_steps,
            })

        collector.print_report()

        report_path = "metrics_report.json"
        summary = collector.summary()
        summary["_runs"] = runs_detail          # inject per-run data for charts
        with open(report_path, "w") as f:
            json.dump(summary, f, indent=2)
        print(f"Report saved → {report_path}")

        launch_dashboard(report_path)

    asyncio.run(_smoke_test())