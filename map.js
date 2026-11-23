import {distance} from './domain.js';
const finitePoint=p=>Array.isArray(p)&&p.length>=2&&Number.isFinite(p[0])&&Number.isFinite(p[1])&&Math.abs(p[0])<=180&&Math.abs(p[1])<=90;
export function overlay(name,source){
 const paths=[];
 if(/\.geojson$|\.json$/i.test(name)){
  const add=g=>{
   if(g?.type==='FeatureCollection')return g.features.forEach(add);
   if(g?.type==='Feature')return add(g.geometry);
   if(g?.type==='GeometryCollection')return g.geometries.forEach(add);
   const c=g?.coordinates;
   if(g?.type==='Point')paths.push([c]);
   else if(g?.type==='MultiPoint')c.forEach(p=>paths.push([p]));
   else if(g?.type==='LineString')paths.push(c);
   else if(['Polygon','MultiLineString'].includes(g?.type))paths.push(...c);
   else if(g?.type==='MultiPolygon')c.forEach(p=>paths.push(...p));
   else throw Error('Unsupported GeoJSON geometry.');
  };add(JSON.parse(source));
 }else{
  if(/<!DOCTYPE|<!ENTITY/i.test(source))throw Error('XML declarations with external entities are unsupported.');
  const xml=new DOMParser().parseFromString(source,'application/xml');
  if(xml.querySelector('parsererror'))throw Error('Invalid XML.');
  if(/\.kml$/i.test(name)){
   for(const el of xml.getElementsByTagNameNS('*','coordinates'))paths.push(el.textContent.trim().split(/\s+/).map(p=>p.split(',').slice(0,2).map(Number)));
  }else if(/\.gpx$/i.test(name)){
   const point=e=>[e.getAttribute('lon'),e.getAttribute('lat')].map(v=>v===null||v===''?NaN:Number(v));
   for(const el of xml.getElementsByTagNameNS('*','wpt'))paths.push([point(el)]);
   for(const el of xml.getElementsByTagNameNS('*','trkseg'))paths.push([...el.getElementsByTagNameNS('*','trkpt')].map(point));
   for(const el of xml.getElementsByTagNameNS('*','rte'))paths.push([...el.getElementsByTagNameNS('*','rtept')].map(point));
  }else throw Error('Choose a GeoJSON, KML or GPX file.');
 }
 if(!paths.length||paths.reduce((n,p)=>n+(p?.length||0),0)>15000||paths.some(p=>!Array.isArray(p)||!p.length||!p.every(finitePoint)))throw Error('Overlay needs valid coordinates and at most 15,000 points.');
 return {id:crypto.randomUUID(),name:name.slice(0,100),paths:paths.map(p=>p.map(c=>c.slice(0,2)))};
}
export function drawMap(host,points,overlays,describe){
 const svg=host.querySelector('svg'),detail=host.querySelector('output');
 const coords=[...points,...overlays.flatMap(o=>o.paths.flatMap(p=>p.map(([lon,lat])=>({lon,lat}))))];
 if(!coords.length){detail.textContent='Save coordinates or load an overlay to plot points.';return;}
 let minLat=90,maxLat=-90,minLon=180,maxLon=-180;
 for(const p of coords){minLat=Math.min(minLat,p.lat);maxLat=Math.max(maxLat,p.lat);minLon=Math.min(minLon,p.lon);maxLon=Math.max(maxLon,p.lon);}
 const midLat=(minLat+maxLat)/2,midLon=(minLon+maxLon)/2;
 const aspect=Math.max(.05,Math.cos(midLat*Math.PI/180));
 const fit=Math.max(.001,(maxLat-minLat)/270,(maxLon-minLon)*aspect/570)/1.7;
 let selected=null,zoom=1,x=0,y=0,drag;
 const make=(tag,attrs)=>{const e=document.createElementNS('http://www.w3.org/2000/svg',tag);for(const [k,v] of Object.entries(attrs))e.setAttribute(k,v);return e};
 function paint(){
  svg.replaceChildren();
  const scale=zoom/fit;
  const place=p=>[300+x+(p.lon-midLon)*aspect*scale,150+y-(p.lat-midLat)*scale];
  for(let i=0;i<=600;i+=50)svg.append(make('line',{x1:i,x2:i,y1:0,y2:300,stroke:'#294036'}));
  for(let i=0;i<=300;i+=50)svg.append(make('line',{x1:0,x2:600,y1:i,y2:i,stroke:'#294036'}));
  for(const o of overlays)for(const path of o.paths){
   const mapped=path.map(([lon,lat])=>place({lon,lat}));
   svg.append(path.length===1?make('rect',{x:mapped[0][0]-4,y:mapped[0][1]-4,width:8,height:8,fill:'#c8acff'}):make('polyline',{points:mapped.map(p=>p.join(',')).join(' '),fill:'none',stroke:'#c8acff','stroke-width':2,'stroke-dasharray':'5 3'}));
  }
  for(const p of points){
   const [cx,cy]=place(p);if(cx<0||cx>600||cy<0||cy>300)continue;
   const {label,color,radius}=describe(p),marker=make('circle',{cx,cy,r:radius,fill:color,tabindex:0,role:'button','aria-label':label});
   const choose=()=>{const km=distance(selected,p);detail.textContent=label+(selected&&selected!==p?' · '+km.toFixed(2)+' km from '+selected.name:' · Select a second point to measure.');selected=p;};
   marker.addEventListener('click',choose);
   marker.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();choose();}});
   svg.append(marker);
  }
 }
 host.querySelectorAll('[data-map]').forEach(b=>b.onclick=()=>{
  const v=b.dataset.map;
  if(v==='fit'){zoom=1;x=0;y=0;selected=null;detail.textContent='Select a marker to inspect it.';}
  else if(v==='in'||v==='out')zoom=Math.min(64,Math.max(.5,zoom*(v==='in'?1.5:1/1.5)));
  else if(v==='left'||v==='right')x+=v==='left'?80:-80;
  else y+=v==='up'?60:-60;
  paint();
 });
 svg.onpointerdown=e=>{if(e.target.tagName==='circle')return;drag=[e.clientX,e.clientY,x,y];svg.setPointerCapture(e.pointerId);};
 svg.onpointermove=e=>{if(!drag)return;const s=600/svg.getBoundingClientRect().width;x=drag[2]+(e.clientX-drag[0])*s;y=drag[3]+(e.clientY-drag[1])*s;paint();};
 svg.onpointerup=svg.onpointercancel=()=>{drag=null;};
 paint();
}
