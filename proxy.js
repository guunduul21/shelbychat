export default async function handler(req, res) {
  const { path } = req.query;
  if (!path) return res.status(400).json({ error: 'path required' });

  const BASE = 'https://api.shelbynet.shelby.xyz/v1';
  const url = `${BASE}/${path}`;

  try {
    const r = await fetch(url, {
      method: req.method === 'POST' ? 'POST' : 'GET',
      headers: { 'Content-Type': 'application/json' },
      ...(req.method === 'POST' && req.body ? { body: JSON.stringify(req.body) } : {})
    });

    const text = await r.text();

    // Try parse as JSON, fallback to raw text
    let data;
    try { data = JSON.parse(text); } catch { data = { raw: text }; }

    // Always return 200 from proxy so frontend can handle the response
    res.status(200).json(data);
  } catch (e) {
    console.error('[proxy] fetch error:', e.message, 'url:', url);
    res.status(200).json({ error: e.message, url });
  }
}
