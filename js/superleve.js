// js/superleve.js - SEPARADO 100% Firebase + 20 a 20 + proxy cf.shopee
// Nao redeclara nada do index.html, usa window.*

window.imagemOtimizadaFinal = window.imagemOtimizadaFinal || null;
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
  try{ return await tentar(src); }catch(e){
    if(urlProxy){ try{ return await tentar(urlProxy); }catch(e2){ throw e2; } }
    throw e;
  }
}

async function dataUrlParaBlobAuto(dataUrl){
  const res = await fetch(dataUrl);
  return await res.blob();
}

async function uploadStorageAuto(blob){
  if(window.ensureStorage) await window.ensureStorage();
  const storage = window.storage;
  const sRef = window.sRef;
  const uploadBytes = window.uploadBytes;
  const getDownloadURL = window.getDownloadURL;
  if(!storage || !sRef) throw new Error("Storage nao carregou");
  const nomeArq = 'produtos/'+Date.now()+'_'+Math.random().toString(36).substr(2,5)+'.webp';
  const refSt = sRef(storage, nomeArq);
  await uploadBytes(refSt, blob);
  return await getDownloadURL(refSt);
}

async function otimizarAoColar(valor){
  if(otimizandoAuto) return;
  const v = (valor||'').trim();
  if(!v) return;
  const ehImagem = v.startsWith('http://')||v.startsWith('https://')||v.startsWith('data:image');
  const inputImg = document.getElementById('f-emoji');
  const prevBox = document.getElementById('preview-img');
  const prevTag = document.getElementById('preview-img-tag');
  if(!ehImagem){ prevBox?.classList.add('hidden'); window.imagemOtimizadaFinal = null; return; }
  if(v.length <= 4) return;
  otimizandoAuto = true;
  const btnSalvar = document.getElementById('f-salvar');
  const txtBtnOriginal = btnSalvar ? btnSalvar.textContent : '';
  try{
    prevBox?.classList.remove('hidden');
    if(prevTag) prevTag.src = v;
    if(v.startsWith('data:image')){
      if(btnSalvar){ btnSalvar.textContent = "Comprimindo..."; btnSalvar.disabled = true; }
      const blobComp = await comprimirAuto(v, 600, 0.65);
      if(btnSalvar) btnSalvar.textContent = "Subindo...";
      const urlFinal = await uploadStorageAuto(blobComp);
      window.imagemOtimizadaFinal = urlFinal;
      if(inputImg) inputImg.value = urlFinal;
      if(prevTag) prevTag.src = urlFinal;
      if(typeof toast==='function') toast("Comprimida pra "+(blobComp.size/1024).toFixed(0)+"KB!");
    } else if(v.startsWith('http')){
      if(btnSalvar){ btnSalvar.textContent = "Otimizando link..."; btnSalvar.disabled = true; }
      try{
        const blobComp = await comprimirAuto(v, 600, 0.72);
        const kbComp = (blobComp.size/1024).toFixed(0);
        if(btnSalvar) btnSalvar.textContent = "Salvando leve...";
        const urlFinal = await uploadStorageAuto(blobComp);
        window.imagemOtimizadaFinal = urlFinal;
        if(inputImg) inputImg.value = urlFinal;
        if(prevTag) prevTag.src = urlFinal;
        if(typeof toast==='function') toast("Webp "+kbComp+"KB - 1GB livre!");
      }catch(eCors){
        if(prevTag) prevTag.src = v;
        window.imagemOtimizadaFinal = v;
        if(typeof toast==='function') toast("Link https detectado - super leve");
      }
    }
  }catch(err){
    console.error(err);
    if(typeof toast==='function') toast("Erro, mas pode salvar");
    window.imagemOtimizadaFinal = v;
  }finally{
    otimizandoAuto = false;
    if(btnSalvar){ btnSalvar.textContent = txtBtnOriginal || "Salvar + Notificar"; btnSalvar.disabled = false; }
  }
}

document.addEventListener('DOMContentLoaded', ()=>{
  const inputImg = document.getElementById('f-emoji');
  if(!inputImg) return;
  inputImg.addEventListener('paste', (e)=>{ setTimeout(()=>otimizarAoColar(e.target.value), 100); });
  inputImg.addEventListener('change', (e)=> otimizarAoColar(e.target.value));
  inputImg.addEventListener('blur', (e)=>{ if(e.target.value.trim().startsWith('http') && !window.imagemOtimizadaFinal) otimizarAoColar(e.target.value); });
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

window.otimizarAoColar = otimizarAoColar;
window.comprimirAuto = comprimirAuto;
console.log("superleve.js separado carregado");
