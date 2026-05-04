// api/upload.js - SEDERHANAKAN
export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', 'https://shelbychat.vercel.app');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  
  try {
    const { blobName, walletAddr, txHash } = req.body;
    
    console.log('📥 Received upload request for blob:', blobName);
    console.log('📥 Wallet:', walletAddr?.slice(0, 15));
    console.log('📥 TxHash:', txHash);
    
    // Langsung return success - upload akan ditangani oleh add_blob_acknowledgements
    res.status(200).json({ 
      success: true, 
      message: 'Blob registered, acknowledgement will be sent on-chain'
    });
    
  } catch (error) {
    console.error('❌ Upload error:', error.message);
    res.status(500).json({ error: error.message });
  }
}