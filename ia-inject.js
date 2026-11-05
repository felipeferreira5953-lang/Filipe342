// ia-inject.js V20 ULTRA 3/3 - Anti corrida de foto + 0% margem + usa resolve-js.js no backend
(function(){
  const API = '/api/shopee-direct';
  let currentAbort = null;
  let lastUrl = '';

  function $(id){ return document.getElementById(id); }
  function showStatus(msg, type='info'){
    let el = $('ia-status');
    if(!el){
      el = document.createElement('div');
      el.id = 'ia-status';
      el.style.cssText = 'margin:12px 0;padding:10px;border-radius:8px;font-size:13px;';
      const container = $('resultado') || document.body;
      container.parentNode.insertBefore(el, container);
    }
    el.textContent = msg;
    el.style.background = type==='error'?'#fee':type==='success'?'#efe':'#eef';
    el.style.display = 'block';
  }

  async function gerar(){
    const input = $('link-produto') || $('shopee-link') || document.querySelector('input[type="text"]');
    const btn = $('btn-gerar') || $('gerar-btn') || document.querySelector('button');
    const resultado = $('resultado');
    const previewImg = $('preview-imagem') || $('imagem-preview');
    const previewNome = $('preview-nome') || $('nome-preview');
    const previewPreco = $('preview-preco') || $('preco-preview');

    const url = (input?.value || '').trim();
    if(!url){ showStatus('Cole o link Shopee/ML/Amazon/Shein/TikTok', 'error'); return; }
    if(url === lastUrl && resultado && resultado.style.display !== 'none'){
      showStatus('Link já gerado', 'info');
      return;
    }

    lastUrl = url;
    
    if(currentAbort) currentAbort.abort();
    currentAbort = new AbortController();

    if(btn){ btn.disabled = true; btn.textContent = 'Gerando...'; }
    
    // LIMPA TUDO antes - anti corrida
    if(resultado){
      resultado.style.display = 'none';
      resultado.innerHTML = '';
    }
    if(previewImg){ previewImg.src = ''; previewImg.style.display = 'none'; }
    if(previewNome) previewNome.textContent = '';
    if(previewPreco) previewPreco.textContent = '';
    
    showStatus('Resolvendo link com resolve-js.js + API oficial...', 'info');

    try{
      const res = await fetch(`${API}?url=${encodeURIComponent(url)}`, { signal: currentAbort.signal });
      const data = await res.json();
      
      if(!data.ok){
        throw new Error(data.error || 'Não conseguiu resolver');
      }

      showStatus(`✅ ${data.metodo} | Certeza: ${data.certeza}`, 'success');

      const produto = data.product || { name: data.nome, image: data.imagem, price: data.preco, priceOld: data.precoAntigo };
      
      // Preenche campos se existirem
      if($('nome-produto')) $('nome-produto').value = produto.name || '';
      if($('preco-produto')) $('preco-produto').value = produto.price || '';
      if($('preco-antigo')) $('preco-antigo').value = produto.priceOld || '';
      if($('imagem-produto')) $('imagem-produto').value = produto.image || '';
      if($('link-afiliado')) $('link-afiliado').value = data.affiliateLink || url;
      if($('categoria')) $('categoria').value = data.categoria || 'Geral';
      if($('loja')) $('loja').value = data.loja || '';

      // Preview anti corrida - só mostra se for do URL atual
      if(previewImg && produto.image){
        previewImg.src = produto.image;
        previewImg.style.display = 'block';
        previewImg.onerror = () => { previewImg.style.display = 'none'; };
      }
      if(previewNome) previewNome.textContent = produto.name || '';
      if(previewPreco) previewPreco.textContent = produto.price ? `R$ ${produto.price}` : '';

      if(resultado){
        resultado.style.display = 'block';
        resultado.innerHTML = `
          <div style="border:1px solid #ddd;border-radius:12px;padding:12px;display:flex;gap:12px;align-items:center">
            <img src="${produto.image}" style="width:80px;height:80px;object-fit:cover;border-radius:8px" onerror="this.style.display='none'">
            <div style="flex:1">
              <div style="font-weight:bold;font-size:14px;line-height:1.2">${produto.name||''}</div>
              <div style="color:#e63946;font-weight:bold;margin-top:4px">R$ ${produto.price||''} <span style="text-decoration:line-through;color:#888;font-weight:normal;font-size:12px">R$ ${produto.priceOld||''}</span></div>
              <div style="font-size:11px;color:#555;margin-top:4px">${data.loja} • ${data.categoria} • ${data.metodo}</div>
            </div>
          </div>
        `;
      }

      // Auto copy prompt ou legenda se tiver
      if(window.gerarLegenda) window.gerarLegenda(data);
      
    }catch(e){
      if(e.name === 'AbortError') return;
      showStatus('Erro: '+e.message, 'error');
      console.error(e);
    }finally{
      if(btn){ btn.disabled = false; btn.textContent = 'Gerar Achadinho'; }
      currentAbort = null;
    }
  }

  // Liga botão
  document.addEventListener('DOMContentLoaded', ()=>{
    const btn = $('btn-gerar') || $('gerar-btn') || document.querySelector('#gerar');
    if(btn) btn.addEventListener('click', gerar);
    const input = $('link-produto') || $('shopee-link');
    if(input) input.addEventListener('keydown', (e)=>{ if(e.key==='Enter') gerar(); });
  });

  window.gerarAchadinho = gerar;
})();
