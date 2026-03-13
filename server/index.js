import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';

dotenv.config();

// Optional: allow contacting endpoints with self-signed certificates. This
// should only be used for local testing. Enable by setting AURA_ALLOW_INSECURE=true
const AURA_ALLOW_INSECURE = (process.env.AURA_ALLOW_INSECURE ?? 'false') === 'true';
if (AURA_ALLOW_INSECURE) {
  console.warn('AURA_ALLOW_INSECURE=true — disabling TLS certificate verification (INSECURE, for local testing only)');
  // Node respects NODE_TLS_REJECT_UNAUTHORIZED; setting to '0' disables cert validation.
  process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
}

const PORT = process.env.PORT ? Number(process.env.PORT) : 3000;
const AURA_ENDPOINT = 'https://models.github.ai/inference';
const AURA_API_KEY = window.__ENV?.AURA_API_KEY ? process.env.AURA_API_KEY : null;
const AURA_USE_MOCK = false;


const app = express();
app.use(cors());
app.use(express.json());

app.get('/health', (_req, res) => {
  res.json({ ok: true, mock: AURA_USE_MOCK, configured: Boolean(AURA_ENDPOINT && AURA_API_KEY) });
});

app.post('/api/chat', async (req, res) => {
  try {
    const { message } = req.body ?? {};
    if (!message || typeof message !== 'string') return res.status(400).send('missing message');

    if (AURA_USE_MOCK || !AURA_API_KEY || !AURA_ENDPOINT) {
      return res.json({ reply: `Mock Aura reply: I received your message: "${message}"` });
    }

    const url = AURA_ENDPOINT.replace(/\/$/, '') + '/chat/completions';
    const payload = {
      messages: [
        { role: 'system', content: 'Your name is Aura' },
        { role: 'user', content: message }
      ],
      model: 'meta/Llama-4-Scout-17B-16E-Instruct',
      temperature: 0.8
    };

    const resp = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${AURA_API_KEY}`
      },
      body: JSON.stringify(payload),
      // timeout can be implemented externally if needed
    });

    const text = await resp.text();
    let body = null;
    try {
      body = JSON.parse(text);
    } catch {
      // not JSON
      body = null;
    }

    if (!resp.ok) {
      console.error('upstream error', resp.status, text);
      return res.status(502).json({ error: body ?? text ?? `upstream ${resp.status}` });
    }

    const reply = (body?.choices?.[0]?.message?.content) ?? '';
    return res.json({ reply });
  } catch (err) {
    console.error('chat error', err);
    // If a TLS self-signed error occurs, provide a helpful message to the user.
    if (err && err.cause && err.cause.code === 'SELF_SIGNED_CERT_IN_CHAIN') {
      return res.status(502).json({ error: 'TLS certificate validation failed when contacting Aura endpoint. For local testing you can set AURA_ALLOW_INSECURE=true to disable certificate verification (not recommended for production).' });
    }
    return res.status(500).json({ error: String(err) });
  }
});

app.listen(PORT, () => {
  console.log(`Aura proxy listening on http://localhost:${PORT} (mock=${AURA_USE_MOCK})`);
});
