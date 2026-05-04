// /api/view.js
// Proxies POST /v1/view calls to Shelbynet node (server-side, no CORS)
export default async function handler(req, res) {
  // Allow CORS preflight
  if (req.method === 'OPTIONS') { res.status(200).end(); return; }

  const body = req.method === 'POST' ? req.body : null;
  if (!body) return res.status(400).json({ error: 'POST body required' });

  try {
    const r = await fetch('https://api.shelbynet.shelby.xyz/v1/view', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });

    const text = await r.text();
    let data;
    try { data = JSON.parse(text); } catch { data = { raw: text }; }

    // Always 200 from proxy — let frontend handle errors
    res.status(200).json(data);
  } catch (e) {
    res.status(200).json({ error: e.message });
  }
}
