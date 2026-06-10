"""
metrics_dashboard.py
--------------------
Interactive Plotly Dash dashboard for the LangGraph HR Orchestrator metrics.

Run:
    python metrics_dashboard.py

Then open http://127.0.0.1:8050 in your browser.

How it works:
  - On first load it runs the built-in smoke test (same random simulation
    used before) to populate metrics data.
  - Every 5 seconds the dashboard auto-refreshes with the latest data.
  - If you have a real metrics_report.json on disk it will load that instead.
"""

import os
import sys
import json
import random
import asyncio
import time
from datetime import datetime, timezone
from collections import defaultdict

# ---------------------------------------------------------------------------
# 1. Generate / load metrics data
# ---------------------------------------------------------------------------

REPORT_PATH = os.path.join(os.path.dirname(__file__), "metrics_report.json")

TOOL_NAMES = [
    "screen_resume",
    "schedule_interview",
    "generate_offer_letter",
    "onboard_employee",
    "send_email",
    "schedule_meeting",
    "execute_mongo_query",
]


def simulate_metrics(n_runs: int = 10) -> dict:
    """Generate realistic-looking simulated metrics."""
    runs = []
    tool_stats = defaultdict(lambda: {
        "calls": 0, "successes": 0, "failures": 0,
        "latencies_ms": [], "errors": []
    })

    for i in range(n_runs):
        run_start = time.monotonic()
        selected_tools = random.sample(TOOL_NAMES, k=random.randint(2, 4))
        tool_calls = []
        for tool in selected_tools:
            lat = round(random.uniform(40, 300), 2)
            success = random.random() > 0.12
            tool_calls.append({
                "tool_name": tool,
                "latency_ms": lat,
                "success": success,
                "error": "Timeout" if not success else None,
            })
            s = tool_stats[tool]
            s["calls"] += 1
            s["latencies_ms"].append(lat)
            if success:
                s["successes"] += 1
            else:
                s["failures"] += 1
                s["errors"].append("Timeout")

        run_latency = round(random.uniform(200, 800), 2)
        inp_tok = random.randint(300, 900)
        out_tok = random.randint(100, 500)
        runs.append({
            "run_id": f"run-{i}",
            "latency_ms": run_latency,
            "success": all(tc["success"] for tc in tool_calls),
            "input_tokens": inp_tok,
            "output_tokens": out_tok,
            "tool_calls": tool_calls,
            "reasoning_steps": random.randint(1, 4),
        })

    total = len(runs)
    successful = sum(1 for r in runs if r["success"])
    latencies = [r["latency_ms"] for r in runs]
    sorted_lats = sorted(latencies)
    p95 = round(sorted_lats[int(len(sorted_lats) * 0.95)], 2)

    per_tool = {}
    for tool, s in tool_stats.items():
        lats = s["latencies_ms"]
        per_tool[tool] = {
            "total_calls": s["calls"],
            "success_rate_pct": round(s["successes"] / s["calls"] * 100, 1),
            "avg_latency_ms": round(sum(lats) / len(lats), 2) if lats else 0,
            "max_latency_ms": round(max(lats), 2) if lats else 0,
            "recent_errors": s["errors"][-3:],
        }

    return {
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "overall": {
            "total_runs": total,
            "successful_runs": successful,
            "failed_runs": total - successful,
            "success_rate_pct": round(successful / total * 100, 1),
            "avg_latency_ms": round(sum(latencies) / len(latencies), 2),
            "p95_latency_ms": p95,
            "avg_tool_calls_per_run": round(
                sum(len(r["tool_calls"]) for r in runs) / total, 2),
            "avg_reasoning_steps_per_run": round(
                sum(r["reasoning_steps"] for r in runs) / total, 2),
        },
        "token_usage": {
            "total_input_tokens": sum(r["input_tokens"] for r in runs),
            "total_output_tokens": sum(r["output_tokens"] for r in runs),
            "avg_tokens_per_run": round(
                sum(r["input_tokens"] + r["output_tokens"] for r in runs) / total, 1),
        },
        "per_tool": per_tool,
        "_runs": runs,   # kept for per-run charts
    }


def load_data() -> dict:
    if os.path.exists(REPORT_PATH):
        with open(REPORT_PATH) as f:
            return json.load(f)
    data = simulate_metrics(n_runs=12)
    with open(REPORT_PATH, "w") as f:
        json.dump(data, f, indent=2)
    return data


