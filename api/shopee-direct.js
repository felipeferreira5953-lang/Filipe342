// /api/shopee-direct.js - FINAL - URL FIXADA https://criador-achadinhos-brasil.fly.dev
import crypto from 'crypto';

const FLY_ROBO_URL = process.env.FLY_ROBO_URL || 'https://criador-achadinhos-brasil.fly.dev';

function extractIds(url) {
  let m = url.match(/-i\.(\d+)\.(\d+)/);
  if (m) return { shopId: m[1], itemId: m[2] };
  m = url.match(/\/product\/(\d+)\/(\d+)/);
  if (m) return { shopId: m[1], itemId: m[2] };
  return null;
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const shortUrl = req.query.url || req.query.link || req.body?.url || '';
  const APP_ID = process.env.SHOPEE_APP_ID;
  const SECRET = process.env.SHOPEE_SECRET;

  if (!shortUrl) return res.status(400).json({ ok: false, error: 'URL vazia' });

  let expanded = shortUrl;
  let flyData = null;

  try {
    const url = `${FLY_ROBO_URL}/expand?url=${encodeURIComponent(shortUrl)}`;
    console.log('[FINAL] Chamando:', url);
    const r = await fetch(url, { signal: AbortSignal.timeout(15000) });
    flyData = await r.json();
    if (flyData?.expanded) expanded = flyData.expanded;
    if (flyData?.final_url) expanded = flyData.final_url;
  } catch(e) {
    console.log('Erro Fly:', e.message);
    try {
      const proxy = `https://api.allorigins.win/raw?url=${encodeURIComponent(shortUrl)}`;
      const r = await fetch(proxy, { signal: AbortSignal.timeout(10000) });
      const text = await r.text();
      const m = text.match(/https:\/\/shopee\.com\.br\/[^"'\s<>]+\-i\.\d+\.\d+[^"'\s<>]*/);
      if (m) expanded = m[0];
    } catch {}
  }

  const ids = extractIds(expanded) || (flyData?.shopId ? { shopId: flyData.shopId, itemId: flyData.itemId } : null) || (flyData?.item_id ? { shopId: flyData.shop_id, itemId: flyData.item_id } : null);
  let product = null;

  if (ids && APP_ID && SECRET) {
    try {
      const timestamp = Math.floor(Date.now() / 1000);
      const payload = JSON.stringify({
        query: `query { productOfferV2(input: { shopId: ${ids.shopId}, itemId: ${ids.itemId} }) { nodes { productName imageUrl priceMin priceMax offerLink commissionRate } } }`
      });
      const signature = crypto.createHash('sha256').update(`${APP_ID}${timestamp}${payload}${SECRET}`).digest('hex');
      const r = await fetch('https://open-api.affiliate.shopee.com.br/graphql', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `SHA256 Credential=${APP_ID}, Timestamp=${timestamp}, Signature=${signature}`
        },
        body: payload,
        signal: AbortSignal.timeout(10000)
      });
      const data = await r.json();
      const node = data.data?.productOfferV2?.nodes?.[0];
      if (node) {
        product = {
          name: node.productName,
          image: node.imageUrl || flyData?.ogImage || flyData?.image_original,
          price: (parseInt(node.priceMin) / 100).toFixed(2),
          priceMax: (parseInt(node.priceMax) / 100).toFixed(2),
          offerLink: node.offerLink,
          commission: node.commissionRate
        };
      }
    } catch(e) {}
  }

  if (!product && flyData?.ogTitle) {
    product = {
      name: flyData.ogTitle || flyData.title,
      image: flyData.ogImage || flyData.image_original || flyData.image,
      price: flyData.preco_atual ? String(flyData.preco_atual) : null
    };
  }

  return res.status(200).json({
    ok: true,
    original: shortUrl,
    expanded: expanded,
    affiliateLink: shortUrl,
    isShort: expanded.includes('s.shopee.com.br'),
    shouldSaveEvenIfShort: true,
    product: product,
    message: product ? `✅ Puxado via https://criador-achadinhos-brasil.fly.dev + API oficial` : 'Expandido via Fly',
    debug: {
      expanded,
      flyUrl: FLY_ROBO_URL,
      ids,
      hasApiData: !!product
    }
  });
}
