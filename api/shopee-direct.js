// /api/shopee-direct.js V9 - OFICIAL SHOPEE API + CLIENT RESOLVE
// Usa AppID 18347061257 e Secret do env (SHOPEE_APP_ID / SHOPEE_SECRET)
// Se não tiver env, faz fallback PDP via celular
import crypto from 'crypto';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const { url } = req.query;
  if (!url) return res.status(400).json({ error: 'URL obrigatória' });

  const APP_ID = process.env.SHOPEE_APP_ID || process.env.SHOPEE_AFFILIATE_APP_ID || '18347061257';
  const SECRET = process.env.SHOPEE_SECRET || process.env.SHOPEE_AFFILIATE_SECRET || process.env.SHOPEE_AFFILIATE_APP_SECRET || '';

  let debug = [];

  function sha256(str) {
    return crypto.createHash('sha256').update(str).digest('hex');
  }

  async function callShopeeOfficialAPI(itemId, shopId) {
    if (!APP_ID || !SECRET) {
      debug.push('Sem APP_ID/SECRET no env - pulando API oficial');
      return null;
    }
    try {
      // Query para buscar produto por itemId/shopId
      const query = `
      {
        productOfferV2(itemId: ${parseInt(itemId)}, shopId: ${parseInt(shopId)}, limit: 1) {
          nodes {
            itemId
            productName
            imageUrl
            priceMin
            priceMax
            productLink
            offerLink
            commissionRate
            shopId
            shopName
            ratingStar
            sales
          }
        }
      }
      `;
      const payloadObj = { query };
      const payload = JSON.stringify(payloadObj);
      const timestamp = Math.floor(Date.now() / 1000).toString();
      const signature = sha256(`${APP_ID}${timestamp}${payload}${SECRET}`);
      const auth = `SHA256 Credential=${APP_ID}, Timestamp=${timestamp}, Signature=${signature}`;

      debug.push(`Chamando API oficial AppID=${APP_ID} itemId=${itemId} shopId=${shopId}`);

      const r = await fetch('https://open-api.affiliate.shopee.com.br/graphql', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': auth
        },
        body: payload,
        signal: AbortSignal.timeout(10000)
      });
      const text = await r.text();
      debug.push(`API oficial status ${r.status} body ${text.substring(0,300)}`);
      let json;
      try { json = JSON.parse(text); } catch (e) { debug.push('API oficial não JSON'); return null; }
      if (json.errors) {
        debug.push(`API erro: ${JSON.stringify(json.errors).substring(0,300)}`);
      }
      const node = json?.data?.productOfferV2?.nodes?.[0];
      if (node) {
        debug.push(`API oficial achou: ${node.productName?.substring(0,40)}`);
        return node;
      }
      return null;
    } catch (e) {
      debug.push(`API oficial exception: ${e.message}`);
      return null;
    }
  }

  async function resolverShortLink(shortUrl) {
    const proxies = [
      { name: 'Direta', url: shortUrl, direct: true },
      { name: 'corsproxy.io', url: `https://corsproxy.io/?${encodeURIComponent(shortUrl)}` },
      { name: 'allorigins raw', url: `https://api.allorigins.win/raw?url=${encodeURIComponent(shortUrl)}` },
      { name: 'codetabs', url: `https://api.codetabs.com/v1/proxy?quest=${encodeURIComponent(shortUrl)}` },
      { name: 'thingproxy', url: `https://thingproxy.freeboard.io/fetch/${shortUrl}` },
      { name: 'proxy.cors.sh', url: `https://proxy.cors.sh/${shortUrl}` },
    ];
    for (const p of proxies) {
      try {
        debug.push(`Tentando ${p.name}...`);
        let text = '';
        let finalUrl = shortUrl;
        if (p.direct) {
          const rr = await fetch(p.url, {
            redirect: 'follow',
            headers: { 'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_6 like Mac OS X) AppleWebKit/605.1.15', 'Referer': 'https://shopee.com.br/' },
            signal: AbortSignal.timeout(8000)
          });
          text = await rr.text();
          finalUrl = rr.url;
        } else {
          const rr = await fetch(p.url, { headers: { 'User-Agent': 'Mozilla/5.0' }, signal: AbortSignal.timeout(10000) });
          text = await rr.text();
          finalUrl = rr.url || shortUrl;
        }
        if (finalUrl.includes('-i.') && finalUrl.includes('shopee.com.br') && !finalUrl.includes('s.shopee')) {
          return { url: finalUrl, html: text };
        }
        const m = text.match(/https:\/\/shopee\.com\.br\/[^"'\s]+-i\.(\d+)\.(\d+)/i);
        if (m) return { url: m[0], html: text };
      } catch (e) { debug.push(`${p.name} erro ${e.message}`); }
    }
    return { url: shortUrl, html: '' };
  }

  try {
    let finalUrl = url;
    let html = '';

    if (url.includes('s.shopee.com.br') || url.includes('shope.ee')) {
      const resolved = await resolverShortLink(url);
      finalUrl = resolved.url;
      html = resolved.html;
      debug.push(`Final resolvido servidor: ${finalUrl.substring(0,80)}`);
    }

    if (finalUrl.includes('s.shopee.com.br') || finalUrl.includes('shope.ee')) {
      return res.status(200).json({
        nome: '',
        imagem: '',
        preco: '',
        loja: 'Shopee',
        categoria: 'Geral',
        urlFinal: finalUrl,
        precisaResolverNoCliente: true,
        error: 'Link ainda curto - resolvendo no celular',
        debug,
        temCredencialOficial: !!(APP_ID && SECRET)
      });
    }

    let nome = '';
    let imagem = '';
    let preco = '';
    let precoAntigo = '';
    let linkOferta = finalUrl;

    const m = finalUrl.match(/-i\.(\d+)\.(\d+)/);
    if (m) {
      const shopId = m[1];
      const itemId = m[2];
      debug.push(`IDs shopId=${shopId} itemId=${itemId}`);

      // 1. Tenta API OFICIAL primeiro (funciona na Vercel, não é bloqueada)
      const oficial = await callShopeeOfficialAPI(itemId, shopId);
      if (oficial) {
        nome = oficial.productName || '';
        imagem = oficial.imageUrl || '';
        preco = oficial.priceMin ? (parseFloat(oficial.priceMin) / 1).toFixed(2) : '';
        // priceMin da API oficial já vem em reais? Na doc vem como string "10.50" ou número? Trata ambos
        if (oficial.priceMin && oficial.priceMin.toString().includes('.')) {
          preco = parseFloat(oficial.priceMin).toFixed(2);
        } else if (oficial.priceMin) {
          // Se vier em centavos * 100000 como PDP, converte
          const v = parseFloat(oficial.priceMin);
          if (v > 1000) preco = (v / 100000).toFixed(2);
          else preco = v.toFixed(2);
        }
        linkOferta = oficial.offerLink || oficial.productLink || finalUrl;
        debug.push(`Usando API OFICIAL: ${nome.substring(0,40)} img=${imagem.substring(0,40)}`);
      }

      // 2. Se API oficial não achou, tenta PDP direto (pode falhar na Vercel mas funciona no cliente)
      if (!nome || !imagem) {
        try {
          const pdpUrl = `https://shopee.com.br/api/v4/pdp/get_pc?shopid=${shopId}&itemid=${itemId}`;
          const proxiesPdp = [
            pdpUrl,
            `https://corsproxy.io/?${encodeURIComponent(pdpUrl)}`,
            `https://api.allorigins.win/raw?url=${encodeURIComponent(pdpUrl)}`
          ];
          for (const pUrl of proxiesPdp) {
            try {
              const rr = await fetch(pUrl, { headers: { 'Accept': 'application/json', 'Referer': 'https://shopee.com.br/' }, signal: AbortSignal.timeout(8000) });
              const txt = await rr.text();
              let j;
              try { j = JSON.parse(txt); } catch { continue; }
              const data = j?.data;
              if (data?.name) {
                if (!nome) nome = data.name;
                if (!imagem && data.images?.[0]) {
                  let imgId = data.images[0];
                  imagem = imgId.startsWith('http') ? imgId : `https://down-br.img.susercontent.com/file/${imgId}_800x800`;
                }
                if (!preco && data.price_min) {
                  preco = (data.price_min / 100000).toFixed(2);
                  if (data.price_before_discount > data.price_min) precoAntigo = (data.price_before_discount / 100000).toFixed(2);
                }
                debug.push(`PDP ok via ${pUrl.substring(0,25)}`);
                break;
              }
            } catch {}
          }
        } catch {}
      }
    }

    if (!nome && !imagem) {
      return res.status(200).json({
        nome: '',
        imagem: '',
        preco: '',
        loja: 'Shopee',
        categoria: 'Geral',
        urlFinal: finalUrl,
        precisaResolverNoCliente: true,
        error: 'Não achou produto - tente resolver no cliente',
        debug,
        temCredencialOficial: !!(APP_ID && SECRET)
      });
    }

    return res.status(200).json({
      nome: nome || 'Produto Shopee',
      imagem: imagem || '',
      preco: preco || '',
      precoAntigo: precoAntigo || '',
      loja: 'Shopee',
      categoria: 'Geral',
      urlFinal: linkOferta || finalUrl,
      metodo: (APP_ID && SECRET && debug.some(d=>d.includes('API OFICIAL'))) ? 'API Oficial Shopee' : 'PDP + Multi-Proxy',
      debug,
      temCredencialOficial: !!(APP_ID && SECRET)
    });

  } catch (err) {
    return res.status(500).json({ error: err.message, debug, urlFinal: url, temCredencialOficial: !!(APP_ID && SECRET) });
  }
}