# ---------------------------------------------------------------------------
# 2. Dash app
# ---------------------------------------------------------------------------

from dash import Dash, dcc, html, Input, Output, callback
import plotly.graph_objects as go
import plotly.express as px

COLORS = {
    "blue":   "#3266ad",
    "green":  "#2e8b57",
    "red":    "#c0392b",
    "amber":  "#cc8800",
    "gray":   "#73726c",
    "purple": "#7F77DD",
    "teal":   "#1D9E75",
    "coral":  "#D85A30",
    "bg":     "#f8f8f8",
    "card":   "#ffffff",
    "border": "#e0e0e0",
    "text":   "#1a1a1a",
    "muted":  "#666666",
}

TOOL_COLORS = {
    "screen_resume":          "#3266ad",
    "schedule_interview":     "#7F77DD",
    "generate_offer_letter":  "#1D9E75",
    "onboard_employee":       "#D85A30",
    "send_email":             "#cc8800",
    "schedule_meeting":       "#2e8b57",
    "execute_mongo_query":    "#73726c",
}

app = Dash(__name__, title="HR Orchestrator — Metrics Dashboard")

CARD_STYLE = {
    "background": COLORS["card"],
    "border": f"1px solid {COLORS['border']}",
    "borderRadius": "12px",
    "padding": "20px 24px",
    "marginBottom": "16px",
}

METRIC_CARD = {
    "background": "#f0f2f5",
    "borderRadius": "10px",
    "padding": "16px 20px",
    "flex": "1",
    "minWidth": "140px",
}

CHART_CONFIG = {"displayModeBar": False, "responsive": True}

LAYOUT_BASE = dict(
    paper_bgcolor="rgba(0,0,0,0)",
    plot_bgcolor="rgba(0,0,0,0)",
    font=dict(family="Inter, Arial, sans-serif", color=COLORS["text"], size=12),
    margin=dict(l=16, r=16, t=16, b=16),
    showlegend=False,
)

