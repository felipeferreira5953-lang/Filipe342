// ia-inject.js V7 FIX - corrige bug dados.debug.join
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
    if(!inputLink||document.getElementById('btn-ia-scrape-v7')) return;
    
    const wrapper=document.createElement('div');
    wrapper.style.position='relative';
    wrapper.style.marginBottom='8px';
    inputLink.parentNode.insertBefore(wrapper,inputLink);
    wrapper.appendChild(inputLink);
    inputLink.style.paddingRight='110px';
    inputLink.placeholder='Cole link CURTO do app Shopee - IA oficial';
    
    const btn=document.createElement('button');
    btn.id='btn-ia-scrape-v7';
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
    status.id='ia-status-v7';
    status.style.display='none';
    status.style.marginBottom='8px';
    status.style.fontSize='11px';
    status.style.borderRadius='10px';
    status.style.padding='8px';
    wrapper.parentNode.insertBefore(status,wrapper.nextSibling);

    function formatDebug(d){
      if(!d) return '';
      if(Array.isArray(d)) return d.join(' | ');
      if(typeof d === 'string') return d;
      try{ return JSON.stringify(d).substring(0,200); }catch(e){ return String(d).substring(0,200); }
    }

    async function scrapeComIA(urlAfiliado){
      let link=(urlAfiliado||'').trim();
      if(!link.startsWith('http')){ alert('Cole um link https://'); return; }
      const txtOrig=btn.textContent;
      const txtSalvarOrig=btnSalvar?btnSalvar.textContent:'Salvar + 🔔 Notificar todo mundo';
      try{
        btn.textContent='⏳ Oficial...'; btn.disabled=true;
        if(btnSalvar){ btnSalvar.textContent='🤖 Shopee Oficial API...'; btnSalvar.disabled=true; }
        status.style.display='block';
        status.textContent='🔗 Resolvendo link curto via API oficial Shopee...';
        status.style.background='#eff6ff';
        status.style.border='1px solid #bfdbfe';
        status.style.color='#1e40af';
        
        let dados=null;
        
        // CHAMA API OFICIAL QUE VOCÊ CONFIGUROU
        try{
          const controller=new AbortController();
          const timeout=setTimeout(()=>controller.abort(),25000);
          // Usa nova rota oficial
          const endpoint = link.includes('shopee') ? '/api/shopee-direct' : '/api/scrape';
          const r=await fetch(endpoint+'?url='+encodeURIComponent(link),{signal:controller.signal});
          clearTimeout(timeout);
          if(r.ok){ 
            dados=await r.json(); 
            console.log('Dados API oficial:', dados);
          } else {
            const txt=await r.text();
            console.log('Erro API:', txt);
            dados={ error: 'HTTP '+r.status+' '+txt.substring(0,100), debug: txt.substring(0,200) };
          }
        }catch(e){ 
          console.log('api oficial falhou',e);
          dados={ error: e.message, debug: e.message };
          // Fallback pra antiga
          try{
            const r2=await fetch('/api/scrape?url='+encodeURIComponent(link));
            if(r2.ok) dados=await r2.json();
          }catch(e2){}
        }
        
        if(!dados) dados={nome:'',imagem:'',preco:'',loja:detectarLojaIA(link),categoria:'Geral'};
        
        // Preenche campos
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
        
        if(dados.imagem && dados.nome && !dados.nome.toLowerCase().includes('shopee brasil')){
          status.textContent='✅ IA OFICIAL: '+(dados.nome||'produto').substring(0,50)+' • '+lojaFinal+' • Imagem 0MB OK • Método: '+(dados.metodo||'PDP');
          status.style.background='#f0fdf4';
          status.style.borderColor='#bbf7d0';
          status.style.color='#166534';
        } else if(dados.nome){
          status.textContent='⚠️ IA pegou nome mas Shopee bloqueou imagem. Nome: '+(dados.nome||'ok')+' - Debug: '+formatDebug(dados.debug).substring(0,150);
          status.style.background='#fef9c3';
          status.style.borderColor='#fde68a';
          status.style.color='#854d0e';
        } else {
          const debugTxt = formatDebug(dados.debug);
          status.textContent='❌ Shopee bloqueou. Erro: '+(dados.error||'desconhecido')+' - Debug: '+debugTxt.substring(0,200);
          status.style.background='#fee2e2';
          status.style.borderColor='#fecaca';
          status.style.color='#991b1b';
          status.style.border='1px solid #fecaca';
        }
        
        setTimeout(()=>{ if(status) status.style.display='none'; },15000);
        
      }catch(err){
        status.style.display='block';
        status.textContent='❌ Erro IA oficial: '+err.message;
        status.style.background='#fee2e2';
        status.style.border='1px solid #fecaca';
        status.style.color='#991b1b';
        console.error(err);
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
