'use strict';

function syncClients(previous,current) {
  const oldClients=new Map((previous.clients||[]).map(client=>[client.id,client]));
  const oldOrders=new Map((previous.orders||[]).map(order=>[order.id,order]));
  const equal=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
  const changed=new Map();
  for(const client of current.clients) {
    if(!equal(client,oldClients.get(client.id)))changed.set(client.id,client);
  }
  for(const order of current.orders) {
    const old=oldOrders.get(order.id);
    if(order.client && (!old || !equal(order.client,old.client)) && !changed.has(order.clientId)) {
      if(current.clients.some(client=>client.id===order.clientId))changed.set(order.clientId,{...order.client,id:order.clientId});
    }
  }
  for(const [clientId,client] of changed) {
    const index=current.clients.findIndex(item=>item.id===clientId);
    if(index>=0)current.clients[index]={...client};
    for(const order of current.orders) {
      if(order.clientId===clientId)order.client=JSON.parse(JSON.stringify(client));
    }
  }
}
function realizationDots(order) {
  return '<div class="realization-dots">'+stages.map((name,index)=>{
    const state=order.steps?.[index]?.state||stepStates[0];
    return '<span class="realization-dot" data-step-status="'+Math.max(0,stepStates.indexOf(state))+'" title="'+esc(name+': '+state)+'" role="img" aria-label="'+esc(name+': '+state)+'"></span>';
  }).join('')+'</div>';
}
function makeSettingsCollapsible() {
  for(const section of $('main').querySelectorAll(':scope > section')) {
    const heading=section.querySelector(':scope > h2');
    if(!heading)continue;
    const details=document.createElement('details');
    details.className='settings-section';
    const summary=document.createElement('summary');
    summary.textContent=heading.textContent;
    heading.remove();
    section.replaceWith(details);
    details.append(summary,...section.childNodes);
  }
  addFolderPath('folderStatus',space);
  addFolderPath('invoiceFolderStatus',key()+':invoiceFolder');
}
function addFolderPath(statusId,storageKey) {
  const status=$(statusId);
  if(!status)return;
  const label=document.createElement('label');
  label.textContent='Pełna ścieżka folderu';
  const input=document.createElement('input');
  input.type='text';
  input.placeholder='np. G:\Mój dysk\LityDab\Faktury';
  input.value=localStorage.getItem('litydab:path:'+storageKey)||'';
  const note=document.createElement('small');
  note.textContent='Przeglądarka udostępnia nazwę wybranego folderu. Pełną ścieżkę skopiuj z Eksploratora plików.';
  const output=document.createElement('p');
  output.className='folder-path';
  output.textContent=input.value;
  input.onchange=()=>{
    localStorage.setItem('litydab:path:'+storageKey,input.value.trim());
    output.textContent=input.value.trim();
  };
  label.append(input,note);
  status.after(label,output);
}
// Format read-only date text throughout the app without changing stored ISO dates.
document.addEventListener('DOMContentLoaded',()=>{
  const main=document.getElementById('main');
  enhanceDates(main);
  const observer=new MutationObserver(()=>{
    observer.disconnect();
    enhanceDates(main);
    const walker=document.createTreeWalker(main,NodeFilter.SHOW_TEXT);
    const nodes=[];
    while(walker.nextNode())nodes.push(walker.currentNode);
    for(const node of nodes) {
      if(node.parentElement.closest('textarea,script,style,pre,code,select'))continue;
      const next=node.data.replace(/\b(\d{4})-(\d{2})-(\d{2})\b/g,'$3.$2.$1');
      if(next!==node.data)node.data=next;
    }
    observer.observe(main,{subtree:true,childList:true,characterData:true});
  });
  observer.observe(main,{subtree:true,childList:true,characterData:true});
});
function isoDate(value) {
  return String(value||'').replace(/^(\d{2})\.(\d{2})\.(\d{4})$/,'$3-$2-$1');
}
function enhanceDates(root) {
  const nativeValue=Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value');
  for(const field of root.querySelectorAll('input[type=date]')) {
    const current=field.value;
    field.type='text';
    field.dataset.date='true';
    field.placeholder='DD.MM.YYYY';
    field.inputMode='numeric';
    field.pattern='[0-9]{2}\\.[0-9]{2}\\.[0-9]{4}';
    Object.defineProperty(field,'value',{
      configurable:true,
      get(){return isoDate(nativeValue.get.call(this));},
      set(value){nativeValue.set.call(this,displayDate(value));}
    });
    field.value=current;
    field.addEventListener('input',()=>{
      const value=field.value;
      const parsed=new Date(value+'T00:00:00Z');
      const valid=!value || /^\d{4}-\d{2}-\d{2}$/.test(value)&&Number.isFinite(parsed.getTime())&&parsed.toISOString().slice(0,10)===value;
      field.setCustomValidity(valid?'':'Podaj poprawną datę DD.MM.YYYY.');
    });
  }
}
