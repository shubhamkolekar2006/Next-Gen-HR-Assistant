import json
import logging
import asyncio
import inspect
import os
from typing import Dict, Any, Callable, Optional
from dotenv import load_dotenv

load_dotenv()

from langgraph.prebuilt import create_react_agent
from langgraph.checkpoint.memory import MemorySaver
from langchain_core.tools import StructuredTool, Tool
from langchain_groq import ChatGroq

from app.services.document_generation_agent import DocumentGenerationAgent
from app.services.onboarding_agent import OnboardingAgent
from app.services.resume_screening_agent import ResumeScreeningAgent
from app.services.interview_coordinator_agent import InterviewCoordinatorAgent
from app.services.meeting_scheduler_agent import MeetingSchedulerAgent
from app.services.email_service import send_email
from app.core.database import get_database

logging.basicConfig(level=logging.INFO, format="%(asctime)s - %(levelname)s - %(message)s")
logger = logging.getLogger(__name__)

# Initialize agent classes to bind their methods
doc_agent = DocumentGenerationAgent()
onb_agent = OnboardingAgent()
res_agent = ResumeScreeningAgent()
int_agent = InterviewCoordinatorAgent()
mtg_agent = MeetingSchedulerAgent()

def create_async_agent_tool(name: str, func: Callable, description: str) -> StructuredTool:
    """Wraps agent methods natively into Async LangChain Structured Tools with dynamic kwargs."""
    sig = inspect.signature(func)
    
    async def run_tool(parsed_input: dict) -> str:
        logger.info(f"Executing {name} asynchronously with {parsed_input}")
        try:
            kwargs = {}
            for p_name, p in sig.parameters.items():
                if len(sig.parameters) == 1:
                    kwargs[p_name] = parsed_input
                    break
                    
                if p_name in parsed_input:
                    kwargs[p_name] = parsed_input[p_name]
                elif any(keyword in p_name for keyword in ["data", "details", "info"]):
                    kwargs[p_name] = parsed_input
                elif p.default is not inspect.Parameter.empty:
                    pass
                else:
                    kwargs[p_name] = parsed_input.get(p_name, f"auto-generated-{p_name}")
            
            # Use await natively if the underlying method is a coroutine
            if inspect.iscoroutinefunction(func) or inspect.isawaitable(func):
                result = await func(**kwargs)
            else:
                result = func(**kwargs)
                if inspect.iscoroutine(result):
                    result = await result
                
            return json.dumps(result) if isinstance(result, (dict, list)) else str(result)
        except Exception as e:
            err_msg = f"Error executing {name}: {str(e)}"
            logger.error(err_msg)
            return err_msg

    return StructuredTool.from_function(
        func=None,
        coroutine=run_tool,
        name=name,
        description=description,
    )

# Async MongoDB Tool
async def execute_mongo_query(collection_name: str, operation: str, query: dict, update: dict = None) -> str:
    """Useful to perform DB mutations. operations: 'delete_one', 'update_one', 'find'. Pass query/update directly as dictionaries."""
    db = get_database()
    if db is None:
        return "Database is disconnected. Action failed."
    col = db[collection_name]
    try:
        if operation == "delete_one":
            res = await col.delete_one(query)
            return f"Deleted {res.deleted_count} record(s)."
        elif operation == "update_one":
            if update is None:
                return "Error: param 'update' is required for update_one operation (usually {\"$set\": {...}})."
            res = await col.update_one(query, {"$set": update})
            return f"Updated {res.modified_count} record(s)."
        elif operation == "find":
            cursor = col.find(query).limit(10)
            records = await cursor.to_list(length=10)
            return str([{**r, "_id": str(r["_id"])} for r in records if "_id" in r])
        else:
            return f"Operation {operation} not supported natively right now. Ask user or fallback."
    except Exception as e:
        return f"Error executing DB query: {str(e)}"

