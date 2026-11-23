'use strict';
// Branding is separate from release caches and business records.
const brandingCache='litydab-branding';
let pwaRegistration=null,pwaDirty=false,pwaReloading=false;
const iconURL=size=>new URL('./app-icon-'+size+'.png',location.href).href;
const pngFromImage=(source,size)=>new Promise((resolve,reject)=>{
  const image=new Image();
  image.onload=()=>{
    const canvas=document.createElement('canvas');canvas.width=canvas.height=size;
    const context=canvas.getContext('2d');context.fillStyle='#fff';context.fillRect(0,0,size,size);
    const ratio=Math.min(size/image.width,size/image.height);
    context.drawImage(image,(size-image.width*ratio)/2,(size-image.height*ratio)/2,image.width*ratio,image.height*ratio);
    resolve(canvas.toDataURL('image/png'));
  };
  image.onerror=()=>reject(Error('Nie można odczytać ikony. Wybierz poprawny ICO lub PNG.'));
  image.src=source;
});
async function applyAppIcon(){
  const saved=localStorage.getItem('litydab:appIcon');
  const source=saved&&/^data:image\/png;base64,/.test(saved)&&saved.length<1500000?saved:null;
  document.querySelector('link[rel="icon"]').href=source||'favicon.ico';
  document.querySelector('link[rel="apple-touch-icon"]').href=source||'app-icon-180.png';
  if(location.protocol!=='file:'&&'caches' in window){
    const cache=await caches.open(brandingCache);
    for(const size of [180,192,512]){
      if(source){const png=await pngFromImage(source,size);await cache.put(iconURL(size),await fetch(png));}
      else await cache.delete(iconURL(size));
    }
  }
}
function iconSettings(){
  const section=$('logoFile').closest('section');
  section.insertAdjacentHTML('beforeend','<hr><h3>Ikona aplikacji i favicon</h3><label>Wybierz favicon.ico lub PNG<input id="appIconFile" type="file" accept=".ico,.png,image/x-icon,image/vnd.microsoft.icon,image/png"></label><p><img id="appIconPreview" width="48" height="48" alt="Podgląd ikony aplikacji"> <button type="button" id="resetAppIcon">Przywróć domyślną ikonę</button></p><p id="appIconStatus" role="status"></p><p class="muted">Wybierz ikonę przed dodaniem skrótu. System może zachować ikonę istniejącego skrótu — na iOS może być konieczne ponowne dodanie skrótu. Własna ikona jest zapisana na tym urządzeniu. Aby ustawić ją jako domyślną na GitHub, pobierz PNG poniżej i podmień pliki w repozytorium.</p><p>'+[180,192,512].map(size=>'<button type="button" data-icon-download="'+size+'">PNG '+size+' px</button>').join(' ')+'</p>');
  const preview=()=>$('appIconPreview').src=localStorage.getItem('litydab:appIcon')||'app-icon-180.png';preview();
  $('appIconFile').onchange=async event=>{
    try{
      const file=event.target.files[0];if(!file)return;
      if(!/\.(ico|png)$/i.test(file.name)||file.size>1024*1024)throw Error('Wybierz ICO lub PNG do 1 MB.');
      const url=URL.createObjectURL(file);let png;
      try{png=await pngFromImage(url,512);}finally{URL.revokeObjectURL(url);}
      localStorage.setItem('litydab:appIcon',png);await applyAppIcon();preview();
      $('appIconStatus').textContent='Zapisano faviconę i ikonę nowego skrótu aplikacji.';
    }catch(error){$('appIconStatus').textContent=error.message;}
  };
  $('resetAppIcon').onclick=async()=>{localStorage.removeItem('litydab:appIcon');await applyAppIcon();preview();$('appIconStatus').textContent='Przywrócono domyślną ikonę.';};
  section.querySelectorAll('[data-icon-download]').forEach(control=>control.onclick=async()=>{
    const size=Number(control.dataset.iconDownload);
    const png=await pngFromImage(localStorage.getItem('litydab:appIcon')||'app-icon-512.png',size);
    const link=document.createElement('a');link.href=png;link.download='app-icon-'+size+'.png';link.click();
  });
}
function showPwaUpdate(){
  if($('pwaUpdate'))return;
  const notice=document.createElement('aside');notice.id='pwaUpdate';notice.setAttribute('role','status');
  notice.innerHTML='Dostępna nowa wersja aplikacji. Zapisz rozpoczętą edycję. <button type="button">Odśwież aplikację</button>';
  notice.querySelector('button').onclick=()=>{if(!pwaDirty||confirm('Odświeżyć aplikację? Niezapisane zmiany formularza zostaną utracone.'))location.reload();};
  document.body.append(notice);
}
document.addEventListener('input',event=>{if(event.target.closest('form'))pwaDirty=true;});
document.addEventListener('submit',()=>{setTimeout(()=>{pwaDirty=!!document.querySelector('#main form');},0);});
document.addEventListener('click',()=>{setTimeout(()=>{if(!document.querySelector('#main form'))pwaDirty=false;},0);});
async function checkPwaUpdate(){
  if(!pwaRegistration||!navigator.onLine)return;
  try{await pwaRegistration.update();}catch(error){console.info('Sprawdzenie aktualizacji niedostępne offline.');}
}
if('serviceWorker' in navigator&&location.protocol!=='file:'){
  const hadController=!!navigator.serviceWorker.controller;
  navigator.serviceWorker.addEventListener('controllerchange',()=>{
    if(!hadController||pwaReloading)return;
    if(pwaDirty){showPwaUpdate();return;}
    pwaReloading=true;location.reload();
  });
  navigator.serviceWorker.register('./sw.js',{updateViaCache:'none'}).then(async registration=>{
    pwaRegistration=registration;await applyAppIcon();await checkPwaUpdate();
  }).catch(console.error);
  document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible')checkPwaUpdate();});
  window.addEventListener('pageshow',checkPwaUpdate);window.addEventListener('online',checkPwaUpdate);
  setInterval(()=>{if(document.visibilityState==='visible')checkPwaUpdate();},5*60*1000);
}
applyAppIcon().catch(console.error);
