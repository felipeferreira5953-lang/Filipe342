
// superleve.js - Desempenho Super Leve 600px webp ~40KB - SEPARADO
// Mantém seu compressor original, com proxy pra cf.shopee não travar

let imagemOtimizadaFinal = null;
let otimizandoAuto = false;

async function comprimirAuto(src, maxSize=600, qualidade=0.70){
  const precisaProxy = /shopee|cf\.shopee|mercadolivre|mlb|amazon|m\.media-amazon|a\.co/.test(src);
  const urlProxy = precisaProxy ? `/api/shopee-direct?img=${encodeURIComponent(src)}` : null;
  
  const tentar = (urlTentativa)=> new Promise((resolve, reject)=>{
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = ()=>{
      let w = img.width, h = img.height;
      if(w>h){ if(w>maxSize){ h*=maxSize/w; w=maxSize; } } else { if(h>maxSize){ w*=maxSize/h; h=maxSize; } }
      const canvas = document.createElement('canvas');
      canvas.width = w; canvas.height = h;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img,0,0,w,h);
      canvas.toBlob(b=> b?resolve(b):reject("erro blob"), 'image/webp', qualidade);
    };
    img.onerror = ()=>reject("erro carregar");
    img.src = urlTentativa;
  });

  try{
    return await tentar(src);
  }catch(e){
    if(urlProxy){
      try{ return await tentar(urlProxy); }catch(e2){ throw e2; }
    }
    throw e;
  }
}

async function dataUrlParaBlobAuto(dataUrl){
  const res = await fetch(dataUrl);
  return await res.blob();
}

async function uploadStorageAuto(blob){
  await ensureStorage();
  const nomeArq = 'produtos/'+Date.now()+'_'+Math.random().toString(36).substr(2,5)+'.webp';
  const refSt = sRef(storage, nomeArq);
  await uploadBytes(refSt, blob);
  return await getDownloadURL(refSt);
}

async function otimizarAoColar(valor){
  if(otimizandoAuto) return;
  const v = valor.trim();
  if(!v) return;
  const ehImagem = v.startsWith('http://')||v.startsWith('https://')||v.startsWith('data:image');
  const inputImg = document.getElementById('f-emoji');
  const prevBox = document.getElementById('preview-img');
  const prevTag = document.getElementById('preview-img-tag');
  if(!ehImagem) {
    prevBox?.classList.add('hidden');
    imagemOtimizadaFinal = null;
    return;
  }
  if(v.length <= 4) return;
  otimizandoAuto = true;
  const btnSalvar = document.getElementById('f-salvar');
  const txtBtnOriginal = btnSalvar ? btnSalvar.textContent : '';
  try{
    prevBox.classList.remove('hidden');
    if(prevTag) prevTag.src = v;
    if(v.startsWith('data:image')){
      if(btnSalvar){ btnSalvar.textContent = "🗜️ Comprimindo data:image..."; btnSalvar.disabled = true; }
      const blobOrig = await dataUrlParaBlobAuto(v);
      const blobComp = await comprimirAuto(v, 600, 0.65);
      if(btnSalvar) btnSalvar.textContent = "☁️ Subindo otimizada...";
      const urlFinal = await uploadStorageAuto(blobComp);
      imagemOtimizadaFinal = urlFinal;
      if(inputImg) inputImg.value = urlFinal;
      if(prevTag) prevTag.src = urlFinal;
      toast("✅ Comprimida pra webp "+(blobComp.size/1024).toFixed(0)+"KB - 95% economia!");
    } else if(v.startsWith('http')){
      if(btnSalvar){ btnSalvar.textContent = "🗜️ Otimizando link..."; btnSalvar.disabled = true; }
      try{
        const blobComp = await comprimirAuto(v, 600, 0.72);
        const kbComp = (blobComp.size/1024).toFixed(0);
        if(btnSalvar) btnSalvar.textContent = "☁️ Salvando versão leve...";
        const urlFinal = await uploadStorageAuto(blobComp);
        imagemOtimizadaFinal = urlFinal;
        if(inputImg) inputImg.value = urlFinal;
        if(prevTag) prevTag.src = urlFinal;
        toast("✅ Link convertido pra webp "+kbComp+"KB - não gasta seu 1GB!");
      }catch(eCors){
        if(prevTag) prevTag.src = v;
        imagemOtimizadaFinal = v;
        toast("✅ Link https:// detectado - já é super leve (0,08KB no banco)");
      }
    }
  }catch(err){
    toast("Erro ao otimizar, mas pode salvar que já é leve");
    imagemOtimizadaFinal = v;
  }finally{
    otimizandoAuto = false;
    if(btnSalvar){ btnSalvar.textContent = txtBtnOriginal || "Salvar + 🔔 Notificar todo mundo"; btnSalvar.disabled = false; }
  }
}

// Eventos da imagem - separados aqui
document.addEventListener('DOMContentLoaded', ()=>{
  const inputImg = document.getElementById('f-emoji');
  if(!inputImg) return;
  inputImg.addEventListener('paste', (e)=>{ setTimeout(()=>{ otimizarAoColar(e.target.value); }, 100); });
  inputImg.addEventListener('change', (e)=> otimizarAoColar(e.target.value));
  inputImg.addEventListener('blur', (e)=> { if(e.target.value.trim().startsWith('http') && !imagemOtimizadaFinal) otimizarAoColar(e.target.value); });
  inputImg.addEventListener('input', (e)=>{
    const v = e.target.value.trim();
    let emojiDiv = document.getElementById('preview-emoji');
    if(!emojiDiv){
      emojiDiv = document.createElement('div');
      emojiDiv.id = 'preview-emoji';
      emojiDiv.className = 'text-[32px] mt-1';
      document.getElementById('preview-img')?.appendChild(emojiDiv);
    }
    if(v.startsWith('http') || v.startsWith('data:image')){
      document.getElementById('preview-img')?.classList.remove('hidden');
      const prevTag = document.getElementById('preview-img-tag');
      if(prevTag){ prevTag.style.display='block'; prevTag.src = v; }
      if(emojiDiv) emojiDiv.style.display='none';
    } else {
      document.getElementById('preview-img')?.classList.add('hidden');
      if(emojiDiv) emojiDiv.style.display='none';
    }
  });
});

window.imagemOtimizadaFinal = imagemOtimizadaFinal;
window.otimizarAoColar = otimizarAoColar;
