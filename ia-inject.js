// ia-inject.js - Injeção IA super leve - cole no final do index.html antes de </body>
// Parte 1: botão 🤖 IA + auto preenchimento sem API Shopee
(function(){
  function detectarLojaIA(url){
    const u=(url||'').toLowerCase();
    if(u.includes('shopee')) return 'Shopee';
    if(u.includes('amazon')||u.includes('amzn.to')) return 'Amazon';
    if(u.includes('mercadolivre')||u.includes('mlstatic')) return 'Mercado Livre';
    return 'Geral';
  }
  function detectarCategoriaIA(nome){
    const n=(nome||'').toLowerCase();
    if(/vestido|saia|bolsa|salto|sandália|lingerie|sutiã/.test(n)){
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
  function initIA(){
    const inputLink=document.getElementById('f-link');
    if(!inputLink||document.getElementById('btn-ia-scrape')) return;
    // cria botão
    const wrapper=document.createElement('div');
    wrapper.style.position='relative';
    wrapper.style.marginBottom='8px';
    inputLink.parentNode.insertBefore(wrapper,inputLink);
    wrapper.appendChild(inputLink);
    inputLink.style.paddingRight='110px';
    inputLink.placeholder='Cole link afiliado Shopee/Amazon/ML - IA auto';
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
      const link=(urlAfiliado||'').trim();
      if(!link.startsWith('http')){ alert('Cole um link https://'); return; }
      const txtOrig=btn.textContent;
      try{
        btn.textContent='⏳ Lendo...'; btn.disabled=true;
        if(window.toast) window.toast('🤖 IA lendo '+detectarLojaIA(link)+'...');
        let dados=null;
        try{
          const r=await fetch('/api/scrape?url='+encodeURIComponent(link));
          if(r.ok){ dados=await r.json(); if(dados.error) throw new Error(dados.error); }
          else throw new Error('api off');
        }catch(e){
          const proxy='https://api.allorigins.win/get?url='+encodeURIComponent(link);
          const rp=await fetch(proxy); const jp=await rp.json(); const html=jp.contents||'';
          const getMeta=(prop)=>{
            const p1=new RegExp(`<meta[^>]*property=["']${prop}["'][^>]*content=["']([^"']+)["']`,'i');
            const m=html.match(p1); return m?m[1]:'';
          };
          let nome=getMeta('og:title')||(html.match(/<title[^>]*>([^<]+)<\/title>/i)?.[1]||'');
          nome=nome.replace(/\| Shopee.*|\| Amazon.*/i,'').trim().substring(0,100);
          let imagem=getMeta('og:image')||'';
          let preco=''; const pm=html.match(/R\$\s*([\d.,]+)/); if(pm) preco=pm[1].replace(/\./g,'').replace(',','.').replace(/[^\d.]/g,'');
          dados={nome,imagem,preco:preco?parseFloat(preco):'',loja:detectarLojaIA(link),categoria:detectarCategoriaIA(nome)};
        }
        if(dados.nome) document.getElementById('f-nome').value=dados.nome;
        if(dados.preco) document.getElementById('f-preco').value=dados.preco;
        if(dados.precoAntigo) document.getElementById('f-preco-antigo').value=dados.precoAntigo;
        if(dados.imagem){
          const inpImg=document.getElementById('f-emoji');
          if(inpImg){ inpImg.value=dados.imagem; if(window.otimizarAoColar) await window.otimizarAoColar(dados.imagem); }
        }
        document.getElementById('f-loja').value=dados.loja||detectarLojaIA(link);
        document.getElementById('f-categoria').value=dados.categoria||detectarCategoriaIA(dados.nome||'');
        status.style.display='block'; status.textContent='✅ IA preencheu: '+(dados.nome||'produto')+' • '+(dados.loja||'');
        if(window.toast) window.toast('✅ IA preencheu! Confere e salva');
        setTimeout(()=>status.style.display='none',5000);
      }catch(err){
        alert('Não consegui ler tudo, mas detectei loja: '+detectarLojaIA(link));
        document.getElementById('f-loja').value=detectarLojaIA(link);
      }finally{ btn.textContent=txtOrig; btn.disabled=false; }
    }
    btn.addEventListener('click',()=>{ const v=inputLink.value.trim(); if(v) scrapeComIA(v); else alert('Cole o link afiliado primeiro'); });
    inputLink.addEventListener('paste',()=>{ setTimeout(()=>{ const v=inputLink.value.trim(); if(v&&v.startsWith('http')&&v.length>15) scrapeComIA(v); },300); });
    // expõe global
    window.scrapeComIA=scrapeComIA;
  }
  // tenta várias vezes até o ADM carregar
  setInterval(initIA,1000);
  initIA();
})();