# Register all tools using Async standard
tools = [
    create_async_agent_tool(
        name="generate_offer_letter",
        func=doc_agent.generate_offer_letter,
        description="Generates an offer letter for a candidate. Input MUST be a valid JSON dictionary mapping to candidate details."
    ),
    create_async_agent_tool(
        name="onboard_employee",
        func=onb_agent.create_onboarding_plan,
        description="Stores employee details in the database to start onboarding. Input MUST be a valid JSON dictionary containing 'employee_id', 'name', 'email', 'department', 'position', and 'start_date'."
    ),
    create_async_agent_tool(
        name="screen_resume",
        func=res_agent.screen_resume,
        description="Analyzes a resume to determine suitability. Input MUST be a valid JSON dictionary."
    ),
    create_async_agent_tool(
        name="schedule_interview",
        func=int_agent.create_interview_workflow,
        description="Schedules an interview sequence. Input MUST be a valid JSON dictionary."
    ),
    create_async_agent_tool(
        name="schedule_meeting",
        func=mtg_agent.schedule_meeting,
        description="Schedules an internal meeting for the team. Input MUST be a valid JSON dictionary."
    ),
    create_async_agent_tool(
        name="send_email",
        func=send_email,
        description="Sends an email notification. Input MUST be a valid JSON dictionary containing email details."
    ),
    StructuredTool.from_function(
        func=None,
        coroutine=execute_mongo_query,
        name="execute_mongo_query",
        description="Connects to Native MongoDB Database. Required Input mapping: collection_name (str), operation (str), query (dict payload), update (optional dict payload)."
    )
]

# Set up global memory component to preserve chat state
memory = MemorySaver()

# Keep a global model
try:
    llm = ChatGroq(
        api_key=os.getenv("GROQ_API_KEY"),
        model="llama-3.1-8b-instant",
        temperature=0
    )
    
    system_prompt = """You are the Master HR Orchestrator Agent, an autonomous AI capable of planning and executing complex HR workflows.
When a user submits a request, you must:
1. Thoughtfully plan the sequence of required steps to accomplish the goal.
2. Call the appropriate specialized agent tools (e.g., screen_resume, schedule_interview, generate_offer_letter, onboard_employee, send_email, schedule_meeting, execute_mongo_query) in the correct order.
3. IMPORTANT: All tools require a single top-level argument called `parsed_input`. You MUST wrap your JSON payload inside this `parsed_input` parameter. For example: `{"parsed_input": {"candidate_name": "Alice", "resume": "dummy"}}` or `{"parsed_input": {"employee_id": "EMP01", "name": "Alice", "department": "Engineering", "position": "Developer"}}`. Pay attention to the specific fields required by each tool.
4. If some specific details are missing from the user prompt, generate reasonable dummy data (like 'TBD', fake names, random IDs, or standard job descriptions) so the workflow can proceed without halting.
5. Synthesize the results of all tool executions into a clear, comprehensive final response for the user.
Do not ask for user confirmation for every step; execute the entire planned workflow and return the final outcome."""

    agent_executor = create_react_agent(
        llm, 
        tools, 
        checkpointer=memory,
        prompt=system_prompt
    )
    
    # HitL (Human-in-the-loop) Agent Executor
    agent_executor_hitl = create_react_agent(
        llm, 
        tools, 
        checkpointer=memory,
        prompt=system_prompt,
        interrupt_before=["tools"]
    )
except Exception as e:
    logger.error(f"Failed to initialize LangGraph Agent: {str(e)}")
    agent_executor = None
    agent_executor_hitl = None

from app.core.database import connect_to_mongo

async def generate_plan(user_query: str, thread_id: str) -> Dict[str, Any]:
    """Generates a plan by running the agent until it pauses before tool execution."""
    if not agent_executor_hitl:
        return {"status": "error", "response": "Agent executor failed initialization."}
        
    await connect_to_mongo()
    config = {"configurable": {"thread_id": thread_id}}
    
    try:
        # Check if currently paused (awaiting tool execution)
        current_state = await agent_executor_hitl.aget_state(config)
        
        if current_state.next:
            # The agent is paused before executing tools. The user rejected it and gave a new message.
            # We must cancel the pending tool calls so it can replan.
            from langchain_core.messages import ToolMessage
            messages_to_add = []
            
            # Find pending tool calls from the last message
            if "messages" in current_state.values:
                last_msg = current_state.values["messages"][-1]
                if hasattr(last_msg, "tool_calls") and last_msg.tool_calls:
                    for tc in last_msg.tool_calls:
                        messages_to_add.append(
                            ToolMessage(
                                tool_call_id=tc["id"],
                                name=tc["name"],
                                content="SYSTEM: User rejected this action and provided new instructions."
                            )
                        )
            
            # Add the user's new instructions
            messages_to_add.append(("user", user_query))
            
            # Update state to cancel tool calls
            await agent_executor_hitl.aupdate_state(config, {"messages": messages_to_add})
            
            # Resume execution (it will go to agent node to replan)
            state = await agent_executor_hitl.ainvoke(None, config=config)
        else:
            # Not paused, standard invocation
            state = await agent_executor_hitl.ainvoke({"messages": [("user", user_query)]}, config=config)

        last_message = state["messages"][-1]
        
        tool_calls = []
        if hasattr(last_message, "tool_calls") and last_message.tool_calls:
            for tc in last_message.tool_calls:
                tool_calls.append({
                    "name": tc.get("name"),
                    "args": tc.get("args")
                })
                
        reasoning = ""
        if isinstance(last_message.content, str):
            reasoning = last_message.content
        elif isinstance(last_message.content, list):
            reasoning = "".join([block.get("text", "") for block in last_message.content if isinstance(block, dict) and block.get("type") == "text"])
            
        return {
            "status": "plan_ready",
            "reasoning": reasoning,
            "tool_calls": tool_calls
        }
    except Exception as e:
        logger.error(f"Error generating plan: {str(e)}")
        return {"status": "error", "response": str(e)}

