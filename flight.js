import {getAirport,terrainHeight,runwayToWorld,runwayAt} from './geography.js';
export {terrainHeight};
export const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
export const rad=Math.PI/180;
export const route=[];
export function profileFor(a={}){return{cruise:(a.cruiseKts||450)/1.94384,rotate:(a.rotateKts||135)/1.94384,stall:(a.stallKts||105)/1.94384,approach:(a.approachKts||145)/1.94384,name:a.name||'Boeing 737-800'};}
export function updateRoute(){const a=getAirport();route.length=0;for(const[c,b,extra]of[[0,-6500,0],[4000,-12000,180],[9000,-16000,450],[14000,-7000,500],[9000,3000,350],[1500,5000,100]]){const[x,z]=runwayToWorld(c,b);route.push([x,Math.max(a.elevation+1100+extra,terrainHeight(x,z)+650),z]);}return route;}
export function newFlight(mode='free',aircraft={}){
 const a=getAirport(),p=profileFor(aircraft);updateRoute();const back=mode==='takeoff'?a.length/2-180:mode==='landing'?a.length/2+6500:a.length/2+3200;const[x,z]=runwayToWorld(0,back);
 return{mode,airport:a.id,aircraft:aircraft.id||'b738',profile:p,x,y:mode==='takeoff'?a.elevation+3:mode==='landing'?Math.max(a.elevation+550,terrainHeight(x,z)+350):Math.max(a.elevation+1100,terrainHeight(x,z)+700),z,heading:a.heading*rad,pitch:0,roll:0,speed:mode==='takeoff'?0:mode==='landing'?p.approach:p.cruise*.65,throttle:mode==='takeoff'?0:mode==='landing'?.28:.65,vy:0,grounded:mode==='takeoff',assist:false,crashed:false,landed:false,takeoffComplete:false,elapsed:0,distance:0,ring:0,bestAltitude:0,travelRate:1};
}
export function basis(s){const sh=Math.sin(s.heading),ch=Math.cos(s.heading),sp=Math.sin(s.pitch),cp=Math.cos(s.pitch),sr=Math.sin(s.roll),cr=Math.cos(s.roll),r=[ch,0,sh],u=[-sh*sp,cp,ch*sp],f=[sh*cp,sp,-ch*cp];return{r:r.map((v,i)=>v*cr-u[i]*sr),u:u.map((v,i)=>v*cr+r[i]*sr),f};}
export function stepFlight(s,dt,keys,weather='day'){
 if(s.crashed)return[];const events=[],p=s.profile||profileFor();
 const up=keys.has('ArrowDown')||keys.has('KeyS'),down=keys.has('ArrowUp')||keys.has('KeyW'),left=keys.has('ArrowLeft')||keys.has('KeyA'),right=keys.has('ArrowRight')||keys.has('KeyD');
 if(keys.has('ShiftLeft')||keys.has('ShiftRight'))s.throttle=clamp(s.throttle+dt*.25,0,1);
 if(keys.has('ControlLeft')||keys.has('ControlRight'))s.throttle=clamp(s.throttle-dt*.25,0,1);
 const pitchInput=+up-+down,rollInput=+right-+left;if(pitchInput||rollInput)s.assist=false;
 if(s.assist){s.pitch+=(0-s.pitch)*dt*1.5;s.roll+=(0-s.roll)*dt*1.5;}else{s.pitch=clamp(s.pitch+pitchInput*dt*.14,-.4,.4);if(!pitchInput)s.pitch*=Math.exp(-dt*.025);s.roll=clamp(s.roll+rollInput*dt*.45,-1,1);if(!rollInput)s.roll*=Math.exp(-dt*.10);}
 const rudder=+keys.has('KeyE')-+keys.has('KeyQ');const targetSpeed=p.stall*.75+s.throttle*(p.cruise*1.12-p.stall*.75);
 let accel=((s.enginePower===0?0:targetSpeed)-s.speed)*.08-Math.sin(s.pitch)*9;
 if(s.grounded){accel=s.throttle*6*(s.enginePower??1)-.22-s.speed*.018;if(keys.has('Space'))accel-=12*(s.brakeStrength??1);s.roll*=Math.exp(-dt*6);s.heading+=(rudder*.22+rollInput*.15)*dt*clamp(s.speed/12,0,1);s.pitch=clamp(s.pitch,-.015,.19);}else s.heading+=(Math.tan(s.roll)*9.81/Math.max(s.speed,30)+rudder*.045)*dt;
 s.speed=clamp(s.speed+accel*dt,0,p.cruise*1.4);
 if(s.grounded&&s.speed>p.rotate&&s.pitch>.045){s.grounded=false;s.landed=false;s.vy=3;events.push('liftoff');}
 if(!s.grounded){const stall=clamp((p.stall-s.speed)/p.stall,0,1),sink=s.throttle<.32?(.32-s.throttle)*10:0,desiredVy=Math.sin(s.pitch)*s.speed-stall*34-sink;s.vy+=(desiredVy-s.vy)*Math.min(1,dt*1.6);s.y+=s.vy*dt;}else s.vy=0;
 const groundBefore=Math.max(0,terrainHeight(s.x,s.z));const warp=!s.grounded&&s.y-groundBefore>600&&!pitchInput&&!rollInput?clamp(s.travelRate||1,1,50):1;
 const dx=Math.sin(s.heading)*s.speed*Math.cos(s.pitch)*dt*warp,dz=-Math.cos(s.heading)*s.speed*Math.cos(s.pitch)*dt*warp;s.x+=dx;s.z+=dz;s.distance+=Math.hypot(dx,dz);s.elapsed+=dt;s.bestAltitude=Math.max(s.bestAltitude,s.y);
 if(!s.grounded&&weather==='cloudy')s.roll+=Math.sin(s.elapsed*1.8)*dt*.006;
 const ground=terrainHeight(s.x,s.z),runway=runwayAt(s.x,s.z),floor=runway?runway.elevation+3:Math.max(ground,0)+3;
 if(s.y<floor){if(runway&&s.gearDown!==false&&s.vy>-6&&Math.abs(s.roll)<.18&&s.speed<p.approach*1.4){s.y=floor;s.grounded=true;s.pitch=0;s.roll=0;s.vy=0;if(!s.landed){s.landed=true;s.landedAirport=runway.id;events.push('landed');}}else{s.y=floor;s.crashed=true;events.push(ground<0?'water':'crashed');}}
 if(s.grounded&&!runway&&s.speed>20){s.crashed=true;events.push('runway');}
 if(s.mode==='takeoff'&&!s.takeoffComplete&&s.y>getAirport().elevation+185){s.takeoffComplete=true;events.push('takeoffComplete');}
 if(s.mode==='free'&&s.ring<route.length){const r=route[s.ring];if(Math.hypot(s.x-r[0],s.y-r[1],s.z-r[2])<170){s.ring++;events.push(s.ring===route.length?'routeComplete':'ring');}}
 return events;
}
updateRoute();
