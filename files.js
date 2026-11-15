'use strict';

async function folderSetting(key, value) {
  const db = await new Promise((resolve, reject) => {
    const request = indexedDB.open('litydab-files', 1);
    request.onupgradeneeded = () => request.result.createObjectStore('folders');
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
  });
  try {
    return await new Promise((resolve, reject) => {
      const tx = db.transaction('folders', value ? 'readwrite' : 'readonly');
      const store = tx.objectStore('folders');
      const request = value ? store.put(value, key) : store.get(key);
      tx.oncomplete = () => resolve(request.result);
      tx.onabort = () => reject(tx.error);
    });
  } finally {
    db.close();
  }
}

function orderFolderName(order) {
  return [order.number,person(order.client),order.client.city].map(value =>
    String(value||'').replace(/[<>:"/\\|?*\u0000-\u001f]/g,' ').replace(/\s+/g,' ').trim().replace(/\.+$/,'').slice(0,65)
  ).filter(Boolean).join(' - ');
}

async function writableFolder(workspace) {
  if(typeof window.showDirectoryPicker!=='function') return null;
  const folder=await folderSetting(workspace);
  if(folder&&await folder.requestPermission({mode:'readwrite'})!=='granted') throw Error('Przeglądarka nie udzieliła dostępu do folderu.');
  return folder;
}

async function chooseFolder() {
  const workspace=space;
  try {
    const folder=await window.showDirectoryPicker({mode:'readwrite',id:'litydab-'+workspace});
    await folderSetting(workspace,folder);
    if(workspace===space) showFolder();
  } catch(error) {
    if(error.name!=='AbortError') alert('Nie udało się wybrać folderu. '+error.message);
  }
}

async function showFolder() {
  const label=$('folderStatus');
  if(!label) return;
  if(typeof window.showDirectoryPicker!=='function') {
    label.textContent='Wybór folderu jest dostępny w obsługiwanej przeglądarce, np. Chrome lub Edge na komputerze.';
    $('chooseFolder').disabled=true;
    return;
  }
  try {
    const folder=await folderSetting(space);
    label.textContent=folder?'Wybrany folder: '+folder.name:'Wybierz folder dla plików tej przestrzeni.';
  } catch(error) {
    label.textContent='Nie udało się odczytać ustawienia folderu.';
  }
}

async function createOrderFolder(order,workspace) {
  const root=await writableFolder(workspace);
  return root?.getDirectoryHandle(order.folderName||orderFolderName(order),{create:true});
}

async function writeFile(folder,name,content) {
  const file=await folder.getFileHandle(name,{create:true});
  const stream=await file.createWritable();
  try {
    await stream.write(content);
    await stream.close();
  } catch(error) {
    await stream.abort().catch(()=>{});
    throw error;
  }
}

function contractPdf(section) {
  const pages=[];
  const width=1240,height=1754,margin=100,lineHeight=34;
  let canvas,context,y;
  function newPage() {
    canvas=document.createElement('canvas');
    canvas.width=width;canvas.height=height;
    context=canvas.getContext('2d');
    context.fillStyle='white';context.fillRect(0,0,width,height);
    context.fillStyle='black';
    y=margin;
    pages.push(canvas);
  }
  function block(node) {
    if(node.matches('button,#pdfStatus')) return;
    if(node.matches('article')) {
      newPage();
      for(const child of node.children) block(child);
      return;
    }
    if(node.matches('ul')) {
      for(const child of node.children) block(child);
      return;
    }
    const heading=node.matches('h1,h2,h3');
    const centered=node.matches('h1,.clause');
    const fontSize=node.matches('h1')?39:26;
    const font=bold=>(bold?'bold ':'')+fontSize+'px Georgia, serif';
    let words=[];
    function read(child,bold=false) {
      if(child.nodeName==='BR'){words.push({break:true});return;}
      if(child.nodeType===3) {
        for(const part of child.textContent.split(/(\r?\n|[^\S\r\n]+)/)) {
          if(/\r?\n/.test(part)) words.push({break:true});
          else if(part) words.push({text:/^\s+$/.test(part)?' ':part,bold});
        }
      } else {
        for(const sub of child.childNodes) read(sub,bold||child.nodeName==='STRONG');
      }
    }
    if(node.matches('li')) words.push({text:'• ',bold:false});
    if(node.matches('.signatures')) {
      const names=Array.from(node.children);
      y+=24;
      if(y+lineHeight*3>height-margin) newPage();
      context.font=font(false);
      names.forEach((signature,index)=>{
        let offset=y;
        for(const child of signature.childNodes) {
          if(child.nodeType!==3) continue;
          for(const line of child.textContent.split(/\r?\n/)) {
            context.fillText(line,margin+index*520,offset,510);
            offset+=lineHeight;
          }
        }
      });
      y+=lineHeight*3;
      return;
    }
    read(node,heading);
    let line=[],used=0;
    function flush() {
      if(y+lineHeight>height-margin) newPage();
      let x=centered?(width-used)/2:margin;
      for(const word of line) {
        context.font=font(word.bold);
        context.fillText(word.text,x,y+fontSize);
        x+=word.width;
      }
      y+=node.matches('h1')?49:lineHeight;
      line=[];used=0;
    }
    for(const word of words) {
      if(word.break){flush();continue;}
      context.font=font(word.bold);
      word.width=context.measureText(word.text).width;
      if(used+word.width>width-2*margin&&line.length) flush();
      if(line.length||word.text!==' '){line.push(word);used+=word.width;}
    }
    if(line.length) flush();
    y+=heading?5:9;
  }
  newPage();
  for(const child of section.children) block(child);
  return imagePagesPdf(pages,width,height);
}

function imagePagesPdf(pages,width,height) {
  const parts=[],offsets=[0];
  let length=0;
  const encoder=new TextEncoder();
  function append(value) {
    const bytes=typeof value==='string'?encoder.encode(value):value;
    parts.push(bytes);length+=bytes.length;
  }
  function object(id,body,stream) {
    offsets[id]=length;
    append(id+' 0 obj\n'+body);
    if(stream){append('\nstream\n');append(stream);append('\nendstream');}
    append('\nendobj\n');
  }
  append('%PDF-1.4\n');
  object(1,'<< /Type /Catalog /Pages 2 0 R >>');
  object(2,'<< /Type /Pages /Count '+pages.length+' /Kids ['+pages.map((_,i)=>(3+i*3)+' 0 R').join(' ')+'] >>');
  pages.forEach((canvas,i)=>{
    const page=3+i*3;
    const jpeg=Uint8Array.from(atob(canvas.toDataURL('image/jpeg',0.92).split(',')[1]),ch=>ch.charCodeAt(0));
    const commands=encoder.encode('q 595.28 0 0 841.89 0 0 cm /PageImage Do Q');
    object(page,'<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595.28 841.89] /Resources << /XObject << /PageImage '+(page+1)+' 0 R >> >> /Contents '+(page+2)+' 0 R >>');
    object(page+1,'<< /Type /XObject /Subtype /Image /Width '+width+' /Height '+height+' /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length '+jpeg.length+' >>',jpeg);
    object(page+2,'<< /Length '+commands.length+' >>',commands);
  });
  const xref=length;
  append('xref\n0 '+offsets.length+'\n0000000000 65535 f \n');
  for(const offset of offsets.slice(1)) append(String(offset).padStart(10,'0')+' 00000 n \n');
  append('trailer\n<< /Size '+offsets.length+' /Root 1 0 R >>\nstartxref\n'+xref+'\n%%EOF\n');
  return new Blob(parts,{type:'application/pdf'});
}

