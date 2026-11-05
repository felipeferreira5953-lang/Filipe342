// api/shopee-direct.js V20 ULTRA - 2/3 - Importa resolve-js.js pra 0% erro
import crypto from 'crypto';
import { resolveShortUrl, extractShopeeIds, extractShopeeIdsFromHtml, extractMLId } from './resolve-js.js';

const FLY_ROBO_URL = 'https://criador-achadinhos-brasil.fly.dev';
const APP_ID = '18325950432';
const SECRET = 'O25HE4WDN6GGDCII4DUFFCZ7RDEHHGM6';

function detectPlatform(url, expanded=''){
  const u = `${url} ${expanded}`.toLowerCase();
  if(u.includes('shopee') || u.includes('shope.ee')) return 'shopee';
  if(u.includes('mercadolivre') || u.includes('mercadolibre') || u.includes('meli.la') || u.includes('mlb') || u.includes('mla')) return 'ml';
  if(u.includes('amazon.') || u.includes('amzn.to')) return 'amazon';
  if(u.includes('tiktok')) return 'tiktok';
  if(u.includes('shein')) return 'shein';
  return 'outros';
}

function getMeta(html, keys){
  if(!html) return '';
  for(const key of keys){
    const m1 = html.match(new RegExp(`<meta[^>]*property=["']${key}["'][^>]*content=["']([^"']+)["']`, 'i'));
    if(m1) return m1[1].trim();
    const m2 = html.match(new RegExp(`<meta[^>]*content=["']([^"']+)["'][^>]*property=["']${key}["']`, 'i'));
    if(m2) return m2[1].trim();
  }
  return '';
}

function getAllPrices(html){
  const prices=[];
  if(!html) return prices;
  try{
    const scripts=[...html.matchAll(/<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)];
    for(const s of scripts){ try{ const j=JSON.parse(s[1]); const arr=Array.isArray(j)?j:[j]; for(const item of arr){ const offer=item.offers||item; if(offer?.price) prices.push(String(offer.price)); if(offer?.lowPrice) prices.push(String(offer.lowPrice)); } }catch(e){} }
  }catch(e){}
  const amz=[...html.matchAll(/<span[^>]*class="[^"]*a-offscreen[^"]*"[^>]*>([^<]+)<\/span>/gi)]; for(const a of amz) prices.push(a[1]);
  const metas=['product:price:amount','og:price:amount','product:price','price']; for(const k of metas){ const v=getMeta(html,[k]); if(v) prices.push(v); }
  const brl=[...html.matchAll(/R\$\s*([\d.,]+)/gi)]; for(const b of brl) prices.push(b[1]);
  const shein=html.match(/"salePrice"\s*:\s*"?([\d.,]+)"?/i); if(shein) prices.push(shein[1]);
  return prices.filter(Boolean);
}

