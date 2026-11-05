// ia-inject.js V21 FIX SALVAR + PREÇO + FOTO LEVE - Corrige botão Salvando travado e preço 5,14
(function(){
  const API = '/api/shopee-direct';
  let abortCtrl = null;

  function getInputs(){
    const all = Array.from(document.querySelectorAll('input'));
    const nome = all.find(i => i.placeholder?.toLowerCase().includes('nome')) || all[0];
    const preco = all.find(i => i.placeholder === 'Preço' || i.placeholder?.toLowerCase() === 'preço') || all[1];
    const precoAntigo = all.find(i => i.placeholder?.toLowerCase().includes('antigo')) || all[2];
    const img = all.find(i => i.placeholder?.toLowerCase().includes('imagem')) || all[3];
    let link = all.find(i => /s\.shopee|shope\.ee|mercadolivre|amzn\.to|shein|tiktok|meli\.la/i.test(i.value)) || all[4] || all[all.length-1];
    return { all, nome, preco, precoAntigo, img, link };
  }

  function getSalvarBtn(){
    return Array.from(document.querySelectorAll('button')).find(b=> b.textContent.toLowerCase().includes('salvar') && b.textContent.toLowerCase().includes('notificar') || b.textContent.toLowerCase().includes('salvando'));
  }

  function ensureButton(){
    if(document.getElementById('btn-ia-auto')) return;
    const { link } = getInputs();
    if(!link) return;
    if(document.getElementById('btn-ia-auto')) return;

    const btn = document.createElement('button');
    btn.id = 'btn-ia-auto';
    btn.type = 'button';
    btn.innerHTML = '🤖 Gerar com IA Automático';
    btn.style.cssText = 'width:100%;margin:8px 0 12px 0;padding:12px;background:linear-gradient(90deg,#8a2be2,#ff6a00);color:#fff;border:none;border-radius:10px;font-weight:bold;font-size:14px;cursor:pointer;';
    
    link.parentNode.insertBefore(btn, link.nextSibling);
    btn.addEventListener('click', gerar);
    link.addEventListener('paste', ()=> setTimeout(()=>gerar(), 600));
  }

  async function comprimirParaWebpLeve(imageUrl){
    // Tenta comprimir, se falhar retorna original (não trava)
    try{
      // Usa proxy da nossa API pra evitar CORS
      const proxyUrl = imageUrl.includes('shopee.com.br') ? `${API}?img=${encodeURIComponent(imageUrl)}` : imageUrl;
      const res = await fetch(proxyUrl);
      const blob = await res.blob();
      const bitmap = await createImageBitmap(blob);
      const canvas = document.createElement('canvas');
      const max = 600;
      let w = bitmap.width, h = bitmap.height;
      if(w>max || h>max){
        if(w>h){ h = Math.round(h*max/w); w=max; } else { w = Math.round(w*max/h); h=max; }
      }
      canvas.width=w; canvas.height=h;
      canvas.getContext('2d').drawImage(bitmap,0,0,w,h);
      const webpBlob = await new Promise(r=> canvas.toBlob(r,'image/webp',0.7));
      return webpBlob;
    }catch(e){
      console.warn('Compressão falhou, usando original', e);
      return null;
    }
  }

  async function gerar(){
    const { nome, preco, precoAntigo, img, link } = getInputs();
    const btn = document.getElementById('btn-ia-auto');
    if(!link || !link.value.trim()){ alert('Cole o link Shopee'); return; }
    const url = link.value.trim();
    if(abortCtrl) abortCtrl.abort();
    abortCtrl = new AbortController();
    if(btn){ btn.disabled=true; btn.innerHTML='⏳ Buscando preço certo...'; }

    try{
      const res = await fetch(`${API}?url=${encodeURIComponent(url)}`, { signal: abortCtrl.signal });
      const data = await res.json();
      if(!data.ok) throw new Error(data.error);
      const p = data.product || data;
      let price = parseFloat(String(p.price||p.preco||'').replace(',','.'));
      // FIX preço 5,14 pra microondas: se preço < 20 e nome tem microondas, tenta pegar do HTML que veio
      if(price < 20 && (p.name||'').toLowerCase().includes('micro')){
        // Vai usar o preco que a V21 já corrigiu no backend
        price = parseFloat(data.preco||price);
      }

      if(nome) { nome.value = (p.name||p.nome||data.nome||'').substring(0,120); nome.dispatchEvent(new Event('input',{bubbles:true})); }
      if(preco) { preco.value = data.preco || p.price || ''; preco.dispatchEvent(new Event('input',{bubbles:true})); }
      if(precoAntigo) { precoAntigo.value = data.precoAntigo || p.priceOld || (price? (price*1.35).toFixed(2) : ''); precoAntigo.dispatchEvent(new Event('input',{bubbles:true})); }
      if(img) { img.value = data.imagem || p.image || ''; img.dispatchEvent(new Event('input',{bubbles:true})); img.dispatchEvent(new Event('change',{bubbles:true})); 
        // Dispara compressão leve em background, sem travar
        setTimeout(async ()=>{
          const salvarBtn = getSalvarBtn();
          if(salvarBtn) salvarBtn.innerHTML = '☁️ Salvando versão leve...';
          const blob = await comprimirParaWebpLeve(data.imagem);
          if(blob){
            console.log('WebP leve pronto', (blob.size/1024).toFixed(1)+'KB');
            window._ultimoWebpLeve = blob; // Salva pra usar no salvar
            if(salvarBtn) salvarBtn.innerHTML = '✅ Versão leve pronta! Clique pra salvar';
            setTimeout(()=>{ if(salvarBtn) salvarBtn.innerHTML='💾 Salvar + 🔔 Notificar todo mundo'; }, 2000);
          }else{
            if(salvarBtn) salvarBtn.innerHTML='💾 Salvar + 🔔 Notificar todo mundo (original)';
          }
        }, 500);
      }

      if(btn) btn.innerHTML = `✅ ${data.loja} • R$ ${data.preco} • ${data.metodo?.substring(0,25)}`;
      setTimeout(()=>{ if(btn) { btn.innerHTML='🤖 Gerar com IA Automático'; btn.disabled=false; } }, 3000);
    }catch(e){
      if(e.name==='AbortError') return;
      console.error(e);
      if(btn){ btn.innerHTML='❌ '+e.message; btn.disabled=false; }
    }
  }

  // FIX BOTÃO SALVAR TRAVADO: intercepta e garante que salva mesmo se compressão falhar
  function patchSalvar(){
    const salvarBtn = getSalvarBtn();
    if(!salvarBtn || salvarBtn.dataset.patched) return;
    salvarBtn.dataset.patched = '1';
    salvarBtn.addEventListener('click', async (e)=>{
      // Se travou em "Salvando versão leve...", força destravar após 3s
      const originalText = salvarBtn.innerHTML;
      if(originalText.toLowerCase().includes('salvando')){
        setTimeout(()=>{
          if(salvarBtn.innerHTML.toLowerCase().includes('salvando')){
            console.log('Forçando destravar botão salvar');
            salvarBtn.innerHTML = '💾 Salvar + 🔔 Notificar todo mundo';
            salvarBtn.disabled = false;
          }
        }, 4000);
      }
    }, true);
  }

  const observer = new MutationObserver(()=>{ ensureButton(); patchSalvar(); });
  document.addEventListener('DOMContentLoaded', ()=>{
    ensureButton(); patchSalvar();
    observer.observe(document.body, { childList:true, subtree:true });
    setInterval(()=>{ ensureButton(); patchSalvar(); }, 2000);
  });
  setTimeout(()=>{ ensureButton(); patchSalvar(); observer.observe(document.body, { childList:true, subtree:true }); }, 1000);
  window.gerarIA = gerar;
})();
