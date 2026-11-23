import {read,write} from './db.js';
import {clean,backup,csv,parseCSV,readCSV,distance,loss,fresnel,stats,trials,types,kinds} from './domain.js';
import {steps} from './guide.js';
import {overlay,drawMap} from './map.js';
const $=s=>document.querySelector(s);
const safe=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const nav={dashboard:'Dashboard',guide:'Guided setup',field:'Field tests',map:'Coverage map',analytics:'RF analytics',relay:'Relay planner',ready:'Readiness',devices:'Devices',data:'Data & help'};
const category={range:'Range survey',public:'Public mesh',message:'Two-way message',relay:'Relay test'};
let data=Object.fromEntries(kinds.map(k=>[k,[]])),editing=null,pending=null,installPrompt,step=0,timer,stopTime=0,mapFilter={};
const page=()=>Object.hasOwn(nav,location.hash.slice(1))?location.hash.slice(1):'dashboard';
const status=m=>$('#status').textContent=m;
const connected=()=>$('#connection').textContent=navigator.onLine?'Local workspace · Online':'Local workspace · Offline';
addEventListener('online',connected);addEventListener('offline',connected);connected();
addEventListener('beforeinstallprompt',event=>{event.preventDefault();installPrompt=event;if(page()==='data')render();});
if('serviceWorker' in navigator)navigator.serviceWorker.register('./sw.js').catch(()=>status('Offline setup failed. Reload online to retry.'));
const ordered=()=>[...data.logs].sort((a,b)=>b.time.localeCompare(a.time));
const point=(title,value)=>'<div class="panel"><span class="metric">'+safe(value)+'</span>'+safe(title)+'</div>';
const block=(title,html)=>'<section class="panel"><h2>'+safe(title)+'</h2>'+html+'</section>';
const intro=(title,description)=>'<h1>'+safe(title)+'</h1><p class="intro">'+safe(description)+'</p>';
const options=items=>items.map(([v,n])=>'<option value="'+safe(v)+'">'+safe(n)+'</option>').join('');
const input=(k,n,type='text',extra='')=>'<label>'+safe(n)+'<input name="'+k+'" type="'+type+'" '+extra+'></label>';
const select=(k,n,items)=>'<label>'+safe(n)+'<select name="'+k+'">'+options(items)+'</select></label>';
const check=(k,n)=>'<label class="check"><input name="'+k+'" type="checkbox">'+safe(n)+'</label>';
const number=(k,n,min,max,step='any')=>input(k,n,'number','min="'+min+'" max="'+max+'" step="'+step+'"');
const notes='<label>Notes<textarea name="notes" maxlength="1200"></textarea></label>';
const gps=number('lat','Latitude',-90,90)+number('lon','Longitude',-180,180);
const evidence='<label>Screenshot (PNG, JPEG or WebP, up to 2 MB)<input type="file" name="attachment" accept="image/png,image/jpeg,image/webp"></label>';
const ids=sites=>[['','Select a saved site'],...sites.map(x=>[x.id,x.name])];
const getSite=id=>data.sites.find(s=>s.id===id);
const complete=id=>data.checks.some(x=>x.id===id&&x.done);
const counts=()=>({
 surveyed:new Set(data.logs.filter(r=>r.type==='range').map(r=>r.site||[r.lat,r.lon].join(',')+(r.lat===null?r.name:''))).size,
 heard:data.logs.filter(r=>r.type==='range'&&r.rf&&r.received>0).length,
 failed:data.logs.filter(r=>r.type==='range'&&r.received===0).length,
 passed:trials(data.logs).filter(a=>a.pass).length
});
const pct=n=>n==null?'—':(n*100).toFixed(1)+'%';
const format=(n,unit='')=>Number.isFinite(n)?n.toFixed(1)+unit:'—';
function dashboard(){
 const c=counts(),next=steps.find(s=>!complete(s[0])),last=ordered()[0],done=steps.filter(s=>complete(s[0])).length;
 return intro('Field dashboard','Plan, measure and verify your Meshtastic network from the first local packet to repeatable family messaging.')+
 '<section class="panel hero"><h2>'+safe(next?next[1]:'Repeat the route under different conditions')+'</h2><p>'+done+' of '+steps.length+' guide steps checked · '+(c.passed?'Controlled two-way trials recorded':'Family route has no verified trial yet')+'</p><progress max="'+steps.length+'" value="'+done+'" aria-label="Guide progress"></progress><div class="actions"><a class="button primary" href="#guide">Open guide</a><a class="button" href="#field">Log a test</a></div></section>'+
 '<div class="grid">'+point('Surveyed locations',c.surveyed)+point('RF-isolated reception observations',c.heard)+point('Zero-reception stops',c.failed)+point('Successful controlled two-way trials',c.passed)+'</div>'+
 block('Workspace', '<p>'+data.profiles.length+' radio profiles · '+data.sites.filter(s=>s.type==='relay').length+' relay candidates</p><p>'+(last?'Latest test: '+safe(last.name)+(last.time?' · '+safe(new Date(last.time).toLocaleString()):''):'Your saved tests will appear here.')+'</p>')+
 block('Recent activity', '<ul>'+ordered().slice(0,5).map(r=>'<li>'+safe(r.name)+' · '+safe(category[r.type])+'</li>').join('')+'</ul><a href="#field">Open test history</a>');
}
function guide(){
 const [id,title,instruction,expect,trouble]=steps[step];
 return intro('Guided setup','Use the native Meshtastic app for radio settings. Mesh Field Lab saves your checklist and current step automatically on this device.')+
 '<div class="steps" aria-label="Guide steps">'+steps.map(([key,t],i)=>'<button type="button" class="'+(i===step?'primary':'')+'" data-step="'+i+'" aria-label="'+safe(t)+'" '+(i===step?'aria-current="step"':'')+'>'+(i+1)+(complete(key)?' ✓':'')+'</button>').join('')+'</div>'+
 block(title,'<p class="step-title">Manual · Step '+(step+1)+' of '+steps.length+'</p><p>'+safe(instruction)+'</p><h3>Expected result</h3><p>'+safe(expect)+'</p><details><summary>Troubleshooting</summary><p>'+safe(trouble)+'</p></details><div class="actions"><button data-step="'+(step-1)+'" '+(step===0?'disabled':'')+'>Back</button><button class="primary" data-complete="'+id+'">'+(complete(id)?'Mark incomplete':'Mark complete')+'</button><button data-step="'+(step+1)+'" '+(step===steps.length-1?'disabled':'')+'>Next</button></div>');
}
function records(kind,rows){
 return rows.length?'<div class="list">'+rows.map(r=>'<details class="record"><summary>'+safe(r.name)+(kind==='logs'?' · '+safe(category[r.type])+(r.received===null?'':' · '+r.received+' received'):'')+'</summary>'+
 '<p>'+safe(r.time?new Date(r.time).toLocaleString():'')+(r.lat!=null?' · '+r.lat.toFixed(5)+', '+r.lon.toFixed(5):'')+'</p>'+
 '<p>'+safe(r.notes)+'</p>'+(r.image?'<img class="evidence" src="'+safe(r.image)+'" alt="Supporting field screenshot">':'')+
 '<div class="actions"><button data-edit="'+kind+'" data-id="'+safe(r.id)+'">Edit</button><button class="danger" data-delete="'+kind+'" data-id="'+safe(r.id)+'">Delete</button></div></details>').join('')+'</div>':'<p class="muted">No records yet.</p>';
}
function field(){
 const form='<form data-form="logs"><div class="grid">'+input('name','Stop or test name','text','required maxlength="100"')+
 select('type','Test type',types.map(t=>[t,category[t]]))+input('session','Session name')+input('pair','Trial ID or message identifier')+
 input('time','Observation start (local time)','datetime-local')+gps+
 select('anchor','First endpoint (such as CS01)',ids(data.sites))+select('site','Second endpoint',ids(data.sites))+
 select('direction','Direction',[['forward','First → second'],['reverse','Second → first']])+select('path','Observed path',[['unknown','Unknown'],['direct','Direct'],['relayed','Relayed']])+
 number('sent','Known transmissions',1,100000,1)+number('received','Unique packets or texts received',0,100000,1)+
 number('rssi','RSSI (dBm)',-200,0)+number('snr','SNR (dB)',-60,60)+number('hops','Hops',0,15,1)+
 select('vehicle','Vehicle placement',[['','Unknown'],['Inside','Inside'],['Outside','Outside']])+input('height','Antenna height (include unit)')+input('orientation','Antenna orientation')+'</div>'+
 '<div class="actions"><button type="button" data-gps>Use GPS</button><label>Observation timer (minutes)<input id="minutes" type="number" min="1" max="60" value="3"></label><button type="button" id="start">Start timer</button><button type="button" id="stop">Stop timer</button><output id="clock"></output></div>'+
 check('rf','I verified isolation on participating radios and phones for this observation')+check('control','I controlled every relay on the tested path, or confirmed the path was direct')+
 '<details><summary>Message delivery, public nodes and conditions</summary><div class="grid">'+input('sender','Sending radio')+input('recipient','Receiving radio')+
 select('ack','Recipient radio acknowledgment',[['','Unknown'],['yes','Yes'],['no','No']])+select('human','Human read the actual received text',[['','Unknown'],['yes','Yes'],['no','No']])+
 select('reply','Human reply received',[['','Unknown'],['yes','Yes'],['no','No']])+input('route','Relay dependency or path description')+
 input('node','Public node ID')+input('trace','Traceroute result')+number('battery','Battery (%)',0,100)+number('delay','Delivery delay (seconds)',0,86400)+input('weather','Weather')+'</div></details>'+
 notes+evidence+'<div class="actions"><button class="primary">Save observation</button>'+(editing?'<button type="button" data-cancel>Cancel edit</button>':'')+'</div></form>';
 return intro('Field tests','Manually log fresh receptions and misses. The PWA records GPS and the timer on request. The radio handles all packet transmission and reception.')+
 block(editing?'Edit observation':'New observation',form)+block('Test history',records('logs',ordered()));
}
const profileFields={device:'Hardware model',firmware:'Firmware version',role:'Device role',region:'LoRa region',preset:'Modem preset',slot:'Frequency slot',frequency:'Frequency override',channel:'Channel label (omit keys)',mqtt:'MQTT enabled / off',proxy:'MQTT Client Proxy',bridge:'Channel uplink/downlink',position:'GPS and positioning',range:'Range Test settings',antenna:'Antenna and feed line',height:'Antenna height'};
function devices(){
 const mismatches=['region','preset','slot','frequency','channel'].filter(k=>new Set(data.profiles.map(r=>r[k].toLowerCase()).filter(Boolean)).size>1);
 return intro('Device inventory','Record actual settings for CS01 and the two X1s. Mesh Field Lab compares your entries and keeps radio changes in the Meshtastic app.')+
 (mismatches.length?block('Verify these differences','<p class="danger">'+safe(mismatches.map(k=>profileFields[k]).join(', '))+'</p>'):'')+
 block(editing?'Edit radio profile':'Add radio profile','<form data-form="profiles"><div class="grid">'+input('name','Node name','text','required')+Object.entries(profileFields).map(([k,n])=>input(k,n)).join('')+'</div>'+notes+'<div class="actions"><button class="primary">Save radio</button>'+(editing?'<button type="button" data-cancel>Cancel edit</button>':'')+'</div></form>')+
 block('Saved radios',records('profiles',data.profiles));
}
function relay(){
 return intro('Relay planner','Save CS01 as an anchor and family endpoints as destinations. Candidate sites stay provisional until both RF legs, the complete route and practical hosting are verified.')+
 block(editing?'Edit site':'Add site','<form data-form="sites"><div class="grid">'+input('name','Site name','text','required')+
 select('type','Site type',[['anchor','Anchor'],['destination','Destination'],['relay','Candidate relay']])+gps+
 Object.entries({height:'Antenna height',gain:'Antenna gain (dBi)',cable:'Cable loss (dB)',margin:'Predicted link margin (dB)',model:'Prediction tool and assumptions',extension:'Expected onward extension',access:'Permission and access status',power:'Solar exposure or power plan',mount:'Mounting feasibility',obstruction:'Obstructions and terrain'}).map(([k,n])=>input(k,n)).join('')+
 '</div><div class="actions"><button type="button" data-gps>Use GPS</button></div>'+notes+evidence+'<div class="actions"><button class="primary">Save site</button>'+(editing?'<button type="button" data-cancel>Cancel edit</button>':'')+'</div></form>')+
 block('Candidate comparison','<p>Measured leg counts use both directions with human confirmation and controlled paths. Record access, sun and mount before selecting a pilot.</p><div class="table"><table><thead><tr><th>Candidate</th><th>Controlled legs</th><th>Predicted margin</th><th>Access / power / mount</th></tr></thead><tbody>'+data.sites.filter(s=>s.type==='relay').map(s=>{
  const legs=trials(data.logs).filter(t=>t.pass&&t.rows.every(r=>r.control&&r.type==='relay')&&[t.rows[0].anchor,t.rows[0].site].includes(s.id));
  const peers=[...new Set(legs.map(t=>{const r=t.rows[0];return r.anchor===s.id?r.site:r.anchor}))];
  return '<tr><td>'+safe(s.name)+'</td><td>'+safe(peers.map(id=>getSite(id)?.name||'Deleted site').join(', ')||'Untested')+'</td><td>'+safe(s.margin||'—')+'</td><td>'+safe([s.access,s.power,s.mount].filter(Boolean).join(' / ')||'Unrecorded')+'</td></tr>';
 }).join('')+'</tbody></table></div>')+block('Saved sites',records('sites',data.sites));
}
function mapped(){
 return intro('Coverage map','Explore the local coordinate map. Pan and zoom, then select two markers to measure straight-line distance. The map works offline and sends no map-view requests.')+
 block('Field observations','<form id="map-filter"><div class="grid">'+select('type','Test type',[['','All tests'],...types.map(k=>[k,category[k]])])+input('session','Session contains')+
 input('from','From date','date')+input('to','Through date','date')+select('path','Observed path',[['','All paths'],['direct','Direct'],['relayed','Relayed'],['unknown','Unknown']])+
 number('rssi','Minimum RSSI (dBm)',-200,0)+number('snr','Minimum SNR (dB)',-60,60)+select('size','Marker size',[['','Fixed'],['rssi','RSSI'],['snr','SNR']])+'</div><button>Apply filters</button></form>'+
 '<div id="map-host"><div class="actions map-tools">'+[['in','Zoom in'],['out','Zoom out'],['fit','Fit points'],['left','Left'],['up','Up'],['down','Down'],['right','Right']].map(([k,n])=>'<button data-map="'+k+'">'+n+'</button>').join('')+
 '</div><svg class="map" viewBox="0 0 600 300" role="group" aria-label="Local coverage plot"></svg><div class="legend">Green: received · Red: missed · Blue: two-way evidence · Amber: sites · Gray: unknown · Purple: imported overlays</div><output aria-live="polite">Select a marker to inspect it.</output></div>')+
 block('Planning overlays','<p>Purple overlays are reference geometry or predictions. Use <a href="https://site.meshtastic.org/" rel="noreferrer" target="_blank">Meshtastic Site Planner</a> separately for terrain and line-of-sight analysis.</p><a href="#data">Import a KML, GPX or GeoJSON file</a>'+records('overlays',data.overlays).replace(/<button data-edit="overlays"[^>]*>Edit<\/button>/g,''));
}
function filtered(){
 const f=mapFilter;
 return data.logs.filter(r=>r.lat!==null&&(!f.type||r.type===f.type)&&(!f.path||r.path===f.path)&&(!f.session||r.session.toLowerCase().includes(f.session.toLowerCase()))&&
 (!f.from||r.time&&localTime(new Date(r.time)).slice(0,10)>=f.from)&&(!f.to||r.time&&localTime(new Date(r.time)).slice(0,10)<=f.to)&&
 (f.rssi==null||f.rssi===''||r.rssi!==null&&r.rssi>=Number(f.rssi))&&(f.snr==null||f.snr===''||r.snr!==null&&r.snr>=Number(f.snr)));
}
function mountMap(){
 const evidence=new Set(trials(data.logs).filter(t=>t.pass).flatMap(t=>t.rows.map(r=>r.id)));
 drawMap($('#map-host'),[...data.sites.filter(r=>r.lat!==null),...filtered()],data.overlays,r=>{
  const log=types.includes(r.type),result=r.received===null?'no count':r.received+' received',value=r[mapFilter.size];
  return {color:!log?'#f2c26a':evidence.has(r.id)?'#86d6fc':r.received>0?'#b9f17e':r.received===0?'#fc9b83':'#b8c7bf',
   radius:mapFilter.size&&Number.isFinite(value)?4+Math.max(0,Math.min(8,(value+(mapFilter.size==='rssi'?135:20))/8)):7,
   label:r.name+' · '+(log?[result,r.path,'RSSI '+format(r.rssi,' dBm'),'SNR '+format(r.snr,' dB')].join(' · '):r.type)};
 });
}
function groups(rows,key){
 const buckets=new Map();
 for(const row of rows){const k=key(row);if(!buckets.has(k))buckets.set(k,[]);buckets.get(k).push(row);}
 return '<div class="table"><table><thead><tr><th>Group</th><th>Stops heard / counted</th><th>Received / sent</th><th>Packet rate</th></tr></thead><tbody>'+[...buckets.entries()].sort(([a],[b])=>a.localeCompare(b)).map(([k,rs])=>{
  const s=stats(rs),withResult=rs.filter(r=>r.received!==null);
  return '<tr><td>'+safe(k)+'</td><td>'+withResult.filter(r=>r.received>0).length+' / '+withResult.length+'</td><td>'+s.received+' / '+s.sent+'</td><td>'+pct(s.rate)+'</td></tr>';
 }).join('')+'</tbody></table></div>';
}
function bins(rows,key,edges,unit){
 const lower=[-Infinity,...edges],upper=[...edges,Infinity],v=rows.map(r=>r[key]).filter(Number.isFinite);
 return '<div class="bars">'+lower.map((x,i)=>{const n=v.filter(s=>s>=x&&s<upper[i]).length,label=i===0?'Below '+upper[i]:i===lower.length-1?x+' or above':x+' to <'+upper[i];return '<div><span>'+safe(label+' '+unit)+'</span><progress max="'+Math.max(1,v.length)+'" value="'+n+'" aria-label="'+safe(label)+'"></progress><span>'+n+'</span></div>';}).join('')+'</div>';
}
function analytics(){
 const rows=data.logs.filter(r=>r.type==='range'&&r.rf),s=stats(rows),pairs=trials(data.logs).filter(t=>t.rows[0].type==='message'),successes=pairs.filter(t=>t.pass).length;
 const anchor=r=>getSite(r.anchor)||data.sites.find(x=>x.type==='anchor');
 const km=r=>distance(anchor(r),r.lat===null?getSite(r.site):r);
 const sector=r=>{const a=anchor(r),b=r.lat===null?getSite(r.site):r;if(!a||!b||a.lat===null||b.lat===null||km(r)===0)return 'Unknown';const rad=Math.PI/180,dl=(b.lon-a.lon)*rad,angle=(Math.atan2(Math.sin(dl)*Math.cos(b.lat*rad),Math.cos(a.lat*rad)*Math.sin(b.lat*rad)-Math.sin(a.lat*rad)*Math.cos(b.lat*rad)*Math.cos(dl))/rad+360)%360;return ['N','NE','E','SE','S','SW','W','NW'][Math.round(angle/45)%8];};
 return intro('RF analytics','These reception summaries use observations marked RF-isolated by the operator. Counts describe sampled stops and conditions. A single packet or a small sample provides limited evidence.')+
 '<div class="grid">'+point('Counted packet reception',pct(s.rate))+point('Known transmissions',s.sent)+point('Median RSSI',format(s.rssi,' dBm'))+point('Median SNR',format(s.snr,' dB'))+point('Two-way trials passed',successes+' / '+pairs.length)+'</div>'+
 block('Signal distributions', '<h3>RSSI</h3>'+bins(rows,'rssi',[-120,-105,-90,-75],'dBm')+'<h3>SNR</h3>'+bins(rows,'snr',[-15,-5,5,10],'dB'))+
 block('Compare surveyed stops','<p>Unknown expected counts are excluded from packet rate. Relayed signal values can describe the last hop.</p>'+
 [['Distance from anchor',r=>{const d=km(r);return d===null?'Unknown':(Math.floor(d/2)*2)+'–'+(Math.floor(d/2)*2+2)+' km';}],['Direction from anchor',sector],['Vehicle placement',r=>r.vehicle||'Unknown'],['Antenna height',r=>r.height||'Unknown'],['Test date',r=>r.time?localTime(new Date(r.time)).slice(0,10):'Unknown'],['Location consistency',r=>getSite(r.site)?.name||r.name]].map(([n,k])=>'<details><summary>'+safe(n)+'</summary>'+groups(rows,k)+'</details>').join(''))+
 block('Measured gaps','<ul>'+rows.filter(r=>r.received===0).map(r=>'<li>'+safe(r.name)+' · '+format(km(r),' km')+'</li>').join('')+'</ul><p>A missed stop is specific to the logged test conditions.</p>')+
 block('Free-space calculator','<p>Ideal free-space path loss and midpoint first Fresnel radius. Terrain, clutter, foliage, antenna gains and system losses require separate analysis.</p><form id="rf"><div class="grid">'+number('km','Path distance (km)',.001,5000)+number('mhz','Actual frequency (MHz)',1,100000)+'</div><button>Calculate</button></form><p><output id="rf-output" aria-live="polite"></output></p>');
}
function readiness(){
 const results=trials(data.logs).filter(t=>t.rows[0].type==='message');
 return intro('Emergency readiness','Verify the Clayton–Cary family route in both directions under controlled conditions. Use current evidence and agree on a fallback for missed check-ins.')+
 '<div class="grid">'+point('Radios recorded',data.profiles.length)+point('RF-isolated stops heard',counts().heard)+point('Controlled two-way trials',results.filter(t=>t.pass&&t.rows.every(r=>r.control)).length)+'</div>'+
 block('Family destinations',data.sites.filter(s=>s.type==='destination').map(site=>{
  const records=results.filter(t=>{const r=t.rows[0];return (r.site===site.id&&getSite(r.anchor)?.type==='anchor')||(r.anchor===site.id&&getSite(r.site)?.type==='anchor');});
  const passed=records.filter(t=>t.pass&&t.rows.every(r=>r.control)),days=[...new Set(passed.filter(t=>t.rows.every(r=>r.time)).map(t=>t.rows.map(r=>r.time).sort().at(-1).slice(0,10)))].sort();
  const age=days.length?(Date.now()-Date.parse(days.at(-1)))/86400000:Infinity;
  const recent=records.filter(t=>t.rows.some(r=>r.time)).sort((a,b)=>b.rows.map(r=>r.time).sort().at(-1).localeCompare(a.rows.map(r=>r.time).sort().at(-1)))[0];
  const regressed=recent&&!recent.pass;
  const relayed=records.some(t=>t.rows.some(r=>r.path==='relayed')),unknown=records.some(t=>t.rows.some(r=>!r.control||r.path==='unknown'));
  return '<p><strong>'+safe(site.name)+'</strong> · '+(regressed?'Latest trial failed or incomplete · retest due':days.length>=2?(age>30?'Retest due':'Repeat controlled evidence on file'):(days.length?'One controlled test date':'Awaiting controlled end-to-end test'))+' · '+passed.length+' controlled passes / '+records.length+' recorded RF-isolated trials'+(relayed?' · Relay observed':'')+(unknown?' · Path or internet dependency unresolved for some trials':'')+'</p>';
 }).join('')||'<p>Save an anchor and a family destination in Relay Planner to track route evidence.</p>')+
 block('Family check-in drill','<ol><li>Agree on endpoints, a test time, a short identifier and a fallback before leaving.</li><li>Confirm every participating radio is charged and MQTT isolation is checked. Note all known relay and power dependencies.</li><li>Send the numbered message and have the other person read it and reply with the same identifier. Record both directions, even if either failed.</li><li>Repeat on different days, after equipment changes and at least every 30 days for this dashboard’s retest indicator.</li><li>When a check-in is missed, follow your prearranged contact plan.</li></ol>');
}
function dataHelp(){
 return intro('Data & help','Browser storage can be cleared or evicted. Keep a manual JSON backup in a place you control. Exports can contain exact locations and screenshots.')+
 block('Back up or restore','<div class="actions"><button data-export="json">Export JSON backup</button><button data-export="csv">Export observations CSV</button><button data-clear class="danger">Delete all project data</button></div>'+
 '<label>Choose a backup, packet CSV or map overlay<input id="import" type="file" accept=".json,.csv,.geojson,.gpx,.kml"></label>'+
 '<p class="muted">JSON restores the entire project. CSV imports add observations and skip detected duplicates. GPX, KML and GeoJSON are reference overlays. CSV preview lets you choose how to interpret incoming data.</p><div id="preview"></div>')+
 block('Install and work offline','<p>On iPhone, open this page in Safari, tap Share, select Add to Home Screen, and open the installed app while online once. On desktop, use your browser’s install action when available. The app, records and coordinate map work offline after the local cache is ready.</p>'+
 (installPrompt?'<button data-install>Install Mesh Field Lab</button>':'')+'<p><output id="worker"></output></p>')+
 block('Radio and data limits','<p>Use the native Meshtastic app for Bluetooth and radio settings. Log measurements manually, or import supported CSV fields. The PWA does not listen to radios or run a background radio logger. The iOS Position Log can supply position context. It does not establish packet counts or delivery.</p><p>No analytics or external tile requests are configured. When you follow an external link, that site handles your request. The coordinate map stays local.</p>')+
 block('Glossary','<dl><dt>LoRa</dt><dd>Radio modulation used for the over-the-air Meshtastic link.</dd><dt>MQTT</dt><dd>An internet messaging bridge that can join separate meshes.</dd><dt>RSSI and SNR</dt><dd>Received signal level in dBm and signal-to-noise ratio in dB.</dd><dt>Hop and traceroute</dt><dd>A relay forwarding step and a diagnostic that can report forward and return paths.</dd><dt>Line of sight and Fresnel clearance</dt><dd>The direct path and surrounding volume where obstacles affect the signal.</dd><dt>Packet reception</dt><dd>An observed packet. A recipient acknowledgment and a human reply are distinct evidence.</dd></dl><a href="https://meshtastic.org/docs/" target="_blank" rel="noreferrer">Official Meshtastic documentation</a>');
}
const views={dashboard,guide,field,map:mapped,analytics,relay,ready:readiness,devices,data:dataHelp};
function localTime(d=new Date()){
 return new Date(d.getTime()-d.getTimezoneOffset()*60000).toISOString().slice(0,16);
}
function fill(form,record){
 for(const [key,value] of Object.entries(record||{})){
  const el=form.elements.namedItem(key);
  if(!el||el.type==='file')continue;
  if(el.type==='checkbox')el.checked=Boolean(value);
  else el.value=key==='time'&&value?localTime(new Date(value)):value??'';
 }
}
function render(){
 const current=page();
 $('#nav').innerHTML=Object.entries(nav).map(([k,n])=>'<a href="#'+k+'" '+(k===current?'aria-current="page"':'')+'>'+n+'</a>').join('');
 $('#view').innerHTML=views[current]();
 const form=$('[data-form]');
 if(form&&editing){fill(form,data[editing.kind].find(r=>r.id===editing.id));if(editing.kind==='logs')form.querySelector('details').open=true;}
 if(current==='field'){
  if(!editing){form.elements.time.value=localTime();form.elements.session.value=data.drafts.find(r=>r.id==='session')?.value||'';}
  updateTimer();
 }
 if(current==='map'){fill($('#map-filter'),mapFilter);mountMap();}
 if(current==='data'&&'serviceWorker' in navigator){
  $('#worker').textContent=navigator.serviceWorker.controller?'Offline cache is active.':'Offline cache is preparing. Reload after your first online visit.';
 }
}
function updateTimer(){
 const el=$('#clock');
 if(!el)return;
 const left=Math.max(0,Math.ceil((stopTime-Date.now())/1000));
 el.textContent=!stopTime?'Timer idle':left?Math.floor(left/60)+':'+String(left%60).padStart(2,'0')+' remaining':'Observation window ended. Enter your counts manually.';
 if(!left)clearInterval(timer);
}
function download(name,type,content){
 const a=document.createElement('a'),url=URL.createObjectURL(new Blob([content],{type}));
 a.href=url;a.download=name;document.body.append(a);a.click();a.remove();
 setTimeout(()=>URL.revokeObjectURL(url),30000);
}
function imageFile(file){
 if(!file||!file.size)return Promise.resolve(null);
 if(file.size>2000000||!['image/png','image/jpeg','image/webp'].includes(file.type))throw Error('Choose a PNG, JPEG or WebP under 2 MB.');
 return new Promise((resolve,reject)=>{const r=new FileReader();r.onload=()=>resolve(r.result);r.onerror=()=>reject(r.error);r.readAsDataURL(file);});
}
async function persist(items,options){
 await write(items,options);data=await read();
}
async function save(form){
 const kind=form.dataset.form,raw=Object.fromEntries(new FormData(form));
 if(editing?.kind===kind){raw.id=editing.id;raw.image=data[kind].find(r=>r.id===raw.id)?.image;}
 if(kind==='logs'&&raw.time)raw.time=new Date(raw.time).toISOString();
 if(kind==='logs'&&raw.anchor&&raw.site&&raw.anchor===raw.site)throw Error('Choose different endpoints.');
 const image=raw.attachment?await imageFile(raw.attachment):null;
 if(image)raw.image=image;
 const row=clean(kind,raw),items={[kind]:[row]};
 if(kind==='logs'){
  items.drafts=[{id:'session',value:row.session}];
  stopTime=0;clearInterval(timer);
 }
 await persist(items);
 editing=null;render();status('Saved locally.');
}
function dedupe(rows){
 const key=r=>csv([{...r,id:null}]);
 const keys=new Set(data.logs.map(key)),ids=new Set(data.logs.map(r=>r.id)),out=[];
 for(const r of rows){const k=key(r);if(ids.has(r.id)||keys.has(k))continue;out.push(r);ids.add(r.id);keys.add(k);}
 return out;
}
function showPreview(){
 const target=$('#preview');
 if(!target||!pending)return;
 if(pending.k==='csv'){
  const {heads}=readCSV(pending.source);
  target.innerHTML='<form id="csv-preview"><div class="grid">'+select('mode','CSV format',[['auto','Detect Mesh Field Lab or packet CSV'],['packet','Packet CSV'],['position','iOS Position Log / positions']])+
  Object.entries({name:'Name or sender',time:'Timestamp (ISO with offset)',lat:'Receiver latitude',lon:'Receiver longitude',rssi:'RSSI (dBm)',snr:'SNR (dB)',notes:'Payload or notes'}).map(([k,n])=>select(k,n,[['','Auto'],...heads.map(h=>[h,h])])).join('')+'</div><button>Preview import</button></form><div id="csv-results"></div>';
  previewCSV();
 }else{
  const message=pending.k==='backup'?'Replace this workspace with '+pending.value.logs.length+' observations, '+pending.value.sites.length+' sites and '+pending.value.profiles.length+' radios?':'Add reference overlay '+pending.value.name+' ('+pending.value.paths.length+' shapes)?';
  target.innerHTML='<p>'+safe(message)+'</p><button class="primary" data-apply>Confirm import</button>';
 }
}
function previewCSV(){
 const target=$('#csv-results'),form=$('#csv-preview');
 try{
  const map=Object.fromEntries(new FormData(form)),rows=parseCSV(pending.source,map.mode,map),unique=dedupe(rows);
  pending.rows=unique;
  target.innerHTML='<p>'+unique.length+' new rows · '+(rows.length-unique.length)+' duplicate rows skipped</p><div class="table"><table><thead><tr><th>Name</th><th>Source time</th><th>Received</th><th>Coordinates</th></tr></thead><tbody>'+
  unique.slice(0,5).map(r=>'<tr><td>'+safe(r.name)+'</td><td>'+safe(r.time||'Unknown')+'</td><td>'+safe(r.received??'Unknown')+'</td><td>'+safe(r.lat===null?'—':r.lat+', '+r.lon)+'</td></tr>').join('')+'</tbody></table></div>'+(unique.length?'<button class="primary" data-apply>Save these observations</button>':'');
 }catch(e){pending.rows=null;target.textContent=e.message;}
}
async function openImport(file){
 if(file.size>30_000_000)throw Error('Choose an input file under 30 MB.');
 const source=await file.text(),name=file.name;
 if(/\.csv$/i.test(name))pending={k:'csv',source};
 else if(/\.json$/i.test(name)&&!(/\.geojson$/i.test(name))){
  const value=JSON.parse(source);pending=value.schema!==undefined?{k:'backup',value:backup(value)}:{k:'overlay',value:overlay(name,source)};
 }else pending={k:'overlay',value:overlay(name,source)};
 if(page()==='data')showPreview();
}
function geolocate(button){
 if(!navigator.geolocation){status('GPS is unavailable. Enter coordinates manually.');return;}
 const form=button.closest('form');button.disabled=true;status('Waiting for location permission or GPS…');
 navigator.geolocation.getCurrentPosition(p=>{
  button.disabled=false;if(!form.isConnected)return;
  form.elements.lat.value=p.coords.latitude.toFixed(6);form.elements.lon.value=p.coords.longitude.toFixed(6);
  status('Coordinates captured locally · estimated accuracy '+Math.round(p.coords.accuracy)+' m.');
 },()=>{button.disabled=false;if(form.isConnected)status('GPS did not return a fix. Check permissions or enter coordinates manually.');},{enableHighAccuracy:true,timeout:15000});
}
$('#view').addEventListener('click',async e=>{
 const b=e.target.closest('button');if(!b)return;
 const d=b.dataset;
 try{
  if(d.gps!==undefined)geolocate(b);
  if(d.step!==undefined){step=Number(d.step);await persist({drafts:[{id:'step',value:String(step)}]});render();$('[aria-current="step"]')?.focus();}
  if(d.complete){await persist({checks:[{id:d.complete,done:!complete(d.complete)}]});render();$('[data-complete]')?.focus();}
  if(d.edit){editing={kind:d.edit,id:d.id};render();$('[name="name"]')?.focus();}
  if(d.cancel!==undefined){editing=null;render();}
  if(d.delete&&confirm('Delete this record?')){await persist({},{del:[d.delete,d.id]});editing=null;render();status('Record deleted.');}
  if(d.clear!==undefined&&confirm('Delete every observation, site, profile, overlay and guide step from this browser?')){
   await persist({},{replace:true});step=0;pending=null;render();status('Local project data deleted.');
  }
  if(d.export==='json')download('mesh-field-lab-backup.json','application/json',JSON.stringify({schema:1,...data}));
  if(d.export==='csv')download('mesh-field-lab-observations.csv','text/csv',csv(ordered()));
  if(d.apply!==undefined&&pending){
   const preview=pending;
   if(preview.k==='backup'){await persist(preview.value,{replace:true});step=Math.min(steps.length-1,Math.max(0,Number(data.drafts.find(x=>x.id==='step')?.value)||0));}
   if(preview.k==='overlay')await persist({overlays:[preview.value]});
   if(preview.k==='csv'&&preview.rows)await persist({logs:dedupe(preview.rows)});
   pending=null;render();status('Import saved locally.');
  }
  if(d.install!==undefined&&installPrompt){await installPrompt.prompt();installPrompt=null;render();}
  if(b.id==='start'){
   const minutes=Number($('#minutes').value);
   if(minutes<1||minutes>60||!Number.isFinite(minutes))throw Error('Choose an observation window from 1 to 60 minutes.');
   const now=new Date();$('[name="time"]').value=localTime(now);stopTime=Date.now()+minutes*60000;
   clearInterval(timer);timer=setInterval(updateTimer,250);updateTimer();
  }
  if(b.id==='stop'){stopTime=0;clearInterval(timer);updateTimer();}
 }catch(error){status(error.message);}
});
$('#view').addEventListener('submit',async e=>{
 e.preventDefault();
 const form=e.target,button=form.querySelector('button:not([type="button"])');
 try{
  if(form.dataset.form){if(button)button.disabled=true;await save(form);}
  if(form.id==='map-filter'){mapFilter=Object.fromEntries(new FormData(form));mountMap();}
  if(form.id==='csv-preview')previewCSV();
  if(form.id==='rf'){
   const v=new FormData(form),km=Number(v.get('km')),mhz=Number(v.get('mhz'));
   $('#rf-output').textContent=km&&mhz?'Path loss '+format(loss(km,mhz),' dB')+' · midpoint radius '+format(fresnel(km,mhz),' m')+' · 60% radius '+format(.6*fresnel(km,mhz),' m'):'Enter both distance and frequency.';
  }
 }catch(error){status(error.message);}finally{if(button)button.disabled=false;}
});
$('#view').addEventListener('change',async e=>{
 if(e.target.id!=='import'||!e.target.files.length)return;
 pending=null;$('#preview').replaceChildren();status('');
 try{await openImport(e.target.files[0]);}catch(error){status(error.message);}
});
addEventListener('hashchange',()=>{
 if(location.hash==='#content')return;
 editing=null;pending=null;status('');render();$('#content').focus();
});
try{
 data=await read();
 step=Math.min(steps.length-1,Math.max(0,Number(data.drafts.find(x=>x.id==='step')?.value)||0));
 render();
}catch(error){status('Local storage unavailable: '+error.message);}
