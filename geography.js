import {countries,airportData} from './geography-data.js';
export {countries};
export const airports=airportData;
export const METRES_PER_DEGREE=111320;
export const MAP_BOUNDS={west:94,east:142,north:7,south:-12};
let activeAirport=airports.find(a=>a.id==='DPS');
export function getAirport(id){return id?airports.find(a=>a.id===id):activeAirport;}
export function setAirport(id){const a=getAirport(id);if(!a)throw Error('Unknown Indonesia airport: '+id);activeAirport=a;return a;}
export function geoToWorld(lon,lat){return[(lon-activeAirport.lon)*METRES_PER_DEGREE*Math.cos(activeAirport.lat*Math.PI/180),(activeAirport.lat-lat)*METRES_PER_DEGREE];}
export function worldToGeo(x,z){return[activeAirport.lon+x/(METRES_PER_DEGREE*Math.cos(activeAirport.lat*Math.PI/180)),activeAirport.lat-z/METRES_PER_DEGREE];}
export function airportPosition(a=activeAirport){return geoToWorld(a.lon,a.lat);}
export function runwayToWorld(across,back,a=activeAirport){const[x,z]=airportPosition(a),r=a.heading*Math.PI/180;return[x+across*Math.cos(r)-back*Math.sin(r),z+across*Math.sin(r)+back*Math.cos(r)];}
export function worldToRunway(x,z,a=activeAirport){const[p,q]=airportPosition(a),r=a.heading*Math.PI/180,dx=x-p,dz=z-q;return[dx*Math.cos(r)+dz*Math.sin(r),-dx*Math.sin(r)+dz*Math.cos(r)];}
export function mapPoint(lon,lat,w=1000,h=420){return[(lon-MAP_BOUNDS.west)/(MAP_BOUNDS.east-MAP_BOUNDS.west)*w,(MAP_BOUNDS.north-lat)/(MAP_BOUNDS.north-MAP_BOUNDS.south)*h];}
const clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
const allRings=countries.flatMap(c=>c.polygons.map(p=>({rings:p,west:Math.min(...p[0].map(v=>v[0])),east:Math.max(...p[0].map(v=>v[0])),south:Math.min(...p[0].map(v=>v[1])),north:Math.max(...p[0].map(v=>v[1]))})));
const bins=new Map();for(const p of allRings)for(let x=Math.floor(p.west);x<=Math.floor(p.east);x++)for(let y=Math.floor(p.south);y<=Math.floor(p.north);y++){const k=x+','+y;if(!bins.has(k))bins.set(k,[]);bins.get(k).push(p);}
function inRing(x,y,ring){let inside=false;for(let i=0,j=ring.length-1;i<ring.length;j=i++){const a=ring[i],b=ring[j];if((a[1]>y)!==(b[1]>y)&&x<(b[0]-a[0])*(y-a[1])/(b[1]-a[1])+a[0])inside=!inside;}return inside;}
export function isLand(lon,lat){for(const p of bins.get(Math.floor(lon)+','+Math.floor(lat))||[]){if(lon<p.west||lon>p.east||lat<p.south||lat>p.north)continue;if(inRing(lon,lat,p.rings[0])&&!p.rings.slice(1).some(r=>inRing(lon,lat,r)))return true;}return false;}
// Stylized regional relief. Coast geometry is geographic; this is not a DEM.
const peaks=[[97.1,3.7,2100,.5,.8],[100.5,-.4,1600,.35,.65],[101.3,-1.7,2500,.35,.65],[104.1,-4.9,1500,.35,.5],[107.5,-7.1,1800,.3,.22],[110.45,-7.5,2000,.17,.2],[112.95,-8,2400,.22,.18],[114.2,-8.1,2000,.15,.15],[115.51,-8.34,2350,.15,.15],[116.46,-8.41,2800,.14,.16],[118,-8.25,2000,.2,.2],[120.4,-8.65,1500,.4,.15],[124.3,-9.7,1200,.5,.3],[114.7,.7,1600,.8,.8],[117.3,1.7,1400,.6,.6],[120.2,-1.8,2300,.4,.7],[120,-3.4,1900,.4,.5],[124.85,1.35,1500,.2,.2],[127.4,.8,1600,.12,.18],[129.5,-3.1,1800,.5,.18],[133.8,-1.2,2300,.6,.4],[136.6,-3.7,2600,.8,.4],[137.7,-4.1,3900,.5,.35],[139,-4.2,2600,.7,.5],[140.5,-2.6,1500,.5,.2]];
export function terrainHeight(x,z){
 const[lon,lat]=worldToGeo(x,z);let h=-40;
 if(isLand(lon,lat)){h=35+25*Math.sin(lon*37)*Math.cos(lat*31);for(const[pl,pa,ht,sx,sy]of peaks){const d=((lon-pl)/sx)**2+((lat-pa)/sy)**2;if(d<8)h+=ht*Math.exp(-d);}h*=.90+.1*Math.sin(lon*68+lat*47)*Math.cos(lat*79);}
 for(const a of airports){if(Math.abs(lon-a.lon)>.055||Math.abs(lat-a.lat)>.055)continue;const[across,back]=worldToRunway(x,z,a);const d=Math.max(Math.abs(across)/400,Math.abs(back)/(a.length/2+350));if(d<2.3){const t=clamp((d-1)/1.3,0,1);h=a.elevation+(h-a.elevation)*(t*t*(3-2*t));}}
 return h;
}
export function runwayAt(x,z){for(const a of airports){const[p,q]=airportPosition(a);if(Math.abs(x-p)>a.length||Math.abs(z-q)>a.length)continue;const[c,b]=worldToRunway(x,z,a);if(Math.abs(c)<Math.max(a.width/2,24)&&Math.abs(b)<a.length/2)return a;}return null;}
export function distanceNM(a,b){const lat=(a.lat+b.lat)*Math.PI/360;return Math.hypot((a.lon-b.lon)*Math.cos(lat),a.lat-b.lat)*METRES_PER_DEGREE/1852;}
export function drawIndonesia(ctx,width,height,{selected=getAirport().id,destination=null,position=null}={}){
 ctx.clearRect(0,0,width,height);ctx.fillStyle='#102f40';ctx.fillRect(0,0,width,height);
 ctx.strokeStyle='#9acbd21b';ctx.lineWidth=.6;for(let lon=95;lon<=140;lon+=5){const[x]=mapPoint(lon,0,width,height);ctx.beginPath();ctx.moveTo(x,0);ctx.lineTo(x,height);ctx.stroke();}for(let lat=-10;lat<=5;lat+=5){const[,y]=mapPoint(0,lat,width,height);ctx.beginPath();ctx.moveTo(0,y);ctx.lineTo(width,y);ctx.stroke();}
 for(const c of countries){ctx.fillStyle=c.name==='Indonesia'?'#43695d':'#243f48';ctx.strokeStyle=c.name==='Indonesia'?'#7ba38c':'#39545c';ctx.lineWidth=.6;for(const p of c.polygons){ctx.beginPath();for(const r of p){r.forEach((v,i)=>{const q=mapPoint(v[0],v[1],width,height);i?ctx.lineTo(...q):ctx.moveTo(...q);});ctx.closePath();}ctx.fill('evenodd');ctx.stroke();}}
 const a=getAirport(selected),d=getAirport(destination);if(a&&d){ctx.strokeStyle='#ffc477';ctx.lineWidth=1.2;ctx.setLineDash([4,5]);ctx.beginPath();ctx.moveTo(...mapPoint(a.lon,a.lat,width,height));ctx.lineTo(...mapPoint(d.lon,d.lat,width,height));ctx.stroke();ctx.setLineDash([]);}
 for(const a of airports){const p=mapPoint(a.lon,a.lat,width,height);ctx.beginPath();ctx.arc(...p,a.id===selected||a.id===destination?3:1.3,0,Math.PI*2);ctx.fillStyle=a.id===selected?'#ffc477':a.id===destination?'#a8e5cd':'#b6c7c2';ctx.fill();}
 if(position){const[lon,lat]=worldToGeo(position.x,position.z),p=mapPoint(lon,lat,width,height);ctx.save();ctx.translate(...p);ctx.rotate(position.heading);ctx.fillStyle='#fff8dd';ctx.beginPath();ctx.moveTo(0,-6);ctx.lineTo(4,4);ctx.lineTo(0,2);ctx.lineTo(-4,4);ctx.closePath();ctx.fill();ctx.restore();}
 if(width>400){ctx.fillStyle='#b4c8c7';ctx.font='11px sans-serif';for(const[n,lo,la]of[['SUMATRA',100,1],['JAVA',110,-6.3],['KALIMANTAN',114,.8],['SULAWESI',121,1.5],['BALI & NUSA TENGGARA',120,-10.6],['MALUKU',129,-.7],['PAPUA',137,-5.5]])ctx.fillText(n,...mapPoint(lo,la,width,height));}
}
