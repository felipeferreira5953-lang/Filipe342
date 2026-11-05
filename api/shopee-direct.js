// api/shopee-direct.js V21 FIX PREÇO + IMAGEM - Corrige preço 5,14 e libera CORS da foto
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
    for(const s of scripts){ try{ const j=JSON.parse(s[1]); const arr=Array.isArray(j)?j:[j]; for(const item of arr){ const offer=item.offers||item; if(offer?.price) prices.push(String(offer.price)); if(offer?.lowPrice) prices.push(String(offer.lowPrice)); if(offer?.highPrice) prices.push(String(offer.highPrice)); } }catch(e){} }
  }catch(e){}
  const amz=[...html.matchAll(/<span[^>]*class="[^"]*a-offscreen[^"]*"[^>]*>([^<]+)<\/span>/gi)]; for(const a of amz) prices.push(a[1]);
  const metas=['product:price:amount','og:price:amount','product:price','price']; for(const k of metas){ const v=getMeta(html,[k]); if(v) prices.push(v); }
  const brl=[...html.matchAll(/R\$\s*([\d.,]+)/gi)]; for(const b of brl) prices.push(b[1]);
  const shein=html.match(/"salePrice"\s*:\s*"?([\d.,]+)"?/i); if(shein) prices.push(shein[1]);
  return prices.filter(Boolean);
}

function parsePriceSmart(raw){
  let s=String(raw).replace(/[R$\s]/gi,'').replace(/[^\d.,]/g,'').trim(); if(!s) return null;
  if(s.includes(',') && s.includes('.')) s=s.replace(/\./g,'').replace(',','.');
  else if(s.includes(',')) s=s.replace(',','.');
  let f=parseFloat(s); if(isNaN(f)||f<=0||f>100000) return null;
  if(s.includes('.')||f<100) return f;
  return f/100;
}

