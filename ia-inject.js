// ia-inject.js V14 UNIVERSAL - Shopee + ML + Amazon + TikTok + Shein + NAO TRAVA
(function(){
  function detectarCategoriaIA(nome){
    const n=(nome||'').toLowerCase();
    if(/vestido|saia|bolsa|salto|sandália|lingerie|sutiã|cropped|blusa fem|shein|moda/.test(n)){
      if(n.includes('bolsa')) return 'Bolsas';
      if(n.includes('salto')||n.includes('sandália')) return 'Calçados Femininos';
      if(n.includes('lingerie')||n.includes('sutiã')) return 'Lingerie';
      return 'Moda Feminina';
    }
    if(/camiseta|bermuda|tênis|tenis|boné|bone|camisa|moletom|masculin|utensílio|cozinha|panela|kit/.test(n)) return 'Casa e Cozinha';
    if(/celular|fone|eletrônico|smartphone|caixa de som|carregador/.test(n)) return 'Eletrônicos';
    if(/maquiagem|beleza|perfume|skincare/.test(n)) return 'Beleza';
    return 'Geral';
  }

  function detectarLoja(url){
    const u=(url||'').toLowerCase();
    if(u.includes('shopee')) return 'Shopee';
    if(u.includes('mercadolivre')||u.includes('mercadolibre')) return 'Mercado Livre';
    if(u.includes('amazon')) return 'Amazon';
    if(u.includes('tiktok')) return 'TikTok Shop';
    if(u.includes('shein')) return 'Shein';
    return 'Loja';
  }

  function initIA(){
    const inputLink=document.getElementById('f-link');
    if(!inputLink||document.getElementById('btn-ia-universal-v14')) return;
    
    const wrapper=document.createElement('div');
    wrapper.style.position='relative';
    wrapper.style.marginBottom='8px';
    inputLink.parentNode.insertBefore(wrapper,inputLink);
    wrapper.appendChild(inputLink);
    inputLink.style.paddingRight='110px';
    inputLink.placeholder='Cole link Shopee/ML/Amazon/TikTok/Shein';
    
    const btn=document.createElement('button');
    btn.id='btn-ia-universal-v14';
    btn.type='button';
    btn.textContent='🤖 IA Universal';
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
    status.id='ia-status-v14';
    status.style.display='none';
    status.style.marginBottom='8px';
    status.style.fontSize='11px';
    status.style.borderRadius='10px';
    status.style.padding='8px';
    wrapper.parentNode.insertBefore(status,wrapper.nextSibling);

    let ultimoLinkProcessado = '';
    let processando = false;

    async function scrapeComIA(urlAfiliado){
      let link=(urlAfiliado||'').trim();
      if(!link.startsWith('http')) return;
      if(processando) return;
      if(link === ultimoLinkProcessado && link.length>10) {
        const st = document.getElementById('ia-status-v14');
        if(st && st.textContent.includes('Puxando') && Date.now() - window._lastIA > 15000){
          ultimoLinkProcessado = '';
        } else {
          return;
        }
      }
      
      processando = true;
      ultimoLinkProcessado = link;
      window._lastIA = Date.now();
      
      const txtOrig=btn.textContent;
      try{
        btn.textContent='⏳'; btn.disabled=true;
        status.style.display='block';
        const loja = detectarLoja(link);
        status.textContent=`⚡ Puxando ${loja} via Fly...`;
        status.style.background='#eff6ff';
        status.style.border='1px solid #bfdbfe';
        status.style.color='#1e40af';
        
        let dados=null;
        try{
          const r=await fetch('/api/shopee-direct?url='+encodeURIComponent(link),{signal:AbortSignal.timeout(15000)});
          dados=await r.json();
        }catch(e){ 
          dados={ nome:'', imagem:'', preco:'', error:e.message };
        }

        const p = dados.product || {};
        const nomeFinal = dados.nome || p.name || '';
        const imagemFinal = dados.imagem || p.image || '';
        const precoFinal = dados.preco || p.price || '';
        const precoAntigoFinal = dados.precoAntigo || p.priceOld || '';
        const lojaFinal = dados.loja || loja;

        if(nomeFinal) {
          const elNome=document.getElementById('f-nome');
          if(elNome) elNome.value=nomeFinal;
        }
        if(precoFinal) {
          const elPreco=document.getElementById('f-preco');
          if(elPreco) elPreco.value=precoFinal.replace('.', ',');
        } else {
          const elPreco=document.getElementById('f-preco');
          if(elPreco && !elPreco.value) {
            elPreco.placeholder='Digite preço manual';
          }
        }
        if(precoAntigoFinal) {
          const elAntigo=document.getElementById('f-preco-antigo');
          if(elAntigo) elAntigo.value=precoAntigoFinal.replace('.', ',');
        }
        if(imagemFinal){
          const inpImg=document.getElementById('f-emoji');
          if(inpImg){ 
            inpImg.value=imagemFinal;
            if(window.otimizarAoColar){
              try{
                const timeout = new Promise((_,rej)=>setTimeout(()=>rej(new Error('timeout')), 8000));
                Promise.race([window.otimizarAoColar(imagemFinal), timeout]).catch(()=>{});
              }catch(e){}
            }
          }
        }
        const elLoja=document.getElementById('f-loja');
        if(elLoja) elLoja.value=lojaFinal;
        if(nomeFinal) {
          const elCat=document.getElementById('f-categoria');
          if(elCat) elCat.value=detectarCategoriaIA(nomeFinal);
        }

        if(imagemFinal && nomeFinal){
          status.textContent=`✅ ${dados.metodo||lojaFinal}: ${nomeFinal.substring(0,60)} ${precoFinal?' - R$'+precoFinal:''}`;
          status.style.background='#f0fdf4';
          status.style.borderColor='#bbf7d0';
          status.style.color='#166534';
          setTimeout(()=>{ if(status) status.style.display='none'; },6000);
        } else {
          status.textContent=`⚠️ ${lojaFinal}: ${nomeFinal.substring(0,50)} - verifique preço`;
          status.style.background='#fef3c7';
          status.style.borderColor='#fde68a';
          status.style.color='#92400e';
          setTimeout(()=>{ if(status) status.style.display='none'; },6000);
          ultimoLinkProcessado = '';
        }
        
      }catch(err){
        status.style.display='block';
        status.textContent='❌ Erro: '+err.message;
        status.style.background='#fee2e2';
        status.style.border='1px solid #fecaca';
        status.style.color='#991b1b';
        ultimoLinkProcessado = '';
        setTimeout(()=>{ if(status) status.style.display='none'; },6000);
      }finally{ 
        btn.textContent='🤖 IA Universal'; 
        btn.disabled=false;
        processando = false;
        const btnSalvar2=document.getElementById('f-salvar');
        if(btnSalvar2){
          btnSalvar2.disabled=false;
          if(btnSalvar2.textContent.includes('Salvando')) btnSalvar2.textContent='Adicionar produto + notifica todos';
        }
      }
    }
    
    btn.addEventListener('click',()=>{ 
      const v=inputLink.value.trim(); 
      ultimoLinkProcessado='';
      if(v) scrapeComIA(v); 
      else alert('Cole o link primeiro'); 
    });

    inputLink.addEventListener('paste',()=>{ 
      setTimeout(()=>{ 
        const v=inputLink.value.trim(); 
        if(v&&v.startsWith('http')&&v.length>10) {
          ultimoLinkProcessado='';
          scrapeComIA(v);
        }
      },100); 
    });

    inputLink.addEventListener('input',()=>{
      const v=inputLink.value.trim();
      if((v.startsWith('https://s.shopee')||v.includes('mercadolivre')||v.includes('amazon')||v.includes('tiktok')||v.includes('shein')) && v.length>25){
        clearTimeout(window._iaDebounce);
        window._iaDebounce = setTimeout(()=>{
          if(v !== ultimoLinkProcessado) scrapeComIA(v);
        },400);
      }
    });
    
    setTimeout(()=>{
      const b=document.getElementById('f-salvar');
      if(b && b.textContent.includes('Salvando')){
        b.disabled=false;
        b.textContent='Adicionar produto + notifica todos';
      }
    },2000);

    window.scrapeComIA=scrapeComIA;
  }
  
  let tentativas=0;
  const iv=setInterval(()=>{
    initIA();
    tentativas++;
    if(tentativas>20) clearInterval(iv);
  },500);
  initIA();
})();
