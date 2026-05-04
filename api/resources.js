// /api/resources.js
// Proxies GET /v1/accounts/:address/resources to Shelbynet node (server-side, no CORS)
export default async function handler(req, res) {
  if (req.method === 'OPTIONS') { res.status(200).end(); return; }

  const { address, limit = '9999' } = req.query;
  if (!address) return res.status(400).json({ error: 'address required' });

  try {
    const url = `https://api.shelbynet.shelby.xyz/v1/accounts/${encodeURIComponent(address)}/resources?limit=${limit}`;
    const r = await fetch(url);

    const text = await r.text();
    let data;
    try { data = JSON.parse(text); } catch { data = { raw: text }; }

    // If node returns an error object, return empty array so frontend gracefully handles it
    if (!r.ok || !Array.isArray(data)) {
      return res.status(200).json([]);
    }

    res.status(200).json(data);
  } catch (e) {
    res.status(200).json([]);
  }
}
