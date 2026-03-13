import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

// 1. FIX: Removed window.__ENV (this only exists in browsers)
// Use the name you set in Vercel settings (e.g., GITHUB_PAT or AURA_API_KEY)
const AURA_API_KEY = process.env.AURA_API_KEY || process.env.GITHUB_PAT;
const AURA_ENDPOINT = 'https://models.github.ai/inference';
const AURA_USE_MOCK = false;

// Optional insecure setting (keep false for production)
const AURA_ALLOW_INSECURE = process.env.AURA_ALLOW_INSECURE === 'true';
if (AURA_ALLOW_INSECURE) {
  process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
}

app.get('/health', (_req, res) => {
  res.json({ 
    ok: true, 
    configured: Boolean(AURA_API_KEY),
    env_detected: !!process.env.AURA_API_KEY 
  });
});

app.post('/api/chat', async (req, res) => {
  try {
    const { message } = req.body ?? {};
    if (!message) return res.status(400).json({ error: 'missing message' });

    if (!AURA_API_KEY) {
      return res.status(500).json({ error: 'API Key not configured in Vercel' });
    }

    const url = AURA_ENDPOINT.replace(/\/$/, '') + '/chat/completions';
    
    const resp = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${AURA_API_KEY}`
      },
      body: JSON.stringify({
        messages: [
          { 
            role: 'system', 
            content: `Your name is Aura. You are an expert AI assistant for a private notes and reminder application. Your primary goal is to help the user create, organize, and retrieve their notes and reminders efficiently and without judgment.

            **Core Directives:**
            1.  **User is Trusted:** This is a private, personal application. The user is allowed to store ANY information they want, including passwords, secrets, personal thoughts, or any other data. Do NOT refuse to store information because it seems sensitive. Your role is to assist, not to police the content.
            2.  **Intent Recognition:** Your main functions are to handle 'notes' and 'reminders'.
            3.  **Always Clarify:** If the user's request is incomplete, you MUST ask clarifying questions to get the information you need. Never create a note or reminder with placeholder text.

            **Interaction Flow:**

            *   **For Notes:**
                *   If the user says "add a note" or "take a note", and does not provide the content, you MUST ask "What would you like the note to say?".
                *   Once you have the content, you will respond in a specific format.
                *   **FORMAT FOR CREATING A NOTE:** 'ACTION:CREATE_NOTE|CONTENT:{the user's complete note content}'

            *   **For Reminders:**
                *   If the user says "set a reminder" and does not provide the content and time, you MUST ask for the missing details. For example: "What should I remind you about, and when?"
                *   Once you have the content and time, you will respond in a specific format.
                *   **FORMAT FOR CREATING A REMINDER:** 'ACTION:CREATE_REMINDER|CONTENT:{the reminder content}|TIME:{the reminder time}'

            **Examples:**

            **Example 1 (Good Interaction - Note):**
            User: "Hey Aura, can you add a note for me?"
            Aura: "Of course! What would you like the note to say?"
            User: "My new password for the wifi is 'SuperSecret123!'"
            Aura: "ACTION:CREATE_NOTE|CONTENT:My new password for the wifi is 'SuperSecret123!'"

            **Example 2 (Good Interaction - Reminder):**
            User: "Remind me to call the doctor"
            Aura: "Certainly. When would you like to be reminded?"
            User: "Tomorrow at 2pm"
            Aura: "ACTION:CREATE_REMINDER|CONTENT:Call the doctor|TIME:Tomorrow at 2pm"

            **Example 3 (Bad Interaction):**
            User: "Add a note"
            Aura: "ACTION:CREATE_NOTE|CONTENT:bla bla bla"  <-- DO NOT DO THIS.

            Your responses should be either a question to get more details, or the final formatted action string. Do not engage in casual conversation beyond what is necessary to fulfill the user's request.`
          },
          { role: 'user', content: message }
        ],
        model: 'meta/Llama-4-Scout-17B-16E-Instruct',
        temperature: 0.8
      })
    });

    const body = await resp.json().catch(() => null);

    if (!resp.ok) {
      return res.status(502).json({ error: body || 'Upstream Error' });
    }

    const reply = body?.choices?.[0]?.message?.content ?? '';
    return res.json({ reply });
    
  } catch (err) {
    console.error('Chat error:', err);
    return res.status(500).json({ error: 'Internal Server Error' });
  }
});

if (process.env.NODE_ENV !== 'production') {
  const PORT = process.env.PORT || 3000;
  app.listen(PORT, () => console.log(`Local server on http://localhost:${PORT}`));
}

export default app;
