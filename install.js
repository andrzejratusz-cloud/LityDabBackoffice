'use strict';
let installEvent=null;
const standaloneApp=()=>window.matchMedia('(display-mode: standalone)').matches||navigator.standalone===true;
window.addEventListener('beforeinstallprompt',event=>{event.preventDefault();installEvent=event;});
function installationBundle() {
  return {
    type:'litydab-device-transfer',version:1,space,
    data:JSON.parse(JSON.stringify(data)),
    publicSharing:window.LITY_SHARING_CONFIG||null,
    appearance:{theme:localStorage.getItem('litydab:theme'),font:localStorage.getItem('litydab:font'),scale:localStorage.getItem('litydab:scale'),logo:localStorage.getItem('litydab:logo')}
  };
}
function exportInstallData() {
  download(JSON.stringify(installationBundle(),null,2),'application/json','LityDab-przeniesienie-'+today()+'.json');
}
function installSettings() {
  $('main').insertAdjacentHTML('beforeend','<section><h2>Skrót na pulpit i przeniesienie danych</h2>'+
    '<p>'+ (standaloneApp()?'Aplikacja jest uruchomiona z ikony.':'Przygotuj kopię danych przed dodaniem skrótu.')+'</p>'+
    '<button type="button" id="installApp">Dodaj skrót na pulpit</button> <button type="button" id="exportInstall">Pobierz dane do przeniesienia</button>'+
    '<label>Wczytaj dane po uruchomieniu z ikony <input type="file" id="importInstall" accept=".json,application/json"></label>'+
    '<p id="installStatus" role="status"></p>'+
    '<p>Na iOS Safari i aplikacja z ikony używają oddzielnej pamięci. Pobierz dane tutaj, a po otwarciu z ikony wczytaj ten plik. Wspólną bazę można też otworzyć po ponownym zalogowaniu do Supabase.</p></section>');
  $('exportInstall').onclick=exportInstallData;
  $('installApp').onclick=async()=>{
    if(standaloneApp()){$('installStatus').textContent='Skrót jest już uruchomiony.';return;}
    exportInstallData();
    if(installEvent){
      const prompt=installEvent;installEvent=null;await prompt.prompt();
      $('installStatus').textContent='Po instalacji wczytaj pobrany plik w aplikacji z ikony.';
    }else{
      $('installStatus').textContent=/iPhone|iPad|iPod/.test(navigator.userAgent)?'Zapisz pobraną kopię w Plikach. W Safari wybierz Udostępnij → Dodaj do ekranu głównego. Otwórz ikonę i wczytaj kopię w Ustawieniach.':'W menu przeglądarki wybierz Zainstaluj aplikację lub Dodaj do ekranu głównego. Po otwarciu z ikony sprawdź bazę i w razie potrzeby wczytaj pobraną kopię.';
    }
  };
  $('importInstall').onchange=async e=>{
    try {
      if(!e.target.files.length)return;
      const bundle=JSON.parse((await e.target.files[0].text()).replace(/^\uFEFF/,''));
      if(bundle.type!=='litydab-device-transfer'||bundle.version!==1||!['firma','demo'].includes(bundle.space)||!validBackup(bundle.data))throw Error('Wybierz plik przeniesienia danych Lity Dąb.');
      if(sharedScope)throw Error('Wróć do danych lokalnych przed przeniesieniem bazy.');
      if(!confirm('Wczytać kopię do przestrzeni '+bundle.space+'? Pobierz kopię obecnych danych przed potwierdzeniem.'))return;
      space=bundle.space;localStorage.setItem('litydab:space',space);
      data=bundle.data;normalize();save();
      if(bundle.publicSharing?.url&&bundle.publicSharing?.publicKey)localStorage.setItem('litydab-sharing-config',JSON.stringify(bundle.publicSharing));
      for(const name of ['theme','font','scale','logo']){
        const value=bundle.appearance?.[name];
        if(typeof value==='string'&&value.length<1500000)localStorage.setItem('litydab:'+name,value);
      }
      localStorage.setItem('litydab:install-transfer-complete','1');
      location.reload();
    }catch(error){alert(error.message);}
  };
}
