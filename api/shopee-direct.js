// /api/shopee-direct.js - V12 - PRECO CORRETO + RAPIDO
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
      if (/^\d{6,}$/.test(last) && /^\d{6,}$/.test(prev)) return { shopId: prev, itemId: last };
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

function parsePriceCorrect(v) {
  if (v === null || v === undefined || v === '') return '';
  const s = String(v).trim();
  if (!s) return '';
  // Se tem ponto, já está em reais (ex: "14.00")
  if (s.includes('.')) {
    const f = parseFloat(s);
    if (isNaN(f)) return '';
    return f.toFixed(2);
  }
  // Sem ponto: pode ser centavos (1400 => 14.00) ou já reais (14 => 14.00)
  const f = parseFloat(s);
  if (isNaN(f)) return '';
  if (f >= 100) return (f / 100).toFixed(2); // 1400 -> 14.00
  return f.toFixed(2); // 14 -> 14.00
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

  try {
    const r = await fetch(`${FLY_ROBO_URL}/expand?url=${encodeURIComponent(shortUrl)}`, { 
      headers: { 'User-Agent': 'Mozilla/5.0' },
      signal: AbortSignal.timeout(10000) 
    });
    flyData = await r.json();
    expanded = flyData?.expanded || flyData?.final_url || expanded;
  } catch(e) {}

  let ids = extractIds(expanded);
  if (!ids && flyData) {
    if (flyData.shop_id && flyData.item_id) ids = { shopId: String(flyData.shop_id), itemId: String(flyData.item_id) };
    else if (flyData.shopId && flyData.itemId) ids = { shopId: String(flyData.shopId), itemId: String(flyData.itemId) };
  }

  let product = null;
  
  if (ids) {
    try {
      const ts = Math.floor(Date.now()/1000);
      const payload = JSON.stringify({ query: `query { productOfferV2(itemId: ${ids.itemId}, limit: 1) { nodes { productName imageUrl priceMin priceMax commissionRate } } }` });
      const sig = crypto.createHash('sha256').update(`${APP_ID}${ts}${payload}${SECRET}`).digest('hex');
      const r = await fetch('https://open-api.affiliate.shopee.com.br/graphql', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `SHA256 Credential=${APP_ID}, Timestamp=${ts}, Signature=${sig}` },
        body: payload,
        signal: AbortSignal.timeout(8000)
      });
      const j = await r.json();
      const node = j?.data?.productOfferV2?.nodes?.[0];
      if (node) {
        product = { 
          name: node.productName, 
          image: node.imageUrl, 
          price: parsePriceCorrect(node.priceMin), 
          priceOld: parsePriceCorrect(node.priceMax), 
          metodo: 'API Oficial' 
        };
      }
    } catch(e) {}
  }

  if (!product && flyData) {
    product = { 
      name: flyData.ogTitle || flyData.title || `Produto ${ids?.itemId||'Shopee'}`, 
      image: flyData.ogImage || flyData.image_original || flyData.image || '', 
      price: parsePriceCorrect(flyData.preco_atual), 
      priceOld: parsePriceCorrect(flyData.preco_antes),
      metodo: 'Fly GRU' 
    };
  }

  if (!product) {
    product = { name: `Produto ${ids?.itemId||'Shopee'}`, image: '', price: '', priceOld: '', metodo: 'Fallback' };
  }

  const categoria = detectarCategoria(product.name);

  return res.status(200).json({
    ok: true,
    original: shortUrl,
    expanded,
    affiliateLink: shortUrl,
    product,
    nome: product.name,
    imagem: product.image,
    preco: product.price,
    precoAntigo: product.priceOld,
    loja: 'Shopee',
    categoria,
    metodo: product.metodo,
    temCredencialOficial: true,
    debug: { version: 'V12 PRECO CORRETO', expanded, ids }
  });
}
