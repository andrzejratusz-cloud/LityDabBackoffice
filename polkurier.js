'use strict';
let pkSession;
async function pkCall(method,payload,key) {
  if(location.origin!=='http://127.0.0.1:8791')throw Error('Uruchom polkurier-server.cjs i otwórz http://127.0.0.1:8791. Instrukcja jest w POLKURIER.md.');
  if(!pkSession){
    const response=await fetch('/api/session',{cache:'no-store',signal:AbortSignal.timeout(10000)});
    pkSession=await response.json();
  }
  if(!pkSession.configured)throw Error('Uzupełnij ID konta i token API w konfiguracji lokalnego modułu.');
  const response=await fetch('/api/polkurier',{method:'POST',headers:{'Content-Type':'application/json','X-Litydab-Session':pkSession.session},signal:AbortSignal.timeout(70000),body:JSON.stringify({method,data:payload,key})});
  const result=await response.json();
  if(result.error||result.status!=='success')throw Error(result.error||String(typeof result.response==='string'?result.response:JSON.stringify(result.response)));
  return result.response;
}
const pkAddressFields={person:'Imię i nazwisko',company:'Firma',street:'Ulica',housenumber:'Numer domu',flatnumber:'Lokal',postcode:'Kod pocztowy',city:'Miasto',email:'E-mail',phone:'Telefon'};
function pkAddressInputs(prefix,address={}) {
  return grid(Object.entries(pkAddressFields).map(([key,label])=>input(prefix+key,label,address[key],key==='email'?'email':'text',!['company','flatnumber'].includes(key)?'required':'')).join(''));
}
function senderList() {
  data.polkurierSenders??=[];
  if(!data.polkurierSenders.length&&data.polkurierSender?.person) data.polkurierSenders.push({id:id(),...data.polkurierSender});
  return data.polkurierSenders;
}
function senderOptions(selected) {
  return '<option value="">Nowy / własny nadawca</option>'+senderList().map(sender=>'<option value="'+esc(sender.id)+'" '+(sender.id===selected?'selected':'')+'>'+esc(sender.person)+' · '+esc(sender.city)+'</option>').join('');
}
function pkSettings() {
  const selected=data.defaultSenderId||senderList()[0]?.id||'';
  const sender=senderList().find(s=>s.id===selected)||data.polkurierSender||{};
  $('main').insertAdjacentHTML('beforeend','<section><h2>Polkurier — nadawcy</h2><label>Wybierz nadawcę<select id="savedSender">'+senderOptions(selected)+'</select></label>'+
    '<form id="pkSender"><div id="senderFields">'+pkAddressInputs('sender_',sender)+'</div><p><button>Zapisz nadawcę jako domyślnego</button></p></form></section>');
  $('savedSender').onchange=e=>{$('senderFields').innerHTML=pkAddressInputs('sender_',senderList().find(s=>s.id===e.target.value)||{});};
  $('pkSender').onsubmit=e=>{
    e.preventDefault();
    const sender={id:$('savedSender').value||id(),...Object.fromEntries(Object.entries(values(e.target)).map(([k,v])=>[k.slice(7),v]))};
    put(data.polkurierSenders,sender);data.defaultSenderId=sender.id;data.polkurierSender=sender;
    save();settings();
  };
}
function shipmentForm(orderId) {
  const order=data.orders.find(o=>o.id===orderId);
  if(!order)return;
  const workspace=space;
  const c=order.client;
  const existing=order.shipmentDraft||{};
  const defaultSender=senderList().find(s=>s.id===data.defaultSenderId)||senderList()[0]||data.polkurierSender;
  const sender=existing.sender?.person?existing.sender:defaultSender;
  const packages=existing.packs?existing.packs.map(pack=>({...pack})):[
    {length:Number(order.length),width:Number(order.width),height:'',weight:'',amount:1,type:'ST'},
    {length:'',width:'',height:'',weight:'',amount:1,type:'ST'}
  ];
  if(packages.length===1) packages.push({length:'',width:'',height:'',weight:'',amount:1,type:'ST'});
  function packageFields(pack,index) {
    return group(index===0?'Paczka 1 — blat':index===1?'Paczka 2 — stelaż':'Paczka '+(index+1),
      grid(['length','width','height','weight'].map((key,i)=>input('pack_'+index+'_'+key,['Długość (cm)','Szerokość (cm)','Wysokość (cm)','Waga (kg)'][i],pack[key],'number','required min="0.01" step="'+(key==='weight'?'0.01':'1')+'"')).join('')+
        num('pack_'+index+'_amount','Liczba takich paczek',pack.amount||1,1)+select('pack_'+index+'_type','Kształt',['ST','NST'],pack.type))+
      '<p class="muted">ST — standardowy, NST — niestandardowy.</p>');
  }
  const recipient={person:person(c),company:c.company,street:c.street,housenumber:c.house,flatnumber:c.flat,postcode:c.zip,city:c.city,email:c.email,phone:c.phone,...existing.recipient};
  $('main').innerHTML='<h1>Polkurier · '+esc(order.number)+'</h1>'+button('order','Wróć do zamówienia',order.id)+
    '<form id="shipment" novalidate>'+group('Odbiorca',pkAddressInputs('recipient_',recipient))+
    group('Nadawca','<label>Wybierz nadawcę<select id="shipmentSender">'+senderOptions(sender?.id)+'</select></label><div id="shipmentSenderFields">'+pkAddressInputs('sender_',sender)+'</div>')+
    group('Zapakowane przesyłki',select('shipmenttype','Rodzaj',['box','palette'],existing.shipmenttype)+
      packages.map(packageFields).join('')+
      '<p>Wymiary i waga dotyczą osobno każdego opakowania po zapakowaniu.</p>'+
      input('description','Zawartość',existing.description||'Biurko dębowe','text','required maxlength="30"')+
      num('insurance','Ubezpieczenie (zł)',existing.insurance??quote(order).price)+
      num('cod','Kwota pobrania (zł)',existing.COD?.codamount??((order.contractPayment===contractPayment[1]||order.payment==='Gotówka')?Math.max(0,quote(order).price-Number(order.paid||0)):0))+
      input('account','Konto do zwrotu pobrania',existing.COD?.codbankaccount||order.bankAccount)+
      input('pickupdate','Data podjazdu',existing.pickup?.pickupdate||today(),'date','required')+
      grid(input('from','Godzina od',existing.pickup?.pickuptimefrom||'09:00','time','required')+input('to','Godzina do',existing.pickup?.pickuptimeto||'17:00','time','required'))+
      area('additional','Pola dodatkowe przewoźnika (JSON)',JSON.stringify(existing.additional_fields||{})))+
    '<button name="operation" value="quote">Pobierz ceny</button> <button name="operation" value="draft">Zapisz przygotowanie</button>'+
    '<p id="pkStatus" role="status" aria-live="polite"></p><div id="pkQuotes"></div></form><section>'+input('linkedOrder','Numer istniejącego zlecenia Polkurier',order.carrierOrder)+
    button('pkRefresh','Pobierz numer przesyłki i status',order.id)+' '+button('pkLabel','Pobierz etykietę PDF',order.id)+
    '<p>'+esc(order.tracking||'')+'</p></section>';
  let quotes=[],quotedPayload;
  const form=$('shipment');
  $('shipmentSender').onchange=e=>{$('shipmentSenderFields').innerHTML=pkAddressInputs('sender_',senderList().find(s=>s.id===e.target.value)||{});};
  function read(draftOnly=false){
    const invalid=Array.from(form.elements).find(field=>field.willValidate&&!field.validity.valid&&(!draftOnly||field.name.startsWith('pack_')));
    if(invalid){
      invalid.focus();invalid.reportValidity();
      const label=invalid.closest('label')?.firstChild?.textContent?.trim()||invalid.name;
      throw Error('Sprawdź pole „'+label+'”. '+invalid.validationMessage);
    }
    const v=values(form);
    function addr(prefix){return {...Object.fromEntries(Object.keys(pkAddressFields).map(k=>[k,v[prefix+k]])),country:'PL'};}
    if(!draftOnly) for(const prefix of ['sender_','recipient_']) {
      if(!/^\d{2}-\d{3}$/.test(v[prefix+'postcode']))throw Error('Kod pocztowy musi mieć format 00-000.');
    }
    const packs=packages.map((_,index)=>({
      ...Object.fromEntries(['length','width','height','weight','amount'].map(key=>[key,Number(v['pack_'+index+'_'+key])])),
      type:v['pack_'+index+'_type']
    }));
    if(packs.some(pack=>!['length','width','height','weight','amount'].every(key=>Number.isFinite(pack[key])&&pack[key]>0)||!Number.isInteger(pack.amount)||!['length','width','height'].every(key=>Number.isInteger(pack[key]))))throw Error('Wpisz dodatnie wymiary i wagę każdej paczki. Wymiary i liczba paczek muszą być całkowite.');
    let additional;
    try {additional=JSON.parse(v.additional);}
    catch {throw Error('Pola dodatkowe muszą zawierać poprawny JSON, np. {}.');}
    if(!additional||Array.isArray(additional)||typeof additional!=='object')throw Error('Pola dodatkowe muszą być obiektem JSON.');
    const result={shipmenttype:v.shipmenttype,description:v.description,sender:addr('sender_'),recipient:addr('recipient_'),packs,insurance:Number(v.insurance),pickup:{pickupdate:v.pickupdate,pickuptimefrom:v.from,pickuptimeto:v.to,nocourierorder:false},additional_fields:additional};
    if(Number(v.cod)>0){
      const account=v.account.replace(/\s/g,'');
      if(!/^\d{26}$/.test(account))throw Error('Podaj 26 cyfr konta do zwrotu pobrania.');
      result.COD={codtype:'S',codamount:Number(v.cod),codbankaccount:account,return_cod:'BA'};
    }
    if(!draftOnly&&v.from>=v.to)throw Error('Godzina końcowa musi być późniejsza niż początkowa.');
    return result;
  }
  function saveDraft(payload){if(space!==workspace)throw Error('Zmieniono przestrzeń. Otwórz przesyłkę ponownie.');order.shipmentDraft=payload;save();}
  form.onsubmit=async e=>{
    e.preventDefault();
    const control=e.submitter||form.querySelector('button[value="quote"]');
    try {
      control.disabled=true;
      $('pkStatus').textContent='Sprawdzanie danych przesyłki…';
      const payload=read(control.value==='draft');saveDraft(payload);
      $('pkStatus').textContent='Pobieranie cen z Polkurier…';
      $('pkQuotes').innerHTML='';
      if(control.value==='draft'){$('pkStatus').textContent='Zapisano przygotowanie przesyłki.';return;}
      const result=await pkCall('order_valuation_v2',payload);
      if(space!==workspace)return;
      if(!Array.isArray(result))throw Error('Polkurier zwrócił nieoczekiwany format wyceny.');
      quotes=result.filter(q=>q.available===true&&q.shipment!==false);
      quotedPayload=JSON.stringify(payload);
      $('pkStatus').textContent='Dostępne usługi: '+quotes.length+'.';
      $('pkQuotes').innerHTML=quotes.length?quotes.map((q,i)=>'<p>'+esc(q.servicename||q.serviceName||q.servicecode)+' · '+money(q.grossprice)+' brutto <button type="button" data-pk-create="'+i+'">Zleć kuriera</button></p>').join(''):'Brak dostępnych usług dla podanych parametrów.';
    }catch(error){$('pkStatus').textContent=error.message;$('pkStatus').scrollIntoView({block:'nearest'});}
    finally{control.disabled=false;}
  };
  $('pkQuotes').onclick=async e=>{
    const control=e.target.closest('[data-pk-create]');
    if(!control)return;
    try {
      control.disabled=true;
      const payload=read(),q=quotes[Number(control.dataset.pkCreate)];
      if(JSON.stringify(payload)!==quotedPayload)throw Error('Dane zmieniono po wycenie. Pobierz ceny ponownie.');
      if(order.carrierOrder)throw Error('Zamówienie ma już zlecenie. Użyj odświeżania numeru przesyłki.');
      if(workspace==='demo')throw Error('Nadawanie dostępne w przestrzeni firmowej.');
      if(!confirm('Zlecić usługę '+(q.servicename||q.serviceName||q.servicecode)+' za '+money(q.grossprice)+' brutto? Dane nadawcy i klienta zostaną przesłane do Polkurier.'))return;
      order.shipmentRequestId ||= id();save();
      const request={...payload,courier:q.servicecode,external_application_id:'litydab-backoffice',external_order_id:order.shipmentRequestId,external_order_number:order.number};
      const result=await pkCall('create_order',request,order.shipmentRequestId);
      if(space!==workspace){alert('Zlecenie utworzono. Wróć do przestrzeni firmowej i pobierz numer zlecenia z Polkurier.');return;}
      order.carrierOrder=result.order_number;
      order.tracking=(result.label||[]).join(', ');
      order.trackUrl=result.url_tracktrace||'';
      order.shippingStatus=result.is_paid?'Potwierdzone':'Oczekuje na opłacenie';
      order.polkurierResult=result;save();
      $('linkedOrder').value=order.carrierOrder;
      $('pkStatus').textContent='Zlecenie '+order.carrierOrder+' · przesyłka '+(order.tracking||'Numer jeszcze nie został wygenerowany. Odśwież po opłaceniu zlecenia.');
    } catch(error){$('pkStatus').textContent=error.message;}
    finally{control.disabled=false;}
  };
}
async function refreshShipment(orderId,label=false) {
  const order=data.orders.find(o=>o.id===orderId),workspace=space;
  if(!order)return;
  const number=$('linkedOrder')?.value.trim()||order.carrierOrder;
  try {
    if(!number)throw Error('Wpisz numer zlecenia Polkurier.');
    if(label){
      const result=await pkCall('get_label',{orderno:[number]});
      download(new Blob([Uint8Array.from(atob(result.file),c=>c.charCodeAt(0))],{type:'application/pdf'}),'application/pdf','Etykieta-'+order.number+'.pdf');
      return;
    }
    const result=await pkCall('get_orders',{orderno:number});
    if(space!==workspace)return;
    order.carrierOrder=result.number||number;
    order.tracking=(result.waybills?.map(w=>w.number)||result.label||[]).join(', ');
    order.trackUrl=result.url||'';
    order.shippingStatus=result.status||'';
    order.polkurierResult=result;save();
    $('pkStatus').textContent=order.shippingStatus+' · '+(order.tracking||'Numer listu oczekuje na wygenerowanie.');
  }catch(error){$('pkStatus').textContent=error.message;}
}

