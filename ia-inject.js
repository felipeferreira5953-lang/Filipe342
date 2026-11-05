// ia-inject.js V12 - AUTOMATICO RAPIDO + PRECO CORRETO
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
    if(!inputLink||document.getElementById('btn-ia-scrape-v12')) return;
    
    const wrapper=document.createElement('div');
    wrapper.style.position='relative';
    wrapper.style.marginBottom='8px';
    inputLink.parentNode.insertBefore(wrapper,inputLink);
    wrapper.appendChild(inputLink);
    inputLink.style.paddingRight='110px';
    inputLink.placeholder='Cole link - auto IA';
    
    const btn=document.createElement('button');
    btn.id='btn-ia-scrape-v12';
    btn.type='button';
    btn.textContent='🤖 IA Oficial';
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
    status.id='ia-status-v12';
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
      if(!link.startsWith('http')){ return; }
      if(processando) return;
      if(link === ultimoLinkProcessado) return;
      
      processando = true;
      ultimoLinkProcessado = link;
      
      const txtOrig=btn.textContent;
      try{
        btn.textContent='⏳'; btn.disabled=true;
        if(btnSalvar){ btnSalvar.disabled=true; }
        status.style.display='block';
        status.textContent='⚡ Puxando do Fly GRU...';
        status.style.background='#eff6ff';
        status.style.border='1px solid #bfdbfe';
        status.style.color='#1e40af';
        
        let dados=null;
        try{
          // DIRETO pro seu robô Fly - sem 5 proxies lentos no celular
          const r=await fetch('/api/shopee-direct?url='+encodeURIComponent(link),{signal:AbortSignal.timeout(15000)});
          dados=await r.json();
        }catch(e){ 
          dados={ nome:'', imagem:'', preco:'', error:e.message, expanded: link };
        }

        const p = dados.product || {};
        const nomeFinal = dados.nome || p.name || '';
        const imagemFinal = dados.imagem || p.image || '';
        const precoFinal = dados.preco || p.price || '';
        const precoAntigoFinal = dados.precoAntigo || p.priceOld || '';

        if(nomeFinal) {
          const elNome=document.getElementById('f-nome');
          if(elNome) elNome.value=nomeFinal;
        }
        if(precoFinal) {
          const elPreco=document.getElementById('f-preco');
          if(elPreco) {
            // Converte 14.00 -> 14,00 se precisar
            elPreco.value=precoFinal.replace('.', ',');
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
            if(window.otimizarAoColar){ try{ await window.otimizarAoColar(imagemFinal); }catch(e){} }
          }
        }
        const elLoja=document.getElementById('f-loja');
        if(elLoja) elLoja.value='Shopee';
        if(nomeFinal) {
          const elCat=document.getElementById('f-categoria');
          if(elCat) elCat.value=detectarCategoriaIA(nomeFinal);
        }

        if(imagemFinal && nomeFinal){
          status.textContent=`✅ ${dados.metodo||'V12'}: ${nomeFinal.substring(0,60)}`;
          status.style.background='#f0fdf4';
          status.style.borderColor='#bbf7d0';
          status.style.color='#166534';
          setTimeout(()=>{ if(status) status.style.display='none'; },5000);
        } else {
          status.textContent=`⚠️ Não achou imagem/nome, tente outro link`;
          status.style.background='#fef3c7';
          status.style.borderColor='#fde68a';
          status.style.color='#92400e';
          ultimoLinkProcessado = ''; // permite tentar de novo
        }
        
      }catch(err){
        status.style.display='block';
        status.textContent='❌ Erro: '+err.message;
        status.style.background='#fee2e2';
        status.style.border='1px solid #fecaca';
        status.style.color='#991b1b';
        ultimoLinkProcessado = '';
      }finally{ 
        btn.textContent='🤖 IA Oficial'; 
        btn.disabled=false;
        processando = false;
        if(btnSalvar){ btnSalvar.disabled=false; }
      }
    }
    
    // Clique manual
    btn.addEventListener('click',()=>{ 
      const v=inputLink.value.trim(); 
      ultimoLinkProcessado=''; // força reprocessar no clique
      if(v) scrapeComIA(v); 
      else alert('Cole o link primeiro'); 
    });

    // AUTOMATICO: ao colar, já dispara em 100ms (era 600ms)
    inputLink.addEventListener('paste',()=>{ 
      setTimeout(()=>{ 
        const v=inputLink.value.trim(); 
        if(v&&v.startsWith('http')&&v.length>10) {
          ultimoLinkProcessado='';
          scrapeComIA(v);
        }
      },100); 
    });

    // AUTOMATICO: ao digitar/colar e sair do campo
    inputLink.addEventListener('input',()=>{
      const v=inputLink.value.trim();
      if(v.startsWith('https://s.shopee.com.br/') && v.length>25){
        // Se é link curto completo, já dispara
        clearTimeout(window._iaDebounce);
        window._iaDebounce = setTimeout(()=>{
          if(v !== ultimoLinkProcessado){
            scrapeComIA(v);
          }
        },400);
      }
    });
    
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
