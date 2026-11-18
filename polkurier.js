'use strict';
let pkSession;
async function pkCall(method,payload,key) {
  if(location.origin!=='http://127.0.0.1:8791')throw Error('Uruchom polkurier-server.cjs i otwórz http://127.0.0.1:8791. Instrukcja jest w POLKURIER.md.');
  if(!pkSession){
    const response=await fetch('/api/session',{cache:'no-store'});
    pkSession=await response.json();
  }
  if(!pkSession.configured)throw Error('Uzupełnij ID konta i token API w konfiguracji lokalnego modułu.');
  const response=await fetch('/api/polkurier',{method:'POST',headers:{'Content-Type':'application/json','X-Litydab-Session':pkSession.session},body:JSON.stringify({method,data:payload,key})});
  const result=await response.json();
  if(result.error||result.status!=='success')throw Error(result.error||String(typeof result.response==='string'?result.response:JSON.stringify(result.response)));
  return result.response;
}
const pkAddressFields={person:'Imię i nazwisko',company:'Firma',street:'Ulica',housenumber:'Numer domu',flatnumber:'Lokal',postcode:'Kod pocztowy',city:'Miasto',email:'E-mail',phone:'Telefon'};
function pkAddressInputs(prefix,address={}) {
  return grid(Object.entries(pkAddressFields).map(([key,label])=>input(prefix+key,label,address[key],key==='email'?'email':'text',!['company','flatnumber'].includes(key)?'required':'')).join(''));
}
function pkSettings() {
  $('main').insertAdjacentHTML('beforeend','<section><h2>Polkurier</h2><p>Połączenie przez lokalny moduł. <a href="POLKURIER.md" target="_blank">Instrukcja uruchomienia</a></p><form id="pkSender">'+pkAddressInputs('sender_',data.polkurierSender)+'<p><button>Zapisz adres nadawcy</button></p></form></section>');
  $('pkSender').onsubmit=e=>{
    e.preventDefault();
    data.polkurierSender=Object.fromEntries(Object.entries(values(e.target)).map(([k,v])=>[k.slice(7),v]));
    save();alert('Zapisano dane nadawcy.');
  };
}
function shipmentForm(orderId) {
  const order=data.orders.find(o=>o.id===orderId);
  if(!order)return;
  const workspace=space;
  const c=order.client;
  const existing=order.shipmentDraft||{};
  const recipient={person:person(c),company:c.company,street:c.street,housenumber:c.house,flatnumber:c.flat,postcode:c.zip,city:c.city,email:c.email,phone:c.phone,...existing.recipient};
  $('main').innerHTML='<h1>Polkurier · '+esc(order.number)+'</h1>'+button('order','Wróć do zamówienia',order.id)+
    '<form id="shipment">'+group('Odbiorca',pkAddressInputs('recipient_',recipient))+
    group('Nadawca',pkAddressInputs('sender_',existing.sender||data.polkurierSender))+
    group('Zapakowane przesyłki',select('shipmenttype','Rodzaj',['box','palette'],existing.shipmenttype)+
      area('packs','Paczki – JSON (wymiary cm, waga kg)',JSON.stringify(existing.packs||[{length:Number(order.length),width:Number(order.width),height:0,weight:0,amount:1,type:'ST'}],null,2))+
      '<p>Wpisz rzeczywiste wymiary i wagę po zapakowaniu. Każda paczka jest osobnym obiektem w liście.</p>'+
      input('description','Zawartość',existing.description||'Biurko dębowe','text','required maxlength="30"')+
      num('insurance','Ubezpieczenie (zł)',existing.insurance??quote(order).price)+
      num('cod','Kwota pobrania (zł)',existing.COD?.codamount??((order.contractPayment===contractPayment[1]||order.payment==='Gotówka')?Math.max(0,quote(order).price-Number(order.paid||0)):0))+
      input('account','Konto do zwrotu pobrania',existing.COD?.codbankaccount||order.bankAccount)+
      input('pickupdate','Data podjazdu',existing.pickup?.pickupdate||today(),'date','required')+
      grid(input('from','Godzina od',existing.pickup?.pickuptimefrom||'09:00','time','required')+input('to','Godzina do',existing.pickup?.pickuptimeto||'17:00','time','required'))+
      area('additional','Pola dodatkowe przewoźnika (JSON)',JSON.stringify(existing.additional_fields||{})))+
    '<button name="operation" value="quote">Pobierz ceny</button> <button name="operation" value="draft">Zapisz przygotowanie</button>'+
    '<div id="pkQuotes"></div></form><section>'+input('linkedOrder','Numer istniejącego zlecenia Polkurier',order.carrierOrder)+
    button('pkRefresh','Pobierz numer przesyłki i status',order.id)+' '+button('pkLabel','Pobierz etykietę PDF',order.id)+
    '<p id="pkStatus" role="status">'+esc(order.tracking||'')+'</p></section>';
  let quotes=[],quotedPayload;
  const form=$('shipment');
  function read(){
    if(!form.reportValidity())throw Error('Uzupełnij wymagane pola.');
    const v=values(form);
    function addr(prefix){return {...Object.fromEntries(Object.keys(pkAddressFields).map(k=>[k,v[prefix+k]])),country:'PL'};}
    for(const prefix of ['sender_','recipient_']) {
      if(!/^\d{2}-\d{3}$/.test(v[prefix+'postcode']))throw Error('Kod pocztowy musi mieć format 00-000.');
    }
    const packs=JSON.parse(v.packs);
    if(!Array.isArray(packs)||!packs.length||packs.some(p=>!['length','width','height','weight','amount'].every(k=>Number(p[k])>0)||!Number.isInteger(Number(p.amount))))throw Error('Uzupełnij dodatnie wymiary, wagę i liczbę paczek.');
    const additional=JSON.parse(v.additional);
    if(!additional||Array.isArray(additional)||typeof additional!=='object')throw Error('Pola dodatkowe muszą być obiektem JSON.');
    const result={shipmenttype:v.shipmenttype,description:v.description,sender:addr('sender_'),recipient:addr('recipient_'),packs,insurance:Number(v.insurance),pickup:{pickupdate:v.pickupdate,pickuptimefrom:v.from,pickuptimeto:v.to,nocourierorder:false},additional_fields:additional};
    if(Number(v.cod)>0){
      const account=v.account.replace(/s/g,'');
      if(!/^d{26}$/.test(account))throw Error('Podaj 26 cyfr konta do zwrotu pobrania.');
      result.COD={codtype:'S',codamount:Number(v.cod),codbankaccount:account,return_cod:'BA'};
    }
    if(v.from>=v.to)throw Error('Godzina końcowa musi być późniejsza niż początkowa.');
    return result;
  }
  function saveDraft(payload){if(space!==workspace)throw Error('Zmieniono przestrzeń. Otwórz przesyłkę ponownie.');order.shipmentDraft=payload;save();}
  form.onsubmit=async e=>{
    e.preventDefault();
    const control=e.submitter;
    try {
      control.disabled=true;
      const payload=read();saveDraft(payload);
      if(control.value==='draft'){$('pkStatus').textContent='Zapisano przygotowanie przesyłki.';return;}
      const result=await pkCall('order_valuation_v2',payload);
      if(space!==workspace)return;
      quotes=result.filter(q=>q.available===true&&q.shipment!==false);
      quotedPayload=JSON.stringify(payload);
      $('pkQuotes').innerHTML=quotes.length?quotes.map((q,i)=>'<p>'+esc(q.servicename||q.serviceName||q.servicecode)+' · '+money(q.grossprice)+' brutto <button type="button" data-pk-create="'+i+'">Zleć kuriera</button></p>').join(''):'Brak dostępnych usług dla podanych parametrów.';
    }catch(error){$('pkStatus').textContent=error.message;}
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
