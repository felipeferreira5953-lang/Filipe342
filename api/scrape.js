/// /api/scrape.js V5 - FINAL - fura deo.shopeemobile.com e pega produto real via PDP
export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  if (req.method === 'OPTIONS') return res.status(200).end();
  
  const { url } = req.query;
  if (!url) return res.status(400).json({ error: 'URL obrigatória' });
  
  try {
    let finalUrl = url;
    let html = '';
    let debugSteps = [];

    // Função pra extrair URL real da Shopee de qualquer HTML
    function extractRealShopeeUrl(h) {
      if (!h) return null;
      // Padrões que a Shopee usa
      const patterns = [
        /https:\/\/shopee\.com\.br\/[^"'\s]+-i\.(\d+)\.(\d+)[^"'\s]*/i,
        /https:\/\/shopee\.com\.br\/product\/\d+\/\d+/i,
        /"productUrl"\s*:\s*"(https:\/\/shopee\.com\.br[^"]+)"/i,
        /window\.location\s*=\s*"(https:\/\/shopee\.com\.br[^"]+)"/i,
        /window\.location\.href\s*=\s*"(https:\/\/shopee\.com\.br[^"]+)"/i,
        /url=(https:\/\/shopee\.com\.br[^&\s"']+)/i,
        /https%3A%2F%2Fshopee\.com\.br%2F[^"'\s]+/i // URL encoded
      ];
      for (const p of patterns) {
        const m = h.match(p);
        if (m) {
          let found = m[1] || m[0];
          try { found = decodeURIComponent(found); } catch(e){}
          found = found.replace(/&amp;/g,'&').replace(/\\u002F/g,'/').replace(/\\\//g,'/');
          if (found.includes('shopee.com.br')) return found;
        }
      }
      // Procura qualquer link shopee.com.br no HTML
      const all = h.match(/https:\/\/shopee\.com\.br\/[^\s"'<>]+/gi);
      if (all) {
        // pega o que tem -i.SHOP.ITEM
        for (const u of all) {
          if (u.includes('-i.') && u.includes('.')) return u;
        }
        return all[0];
      }
      return null;
    }

    // PASSO 1: Resolve s.shopee.com.br
    if (url.includes('s.shopee.com.br') || url.includes('shope.ee')) {
      try {
        const r = await fetch(url, {
          redirect: 'follow',
          headers: {
            'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.6 Mobile/15E148 Safari/604.1',
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
            'Accept-Language': 'pt-BR,pt;q=0.9'
          }
        });
        finalUrl = r.url;
        const txt = await r.text();
        html = txt;
        debugSteps.push(`1. fetch short -> ${finalUrl} len=${txt.length}`);
        
        // Se caiu no deo.shopeemobile.com, tenta extrair real URL do HTML
        if (finalUrl.includes('deo.shopeemobile.com') || finalUrl.includes('shopeemobile.com') || txt.includes('shopee.com.br')) {
          const real = extractRealShopeeUrl(txt);
          if (real) {
            finalUrl = real;
            debugSteps.push(`1b. extraiu real URL: ${real}`);
          }
        }
      } catch(e) {
        debugSteps.push(`1. erro fetch short: ${e.message}`);
      }
    }

    // PASSO 2: Se finalUrl ainda é deo ou shopeemobile, busca via proxy allorigins
    if (finalUrl.includes('deo.shopeemobile.com') || finalUrl.includes('shopeemobile.com') || finalUrl.includes('s.shopee.com.br')) {
      try {
        const proxy = await fetch('https://api.allorigins.win/get?url=' + encodeURIComponent(finalUrl.includes('s.shopee') ? url : finalUrl), {
          headers: { 'User-Agent': 'Mozilla/5.0' }
        });
        const j = await proxy.json();
        const proxiedHtml = j.contents || '';
        debugSteps.push(`2. allorigins len=${proxiedHtml.length}`);
        const real = extractRealShopeeUrl(proxiedHtml);
        if (real) {
          finalUrl = real;
          html = proxiedHtml;
          debugSteps.push(`2b. real URL via proxy: ${real}`);
        } else {
          html = proxiedHtml;
        }
      } catch(e) {
        debugSteps.push(`2. erro proxy: ${e.message}`);
      }
    }

    // PASSO 3: Agora finalUrl deve ser shopee.com.br/...-i.SHOP.ITEM
    let nome = '';
    let imagem = '';
    let preco = '';
    let precoAntigo = '';

    // Tenta API PDP
    if (finalUrl.includes('shopee.com.br')) {
      let shopId = '';
      let itemId = '';
      let m = finalUrl.match(/-i\.(\d+)\.(\d+)/);
      if (m) { shopId = m[1]; itemId = m[2]; }
      
      if (shopId && itemId) {
        try {
          // API PDP - sem auth
          const pdpUrl = `https://shopee.com.br/api/v4/pdp/get_pc?shopid=${shopId}&itemid=${itemId}`;
          debugSteps.push(`3. chamando PDP: ${pdpUrl}`);
          const pdpRes = await fetch(pdpUrl, {
            headers: {
              'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
              'Accept': 'application/json',
              'Referer': 'https://shopee.com.br/',
              'x-api-source': 'pc',
              'x-shopee-language': 'pt-BR',
              'af-ac-enc-dat': ''
            }
          });
          const pdpJson = await pdpRes.json();
          debugSteps.push(`3b. PDP status: ${pdpRes.status} hasData=${!!pdpJson.data}`);
          const data = pdpJson?.data;
          if (data) {
            nome = data.name || '';
            if (data.images && data.images.length > 0) {
              let imgId = data.images[0];
              if (imgId.startsWith('http')) imagem = imgId;
              else imagem = `https://down-br.img.susercontent.com/file/${imgId}_800x800`;
            }
            // Preço: Shopee retorna em centavos * 100000
            if (data.price_min !== undefined) {
              // price_min em formato 100000 = R$1
              const pMin = data.price_min / 100000;
              const pMax = data.price_max / 100000;
              preco = pMin.toFixed(2);
              if (data.price_before_discount && data.price_before_discount > data.price_min) {
                precoAntigo = (data.price_before_discount / 100000).toFixed(2);
              }
            } else if (data.price) {
              preco = (data.price / 100000).toFixed(2);
            }
            debugSteps.push(`3c. PDP OK nome=${nome.substring(0,30)} img=${imagem.substring(0,40)} preco=${preco}`);
          }
        } catch(e) {
          debugSteps.push(`3. erro PDP: ${e.message}`);
        }
      } else {
        debugSteps.push(`3. não achou shopId/itemId em ${finalUrl}`);
      }
    }

    // PASSO 4: Fallback - tenta pegar OG tags da página real
    if ((!nome || !imagem) && finalUrl.includes('shopee.com.br')) {
      try {
        if (!html || html.length < 1000 || finalUrl !== url) {
          const r = await fetch(finalUrl, {
            headers: {
              'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
              'Accept': 'text/html,application/xhtml+xml',
              'Referer': 'https://shopee.com.br/'
            }
          });
          html = await r.text();
        }
        if (!html || html.length < 500) {
          const proxy = await fetch('https://api.allorigins.win/get?url=' + encodeURIComponent(finalUrl));
          const j = await proxy.json();
          html = j.contents || '';
        }
        
        const getMeta = (prop) => {
          const patterns = [
            new RegExp(`<meta[^>]*property=["']${prop}["'][^>]*content=["']([^"']+)["']`, 'i'),
            new RegExp(`<meta[^>]*content=["']([^"']+)["'][^>]*property=["']${prop}["']`, 'i')
          ];
          for (const p of patterns) {
            const m = html.match(p);
            if (m) return m[1];
          }
          return '';
        };
        
        if (!nome) {
          nome = getMeta('og:title') || '';
          if (!nome) {
            const t = html.match(/<title[^>]*>([^<]+)<\/title>/i);
            nome = t ? t[1] : '';
          }
          nome = nome.replace(/\| Shopee.*$/i, '').trim();
          // Se ainda é genérico "Shopee Brasil", descarta
          if (nome.toLowerCase().includes('shopee brasil') || nome.toLowerCase() === 'shopee') nome = '';
        }
        if (!imagem) {
          imagem = getMeta('og:image') || '';
          // Se imagem é logo da Shopee, descarta
          if (imagem.includes('shopee-logo') || imagem.includes('deo.shopeemobile.com')) imagem = '';
          if (!imagem) {
            const m = html.match(/https:\/\/down-br[^"'\s]+\.(?:jpg|png)/i);
            if (m) imagem = m[0];
          }
        }
      } catch(e) {
        debugSteps.push(`4. erro fallback OG: ${e.message}`);
      }
    }

    // Limpeza final
    if (nome && nome.toLowerCase().includes('shopee brasil | ofertas incríveis')) nome = '';
    
    const u = (finalUrl + url).toLowerCase();
    let loja = 'Geral';
    if (u.includes('shopee')) loja = 'Shopee';
    else if (u.includes('amazon') || u.includes('amzn.to')) loja = 'Amazon';
    else if (u.includes('mercadolivre')) loja = 'Mercado Livre';
    
    const nomeLower = (nome||'').toLowerCase();
    let categoria = 'Geral';
    if (/vestido|saia|bolsa|salto|sandália|lingerie|sutiã|cropped|blusa fem/.test(nomeLower)) categoria = 'Moda Feminina';
    else if (/camiseta|bermuda|tênis|tenis|boné|bone|camisa|moletom|masculin/.test(nomeLower)) categoria = 'Moda Masculina';

    // Se ainda sem nome/imagem, retorna erro claro
    if (!nome && !imagem) {
      return res.status(200).json({
        nome: '',
        imagem: '',
        preco: '',
        loja,
        categoria,
        urlFinal: finalUrl,
        error: 'Shopee bloqueou - cole nome e imagem manual, ou use link completo shopee.com.br (não curto)',
        debug: { steps: debugSteps, finalUrl, htmlLen: html.length }
      });
    }

    return res.status(200).json({
      nome: nome || 'Produto ' + loja,
      imagem: imagem || '',
      preco: preco || '',
      precoAntigo: precoAntigo || '',
      loja,
      categoria,
      urlFinal: finalUrl,
      debug: { steps: debugSteps }
    });
    
  } catch (err) {
    return res.status(500).json({ error: 'Erro: ' + err.message, nome: '', imagem: '' });
  }
}
