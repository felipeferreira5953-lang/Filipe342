// /api/shopee-direct.js V14 UNIVERSAL - Shopee + ML + Amazon + TikTok + Shein
// Mantém compatibilidade com /api/shopee-direct?url= mas agora serve TODAS as plataformas
import crypto from 'crypto';

const FLY_ROBO_URL = 'https://criador-achadinhos-brasil.fly.dev';
const APP_ID = '18325950432';
const SECRET = 'O25HE4WDN6GGDCII4DUFFCZ7RDEHHGM6';

function detectPlatform(url){
  const u = (url||'').toLowerCase();
  if(u.includes('shopee')) return 'shopee';
  if(u.includes('mercadolivre') || u.includes('mercadolibre')) return 'ml';
  if(u.includes('amazon.')) return 'amazon';
  if(u.includes('tiktok')) return 'tiktok';
  if(u.includes('shein')) return 'shein';
  return 'outros';
}

function extractShopeeIds(url) {
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
  return null;
}

function extractMLId(url){
  // https://www.mercadolivre.com.br/xxx/p/MLB12345678 ou /ML... 
  let m = url.match(/(MLB\d+|MLA\d+|MLM\d+)/i);
  if(m) return m[1].toUpperCase();
  m = url.match(/\/p\/(MLB\d+)/i);
  if(m) return m[1].toUpperCase();
  return null;
}

function extractAmazonASIN(url){
  let m = url.match(/\/dp\/([A-Z0-9]{10})/i);
  if(m) return m[1].toUpperCase();
  m = url.match(/\/gp\/product\/([A-Z0-9]{10})/i);
  if(m) return m[1].toUpperCase();
  m = url.match(/\/product\/([A-Z0-9]{10})/i);
  if(m) return m[1].toUpperCase();
  return null;
}

function parsePriceReal(v){
  if (v === null || v === undefined || v === '') return '';
  let s = String(v).trim().replace(/[R$\s]/gi,'').trim();
  if(!s) return '';
  if (s.includes(',') && s.includes('.')) s = s.replace(/\./g,'').replace(',','.');
  else if (s.includes(',')) s = s.replace(',','.');
  if (s.includes('.')) {
    const f = parseFloat(s);
    if (isNaN(f) || f<=0) return '';
    return f.toFixed(2);
  }
  const f = parseFloat(s);
  if (isNaN(f) || f<=0) return '';
  if (f < 100) return f.toFixed(2);
  return (f/100).toFixed(2);
}

function detectarCategoria(nome){
  const n=(nome||'').toLowerCase();
  if(/vestido|saia|bolsa|salto|sandália|lingerie|sutiã|cropped|blusa fem|shein/.test(n)){
    if(n.includes('bolsa')) return 'Bolsas';
    return 'Moda Feminina';
  }
  if(/camiseta|bermuda|tênis|tenis|boné|bone|camisa|moletom|masculin|utensílio|cozinha|panela|kit/.test(n)) return 'Casa e Cozinha';
  if(/celular|fone|eletrônico|smartphone|caixa de som/.test(n)) return 'Eletrônicos';
  if(/maquiagem|beleza|perfume|skincare/.test(n)) return 'Beleza';
  return 'Geral';
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const shortUrl = (req.query.url || req.query.link || req.body?.url || '').trim();
  if (!shortUrl) return res.status(400).json({ ok: false, error: 'URL vazia' });

  const platform = detectPlatform(shortUrl);
  let expanded = shortUrl;
  let flyData = null;

  // 1) Sempre tenta Fly primeiro - serve pra todas
  try {
    const r = await fetch(`${FLY_ROBO_URL}/expand?url=${encodeURIComponent(shortUrl)}`, { 
      headers: { 'User-Agent': 'Mozilla/5.0' },
      signal: AbortSignal.timeout(10000) 
    });
    flyData = await r.json();
    expanded = flyData?.expanded || flyData?.final_url || expanded;
  } catch(e) {}

  let product = null;

  // 2) Shopee - API Oficial
  if(platform === 'shopee'){
    let ids = extractShopeeIds(expanded);
    if (!ids && flyData) {
      if (flyData.shop_id && flyData.item_id) ids = { shopId: String(flyData.shop_id), itemId: String(flyData.item_id) };
      if (flyData.shopId && flyData.itemId) ids = { shopId: String(flyData.shopId), itemId: String(flyData.itemId) };
    }
    if (!ids && flyData?.expanded) ids = extractShopeeIds(flyData.expanded);
    
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
            price: parsePriceReal(node.priceMin), 
            priceOld: parsePriceReal(node.priceMax), 
            metodo: 'API Shopee Oficial' 
          };
        }
      } catch(e) {}
    }
  }

  // 3) Mercado Livre - API Pública GRÁTIS (sem chave)
  if(platform === 'ml' && !product){
    const mlId = extractMLId(expanded);
    if(mlId){
      try{
        const r = await fetch(`https://api.mercadolibre.com/items/${mlId}`, { signal: AbortSignal.timeout(8000) });
        const j = await r.json();
        if(j?.title){
          product = {
            name: j.title,
            image: j.pictures?.[0]?.url || j.thumbnail || '',
            price: parsePriceReal(j.price),
            priceOld: j.original_price ? parsePriceReal(j.original_price) : (j.price ? (parseFloat(j.price)*1.3).toFixed(2) : ''),
            metodo: 'API ML Grátis'
          };
        }
      }catch(e){}
    }
  }

  // 4) Fallback Fly para TODAS (Amazon, TikTok, Shein, ML sem ID, Shopee sem API)
  if (!product && flyData) {
    const pAtual = parsePriceReal(flyData.preco_atual || flyData.price || '');
    const pAntes = parsePriceReal(flyData.preco_antes || flyData.priceOld || '');
    product = { 
      name: flyData.ogTitle || flyData.title || `Produto ${platform.toUpperCase()}`, 
      image: flyData.ogImage || flyData.image_original || flyData.image || '', 
      price: pAtual, 
      priceOld: pAntes || (pAtual ? (parseFloat(pAtual)*1.4).toFixed(2) : ''),
      metodo: `Fly ${platform.toUpperCase()} OG`
    };
  }

  // 5) Último fallback
  if (!product) {
    product = { name: `Produto ${platform.toUpperCase()}`, image: '', price: '', priceOld: '', metodo: 'Fallback' };
  }

  if (product.price && !product.priceOld) {
    const f = parseFloat(product.price);
    if (!isNaN(f)) product.priceOld = (f * 1.4).toFixed(2);
  }

  const categoria = detectarCategoria(product.name);

  return res.status(200).json({
    ok: true,
    platform,
    original: shortUrl,
    expanded,
    affiliateLink: shortUrl,
    product,
    nome: product.name,
    imagem: product.image,
    preco: product.price,
    precoAntigo: product.priceOld,
    loja: platform === 'shopee' ? 'Shopee' : platform === 'ml' ? 'Mercado Livre' : platform === 'amazon' ? 'Amazon' : platform === 'tiktok' ? 'TikTok Shop' : platform === 'shein' ? 'Shein' : 'Loja',
    categoria,
    metodo: product.metodo,
    temCredencialOficial: platform === 'shopee',
    debug: { version: 'V14 UNIVERSAL', platform, expanded, flyData: flyData ? { ogTitle: flyData.ogTitle?.substring(0,60), preco_atual: flyData.preco_atual } : null }
  });
}
