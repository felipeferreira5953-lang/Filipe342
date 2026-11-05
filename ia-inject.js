// ia-inject.js V23 FINAL para index_7.html - NÃO muda super leve, só preenche e dispara seu compressor original
(function(){
  const API = '/api/shopee-direct';

  function getEl(id){ return document.getElementById(id); }

  function ensureIAButton(){
    if(document.getElementById('btn-ia-auto')) return;
    const linkInput = getEl('f-link');
    if(!linkInput) return;
    
    const btn = document.createElement('button');
    btn.id = 'btn-ia-auto';
    btn.type = 'button';
    btn.innerHTML = '🤖 Gerar com IA Automático';
    btn.style.cssText = 'width:100%;margin:8px 0;padding:12px;background:linear-gradient(90deg,#8a2be2,#ff6a00);color:#fff;border:none;border-radius:12px;font-weight:bold;font-size:14px;cursor:pointer;';
    
    linkInput.parentNode.insertBefore(btn, linkInput.nextSibling);
    btn.addEventListener('click', gerarIA);
    
    // Auto ao colar link Shopee
    linkInput.addEventListener('paste', ()=> setTimeout(gerarIA, 700));
  }

  async function gerarIA(){
    const linkInput = getEl('f-link');
    const btn = getEl('btn-ia-auto');
    if(!linkInput || !linkInput.value.trim()){
      alert('Cole o link Shopee/ML/Amazon primeiro no campo Link afiliado');
      return;
    }
    const url = linkInput.value.trim();
    if(btn){ btn.disabled=true; btn.innerHTML='⏳ Resolvendo com resolve-js.js + API...'; }

    try{
      const res = await fetch(`${API}?url=${encodeURIComponent(url)}`);
      const data = await res.json();
      if(!data.ok) throw new Error(data.error||'Falha API');

      // Preenche campos do seu index_7.html sem mexer no super leve
      const nomeEl = getEl('f-nome');
      const precoEl = getEl('f-preco');
      const precoAntigoEl = getEl('f-preco-antigo');
      const imgEl = getEl('f-emoji');
      const lojaEl = getEl('f-loja');
      const catEl = getEl('f-categoria');

      if(nomeEl){ nomeEl.value = (data.nome||data.product?.name||'').substring(0,120); nomeEl.dispatchEvent(new Event('input',{bubbles:true})); }
      if(precoEl){ precoEl.value = data.preco||data.product?.price||''; precoEl.dispatchEvent(new Event('input',{bubbles:true})); }
      if(precoAntigoEl){ precoAntigoEl.value = data.precoAntigo||data.product?.priceOld||''; precoAntigoEl.dispatchEvent(new Event('input',{bubbles:true})); }
      
      // IMPORTANTE: preenche imagem e DISPARA seu otimizarAoColar original que faz webp 600px ~40KB + Storage
      if(imgEl){
        imgEl.value = data.imagem||data.product?.image||'';
        imgEl.dispatchEvent(new Event('input',{bubbles:true}));
        imgEl.dispatchEvent(new Event('change',{bubbles:true}));
        imgEl.dispatchEvent(new Event('paste',{bubbles:true}));
        // Força seu compressor que já existe no index
        if(window.otimizarAoColar) window.otimizarAoColar = window.otimizarAoColar; // mantém original
        // Dispara manualmente o evento que seu index escuta
        setTimeout(()=>{
          const event = new Event('input', {bubbles:true});
          imgEl.dispatchEvent(event);
          if(typeof otimizarAoColar === 'function'){
            try{ otimizarAoColar(imgEl.value); }catch(e){}
          }
          // Fallback: chama direto se tiver função global
          if(window._otimizar) window._otimizar(imgEl.value);
        }, 200);
      }

      if(lojaEl){
        const loja = data.loja||'';
        const opt = Array.from(lojaEl.options).find(o=> o.text.toLowerCase().includes(loja.toLowerCase().substring(0,4)));
        if(opt) lojaEl.value = opt.value;
      }
      if(catEl && data.categoria){
        const opt2 = Array.from(catEl.options).find(o=> o.text.toLowerCase().includes(data.categoria.toLowerCase().substring(0,4)));
        if(opt2) catEl.value = opt2.value;
      }

      if(btn) btn.innerHTML = `✅ ${data.loja} • R$ ${data.preco} • ${data.metodo?.substring(0,30)}`;
      setTimeout(()=>{ if(btn){ btn.innerHTML='🤖 Gerar com IA Automático'; btn.disabled=false; } }, 3000);

    }catch(e){
      console.error(e);
      if(btn){ btn.innerHTML='❌ '+e.message; btn.disabled=false; }
      setTimeout(()=>{ if(btn) btn.innerHTML='🤖 Gerar com IA Automático'; }, 3000);
      alert('Erro IA: '+e.message);
    }
  }

  // Mantém super leve original intacto, só injeta botão
  const obs = new MutationObserver(()=> ensureIAButton());
  document.addEventListener('DOMContentLoaded', ()=>{
    ensureIAButton();
    obs.observe(document.body, {childList:true, subtree:true});
    setInterval(ensureIAButton, 2000);
  });
  setTimeout(()=>{ ensureIAButton(); obs.observe(document.body, {childList:true, subtree:true}); }, 1000);
  window.gerarIA = gerarIA;
})();
