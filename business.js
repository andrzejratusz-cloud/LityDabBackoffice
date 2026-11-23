'use strict';

function logChanges(previous,current) {
  const entries=[];
  const actor=window.litySharing?.actor?.()||'Użytkownik lokalny';
  const collections={orders:'Zamówienie',clients:'Klient',expenses:'Wydatek',contractors:'Podwykonawca',tasks:'Zadanie',polkurierSenders:'Nadawca'};
  function record(kind,entityId,before,after) {
    if(JSON.stringify(before)===JSON.stringify(after))return;
    entries.push({id:id(),date:new Date().toISOString(),actor,kind,entityId,operation:before===undefined?'Dodano':after===undefined?'Usunięto':'Zmieniono',before:before===undefined?null:JSON.parse(JSON.stringify(before)),after:after===undefined?null:JSON.parse(JSON.stringify(after))});
  }
  for(const [key,label] of Object.entries(collections)){
    const old=new Map((previous[key]||[]).map(item=>[item.id,item]));
    const next=new Map((current[key]||[]).map(item=>[item.id,item]));
    for(const entityId of new Set([...old.keys(),...next.keys()]))record(label,entityId,old.get(entityId),next.get(entityId));
  }
  for(const key of ['rates','templates','contractTemplate','polkurierSender','defaultSenderId'])record('Ustawienia',key,previous[key],current[key]);
  current.audit=[...new Map([...(previous.audit||[]),...(current.audit||[])].map(entry=>[entry.id,entry])).values(),...entries];
}

function deleteClient(clientId) {
  const client=data.clients.find(c=>c.id===clientId);
  if(!client||!confirm('Usunąć klienta '+person(client)+' z bazy klientów? Dane zapisane w jego zamówieniach pozostaną dostępne.'))return;
  (data.deletedClients??=[]).push({...client,deletedAt:new Date().toISOString()});
  data.clients=data.clients.filter(c=>c.id!==clientId);
  save();clients();
}

