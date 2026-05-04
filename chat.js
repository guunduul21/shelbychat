// api/chat.js — Vercel Serverless Function (CommonJS format)
// ============================================================
// SETUP: Vercel → Project → Settings → Environment Variables
//   GROQ_API_KEY = gsk_xxxx  (get free key at console.groq.com)
//
// After adding env var → Redeploy project in Vercel dashboard
// ============================================================

module.exports = async function handler(req, res) {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method Not Allowed' });

  // Parse body
  const body = req.body ?? {};
  const messages = body.messages;

  if (!messages || !Array.isArray(messages) || messages.length === 0) {
    return res.status(400).json({ error: '"messages" array is required' });
  }

  // API key guard
  const GROQ_API_KEY = process.env.GROQ_API_KEY;
  if (!GROQ_API_KEY) {
    console.error('[ShelbyChat] ERROR: GROQ_API_KEY env var not set!');
    return res.status(500).json({ error: 'GROQ_API_KEY not configured in Vercel Environment Variables' });
  }

  // System prompt
  const systemPrompt = {
    role: 'system',
    content:
      'You are ShelbyAI, a helpful and friendly AI assistant in ShelbyChat (Web3 app on Shelby Testnet / Aptos). ' +
      'You know about crypto, DeFi, blockchain, Web3, Aptos, NFTs, and finance. ' +
      'RULES: (1) Detect user language → reply in SAME language (Indonesian in = Indonesian out). ' +
      '(2) Always answer COMPLETELY, never cut short. (3) Be relevant to what was asked.',
  };

  // Call Groq
  let groqRes;
  try {
    groqRes = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${GROQ_API_KEY}`,
      },
      body: JSON.stringify({
        model: 'llama3-8b-8192',
        temperature: 0.7,
        max_tokens: 1024,
        stream: false,
        messages: [systemPrompt, ...messages],
      }),
    });
  } catch (networkErr) {
    console.error('[ShelbyChat] Network error:', networkErr.message);
    return res.status(502).json({ error: 'Cannot reach Groq API: ' + networkErr.message });
  }

  if (!groqRes.ok) {
    let errBody = '';
    try { errBody = await groqRes.text(); } catch (_) {}
    console.error(`[ShelbyChat] Groq ${groqRes.status}:`, errBody);
    if (groqRes.status === 401) return res.status(502).json({ error: 'Invalid GROQ_API_KEY — check Vercel env vars and redeploy' });
    if (groqRes.status === 429) return res.status(502).json({ error: 'Groq rate limit — try again shortly' });
    return res.status(502).json({ error: `Groq error ${groqRes.status}: ${errBody.slice(0, 300)}` });
  }

  let groqData;
  try {
    groqData = await groqRes.json();
  } catch (e) {
    return res.status(502).json({ error: 'Invalid JSON from Groq' });
  }

  const text = groqData.choices?.[0]?.message?.content ?? '';
  if (!text) {
    console.error('[ShelbyChat] Empty Groq response:', JSON.stringify(groqData));
    return res.status(502).json({ error: 'Empty response from AI' });
  }

  return res.status(200).json({ content: [{ text }] });
};