function polkurierImportCsv(order) {
  const c=order.client,draft=order.shipmentDraft||{};
  const packs=draft.packs||[];
  const pack=packs[0]||{};
  const cod=draft.COD?.codamount??((order.contractPayment===contractPayment[1]||order.payment==='Gotówka')?Math.max(0,quote(order).price-Number(order.paid||0)):0);
  const row=[
    c.company||'',person(c),[c.street,c.house].filter(Boolean).join(' ')+(c.flat?'/'+c.flat:''),
    c.zip,c.city,'PL',c.phone||'',c.email||'',
    draft.shipmenttype==='palette'?1:0,draft.description||'Biurko '+order.number,
    cod,draft.insurance??quote(order).price,pack.length||0,pack.width||0,pack.height||0,pack.weight||0,pack.amount||1,
    pack.type==='NST'?1:0,''
  ];
  const cell=value=>'"'+String(value??'').replaceAll('"','""')+'"';
  return row.map(cell).join(';')+'\r\n';
}
function exportPolkurierOrder(orderId) {
  const order=data.orders.find(o=>o.id===orderId);
  if(!order)return;
  try {
    const csv=polkurierImportCsv(order);
    download(csv,'text/csv;charset=utf-8','Polkurier-'+order.number+'.csv');
    alert('Pobrano plik z danymi odbiorcy i pierwszej paczki (blatu). Drugą paczkę (stelaż) dodaj w formularzu Polkurier, wpisując jej zapisane wymiary i wagę. W Polkurier wybierz Import → Import CSV, wgraj plik i kliknij Wyślij przy zaimportowanej transakcji. Sprawdź dane oraz parametry paczek w formularzu przed nadaniem.');
  } catch(error){alert(error.message);}
}
