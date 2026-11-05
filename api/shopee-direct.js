// /api/shopee-direct.js V10 - RÁPIDA + OFICIAL - não aborta
import crypto from 'crypto';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const { url } = req.query;
  if (!url) return res.status(400).json({ error: 'URL obrigatória', temCredencialOficial: false });

  const APP_ID = process.env.SHOPEE_APP_ID || process.env.SHOPEE_AFFILIATE_APP_ID || '18347061257';
  const SECRET = process.env.SHOPEE_SECRET || process.env.SHOPEE_AFFILIATE_SECRET || '';

  let debug = [];
  debug.push(`ENV: APP_ID=${APP_ID ? APP_ID.substring(0,4)+'***' : 'FALTA'} SECRET=${SECRET ? 'OK '+SECRET.length+' chars' : 'FALTA'}`);

  function sha256(str) {
    return crypto.createHash('sha256').update(str).digest('hex');
  }

  async function callShopeeOfficialAPI(itemId, shopId) {
    if (!APP_ID || !SECRET) {
      debug.push('Sem APP_ID/SECRET - pulando API oficial, vai pro fallback');
      return null;
    }
    try {
      const timestamp = Math.floor(Date.now() / 1000);
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
          }
        }
      }`;
      // Shopee Affiliate GraphQL endpoint
      const endpoint = 'https://open-api.affiliate.shopee.com.br/graphql';
      const payload = JSON.stringify({ query });
      const signature = sha256(APP_ID + timestamp + payload + SECRET);
      
      debug.push(`Chamando API Oficial ${itemId}/${shopId} ts=${timestamp}`);
      
      const r = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `SHA256 Credential=${APP_ID}, Timestamp=${timestamp}, Signature=${signature}`
        },
        body: payload,
        signal: AbortSignal.timeout(8000)
      });
      
      const text = await r.text();
      debug.push(`API Oficial status ${r.status} body ${text.substring(0,200)}`);
      
      let j;
      try { j = JSON.parse(text); } catch { return null; }
      
      const node = j?.data?.productOfferV2?.nodes?.[0];
      if (node) {
        return node;
      }
      return null;
    } catch (e) {
      debug.push(`API Oficial erro ${e.message}`);
      return null;
    }
  }

  try {
    let finalUrl = url;
    
    // Se for link curto, tenta resolver rápido (1 tentativa só, não 6!)
    if (url.includes('s.shopee.com.br') || url.includes('shope.ee')) {
      try {
        const rr = await fetch(url, {
          redirect: 'follow',
          headers: {
            'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_6 like Mac OS X) AppleWebKit/605.1.15',
            'Referer': 'https://shopee.com.br/'
          },
          signal: AbortSignal.timeout(5000)
        });
        if (rr.url && rr.url.includes('-i.')) {
          finalUrl = rr.url;
          debug.push(`Resolvido rápido servidor: ${finalUrl.substring(0,80)}`);
        } else {
          const txt = await rr.text().catch(() => '');
          const m = txt.match(/https:\/\/shopee\.com\.br\/[^"'\\s]+-i\.(\d+)\.(\d+)/i);
          if (m) {
            finalUrl = m[0];
            debug.push(`Achou link no HTML: ${finalUrl.substring(0,80)}`);
          } else {
            debug.push(`Não resolveu no servidor, vai resolver no cliente`);
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
        }
      } catch (e) {
        debug.push(`Resolve curto falhou ${e.message}, mandando pro cliente`);
        return res.status(200).json({
          nome: '',
          imagem: '',
          preco: '',
          loja: 'Shopee',
          categoria: 'Geral',
          urlFinal: url,
          precisaResolverNoCliente: true,
          error: 'Link curto - cliente resolve',
          debug,
          temCredencialOficial: !!(APP_ID && SECRET)
        });
      }
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

      const oficial = await callShopeeOfficialAPI(itemId, shopId);
      if (oficial) {
        nome = oficial.productName || '';
        imagem = oficial.imageUrl || '';
        let pMin = oficial.priceMin;
        if (pMin) {
          const v = parseFloat(pMin);
          if (!isNaN(v)) {
            if (v > 1000) preco = (v / 100000).toFixed(2);
            else preco = v.toFixed(2);
          }
        }
        linkOferta = oficial.offerLink || oficial.productLink || finalUrl;
        debug.push(`OFICIAL OK: ${nome.substring(0,30)}`);

        return res.status(200).json({
          nome,
          imagem,
          preco,
          precoAntigo: '',
          loja: 'Shopee',
          categoria: 'Geral',
          urlFinal: finalUrl,
          linkOferta,
          metodo: 'API Oficial',
          debug,
          temCredencialOficial: !!(APP_ID && SECRET)
        });
      }

      // Fallback PDP rápido (sem proxy)
      try {
        const pdpUrl = `https://shopee.com.br/api/v4/pdp/get_pc?shopid=${shopId}&itemid=${itemId}`;
        const rr = await fetch(pdpUrl, {
          headers: { 'Accept': 'application/json', 'Referer': 'https://shopee.com.br/' },
          signal: AbortSignal.timeout(5000)
        });
        const txt = await rr.text();
        let j;
        try { j = JSON.parse(txt); } catch { j = null; }
        const data = j?.data;
        if (data?.name) {
          nome = data.name;
          if (data.images?.[0]) {
            let imgId = data.images[0];
            imagem = imgId.startsWith('http') ? imgId : `https://down-br.img.susercontent.com/file/${imgId}_800x800`;
          }
          if (data.price_min) preco = (data.price_min / 100000).toFixed(2);
          if (data.price_before_discount && data.price_before_discount > data.price_min) precoAntigo = (data.price_before_discount / 100000).toFixed(2);
          debug.push(`PDP OK: ${nome.substring(0,30)}`);
          
          return res.status(200).json({
            nome,
            imagem,
            preco,
            precoAntigo,
            loja: 'Shopee',
            categoria: 'Geral',
            urlFinal: finalUrl,
            linkOferta: finalUrl,
            metodo: 'PDP Direto',
            debug,
            temCredencialOficial: !!(APP_ID && SECRET)
          });
        }
      } catch (e) {
        debug.push(`PDP erro ${e.message}`);
      }
    }

    return res.status(200).json({
      nome: '',
      imagem: '',
      preco: '',
      loja: 'Shopee',
      categoria: 'Geral',
      urlFinal: finalUrl,
      linkOferta: finalUrl,
      metodo: 'Sem IDs ou falhou - cliente tenta',
      precisaResolverNoCliente: !finalUrl.includes('-i.'),
      error: finalUrl.includes('-i.') ? 'Não achou dados, mas tem IDs' : 'Link sem IDs',
      debug,
      temCredencialOficial: !!(APP_ID && SECRET)
    });

  } catch (err) {
    return res.status(500).json({ error: err.message, debug, urlFinal: url, temCredencialOficial: !!(APP_ID && SECRET) });
  }
}