app.layout = html.Div([
    dcc.Interval(id="refresh", interval=5000, n_intervals=0),

    # Header
    html.Div([
        html.H1("HR Orchestrator — Performance Dashboard",
                style={"fontSize": "20px", "fontWeight": "500",
                       "color": COLORS["text"], "margin": "0"}),
        html.P(id="last-updated", style={"fontSize": "12px",
               "color": COLORS["muted"], "margin": "4px 0 0"}),
    ], style={"marginBottom": "24px", "paddingTop": "8px"}),

    # ── Row 1: KPI cards ──────────────────────────────────────────────────
    html.Div(id="kpi-row",
             style={"display": "flex", "gap": "12px",
                    "flexWrap": "wrap", "marginBottom": "16px"}),

    # ── Row 2: Latency + Token pie ────────────────────────────────────────
    html.Div([
        html.Div([
            html.P("Run latency (ms)", style={"fontSize": "12px",
                   "fontWeight": "500", "color": COLORS["muted"],
                   "textTransform": "uppercase", "letterSpacing": "0.05em",
                   "marginBottom": "12px"}),
            dcc.Graph(id="latency-line", config=CHART_CONFIG,
                      style={"height": "220px"}),
        ], style={**CARD_STYLE, "flex": "2", "minWidth": "300px"}),

        html.Div([
            html.P("Token split", style={"fontSize": "12px",
                   "fontWeight": "500", "color": COLORS["muted"],
                   "textTransform": "uppercase", "letterSpacing": "0.05em",
                   "marginBottom": "12px"}),
            dcc.Graph(id="token-pie", config=CHART_CONFIG,
                      style={"height": "220px"}),
        ], style={**CARD_STYLE, "flex": "1", "minWidth": "220px"}),
    ], style={"display": "flex", "gap": "16px", "flexWrap": "wrap",
              "marginBottom": "0"}),

    # ── Row 3: Per-tool latency bar + success rate bar ────────────────────
    html.Div([
        html.Div([
            html.P("Avg latency per tool (ms)", style={"fontSize": "12px",
                   "fontWeight": "500", "color": COLORS["muted"],
                   "textTransform": "uppercase", "letterSpacing": "0.05em",
                   "marginBottom": "12px"}),
            dcc.Graph(id="tool-latency-bar", config=CHART_CONFIG,
                      style={"height": "240px"}),
        ], style={**CARD_STYLE, "flex": "1", "minWidth": "280px"}),

        html.Div([
            html.P("Success rate per tool (%)", style={"fontSize": "12px",
                   "fontWeight": "500", "color": COLORS["muted"],
                   "textTransform": "uppercase", "letterSpacing": "0.05em",
                   "marginBottom": "12px"}),
            dcc.Graph(id="tool-success-bar", config=CHART_CONFIG,
                      style={"height": "240px"}),
        ], style={**CARD_STYLE, "flex": "1", "minWidth": "280px"}),
    ], style={"display": "flex", "gap": "16px", "flexWrap": "wrap",
              "marginBottom": "0"}),

    # ── Row 4: Token usage per run + total calls per tool ─────────────────
    html.Div([
        html.Div([
            html.P("Tokens per run (input vs output)", style={"fontSize": "12px",
                   "fontWeight": "500", "color": COLORS["muted"],
                   "textTransform": "uppercase", "letterSpacing": "0.05em",
                   "marginBottom": "12px"}),
            dcc.Graph(id="token-grouped-bar", config=CHART_CONFIG,
                      style={"height": "240px"}),
        ], style={**CARD_STYLE, "flex": "2", "minWidth": "300px"}),

        html.Div([
            html.P("Total calls per tool", style={"fontSize": "12px",
                   "fontWeight": "500", "color": COLORS["muted"],
                   "textTransform": "uppercase", "letterSpacing": "0.05em",
                   "marginBottom": "12px"}),
            dcc.Graph(id="tool-calls-pie", config=CHART_CONFIG,
                      style={"height": "240px"}),
        ], style={**CARD_STYLE, "flex": "1", "minWidth": "220px"}),
    ], style={"display": "flex", "gap": "16px", "flexWrap": "wrap",
              "marginBottom": "0"}),

    # ── Row 5: Per-tool table ─────────────────────────────────────────────
    html.Div([
        html.P("Per-tool breakdown", style={"fontSize": "12px",
               "fontWeight": "500", "color": COLORS["muted"],
               "textTransform": "uppercase", "letterSpacing": "0.05em",
               "marginBottom": "12px"}),
        dcc.Graph(id="tool-table", config=CHART_CONFIG,
                  style={"height": "auto"}),
    ], style=CARD_STYLE),

], style={
    "fontFamily": "Inter, Arial, sans-serif",
    "background": COLORS["bg"],
    "minHeight": "100vh",
    "padding": "24px 32px",
    "color": COLORS["text"],
})


# ---------------------------------------------------------------------------
# 3. Callbacks
# ---------------------------------------------------------------------------

