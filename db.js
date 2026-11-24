import {kinds} from './domain.js';
const db=new Promise((resolve,reject)=>{
 const req=indexedDB.open('mesh-field-lab-v1',2);
 req.onupgradeneeded=()=>[...kinds,'firmwareFiles'].forEach(k=>{
  if(!req.result.objectStoreNames.contains(k))req.result.createObjectStore(k,{keyPath:'id'});
 });
 req.onsuccess=()=>{req.result.onversionchange=()=>req.result.close();resolve(req.result);};
 req.onerror=()=>reject(req.error);
 req.onblocked=()=>reject(Error('Close other Mesh Field Lab tabs and reload.'));
});
export async function read(){
 const conn=await db,tx=conn.transaction([...kinds,'firmwareFiles']);
 const keys=request(tx.objectStore('firmwareFiles').getAllKeys());
 const entries=await Promise.all(kinds.map(k=>new Promise((resolve,reject)=>{
  const req=tx.objectStore(k).getAll();req.onsuccess=()=>resolve([k,req.result]);req.onerror=()=>reject(req.error);
 })));
 return {...Object.fromEntries(entries),firmwareFiles:(await keys).map(id=>({id}))};
}
export async function write(items,{replace=false,del}={}){
 const conn=await db;
 return new Promise((resolve,reject)=>{
  const tx=conn.transaction([...kinds,'firmwareFiles'],'readwrite');
  tx.oncomplete=resolve;tx.onabort=()=>reject(tx.error||Error('Storage operation aborted.'));
  for(const k of kinds){
   const store=tx.objectStore(k);
   if(replace)store.clear();

   for(const item of items[k]||[])store.put(item);
  }
  if(replace)tx.objectStore('firmwareFiles').clear();
  for(const [kind,id] of (del?(Array.isArray(del[0])?del:[del]):[]))tx.objectStore(kind).delete(id);
 });
}

function request(req){
 return new Promise((resolve,reject)=>{req.onsuccess=()=>resolve(req.result);req.onerror=()=>reject(req.error);});
}
export async function readFirmware(id){
 const conn=await db;
 return request(conn.transaction('firmwareFiles').objectStore('firmwareFiles').get(id));
}
export async function storeFirmware(record,file){
 const conn=await db;
 return new Promise((resolve,reject)=>{
  const tx=conn.transaction(['readiness','firmwareFiles'],'readwrite');
  tx.oncomplete=resolve;
  tx.onabort=()=>reject(tx.error||Error('Could not save firmware in local storage.'));
  tx.objectStore('readiness').put(record);
  tx.objectStore('firmwareFiles').put({id:record.id,name:file.name,type:file.type||'application/octet-stream',blob:file});
 });
}
