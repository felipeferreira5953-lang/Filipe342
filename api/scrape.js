// /api/scrape.js V4 - FURA BLOQUEIO SHOPEE - resolve s.shopee.com.br e pega via API interna
export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  if (req.method === 'OPTIONS') return res.status(200).end();
  
  const { url } = req.query;
  if (!url) return res.status(400).json({ error: 'URL obrigatória' });
  
  try {
    let finalUrl = url;
    let html = '';
    
    // 1. RESOLVE LINK CURTO s.shopee.com.br
    if (url.includes('s.shopee.com.br') || url.includes('shope.ee') || url.includes('amzn.to')) {
      try {
        // Tenta resolver seguindo redirect
        const r1 = await fetch(url, {
          redirect: 'follow',
          headers: { 
            'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.6 Mobile/15E148 Safari/604.1',
            'Accept': 'text/html,application/xhtml+xml'
          }
        });
        finalUrl = r1.url || finalUrl;
        if (!html) {
          const txt = await r1.text();
          if (txt.length > 500) html = txt;
        }
      } catch(e) {
        // fallback via allorigins raw que segue redirect
        try {
          const proxyRaw = await fetch('https://api.allorigins.win/raw?url=' + encodeURIComponent(url));
          finalUrl = proxyRaw.url || finalUrl;
          if (proxyRaw.url && proxyRaw.url !== url) {
            finalUrl = proxyRaw.url;
          }
        } catch(e2){}
      }
    }
    
    // Se ainda é s.shopee, tenta resolver via allorigins get pra pegar HTML com JS redirect
    if ((finalUrl.includes('s.shopee') || finalUrl.includes('shope.ee')) && !html) {
      try {
        const pr = await fetch('https://api.allorigins.win/get?url=' + encodeURIComponent(url));
        const j = await pr.json();
        html = j.contents || '';
        // tenta extrair redirect da Shopee dentro do HTML
        // Shopee short tem: <meta http-equiv="refresh" content="0;url=https://shopee.com.br/...">
        let metaRefresh = html.match(/url=(https:\/\/shopee\.com\.br[^"'>\s]+)/i);
        if (metaRefresh) finalUrl = metaRefresh[1].replace(/&amp;/g,'&');
        else {
          let jsRedirect = html.match(/window\.location\s*=\s*["'](https:\/\/shopee\.com\.br[^"']+)["']/i);
          if (jsRedirect) finalUrl = jsRedirect[1];
        }
      } catch(e){}
    }
    
    // 2. Se finalUrl é da Shopee, tenta API interna PDP (não precisa de AppID)
    let nome = '';
    let imagem = '';
    let preco = '';
    
    if (finalUrl.includes('shopee.com.br')) {
      // Extrair shopid e itemid
      // Formatos: https://shopee.com.br/Nome-Produto-i.SHOPID.ITEMID ou -i.SHOPID.ITEMID? ou /-i.SHOPID.ITEMID
      let shopId = '';
      let itemId = '';
      
      // tenta padrão -i.SHOPID.ITEMID
      let m = finalUrl.match(/-i\.(\d+)\.(\d+)/);
      if (m) {
        shopId = m[1];
        itemId = m[2];
      } else {
        // tenta /product/ ou outro
        m = finalUrl.match(/\/(\d+)\/(\d+)(?:\?|$)/);
        if (m) {
          shopId = m[1];
          itemId = m[2];
        }
      }
      
      if (shopId && itemId) {
        try {
          // API PDP da Shopee (publica, sem auth)
          const pdpUrl = `https://shopee.com.br/api/v4/pdp/get_pc?shopid=${shopId}&itemid=${itemId}`;
          const pdpRes = await fetch(pdpUrl, {
            headers: {
              'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
              'Accept': 'application/json',
              'Referer': finalUrl,
              'x-api-source': 'pc',
              'x-shopee-language': 'pt-BR'
            }
          });
          const pdpJson = await pdpRes.json();
          const data = pdpJson?.data;
          if (data) {
            nome = data.name || '';
            // imagens: data.images array
            if (data.images && data.images.length > 0) {
              // imagem Shopee: https://down-br.img.susercontent.com/file/ + imageId
              // pode ser só ID, precisa montar URL
              let imgId = data.images[0];
              if (imgId.startsWith('http')) imagem = imgId;
              else imagem = `https://down-br.img.susercontent.com/file/${imgId}`;
            }
            // preço
            if (data.price_info || data.price) {
              // price é em centavos
              let p = data.price || data.price_info?.current_price || data.price_before_discount;
              if (p) {
                // Shopee usa preço em formato 100000 = R$1,00? Na real divide por 100000
                if (p > 1000) preco = (p / 100000).toString();
                else preco = p.toString();
              }
            }
            if (data.price_min && data.price_max) {
              if (data.price_min === data.price_max) preco = (data.price_min / 100000).toString();
            }
          }
        } catch(e) {
          console.log('Erro PDP API', e);
        }
      }
    }
    
    // 3. Se ainda não pegou, baixa HTML normal
    if (!nome || !imagem) {
      if (!html || html.length < 500) {
        try {
          const r = await fetch(finalUrl, {
            headers: {
              'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
              'Accept': 'text/html,application/xhtml+xml',
              'Accept-Language': 'pt-BR,pt;q=0.9',
              'Referer': 'https://shopee.com.br/'
            }
          });
          html = await r.text();
          finalUrl = r.url || finalUrl;
        } catch(e) {}
      }
      
      // fallback allorigins
      if (!html || html.length < 500) {
        try {
          const proxy = await fetch('https://api.allorigins.win/get?url=' + encodeURIComponent(finalUrl));
          const j = await proxy.json();
          html = j.contents || '';
        } catch(e) {}
      }
      
      // Parse og tags se ainda precisa
      if (html) {
        const getMeta = (prop) => {
          const patterns = [
            new RegExp(`<meta[^>]*property=["']${prop}["'][^>]*content=["']([^"']+)["']`, 'i'),
            new RegExp(`<meta[^>]*content=["']([^"']+)["'][^>]*property=["']${prop}["']`, 'i'),
            new RegExp(`<meta[^>]*name=["']${prop}["'][^>]*content=["']([^"']+)["']`, 'i')
          ];
          for (const p of patterns) {
            const m = html.match(p);
            if (m) return m[1];
          }
          return '';
        };
        
        if (!nome) {
          nome = getMeta('og:title') || getMeta('twitter:title') || '';
          if (!nome) {
            const t = html.match(/<title[^>]*>([^<]+)<\/title>/i);
            nome = t ? t[1] : '';
          }
          // Limpa
          nome = nome.replace(/\| Shopee.*|\| Amazon.*|\| Mercado Livre.*/i, '').trim().substring(0,150);
        }
        
        if (!imagem) {
          imagem = getMeta('og:image') || getMeta('twitter:image') || '';
          if (!imagem) {
            // procura down-br ou susercontent direto
            const imgMatch = html.match(/https:\/\/down-br[^"'\s]+\.jpg/i) || html.match(/https:\/\/[^"']*susercontent[^"']*\.jpg/i) || html.match(/"image"\s*:\s*"([^"]+susercontent[^"]+)"/i);
            if (imgMatch) imagem = imgMatch[1] || imgMatch[0];
          }
        }
        
        if (!preco) {
          const precoRegexes = [
            /"price"\s*:\s*"?R?\$?\s*([\d.,]+)/i,
            /R\$\s*([\d.,]+)/,
          ];
          for (const pr of precoRegexes) {
            const m = html.match(pr);
            if (m) { preco = m[1]; break; }
          }
          if (preco) {
            preco = preco.replace(/\./g, '').replace(',', '.').replace(/[^\d.]/g, '');
            preco = parseFloat(preco).toString();
          }
        }
      }
    }
    
    // Limpa nome genérico
    if (nome.toLowerCase() === 'shopee' || nome.toLowerCase().includes('compre') || nome.length < 5) {
      nome = '';
    }
    
    const u = (finalUrl + url).toLowerCase();
    let loja = 'Geral';
    if (u.includes('shopee')) loja = 'Shopee';
    else if (u.includes('amazon') || u.includes('amzn.to')) loja = 'Amazon';
    else if (u.includes('mercadolivre') || u.includes('mlstatic')) loja = 'Mercado Livre';
    
    const nomeLower = (nome||'').toLowerCase();
    let categoria = 'Geral';
    if (/vestido|saia|bolsa|salto|sandália|lingerie|sutiã|cropped|blusa fem/.test(nomeLower)) {
      if (nomeLower.includes('bolsa')) categoria = 'Bolsas';
      else if (nomeLower.includes('salto') || nomeLower.includes('sandália')) categoria = 'Calçados Femininos';
      else if (nomeLower.includes('lingerie') || nomeLower.includes('sutiã')) categoria = 'Lingerie';
      else categoria = 'Moda Feminina';
    } else if (/camiseta|bermuda|tênis|tenis|boné|bone|camisa|moletom|masculin|kit.*masculin/.test(nomeLower)) {
      if (nomeLower.includes('camisa')) categoria = 'Camisas';
      else if (nomeLower.includes('bermuda')) categoria = 'Bermudas';
      else if (nomeLower.includes('tênis') || nomeLower.includes('tenis')) categoria = 'Tênis';
      else if (nomeLower.includes('boné') || nomeLower.includes('bone')) categoria = 'Bonés';
      else categoria = 'Moda Masculina';
    }
    
    return res.status(200).json({
      nome: nome || 'Produto ' + loja,
      imagem: imagem || '',
      preco: preco || '',
      loja,
      categoria,
      urlFinal: finalUrl,
      debug: { htmlLen: html.length, resolvedUrl: finalUrl }
    });
    
  } catch (err) {
    return res.status(500).json({ error: 'Erro ao ler link: ' + err.message, nome: '', imagem: '' });
  }
}
