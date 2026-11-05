export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  const url = req.query.url;
  if (!url) return res.status(400).json({ error: 'url required' });
  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml',
        'Accept-Language': 'pt-BR,pt;q=0.9,en;q=0.8'
      },
      redirect: 'follow'
    });
    const html = await response.text();
    const finalUrl = response.url;
    const getMeta = (prop) => {
      const patterns = [
        new RegExp(`<meta[^>]*property=["']${prop}["'][^>]*content=["']([^"']+)["']`, 'i'),
        new RegExp(`<meta[^>]*content=["']([^"']+)["'][^>]*property=["']${prop}["']`, 'i'),
      ];
      for (const p of patterns) {
        const m = html.match(p);
        if (m) return m[1];
      }
      return '';
    };
    let nome = getMeta('og:title') || (html.match(/<title[^>]*>([^<]+)<\/title>/i)?.[1] || '');
    nome = nome.replace(/\| Shopee.*|\| Amazon.*/i,'').trim().substring(0,100);
    let imagem = getMeta('og:image') || '';
    let preco = '';
    const pm = html.match(/R\$\s*([\d.,]+)/);
    if (pm) preco = pm[1];
    if (preco) preco = preco.replace(/\./g,'').replace(',', '.').replace(/[^\d.]/g,'');
    const lower = (finalUrl + ' ' + url).toLowerCase();
    let loja = 'Geral';
    if (lower.includes('shopee')) loja = 'Shopee';
    else if (lower.includes('amazon') || lower.includes('amzn')) loja = 'Amazon';
    else if (lower.includes('mercadolivre')) loja = 'Mercado Livre';
    const nomeLower = nome.toLowerCase();
    let categoria = 'Geral';
    if (/camiseta|bermuda|tênis|tenis|boné|bone|camisa/.test(nomeLower)) categoria = 'Moda Masculina';
    else if (/vestido|bolsa|salto|sandália|lingerie/.test(nomeLower)) categoria = 'Moda Feminina';
    return res.status(200).json({
      nome: nome || '',
      imagem: imagem || '',
      preco: preco ? parseFloat(preco) : '',
      loja, categoria, urlFinal: finalUrl
    });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
}
