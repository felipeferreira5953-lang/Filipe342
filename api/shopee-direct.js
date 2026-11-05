// /api/shopee-direct.js - FINAL CORRIGIDO usando sua API oficial
// AppID: 18347061257 - use ENV na Vercel: SHOPEE_APP_ID e SHOPEE_SECRET

import crypto from 'crypto';

const ENDPOINT = 'https://open-api.affiliate.shopee.com.br/graphql';

function makeSignature(appId, timestamp, payload, secret) {
  // Documentação oficial: Signature = SHA256(AppId + Timestamp + Payload + Secret)
  const factor = `${appId}${timestamp}${payload}${secret}`;
  return crypto.createHash('sha256').update(factor).digest('hex');
}

async function expandShortUrl(shortUrl) {
  let current = shortUrl;
  for (let i = 0; i < 5; i++) {
    try {
      const res = await fetch(current, {
        method: 'HEAD',
        redirect: 'manual',
        headers: {
          'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.6 Mobile/15E148 Safari/604.1',
          'Accept': 'text/html',
          'Referer': 'https://shopee.com.br/'
        }
      });
      const loc = res.headers.get('location');
      if (loc) {
        current = new URL(loc, current).toString();
        if (!current.includes('s.shopee.com.br') && !current.includes('shope.ee')) break;
      } else {
        // Tenta GET com follow
        const res2 = await fetch(current, {
          redirect: 'follow',
          headers: {
            'User-Agent': 'Mozilla/5.0 (Linux; Android 10) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Mobile Safari/537.36'
          }
        });
        if (res2.url && res2.url !== current) current = res2.url;
        break;
      }
    } catch (e) {
      break;
    }
  }
  return current;
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const shortUrl = req.query.url || req.query.link || req.body?.url;
  if (!shortUrl) return res.status(400).json({ ok: false, error: 'URL não enviada' });

  const APP_ID = process.env.SHOPEE_APP_ID || '18347061257';
  const SECRET = process.env.SHOPEE_SECRET; // COLOQUE NO VERCEL ENV, não no código!

  console.log('[shopee-direct] Input:', shortUrl);

  let expanded = shortUrl;
  let debug = [];

  try {
    // 1. Expande s.shopee.com.br
    if (shortUrl.includes('s.shopee.com.br') || shortUrl.includes('shope.ee')) {
      expanded = await expandShortUrl(shortUrl);
      debug.push(`Expandido: ${shortUrl} -> ${expanded}`);
    }

    // 2. Se for link de produto Shopee e tiver credencial, tenta gerar link afiliado oficial + pegar oferta
    let affiliateData = null;
    if (expanded.includes('shopee.com.br') && SECRET) {
      try {
        // Query para gerar shortLink afiliado oficial (com sua comissão)
        const payload = JSON.stringify({
          query: `mutation {
            generateShortLink(input: {
              originLink: "${expanded}",
              subIds: ["achadinhos"]
            }) {
              shortLink
              originLink
            }
          }`
        });

        const timestamp = Math.floor(Date.now() / 1000).toString();
        const signature = makeSignature(APP_ID, timestamp, payload, SECRET);

        const apiRes = await fetch(ENDPOINT, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `SHA256 Credential=${APP_ID}, Timestamp=${timestamp}, Signature=${signature}`
          },
          body: payload
        });

        const apiJson = await apiRes.json();
        debug.push(`Shopee API resposta: ${JSON.stringify(apiJson).substring(0,500)}`);
        
        if (apiJson.data?.generateShortLink?.shortLink) {
          affiliateData = apiJson.data.generateShortLink;
        }
      } catch (e) {
        debug.push(`Erro API Shopee (não crítico): ${e.message}`);
      }
    }

    const aindaCurto = expanded.includes('s.shopee.com.br') || expanded.includes('shope.ee');

    return res.status(200).json({
      ok: true,
      original: shortUrl,
      expanded: expanded,
      affiliateLink: affiliateData?.shortLink || expanded, // link final pra salvar
      isShort: aindaCurto,
      warning: aindaCurto ? 'Shopee bloqueou expansão no servidor, mas link curto já vale comissão. Resolvendo no cliente.' : null,
      debug: {
        env: {
          APP_ID: APP_ID ? APP_ID.substring(0,4)+'***' : 'AUSENTE',
          SECRET: SECRET ? `OK ${SECRET.length} chars` : 'AUSENTE (coloque no Vercel)',
          Credencial: SECRET ? 'OK' : 'FALTA SECRET'
        },
        steps: debug,
        affiliate: affiliateData
      }
    });

  } catch (e) {
    console.error(e);
    return res.status(200).json({
      ok: true,
      original: shortUrl,
      expanded: expanded,
      affiliateLink: expanded,
      isShort: true,
      error: e.message,
      debug
    });
  }
}
