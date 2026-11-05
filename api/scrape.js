// /api/scrape.js - V2 com suporte a s.shopee.com.br, amzn.to, etc - SEM CHAVE
export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  if (req.method === 'OPTIONS') return res.status(200).end();
  
  const { url } = req.query;
  if (!url) return res.status(400).json({ error: 'URL obrigatória' });
  
  try {
    // 1. Resolve short links (s.shopee, amzn.to)
    let finalUrl = url;
    let html = '';
    
    // Tenta resolver redirect manualmente
    if (url.includes('s.shopee.com.br') || url.includes('amzn.to') || url.includes('shope.ee')) {
      try {
        const redirectRes = await fetch(url, {
          method: 'GET',
          redirect: 'manual',
          headers: { 'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15' }
        });
        const loc = redirectRes.headers.get('location');
        if (loc) finalUrl = loc;
      } catch(e) {}
    }
    
    // 2. Baixa HTML da página final
    try {
      const r = await fetch(finalUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept': 'text/html,application/xhtml+xml',
          'Accept-Language': 'pt-BR,pt;q=0.9,en;q=0.8',
          'Referer': 'https://shopee.com.br/'
        }
      });
      html = await r.text();
      finalUrl = r.url || finalUrl; // pega URL final após redirects
    } catch(e) {
      html = '';
    }
    
    // 3. Fallback via allorigins se bloqueou
    if (!html || html.length < 500) {
      try {
        const proxy = await fetch('https://api.allorigins.win/get?url=' + encodeURIComponent(finalUrl));
        const j = await proxy.json();
        html = j.contents || '';
      } catch(e) {}
    }
    
    // 4. Parse meta tags
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
    
    let nome = getMeta('og:title') || getMeta('twitter:title') || '';
    if (!nome) {
      const t = html.match(/<title[^>]*>([^<]+)<\/title>/i);
      nome = t ? t[1] : '';
    }
    nome = nome.replace(/\| Shopee.*|\| Amazon.*|\| Mercado Livre.*/i, '').replace(/–.*Shopee.*/i, '').trim().substring(0,120);
    
    let imagem = getMeta('og:image') || getMeta('twitter:image') || '';
    // Shopee às vezes tem og:image com baixa qualidade, tenta pegar melhor
    if (!imagem) {
      const imgMatch = html.match(/"image"\s*:\s*"([^"]+susercontent[^"]+)"/i) || html.match(/https:\/\/down-br[^"']+\.jpg/i);
      if (imgMatch) imagem = imgMatch[1] || imgMatch[0];
    }
    
    // Limpa imagem (remove parâmetros de tracking)
    if (imagem) {
      imagem = imagem.replace(/&amp;/g, '&');
      // Se for da Shopee, garante que é link direto super leve
      if (imagem.includes('shopee') || imagem.includes('susercontent') || imagem.includes('down-br')) {
        // mantém como está - é 0MB Storage
      }
    }
    
    // Preço
    let preco = '';
    let precoAntigo = '';
    const precoRegexes = [
      /"price"\s*:\s*"?R?\$?\s*([\d.,]+)/i,
      /"currentPrice"\s*:\s*([\d.,]+)/i,
      /R\$\s*([\d.,]+)/,
      /og:price:amount["']\s*content=["']([\d.,]+)/i
    ];
    for (const pr of precoRegexes) {
      const m = html.match(pr);
      if (m) { preco = m[1]; break; }
    }
    if (preco) {
      preco = preco.replace(/\./g, '').replace(',', '.').replace(/[^\d.]/g, '');
      preco = parseFloat(preco);
    }
    
    // Loja
    const u = (finalUrl + url).toLowerCase();
    let loja = 'Geral';
    if (u.includes('shopee')) loja = 'Shopee';
    else if (u.includes('amazon') || u.includes('amzn.to')) loja = 'Amazon';
    else if (u.includes('mercadolivre') || u.includes('mercado livre') || u.includes('mlstatic')) loja = 'Mercado Livre';
    
    // Categoria por nome
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
      precoAntigo: precoAntigo || '',
      loja,
      categoria,
      urlFinal: finalUrl,
      debug: { htmlLen: html.length }
    });
    
  } catch (err) {
    return res.status(500).json({ error: 'Erro ao ler link: ' + err.message, nome: '', imagem: '' });
  }
}
