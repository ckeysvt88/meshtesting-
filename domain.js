import {sanitizeReadiness} from './readiness-model.js';
export const types=['range','public','message','relay'];
export const text=(value,max=500)=>String(value??'').trim().slice(0,max);
const number=(v,min,max)=>v===''||v==null?null:Number.isFinite(Number(v))&&Number(v)>=min&&Number(v)<=max?Number(v):NaN;
export function clean(kind,r){
 if(!r||typeof r!=='object')throw Error('Invalid record');
 const out={id:text(r.id,80)||crypto.randomUUID(),name:text(r.name,100),notes:text(r.notes,1200)};
 if(!out.name)throw Error('Enter a name for every record.');
 if(kind!=='profiles'){
  out.lat=number(r.lat,-90,90);out.lon=number(r.lon,-180,180);
  if(Number.isNaN(out.lat)||Number.isNaN(out.lon)||(out.lat===null)!==(out.lon===null))throw Error('Enter a valid latitude and longitude together.');
 }
 if(kind==='profiles'){out.protocol=['meshtastic','meshcore'].includes(r.protocol)?r.protocol:'meshtastic';for(const key of ['device','firmware','antenna','height','role','region','preset','slot','frequency','channel','mqtt','proxy','bridge','position','range'])out[key]=text(r[key],180);}
 if(kind==='sites'){out.type=['anchor','destination','relay'].includes(r.type)?r.type:'relay';for(const key of ['access','power','mount','obstruction','height','gain','cable','margin','model','extension'])out[key]=text(r[key],200);}
 if(kind==='sites'&&typeof r.image==='string'&&/^data:image\/(png|jpeg|webp);base64,[a-z0-9+/=]+$/i.test(r.image)&&r.image.length<=3000000)out.image=r.image;
 if(kind==='logs'){
  out.type=types.includes(r.type)?r.type:'range';out.session=text(r.session,100);out.pair=text(r.pair,100);out.anchor=text(r.anchor,80);out.site=text(r.site,80);
  out.time=text(r.time,50);
  if(out.time&&!Number.isFinite(Date.parse(out.time)))throw Error('Invalid observation time.');
  if(out.time)out.time=new Date(out.time).toISOString();
  for(const key of ['vehicle','height','orientation','weather','sender','recipient','node','trace','route','ack','human','reply'])out[key]=text(r[key],200);
  if(typeof r.image==='string'&&/^data:image\/(png|jpeg|webp);base64,[a-z0-9+/=]+$/i.test(r.image)&&r.image.length<=3000000)out.image=r.image;
  out.protocol=['meshtastic','meshcore','unknown'].includes(r.protocol)?r.protocol:'meshtastic';
  out.origin=['manual','imported','position','modeled'].includes(r.origin)?r.origin:'manual';
  out.internet=['offline','assisted','online'].includes(r.internet)?r.internet:'unknown';
  out.mqtt=out.protocol==='meshcore'?'na':['on','off'].includes(r.mqtt)?r.mqtt:'unknown';
  for(const key of ['firmware','radio','antenna','environment','repeaters','routeDetails','dataSource'])out[key]=text(r[key],200);
  out.direction=r.direction==='reverse'?'reverse':'forward';out.path=['direct','relayed'].includes(r.path)?r.path:'unknown';
  out.rf=(r.rf===true||r.rf==='true'||r.rf==='on')&&out.internet!=='assisted'&&out.origin!=='modeled'&&out.origin!=='position'&&out.mqtt!=='on';out.control=r.control===true||r.control==='true'||r.control==='on';
  for(const [key,min,max] of [['mhz',100,10000],['gain',-50,100],['vswr',1,100],['testDistance',0,5000],['acks',0,100000],['sent',1,100000],['received',0,100000],['rssi',-200,0],['snr',-60,60],['hops',0,15],['battery',0,100],['delay',0,86400]]){
   out[key]=key==='hops'&&out.protocol!=='meshtastic'?null:number(r[key],min,max);
   if(Number.isNaN(out[key])||(['sent','received','hops','acks'].includes(key)&&out[key]!==null&&!Number.isInteger(out[key])))throw Error('Invalid '+key+'.');
  }
  if(out.acks!==null&&out.sent!==null&&out.acks>out.sent)throw Error('Acknowledgements cannot exceed transmissions.');
  if(out.sent!==null&&(out.received===null||out.received>out.sent))throw Error('Received must be between zero and sent.');
 }
 return out;
}
export const radians=x=>x*Math.PI/180;
export function distance(a,b){
 if(!a||!b||a.lat==null||b.lat==null)return null;
 const h=Math.sin(radians(b.lat-a.lat)/2)**2+Math.cos(radians(a.lat))*Math.cos(radians(b.lat))*Math.sin(radians(b.lon-a.lon)/2)**2;
 return 12742.0176*Math.asin(Math.sqrt(Math.min(1,Math.max(0,h))));
}
export const loss=(km,mhz)=>km>0&&mhz>0?32.44+20*Math.log10(km)+20*Math.log10(mhz):null;
export const fresnel=(km,mhz)=>km>0&&mhz>0?Math.sqrt(299.792458/mhz*km*250):null;
export function stats(logs){
 const counted=logs.filter(r=>Number.isInteger(r.sent)&&Number.isInteger(r.received));
 const sent=counted.reduce((n,r)=>n+r.sent,0),received=counted.reduce((n,r)=>n+r.received,0);
 const median=key=>{const a=logs.map(r=>r[key]).filter(Number.isFinite).sort((x,y)=>x-y);return a.length?(a[(a.length-1)>>1]+a[a.length>>1])/2:null};
 return {sent,received,rate:sent?received/sent:null,rssi:median('rssi'),snr:median('snr')};
}
export function trials(logs){
 const groups=new Map();
 for(const r of logs.filter(x=>x.rf&&x.session&&x.site&&x.anchor&&x.pair&&(x.type==='message'||x.type==='relay'))){
  const key=JSON.stringify([r.protocol||'meshtastic',r.type,r.anchor,r.site,r.session,r.pair]);
  if(!groups.has(key))groups.set(key,[]);
  groups.get(key).push(r);
 }
 return [...groups.values()].map(rows=>({rows,pass:['forward','reverse'].every(direction=>{
  const group=rows.filter(r=>r.direction===direction);
  return group.length>0&&group.every(r=>r.human==='yes'&&r.sent!==null&&r.received===r.sent);
 })}));
}
export const columns='id,name,type,session,pair,anchor,site,time,lat,lon,direction,path,rf,control,sent,received,rssi,snr,hops,battery,delay,vehicle,height,orientation,weather,sender,recipient,node,trace,route,ack,human,reply,notes,protocol,origin,internet,mqtt,firmware,radio,antenna,environment,mhz,gain,vswr,testDistance,acks,repeaters,routeDetails,dataSource'.split(',');
export function csv(rows){
 const quote=v=>{let s=String(v??'');if(typeof v==='string'&&/^[\s]*[=+@-]|^[\t\r\n]/.test(s))s="'"+s;return '"'+s.replaceAll('"','""')+'"'};
 return [columns.join(','),...rows.map(r=>columns.map(k=>quote(r[k])).join(','))].join('\r\n');
}
export function readCSV(source){
 const rows=[];let row=[],cell='',quoted=false,closed=false;
 source=source.replace(/^\uFEFF/,'');
 for(let i=0;i<source.length;i++){
  const c=source[i];
  if(quoted){if(c==='"'&&source[i+1]==='"'){cell+='"';i++;}else if(c==='"'){quoted=false;closed=true;}else cell+=c;continue;}
  if(c===','||c==='\r'||c==='\n'){row.push(cell);cell='';closed=false;if(c!==','){if(row.some(Boolean))rows.push(row);row=[];if(c==='\r'&&source[i+1]==='\n')i++;}continue;}
  if(closed)throw Error('Malformed CSV field.');
  if(c==='"'){if(cell)throw Error('Malformed CSV field.');quoted=true;}else cell+=c;
 }
 if(quoted)throw Error('Unclosed CSV quote.');
 row.push(cell);if(row.some(Boolean))rows.push(row);
 const heads=rows.shift()?.map(x=>x.trim().toLowerCase().replace(/[ _-]/g,''))||[];
 if(new Set(heads).size!==heads.length)throw Error('Duplicate CSV columns.');
 if(!heads.length)throw Error('CSV needs a header row.');
 const firmware=heads.join(',')==='time,from,sendername,senderlat,senderlong,rxlat,rxlong,rxelevation,rxsnr,distance,hoplimit,payload,rxrssi';
 // Some firmware releases write the RSSI on the following line before the next packet.
 if(firmware&&rows[0]?.length===heads.length-1&&rows.at(-1)?.length===2&&rows.at(-1)[1]===''&&rows.slice(1).every(r=>/^-?\d+$/.test(r[0]))){
  for(let i=0;i<rows.length-1;i++)rows[i]=(i?rows[i].slice(1):rows[i]).concat(rows[i+1][0]);
  rows.pop();
 }
 return {heads,rows:rows.map((cells,index)=>{
  if(cells.length!==heads.length)throw Error('Wrong column count in row '+(index+2));
  return Object.fromEntries(heads.map((k,i)=>[k,cells[i]]));
 })};
}
export function parseCSV(source,mode='auto',mapping={}){
 const {heads,rows}=readCSV(source);
 const own=mode==='lab'||mode==='auto'&&heads.includes('sent')&&heads.includes('received')&&heads.includes('session');
 return rows.map((r,index)=>{
  if(own){
   for(const key of ['testDistance','routeDetails','dataSource'])r[key]=r[key.toLowerCase()];
   for(const k of columns.filter(k=>!['sent','received','rssi','snr','hops','battery','delay','lat','lon','mhz','gain','vswr','testDistance','acks'].includes(k)))if(/^'[\s]*[=+@-]|^'[\t\r\n]/.test(r[k]||''))r[k]=r[k].slice(1);
   return clean('logs',r);
  }
  const get=(k,...aliases)=>mapping[k]?r[mapping[k]]:aliases.map(h=>r[h]).find(Boolean);
  const position=mode==='position'||mode==='auto'&&['seqno','latitude','longitude'].every(h=>heads.includes(h));
  if(!position&&!mapping.name&&!heads.some(h=>['name','sender','from','payload'].includes(h)))throw Error('Map the packet sender/name column or choose Position Log mode.');
  const lat=get('lat','rxlat','receiverlatitude',...(position?['latitude','lat']:[])),lon=get('lon','rxlon','rxlong','receiverlongitude',...(position?['longitude','lon','long']:[]));
  if(position&&(!lat||!lon))throw Error('Position Log requires mapped latitude and longitude.');
  const timestamp=get('time','timestamp','time','date')?.trim();
  return clean('logs',{name:get('name','sendername','sender','from','name')||(position?'Imported position ':'Imported packet ')+(index+1),type:'range',session:position?'Position Log import':'Packet CSV import',
   protocol:['meshtastic','meshcore'].includes(mapping.protocol)?mapping.protocol:'unknown',origin:position?'position':'imported',dataSource:position?'iOS Position Log':'Packet CSV',time:timestamp&&/(Z|[+-]\d\d:\d\d)$/i.test(timestamp)&&Number.isFinite(Date.parse(timestamp))?timestamp:undefined,
   lat,lon,received:position?null:1,rssi:position?null:get('rssi','rxrssi','rssi'),snr:position?null:get('snr','rxsnr','snr'),notes:[get('notes','payload','message','notes'),timestamp?'Source time: '+timestamp:'Source time unavailable'].filter(Boolean).join(' · ')});
 });
}
export const kinds=['profiles','sites','logs','checks','overlays','drafts','readiness'];
export function backup(data){
 if(![1,2].includes(data?.schema))throw Error('Unsupported backup version.');
 const result={schema:2};
 for(const k of kinds){
  if(k==='readiness'&&data.schema===1&&!data[k]){result[k]=[];continue;}
  if(!Array.isArray(data[k]))throw Error('Missing '+k+' in backup.');
  result[k]=data[k].map(r=>{
   if(k==='readiness')return sanitizeReadiness(r,true);
   if(k==='checks')return {id:text(r?.id,80),done:r?.done===true};
   if(k==='drafts')return {id:text(r?.id,80),value:text(r?.value,100)};
   if(k==='overlays'){
    if(!Array.isArray(r.paths)||r.paths.flat().length>15000||!r.paths.every(p=>Array.isArray(p)&&p.length&&p.every(c=>Array.isArray(c)&&c.length===2&&Number.isFinite(c[0])&&Math.abs(c[0])<=180&&Number.isFinite(c[1])&&Math.abs(c[1])<=90)))throw Error('Invalid overlay in backup.');
    return {id:text(r.id,80),name:text(r.name,100),paths:r.paths};
   }
   return clean(k,r);
  });
  if(result[k].some(r=>!r.id)||new Set(result[k].map(r=>r.id)).size!==result[k].length)throw Error('Missing or duplicate record ID.');
 }
 return result;
}
