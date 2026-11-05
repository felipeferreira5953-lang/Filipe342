// ia-inject.js V20 FIX BOTÃO - Recria botão IA no layout exato do print + usa api/resolve-js.js
(function(){
  const API = '/api/shopee-direct';
  let abortCtrl = null;

  function getInputs(){
    const all = Array.from(document.querySelectorAll('input'));
    const nome = all.find(i => i.placeholder?.toLowerCase().includes('nome')) || all[0];
    const preco = all.find(i => i.placeholder === 'Preço' || i.placeholder?.toLowerCase() === 'preço') || all[1];
    const precoAntigo = all.find(i => i.placeholder?.toLowerCase().includes('antigo')) || all[2];
    const img = all.find(i => i.placeholder?.toLowerCase().includes('imagem')) || all[3];
    // Link é o que tem s.shopee.com.br ou o 5º input
    let link = all.find(i => /s\.shopee|shope\.ee|mercadolivre|amzn\.to|shein|tiktok|meli\.la/i.test(i.value)) || all[4] || all[all.length-1];
    return { all, nome, preco, precoAntigo, img, link };
  }

  function ensureButton(){
    if(document.getElementById('btn-ia-auto')) return;
    const { link } = getInputs();
    if(!link) return;

    const btn = document.createElement('button');
    btn.id = 'btn-ia-auto';
    btn.type = 'button';
    btn.innerHTML = '🤖 Gerar com IA Automático';
    btn.style.cssText = 'width:100%;margin:8px 0 12px 0;padding:12px;background:linear-gradient(90deg,#8a2be2,#ff6a00);color:#fff;border:none;border-radius:10px;font-weight:bold;font-size:14px;cursor:pointer;box-shadow:0 4px 12px rgba(0,0,0,0.15)';
    
    // Insere logo depois do input do link
    link.parentNode.insertBefore(btn, link.nextSibling);
    
    btn.addEventListener('click', gerar);
    
    // Auto-gera ao colar link
    link.addEventListener('paste', ()=>{
      setTimeout(()=>gerar(), 600);
    });
    link.addEventListener('change', ()=>{
      if(link.value.trim().length > 15) gerar();
    });

    console.log('[IA] Botão recriado no layout ADM');
  }

  async function gerar(){
    const { nome, preco, precoAntigo, img, link } = getInputs();
    const btn = document.getElementById('btn-ia-auto');
    if(!link || !link.value.trim()){ alert('Cole o link Shopee primeiro'); return; }

    const url = link.value.trim();
    
    if(abortCtrl) abortCtrl.abort();
    abortCtrl = new AbortController();

    if(btn){ btn.disabled=true; btn.innerHTML='⏳ Resolvendo com resolve-js.js + API...'; }

    // Anti corrida: limpa só se for novo
    try{
      const res = await fetch(`${API}?url=${encodeURIComponent(url)}`, { signal: abortCtrl.signal });
      const data = await res.json();
      if(!data.ok) throw new Error(data.error || 'Falha');

      const p = data.product || data;
      const nomeFinal = p.name || p.nome || data.nome || '';
      const precoFinal = p.price || p.preco || data.preco || '';
      const precoAntigoFinal = p.priceOld || p.precoAntigo || data.precoAntigo || (precoFinal? (Number(precoFinal)*1.35).toFixed(2) : '');
      const imgFinal = p.image || p.imagem || data.imagem || '';

      if(nome) { nome.value = nomeFinal.substring(0,120); nome.dispatchEvent(new Event('input',{bubbles:true})); }
      if(preco) { preco.value = precoFinal; preco.dispatchEvent(new Event('input',{bubbles:true})); }
      if(precoAntigo) { precoAntigo.value = precoAntigoFinal; precoAntigo.dispatchEvent(new Event('input',{bubbles:true})); }
      if(img) { img.value = imgFinal; img.dispatchEvent(new Event('input',{bubbles:true})); img.dispatchEvent(new Event('change',{bubbles:true})); }

      // Tenta achar selects e preencher
      const selects = Array.from(document.querySelectorAll('select'));
      if(data.categoria && selects[0]){ 
        const opt = Array.from(selects[0].options).find(o=> o.text.toLowerCase().includes((data.categoria||'').toLowerCase().substring(0,4)));
        if(opt) selects[0].value = opt.value;
      }
      if(data.loja && selects[1]){
        const opt2 = Array.from(selects[1].options).find(o=> o.text.toLowerCase().includes((data.loja||'').toLowerCase().substring(0,4)));
        if(opt2) selects[1].value = opt2.value;
      }

      if(btn) btn.innerHTML = `✅ ${data.loja} • R$ ${precoFinal} • ${data.metodo?.substring(0,30)||''}`;
      setTimeout(()=>{ if(btn) btn.innerHTML='🤖 Gerar com IA Automático'; btn.disabled=false; }, 3000);

    }catch(e){
      if(e.name==='AbortError') return;
      console.error(e);
      if(btn){ btn.innerHTML='❌ Erro: '+e.message; btn.disabled=false; }
      alert('Erro IA: '+e.message);
    }
  }

  // Observa DOM pra recriar se React limpar
  const observer = new MutationObserver(()=> ensureButton());
  document.addEventListener('DOMContentLoaded', ()=>{
    ensureButton();
    observer.observe(document.body, { childList:true, subtree:true });
    setInterval(ensureButton, 2000);
  });
  // Se já carregou
  setTimeout(()=>{ ensureButton(); observer.observe(document.body, { childList:true, subtree:true }); }, 1000);

  window.gerarIA = gerar;
})();
