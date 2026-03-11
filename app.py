import streamlit as st
from azure.ai.inference import ChatCompletionsClient
from azure.ai.inference.models import SystemMessage, UserMessage
from azure.core.credentials import AzureKeyCredential

st.title("Aura AI Agent")

# 1. Setup Client with the FIXED GitHub endpoint
# You only need the GITHUB_TOKEN in your Streamlit Secrets now.
GITHUB_ENDPOINT = "https://models.github.ai/inference"

token = st.secrets.get("GITHUB_TOKEN")
if not token:
    st.error("Please add GITHUB_TOKEN to your Streamlit Secrets.")
    st.stop()

client = ChatCompletionsClient(
    endpoint=GITHUB_ENDPOINT,
    credential=AzureKeyCredential(token),
    connection_timeout=120,
    read_timeout=120
)

# 2. Chat Logic (Same as before)
if "messages" not in st.session_state:
    st.session_state.messages = [SystemMessage(content="Your name is Aura")]

# Display chat history
for msg in st.session_state.messages:
    if isinstance(msg, UserMessage):
        st.chat_message("user").write(msg.content)
    elif hasattr(msg, 'role') and msg.role == "assistant":
        st.chat_message("assistant").write(msg.content)

# Chat input
if prompt := st.chat_input():
    st.session_state.messages.append(UserMessage(content=prompt))
    st.chat_message("user").write(prompt)

    try:
        response = client.complete(
            messages=st.session_state.messages,
            model="meta/Llama-4-Scout-17B-16E-Instruct",
            temperature=0.8,
        )
        
        output = response.choices[0].message.content
        st.session_state.messages.append(response.choices[0].message)
        st.chat_message("assistant").write(output)
    except Exception as e:
        st.error(f"AI Error: {e}")
