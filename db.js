import {kinds} from './domain.js';
const db=new Promise((resolve,reject)=>{
 const req=indexedDB.open('mesh-field-lab-v1',1);
 req.onupgradeneeded=()=>kinds.forEach(k=>req.result.createObjectStore(k,{keyPath:'id'}));
 req.onsuccess=()=>resolve(req.result);
 req.onerror=()=>reject(req.error);
 req.onblocked=()=>reject(Error('Close other Mesh Field Lab tabs and reload.'));
});
export async function read(){
 const conn=await db,tx=conn.transaction(kinds);
 const entries=await Promise.all(kinds.map(k=>new Promise((resolve,reject)=>{
  const req=tx.objectStore(k).getAll();req.onsuccess=()=>resolve([k,req.result]);req.onerror=()=>reject(req.error);
 })));
 return Object.fromEntries(entries);
}
export async function write(items,{replace=false,del}={}){
 const conn=await db;
 return new Promise((resolve,reject)=>{
  const tx=conn.transaction(kinds,'readwrite');
  tx.oncomplete=resolve;tx.onabort=()=>reject(tx.error||Error('Storage operation aborted.'));
  for(const k of kinds){
   const store=tx.objectStore(k);
   if(replace)store.clear();
   if(del?.[0]===k)store.delete(del[1]);
   for(const item of items[k]||[])store.put(item);
  }
 });
}
