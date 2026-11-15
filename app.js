'use strict';
const $ = id => document.getElementById(id);
const esc = value => String(value ?? '').replace(/[&<>"']/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
const money = value => new Intl.NumberFormat('pl-PL',{style:'currency',currency:'PLN'}).format(value);
const today = () => new Date().toLocaleDateString('sv-SE');
const id = () => crypto.randomUUID();
const statuses = ['Oferta','Potwierdzone','W realizacji','Gotowe do wysyłki','Wysłane','Zakończone','Anulowane'];
const stages = ['Zamówienie blatu','Zamówienie stelaża','Zamówienie akcesoriów','Transport, malowanie i otwory','Pakowanie i wysyłka'];
const colors = ['Bezbarwny matowy','Bezbarwny połysk','Dąb bielony','Teak','Terra','Orzech','Inny'];
const fields = {first:'Imię',last:'Nazwisko',email:'E-mail',phone:'Telefon',company:'Nazwa firmy',nip:'NIP'};
const addressFields = {zip:'Kod pocztowy',city:'Miasto',street:'Ulica',house:'Numer domu',flat:'Numer lokalu'};
const rateLabels = {top:'Blat dla klienta / m²',wood:'Drewno / m³',thickness:'Grubość / cm',single:'Stelaż 1 silnik',double:'Stelaż 2 silniki lub 4 nogi',cut:'Podcięcie',ship:'Wysyłka',singleCost:'Koszt stelaża 1 silnik',doubleCost:'Koszt stelaża 2 silniki lub 4 nogi',cutCost:'Koszt podcięcia',shipCost:'Koszt wysyłki'};
const fresh = () => ({schema:1,clients:[],orders:[],expenses:[],rates:{top:1300,wood:15000,thickness:4,single:500,double:800,cut:50,ship:50,singleCost:500,doubleCost:800,cutCost:50,shipCost:50},templates:[{name:'Oferta',subject:'Oferta Lity Dąb {{numer}}',body:'Dzień dobry {{imię}},\n\nCena biurka {{wymiary}} to {{cena}}.\n\nPozdrawiamy,\nLity Dąb'},{name:'Umowa',subject:'Umowa {{numer}}',body:'Dzień dobry {{imię}},\n\nw załączeniu przesyłamy umowę na wykonanie biurka.\n\nPozdrawiamy,\nLity Dąb'}]});
function deadline(sent) {
  if(!sent) return '';
  const day=new Date(sent+'T00:00:00Z');
  day.setUTCDate(day.getUTCDate()+14);
  return day.toISOString().slice(0,10);
}
function nextNumber(date,orders) {
  const prefix=date.replaceAll('-','');
  const used=new Set(orders.map(o=>o.number));
  for(let n=1;n<=99;n++) {
    const number=prefix+String(n).padStart(2,'0');
    if(!used.has(number)) return number;
  }
  return '';
}
function addDays(date,days) {
  const day=new Date(date+'T00:00:00Z');
  if(!Number.isFinite(day.getTime())) return '';
  day.setUTCDate(day.getUTCDate()+days);
  return day.toISOString().slice(0,10);
}
function realizationPlan(date,steps) {
  const supply=addDays(date,7);
  const completed=(index,fallback)=>steps[index]?.state==='Gotowe'&&steps[index].date?steps[index].date:fallback;
  const preparation=addDays(completed(0,supply),4);
  const ready=[completed(1,supply),completed(2,supply),completed(3,preparation)].sort().at(-1);
  return [supply,supply,supply,preparation,addDays(ready,1)];
}
function addDemoExpenses() {
  if(space!=='demo') return false;
  let added=false;
  const examples=[
    ['DEMO-002','Zakup stelaża',485],
    ['DEMO-003','Zakup blatu',615],
    ['DEMO-004','Akcesoria montażowe',95],
    ['DEMO-005','Transport blatu',120],
    ['DEMO-006','Pakowanie i wysyłka',145]
  ];
  for(const [number,name,amount] of examples) {
    const order=data.orders.find(o=>o.previousNumber===number);
    const id='demo-expense-'+number;
    if(!order||data.expenses.some(e=>e.id===id)) continue;
    data.expenses.push({id,date:order.date,name,amount,order:order.id});
    added=true;
  }
  return added;
}
function normalize() {
  data.tasks ??= [];
  for(const o of data.orders) {
    if(!/^\d{10}$/.test(o.number)) {
      const number=nextNumber(o.date,data.orders);
      if(number) {o.previousNumber=o.number;o.number=number;}
    }
  }
}
const contractPayment=['Przelew na konto','Opłata za pobraniem u kuriera (gotówka)'];
const shippingPayers=['Po stronie przyjmującego zamówienie','Po stronie zamawiającego'];
const stepStates=['Do zrobienia','W toku','Gotowe','Nie dotyczy'];
const fontSizes=[85,90,100,110,125,140];
const scales=[70,80,90,100,110,125];
function setDisplay(name,value) {
  document.documentElement.style.setProperty('--'+name,value/100);
  localStorage.setItem('litydab:'+name,value);
}
function estimatedCost(o) {
  const {top,frame,basket,shipping,other}=orderCosts(o);
  return top+frame+basket+shipping+other;
}
function orderCosts(o, useOverrides=true) {
  const r=o.rates;
  const automatic=Math.round(o.length*o.width*r.thickness*r.wood/10000)/100;
  const cost=(value,fallback)=>useOverrides&&value!=null&&value!==''?Number(value):fallback;
  return {
    top:cost(o.topCost,automatic),
    frame:cost(o.frameCost,Number(o.motors==='2'?r.doubleCost:r.singleCost)),
    basket:cost(o.basketCost,o.basket?.trim()?Number(r.basketCost||0):0),
    shipping:cost(o.shippingCost,Number(r.shipCost)),
    other:Number(o.extraCost||0)+(o.additionalCosts||[]).reduce((sum,c)=>sum+Number(c.amount),0)
  };
}
function quote(o, withoutDiscount=false) {
  const area = o.length * o.width / 10000;
  const r = o.rates;
  const large = o.motors === '2' || o.frame === '4 nogi';
  const subtotal=area*r.top+r[large?'double':'single']+(o.cut==='Brak'?0:r.cut)+r.ship+Number(o.extraPrice||0);
  const base=Math.round(subtotal*100)/100;
  const discount=withoutDiscount?0:o.discountMode==='percent'?base*Number(o.discountPercent||0)/100:Number(o.discountAmount||0);
  return {price:!withoutDiscount&&o.offerPrice!=null&&o.offerPrice!==''?Number(o.offerPrice):Math.round(Math.max(0,base-discount)*100)/100,cost:estimatedCost(o)};
}
function sample() {
  const data = fresh();
  const names = ['Alicja Testowa','Bartosz Przykładowy','Celina Testowa','Damian Przykładowy','Ewa Testowa','Filip Przykładowy','Gabriela Testowa','Hubert Przykładowy','Iga Testowa','Jan Przykładowy'];
  names.forEach((name,i) => {
    const [first,last] = name.split(' ');
    const client = {id:id(),first,last,email:'demo'+(i+1)+'@example.invalid',zip:'00-001',city:['Warszawa','Poznań','Kraków','Gdańsk','Wrocław'][i%5],street:'Przykładowa',house:String(i+1),same:true};
    const date = new Date(Date.now()-i*864000000).toLocaleDateString('sv-SE');
    const order = {id:id(),number:'DEMO-'+String(i+1).padStart(3,'0'),clientId:client.id,client,date,due:new Date(Date.now()+(i-4)*86400000).toLocaleDateString('sv-SE'),deposit:i%2?200:0,status:statuses[i%7],length:120+i%9*5,width:60+i%5*5,color:colors[i%6],cut:['Brak','Zwykłe','Ostre'][i%3],grommet:i%2===0,frameColor:['Czarny','Biały','Szary'][i%3],motors:String(1+i%2),frame:i%3?'2 nogi T':'4 nogi',payment:i%2?'Gotówka':'Przelew',paid:0,extraCost:i*10,extraPrice:i*15,rates:{...data.rates},steps:stages.map((_,j)=>({state:j<i%6?'Gotowe':'Do zrobienia',date:j<i%6?date:'',note:''}))};
    if(i%7===5) {order.paid=quote(order).price;order.paidDate=date;}
    if(i%7===4 || i%7===5) order.tracking='DEMO-LIST-'+(i+1);
    data.clients.push(client);
    data.orders.push(order);
  });
  data.expenses=[{id:id(),date:today(),name:'Zakup blatu',amount:540,order:data.orders[0].id},{id:id(),date:today(),name:'Zakup stelaża',amount:500,order:data.orders[0].id},{id:id(),date:today(),name:'Olej do blatów',amount:190,order:''},{id:id(),date:today(),name:'Materiały pakownicze',amount:75,order:''}];
  return data;
}
const pages = ['Zamówienia','Baza klientów','Koszty i przychody','Ustawienia','Zadania'];
const themes=['Jasny','Dębowy','Leśny','Ciemny','Niebiesko-biały'];
const sizes=['120 x 60','125 x 60','130 x 65','140 x 70','160 x 80'];
let space=localStorage.getItem('litydab:space')==='firma'?'firma':'demo', page=0, data;
let theme=localStorage.getItem('litydab:theme')||'Jasny';
document.documentElement.dataset.theme=theme;
for(const [name,options] of [['font',fontSizes],['scale',scales]]) {
  const stored=Number(localStorage.getItem('litydab:'+name));
  document.documentElement.style.setProperty('--'+name,(options.includes(stored)?stored:100)/100);
}
const key = () => 'litydab:'+space;
function load() { data = JSON.parse(localStorage.getItem(key()) || 'null') || (space==='demo'?sample():fresh()); normalize(); const added=addDemoExpenses(); if(added||!localStorage.getItem(key())) save(); }
function save() { try { localStorage.setItem(key(),JSON.stringify(data)); } catch(error) { data=JSON.parse(localStorage.getItem(key()) || 'null') || fresh(); alert('Zapis się nie powiódł. Sprawdź dostępne miejsce.'); throw error; } }
function render() {
  $('nav').innerHTML=pages.map((p,i)=>'<button class="'+(i===page?'active':'')+'" data-page="'+i+'">'+p+'</button>').join('');
  [orders,clients,finance,settings,tasks][page]();
}
const input = (name,label,value='',type='text',attrs='') => '<label>'+label+'<input name="'+name+'" value="'+esc(value)+'" type="'+type+'" '+attrs+'></label>';
const num = (name,label,value=0,min=0) => input(name,label,value,'number','required min="'+min+'" step="0.01"');
const select = (name,label,options,value) => '<label>'+label+'<select name="'+name+'">'+options.map(option=>'<option '+(String(value)===String(option)?'selected':'')+'>'+esc(option)+'</option>').join('')+'</select></label>';
const area = (name,label,value='') => '<label>'+label+'<textarea name="'+name+'">'+esc(value)+'</textarea></label>';
const check = (name,label,value) => '<label class="check"><input type="checkbox" name="'+name+'" '+(value?'checked':'')+'> '+label+'</label>';
const grid = html => '<div class="grid">'+html+'</div>';
const group = (title,html) => '<fieldset><legend>'+title+'</legend>'+html+'</fieldset>';
const button = (action,label,value='') => '<button type="button" data-action="'+action+'" data-id="'+esc(value)+'">'+label+'</button>';
const table = (headers,rows) => '<div class="table"><table><thead><tr>'+headers.map(h=>'<th>'+h+'</th>').join('')+'</tr></thead><tbody>'+rows.map(row=>'<tr>'+row.map(cell=>'<td>'+cell+'</td>').join('')+'</tr>').join('')+'</tbody></table></div>';
const person = c => [c.first,c.last].join(' ');
const address = c => [[c.street,c.house].filter(Boolean).join(' ')+(c.flat?'/'+c.flat:''),[c.zip,c.city].filter(Boolean).join(' ')].filter(Boolean).join(', ');
const values = f => Object.fromEntries(new FormData(f));
const put = (list,item) => {const i=list.findIndex(x=>x.id===item.id); if(i<0) list.push(item); else list[i]=item;};
function orderCost(orderId) {
  return data.expenses.reduce((sum,expense)=>sum+(expense.order===orderId?Math.round(Number(expense.amount)*100):0),0)/100;
}
function orders() {
  let status='';
  $('main').innerHTML='<div class="order-toolbar"><input id="search" placeholder="Numer, klient lub adres" aria-label="Szukaj zamówień">'+button('order','Nowe zamówienie')+'</div><div id="statusButtons" role="group" aria-label="Filtr statusu">'+
    ['',...statuses].map(value=>'<button type="button" class="'+(value?'status status-'+statuses.indexOf(value):'')+'" data-status="'+value+'" aria-pressed="'+!value+'">'+(value||'Wszystkie')+'</button>').join('')+'</div><section id="orderRows"></section>';
  const draw = () => {
    const search = $('search').value.toLocaleLowerCase('pl');
    const rows = data.orders.filter(o=>(!status||o.status===status)&&[o.number,person(o.client),address(o.client),o.previousNumber].join(' ').toLocaleLowerCase('pl').includes(search)).sort((a,b)=>b.date.localeCompare(a.date));
    $('orderRows').innerHTML=rows.length?table(['Numer','Klient i dostawa','Status','Data zamówienia','Termin','Oferta','Koszt','Dochód'],rows.map(o=>['<a href="#zamowienie-'+esc(o.id)+'" data-action="order" data-id="'+esc(o.id)+'">'+esc(o.number)+'</a>',esc(person(o.client))+'<br><small>'+esc(address(o.client))+'</small>','<span class="status status-'+statuses.indexOf(o.status)+'">'+esc(o.status)+'</span>',esc(o.date),esc(o.contractSent?deadline(o.contractSent):o.due),money(quote(o).price),money(orderCost(o.id)),money(quote(o).price-orderCost(o.id))])):'Brak zamówień dla wybranych filtrów.';
  };
  $('search').oninput=draw;
  $('statusButtons').onclick=e=>{
    const filter=e.target.closest('button[data-status]');
    if(!filter) return;
    status=filter.dataset.status;
    for(const control of $('statusButtons').children) control.setAttribute('aria-pressed',String(control===filter));
    draw();
  };
  draw();
}
const fold=(label,html,open=false)=>'<details class="form-section" '+(open?'open':'')+'><summary>'+label+'</summary>'+html+'</details>';
function billingAddress(c) {
  return address(Object.fromEntries(Object.keys(addressFields).map(k=>[k,c['bill_'+k]||''])));
}
function bindAddress() {
  const checkbox=$('editor').elements.same;
  const billing=$('editor').querySelector('.billing');
  const update=()=>{billing.hidden=checkbox.checked;billing.disabled=checkbox.checked;};
  checkbox.onchange=update;update();
}
function clientFields(c,collapse=false) {
  const section=collapse?fold:group;
  return section('Dane klienta',grid(Object.entries(fields).map(([key,label])=>input(key,label,c[key],key==='email'?'email':key==='phone'?'tel':'text',key==='first'||key==='last'?'required':'')).join('')))+
    section('Adres klienta / dostawy',grid(Object.entries(addressFields).map(([key,label])=>input(key,label,c[key])).join('')))+
    check('same','Adres faktury taki sam jak wysyłki',c.same!==false)+
    '<fieldset class="billing"><legend>Adres faktury</legend>'+grid(Object.entries(addressFields).map(([key,label])=>input('bill_'+key,label,c['bill_'+key])).join(''))+'</fieldset>';
}
function clients() {
  $('main').innerHTML='<h1>Baza klientów</h1>'+button('client','Nowy klient')+table(['Imię','Nazwisko','E-mail','Telefon','Adres klienta / faktury',''],data.clients.map(c=>[esc(c.first),esc(c.last),esc(c.email),esc(c.phone),esc(address(c))+(c.same===false?'<br><small>Faktura: '+esc(billingAddress(c))+'</small>':''),button('client','Otwórz',c.id)]));
}
function clientForm(clientId) {
  const c=data.clients.find(x=>x.id===clientId)||{};
  $('main').innerHTML='<h1>'+esc(clientId?person(c):'Nowy klient')+'</h1><form id="editor">'+clientFields(c)+'<button>Zapisz klienta</button></form>';
  bindAddress();
  $('editor').onsubmit=e=>{e.preventDefault();put(data.clients,{...values(e.target),same:e.target.elements.same.checked,id:c.id||id()});save();clients();};
}
function orderForm(orderId) {
  const o=data.orders.find(x=>x.id===orderId)||{date:today(),due:'',length:120,width:60,rates:{...data.rates},steps:[]};
  const c=o.client||{};
  const customCosts=[...(o.additionalCosts||[])];
  const dimensions=o.length+' x '+o.width;
  $('main').innerHTML='<h1>'+esc(o.number||'Nowe zamówienie')+'</h1><form id="editor">'+
    '<section aria-label="Podsumowanie zamówienia">Przychód <strong id="orderRevenue"></strong> · Koszt <strong id="orderTotalCost"></strong> · Dochód <strong id="orderProfit"></strong></section>'+grid(input('date','Data zamówienia',o.date,'date','required')+input('contractSent','Data wysłania umowy',o.contractSent,'date')+input('due','Termin realizacji',o.due,'date','readonly')+select('status','Status',statuses,o.status))+
    fold('Klient i adresy','<label>Wybierz klienta<select id="customer"><option value="">Nowy klient</option>'+data.clients.map(x=>'<option value="'+esc(x.id)+'" '+(x.id===o.clientId?'selected':'')+'>'+esc(person(x))+'</option>').join('')+'</select></label><div id="customerFields">'+clientFields(c,true)+'</div>',true)+
    fold('Parametry blatu',select('size','Wymiary blatu (cm)',[...sizes,'Custom'],sizes.includes(dimensions)?dimensions:'Custom')+
    '<div id="customSize">'+grid(num('length','Długość (cm)',o.length,0.01)+num('width','Szerokość (cm)',o.width,0.01))+'</div>'+grid(select('color','Kolor',colors,o.color)+input('customColor','Własny kolor',o.customColor)+select('cut','Podcięcie',['Brak','Zwykłe','Ostre'],o.cut)+select('grommet','Przelotka na kable',['Nie','Tak'],o.grommet?'Tak':'Nie'))+grid(input('edge','Krawędź przednia',o.edge)+input('basket','Kosz na kable (typ / kolor)',o.basket))+area('notes','Dodatkowe ustalenia',o.notes).replace('<textarea','<textarea rows="1" class="order-notes"'))+
    fold('Parametry stelażu',grid(select('frameColor','Kolor',['Czarny','Biały','Szary'],o.frameColor)+select('motors','Liczba silników',['1','2'],o.motors)+select('frame','Typ',['2 nogi T','4 nogi'],o.frame)))+
    group('Wycena i płatność',grid(input('offerPrice','Oferta dla klienta (zł)',o.offerPrice,'number','min="0" step="0.01" placeholder="Z wyceny"')+select('payment','Płatność',['Przelew','Gotówka'],o.payment)+num('paid','Wpłacono (zł)',o.paid)+input('paidDate','Data wpłaty',o.paidDate,'date'))+group('Zniżka',grid('<label>Podstawa zniżki<select name="discountMode"><option value="amount">Kwota</option><option value="percent" '+(o.discountMode==='percent'?'selected':'')+'>Procent</option></select></label>'+num('discountAmount','Zniżka (zł)',o.discountAmount)+num('discountPercent','Zniżka (%)',o.discountPercent)))+fold('Dodatkowa pozycja',grid(input('extraLabel','Dodatkowa pozycja',o.extraLabel)+num('extraPrice','Dodatkowa cena (zł)',o.extraPrice)),Boolean(o.extraLabel||Number(o.extraPrice)))+'<output id="quote"></output>'+fold('Koszt tego zamówienia',
      grid([
        ['topCost','Blat (zł)'],['frameCost','Stelaż (zł)'],
        ['basketCost','Kosz na kable (zł)'],['shippingCost','Wysyłka (zł)']
      ].map(([key,label])=>input(key,label,o[key],'number','min="0" step="0.01"')).join('')+
        num('extraCost','Dodatkowy koszt (zł)',o.extraCost)+input('extraCostDescription','Opis dodatkowego kosztu',o.extraCostDescription??(Number(o.extraCost)?o.extraLabel:'')))+
      '<p class="muted">Wyczyść pole blatu, stelaża, kosza lub wysyłki, aby wrócić do wartości domyślnej.</p>'+
      '<div id="orderCosts"></div><label>Dodaj koszt z cennika<select id="chooseCost"><option value="">Wybierz koszt</option>'+
      (data.rates.customCosts||[]).map((c,i)=>'<option value="'+i+'">'+esc(c.label)+' · '+money(c.amount)+'</option>').join('')+'</select></label>')+
      check('invoice','Wymagana faktura',o.invoice))+
    group('Parametry umowy','<div class="contract-fields">'+grid(select('shippingPayer','Koszty wysyłki',shippingPayers,o.shippingPayer)+
      select('contractPayment','Płatność w dniu odbioru dzieła',contractPayment,o.contractPayment||(o.payment==='Gotówka'?contractPayment[1]:contractPayment[0]))+
      input('bankAccount','Numer konta',o.bankAccount??(space==='firma'?'59 1750 0012 0000 0000 2741 2987':''))+num('deposit','Zaliczka w umowie (zł)',o.deposit))+'</div>')+
    group('Realizacja',stages.map((name,i)=>grid(input('plan'+i,'Planowany termin','','date','readonly')+select('step'+i,name,stepStates,o.steps[i]?.state)+input('stepDate'+i,'Data wykonania',o.steps[i]?.date,'date')+input('stepNote'+i,'Notatka',o.steps[i]?.note))).join(''))+
    group('Przesyłka',grid(input('carrierOrder','Numer zlecenia Polkurier',o.carrierOrder)+input('tracking','Numer listu przewozowego',o.tracking)+input('trackUrl','Adres śledzenia',o.trackUrl,'url')+input('shippingStatus','Status przesyłki',o.shippingStatus))+( /^https?:\/\//i.test(o.trackUrl||'')?'<p><a href="'+esc(o.trackUrl)+'" target="_blank" rel="noopener">Śledź przesyłkę</a></p>':''))+
    (orderId?'<section><label>Dodaj pliki do folderu zamówienia <input type="file" id="orderFiles" multiple></label></section>':'')+
    '<button>Zapisz zamówienie</button> <button name="generate" value="contract">Zapisz i wygeneruj umowę PDF</button> '+(orderId?button('offer','Oferta / PDF',o.id)+' '+button('email','Przygotuj e-mail',o.id):'')+'</form>';
  $('customer').onchange=()=>{$('customerFields').innerHTML=clientFields(data.clients.find(x=>x.id===$('customer').value)||{},true);bindAddress();};
  bindAddress();
  const read = () => {
    const f=$('editor'), v=values(f);
    const rates={...o.rates,basketCost:o.rates.basketCost??data.rates.basketCost??0};
    const client={id:$('customer').value||c.id||id(),same:f.elements.same.checked};
    for(const key of [...Object.keys(fields),...Object.keys(addressFields),...Object.keys(addressFields).map(k=>'bill_'+k)]) {client[key]=v[key]; delete v[key];}
    Object.keys(rateLabels).forEach(key=>delete v['rate_'+key]);
    const steps=stages.map((_,i)=>({state:v['step'+i],date:v['stepDate'+i],note:v['stepNote'+i]}));
    for(const key of Object.keys(v).filter(k=>/^(step|plan)/.test(k))) delete v[key];
    delete v.same;
    return {...o,...v,client,clientId:client.id,rates,steps,invoice:f.elements.invoice.checked,grommet:v.grommet==='Tak',additionalCosts:customCosts};
  };
  const update = () => {
    const item=read();
    const {price,cost}=quote(item);
    const profit=price-cost;
    $('orderRevenue').textContent=money(price);
    $('orderTotalCost').textContent=money(cost);
    $('orderProfit').textContent=money(profit);
    $('quote').textContent='Oferta '+money(price)+' · koszt szacowany '+money(cost)+' · marża '+money(profit)+' · do zapłaty '+money(Math.max(0,price-Number(item.paid)));
  };
  const form=$('editor');
  if(orderId) $('orderFiles').onchange=async e=>{
    const control=e.target;
    try {
      const folder=await createOrderFolder(o,space);
      if(!folder) throw Error('Wybierz folder plików w ustawieniach.');
      for(const file of control.files) {
        let name=file.name;
        let suffix=1;
        while(true) {
          try { await folder.getFileHandle(name); }
          catch(error) { if(error.name==='NotFoundError') break; throw error; }
          name=suffix+++' - '+file.name;
        }
        await writeFile(folder,name,file);
      }
      alert('Zapisano pliki w folderze '+folder.name+'.');
    } catch(error){alert(error.message);}
    finally {control.value='';}
  };
  const notes=form.elements.notes;
  function resizeNotes() {
    notes.style.height='auto';
    notes.style.height=notes.scrollHeight+2+'px';
  }
  notes.addEventListener('input',resizeNotes);
  notes.closest('details').addEventListener('toggle',resizeNotes);
  notes.addEventListener('keydown',e=>{
    if(e.key==='Enter'&&!e.shiftKey) e.preventDefault();
  });
  function showCosts() {
    $('orderCosts').innerHTML=customCosts.map((c,i)=>'<p>'+esc(c.label)+' · '+money(c.amount)+' <button type="button" data-cost-index="'+i+'">Usuń</button></p>').join('');
  }
  showCosts();
  $('chooseCost').onchange=e=>{
    if(e.target.value==='') return;
    customCosts.push({...data.rates.customCosts[Number(e.target.value)]});
    e.target.value='';showCosts();syncDiscount();
  };
  $('orderCosts').onclick=e=>{
    const control=e.target.closest('[data-cost-index]');
    if(!control) return;
    customCosts.splice(Number(control.dataset.costIndex),1);showCosts();syncDiscount();
  };
  function syncDiscount() {
    const fields=form.elements;
    const base=quote(read(),true).price;
    const amount=fields.discountAmount, percent=fields.discountPercent;
    if(fields.discountMode.value==='percent') amount.value=(base*Number(percent.value)/100).toFixed(2);
    else percent.value=base?(Number(amount.value)*100/base).toFixed(2):'0';
    const selected=fields.contractSent.value;
    fields.due.value=selected?deadline(selected):o.contractSent?'':o.due||'';
    const item=read();
    const defaults=orderCosts(item,false);
    for(const key of ['top','frame','basket','shipping']) {
      fields.namedItem(key+'Cost').placeholder=defaults[key].toFixed(2);
    }
    const offer=fields.offerPrice;
    offer.placeholder=String(quote({...item,offerPrice:''}).price);
    item.steps.forEach((step,i)=>{
      fields.namedItem('step'+i).dataset.stepStatus=stepStates.indexOf(step.state);
    });
    realizationPlan(fields.date.value,item.steps).forEach((date,i)=>{
      fields.namedItem('plan'+i).value=date;
    });
    update();
  }
  const size=form.elements.size;
  function updateSize() {
    const custom=size.value==='Custom';
    $('customSize').hidden=!custom;
    if(!custom) {
      const [length,width]=size.value.split(' x ');
      form.elements.namedItem('length').value=length;
      form.elements.namedItem('width').value=width;
    }
  }
  updateSize();
  form.oninput=e=>{
    if(e.target===size) updateSize();
    if(e.target.name==='discountAmount') form.elements.discountMode.value='amount';
    if(e.target.name==='discountPercent') form.elements.discountMode.value='percent';
    syncDiscount();
  };
  form.addEventListener('invalid',e=>{for(let parent=e.target.parentElement;parent&&parent!==form;parent=parent.parentElement) if(parent.tagName==='DETAILS') parent.open=true;},true);
  syncDiscount();
  $('editor').onsubmit=async e=>{
    e.preventDefault();
    const item=read();
    if(item.color==='Inny' && !item.customColor.trim()) { alert('Wpisz własny kolor blatu.'); return; }
    if(Number(item.deposit)>quote(item).price) {alert('Zaliczka przekracza cenę zamówienia.');return;}
    if(Number(item.paid)>0 && !item.paidDate) {alert('Podaj datę wpłaty.');return;}
    if(!$('customer').value && !o.id) item.client.id=item.clientId=id();
    if(!$('customer').value && o.id && item.clientId===o.clientId) item.client.id=item.clientId=id();
    item.id=o.id||id();
    if(Number(item.discountAmount)>quote(item,true).price||Number(item.discountPercent)>100){alert('Zniżka nie może przekraczać wartości oferty.');return;}
    item.number=o.date===item.date&&o.number?o.number:nextNumber(item.date,data.orders);
    if(!item.number){alert('Dla tej daty wykorzystano wszystkie numery od 01 do 99.');return;}
    if(!data.clients.some(x=>x.id===item.clientId)) data.clients.push(item.client);
    const workspace=space;
    item.folderName ||= orderFolderName(item);
    put(data.orders,item);save();
    const generate=e.submitter?.value==='contract';
    const section=generate?contract(item):null;
    if(!generate) orders();
    try {
      const folder=await createOrderFolder(item,workspace);
      if(generate) await saveContractPdf(item,folder,section,workspace);
    } catch(error) {
      alert('Zamówienie zapisano. Zapis w folderze nie powiódł się. '+error.message);
    }
  };
}
function tasks() {
  const ordered=[...data.tasks].sort((a,b)=>Number(a.done)-Number(b.done)||(a.due||'9999').localeCompare(b.due||'9999'));
  $('main').innerHTML='<h1>Zadania</h1><section><form id="taskForm">'+grid(input('title','Co planujesz zrobić?','','text','required')+input('due','Termin','','date'))+'<p><button>Dodaj zadanie</button></p></form></section><section>'+
    (ordered.length?ordered.map(t=>'<p><label><input type="checkbox" data-task="'+esc(t.id)+'" '+(t.done?'checked':'')+'> '+esc(t.title)+(t.due?' · '+esc(t.due):'')+'</label> '+button('removeTask','Usuń',t.id)+'</p>').join(''):'<p>Brak zadań.</p>')+'</section>';
  $('taskForm').onsubmit=e=>{e.preventDefault();const task=values(e.target);task.title=task.title.trim();if(!task.title)return;data.tasks.push({...task,id:id(),done:false});save();tasks();};
  $('main').querySelectorAll('[data-task]').forEach(box=>box.onchange=()=>{data.tasks.find(t=>t.id===box.dataset.task).done=box.checked;save();tasks();});
}
function finance() {
  $('main').innerHTML='<h1>Koszty i przychody</h1>'+grid('<label>Od <input id="from" type="date"></label><label>Do <input id="to" type="date"></label><label>Wykres <select id="metric"><option value="0">Wpłaty</option><option value="1">Wydatki</option><option value="2">Wynik kasowy</option><option value="3">Przychody z zamówień</option></select></label>')+'<section id="totals"></section><section><h2>Wydatki</h2><form id="expense">'+grid(input('date','Data',today(),'date','required')+input('name','Opis lub kategoria','','text','required')+num('amount','Kwota',0,0.01)+'<label>Powiązanie<select name="order"><option value="">Wydatek ogólny</option>'+data.orders.map(o=>'<option value="'+esc(o.id)+'">'+esc(o.number)+'</option>').join('')+'</select></label>')+'<p><button>Dodaj wydatek</button></p></form><div id="expenseRows"></div></section>';
  const draw=()=>{
    const within=d=>d&&(!$('from').value||d>=$('from').value)&&(!$('to').value||d<=$('to').value);
    const expenses=data.expenses.filter(x=>within(x.date));
    const orders=data.orders.filter(x=>within(x.date)&&x.status!=='Anulowane');
    const monthly={};
    const bucket=d=>monthly[d.slice(0,7)]??=[0,0,0];
    let income=0, costs=0;
    for(const o of data.orders.filter(x=>within(x.paidDate))) {income+=Number(o.paid||0);bucket(o.paidDate)[0]+=Number(o.paid||0);}
    for(const x of expenses) {costs+=Number(x.amount);bucket(x.date)[1]+=Number(x.amount);}
    for(const o of orders) bucket(o.date)[2]+=quote(o).price;
    const metric=Number($('metric').value);
    const bars=Object.entries(monthly).sort().map(([m,[a,b,revenue]])=>[m,[a,b,a-b,revenue][metric]]);
    const scale=Math.max(1,...bars.map(([,n])=>Math.abs(n)));
    $('totals').innerHTML='<strong>Wpłaty '+money(income)+' · wydatki '+money(costs)+' · wynik kasowy '+money(income-costs)+'</strong><p>Przychody z zamówień według ofert '+money(orders.reduce((a,o)=>a+quote(o).price,0))+'</p>'+bars.map(([m,n])=>'<div>'+m+' · '+money(n)+'<progress aria-label="'+m+'" max="'+scale+'" value="'+Math.abs(n)+'"></progress></div>').join('');
    $('expenseRows').innerHTML=table(['Data','Opis','Zamówienie','Kwota'],expenses.map(x=>[esc(x.date),esc(x.name),esc(data.orders.find(o=>o.id===x.order)?.number||'Ogólny'),money(x.amount)]));
  };
  for(const field of ['from','to','metric']) $(field).onchange=draw;
  $('expense').onsubmit=e=>{e.preventDefault();data.expenses.push({...values(e.target),id:id()});save();finance();};draw();
}
function settings() {
  $('main').innerHTML='<h1>Ustawienia</h1><section><h2>Wygląd i przestrzeń</h2>'+
    grid('<label>Motyw<select id="theme">'+themes.map(value=>'<option>'+value+'</option>').join('')+'</select></label>'+select('font','Wielkość czcionki',fontSizes.map(n=>n+'%'),(localStorage.getItem('litydab:font')||100)+'%')+select('scale','Skala interfejsu',scales.map(n=>n+'%'),(localStorage.getItem('litydab:scale')||100)+'%')+'<label>Przestrzeń<select id="space"><option value="demo">Demonstracyjna</option><option value="firma">Firmowa</option></select></label>')+'</section><section><h2>Wersja aplikacji</h2><p>Lity Dąb Backoffice <strong>v0.1.11</strong></p><p><a href="CHANGELOG.md" target="_blank" rel="noopener">Historia wydań</a></p></section><section><h2>Cennik</h2><form id="rates">'+grid(Object.entries({...rateLabels,basketCost:'Kosz na kable'}).map(([k,l])=>num(k,l,data.rates[k],k==='thickness'?0.01:0)).join(''))+'<p><button>Zapisz stawki domyślne</button></p></form>'+
    '<h3>Dodatkowe koszty</h3>'+table(['Nazwa','Koszt (zł)',''],(data.rates.customCosts||[]).map((c,i)=>[esc(c.label),money(c.amount),button('removeCost','Usuń',i)]))+
    '<form id="catalog">'+grid(input('label','Nazwa kosztu','','text','required')+num('amount','Koszt (zł)'))+'<p><button>Dodaj koszt do cennika</button></p></form></section>'+
    '<section><h2>Szablony wiadomości</h2><p class="muted">Pola: {{imię}}, {{numer}}, {{wymiary}}, {{cena}}, {{przesyłka}}</p>'+data.templates.map((t,i)=>fold(esc(t.name),'<form class="template" data-index="'+i+'">'+input('name','Nazwa',t.name,'text','required')+input('subject','Temat',t.subject)+area('body','Treść',t.body)+'<p><button>Zapisz</button> '+button('removeTemplate','Usuń',i)+'</p></form>')).join('')+button('addTemplate','Dodaj szablon')+'</section>'+
    '<section><h2>Umowa</h2><form id="contractTemplate">'+area('template','Treść szablonu',data.contractTemplate??defaultContractTemplate)+
    '<p class="muted">Znaczniki w podwójnych nawiasach klamrowych wstawiają dane zamówienia. Nagłówki zaczynają się od #, a --- rozpoczyna załącznik na nowej stronie.</p>'+
    '<button>Zapisz szablon umowy</button> '+button('resetContract','Przywróć oryginalny wzór')+'</form></section>'+
    '<section><h2>Logo</h2><label>Wybierz obraz <input type="file" id="logoFile" accept="image/png,image/jpeg,image/webp"></label> '+button('resetLogo','Przywróć domyślne logo')+'</section>'+
    '<section><h2>Folder plików</h2><p id="folderStatus" role="status"></p><button type="button" id="chooseFolder">Wybierz folder</button></section>'+
    '<section><h2>Kopia danych</h2><p>Obecna przestrzeń: '+esc(space)+'. Przywrócenie zastępuje dane tej przestrzeni.</p>'+button('backup','Zapisz kopię JSON','json')+' '+button('backup','Zapisz kopię CSV','csv')+' '+button('report','Eksport zamówień CSV')+
    '<div class="grid"><label>Przywróć z JSON <input type="file" id="restoreJson" accept=".json,application/json"></label>'+
    '<label>Przywróć z CSV <input type="file" id="restoreCsv" accept=".csv,text/csv"></label></div></section>';
  $('contractTemplate').onsubmit=e=>{
    e.preventDefault();
    const template=values(e.target).template.trim();
    if(!template){alert('Wpisz treść szablonu umowy.');return;}
    data.contractTemplate=template;save();alert('Zapisano szablon umowy.');
  };
  $('logoFile').onchange=e=>{
    const file=e.target.files[0];
    if(!file) return;
    if(!/^image\/(png|jpeg|webp)$/.test(file.type)||file.size>1024*1024){
      alert('Wybierz plik PNG, JPG lub WebP do 1 MB.');e.target.value='';return;
    }
    const reader=new FileReader();
    reader.onload=()=>{
      try {localStorage.setItem('litydab:logo',reader.result);applyLogo();}
      catch(error){alert('Nie udało się zapisać logo.');}
    };
    reader.readAsDataURL(file);
  };
  $('chooseFolder').onclick=chooseFolder;
  showFolder();
  $('space').value=space;
  $('space').onchange=e=>{space=e.target.value;localStorage.setItem('litydab:space',space);load();render();};
  for(const name of ['font','scale']) {
    $('main').querySelector('select[name="'+name+'"]').onchange=e=>setDisplay(name,parseInt(e.target.value,10));
  }
  $('theme').value=theme;
  $('theme').onchange=e=>{theme=e.target.value;document.documentElement.dataset.theme=theme;localStorage.setItem('litydab:theme',theme);};
  $('rates').onsubmit=e=>{e.preventDefault();Object.assign(data.rates,Object.fromEntries(Object.entries(values(e.target)).map(([k,v])=>[k,Number(v)])));save();settings();};
  $('catalog').onsubmit=e=>{
    e.preventDefault();
    const cost=values(e.target);
    if(!cost.label.trim()) return;
    (data.rates.customCosts??=[]).push({label:cost.label.trim(),amount:Number(cost.amount)});
    save();settings();
  };
  document.querySelectorAll('.template').forEach(f=>f.onsubmit=e=>{e.preventDefault();data.templates[Number(f.dataset.index)]=values(f);save();settings();});
  $('restoreJson').onchange=e=>restore(e.target,'json');
  $('restoreCsv').onchange=e=>restore(e.target,'csv');
}
async function restore(input,format) {
  const target=space;
  if(!input.files.length) return;
  try {
    const content=(await input.files[0].text()).replace(/^\uFEFF/,'');
    if(space!==target) return;
    const copy=format==='csv'?readCsvBackup(content):JSON.parse(content);
    if(copy.space!==space||!validBackup(copy.data)) throw Error('Nieprawidłowa kopia lub inna przestrzeń.');
    if(!confirm('Przywrócić kopię i zastąpić bieżące dane tej przestrzeni? Obecne dane zostaną pobrane jako JSON.')) return;
    backup('json');data=copy.data;normalize();save();settings();
  } catch(err){alert(err.message);}
  finally { input.value=''; }
}
function csvBackup() {
  const rows=[['typ','dane_json'],['meta',{space,schema:data.schema,contractTemplate:data.contractTemplate}],['rates',data.rates]];
  for(const kind of ['clients','orders','expenses','templates','tasks']) {
    for(const item of data[kind]) rows.push([kind,item]);
  }
  const cell=value=>'"'+String(value).replaceAll('"','""')+'"';
  return '\uFEFF'+rows.map(([kind,item],i)=>[cell(kind),cell(i?JSON.stringify(item):item)].join(';')).join('\r\n');
}
function readCsvBackup(content) {
  const rows=[];
  const pattern=/"((?:[^"]|"")*)";"((?:[^"]|"")*)"(?:\r?\n|$)/gy;
  let offset=0;
  while(offset<content.length) {
    pattern.lastIndex=offset;
    const row=pattern.exec(content);
    if(!row) throw Error('CSV ma nieprawidłowy format kopii Lity Dąb.');
    rows.push(row.slice(1).map(cell=>cell.replaceAll('""','"')));
    offset=pattern.lastIndex;
  }
  const header=rows.shift();
  if(header?.[0]!=='typ'||header[1]!=='dane_json') throw Error('Wybierz CSV zapisany w ustawieniach Lity Dąb.');
  const restored={clients:[],orders:[],expenses:[],templates:[],tasks:[]};
  let meta;
  for(const [kind,serialized] of rows) {
    const item=JSON.parse(serialized);
    if(kind==='meta'&&!meta&&item) meta=item;
    else if(kind==='rates'&&!restored.rates&&item) restored.rates=item;
    else if(['clients','orders','expenses','templates','tasks'].includes(kind)) restored[kind].push(item);
    else throw Error('Nieprawidłowy rekord kopii CSV.');
  }
  restored.schema=meta?.schema;
  if(typeof meta?.contractTemplate==='string') restored.contractTemplate=meta.contractTemplate;
  return {space:meta?.space,data:restored};
}
function validBackup(x) {
  const string=v=>typeof v==='string';
  const numeric=v=>(typeof v==='number'||string(v)&&v.trim()!=='')&&Number.isFinite(Number(v))&&Number(v)>=0;
  const client=c=>c&&string(c.id)&&string(c.first)&&string(c.last);
  const rates=r=>r&&Object.keys(rateLabels).every(k=>numeric(r[k]));
  return (x?.tasks===undefined||Array.isArray(x.tasks)&&x.tasks.every(t=>t&&string(t.id)&&string(t.title)&&string(t.due)&&typeof t.done==='boolean'))&&x?.schema===1&&rates(x.rates)&&Array.isArray(x.clients)&&x.clients.every(client)&&Array.isArray(x.orders)&&
    x.orders.every(o=>o&&string(o.id)&&string(o.number)&&string(o.date)&&client(o.client)&&rates(o.rates)&&numeric(o.length)&&numeric(o.width)&&Array.isArray(o.steps))&&
    Array.isArray(x.expenses)&&x.expenses.every(e=>e&&string(e.date)&&numeric(e.amount))&&Array.isArray(x.templates)&&x.templates.every(t=>t&&string(t.name)&&string(t.subject)&&string(t.body));
}
function orderReport() {
  const headers=['Numer zamówienia','Data zamówienia','Status','Termin','Klient','Adres dostawy','E-mail','Telefon','Faktura','Długość (cm)','Szerokość (cm)','Kolor blatu','Stelaż','Uwagi','Oferta (PLN)','Koszt (PLN)','Dochód (PLN)','Wpłacono (PLN)','Numer przesyłki'];
  const decimal=value=>Number(value).toFixed(2).replace('.',',');
  const rows=data.orders.map(o=>{
    const cost=orderCost(o.id), price=quote(o).price;
    return [o.number,o.date,o.status,o.contractSent?deadline(o.contractSent):o.due,person(o.client),address(o.client),o.client.email,o.client.phone,o.invoice?'Tak':'Nie',o.length,o.width,o.color==='Inny'?o.customColor:o.color,o.frame,o.notes,decimal(price),decimal(cost),decimal(price-cost),decimal(o.paid||0),o.tracking];
  });
  const csvCell=value=>{
    let text=String(value??'');
    if(/^[\s]*[=+@-]/.test(text)&&! /^-?\d+(,\d+)?$/.test(text)) text="'"+text;
    return '"'+text.replaceAll('"','""')+'"';
  };
  const csv='\uFEFF'+[headers,...rows].map(row=>row.map(csvCell).join(';')).join('\r\n');
  download(csv,'text/csv;charset=utf-8','zamowienia-'+space+'-'+today()+'.csv');
}
function backup(format='json') {
  const csv=format==='csv';
  download(csv?csvBackup():JSON.stringify({space,data},null,2),csv?'text/csv;charset=utf-8':'application/json','litydab-'+space+'-'+today()+'.'+format);
}
function download(content,type,name) {
  const url=URL.createObjectURL(new Blob([content],{type}));
  const link=document.createElement('a');
  link.href=url;link.download=name;link.click();
  setTimeout(()=>URL.revokeObjectURL(url),1000);
}
function fill(text,o) {
  const vars={imię:o.client.first,numer:o.number,wymiary:o.length+' × '+o.width+' cm',cena:money(quote(o).price),przesyłka:o.tracking||''};
  return text.replace(/{{(.*?)}}/g,(match,name)=>Object.hasOwn(vars,name)?vars[name]:match);
}
function email(o) {
  $('main').innerHTML='<h1>Wiadomość · '+esc(o.number)+'</h1>'+button('order','Wróć do zamówienia',o.id)+'<section><label>Szablon <select id="template"><option value="">Pusta wiadomość</option>'+data.templates.map((t,i)=>'<option value="'+i+'">'+esc(t.name)+'</option>').join('')+'</select></label><form id="mail">'+input('to','Do',o.client.email,'email','required')+input('subject','Temat')+area('body','Treść')+'<p>Umowę PDF dołącz w programie pocztowym.</p><button>Otwórz szkic w poczcie</button></form></section>';
  const f=$('mail');
  $('template').onchange=e=>{const t=data.templates[e.target.value];f.elements.subject.value=t?fill(t.subject,o):'';f.elements.body.value=t?fill(t.body,o):'';};
  f.onsubmit=e=>{e.preventDefault();const v=values(f);location.href='mailto:'+encodeURIComponent(v.to)+'?subject='+encodeURIComponent(v.subject)+'&body='+encodeURIComponent(v.body);};
}
function offer(o) {
  $('main').innerHTML='<p>'+button('order','Wróć do zamówienia',o.id)+'</p><section id="print"><h1>Oferta '+esc(o.number)+'</h1><p>'+esc(person(o.client))+'<br>'+esc(address(o.client))+'</p><p>Biurko dębowe '+esc(o.length)+' × '+esc(o.width)+' cm</p><p>Wykończenie '+esc(o.color==='Inny'?o.customColor:o.color)+'<br>Podcięcie '+esc(o.cut)+'<br>Przelotka '+(o.grommet?'tak':'nie')+'</p><p>Stelaż '+esc(o.frameColor)+', '+esc(o.frame)+', silniki '+esc(o.motors)+'</p><p>'+esc(o.notes)+'</p><p>Łącznie <strong>'+money(quote(o).price)+'</strong><br>Płatność '+esc(o.payment)+'</p><button onclick="window.print()">Drukuj / zapisz PDF</button></section>';
}
const actions={resetContract:()=>{if(confirm('Przywrócić oryginalny wzór umowy?')){delete data.contractTemplate;save();settings();}},resetLogo:()=>{localStorage.removeItem('litydab:logo');applyLogo();settings();},removeCost:index=>{data.rates.customCosts.splice(Number(index),1);save();settings();},report:orderReport,removeTask:key=>{if(confirm('Usunąć zadanie?')){data.tasks=data.tasks.filter(t=>t.id!==key);save();tasks();}},order:orderForm,client:clientForm,backup,offer:key=>offer(data.orders.find(o=>o.id===key)),email:key=>email(data.orders.find(o=>o.id===key)),addTemplate:()=>{data.templates.push({name:'Nowy szablon',subject:'',body:''});save();settings();},removeTemplate:key=>{data.templates.splice(Number(key),1);save();settings();},contract:key=>contract(data.orders.find(o=>o.id===key))};
document.addEventListener('click',e=>{
  const el=e.target.closest('button,a[data-action]');
  if(!el)return;
  if(el.dataset.page!==undefined){page=Number(el.dataset.page);render();}
  if(el.dataset.action){if(el.tagName==='A') e.preventDefault();actions[el.dataset.action](el.dataset.id);}
});
window.addEventListener('storage',e=>{if(e.key===key()&&e.newValue){data=JSON.parse(e.newValue);normalize();render();}});
load();render();
if('serviceWorker' in navigator && location.protocol!=='file:') navigator.serviceWorker.register('./sw.js').catch(console.error);

function applyLogo() {
  const logo=localStorage.getItem('litydab:logo');
  $('appLogo').src=logo&&/^data:image\/(png|jpeg|webp);base64,/.test(logo)?logo:'logo.png';
}
const defaultContractTemplate=`# Umowa
Zamówienie {{numer}}
Zawarta w Krakowie{{miasto}} (online) w dniu {{data}} pomiędzy:
{{zamawiający}}, zwanym dalej Zamawiającym,
a
{{przyjmujący}}, zwanym dalej Przyjmującym zamówienie.

§ 1
Zamawiający zamawia, a Przyjmujący zamówienie zobowiązuje się do wykonania dzieła w postaci wykonania biurka z blatu dębowego na elektrycznie podnoszonym stelażu. Specyfikacja dotycząca wymagań techniczno-ekonomicznych projektu jest określona w załączniku nr 1.
§ 2
Przyjmujący zobowiązuje się do wykonania dzieła w terminie {{termin}}.
§ 3
Odbiór dzieła nastąpi u Zamawiającego w dniu jego dostarczenia. Adres dostawy: {{adres dostawy}}.
§ 4
Za wykonanie dzieła strony ustalają wynagrodzenie w wysokości {{oferta}}. Koszty wysyłki {{koszty wysyłki}}. {{zaliczka}}Płatność w dniu odbioru dzieła: {{płatność}}{{konto}}.
§ 5
W przypadku niewykonania dzieła w terminie, Przyjmujący zwróci zaliczkę, a dana umowa zostaje unieważniona.
§ 6
W sprawach nieuregulowanych w niniejszej umowie stosuje się przepisy Kodeksu cywilnego.
§ 7
Umowa została spisana w dwóch jednobrzmiących egzemplarzach, po jednym dla każdej ze stron.
{{podpisy}}

---
# Załącznik nr 1
## Specyfikacja dotycząca wymagań techniczno-ekonomicznych projektu
Biurko z blatem z litego dębu na elektrycznie podnoszonym stelażu
### Blat
Wymiary: {{wymiary}}
Blat zostanie wykonany z litego dębu (klejone deski dębowe).
Deski dębowe rustykalne posiadające naturalne cechy drewna – oryginalny rysunek słojów, zróżnicowana barwa, obecność twardzieli i bielu, sęki i pęknięcia.
Pęknięcia zostaną uzupełnione szpachlą na bazie żywicy poliestrowej o kolorze czarnym.
Wykończenie: {{wykończenie}}
Wszystkie krawędzie blatu zostaną delikatnie zaokrąglone o promieniu R2 (2 mm).
Podcięcie: {{podcięcie}}
Przelotka na kable: {{przelotka}}
{{krawędź}}
### Stelaż
Regulowany elektrycznie. Kolor: {{kolor stelaża}}. Typ: {{typ stelaża}}. Liczba silników: {{silniki}}.
{{kosz}}
### Montaż biurka
Biurko przed wysyłką zostanie przygotowane do montażu (przygotowane zostaną otwory do montażu stelażu). Montaż biurka w zakresie Zamawiającego.
{{ustalenia}}`;

function renderContractTemplate(template,fields) {
  const format=line=>esc(line).replace(/{{([^{}]+)}}/g,(token,key)=>Object.hasOwn(fields,key)?fields[key]:token);
  return template.split(/^---[ \t]*$/m).map((page,index)=>{
    const body=page.split(/\r?\n/).map(line=>{
      const value=line.trim();
      if(!value) return '';
      const heading=value.match(/^(#{1,3}) (.*)$/);
      if(heading){const tag='h'+heading[1].length;return '<'+tag+'>'+format(heading[2])+'</'+tag+'>';}
      if(/^§\s*\d+$/.test(value)) return '<h2 class="clause">'+esc(value)+'</h2>';
      if(value==='{{podpisy}}') return fields.podpisy;
      const content=format(value);
      return content?'<p>'+content+'</p>':'';
    }).join('');
    return index?'<article class="annex">'+body+'</article>':body;
  }).join('');
}

function contract(o) {
  const c=o.client;
  const price=quote(o).price;
  const deposit=Number(o.deposit||0);
  const remaining=Math.max(0,price-deposit);
  const date=value=>value ? new Intl.DateTimeFormat('pl-PL',{dateStyle:'long',timeZone:'UTC'}).format(new Date(value+'T00:00:00Z')) : '……………………';
  const bold=value=>'<strong>'+esc(value)+'</strong>';
  const payer=o.shippingPayer||shippingPayers[0];
  const payment=o.contractPayment||(o.payment==='Gotówka'?contractPayment[1]:contractPayment[0]);
  const account=o.bankAccount??(space==='firma'?'59 1750 0012 0000 0000 2741 2987':'');
  const accountText=account?' '+bold(account):'';
  const demo=space==='demo';
  const billing=c.same===false?billingAddress(c):address(c);
  const fields={
    numer:bold(o.number),miasto:c.city?'–'+bold(c.city):'',data:bold(date(o.date)),
    zamawiający:bold([person(c),c.company,c.nip?'NIP '+c.nip:'',billing,c.email,c.phone].filter(Boolean).join(', ')),
    przyjmujący:bold(demo?'Lity Dąb – dane demonstracyjne':'Andrzej Ratusz, zamieszkały w Krakowie 31-235, ul. Zauchy 7/50, tel. 698 767 324'),
    termin:o.due?'do '+bold(date(o.due)):'14 dni od wysłania umowy',
    'adres dostawy':bold(address(c)),oferta:bold(money(price)), 'koszty wysyłki':bold(payer.toLocaleLowerCase('pl')),
    zaliczka:deposit?'W dniu podpisania umowy Zamawiający wypłaci Przyjmującemu zaliczkę w wysokości '+bold(money(deposit))+(account?' na konto'+accountText:'')+'. Pozostała część wynagrodzenia wynosi '+bold(money(remaining))+'. ':'',
    płatność:bold(payment),konto:payment===contractPayment[0]?accountText:'',
    podpisy:'<div class="signatures"><div>.........................................<br>Zamawiający</div><div>.........................................<br>Przyjmujący zamówienie<br>Andrzej Ratusz</div></div>',
    wymiary:bold(o.length+' × '+o.width+' × '+o.rates.thickness+' cm'),wykończenie:bold(o.color==='Inny'?o.customColor:o.color),
    podcięcie:bold(o.cut),przelotka:bold(o.grommet?'tak':'nie'),
    krawędź:o.edge?'Krawędź przednia: '+bold(o.edge):'',
    'kolor stelaża':bold(o.frameColor),'typ stelaża':bold(o.frame),silniki:bold(o.motors),
    kosz:o.basket?'Kosz na kable: '+bold(o.basket):'',
    ustalenia:o.notes?'Dodatkowe ustalenia: '+bold(o.notes).replace(/\r?\n/g,'<br>'):''
  };
  $('main').innerHTML='<p>'+button('order','Wróć do zamówienia',o.id)+'</p><section id="print" class="contract"><button type="button" id="editContract" aria-pressed="false">Edytuj treść umowy</button> <button id="saveContract">Zapisz umowę PDF</button> <button id="printContract">Drukuj</button><p id="pdfStatus" role="status"></p>'+
    (demo?'<p class="demo-marker"><strong>DOKUMENT DEMONSTRACYJNY</strong></p>':'')+
    renderContractTemplate(data.contractTemplate??defaultContractTemplate,fields)+'</section>';
  const section=$('print'), workspace=space;
  const editButton=$('editContract');
  const editable=[...section.querySelectorAll('h1,h2,h3,p:not(#pdfStatus,.demo-marker),.signatures > div')];
  editButton.onclick=()=>{
    const editing=editButton.getAttribute('aria-pressed')!=='true';
    editButton.setAttribute('aria-pressed',String(editing));
    editButton.textContent=editing?'Zakończ edycję':'Edytuj treść umowy';
    for(const block of editable) {
      if(editing) block.setAttribute('contenteditable','plaintext-only');
      else block.removeAttribute('contenteditable');
    }
    if(editing) editable.find(block=>block.matches('h1'))?.focus();
  };
  $('saveContract').onclick=async ()=>{
    try { await saveContractPdf(o,await createOrderFolder(o,workspace),section,workspace); }
    catch(error){alert('Nie udało się zapisać umowy. '+error.message);}
  };
  $('printContract').onclick=()=>{
    if(!demo&&payment===contractPayment[0]&&!account.trim()){alert('Uzupełnij numer konta w parametrach umowy.');return;}
    if(deposit>price){alert('Sprawdź kwotę zaliczki w zamówieniu.');return;}
    const title=document.title;document.title='Umowa-'+o.number;window.print();document.title=title;
  };
  return section;
}






async function saveContractPdf(order,folder,section,workspace) {
  const status=section.querySelector('#pdfStatus');
  const payment=order.contractPayment||(order.payment==='Gotówka'?contractPayment[1]:contractPayment[0]);
  if(workspace==='firma'&&payment===contractPayment[0]&&order.bankAccount?.trim()==='') {
    status.textContent='Uzupełnij numer konta w parametrach umowy.';
    return;
  }
  if(Number(order.deposit||0)>quote(order).price) {
    status.textContent='Sprawdź kwotę zaliczki w zamówieniu.';
    return;
  }
  const filename='Umowa-'+order.number+'.pdf';
  const pdf=contractPdf(section);
  if(folder) {
    await writeFile(folder,filename,pdf);
    status.textContent='Zapisano '+filename+' w folderze '+folder.name+'.';
  } else {
    download(pdf,'application/pdf',filename);
    status.textContent='Pobrano '+filename+'. Folder zapisu wybierzesz w ustawieniach.';
  }
}
applyLogo();