@app.callback(
    Output("last-updated",      "children"),
    Output("kpi-row",           "children"),
    Output("latency-line",      "figure"),
    Output("token-pie",         "figure"),
    Output("tool-latency-bar",  "figure"),
    Output("tool-success-bar",  "figure"),
    Output("token-grouped-bar", "figure"),
    Output("tool-calls-pie",    "figure"),
    Output("tool-table",        "figure"),
    Input("refresh",            "n_intervals"),
)
def update_dashboard(_n):
    data      = load_data()
    overall   = data["overall"]
    tok       = data["token_usage"]
    per_tool  = data["per_tool"]
    runs      = data.get("_runs", [])

    ts = f"Last updated: {datetime.now().strftime('%H:%M:%S')}"

    # ── KPI cards ──────────────────────────────────────────────────────────
    def kpi(label, value, sub=None, color=COLORS["text"]):
        return html.Div([
            html.P(label, style={"fontSize": "11px", "color": COLORS["muted"],
                                  "marginBottom": "6px", "fontWeight": "500",
                                  "textTransform": "uppercase",
                                  "letterSpacing": "0.05em"}),
            html.P(str(value), style={"fontSize": "26px", "fontWeight": "500",
                                       "color": color, "margin": "0"}),
            html.P(sub or "", style={"fontSize": "11px",
                                      "color": COLORS["muted"], "marginTop": "4px"}),
        ], style=METRIC_CARD)

    sr   = overall["success_rate_pct"]
    sr_c = COLORS["green"] if sr == 100 else COLORS["amber"] if sr >= 80 else COLORS["red"]
    kpis = [
        kpi("Total runs",       overall["total_runs"],
            f"{overall['successful_runs']} ok / {overall['failed_runs']} failed"),
        kpi("Success rate",     f"{sr}%", "all runs", color=sr_c),
        kpi("Avg latency",      f"{overall['avg_latency_ms']}ms",
            f"P95 {overall['p95_latency_ms']}ms"),
        kpi("Avg tokens / run", overall["avg_tokens_per_run"],
            f"{tok['total_input_tokens']+tok['total_output_tokens']:,} total"),
        kpi("Avg tool calls",   overall["avg_tool_calls_per_run"], "per run"),
        kpi("Avg reasoning",    overall["avg_reasoning_steps_per_run"], "steps / run"),
    ]

    # ── Latency line chart ─────────────────────────────────────────────────
    run_labels = [r["run_id"] for r in runs]
    run_lats   = [r["latency_ms"] for r in runs]
    lat_colors = [COLORS["green"] if r["success"] else COLORS["red"] for r in runs]

    fig_lat = go.Figure()
    fig_lat.add_trace(go.Scatter(
        x=run_labels, y=run_lats, mode="lines+markers",
        line=dict(color=COLORS["blue"], width=2),
        marker=dict(color=lat_colors, size=8),
        hovertemplate="%{x}: %{y}ms<extra></extra>",
    ))
    fig_lat.add_hline(y=overall["avg_latency_ms"],
                      line_dash="dot", line_color=COLORS["muted"],
                      annotation_text=f"avg {overall['avg_latency_ms']}ms",
                      annotation_font_size=11)
    fig_lat.update_layout(**LAYOUT_BASE,
        xaxis=dict(showgrid=False, tickfont=dict(size=10), title=""),
        yaxis=dict(gridcolor="#eeeeee", tickfont=dict(size=10), title="ms"),
    )

    # ── Token pie ──────────────────────────────────────────────────────────
    fig_tok_pie = go.Figure(go.Pie(
        labels=["Input tokens", "Output tokens"],
        values=[tok["total_input_tokens"], tok["total_output_tokens"]],
        hole=0.55,
        marker=dict(colors=[COLORS["blue"], COLORS["gray"]]),
        textinfo="percent",
        hovertemplate="%{label}: %{value:,}<extra></extra>",
    ))
    fig_tok_pie.update_layout(**LAYOUT_BASE)

    # ── Tool latency bar ───────────────────────────────────────────────────
    t_names = list(per_tool.keys())
    t_avgs  = [per_tool[t]["avg_latency_ms"] for t in t_names]
    t_maxs  = [per_tool[t]["max_latency_ms"] for t in t_names]
    bar_colors = [TOOL_COLORS.get(t, COLORS["blue"]) for t in t_names]

    fig_tool_lat = go.Figure()
    fig_tool_lat.add_trace(go.Bar(
        x=t_names, y=t_avgs, name="Avg",
        marker=dict(color=bar_colors, opacity=0.85),
        hovertemplate="%{x}<br>Avg: %{y}ms<extra></extra>",
    ))
    fig_tool_lat.add_trace(go.Scatter(
        x=t_names, y=t_maxs, mode="markers",
        marker=dict(symbol="diamond", size=9,
                    color=[COLORS["red"]]*len(t_names)),
        name="Max",
        hovertemplate="%{x}<br>Max: %{y}ms<extra></extra>",
    ))
    fig_tool_lat.update_layout(**LAYOUT_BASE, showlegend=True,
        legend=dict(orientation="h", x=0, y=1.12, font=dict(size=10)),
        xaxis=dict(showgrid=False, tickfont=dict(size=10),
                   tickangle=-20, title=""),
        yaxis=dict(gridcolor="#eeeeee", tickfont=dict(size=10), title="ms"),
    )

    # ── Tool success bar ───────────────────────────────────────────────────
    t_sr = [per_tool[t]["success_rate_pct"] for t in t_names]
    sr_colors = [
        COLORS["green"] if v == 100 else COLORS["amber"] if v >= 80 else COLORS["red"]
        for v in t_sr
    ]
    fig_tool_sr = go.Figure(go.Bar(
        x=t_names, y=t_sr,
        marker=dict(color=sr_colors, opacity=0.85),
        hovertemplate="%{x}: %{y}%<extra></extra>",
    ))
    fig_tool_sr.update_layout(**LAYOUT_BASE,
        xaxis=dict(showgrid=False, tickfont=dict(size=10),
                   tickangle=-20, title=""),
        yaxis=dict(gridcolor="#eeeeee", tickfont=dict(size=10),
                   range=[0, 105], title="%"),
    )

    # ── Token grouped bar ──────────────────────────────────────────────────
    r_labels  = [r["run_id"] for r in runs]
    r_inp     = [r["input_tokens"]  for r in runs]
    r_out     = [r["output_tokens"] for r in runs]

    fig_tok_bar = go.Figure()
    fig_tok_bar.add_trace(go.Bar(
        x=r_labels, y=r_inp, name="Input",
        marker=dict(color=COLORS["blue"], opacity=0.85),
        hovertemplate="%{x}<br>Input: %{y}<extra></extra>",
    ))
    fig_tok_bar.add_trace(go.Bar(
        x=r_labels, y=r_out, name="Output",
        marker=dict(color=COLORS["gray"], opacity=0.85),
        hovertemplate="%{x}<br>Output: %{y}<extra></extra>",
    ))
    fig_tok_bar.update_layout(**LAYOUT_BASE, barmode="group", showlegend=True,
        legend=dict(orientation="h", x=0, y=1.12, font=dict(size=10)),
        xaxis=dict(showgrid=False, tickfont=dict(size=9), title=""),
        yaxis=dict(gridcolor="#eeeeee", tickfont=dict(size=10), title="tokens"),
    )

    # ── Tool calls pie ─────────────────────────────────────────────────────
    t_calls     = [per_tool[t]["total_calls"] for t in t_names]
    pie_colors  = [TOOL_COLORS.get(t, COLORS["blue"]) for t in t_names]

    fig_calls_pie = go.Figure(go.Pie(
        labels=t_names, values=t_calls, hole=0.45,
        marker=dict(colors=pie_colors),
        textinfo="percent",
        hovertemplate="%{label}: %{value} calls<extra></extra>",
    ))
    fig_calls_pie.update_layout(**LAYOUT_BASE)

    # ── Per-tool table ─────────────────────────────────────────────────────
    err_counts = [len(per_tool[t]["recent_errors"]) for t in t_names]
    cell_colors_sr = [
        COLORS["green"] if v == 100 else COLORS["amber"] if v >= 80 else COLORS["red"]
        for v in t_sr
    ]

    fig_table = go.Figure(go.Table(
        columnwidth=[200, 80, 110, 130, 130, 80],
        header=dict(
            values=["<b>Tool</b>", "<b>Calls</b>", "<b>Success %</b>",
                    "<b>Avg latency</b>", "<b>Max latency</b>", "<b>Errors</b>"],
            fill_color="#f0f2f5",
            align="left",
            font=dict(size=12, color=COLORS["text"]),
            line_color=COLORS["border"],
            height=36,
        ),
        cells=dict(
            values=[
                t_names,
                [per_tool[t]["total_calls"] for t in t_names],
                [f"{v}%" for v in t_sr],
                [f"{per_tool[t]['avg_latency_ms']}ms" for t in t_names],
                [f"{per_tool[t]['max_latency_ms']}ms" for t in t_names],
                err_counts,
            ],
            fill_color=[
                ["white"] * len(t_names),
                ["white"] * len(t_names),
                cell_colors_sr,
                ["white"] * len(t_names),
                ["white"] * len(t_names),
                ["white"] * len(t_names),
            ],
            align="left",
            font=dict(size=12, color=COLORS["text"]),
            line_color=COLORS["border"],
            height=34,
        ),
    ))
    fig_table.update_layout(
        paper_bgcolor="rgba(0,0,0,0)",
        margin=dict(l=0, r=0, t=0, b=0),
        font=dict(family="Inter, Arial, sans-serif"),
    )

    return (ts, kpis, fig_lat, fig_tok_pie, fig_tool_lat,
            fig_tool_sr, fig_tok_bar, fig_calls_pie, fig_table)


# ---------------------------------------------------------------------------
# 4. Entry point
# ---------------------------------------------------------------------------

if __name__ == "__main__":
    print("\n" + "="*55)
    print("  HR Orchestrator — Metrics Dashboard")
    print("  Open:  http://127.0.0.1:8050")
    print("  Stop:  Ctrl+C")
    print("="*55 + "\n")
    app.run(debug=False, port=8050)