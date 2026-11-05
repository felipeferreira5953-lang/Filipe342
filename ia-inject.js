// ia-inject.js V6 - LINK CURTO OBRIGATÓRIO - resolve no navegador (não na Vercel) pra furar bloqueio
(function(){
  function detectarLojaIA(url){
    const u=(url||'').toLowerCase();
    if(u.includes('shopee')||u.includes('shope.ee')) return 'Shopee';
    if(u.includes('amazon')||u.includes('amzn.to')) return 'Amazon';
    if(u.includes('mercadolivre')||u.includes('mlstatic')) return 'Mercado Livre';
    return 'Geral';
  }
  function detectarCategoriaIA(nome){
    const n=(nome||'').toLowerCase();
    if(/vestido|saia|bolsa|salto|sandália|lingerie|sutiã|cropped|blusa fem/.test(n)){
      if(n.includes('bolsa')) return 'Bolsas';
      if(n.includes('salto')||n.includes('sandália')) return 'Calçados Femininos';
      if(n.includes('lingerie')||n.includes('sutiã')) return 'Lingerie';
      return 'Moda Feminina';
    }
    if(/camiseta|bermuda|tênis|tenis|boné|bone|camisa|moletom|masculin/.test(n)){
      if(n.includes('camisa')) return 'Camisas';
      if(n.includes('bermuda')) return 'Bermudas';
      if(n.includes('tênis')||n.includes('tenis')) return 'Tênis';
      if(n.includes('boné')||n.includes('bone')) return 'Bonés';
      return 'Moda Masculina';
    }
    return 'Geral';
  }

  // RESOLVE LINK CURTO NO NAVEGADOR DO CLIENTE (IP residencial, não bloqueado)
  async function resolverLinkCurtoNoNavegador(shortUrl){
    const url = shortUrl.trim();
    if (!url.includes('s.shopee.com.br') && !url.includes('shope.ee')) return url;
    
    // Tenta 3 proxies diferentes no navegador
    const proxies = [
      'https://api.allorigins.win/get?url=',
      'https://api.codetabs.com/v1/proxy?quest=',
      'https://corsproxy.io/?'
    ];
    
    for (const proxyBase of proxies) {
      try {
        const controller = new AbortController();
        const t = setTimeout(()=>controller.abort(), 8000);
        const r = await fetch(proxyBase + encodeURIComponent(url), { signal: controller.signal });
        clearTimeout(t);
        let html = '';
        if (proxyBase.includes('allorigins')) {
          const j = await r.json();
          html = j.contents || '';
        } else {
          html = await r.text();
        }
        if (!html) continue;
        
        // Procura URL real da Shopee no HTML
        // 1. Procura -i.SHOPID.ITEMID
        let m = html.match(/https:\/\/shopee\.com\.br\/[^"'\s]+-i\.(\d+)\.(\d+)[^"'\s]*/i);
        if (m) {
          let found = m[0].replace(/&amp;/g,'&');
          try { found = decodeURIComponent(found); } catch(e){}
          return found;
        }
        // 2. Procura shopee.com.br genérico
        m = html.match(/https:\/\/shopee\.com\.br\/[^\s"'<>]+\/[^"'\s]*/i);
        if (m) return m[0];
        // 3. Procura deo.shopeemobile e depois dentro dele
        m = html.match(/https:\/\/deo\.shopeemobile\.com\/[^"'\s]+/i);
        if (m) {
          // tenta resolver o deo também
          try {
            const r2 = await fetch('https://api.allorigins.win/get?url=' + encodeURIComponent(m[0]));
            const j2 = await r2.json();
            const html2 = j2.contents || '';
            const m2 = html2.match(/https:\/\/shopee\.com\.br\/[^"'\s]+-i\.\d+\.\d+/i);
            if (m2) return m2[0];
          } catch(e){}
        }
        // 4. Se achou HTML com shopee.com.br no texto, tenta extrair
        const all = html.match(/shopee\.com\.br\/[^"'\s]+/gi);
        if (all && all.length > 0) {
          for (const u of all) {
            if (u.includes('-i.') && !u.includes('deo.shopeemobile')) {
              return 'https://' + u.replace(/^https?:\/\//,'').replace(/&amp;/g,'&');
            }
          }
        }
      } catch(e) {
        console.log('proxy falhou', proxyBase, e);
      }
    }
    return url; // se não resolveu, manda original mesmo
  }

  function initIA(){
    const inputLink=document.getElementById('f-link');
    const btnSalvar=document.getElementById('f-salvar');
    if(!inputLink||document.getElementById('btn-ia-scrape')) return;
    
    const wrapper=document.createElement('div');
    wrapper.style.position='relative';
    wrapper.style.marginBottom='8px';
    inputLink.parentNode.insertBefore(wrapper,inputLink);
    wrapper.appendChild(inputLink);
    inputLink.style.paddingRight='110px';
    inputLink.placeholder='Cole link CURTO Shopee - IA resolve';
    
    const btn=document.createElement('button');
    btn.id='btn-ia-scrape';
    btn.type='button';
    btn.textContent='🤖 IA';
    btn.style.position='absolute';
    btn.style.right='4px';
    btn.style.top='4px';
    btn.style.height='34px';
    btn.style.padding='0 12px';
    btn.style.background='#000';
    btn.style.color='#fff';
    btn.style.borderRadius='999px';
    btn.style.fontSize='11px';
    btn.style.fontWeight='bold';
    btn.style.border='none';
    btn.style.zIndex='2';
    wrapper.appendChild(btn);
    
    const status=document.createElement('div');
    status.id='ia-status';
    status.style.display='none';
    status.style.marginBottom='8px';
    status.style.fontSize='11px';
    status.style.background='#f0fdf4';
    status.style.border='1px solid #bbf7d0';
    status.style.color='#166534';
    status.style.borderRadius='10px';
    status.style.padding='8px';
    wrapper.parentNode.insertBefore(status,wrapper.nextSibling);

    async function scrapeComIA(urlAfiliado){
      let link=(urlAfiliado||'').trim();
      if(!link.startsWith('http')){ alert('Cole um link https://'); return; }
      const txtOrig=btn.textContent;
      const txtSalvarOrig=btnSalvar?btnSalvar.textContent:'Salvar + 🔔 Notificar todo mundo';
      try{
        btn.textContent='⏳ Resolvendo...'; btn.disabled=true;
        if(btnSalvar){ btnSalvar.textContent='🔗 Resolvendo link curto...'; btnSalvar.disabled=true; }
        if(window.toast) window.toast('🔗 Resolvendo link curto Shopee...');
        
        let urlParaApi = link;
        
        // SE FOR LINK CURTO, RESOLVE NO NAVEGADOR PRIMEIRO
        if (link.includes('s.shopee.com.br') || link.includes('shope.ee')) {
          btn.textContent='🔗 Link curto...';
          if(btnSalvar) btnSalvar.textContent='🔗 Decodificando s.shopee...';
          const resolvido = await resolverLinkCurtoNoNavegador(link);
          if (resolvido && resolvido !== link) {
            urlParaApi = resolvido;
            status.style.display='block';
            status.textContent='🔗 Link curto resolvido: ' + resolvido.substring(0,60) + '... buscando dados...';
            status.style.background='#eff6ff';
            status.style.borderColor='#bfdbfe';
            status.style.color='#1e40af';
            console.log('Link curto resolvido:', link, '->', resolvido);
          } else {
            console.log('Não conseguiu resolver link curto, mandando original pra API V5');
          }
        }
        
        btn.textContent='⏳ Lendo...';
        if(btnSalvar) btnSalvar.textContent='🤖 IA lendo Shopee...';
        
        let dados=null;
        
        // CHAMA API V5 COM URL RESOLVIDA
        try{
          const controller=new AbortController();
          const timeout=setTimeout(()=>controller.abort(),20000);
          const r=await fetch('/api/scrape?url='+encodeURIComponent(urlParaApi),{signal:controller.signal});
          clearTimeout(timeout);
          if(r.ok){ 
            dados=await r.json(); 
          }
        }catch(e){ console.log('api falhou',e); }
        
        // Fallback allorigins direto se API falhou
        if(!dados || (!dados.nome && !dados.imagem)){
          try{
            const proxy='https://api.allorigins.win/get?url='+encodeURIComponent(urlParaApi);
            const rp=await fetch(proxy);
            const jp=await rp.json(); 
            const html=jp.contents||'';
            if(html){
              const getMeta=(prop)=>{
                const patterns=[
                  new RegExp(`<meta[^>]*property=["']${prop}["'][^>]*content=["']([^"']+)["']`,'i'),
                  new RegExp(`<meta[^>]*content=["']([^"']+)["'][^>]*property=["']${prop}["']`,'i')
                ];
                for(const p of patterns){ const m=html.match(p); if(m) return m[1]; }
                return '';
              };
              let nome=getMeta('og:title')||(html.match(/<title[^>]*>([^<]+)<\/title>/i)?.[1]||'');
              nome=nome.replace(/\| Shopee.*/i,'').trim().substring(0,150);
              if(nome.toLowerCase().includes('shopee brasil')) nome='';
              let imagem=getMeta('og:image')||'';
              if(imagem.includes('shopee-logo') || imagem.includes('deo.shopeemobile')) imagem='';
              if(!imagem){
                const m2=html.match(/https:\/\/down-br[^"'\s]+\.(?:jpg|png)/i);
                if(m2) imagem=m2[0];
              }
              dados=dados||{};
              dados.nome=dados.nome||nome;
              dados.imagem=dados.imagem||imagem;
              dados.loja=dados.loja||detectarLojaIA(link);
              dados.categoria=dados.categoria||detectarCategoriaIA(nome);
            }
          }catch(e){}
        }
        
        if(!dados) dados={nome:'',imagem:'',preco:'',loja:detectarLojaIA(link),categoria:'Geral'};
        
        // Preenche
        if(dados.nome) {
          const el=document.getElementById('f-nome');
          if(el) el.value=dados.nome;
        }
        if(dados.preco) {
          const el=document.getElementById('f-preco');
          if(el) el.value=dados.preco;
        }
        if(dados.precoAntigo){
          const el=document.getElementById('f-preco-antigo');
          if(el) el.value=dados.precoAntigo;
        }
        if(dados.imagem){
          const inpImg=document.getElementById('f-emoji');
          if(inpImg){ 
            inpImg.value=dados.imagem; 
            if(window.otimizarAoColar){
              try{ await window.otimizarAoColar(dados.imagem); }catch(e){ 
                const prev=document.getElementById('preview-img-tag');
                const prevBox=document.getElementById('preview-img');
                if(prev){ prev.src=dados.imagem; if(prevBox) prevBox.classList.remove('hidden'); }
              }
            } else {
              const prev=document.getElementById('preview-img-tag');
              const prevBox=document.getElementById('preview-img');
              if(prev){ prev.src=dados.imagem; if(prevBox) prevBox.classList.remove('hidden'); }
            }
          }
        }
        
        const lojaFinal=dados.loja||detectarLojaIA(link);
        const catFinal=dados.categoria||detectarCategoriaIA(dados.nome||'');
        const elLoja=document.getElementById('f-loja');
        const elCat=document.getElementById('f-categoria');
        if(elLoja) elLoja.value=lojaFinal;
        if(elCat && catFinal!=='Geral') elCat.value=catFinal;
        
        status.style.display='block';
        if(dados.imagem && dados.nome && !dados.nome.toLowerCase().includes('shopee brasil')){
          status.textContent='✅ IA (link curto): '+(dados.nome||'produto').substring(0,50)+' • '+lojaFinal+' • 0MB';
          status.style.background='#f0fdf4';
          status.style.borderColor='#bbf7d0';
          status.style.color='#166534';
        } else if(dados.nome){
          status.textContent='⚠️ IA pegou nome mas Shopee bloqueou imagem. Cole imagem manual. Nome: '+(dados.nome||'ok');
          status.style.background='#fef9c3';
          status.style.borderColor='#fde68a';
          status.style.color='#854d0e';
        } else {
          status.textContent='❌ Shopee bloqueou link curto. Tente: abra o link curto no navegador, copie o link GRANDE shopee.com.br/...-i.123... e cole aqui. Ou aguarde 5s e tente de novo.';
          status.style.background='#fee2e2';
          status.style.borderColor='#fecaca';
          status.style.color='#991b1b';
        }
        
        if(window.toast) window.toast(dados.imagem?'✅ IA link curto OK com imagem!':'⚠️ Link curto bloqueado - tente link grande');
        
        setTimeout(()=>{ if(status) status.style.display='none'; },10000);
        
      }catch(err){
        status.style.display='block';
        status.textContent='❌ Erro IA link curto: '+err.message;
        status.style.background='#fee2e2';
        status.style.borderColor='#fecaca';
        status.style.color='#991b1b';
      }finally{ 
        btn.textContent='🤖 IA'; 
        btn.disabled=false;
        if(btnSalvar){ btnSalvar.textContent=txtSalvarOrig; btnSalvar.disabled=false; }
      }
    }
    
    btn.addEventListener('click',()=>{ const v=inputLink.value.trim(); if(v) scrapeComIA(v); else alert('Cole o link afiliado curto primeiro'); });
    inputLink.addEventListener('paste',()=>{ 
      setTimeout(()=>{ 
        const v=inputLink.value.trim(); 
        if(v&&v.startsWith('http')&&v.length>15) scrapeComIA(v); 
      },600); 
    });
    
    window.scrapeComIA=scrapeComIA;
  }
  
  let tentativas=0;
  const iv=setInterval(()=>{
    initIA();
    tentativas++;
    if(tentativas>20) clearInterval(iv);
  },800);
  initIA();
})();
