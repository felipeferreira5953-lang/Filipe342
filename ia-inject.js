// ia-inject.js V3 - COM API SHOPEE OFICIAL + fallback scrape - não trava
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
    inputLink.placeholder='Cole link afiliado - IA auto com sua API';
    
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
      const link=(urlAfiliado||'').trim();
      if(!link.startsWith('http')){ alert('Cole um link https://'); return; }
      const txtOrig=btn.textContent;
      const txtSalvarOrig=btnSalvar?btnSalvar.textContent:'Salvar + 🔔 Notificar todo mundo';
      try{
        btn.textContent='⏳ Lendo...'; btn.disabled=true;
        if(btnSalvar){ btnSalvar.textContent='🤖 IA com API Shopee...'; btnSalvar.disabled=true; }
        if(window.toast) window.toast('🤖 IA lendo '+detectarLojaIA(link)+' via API oficial...');
        
        let dados=null;
        
        // TENTATIVA 1: API OFICIAL SHOPEE (se você configurou SHOPEE_APP_ID na Vercel)
        if(link.toLowerCase().includes('shopee') || link.includes('shope.ee')){
          try{
            const ctrl=new AbortController();
            const to=setTimeout(()=>ctrl.abort(),15000);
            const r=await fetch('/api/shopee-affiliate?url='+encodeURIComponent(link),{signal:ctrl.signal});
            clearTimeout(to);
            if(r.ok){
              const j=await r.json();
              if(j.nome || j.imagem || j.fonte==='shopee_affiliate_api'){
                dados=j;
                console.log('Shopee API oficial OK',j);
              }
            }
          }catch(e){ console.log('Shopee API não configurada ou falhou, vai pro scrape',e); }
        }

        // TENTATIVA 2: /api/scrape V2 (funciona para todos)
        if(!dados || !dados.nome){
          try{
            const controller=new AbortController();
            const timeout=setTimeout(()=>controller.abort(),15000);
            const r=await fetch('/api/scrape?url='+encodeURIComponent(link),{signal:controller.signal});
            clearTimeout(timeout);
            if(r.ok){ 
              const j=await r.json();
              if(!j.error) dados={...dados, ...j};
              else if(!dados) dados=j;
            }
          }catch(e){ console.log('scrape api falhou',e); }
        }
        
        // TENTATIVA 3: allorigins direto
        if(!dados || !dados.nome){
          try{
            const proxy='https://api.allorigins.win/get?url='+encodeURIComponent(link);
            const controller2=new AbortController();
            const timeout2=setTimeout(()=>controller2.abort(),12000);
            const rp=await fetch(proxy,{signal:controller2.signal});
            clearTimeout(timeout2);
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
              nome=nome.replace(/\| Shopee.*|\| Amazon.*/i,'').trim().substring(0,100);
              let imagem=getMeta('og:image')||'';
              if(!imagem){
                const m2=html.match(/https:\/\/[^"']*susercontent[^"']*\.jpg/i) || html.match(/https:\/\/[^"']*down-br[^"']*\.jpg/i);
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
        
        if(dados.nome) {
          const el=document.getElementById('f-nome');
          if(el) el.value=dados.nome;
        }
        if(dados.preco) {
          const el=document.getElementById('f-preco');
          if(el) el.value=dados.preco;
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
        const isApiOficial = dados.fonte==='shopee_affiliate_api' || dados.superLeve;
        if(dados.imagem){
          status.textContent=(isApiOficial?'✅ API SHOPEE OFICIAL: ':'✅ IA: ')+(dados.nome||'produto')+' • '+lojaFinal+' • 0MB';
          status.style.background='#f0fdf4';
          status.style.borderColor='#bbf7d0';
          status.style.color='#166534';
        } else {
          status.textContent='⚠️ IA pegou nome mas bloqueou imagem. Cole imagem manual. Nome: '+(dados.nome||'ok');
          status.style.background='#fef9c3';
          status.style.borderColor='#fde68a';
          status.style.color='#854d0e';
        }
        
        if(window.toast) window.toast(dados.imagem?(isApiOficial?'✅ API Oficial com imagem 0MB!':'✅ IA com imagem 0MB!'):'⚠️ Cole imagem manual');
        
        setTimeout(()=>{ if(status) status.style.display='none'; },8000);
        
      }catch(err){
        status.style.display='block';
        status.textContent='❌ Erro IA: '+err.message+' - Preenchi loja: '+detectarLojaIA(link);
        status.style.background='#fee2e2';
        status.style.borderColor='#fecaca';
        status.style.color='#991b1b';
        const elLoja=document.getElementById('f-loja');
        if(elLoja) elLoja.value=detectarLojaIA(link);
      }finally{ 
        btn.textContent='🤖 IA'; 
        btn.disabled=false;
        if(btnSalvar){ btnSalvar.textContent=txtSalvarOrig; btnSalvar.disabled=false; }
      }
    }
    
    btn.addEventListener('click',()=>{ const v=inputLink.value.trim(); if(v) scrapeComIA(v); else alert('Cole o link afiliado primeiro'); });
    inputLink.addEventListener('paste',()=>{ 
      setTimeout(()=>{ 
        const v=inputLink.value.trim(); 
        if(v&&v.startsWith('http')&&v.length>15) scrapeComIA(v); 
      },400); 
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
