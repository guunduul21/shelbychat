// api/dtelecom-token.js
const { AccessToken } = require('@dtelecom/server-sdk-js');

module.exports = async (req, res) => {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', 'https://shelbychat.vercel.app');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  
  const API_KEY = process.env.DTELECOM_API_KEY;
  const API_SECRET = process.env.DTELECOM_API_SECRET;
  
  if (!API_KEY || !API_SECRET) {
    return res.status(503).json({ error: 'dTelecom API key/secret belum dikonfigurasi di Vercel' });
  }
  
  try {
    const { room = 'shelby-room', identity: inputIdentity } = req.body;
    const identity = inputIdentity || `shelby_${Math.random().toString(36).slice(2, 10)}`;
    
    const at = new AccessToken(API_KEY, API_SECRET, { identity, ttl: '1h' });
    at.addGrant({ roomJoin: true, room, canPublish: true, canSubscribe: true, canPublishData: true });
    
    const token = at.toJwt();
    console.log(`[dTelecom] Token generated for ${identity} in ${room}`);
    
    res.status(200).json({ token, identity, room });
  } catch (err) {
    console.error('[dTelecom] Error:', err);
    res.status(500).json({ error: err.message });
  }
};