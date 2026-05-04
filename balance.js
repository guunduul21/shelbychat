const BASE = 'https://api.shelbynet.shelby.xyz/v1';
const SHELBYUSD_META = '0x1b18363a9f1fe5e6ebf247daba5cc1c18052bb232efdc4c50f556053922d98e1';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const { address } = req.query;
  if (!address) return res.status(400).json({ error: 'address required' });

  try {
    const response = await fetch(`${BASE}/view`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        function: '0x1::primary_fungible_store::balance',
        type_arguments: ['0x1::fungible_asset::Metadata'],
        arguments: [address, SHELBYUSD_META],
      }),
    });

    const data = await response.json();
    const raw = Number(data?.[0] ?? 0);
    const balance = raw / 100; // 2 decimals!

    return res.status(200).json({
      value: String(balance),
      source: 'success'
    });
  } catch (err) {
    return res.status(200).json({ value: '0', error: err.message });
  }
}