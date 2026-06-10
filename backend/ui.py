import streamlit as st
import asyncio
import uuid
import os
import sys

# Ensure the backend directory is in the path to resolve imports correctly
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from app.services.langchain_orchestrator import stream_orchestrate

# Streamlit App Configurations
st.set_page_config(page_title="HR Agent OS", page_icon="🤖", layout="wide")

st.title("🤖 HR Multi-Agent OS")
st.markdown("Interact dynamically with multi-agent workflows, databases, and HR processes securely.")

# Initialize Chat Memory State
if "messages" not in st.session_state:
    st.session_state.messages = []
if "thread_id" not in st.session_state:
    st.session_state.thread_id = str(uuid.uuid4())

# Sidebar settings and clear memory option
with st.sidebar:
    st.header("⚙️ Agent Memory Checkpoint")
    st.info(f"**Session Thread ID:** `{st.session_state.thread_id}`\n\nThe agent uses this to remember your past interactions!")
    if st.button("Reset Memory / New Conversation"):
        st.session_state.messages = []
        st.session_state.thread_id = str(uuid.uuid4())
        st.experimental_rerun()
    st.divider()
    st.markdown("""
    **🔧 Supported Actions:**
    - `generate_offer_letter`
    - `create_onboarding_plan`
    - `screen_resume`
    - `schedule_interview`
    - `schedule_meeting`
    - `send_email`
    - `execute_mongo_query` (DB Writes/Reads allowed!)
    """)    

# Render conversational history
for message in st.session_state.messages:
    with st.chat_message(message["role"]):
        if "thoughts" in message and message["thoughts"]:
            with st.expander("🧠 Agent Actions & Sub-Tasks", expanded=False):
                for t in message["thoughts"]:
                    st.markdown(t)
        st.markdown(message["content"])

# Prompt capture
prompt = st.chat_input("Ask the HR Agent to perform a task (e.g., 'Onboard John Doe' or 'Query DB for employee 123')...")

if prompt:
    # Show user prompt
    st.session_state.messages.append({"role": "user", "content": prompt})
    with st.chat_message("user"):
        st.markdown(prompt)

    # Show agent execution block
    with st.chat_message("assistant"):
        thought_container = st.expander("🧠 Agent Live Thought Process", expanded=True)
        message_placeholder = st.empty()
        
        thoughts_accumulated = []
        response_text = ""
        
        # We isolate LangChain execution inside a Thread to avoid sniffio / Streamlit event loop clashes
        def run_isolated_stream():
            import queue
            import threading
            
            q = queue.Queue()
            
            def worker():
                async def _worker():
                    try:
                        async for chunk in stream_orchestrate(prompt, st.session_state.thread_id):
                            q.put(chunk)
                    except Exception as e:
                        q.put({"type": "error", "data": str(e)})
                    q.put(None)
                    
                # Dedicated Thread Event Loop guarantees compatibility with sniffio + httpx
                loop = asyncio.new_event_loop()
                asyncio.set_event_loop(loop)
                loop.run_until_complete(_worker())
                loop.close()
                
            threading.Thread(target=worker, daemon=True).start()
            
            while True:
                chunk = q.get()
                if chunk is None:
                    break
                yield chunk
                
        # Consume the queue stream synchronously
        for chunk in run_isolated_stream():
            if chunk["type"] == "content_chunk":
                response_text += chunk["data"]
                message_placeholder.markdown(response_text + "▌")
            elif chunk["type"] == "thought":
                text = chunk["data"]
                thoughts_accumulated.append(text)
                thought_container.markdown(text + "\n\n---")
            elif chunk["type"] == "error":
                error_txt = f"⚠️ System Stream Error: {chunk['data']}"
                thoughts_accumulated.append(error_txt)
                thought_container.error(error_txt)
                message_placeholder.markdown("System critically halted.")
                
        full_response = response_text
        
        # Final update removing the cursor
        if full_response.strip() == "" and len(thoughts_accumulated) > 0:
            full_response = "Finished processing backing tasks autonomously."
            
        message_placeholder.markdown(full_response)
        
        # Append completion into session state
        st.session_state.messages.append({
            "role": "assistant", 
            "content": full_response,
            "thoughts": thoughts_accumulated
        })
