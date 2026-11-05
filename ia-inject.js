// ia-inject.js V18 CERTEZA TOTAL - Shopee + ML + Amazon + Shein + TikTok
(function(){
  function setCampo(id, valor){
    const el = document.getElementById(id);
    if(!el || !valor) return false;
    if(el.tagName === 'SELECT'){
      const opts = Array.from(el.options);
      const lower = String(valor).toLowerCase();
      let found = opts.find(o => o.text.toLowerCase().includes(lower) || o.value.toLowerCase().includes(lower));
      if(found) el.value = found.value; else el.value = valor;
    } else el.value = valor;
    el.dispatchEvent(new Event('change', {bubbles:true}));
    el.dispatchEvent(new Event('input', {bubbles:true}));
    return true;
  }

  function initIA(){
    const inputLink=document.getElementById('f-link');
    if(!inputLink||document.getElementById('btn-ia-v18')) return;
    
    const wrapper=document.createElement('div');
    wrapper.style.position='relative';
    wrapper.style.marginBottom='8px';
    inputLink.parentNode.insertBefore(wrapper,inputLink);
    wrapper.appendChild(inputLink);
    inputLink.style.paddingRight='110px';
    inputLink.placeholder='Shopee, meli.la, Amazon, Shein, TikTok - auto';
    
    const btn=document.createElement('button');
    btn.id='btn-ia-v18';
    btn.type='button';
    btn.textContent='🤖 IA Certeza Total';
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
    status.id='ia-status-v18';
    status.style.display='none';
    status.style.marginBottom='8px';
    status.style.fontSize='11px';
    status.style.borderRadius='10px';
    status.style.padding='8px';
    wrapper.parentNode.insertBefore(status,wrapper.nextSibling);

    let processando = false;

    async function scrapeComIA(urlAfiliado){
      let link=(urlAfiliado||'').trim();
      if(!link.startsWith('http') || processando) return;
      processando = true;
      
      try{
        btn.textContent='⏳'; btn.disabled=true;
        status.style.display='block';
        status.textContent=`⚡ Certeza total: resolvendo e puxando API oficial...`;
        status.style.background='#eff6ff';
        status.style.border='1px solid #bfdbfe';
        status.style.color='#1e40af';
        
        const r=await fetch('/api/shopee-direct?url='+encodeURIComponent(link),{signal:AbortSignal.timeout(25000)});
        const dados=await r.json();
        
        if(!dados.ok && !dados.product){
          status.textContent=`❌ ${dados.error} - ${dados.platform||''}`;
          status.style.background='#fee2e2';
          status.style.color='#991b1b';
          return;
        }

        const p = dados.product || {};
        const nomeFinal = dados.nome || p.name || '';
        const imagemFinal = dados.imagem || p.image || '';
        const precoFinal = dados.preco || p.price || '';
        const precoAntigoFinal = dados.precoAntigo || p.priceOld || '';
        const lojaFinal = dados.loja || 'Loja';
        const categoriaFinal = dados.categoria || 'Geral';

        if(nomeFinal) setCampo('f-nome', nomeFinal);
        if(precoFinal) setCampo('f-preco', precoFinal.replace('.', ','));
        if(precoAntigoFinal) setCampo('f-preco-antigo', precoAntigoFinal.replace('.', ','));
        if(imagemFinal){
          setCampo('f-emoji', imagemFinal);
          if(window.otimizarAoColar){
            (async()=>{
              try{
                const timeout = new Promise((_,rej)=>setTimeout(()=>rej(), 12000));
                await Promise.race([window.otimizarAoColar(imagemFinal), timeout]);
              }catch(e){}
            })();
          }
        }
        setCampo('f-loja', lojaFinal);
        setCampo('f-categoria', categoriaFinal);

        status.textContent=`✅ ${lojaFinal} (${dados.metodo}) - ${dados.certeza||''}: ${nomeFinal.substring(0,60)} R$${precoFinal}`;
        status.style.background='#f0fdf4';
        status.style.borderColor='#bbf7d0';
        status.style.color='#166534';
        setTimeout(()=>{ status.style.display='none'; },10000);
        
      }catch(err){
        status.textContent='❌ Erro: '+err.message;
        status.style.background='#fee2e2';
        status.style.color='#991b1b';
      }finally{ 
        btn.textContent='🤖 IA Certeza Total'; 
        btn.disabled=false;
        processando = false;
        const b=document.getElementById('f-salvar');
        if(b){ b.disabled=false; if(b.textContent.includes('Salvando')) b.textContent='Adicionar produto + notifica todos'; }
      }
    }
    
    btn.addEventListener('click',()=>{ const v=inputLink.value.trim(); if(v) scrapeComIA(v); });
    inputLink.addEventListener('paste',()=>{ setTimeout(()=>{ const v=inputLink.value.trim(); if(v.startsWith('http')) scrapeComIA(v); },150); });
    inputLink.addEventListener('input',()=>{
      const v=inputLink.value.trim().toLowerCase();
      if((v.includes('shopee')||v.includes('meli.la')||v.includes('mercadolivre')||v.includes('amazon')||v.includes('amzn.to')||v.includes('tiktok')||v.includes('shein')||v.includes('shain')) && v.length>15){
        clearTimeout(window._iaDebounce);
        window._iaDebounce = setTimeout(()=>scrapeComIA(v),600);
      }
    });
    
    setTimeout(()=>{
      const b=document.getElementById('f-salvar');
      if(b && b.textContent.includes('Salvando')){ b.disabled=false; b.textContent='Adicionar produto + notifica todos'; }
    },1000);
  }
  
  let t=0; const iv=setInterval(()=>{ initIA(); t++; if(t>20) clearInterval(iv); },500); initIA();
})();
