import os
import streamlit as st
from azure.ai.inference import ChatCompletionsClient
from azure.ai.inference.models import SystemMessage, UserMessage
from azure.core.credentials import AzureKeyCredential

st.title("Aura AI Agent")

# 1. Setup Client (It will look for GITHUB_TOKEN in Cloud Secrets later)
client = ChatCompletionsClient(
    endpoint="https://github.ai",
    credential=AzureKeyCredential(st.secrets["GITHUB_TOKEN"]),
    connection_timeout=120,
)

# 2. Simple Chat UI
if "messages" not in st.session_state:
    st.session_state.messages = [SystemMessage(content="Your name is Aura")]

for msg in st.session_state.messages:
    if isinstance(msg, UserMessage):
        st.chat_message("user").write(msg.content)
    elif hasattr(msg, 'content') and msg.content and msg.role == "assistant":
        st.chat_message("assistant").write(msg.content)

if prompt := st.chat_input():
    st.session_state.messages.append(UserMessage(content=prompt))
    st.chat_message("user").write(prompt)

    response = client.complete(
        messages=st.session_state.messages,
        model="meta/Llama-4-Scout-17B-16E-Instruct",
        temperature=0.8,
    )
    
    output = response.choices[0].message.content
    st.session_state.messages.append(response.choices[0].message)
    st.chat_message("assistant").write(output)
