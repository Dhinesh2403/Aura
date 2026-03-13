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
          { role: 'system', content: 'Your name is Aura' },
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

// 2. IMPORTANT: Vercel handles the port; app.listen is only for local dev
if (process.env.NODE_ENV !== 'production') {
  const PORT = process.env.PORT || 3000;
  app.listen(PORT, () => console.log(`Local server on http://localhost:${PORT}`));
}

// 3. EXPORT the app for Vercel
export default app;