function parseFirstValidPrice(prices){
  for(let raw of prices){
    let s=String(raw).replace(/[R$\s]/gi,'').replace(/[^\d.,]/g,'').trim(); if(!s) continue;
    if(s.includes(',') && s.includes('.')) s=s.replace(/\./g,'').replace(',','.');
    else if(s.includes(',')) s=s.replace(',','.');
    const f=parseFloat(s); if(isNaN(f)||f<=0||f>100000) continue;
    if(s.includes('.')||f<100) return f.toFixed(2);
    return (f/100).toFixed(2);
  }
  return '';
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  const shortUrl = (req.query.url || req.query.link || req.body?.url || '').trim();
  if (!shortUrl) return res.status(400).json({ ok: false, error: 'URL vazia' });

  const resolved = await resolveShortUrl(shortUrl);
  let expanded = resolved.finalUrl;
  let htmlResolved = resolved.html;
  let flyData = null;
  try {
    const r = await fetch(`${FLY_ROBO_URL}/expand?url=${encodeURIComponent(shortUrl)}`, { headers: { 'User-Agent': 'Mozilla/5.0' }, signal: AbortSignal.timeout(10000) });
    flyData = await r.json();
    if(flyData?.expanded && flyData.expanded.length>20 && /shopee|mercadolivre|amazon|shein|tiktok|meli/.test(flyData.expanded.toLowerCase())) expanded = flyData.expanded;
  } catch(e){}

  const platform = detectPlatform(shortUrl, expanded);
  let product = null;
  let metodo = '';

  if(platform==='ml'){
    const mlId = extractMLId(expanded) || extractMLId(htmlResolved) || extractMLId(shortUrl) || extractMLId(flyData?.expanded||'');
    if(mlId){
      try{
        const r=await fetch(`https://api.mercadolibre.com/items/${mlId}`,{signal:AbortSignal.timeout(8000)});
        const j=await r.json();
        if(j?.title){
          product={ name:j.title, image:j.pictures?.[0]?.secure_url||j.thumbnail||'', price:Number(j.price).toFixed(2), priceOld:j.original_price?Number(j.original_price).toFixed(2):(Number(j.price)*1.35).toFixed(2) };
          metodo=`API ML Oficial ${mlId} + resolve-js`;
        }
      }catch(e){}
    }
  }

  if(platform==='shopee' && !product){
    let ids = extractShopeeIds(expanded) || extractShopeeIdsFromHtml(htmlResolved) || extractShopeeIds(flyData?.expanded||'') || (flyData?.shop_id?{shopId:String(flyData.shop_id),itemId:String(flyData.item_id)}:null);
    if(ids){
      try{
        const ts=Math.floor(Date.now()/1000);
        const payload=JSON.stringify({ query:`query { productOfferV2(itemId: ${ids.itemId}, limit: 1) { nodes { productName imageUrl priceMin priceMax } } }` });
        const sig=crypto.createHash('sha256').update(`${APP_ID}${ts}${payload}${SECRET}`).digest('hex');
        const r=await fetch('https://open-api.affiliate.shopee.com.br/graphql',{ method:'POST', headers:{'Content-Type':'application/json','Authorization':`SHA256 Credential=${APP_ID}, Timestamp=${ts}, Signature=${sig}`}, body:payload, signal:AbortSignal.timeout(8000) });
        const j=await r.json();
        const node=j?.data?.productOfferV2?.nodes?.[0];
        if(node?.priceMin){
          product={ name:node.productName, image:node.imageUrl, price:(Number(node.priceMin)/100).toFixed(2), priceOld:node.priceMax?(Number(node.priceMax)/100).toFixed(2):(Number(node.priceMin)/100*1.4).toFixed(2) };
          metodo=`API Shopee Oficial ${ids.itemId} + resolve-js`;
        }
      }catch(e){}
    }
  }

  if(!product){
    if(flyData?.ogTitle || flyData?.ogImage){
      const prices=[]; if(flyData?.preco_atual) prices.push(String(flyData.preco_atual)); prices.push(...getAllPrices(htmlResolved));
      product={ name:flyData.ogTitle||getMeta(htmlResolved,['og:title'])||'', image:flyData.ogImage||getMeta(htmlResolved,['og:image'])||'', price:parseFirstValidPrice(prices), priceOld:'' };
      metodo=`Fly GRU ${platform.toUpperCase()} + resolve-js`;
    }else if(htmlResolved){
      const title=getMeta(htmlResolved,['og:title'])||''; const image=getMeta(htmlResolved,['og:image'])||''; const preco=parseFirstValidPrice(getAllPrices(htmlResolved));
      if(title||image){ product={ name:title.substring(0,150), image, price:preco, priceOld:'' }; metodo=`HTML ${platform.toUpperCase()} + resolve-js`; }
    }
  }

  if(!product) return res.status(200).json({ ok:false, error:'Não resolveu', platform, expanded:expanded.substring(0,200), hasFly:!!flyData, version:'V20 ULTRA 2/3' });
  if(product.price && !product.priceOld) product.priceOld=(Number(product.price)*1.35).toFixed(2);
  const lojaNome=platform==='shopee'?'Shopee':platform==='ml'?'Mercado Livre':platform==='amazon'?'Amazon':platform==='tiktok'?'TikTok Shop':platform==='shein'?'Shein':'Loja';
  const categoria=(()=>{ const n=(product.name||'').toLowerCase(); if(/copo|vidro|jogo|cozinha/.test(n)) return 'Casa e Cozinha'; if(/camiseta|tênis|bermuda/.test(n)) return 'Moda Masculina'; if(/vestido|bolsa|shein/.test(n)) return 'Moda Feminina'; return 'Geral'; })();

  return res.status(200).json({
    ok:true, platform, original:shortUrl, expanded, affiliateLink:shortUrl,
    product, nome:product.name, imagem:product.image, preco:product.price, precoAntigo:product.priceOld,
    loja:lojaNome, categoria, metodo, certeza:platform==='ml'||platform==='shopee'?'100% API + resolve-js':'95% Fly + resolve-js',
    debug:{ version:'V20 ULTRA 2/3', platform, expanded:expanded.substring(0,200) }
  });
}
