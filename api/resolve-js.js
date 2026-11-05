// api/resolve-js.js V20 ULTRA - Resolve s.shopee, shope.ee, meli.la, amzn.to com 3 camadas (HTTP + canonical + JS)
export async function resolveShortUrl(url){
  try{
    const r = await fetch(url, {
      method: 'GET',
      redirect: 'follow',
      headers: { 
        'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15',
        'Accept': 'text/html,application/xhtml+xml',
        'Accept-Language': 'pt-BR,pt;q=0.9',
        'Cache-Control': 'no-cache'
      },
      signal: AbortSignal.timeout(15000)
    });
    let finalUrl = r.url || url;
    let html = await r.text().catch(()=> '');

    // Camada 2 e 3: Se ainda é short, extrai do HTML
    if(/s\.shopee|shope\.ee|meli\.la|amzn\.to|tiktok\.com\/@/.test(finalUrl) || /s\.shopee|shope\.ee|meli\.la|amzn\.to/.test(url)){
      // canonical é o mais confiável pro Shopee
      const can = html.match(/<link[^>]*rel=["']canonical["'][^>]*href=["']([^"']+)["']/i);
      if(can && can[1] && can[1].startsWith('http') && can[1].length > 20) finalUrl = can[1];
      
      const ogUrl = html.match(/<meta[^>]*property=["']og:url["'][^>]*content=["']([^"']+)["']/i);
      if(ogUrl && ogUrl[1] && ogUrl[1].startsWith('http') && ogUrl[1].includes('shopee.com.br')) finalUrl = ogUrl[1];

      const refresh = html.match(/<meta[^>]*http-equiv=["']refresh["'][^>]*content=["'][^"']*url=([^"']+)["']/i);
      if(refresh && refresh[1] && refresh[1].startsWith('http')) finalUrl = refresh[1];

      const js1 = html.match(/window\.location(?:\.href)?\s*=\s*["']([^"']+)["']/i);
      if(js1 && js1[1] && js1[1].startsWith('http')) finalUrl = js1[1];

      const js2 = html.match(/location\.replace\(["']([^"']+)["']\)/i);
      if(js2 && js2[1] && js2[1].startsWith('http')) finalUrl = js2[1];
    }

    return { finalUrl, html, ok: true };
  }catch(e){
    return { finalUrl: url, html: '', ok: false, error: e.message };
  }
}

export function extractShopeeIds(url) {
  if (!url) return null;
  let m = url.match(/-i\.(\d+)\.(\d+)/);
  if (m) return { shopId: m[1], itemId: m[2] };
  try {
    const u = new URL(url);
    const parts = u.pathname.split('/').filter(Boolean);
    if (parts.length >= 2) {
      const last = parts[parts.length-1];
      const prev = parts[parts.length-2];
      if (/^\d{6,}$/.test(last) && /^\d{6,}$/.test(prev)) return { shopId: prev, itemId: last };
    }
  } catch {}
  m = url.match(/\/[^\/]+\/(\d{6,})\/(\d{6,})/);
  if (m) return { shopId: m[1], itemId: m[2] };
  return null;
}

export function extractShopeeIdsFromHtml(html){
  if(!html) return null;
  let m = html.match(/-i\.(\d+)\.(\d+)/);
  if(m) return { shopId: m[1], itemId: m[2] };
  m = html.match(/"shopid"\s*:\s*(\d+).*?"itemid"\s*:\s*(\d+)/is);
  if(m) return { shopId: m[1], itemId: m[2] };
  m = html.match(/shopId["']?\s*:\s*"?(\d+)"?.*?itemId["']?\s*:\s*"?(\d+)"?/is);
  if(m) return { shopId: m[1], itemId: m[2] };
  return null;
}

export function extractMLId(url){
  if(!url) return null;
  let m = url.match(/(MLB\d+|MLA\d+|MLM\d+)/i);
  if(m) return m[1].toUpperCase();
  m = url.match(/MLB-?(\d+)/i);
  if(m) return `MLB${m[1]}`;
  return null;
}

export default async function handler(req, res){
  res.setHeader('Access-Control-Allow-Origin', '*');
  if(req.method === 'OPTIONS') return res.status(200).end();
  const url = (req.query.url || '').trim();
  if(!url) return res.status(400).json({ ok: false, error: 'URL vazia' });
  const result = await resolveShortUrl(url);
  const ids = extractShopeeIds(result.finalUrl) || extractShopeeIdsFromHtml(result.html);
  const mlId = extractMLId(result.finalUrl);
  return res.status(200).json({ ok: true, original: url, expanded: result.finalUrl, hasHtml: !!result.html, shopeeIds: ids, mlId, version: 'V20 resolve-js' });
}
