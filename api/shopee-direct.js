// /api/shopee-direct.js - V3 COMPLETA - Puxa nome, preço real e imagem leve mantendo seu afiliado
import crypto from 'crypto';

const ENDPOINT = 'https://open-api.affiliate.shopee.com.br/graphql';

function makeSignature(appId, timestamp, payload, secret) {
  return crypto.createHash('sha256').update(`${appId}${timestamp}${payload}${secret}`).digest('hex');
}

// Extrai shopId e itemId de qualquer URL da Shopee
function extractIds(url) {
  // Formato -i.shopId.itemId
  let m = url.match(/-i\.(\d+)\.(\d+)/);
  if (m) return { shopId: m[1], itemId: m[2] };
  // Formato /product/shopId/itemId
  m = url.match(/\/product\/(\d+)\/(\d+)/);
  if (m) return { shopId: m[1], itemId: m[2] };
  // query ?shopid=&itemid=
  try {
    const u = new URL(url);
    const shop = u.searchParams.get('shopid') || u.searchParams.get('shopId');
    const item = u.searchParams.get('itemid') || u.searchParams.get('itemId');
    if (shop && item) return { shopId: shop, itemId: item };
  } catch {}
  return null;
}

async function expandShopeeShort(shortUrl) {
  // Método 1: tenta via allorigins (IP não é da Vercel)
  try {
    const proxy = `https://api.allorigins.win/get?url=${encodeURIComponent(shortUrl)}`;
    const r = await fetch(proxy, { signal: AbortSignal.timeout(8000) });
    const j = await r.json();
    if (j.contents) {
      // Procura link longo dentro do HTML
      const m1 = j.contents.match(/https:\/\/shopee\.com\.br\/[^"'\s<>]+-i\.\d+\.\d+[^"'\s<>]*/);
      if (m1) return m1[0];
      const m2 = j.contents.match(/https:\/\/shopee\.com\.br\/product\/\d+\/\d+[^"'\s<>]*/);
      if (m2) return m2[0];
      // window.location
      const m3 = j.contents.match(/location\.href\s*=\s*["'](https:\/\/shopee\.com\.br[^"']+)["']/);
      if (m3) return m3[1];
    }
  } catch(e){ console.log('allorigins fail', e.message); }

  // Método 2: fetch direto na Vercel (geralmente falha mas tenta)
  try {
    const r = await fetch(shortUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
        'Accept': 'text/html',
        'Accept-Language': 'pt-BR,pt;q=0.9'
      },
      redirect: 'follow',
      signal: AbortSignal.timeout(8000)
    });
    if (r.url && r.url.includes('shopee.com.br') && !r.url.includes('s.shopee.com.br')) {
      return r.url;
    }
    const text = await r.text();
    const m = text.match(/https:\/\/shopee\.com\.br\/[^"'\s<>]+/);
    if (m) return m[0];
  } catch(e){}

  return shortUrl; // fallback
}

async function scrapeProduct(url) {
  try {
    // Tenta via allorigins pra não ser bloqueado
    const proxy = `https://api.allorigins.win/get?url=${encodeURIComponent(url)}`;
    const r = await fetch(proxy, { signal: AbortSignal.timeout(10000) });
    const j = await r.json();
    const html = j.contents || '';

    // Extrai dados OG
    const titleMatch = html.match(/<meta[^>]*property="og:title"[^>]*content="([^"]+)"/i) || 
                       html.match(/<title>([^<]+)<\/title>/i);
    const imageMatch = html.match(/<meta[^>]*property="og:image"[^>]*content="([^"]+)"/i);
    const descMatch = html.match(/<meta[^>]*property="og:description"[^>]*content="([^"]+)"/i);

    let title = titleMatch ? titleMatch[1] : '';
    let image = imageMatch ? imageMatch[1] : '';
    let description = descMatch ? descMatch[1] : '';

    // Limpa título
    title = title.replace(/ \| Shopee Brasil.*/, '').trim();

    // Tenta pegar preço no HTML - vários padrões da Shopee
    let price = null;
    let oldPrice = null;

    const pricePatterns = [
      /"priceMin"\s*:\s*"(\d+)"/,
      /"price"\s*:\s*(\d+)/,
      /R\$\s*([\d.,]+)/,
      /"current_price":\s*(\d+)/,
      /priceMin.*?(\d{2,})/
    ];

    for (let pat of pricePatterns) {
      const m = html.match(pat);
      if (m) {
        let p = m[1].replace(/\./g, '').replace(',', '.');
        // Se for centavos (ex: 9784 = 97.84)
        if (!p.includes('.') && p.length > 2) {
          price = (parseInt(p) / 100).toFixed(2);
        } else {
          price = p;
        }
        break;
      }
    }

    return { title, image, description, price, oldPrice, htmlLength: html.length };
  } catch(e) {
    console.log('scrape fail', e.message);
    return null;
  }
}

async function getProductOfferViaApi(shopId, itemId, originUrl, appId, secret) {
  if (!appId || !secret) return null;
  try {
    const timestamp = Math.floor(Date.now() / 1000);
    // Query que funciona no Brasil - tenta productOfferV2
    const payload = JSON.stringify({
      query: `query { productOfferV2(input: { shopId: ${shopId}, itemId: ${itemId} }) { nodes { itemId shopId productName imageUrl priceMin priceMax offerLink productLink commissionRate } } }`
    });
    const signature = makeSignature(appId, timestamp, payload, secret);

    const r = await fetch(ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `SHA256 Credential=${appId}, Timestamp=${timestamp}, Signature=${signature}`
      },
      body: payload,
      signal: AbortSignal.timeout(10000)
    });
    const data = await r.json();
    if (data.data?.productOfferV2?.nodes?.[0]) {
      return data.data.productOfferV2.nodes[0];
    }
  } catch(e){ console.log('API productOfferV2 fail', e.message); }
  return null;
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const shortUrl = req.query.url || req.query.link || req.body?.url;
  if (!shortUrl) return res.status(400).json({ ok: false, error: 'URL não enviada' });

  const APP_ID = process.env.SHOPEE_APP_ID;
  const SECRET = process.env.SHOPEE_SECRET;

  console.log('[V3] Input:', shortUrl);

  let expanded = shortUrl;
  if (shortUrl.includes('s.shopee.com.br') || shortUrl.includes('shope.ee')) {
    expanded = await expandShopeeShort(shortUrl);
  }

  const ids = extractIds(expanded);
  let productData = null;
  let apiData = null;

  if (ids) {
    apiData = await getProductOfferViaApi(ids.shopId, ids.itemId, expanded, APP_ID, SECRET);
  }

  // Se não conseguiu via API, tenta scrape HTML
  if (!apiData) {
    productData = await scrapeProduct(expanded);
  }

  // Monta resposta final mantendo SEU link curto como afiliado
  const response = {
    ok: true,
    original: shortUrl,
    expanded: expanded,
    affiliateLink: shortUrl, // SEU LINK CURTO JÁ É AFILIADO E DÁ COMISSÃO
    isShort: expanded.includes('s.shopee.com.br'),
    shouldSaveEvenIfShort: true,
    product: apiData ? {
      name: apiData.productName,
      image: apiData.imageUrl,
      price: (parseInt(apiData.priceMin) / 100).toFixed(2),
      offerLink: apiData.offerLink, // link afiliado novo gerado pela API (também válido)
      commission: apiData.commissionRate,
      shopId: apiData.shopId,
      itemId: apiData.itemId
    } : productData ? {
      name: productData.title,
      image: productData.image,
      price: productData.price,
      description: productData.description,
      // imagem já vai ser comprimida pra webp 600px pelo seu sistema automático
    } : null,
    message: apiData ? 'Produto puxado via API oficial com seu afiliado' : 
             productData?.title ? 'Produto puxado via scrape + seu afiliado mantido' :
             'Link curto mantido (afiliado OK) - preencha nome/preço ou tente de novo',
    debug: {
      env: {
        APP_ID: APP_ID ? 'OK' : 'FALTA',
        SECRET: SECRET ? `OK ${SECRET.length} chars` : 'FALTA',
        Credencial: APP_ID && SECRET ? 'OK' : 'FALTA'
      },
      expanded,
      ids,
      hasApiData: !!apiData,
      hasScrapeData: !!productData?.title
    }
  };

  return res.status(200).json(response);
}
