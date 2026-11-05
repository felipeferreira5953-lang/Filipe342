// ia-inject.js V9 - OFICIAL + CLIENTE - resolve s.shopee no celular e usa API oficial no servidor
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
    if(!inputLink||document.getElementById('btn-ia-scrape-v9')) return;
    
    const wrapper=document.createElement('div');
    wrapper.style.position='relative';
    wrapper.style.marginBottom='8px';
    inputLink.parentNode.insertBefore(wrapper,inputLink);
    wrapper.appendChild(inputLink);
    inputLink.style.paddingRight='110px';
    inputLink.placeholder='Cole link CURTO do app - IA Oficial';
    
    const btn=document.createElement('button');
    btn.id='btn-ia-scrape-v9';
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
    status.id='ia-status-v9';
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
      try{ return JSON.stringify(d).substring(0,300); }catch(e){ return String(d).substring(0,300); }
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
        status.textContent='🔑 Usando sua API Oficial AppID 1834706...';
        status.style.background='#eff6ff';
        status.style.border='1px solid #bfdbfe';
        status.style.color='#1e40af';
        
        let finalUrl = link;

        if(link.includes('s.shopee.com.br') || link.includes('shope.ee')){
          status.textContent='📱 Passo 1/2: Resolvendo link curto no seu celular...';
          const resolved = await resolverShortNoCliente(link);
          finalUrl = resolved.url;
          status.textContent=`🔗 Resolvido: ${finalUrl.substring(0,60)}... via ${resolved.proxy.substring(0,20)}`;
          if(finalUrl.includes('s.shopee.com.br')){
            status.textContent='❌ Celular não resolveu, tentando servidor...';
          }
        }

        status.textContent='🔑 Passo 2/2: Chamando API Oficial Shopee com seu AppID...';
        
        let dados=null;
        try{
          const r=await fetch('/api/shopee-direct?url='+encodeURIComponent(finalUrl||link),{signal:AbortSignal.timeout(20000)});
          if(r.ok) dados=await r.json();
          else {
            const t=await r.text();
            dados={error:`HTTP ${r.status} ${t.substring(0,100)}`, debug:[]};
          }
        }catch(e){ dados={error:e.message, debug:[]}; }

        if(!dados) dados={nome:'',imagem:'',preco:''};

        // Se servidor mandou resolver no cliente e já temos finalUrl longo, tenta PDP no cliente como fallback
        if((!dados.nome || !dados.imagem) && dados.precisaResolverNoCliente && finalUrl.includes('-i.')){
          status.textContent='📦 Servidor bloqueado, buscando PDP direto no seu celular...';
          const m = finalUrl.match(/-i\.(\d+)\.(\d+)/);
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

        if(dados.nome) document.getElementById('f-nome').value=dados.nome;
        if(dados.preco) document.getElementById('f-preco').value=dados.preco;
        if(dados.precoAntigo) document.getElementById('f-preco-antigo').value=dados.precoAntigo;
        if(dados.imagem){
          const inpImg=document.getElementById('f-emoji');
          if(inpImg){ 
            inpImg.value=dados.imagem; 
            if(window.otimizarAoColar){ try{ await window.otimizarAoColar(dados.imagem); }catch(e){} }
          }
        }
        document.getElementById('f-loja').value=dados.loja||'Shopee';
        if(dados.categoria && dados.categoria!=='Geral') document.getElementById('f-categoria').value=dados.categoria;
        else if(dados.nome) document.getElementById('f-categoria').value=detectarCategoriaIA(dados.nome);

        if(dados.imagem && dados.nome){
          const oficial = dados.temCredencialOficial ? '🔑 API OFICIAL' : '📱 Celular';
          status.textContent=`✅ ${oficial}: ${dados.nome.substring(0,50)} • ${dados.metodo||'OK'} • Imagem OK`;
          status.style.background='#f0fdf4';
          status.style.borderColor='#bbf7d0';
          status.style.color='#166534';
        } else {
          status.textContent=`❌ Erro: ${dados.error||'não achou'} | Debug: ${formatDebug(dados.debug).substring(0,250)} | Credencial: ${dados.temCredencialOficial?'OK':'FALTA ENV'}`;
          status.style.background='#fee2e2';
          status.style.borderColor='#fecaca';
          status.style.color='#991b1b';
        }
        setTimeout(()=>{ if(status) status.style.display='none'; },15000);
        
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