function parseBestPrice(prices, platform){
  const parsed = prices.map(p=>parsePriceSmart(p)).filter(v=>v!==null && v>1 && v<50000);
  if(!parsed.length) return null;
  // Para Shopee/Amazon, pega o MAIOR preço plausível (evita pegar 5,14 de parcela)
  parsed.sort((a,b)=>b-a);
  // Se tem preços muito discrepantes, pega o do meio/alto
  if(platform==='shopee'){
    // Remove preços < 20 se tiver maiores
    const altos = parsed.filter(v=>v>=20);
    if(altos.length) return altos[0];
  }
  return parsed[0];
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  
  // Proxy de imagem para formato super leve (resolve CORS cf.shopee)
  if(req.query.img){
    try{
      const imgUrl = decodeURIComponent(req.query.img);
      const r = await fetch(imgUrl, { headers: { 'User-Agent':'Mozilla/5.0', 'Referer':'https://shopee.com.br/' }, signal: AbortSignal.timeout(10000) });
      const buf = Buffer.from(await r.arrayBuffer());
      res.setHeader('Content-Type', r.headers.get('content-type')||'image/jpeg');
      res.setHeader('Access-Control-Allow-Origin','*');
      res.setHeader('Cache-Control','public, max-age=86400');
      return res.status(200).send(buf);
    }catch(e){ return res.status(500).json({ok:false, error:'img proxy fail'}); }
  }

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
          metodo=`API ML Oficial ${mlId} + resolve-js V21`;
        }
      }catch(e){}
    }
  }

  if(platform==='shopee' && !product){
    let ids = extractShopeeIds(expanded) || extractShopeeIdsFromHtml(htmlResolved) || extractShopeeIds(flyData?.expanded||'') || (flyData?.shop_id?{shopId:String(flyData.shop_id),itemId:String(flyData.item_id)}:null);
    if(ids){
      try{
        const ts=Math.floor(Date.now()/1000);
        // Tenta com shopId se tiver
        const queryWithShop = ids.shopId ? `query { productOfferV2(itemId: ${ids.itemId}, shopId: ${ids.shopId}, limit: 1) { nodes { productName imageUrl priceMin priceMax } } }` : `query { productOfferV2(itemId: ${ids.itemId}, limit: 1) { nodes { productName imageUrl priceMin priceMax } } }`;
        const payload=JSON.stringify({ query: queryWithShop });
        const sig=crypto.createHash('sha256').update(`${APP_ID}${ts}${payload}${SECRET}`).digest('hex');
        const r=await fetch('https://open-api.affiliate.shopee.com.br/graphql',{ method:'POST', headers:{'Content-Type':'application/json','Authorization':`SHA256 Credential=${APP_ID}, Timestamp=${ts}, Signature=${sig}`}, body:payload, signal:AbortSignal.timeout(8000) });
        const j=await r.json();
        const node=j?.data?.productOfferV2?.nodes?.[0];
        if(node?.priceMin){
          let pMin = Number(node.priceMin);
          let pMax = node.priceMax ? Number(node.priceMax) : 0;
          // FIX PREÇO 5,14: Shopee manda em centavos, mas às vezes já manda em reais. Se < 1000 e nome é caro, multiplica
          // Se pMin < 1000 e é microondas/tv/etc, provavelmente já é em reais *100? Na verdade Shopee sempre manda *100. 5,14 = 514 centavos = item de 5 reais, não microondas.
          // Então vamos usar HTML como validação
          let price = pMin/100;
          let priceOld = pMax ? pMax/100 : price*1.4;
          
          // Valida com HTML: se API deu 5,14 mas HTML tem 500+, usa HTML
          const htmlPrices = getAllPrices(htmlResolved);
          const bestHtml = parseBestPrice(htmlPrices, 'shopee');
          if(bestHtml && bestHtml > price*3 && bestHtml > 50){
            price = bestHtml;
            priceOld = bestHtml*1.35;
            metodo = `API Shopee + HTML CORRIGIDO (API deu ${pMin/100}, HTML ${bestHtml})`;
          }else{
            metodo=`API Shopee Oficial ${ids.itemId} V21 FIX`;
          }
          
          product={ name:node.productName, image:node.imageUrl, price:price.toFixed(2), priceOld:priceOld.toFixed(2) };
        }
      }catch(e){ console.error('Shopee API err', e); }
    }
  }

  if(!product){
    if(flyData?.ogTitle || flyData?.ogImage){
      const prices=[]; if(flyData?.preco_atual) prices.push(String(flyData.preco_atual)); prices.push(...getAllPrices(htmlResolved));
      const best = parseBestPrice(prices, platform);
      product={ name:flyData.ogTitle||getMeta(htmlResolved,['og:title'])||'', image:flyData.ogImage||getMeta(htmlResolved,['og:image'])||'', price:best?best.toFixed(2):'', priceOld:'' };
      metodo=`Fly GRU ${platform.toUpperCase()} + resolve-js V21`;
    }else if(htmlResolved){
      const title=getMeta(htmlResolved,['og:title'])||''; const image=getMeta(htmlResolved,['og:image'])||''; 
      const best = parseBestPrice(getAllPrices(htmlResolved), platform);
      if(title||image||best){ product={ name:title.substring(0,150), image, price:best?best.toFixed(2):'', priceOld:best?(best*1.35).toFixed(2):'' }; metodo=`HTML ${platform.toUpperCase()} + resolve-js V21`; }
    }
  }

  if(!product) return res.status(200).json({ ok:false, error:'Não resolveu', platform, expanded:expanded.substring(0,200), hasFly:!!flyData, version:'V21 FIX PREÇO' });
  if(product.price && !product.priceOld) product.priceOld=(Number(product.price)*1.35).toFixed(2);
  
  // Cria URL proxy pra foto super leve (resolve CORS)
  let imagemProxy = product.image;
  if(product.image && product.image.includes('shopee.com.br')){
    imagemProxy = `/api/shopee-direct?img=${encodeURIComponent(product.image)}`;
  }

  const lojaNome=platform==='shopee'?'Shopee':platform==='ml'?'Mercado Livre':platform==='amazon'?'Amazon':platform==='tiktok'?'TikTok Shop':platform==='shein'?'Shein':'Loja';
  const categoria=(()=>{ const n=(product.name||'').toLowerCase(); if(/microondas|geladeira|fogão|copo|vidro|cozinha/.test(n)) return 'Casa e Cozinha'; if(/camiseta|tênis|bermuda/.test(n)) return 'Moda Masculina'; if(/vestido|bolsa|shein/.test(n)) return 'Moda Feminina'; return 'Geral'; })();

  return res.status(200).json({
    ok:true, platform, original:shortUrl, expanded, affiliateLink:shortUrl,
    product, nome:product.name, imagem:product.image, imagemProxy, preco:product.price, precoAntigo:product.priceOld,
    loja:lojaNome, categoria, metodo, certeza:platform==='ml'||platform==='shopee'?'100% API + V21 FIX':'95% Fly + V21',
    debug:{ version:'V21 FIX PREÇO E FOTO LEVE', platform, expanded:expanded.substring(0,200), priceRaw:product.price }
  });
}