async def execute_plan(thread_id: str) -> Dict[str, Any]:
    """Resumes agent execution from a paused state."""
    if not agent_executor_hitl:
        return {"status": "error", "response": "Agent executor failed initialization."}
        
    await connect_to_mongo()
    config = {"configurable": {"thread_id": thread_id}}
    
    try:
        # Resume the agent by passing None
        state = await agent_executor_hitl.ainvoke(None, config=config)
        last_message = state["messages"][-1]
        
        final_answer = ""
        if isinstance(last_message.content, str):
            final_answer = last_message.content
        elif isinstance(last_message.content, list):
            final_answer = "".join([block.get("text", "") for block in last_message.content if isinstance(block, dict) and block.get("type") == "text"])
        else:
            final_answer = str(last_message.content)
            
        return {
            "status": "success",
            "response": final_answer
        }
    except Exception as e:
        logger.error(f"Error executing plan: {str(e)}")
        return {"status": "error", "response": str(e)}
from app.core.database import connect_to_mongo

# Deprecated synchronous method maintained temporarily to avoid breaking test scripts
def orchestrate(user_input: str) -> Dict[str, Any]:
    """Compatibility orchestrate function (Synchronous wrapping of Async Execution)."""
    if not agent_executor:
        return {"status": "error", "response": "Agent executor failed initialization."}
        
    async def _run():
        await connect_to_mongo()
        logger.info(f"--- Starting Sync Compat Orchestration for input: '{user_input}' ---")
        config = {"configurable": {"thread_id": "legacy_sync_thread"}}
        response = await agent_executor.ainvoke({"messages": [("user", user_input)]}, config=config)
        last_message = response["messages"][-1]
        
        if isinstance(last_message.content, list):
            final_answer = "".join([block.get("text", "") for block in last_message.content if isinstance(block, dict) and block.get("type") == "text"])
        else:
            final_answer = str(last_message.content)
            
        return {"status": "success", "response": final_answer}
        
    return asyncio.run(_run())

# Expose fully reactive streamer for the frontend UI integration
async def stream_orchestrate(user_input: str, thread_id: str):
    """Yields streaming thoughts and execution steps dynamically to feed into Streamlit UI."""
    await connect_to_mongo()
    config = {"configurable": {"thread_id": thread_id}}
    
    # LangGraph streams node progress natively.
    async for event in agent_executor.astream_events({"messages": [("user", user_input)]}, config=config, version="v1"):
        kind = event["event"]
        
        if kind == "on_chat_model_stream":
            content = event["data"]["chunk"].content
            if content:
                yield {"type": "content_chunk", "data": content}
                
        elif kind == "on_tool_start":
            tool_name = event["name"]
            tool_input = event["data"].get("input")
            yield {"type": "thought", "data": f"🛠️ **Executing Agent Action:** `{tool_name}`\n*Input: {tool_input}*"}
            
        elif kind == "on_tool_end":
            tool_name = event["name"]
            tool_output = event["data"].get("output")
            # Truncate length optionally for clean UI
            output_str = str(tool_output)
            if len(output_str) > 300:
                output_str = output_str[:300] + "... [truncated]"
            yield {"type": "thought", "data": f"✅ **Completed:** `{tool_name}`\n*Output: {output_str}*"}
