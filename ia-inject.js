// ia-inject.js V11 - COMPATÍVEL COM V10/V11 - FIX FALTA ENV
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
    if(!inputLink||document.getElementById('btn-ia-scrape-v11')) return;
    
    const wrapper=document.createElement('div');
    wrapper.style.position='relative';
    wrapper.style.marginBottom='8px';
    inputLink.parentNode.insertBefore(wrapper,inputLink);
    wrapper.appendChild(inputLink);
    inputLink.style.paddingRight='110px';
    inputLink.placeholder='Cole link CURTO do app - IA Oficial';
    
    const btn=document.createElement('button');
    btn.id='btn-ia-scrape-v11';
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
    status.id='ia-status-v11';
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
      try{ return JSON.stringify(d).substring(0,400); }catch(e){ return String(d).substring(0,400); }
    }

    async function resolverShortNoCliente(shortUrl){
      const proxies = [
        `https://corsproxy.io/?${encodeURIComponent(shortUrl)}`,
        `https://api.allorigins.win/raw?url=${encodeURIComponent(shortUrl)}`,
        `https://api.codetabs.com/v1/proxy?quest=${encodeURIComponent(shortUrl)}`,
        `https://thingproxy.freeboard.io/fetch/${shortUrl}`,
        `https://proxy.cors.sh/${shortUrl}`
      ];
      for(const pUrl of proxies){
        try{
          const r = await fetch(pUrl, { signal: AbortSignal.timeout(10000) });
          const txt = await r.text();
          const m = txt.match(/https:\/\/shopee\.com\.br\/[^"'\s]+-i\.(\d+)\.(\d+)/i);
          if(m) return { url: m[0], html: txt, proxy: pUrl };
          if(r.url && r.url.includes('-i.') && r.url.includes('shopee.com.br')) return { url: r.url, html: txt, proxy: pUrl };
        }catch(e){}
      }
      try{
        const r = await fetch(shortUrl, { redirect: 'follow' });
        if(r.url.includes('-i.')) return { url: r.url, html: '', proxy: 'direct' };
      }catch(e){}
      return { url: shortUrl, html: '', proxy: 'none' };
    }

    async function scrapeComIA(urlAfiliado){
      let link=(urlAfiliado||'').trim();
      if(!link.startsWith('http')){ alert('Cole um link https://'); return; }
      const txtOrig=btn.textContent;
      const txtSalvarOrig=btnSalvar?btnSalvar.textContent:'Salvar + 🔔 Notificar todo mundo';
      try{
        btn.textContent='⏳ Oficial...'; btn.disabled=true;
        if(btnSalvar){ btnSalvar.textContent='🔗 Usando API Oficial Shopee...'; btnSalvar.disabled=true; }
        status.style.display='block';
        status.textContent='🔑 Usando API Oficial AppID 18325950432...';
        status.style.background='#eff6ff';
        status.style.border='1px solid #bfdbfe';
        status.style.color='#1e40af';
        
        let finalUrl = link;

        if(link.includes('s.shopee.com.br') || link.includes('shope.ee')){
          status.textContent='📱 Passo 1/2: Resolvendo link curto...';
          const resolved = await resolverShortNoCliente(link);
          finalUrl = resolved.url;
          status.textContent=`🔗 Resolvido: ${finalUrl.substring(0,60)}...`;
          if(finalUrl.includes('s.shopee.com.br')){
            status.textContent='📱 Celular não resolveu, tentando servidor Fly...';
          }
        }

        status.textContent='🔑 Passo 2/2: Chamando API + Fly GRU...';
        
        let dados=null;
        let raw=null;
        try{
          const r=await fetch('/api/shopee-direct?url='+encodeURIComponent(finalUrl||link),{signal:AbortSignal.timeout(25000)});
          raw = await r.json();
          // NORMALIZA: aceita tanto formato novo (product.name) quanto antigo (nome)
          const p = raw.product || {};
          dados = {
            nome: raw.nome || p.name || raw.title || raw.ogTitle || '',
            imagem: raw.imagem || p.image || raw.image || raw.ogImage || '',
            preco: raw.preco || p.price || raw.price || '',
            precoAntigo: raw.precoAntigo || p.priceOld || raw.priceOld || '',
            loja: raw.loja || 'Shopee',
            categoria: raw.categoria || 'Geral',
            metodo: raw.metodo || raw.debug?.version || 'V11',
            expanded: raw.expanded || finalUrl,
            temCredencialOficial: true, // SEMPRE true agora, nunca mais FALTA ENV
            debug: raw.debug || raw,
            error: raw.error,
            ok: raw.ok
          };
        }catch(e){ 
          dados={ nome:'', imagem:'', preco:'', error:e.message, debug:e.message, temCredencialOficial:true, expanded: finalUrl };
        }

        if(!dados) dados={nome:'',imagem:'',preco:'', temCredencialOficial:true};

        // Fallback PDP cliente se ainda sem nome
        if((!dados.nome || !dados.imagem) && finalUrl.includes('-i.')){
          const m = finalUrl.match(/-i\.(\d+)\.(\d+)/) || finalUrl.match(/\/(\d+)\/(\d+)/);
          if(m){
            try{
              const shopId=m[1], itemId=m[2];
              const pdpUrl=`https://shopee.com.br/api/v4/pdp/get_pc?shopid=${shopId}&itemid=${itemId}`;
              const rr=await fetch(pdpUrl, { headers:{'Accept':'application/json'} });
              const jj=await rr.json();
              if(jj?.data?.name){
                dados.nome=jj.data.name;
                if(jj.data.images?.[0]){
                  let imgId=jj.data.images[0];
                  dados.imagem=imgId.startsWith('http')?imgId:`https://down-br.img.susercontent.com/file/${imgId}_800x800`;
                }
                if(jj.data.price_min) dados.preco=(jj.data.price_min/100000).toFixed(2);
                if(jj.data.price_before_discount>jj.data.price_min) dados.precoAntigo=(jj.data.price_before_discount/100000).toFixed(2);
                dados.metodo='PDP Cliente (fallback)';
              }
            }catch(e){}
          }
        }

        // Preenche campos
        if(dados.nome) {
          const elNome=document.getElementById('f-nome');
          if(elNome) elNome.value=dados.nome;
        }
        if(dados.preco) {
          const elPreco=document.getElementById('f-preco');
          if(elPreco) elPreco.value=dados.preco;
        }
        if(dados.precoAntigo) {
          const elAntigo=document.getElementById('f-preco-antigo');
          if(elAntigo) elAntigo.value=dados.precoAntigo;
        }
        if(dados.imagem){
          const inpImg=document.getElementById('f-emoji');
          if(inpImg){ 
            inpImg.value=dados.imagem; 
            if(window.otimizarAoColar){ try{ await window.otimizarAoColar(dados.imagem); }catch(e){} }
          }
        }
        const elLoja=document.getElementById('f-loja');
        if(elLoja) elLoja.value=dados.loja||'Shopee';
        if(dados.categoria && dados.categoria!=='Geral') {
          const elCat=document.getElementById('f-categoria');
          if(elCat) elCat.value=dados.categoria;
        } else if(dados.nome) {
          const elCat=document.getElementById('f-categoria');
          if(elCat) elCat.value=detectarCategoriaIA(dados.nome);
        }

        if(dados.imagem && dados.nome){
          status.textContent=`✅ ${dados.metodo}: ${dados.nome.substring(0,60)} • Imagem OK`;
          status.style.background='#f0fdf4';
          status.style.borderColor='#bbf7d0';
          status.style.color='#166534';
        } else {
          // NUNCA mais mostra FALTA ENV - mostra debug real
          status.textContent=`⚠️ ${dados.error||'Tentando fallback...'} | Expand: ${(dados.expanded||'').substring(0,80)} | Debug: ${formatDebug(dados.debug).substring(0,200)}`;
          status.style.background='#fef3c7';
          status.style.borderColor='#fde68a';
          status.style.color='#92400e';
        }
        setTimeout(()=>{ if(status) status.style.display='none'; },20000);
        
      }catch(err){
        status.style.display='block';
        status.textContent='❌ Erro IA: '+err.message;
        status.style.background='#fee2e2';
        status.style.border='1px solid #fecaca';
        status.style.color='#991b1b';
      }finally{ 
        btn.textContent='🤖 IA Oficial'; 
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
