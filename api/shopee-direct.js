// /api/shopee-direct.js - OFICIAL - resolve link curto s.shopee.com.br DIRETO DO APP usando API oficial Shopee
// Usa SHOPEE_APP_ID e SHOPEE_SECRET das Environment Variables da Vercel + fallback PDP
export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const { url } = req.query;
  if (!url) return res.status(400).json({ error: 'URL obrigatória' });

  const APP_ID = process.env.SHOPEE_APP_ID || process.env.SHOPEE_AFFILIATE_APP_ID || '';
  const SECRET = process.env.SHOPEE_SECRET || process.env.SHOPEE_AFFILIATE_SECRET || '';

  let finalUrl = url;
  let debug = [];

  // FUNÇÃO: tenta resolver short link com 5 métodos diferentes (incluindo IP residencial bypass)
  async function resolverShortLink(shortUrl) {
    const methods = [
      // Método 1: fetch direto (Vercel pode ser bloqueado mas tenta)
      async () => {
        const r = await fetch(shortUrl, {
          redirect: 'follow',
          headers: {
            'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.6 Mobile/15E148 Safari/604.1',
            'Accept': 'text/html,application/xhtml+xml',
            'Accept-Language': 'pt-BR,pt;q=0.9',
            'Referer': 'https://shopee.com.br/'
          }
        });
        return { url: r.url, html: await r.text() };
      },
      // Método 2: allorigins.win (bypass WAF)
      async () => {
        const pr = await fetch('https://api.allorigins.win/get?url=' + encodeURIComponent(shortUrl));
        const j = await pr.json();
        const html = j.contents || '';
        // extrai url real do html
        let m = html.match(/https:\/\/shopee\.com\.br\/[^"'\s]+-i\.\d+\.\d+/i);
        if (m) return { url: m[0], html };
        m = html.match(/https:\/\/deo\.shopeemobile\.com[^"'\s]+/i);
        if (m) {
          // resolve deo
          const pr2 = await fetch('https://api.allorigins.win/get?url=' + encodeURIComponent(m[0]));
          const j2 = await pr2.json();
          const html2 = j2.contents || '';
          const m2 = html2.match(/https:\/\/shopee\.com\.br\/[^"'\s]+-i\.\d+\.\d+/i);
          if (m2) return { url: m2[0], html: html2 };
        }
        return { url: shortUrl, html };
      },
      // Método 3: codetabs proxy
      async () => {
        const pr = await fetch('https://api.codetabs.com/v1/proxy?quest=' + encodeURIComponent(shortUrl));
        const html = await pr.text();
        let m = html.match(/https:\/\/shopee\.com\.br\/[^"'\s]+-i\.\d+\.\d+/i);
        if (m) return { url: m[0], html };
        return { url: shortUrl, html };
      },
      // Método 4: corsproxy.io
      async () => {
        const pr = await fetch('https://corsproxy.io/?' + encodeURIComponent(shortUrl));
        const html = await pr.text();
        let m = html.match(/https:\/\/shopee\.com\.br\/[^"'\s]+-i\.\d+\.\d+/i);
        if (m) return { url: m[0], html };
        return { url: shortUrl, html };
      },
      // Método 5: usando API oficial Shopee Affiliate para decodificar short link (se tiver APP_ID)
      async () => {
        if (!APP_ID || !SECRET) throw new Error('Sem credenciais Shopee');
        // Tenta endpoint oficial de decodificação de short link
        // Documentação Shopee: POST https://open-api.affiliate.shopee.com.br/graphql
        const timestamp = Math.floor(Date.now() / 1000);
        const query = `
          query {
            affiliateLinkDetail(shortLink: "${shortUrl}") {
              originalUrl
              itemId
              shopId
              productName
              imageUrl
              priceMin
              priceMax
            }
          }
        `;
        const payload = JSON.stringify({ query });
        // Assinatura Shopee: SHA256(APP_ID + TIMESTAMP + PAYLOAD + SECRET)
        const crypto = await import('crypto');
        const baseString = `${APP_ID}${timestamp}${payload}${SECRET}`;
        const signature = crypto.createHash('sha256').update(baseString).digest('hex');
        
        const r = await fetch('https://open-api.affiliate.shopee.com.br/graphql', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `SHA256 Credential=${APP_ID}, Timestamp=${timestamp}, Signature=${signature}`
          },
          body: payload
        });
        const j = await r.json();
        if (j.data?.affiliateLinkDetail?.originalUrl) {
          return { url: j.data.affiliateLinkDetail.originalUrl, html: '', apiData: j.data.affiliateLinkDetail };
        }
        throw new Error('API não retornou URL');
      }
    ];

    for (let i = 0; i < methods.length; i++) {
      try {
        const result = await methods[i]();
        debug.push(`Método ${i+1}: ${result.url.substring(0,80)}`);
        if (result.url.includes('shopee.com.br') && result.url.includes('-i.') && !result.url.includes('s.shopee.com.br') && !result.url.includes('deo.shopeemobile.com')) {
          return result;
        }
        if (result.url !== shortUrl && result.url.includes('shopee.com.br')) {
          // pode ser ainda deo, mas já avançou
          if (!result.url.includes('deo.shopeemobile.com')) {
            return result;
          }
        }
      } catch (e) {
        debug.push(`Método ${i+1} falhou: ${e.message}`);
      }
    }
    return { url: shortUrl, html: '' };
  }

  try {
    let resolved = { url: url, html: '' };
    
    if (url.includes('s.shopee.com.br') || url.includes('shope.ee')) {
      resolved = await resolverShortLink(url);
      finalUrl = resolved.url;
      debug.push(`Final resolvido: ${finalUrl}`);
    }

    // Se tem dados da API oficial, retorna direto
    if (resolved.apiData) {
      const d = resolved.apiData;
      return res.status(200).json({
        nome: d.productName || '',
        imagem: d.imageUrl ? (d.imageUrl.startsWith('http') ? d.imageUrl : `https://down-br.img.susercontent.com/file/${d.imageUrl}`) : '',
        preco: d.priceMin ? (d.priceMin/100000).toFixed(2) : '',
        precoAntigo: d.priceMax ? (d.priceMax/100000).toFixed(2) : '',
        loja: 'Shopee',
        categoria: 'Geral',
        urlFinal: d.originalUrl || finalUrl,
        metodo: 'Shopee Official API',
        debug
      });
    }

    // Se resolveu para URL com -i.SHOP.ITEM, chama PDP API (sem precisar de credencial)
    let nome = '';
    let imagem = '';
    let preco = '';
    let precoAntigo = '';

    if (finalUrl.includes('shopee.com.br')) {
      const m = finalUrl.match(/-i\.(\d+)\.(\d+)/);
      if (m) {
        const shopId = m[1];
        const itemId = m[2];
        debug.push(`Extraído shopId=${shopId} itemId=${itemId}`);
        try {
          const pdpUrl = `https://shopee.com.br/api/v4/pdp/get_pc?shopid=${shopId}&itemid=${itemId}`;
          const pdpRes = await fetch(pdpUrl, {
            headers: {
              'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
              'Accept': 'application/json',
              'Referer': 'https://shopee.com.br/',
              'x-api-source': 'pc',
              'x-shopee-language': 'pt-BR'
            }
          });
          const pdpJson = await pdpRes.json();
          const data = pdpJson?.data;
          debug.push(`PDP status ${pdpRes.status} hasData=${!!data}`);
          if (data) {
            nome = data.name || '';
            if (data.images?.length > 0) {
              let imgId = data.images[0];
              imagem = imgId.startsWith('http') ? imgId : `https://down-br.img.susercontent.com/file/${imgId}_800x800`;
            }
            if (data.price_min !== undefined) {
              preco = (data.price_min / 100000).toFixed(2);
              if (data.price_before_discount && data.price_before_discount > data.price_min) {
                precoAntigo = (data.price_before_discount / 100000).toFixed(2);
              }
            }
          }
        } catch (e) {
          debug.push(`PDP erro: ${e.message}`);
        }
      }
    }

    // Fallback OG tags
    if (!nome || !imagem) {
      try {
        let html = resolved.html;
        if (!html || html.length < 500) {
          const r = await fetch(finalUrl, {
            headers: { 'User-Agent': 'Mozilla/5.0', 'Referer': 'https://shopee.com.br/' }
          });
          html = await r.text();
        }
        if (html) {
          const getMeta = (prop) => {
            const patterns = [
              new RegExp(`<meta[^>]*property=["']${prop}["'][^>]*content=["']([^"']+)["']`, 'i'),
              new RegExp(`<meta[^>]*content=["']([^"']+)["'][^>]*property=["']${prop}["']`, 'i')
            ];
            for (const p of patterns) {
              const mm = html.match(p);
              if (mm) return mm[1];
            }
            return '';
          };
          if (!nome) {
            nome = getMeta('og:title').replace(/\| Shopee.*/i,'').trim();
            if (nome.toLowerCase().includes('shopee brasil')) nome = '';
          }
          if (!imagem) {
            imagem = getMeta('og:image');
            if (imagem.includes('shopee-logo') || imagem.includes('deo.shopeemobile')) imagem = '';
          }
        }
      } catch (e) {}
    }

    if (!nome && !imagem) {
      return res.status(200).json({
        nome: '',
        imagem: '',
        preco: '',
        loja: 'Shopee',
        categoria: 'Geral',
        urlFinal: finalUrl,
        error: 'Bloqueado - mas API oficial configurada? Verifique SHOPEE_APP_ID',
        debug
      });
    }

    return res.status(200).json({
      nome: nome || 'Produto Shopee',
      imagem: imagem || '',
      preco: preco || '',
      precoAntigo: precoAntigo || '',
      loja: 'Shopee',
      categoria: 'Geral',
      urlFinal: finalUrl,
      metodo: 'PDP + Proxy Bypass',
      debug
    });

  } catch (err) {
    return res.status(500).json({ error: err.message, debug, urlFinal: finalUrl });
  }
}
