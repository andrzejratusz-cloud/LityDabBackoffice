'use strict';
const http=require('node:http');
const fs=require('node:fs');
const path=require('node:path');
const crypto=require('node:crypto');
const root=__dirname;
const login=process.env.POLKURIER_LOGIN,token=process.env.POLKURIER_TOKEN;
const endpoint=process.env.POLKURIER_SANDBOX==='1'?'https://api-sandbox.polkurier.pl':'https://api.polkurier.pl';
const journalPath=path.join(root,'.polkurier-journal.json');
let journal=fs.existsSync(journalPath)?JSON.parse(fs.readFileSync(journalPath,'utf8')):{};
const active=new Set();
const session=crypto.randomBytes(32).toString('hex');
function persist(){const temp=journalPath+'.tmp';fs.writeFileSync(temp,JSON.stringify(journal));fs.renameSync(temp,journalPath);}
const files=new Map(['pwa.js','favicon.ico','app-icon-180.png','app-icon-192.png','app-icon-512.png','menu-icons.jpg','index.html','app.js','improvements.js','business.js','install.js','files.js','polkurier.js','style.css','manifest.json','sw.js','icon.svg','logo.png','CHANGELOG.md','POLKURIER.md','sharing.js','sharing-config.js','SUPABASE.md','supabase-schema.sql'].map(name=>['/'+name,name]));
const types={'.html':'text/html','.js':'text/javascript','.css':'text/css','.json':'application/json','.png':'image/png','.svg':'image/svg+xml','.ico':'image/x-icon','.jpg':'image/jpeg'};
const server=http.createServer(async(req,res)=>{
  const origin='http://127.0.0.1:8791';
  if(req.headers.host!=='127.0.0.1:8791'){res.writeHead(403);res.end();return;}
  const respond=(status,value)=>{res.writeHead(status,{'Content-Type':'application/json','Cache-Control':'no-store'});res.end(JSON.stringify(value));};
  try {
    if(req.url==='/api/session'&&req.method==='GET'){
      if(req.headers.origin&&req.headers.origin!==origin) return respond(403,{error:'Nieprawidłowe źródło.'});
      return respond(200,{session,configured:Boolean(login&&token),sandbox:endpoint.includes('sandbox')});
    }
    if(req.url==='/api/polkurier'&&req.method==='POST'){
      if(req.headers.origin!==origin||req.headers['x-litydab-session']!==session) return respond(403,{error:'Otwórz aplikację pod lokalnym adresem modułu.'});
      if(!login||!token) return respond(503,{error:'Ustaw POLKURIER_LOGIN i POLKURIER_TOKEN przed uruchomieniem modułu.'});
      let body='';
      for await(const chunk of req){body+=chunk;if(body.length>200000)throw Error('Za duże zapytanie.');}
      const request=JSON.parse(body);
      if(!['test_auth_api','order_valuation_v2','create_order','get_orders','get_label','available_carriers'].includes(request.method))throw Error('Nieobsługiwana metoda.');
      let key;
      if(request.method==='create_order'){
        key=String(request.key||'');
        if(!/^[a-f0-9-]{36}$/i.test(key))throw Error('Brak identyfikatora przesyłki.');
        const hash=crypto.createHash('sha256').update(JSON.stringify(request.data)).digest('hex');
        if(active.has(key))return respond(409,{error:'Zlecenie jest przetwarzane.'});
        if(journal[key]?.result){
          if(journal[key].hash!==hash)return respond(409,{error:'To zlecenie utworzono z innymi parametrami. Odśwież przesyłkę.'});
          return respond(200,journal[key].result);
        }
        if(journal[key])return respond(409,{error:'Wynik poprzedniej próby jest niepewny. Sprawdź panel Polkurier i wpisz numer zlecenia w zamówieniu. Kolejna próba została zatrzymana.'});
        journal[key]={state:'pending',hash,date:new Date().toISOString()};persist();active.add(key);
      }
      try {
        const response=await fetch(endpoint,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({authorization:{login,token},apimethod:request.method,data:request.data}),signal:AbortSignal.timeout(60000)});
        const result=await response.json();
        if(key){if(result.status==='success')journal[key]={...journal[key],result,state:'complete'};else delete journal[key];persist();}
        respond(200,result);
      } finally {if(key)active.delete(key);}
      return;
    }
    if(req.method!=='GET'){res.writeHead(405);res.end();return;}
    const requestPath=new URL(req.url,'http://127.0.0.1:8791').pathname;
    const name=files.get(requestPath==='/'?'/index.html':requestPath);
    if(!name){res.writeHead(404);res.end();return;}
    res.writeHead(200,{'Content-Type':types[path.extname(name)]||'text/plain','Cache-Control':'no-store'});
    fs.createReadStream(path.join(root,name)).pipe(res);
  } catch(error){respond(500,{error:error.name==='TimeoutError'?'Przekroczono czas oczekiwania. Sprawdź wynik w panelu Polkurier.':error.message});}
});
if(require.main===module)server.listen(8791,'127.0.0.1',()=>console.log('Lity Dąb: http://127.0.0.1:8791 · '+(endpoint.includes('sandbox')?'sandbox':'produkcja')));
module.exports={server};
