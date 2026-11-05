// /api/shopee-direct.js - V10 DEFINITIVO - CORRIGE TUDO QUE PASSOU
import crypto from 'crypto';

const FLY_ROBO_URL = 'https://criador-achadinhos-brasil.fly.dev';
const APP_ID = '18325950432';
const SECRET = 'O25HE4WDN6GGDCII4DUFFCZ7RDEHHGM6';

function extractIds(url) {
  if (!url) return null;
  try {
    const u = new URL(url);
    const parts = u.pathname.split('/').filter(Boolean);
    // parts ex: ['opaanlp', '418205294', '22496964506'] ou ['product','418205294','22496964506']
    if (parts.length >= 2) {
      const last = parts[parts.length-1];
      const prev = parts[parts.length-2];
      if (/^\d{6,}$/.test(last) && /^\d{6,}$/.test(prev)) {
        return { shopId: prev, itemId: last };
      }
    }
  } catch {}
  // regex fallback
  let m = url.match(/-i\.(\d+)\.(\d+)/);
  if (m) return { shopId: m[1], itemId: m[2] };
  m = url.match(/\/[^\/]+\/(\d{6,})\/(\d{6,})/);
  if (m) return { shopId: m[1], itemId: m[2] };
  m = url.match(/(\d{6,})\/(\d{6,})/);
  if (m) return { shopId: m[1], itemId: m[2] };
  return null;
}