function actualOrderCost(orderId) {
  return data.expenses.reduce((sum,expense)=>{
    const amount=Array.isArray(expense.allocations)?expense.allocations.filter(a=>a.orderId===orderId).reduce((total,a)=>total+Math.round(Number(a.amount)*100),0):
      expense.order===orderId?Math.round(Number(expense.amount)*100):0;
    return sum+amount;
  },0)/100;
}
function allocationSum(expense) {
  return (expense.allocations||[]).reduce((sum,a)=>sum+Math.round(Number(a.amount)*100),0)/100;
}
function allocationsValid(expense) {
  return Array.isArray(expense.allocations)&&expense.allocations.every(a=>a&&typeof a.orderId==='string'&&Number.isFinite(Number(a.amount))&&Number(a.amount)>=0)&&
    new Set(expense.allocations.map(a=>a.orderId)).size===expense.allocations.length&&
    Math.round(allocationSum(expense)*100)<=Math.round(Number(expense.amount)*100);
}
function splitExpense(amount,orderIds) {
  const cents=Math.round(Number(amount)*100),base=Math.floor(cents/orderIds.length),rest=cents%orderIds.length;
  return orderIds.map((orderId,i)=>({orderId,amount:(base+(i<rest?1:0))/100}));
}
function expenseEditor(expenseId) {
  const existing=data.expenses.find(e=>e.id===expenseId);
  const expense=existing||{date:today(),name:'',amount:0,allocations:[],invoices:[]};
  const orderList=[...data.orders,...(data.deletedOrders||[])];
  const allocations=expense.allocations??(expense.order?[{orderId:expense.order,amount:Number(expense.amount)}]:[]);
  $('main').innerHTML='<h1>'+esc(existing?'Edytuj wydatek':'Nowy wydatek')+'</h1>'+button('finance','Wróć do kosztów')+
    '<form id="expenseEditor">'+group('Wydatek rzeczywisty',grid(input('date','Data wydatku',expense.date,'date','required')+
      input('name','Nazwa',expense.name,'text','required')+num('quantity','Ilość',expense.quantity||1,0.01)+num('unitPrice','Cena jednostkowa (zł)',Number(expense.amount)/(expense.quantity||1),0)+num('amount','Łączna kwota (zł)',expense.amount,0.01)+
      input('supplier','Sprzedawca',expense.supplier)+input('invoiceNumber','Numer faktury',expense.invoiceNumber)))+
    group('Podział na zamówienia','<p>Wpisz kwoty przypisane do zamówień. Pozostała część będzie wydatkiem ogólnym.</p>'+
      '<div class="right-actions">'+button('splitExpense','Podziel równo między zaznaczone')+'</div>'+
      table(['Podział równy','Zamówienie','Kwota (zł)'],orderList.map(o=>[
        '<input type="checkbox" name="split_'+esc(o.id)+'" aria-label="Uwzględnij '+esc(o.number)+'">',
        esc(o.number)+' · '+esc(person(o.client)),'<input name="allocation_'+esc(o.id)+'" aria-label="Kwota dla '+esc(o.number)+'" value="'+esc(allocations.find(a=>a.orderId===o.id)?.amount||'')+'" type="number" min="0" step="0.01">'
      ]))+'<output id="allocationStatus" role="status"></output>')+
    group('Faktury','<label>Załącz PDF lub zdjęcie <input id="invoiceFiles" type="file" accept="application/pdf,image/jpeg,image/png,image/webp" multiple></label><div id="invoiceList">'+
      (expense.invoices||[]).map(file=>'<p>'+esc(file.name)+' '+button('invoiceDownload','Pobierz',file.storageKey)+'</p>').join('')+'</div>')+
    '<button>Zapisz wydatek</button></form>';
  const form=$('expenseEditor'),scope=key();
  form.elements.unitPrice.step='any';
  const readAllocations=()=>orderList.map(o=>({orderId:o.id,amount:Number(form.elements.namedItem('allocation_'+o.id).value||0)})).filter(a=>a.amount>0);
  function update(){
    const total=Number(form.elements.amount.value),sum=allocationSum({allocations:readAllocations()});
    $('allocationStatus').textContent='Przypisano '+money(sum)+' · wydatek ogólny '+money(total-sum);
  }
  form.oninput=event=>{
    const quantity=Number(form.elements.quantity.value);
    if(event.target.name==='amount'&&quantity>0)form.elements.unitPrice.value=(Number(form.elements.amount.value)/quantity).toFixed(4);
    if(['quantity','unitPrice'].includes(event.target.name))form.elements.amount.value=(quantity*Number(form.elements.unitPrice.value)).toFixed(2);
    update();
  };update();
  form.onsubmit=async e=>{
    e.preventDefault();
    const v=values(form),item={...expense,id:expense.id||id(),date:v.date,name:v.name,supplier:v.supplier,invoiceNumber:v.invoiceNumber,amount:Number(v.amount),quantity:Number(v.quantity),unitPrice:Number(v.amount)/Number(v.quantity),order:'',allocations:readAllocations(),invoices:[...(expense.invoices||[])]};
    if(!allocationsValid(item)){alert('Suma przydzielonych kwot przekracza wartość wydatku.');return;}
    const files=Array.from($('invoiceFiles').files);
    if(files.some(file=>!['application/pdf','image/jpeg','image/png','image/webp'].includes(file.type)||file.size>25*1024*1024)){alert('Załącz PDF lub zdjęcie do 25 MB.');return;}
    e.submitter.disabled=true;
    const notices=[];
    try {
      let folder;
      if(files.length&&typeof window.showDirectoryPicker==='function'){
        folder=await folderSetting(scope+':invoiceFolder');
        if(folder&&await folder.requestPermission({mode:'readwrite'})!=='granted')throw Error('Brak zgody na zapis w folderze faktur.');
      }
      for(const file of files){
        const storageKey=scope+':invoice:'+id();
        await folderSetting(storageKey,file);
        const name=item.date+' - '+item.id.slice(0,8)+' - '+id().slice(0,8)+' - '+file.name.replace(/[<>:"/\\|?*]/g,'_');
        let savedToFolder=false;
        if(folder){
          try{await writeFile(folder,name,file);savedToFolder=true;}
          catch(error){notices.push('Plik '+file.name+' zapisano lokalnie. Zapis w folderze nie powiódł się.');}
        }
        item.invoices.push({id:id(),name:file.name,storedName:name,storageKey,savedToFolder});
      }
      if(key()!==scope)throw Error('Zmieniono bazę w trakcie zapisu. Wróć do poprzedniej przestrzeni.');
      put(data.expenses,item);save();finance();
      if(notices.length)alert(notices.join('\n'));
    }catch(error){alert(error.message);}
    finally{if(e.submitter.isConnected)e.submitter.disabled=false;}
  };
}
function distributeExpense() {
  const form=$('expenseEditor');
  const ids=Array.from(form.elements).filter(e=>e.type==='checkbox'&&e.checked&&e.name.startsWith('split_')).map(e=>e.name.slice(6));
  if(!ids.length){alert('Zaznacz zamówienia do podziału.');return;}
  for(const field of form.elements)if(field.name.startsWith('allocation_'))field.value='';
  for(const allocation of splitExpense(form.elements.amount.value,ids))form.elements.namedItem('allocation_'+allocation.orderId).value=allocation.amount.toFixed(2);
  form.dispatchEvent(new Event('input'));
}
async function invoiceDownload(storageKey) {
  try {
    const referenced=data.expenses.some(e=>(e.invoices||[]).some(file=>file.storageKey===storageKey));
    if(!referenced)throw Error('Brak faktury w aktywnej bazie.');
    const file=await folderSetting(storageKey);
    if(!file)throw Error('Plik jest zapisany na urządzeniu, na którym dodano fakturę, lub w wybranym folderze Google Drive.');
    download(file,file.type,file.name||'Faktura.pdf');
  }catch(error){alert(error.message);}
}
function auditSettings() {
  const log=[...(data.audit||[])].sort((a,b)=>b.date.localeCompare(a.date));
  $('main').insertAdjacentHTML('beforeend','<section><h2>Historia zmian</h2><p>'+
    button('auditJson','Eksport historii JSON')+' '+button('auditCsv','Eksport historii do Excela (CSV)')+
    '</p><label>Import historii JSON <input type="file" id="auditImport" accept=".json,application/json"></label>'+
    '<p>Ostatnie 100 zmian. Eksport obejmuje całą historię.</p>'+
    table(['Data','Użytkownik','Operacja','Dane','Szczegóły'],log.slice(0,100).map(event=>[
      esc(new Date(event.date).toLocaleString('pl-PL')),esc(event.actor),esc(event.operation),esc(event.kind)+' · '+esc(event.entityId),
      '<details><summary>Pokaż</summary><pre>'+esc(JSON.stringify({przed:event.before,po:event.after},null,2))+'</pre></details>'
    ]))+'</section>');
  $('auditImport').onchange=async e=>{
    try {
      const imported=JSON.parse((await e.target.files[0].text()).replace(/^\uFEFF/,''));
      const records=imported.audit||imported;
      if(!Array.isArray(records)||!records.every(a=>a&&typeof a.id==='string'&&Number.isFinite(Date.parse(a.date))&&typeof a.actor==='string'&&typeof a.kind==='string'&&typeof a.operation==='string'))throw Error('Nieprawidłowy plik historii.');
      if(!confirm('Dołączyć '+records.length+' wpisów historii?'))return;
      data.audit=[...new Map([...(data.audit||[]),...records].map(a=>[a.id,a])).values()];save();settings();
    }catch(error){alert(error.message);}
  };
}
function exportAudit(csv=false) {
  if(!csv){download(JSON.stringify({audit:data.audit||[]},null,2),'application/json','LityDab-historia-'+today()+'.json');return;}
  const rows=[['Data','Użytkownik','Operacja','Dane','Identyfikator','Przed','Po'],...(data.audit||[]).map(e=>[e.date,e.actor,e.operation,e.kind,e.entityId,JSON.stringify(e.before),JSON.stringify(e.after)])];
  const cell=value=>{let text=String(value??'');if(/^[\s]*[=+@-]/.test(text))text="'"+text;return '"'+text.replaceAll('"','""')+'"';};
  download('\uFEFF'+rows.map(row=>row.map(cell).join(';')).join('\r\n'),'text/csv;charset=utf-8','LityDab-historia-'+today()+'.csv');
}
async function chooseInvoiceFolder() {
  try {
    if(typeof window.showDirectoryPicker!=='function')throw Error('Folder Google Drive wybierzesz w Chrome lub Edge na komputerze. Na tym urządzeniu faktury zapisują się lokalnie i można je pobrać.');
    const scope=key(),folder=await window.showDirectoryPicker({mode:'readwrite',id:'litydab-invoices'});
    await folderSetting(scope+':invoiceFolder',folder);
    $('invoiceFolderStatus').textContent='Folder faktur: '+folder.name;
  }catch(error){if(error.name!=='AbortError')alert(error.message);}
}
function invoiceSettings() {
  $('main').insertAdjacentHTML('beforeend','<section><h2>Folder faktur — Google Drive</h2><p>Wybierz folder na dysku Google Drive synchronizowanym z komputerem.</p>'+
    button('chooseInvoiceFolder','Wybierz folder faktur')+'<p id="invoiceFolderStatus" role="status"></p>'+
    '<p>Pliki faktur są przechowywane lokalnie na urządzeniu oraz w wybranym folderze. Kopie danych i współdzielenie zawierają ich opisy.</p></section>');
  folderSetting(key()+':invoiceFolder').then(folder=>{if($('invoiceFolderStatus'))$('invoiceFolderStatus').textContent=folder?'Folder faktur: '+folder.name:'Folder nie został wybrany.';}).catch(()=>{});
}
