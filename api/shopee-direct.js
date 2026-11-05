// /api/shopee-direct.js - V11 DEFINITIVO - COMPATIVEL COM ia-inject.js V9 e V11 - SEMPRE OK
import crypto from 'crypto';

const FLY_ROBO_URL = 'https://criador-achadinhos-brasil.fly.dev';
const APP_ID = '18325950432';
const SECRET = 'O25HE4WDN6GGDCII4DUFFCZ7RDEHHGM6';

function extractIds(url) {
  if (!url) return null;
  try {
    const u = new URL(url);
    const parts = u.pathname.split('/').filter(Boolean);
    if (parts.length >= 2) {
      const last = parts[parts.length-1];
      const prev = parts[parts.length-2];
      if (/^\d{6,}$/.test(last) && /^\d{6,}$/.test(prev)) {
        return { shopId: prev, itemId: last };
      }
    }
  } catch {}
  let m = url.match(/-i\.(\d+)\.(\d+)/);
  if (m) return { shopId: m[1], itemId: m[2] };
  m = url.match(/\/[^\/]+\/(\d{6,})\/(\d{6,})/);
  if (m) return { shopId: m[1], itemId: m[2] };
  m = url.match(/(\d{6,})\/(\d{6,})/);
  if (m) return { shopId: m[1], itemId: m[2] };
  return null;
}

function detectarCategoria(nome){
  const n=(nome||'').toLowerCase();
  if(/vestido|saia|bolsa|salto|sandália|lingerie|sutiã|cropped|blusa fem/.test(n)) return 'Moda Feminina';
  if(/camiseta|bermuda|tênis|tenis|boné|bone|camisa|moletom|masculin/.test(n)) return 'Moda Masculina';
  return 'Geral';
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
  
  if (ids) {
    // Tenta shopId+itemId
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
      apiTried.push({ type: 'shopId+itemId', hasNodes: !!j?.data?.productOfferV2?.nodes?.length });
      const node = j?.data?.productOfferV2?.nodes?.[0];
      if (node) product = { name: node.productName, image: node.imageUrl, price: (parseInt(node.priceMin)/100).toString(), priceOld: (parseInt(node.priceMax)/100).toString(), offerLink: node.offerLink, metodo: 'API Oficial shopId+itemId' };
    } catch(e) { apiTried.push({ type: 'shopId+itemId', error: e.message }); }

    // Tenta só itemId (formato que seu Fly usa)
    if (!product) {
      try {
        const ts = Math.floor(Date.now()/1000);
        const payload = JSON.stringify({ query: `query { productOfferV2(itemId: ${ids.itemId}, limit: 1) { nodes { productName imageUrl priceMin priceMax commissionRate } } }` });
        const sig = crypto.createHash('sha256').update(`${APP_ID}${ts}${payload}${SECRET}`).digest('hex');
        const r = await fetch('https://open-api.affiliate.shopee.com.br/graphql', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': `SHA256 Credential=${APP_ID}, Timestamp=${ts}, Signature=${sig}` },
          body: payload,
          signal: AbortSignal.timeout(12000)
        });
        const j = await r.json();
        apiTried.push({ type: 'itemId only', hasNodes: !!j?.data?.productOfferV2?.nodes?.length });
        const node = j?.data?.productOfferV2?.nodes?.[0];
        if (node) product = { name: node.productName, image: node.imageUrl, price: (parseInt(node.priceMin)/100).toString(), priceOld: (parseInt(node.priceMax)/100).toString(), metodo: 'API Oficial itemId' };
      } catch(e) { apiTried.push({ type: 'itemId only', error: e.message }); }
    }
  }

  // Fallback Fly (seu robô que você provou que funciona)
  if (!product && flyData) {
    const name = flyData.ogTitle || flyData.title;
    const image = flyData.ogImage || flyData.image_original || flyData.image || flyData.image_proxy;
    const price = flyData.preco_atual;
    const priceOld = flyData.preco_antes;
    if (name || image) {
      product = { name: name || `Produto ${ids?.itemId||'Shopee'}`, image: image || '', price: price ? String(price) : '', priceOld: priceOld ? String(priceOld) : '', metodo: 'Fly GRU - IP brasileiro' };
    }
  }

  if (!product) {
    product = { name: `Produto Shopee ${ids?.itemId||''}`, image: flyData?.image_original||'', price: '', priceOld: '', metodo: 'Fallback' };
  }

  const categoria = detectarCategoria(product.name);

  // RETORNO COMPATIVEL COM TUDO: formato novo + formato antigo que ia-inject.js espera
  return res.status(200).json({
    ok: true,
    // Formato novo
    original: shortUrl,
    expanded,
    affiliateLink: shortUrl,
    product,
    // Formato antigo que ia-inject.js V9 esperava
    nome: product.name,
    imagem: product.image,
    preco: product.price,
    precoAntigo: product.priceOld,
    loja: 'Shopee',
    categoria,
    metodo: product.metodo || 'V11 DEFINITIVO',
    temCredencialOficial: true,
    precisaResolverNoCliente: false,
    debug: {
      version: 'V11 DEFINITIVO - COMPATIVEL',
      expanded,
      ids,
      flyData: flyData ? { title: flyData.title?.slice(0,80), hasImage: !!flyData.image_original, shop_id: flyData.shop_id, item_id: flyData.item_id, preco: flyData.preco_atual } : null,
      flyError,
      apiTried,
      productSource: product.metodo
    }
  });
}
