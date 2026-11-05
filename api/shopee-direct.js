// /api/shopee-direct.js - V8 FIX - pega formato /loja/ID/ID e resolve FALTA ENV
import crypto from 'crypto';

const FLY_ROBO_URL = process.env.FLY_ROBO_URL || 'https://criador-achadinhos-brasil.fly.dev';

// CREDENCIAIS DO SEU APP.PY - fallback se ENV faltar na Vercel
const FALLBACK_APP_ID = "18325950432";
const FALLBACK_SECRET = "O25HE4WDN6GGDCII4DUFFCZ7RDEHHGM6";

function extractIds(url) {
  // Formato 1: -i.SHOPID.ITEMID
  let m = url.match(/-i\.(\d+)\.(\d+)/);
  if (m) return { shopId: m[1], itemId: m[2] };
  // Formato 2: /product/SHOPID/ITEMID
  m = url.match(/\/product\/(\d+)\/(\d+)/);
  if (m) return { shopId: m[1], itemId: m[2] };
  // Formato 3: /QUALQUER-NOME/SHOPID/ITEMID - ex: /opaanlp/375201738/22299409946
  m = url.match(/\/[^\/]+\/(\d+)\/(\d+)(?:\?|$)/);
  if (m) {
    // Shopee as vezes inverte, mas 99% é shopId= primeiro, itemId= segundo
    // Seu exemplo: 375201738 / 22299409946
    return { shopId: m[1], itemId: m[2] };
  }
  // Formato 4: dois numeros longos no final da URL
  m = url.match(/(\d{6,})\/(\d{6,})/);
  if (m) return { shopId: m[1], itemId: m[2] };
  return null;
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const shortUrl = req.query.url || req.query.link || req.body?.url || '';
  const APP_ID = process.env.SHOPEE_APP_ID || process.env.SHOPEE_ID || FALLBACK_APP_ID;
  const SECRET = process.env.SHOPEE_SECRET || process.env.SHOPEE_KEY || FALLBACK_SECRET;

  if (!shortUrl) return res.status(400).json({ ok: false, error: 'URL vazia' });

  let expanded = shortUrl;
  let flyData = null;

  try {
    const url = `${FLY_ROBO_URL}/expand?url=${encodeURIComponent(shortUrl)}`;
    console.log('[V8] Chamando Fly:', url);
    const r = await fetch(url, { signal: AbortSignal.timeout(15000) });
    flyData = await r.json();
    if (flyData?.expanded) expanded = flyData.expanded;
    if (flyData?.final_url) expanded = flyData.final_url;
  } catch(e) {
    console.log('Erro Fly:', e.message);
  }

  // Tenta IDs da URL expandida, ou dos dados do Fly
  let ids = extractIds(expanded);
  if (!ids && flyData?.shopId && flyData?.itemId) ids = { shopId: flyData.shopId, itemId: flyData.itemId };
  if (!ids && flyData?.shop_id && flyData?.item_id) ids = { shopId: flyData.shop_id, itemId: flyData.item_id };
  if (!ids && flyData?.shopId) ids = { shopId: String(flyData.shopId), itemId: String(flyData.itemId) };

  console.log('[V8] IDs extraidos:', ids, 'de', expanded);

  let product = null;
  let debugApi = {};

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
      debugApi = data;
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
    } catch(e) {
      debugApi.error = e.message;
    }
  }

  if (!product && flyData?.ogTitle) {
    product = {
      name: flyData.ogTitle || flyData.title,
      image: flyData.ogImage || flyData.image_original || flyData.image,
      price: flyData.preco_atual ? String(flyData.preco_atual) : null,
      priceOld: flyData.preco_antes ? String(flyData.preco_antes) : null
    };
  }

  const credStatus = !process.env.SHOPEE_APP_ID ? `USANDO FALLBACK ${FALLBACK_APP_ID} - ENV FALTA` : 'ENV OK';

  return res.status(200).json({
    ok: !!product,
    error: product ? undefined : 'não achou',
    original: shortUrl,
    expanded: expanded,
    affiliateLink: shortUrl,
    product: product,
    debug: {
      expanded,
      ids,
      credencial: credStatus,
      hasProduct: !!product,
      flyData: flyData ? { title: flyData.title, hasImage: !!flyData.image_original, shop_id: flyData.shop_id, item_id: flyData.item_id } : null,
      apiResponse: debugApi
    }
  });
}