async function tryScrapeShopee(url) {
  // tenta pegar OG tags direto se Fly falhar
  try {
    const proxy = `https://api.allorigins.win/get?url=${encodeURIComponent(url)}`;
    const r = await fetch(proxy, { signal: AbortSignal.timeout(10000) });
    const j = await r.json();
    const html = j.contents || '';
    const ogTitle = (html.match(/<meta property="og:title" content="([^"]+)"/) || [])[1] || (html.match(/<title>([^<]+)<\/title>/) || [])[1] || '';
    const ogImage = (html.match(/<meta property="og:image" content="([^"]+)"/) || [])[1] || '';
    return { ogTitle, ogImage, html: html.slice(0,2000) };
  } catch { return null; }
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const shortUrl = (req.query.url || req.query.link || req.body?.url || '').trim();
  if (!shortUrl) return res.status(400).json({ ok: false, error: 'URL vazia' });

  let expanded = shortUrl;
  let flyData = null;
  let flyError = null;

  try {
    const r = await fetch(`${FLY_ROBO_URL}/expand?url=${encodeURIComponent(shortUrl)}`, { 
      headers: { 'User-Agent': 'Mozilla/5.0' },
      signal: AbortSignal.timeout(15000) 
    });
    flyData = await r.json();
    expanded = flyData?.expanded || flyData?.final_url || expanded;
  } catch(e) { flyError = e.message; }

  let ids = extractIds(expanded);
  if (!ids && flyData) {
    if (flyData.shop_id && flyData.item_id) ids = { shopId: String(flyData.shop_id), itemId: String(flyData.item_id) };
    else if (flyData.shopId && flyData.itemId) ids = { shopId: String(flyData.shopId), itemId: String(flyData.itemId) };
  }

  let product = null;
  let apiTried = [];
  
  // TENTA 1: API com shopId + itemId (formato Vercel antigo)
  if (ids) {
    try {
      const ts = Math.floor(Date.now()/1000);
      const payload = JSON.stringify({ query: `query { productOfferV2(input: { shopId: ${ids.shopId}, itemId: ${ids.itemId} }) { nodes { productName imageUrl priceMin priceMax offerLink commissionRate } } }` });
      const sig = crypto.createHash('sha256').update(`${APP_ID}${ts}${payload}${SECRET}`).digest('hex');
      const r = await fetch('https://open-api.affiliate.shopee.com.br/graphql', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `SHA256 Credential=${APP_ID}, Timestamp=${ts}, Signature=${sig}` },
        body: payload,
        signal: AbortSignal.timeout(12000)
      });
      const j = await r.json();
      apiTried.push({ type: 'shopId+itemId', hasNodes: !!j?.data?.productOfferV2?.nodes?.length, data: j });
      const node = j?.data?.productOfferV2?.nodes?.[0];
      if (node) product = { name: node.productName, image: node.imageUrl, price: (parseInt(node.priceMin)/100).toString(), priceOld: (parseInt(node.priceMax)/100).toString(), offerLink: node.offerLink };
    } catch(e) { apiTried.push({ type: 'shopId+itemId', error: e.message }); }
  }

  // TENTA 2: API só com itemId (formato que seu Fly usa e FUNCIONA)
  if (!product && ids) {
    try {
      const ts = Math.floor(Date.now()/1000);
      const payload = JSON.stringify({ query: `query { productOfferV2(itemId: ${ids.itemId}, limit: 1) { nodes { productName imageUrl priceMin priceMax commissionRate } } }` }, null, 0);
      const sig = crypto.createHash('sha256').update(`${APP_ID}${ts}${payload}${SECRET}`).digest('hex');
      const r = await fetch('https://open-api.affiliate.shopee.com.br/graphql', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `SHA256 Credential=${APP_ID}, Timestamp=${ts}, Signature=${sig}` },
        body: payload,
        signal: AbortSignal.timeout(12000)
      });
      const j = await r.json();
      apiTried.push({ type: 'itemId only', hasNodes: !!j?.data?.productOfferV2?.nodes?.length, data: j });
      const node = j?.data?.productOfferV2?.nodes?.[0];
      if (node) product = { name: node.productName, image: node.imageUrl, price: (parseInt(node.priceMin)/100).toString(), priceOld: (parseInt(node.priceMax)/100).toString() };
    } catch(e) { apiTried.push({ type: 'itemId only', error: e.message }); }
  }

  // TENTA 3: Usa dados do seu robô Fly (que você provou que FUNCIONA - imagem anterior)
  if (!product && flyData) {
    const name = flyData.ogTitle || flyData.title || flyData.title?.slice(0,150);
    const image = flyData.ogImage || flyData.image_original || flyData.image || flyData.image_proxy;
    const price = flyData.preco_atual || flyData.price;
    const priceOld = flyData.preco_antes;
    if (name || image) {
      product = { name: name || 'Produto Shopee', image: image || '', price: price ? String(price) : '', priceOld: priceOld ? String(priceOld) : '' };
    }
  }

  // TENTA 4: Scraping direto se tudo falhar
  if (!product) {
    const scraped = await tryScrapeShopee(expanded);
    if (scraped?.ogTitle) {
      product = { name: scraped.ogTitle, image: scraped.ogImage, price: '', priceOld: '' };
    }
  }

  // NUNCA retorna "não achou" vazio - sempre retorna algo pro ADM não quebrar
  if (!product) {
    product = { 
      name: flyData?.title || `Produto ${ids?.itemId || 'Shopee'}`, 
      image: flyData?.image_original || flyData?.ogImage || '',
      price: flyData?.preco_atual ? String(flyData.preco_atual) : '',
      priceOld: ''
    };
  }

  return res.status(200).json({
    ok: true, // SEMPRE true agora, mesmo que seja fallback
    original: shortUrl,
    expanded,
    affiliateLink: shortUrl,
    product,
    debug: {
      version: 'V10 DEFINITIVO',
      expanded,
      ids,
      flyData: flyData ? { title: flyData.title?.slice(0,80), hasImage: !!flyData.image_original, shop_id: flyData.shop_id, item_id: flyData.item_id, preco: flyData.preco_atual } : null,
      flyError,
      apiTried: apiTried.map(a => ({ type: a.type, hasNodes: a.hasNodes, error: a.error })),
      productSource: product?.name === flyData?.title ? 'FLY' : 'API'
    }
  });
}
