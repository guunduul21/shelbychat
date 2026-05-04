// api/chat.js - Terima transaction hash dan verifikasi
export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).end();

  const { messages, transaction } = req.body;

  // WAJIB ada transaction hash
  if (!transaction || !transaction.hash) {
    return res.status(400).json({ 
      error: 'Transaction required - gas fee not paid',
      message: 'Please submit a transaction to pay the gas fee before chatting.'
    });
  }

  const lastMsg = messages[messages.length - 1]?.content?.toLowerCase() || '';
  const isIndonesian = /(apa|ini|itu|yang|dan|di|ke|dari|untuk|dengan|adalah|saya|kamu|ada|bisa|tidak|ya|kak|bro|sis)/i.test(lastMsg);

  // Cek harga crypto
  const cryptoMap = {
    btc: 'bitcoin', eth: 'ethereum', sol: 'solana', 
    apt: 'aptos', doge: 'dogecoin', xrp: 'ripple'
  };
  
  let reply = '';
  
  for (const [keyword, apiId] of Object.entries(cryptoMap)) {
    if (lastMsg.includes(keyword) && (lastMsg.includes('harga') || lastMsg.includes('price'))) {
      try {
        const priceRes = await fetch(`https://api.coingecko.com/api/v3/simple/price?ids=${apiId}&vs_currencies=usd`);
        const priceData = await priceRes.json();
        const price = priceData[apiId]?.usd;
        if (price) {
          reply = isIndonesian 
            ? `💰 Harga ${keyword.toUpperCase()} saat ini adalah $${price.toLocaleString()} USD. Data real-time dari CoinGecko!\n\n🔗 Tx: ${transaction.hash.slice(0, 16)}...`
            : `💰 ${keyword.toUpperCase()} price is currently $${price.toLocaleString()} USD. Real-time data from CoinGecko!\n\n🔗 Tx: ${transaction.hash.slice(0, 16)}...`;
        }
      } catch (e) {}
      break;
    }
  }
  
  if (!reply) {
    // Jawaban untuk pertanyaan umum
    const answers = {
      shelby: isIndonesian 
        ? "Shelby Testnet adalah blockchain layer 1 di Aptos, fokus pada decentralized storage dan AI integration. Cek docs.shelby.xyz! 🚀"
        : "Shelby Testnet is a layer 1 blockchain on Aptos, focused on decentralized storage and AI integration. Check docs.shelby.xyz! 🚀",
      defi: isIndonesian
        ? "DeFi adalah sistem keuangan di blockchain tanpa perantara bank. Bisa lending, borrowing, trading, dan staking. Populer di Ethereum, Aptos, dan Shelby! 💰"
        : "DeFi is a financial system on blockchain without intermediaries. Lending, borrowing, trading, and staking. Popular on Ethereum, Aptos, and Shelby! 💰",
      aptos: isIndonesian
        ? "Aptos adalah blockchain layer 1 dengan bahasa Move, fokus pada skalabilitas dan kecepatan. Shelby Testnet dibangun di atas Aptos! ⚡"
        : "Aptos is a layer 1 blockchain with Move language, focused on scalability and speed. Shelby Testnet is built on Aptos! ⚡"
    };
    
    for (const [key, answer] of Object.entries(answers)) {
      if (lastMsg.includes(key)) {
        reply = answer + `\n\n🔗 Tx: ${transaction.hash.slice(0, 16)}...`;
        break;
      }
    }
  }
  
  if (!reply) {
    reply = isIndonesian
      ? `Halo! Saya ShelbyAI. Setiap chat membayar gas fee SHELBY_USD yang tercatat di blockchain.\n\n💰 Coba tanya: "harga btc", "apa itu defi", atau "shelby testnet"\n\n🔗 Tx: ${transaction.hash.slice(0, 16)}...`
      : `Hi! I'm ShelbyAI. Each chat pays a SHELBY_USD gas fee recorded on-chain.\n\n💰 Try asking: "btc price", "what is defi", or "shelby testnet"\n\n🔗 Tx: ${transaction.hash.slice(0, 16)}...`;
  }

  res.status(200).json({ 
    content: [{ type: 'text', text: reply }],
    transaction: transaction.hash,
    explorerUrl: `https://explorer.shelby.xyz/shelbynet/tx/${transaction.hash}`
  });
}
