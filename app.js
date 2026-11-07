import {installKeyboard} from './keyboard.js';
import {installChaseCamera} from './chase-camera.js';
import {installSystems,stepSystems,systemsFor} from './systems.js';
import {installOperations,beginOperations,stepOperations,hideOperations} from './operations.js';
import {Scene} from './scene.js';
import {installAircraftPicker,getSelectedAircraft} from './aircraft.js';
import {installIndonesia,getDestination} from './indonesia.js';
import {getAirport,airportPosition,drawIndonesia} from './geography.js';
import {newFlight,stepFlight,terrainHeight,route,clamp,rad} from './flight.js';
const $=id=>document.getElementById(id);
let scene,state=newFlight(),mode='free',weather='day',camera='chase',started=false,paused=false,keys=new Set(),toastTimer,helpWasPaused=false,lastTime=0,uiTime=0;
let soundEnabled=false,audioContext,oscillator,noiseNode,engineGain;
try{scene=new Scene($('world'));}catch(e){$('error').hidden=false;console.error(e);}
const chaseCamera=scene?installChaseCamera($('world'),scene,()=>started&&!paused&&camera==='chase'&&!document.querySelector('dialog[open]')):null;
const missionDescriptions={free:'Start in the sky. Follow the rings or find your own way.',takeoff:'Board at the gate, request pushback, taxi, and take off.',landing:'Line up with runway 36. Aim for a smooth, controlled touchdown.'};
const weatherText={day:'24°C · 4 KT',golden:'21°C · 3 KT',cloudy:'18°C · 6 KT'};
const headings=['N','030','060','E','120','150','S','210','240','W','300','330'];
const toast=message=>{clearTimeout(toastTimer);$('toast').textContent=message;$('toast').classList.add('show');toastTimer=setTimeout(()=>$('toast').classList.remove('show'),4200);};
const setText=(id,value)=>{const e=$(id);if(e.textContent!==String(value))e.textContent=value;};
function closeDialogs(){for(const d of document.querySelectorAll('dialog[open]'))d.close();}
function startFlight(){
  if(!scene)return;
  chaseCamera?.reset();
  closeDialogs();mode=$('mission').value;state=newFlight(mode,getSelectedAircraft());beginOperations(state);started=true;paused=false;keys.clear();camera='chase';scene.firstCamera=true;
  document.body.classList.add('flying');document.body.classList.remove('paused');$('lobby').hidden=true;$('lobby-footer').hidden=true;$('flight-ui').hidden=false;$('cockpit').hidden=true;
  setText('camera-label','Chase view');setText('status-label','YOU HAVE THE CONTROLS');$('autopilot').classList.remove('active');$('autopilot').setAttribute('aria-pressed','false');$('throttle').value=Math.round(state.throttle*100);
  setText('objective-label',mode==='free'?'DISCOVERY FLIGHT':mode==='takeoff'?getAirport().id+' · TAKEOFF':getAirport().id+' · APPROACH');
  toast(mode==='free'?'Welcome aboard. Fly through the rings, or explore freely.':mode==='takeoff'?'Hold Shift for full throttle. At the indicated rotation speed, hold ↓ to lift off.':'Runway ahead. Use gentle pitch inputs and follow the aircraft approach speed.');
  updateUI();updateAudio();
}
function returnHome(){hideOperations();closeDialogs();started=false;paused=false;keys.clear();state=newFlight("free",getSelectedAircraft());scene.firstCamera=true;document.body.classList.remove('flying','paused');$('lobby').hidden=false;$('lobby-footer').hidden=false;$('flight-ui').hidden=true;setText('status-label','THE WORLD IS YOUR RUNWAY');updateAudio();}
function setPause(on,crashMessage){
  if(!started)return;paused=on;keys.clear();document.body.classList.toggle('paused',on);
  if(on){$('pause-dialog').showModal();setText('pause-eyebrow',state.crashed?'EVERY FLIGHT TEACHES YOU SOMETHING':'TAKE A BREATHER');setText('pause-title',state.crashed?'Let’s try that again.':'Holding the horizon.');setText('pause-message',crashMessage||'Your aircraft is paused. The sky will be right here.');$('resume').hidden=state.crashed;
    setText('stat-distance',(state.distance/1852).toFixed(1)+' NM');setText('stat-time',Math.floor(state.elapsed/60).toString().padStart(2,'0')+':'+Math.floor(state.elapsed%60).toString().padStart(2,'0'));setText('stat-rings',state.ring+' / 6');
  }else{$('pause-dialog').close();}updateAudio();
}
function showHelp(){helpWasPaused=paused;if(started){paused=true;keys.clear();}$('help-dialog').showModal();updateAudio();}
function hideHelp(){$('help-dialog').close();paused=helpWasPaused;keys.clear();updateAudio();}
function toggleCamera(){if(!started)return;camera=camera==='chase'?'cockpit':'chase';scene.firstCamera=true;setText('camera-label',camera==='chase'?'Chase view':'Cockpit view');$('cockpit').hidden=camera!=='cockpit';toast(camera==='cockpit'?'Cockpit view · Press C to switch cameras':'Chase view · Press C to switch cameras');}
function toggleAssist(){if(!started||paused)return;state.assist=!state.assist;systemsFor(state).on[7]=state.assist;$('autopilot').classList.toggle('active',state.assist);$('autopilot').setAttribute('aria-pressed',String(state.assist));toast(state.assist?'Level assist engaged. Manual pitch or bank inputs disengage it.':'Level assist disengaged. Your aircraft. Your controls.');}
$('fly').addEventListener('click',startFlight);$('mission').addEventListener('change',()=>{$('mission-description').textContent=missionDescriptions[$('mission').value];document.querySelector('.panel-heading span+span').textContent=String(['free','takeoff','landing'].indexOf($('mission').value)+1).padStart(2,'0')+' / 03';});
document.querySelectorAll('[data-weather]').forEach(btn=>btn.addEventListener('click',()=>{weather=btn.dataset.weather;document.querySelectorAll('[data-weather]').forEach(b=>{b.classList.toggle('selected',b===btn);b.setAttribute('aria-pressed',String(b===btn));});setText('weather-condition',weatherText[weather]);}));
$('home').addEventListener('click',e=>{e.preventDefault();if(started)setPause(true);});
$('help').addEventListener('click',showHelp);$('controls-link').addEventListener('click',showHelp);document.querySelector('.close').addEventListener('click',hideHelp);document.querySelector('.close-help').addEventListener('click',hideHelp);
$('help-dialog').addEventListener('cancel',e=>{e.preventDefault();hideHelp();});
$('camera').addEventListener('click',toggleCamera);$('autopilot').addEventListener('click',toggleAssist);$('pause').addEventListener('click',()=>setPause(true));$('resume').addEventListener('click',()=>setPause(false));$('restart').addEventListener('click',startFlight);$('end').addEventListener('click',returnHome);
$('pause-dialog').addEventListener('cancel',e=>{e.preventDefault();if(!state.crashed)setPause(false);});
$('throttle').addEventListener('input',e=>{state.throttle=Number(e.target.value)/100;setText('throttle-value',Math.round(state.throttle*100)+'%');});
$('fullscreen').addEventListener('click',async()=>{try{if(document.fullscreenElement)await document.exitFullscreen();else await document.documentElement.requestFullscreen();}catch{toast('Fullscreen is unavailable in this browser view.');}});
function enableAudio(){
  if(!audioContext){
    audioContext=new(window.AudioContext||window.webkitAudioContext)();engineGain=audioContext.createGain();engineGain.gain.value=0;engineGain.connect(audioContext.destination);
    oscillator=audioContext.createOscillator();oscillator.type='sawtooth';const filter=audioContext.createBiquadFilter();filter.type='lowpass';filter.frequency.value=180;oscillator.connect(filter);filter.connect(engineGain);oscillator.start();
    const buffer=audioContext.createBuffer(1,audioContext.sampleRate*2,audioContext.sampleRate),data=buffer.getChannelData(0);for(let i=0;i<data.length;i++)data[i]=(Math.random()*2-1)*.12;
    noiseNode=audioContext.createBufferSource();noiseNode.buffer=buffer;noiseNode.loop=true;const noiseFilter=audioContext.createBiquadFilter();noiseFilter.type='lowpass';noiseFilter.frequency.value=280;noiseNode.connect(noiseFilter);noiseFilter.connect(engineGain);noiseNode.start();
  }
  audioContext.resume().catch(()=>{});
}
function updateAudio(){if(!audioContext)return;const active=soundEnabled&&started&&!paused;engineGain.gain.setTargetAtTime(active?.035+state.throttle*.035:0,audioContext.currentTime,.12);oscillator.frequency.setTargetAtTime(30+state.throttle*38,audioContext.currentTime,.1);}
$('sound').addEventListener('click',()=>{try{soundEnabled=!soundEnabled;if(soundEnabled)enableAudio();$('sound').setAttribute('aria-label',soundEnabled?'Mute engine sound':'Enable engine sound');$('sound').innerHTML=soundEnabled?'<svg viewBox="0 0 24 24"><path d="m11 5-6 4H2v6h3l6 4zM16 8c3 2 3 6 0 8m3-11c5 4 5 10 0 14"/></svg>':'<svg viewBox="0 0 24 24"><path d="m11 5-6 4H2v6h3l6 4zM16 9l6 6m0-6-6 6"/></svg>';updateAudio();toast(soundEnabled?'Engine sound on':'Engine sound off');}catch{soundEnabled=false;toast('Audio is unavailable in this browser.');}});
const flightKeys=new Set(['ArrowUp','ArrowDown','ArrowLeft','ArrowRight','KeyW','KeyA','KeyS','KeyD','KeyQ','KeyE','ShiftLeft','ShiftRight','ControlLeft','ControlRight','Space']);
document.addEventListener('keydown',e=>{
  if(e.defaultPrevented||e.code==='Escape')return;
  const inForm=['SELECT','INPUT','TEXTAREA'].includes(document.activeElement.tagName);if(inForm)return;
  if(!started){if(e.code==='Enter'&&!inForm&&!document.querySelector('dialog[open]')){e.preventDefault();startFlight();}return;}
  if(e.ctrlKey&&!['ControlLeft','ControlRight'].includes(e.code)&&!flightKeys.has(e.code))return;
  if(flightKeys.has(e.code)&&!inForm)e.preventDefault();
  if(e.repeat)return;
  if(e.code==='KeyH'&&!$('pause-dialog').open){e.preventDefault();if($('help-dialog').open)hideHelp();else showHelp();return;}
  if(document.querySelector('dialog[open]')){if(e.code==='KeyP'&&$('pause-dialog').open&&!state.crashed)setPause(false);return;}
  if(e.code==='KeyP'){setPause(!paused);return;}if(e.code==='KeyC'){toggleCamera();return;}if(e.code==='KeyL'){toggleAssist();return;}if(e.code==='KeyR'){startFlight();return;}
  if(!paused&&!inForm)keys.add(e.code);
});
document.addEventListener('keyup',e=>keys.delete(e.code));
window.addEventListener('blur',()=>{keys.clear();if(started&&!paused)setPause(true);});
document.addEventListener('visibilitychange',()=>{if(document.hidden){keys.clear();if(started&&!paused)setPause(true);}});
for(const button of document.querySelectorAll('[data-key]')){button.addEventListener('pointerdown',e=>{e.preventDefault();if(!paused){keys.add(button.dataset.key);button.setPointerCapture(e.pointerId);}});for(const name of['pointerup','pointercancel','lostpointercapture'])button.addEventListener(name,()=>keys.delete(button.dataset.key));}
const map=$('map').getContext('2d'),att=$('attitude').getContext('2d');
function drawMap(){drawIndonesia(map,250,180,{selected:getAirport().id,destination:getDestination()?.id,position:state});}
function drawAttitude(){const c=att;c.clearRect(0,0,110,110);c.save();c.beginPath();c.arc(55,55,46,0,Math.PI*2);c.clip();c.translate(55,55);c.rotate(-state.roll);c.translate(0,state.pitch*100);c.fillStyle='#547c8e';c.fillRect(-180,-180,360,180);c.fillStyle='#756648';c.fillRect(-180,0,360,180);c.strokeStyle='#d4e1db';c.lineWidth=1.5;c.beginPath();c.moveTo(-100,0);c.lineTo(100,0);c.stroke();for(let i=-3;i<=3;i++){if(i===0)continue;c.strokeStyle='#d4e1db88';c.lineWidth=.8;c.beginPath();c.moveTo(i%2?-9:-16,i*17.45);c.lineTo(i%2?9:16,i*17.45);c.stroke();}c.restore();c.beginPath();c.arc(55,55,46,0,Math.PI*2);c.strokeStyle='#6d8995';c.lineWidth=2;c.stroke();c.strokeStyle='#ffd091';c.lineWidth=2;c.beginPath();c.moveTo(27,55);c.lineTo(45,55);c.lineTo(45,60);c.moveTo(65,60);c.lineTo(65,55);c.lineTo(83,55);c.stroke();c.fillStyle='#ffd091';c.beginPath();c.arc(55,55,2,0,Math.PI*2);c.fill();c.beginPath();c.moveTo(55,11);c.lineTo(51,17);c.lineTo(59,17);c.fill();}
function updateUI(){
  const hdg=((state.heading/rad)%360+360)%360,knots=state.speed*1.94384,alt=Math.max(0,state.y*3.28084),agl=Math.max(0,(state.y-Math.max(0,terrainHeight(state.x,state.z)))*3.28084),vsi=state.vy*196.85;
  setText('airspeed',Math.round(knots));setText('altitude',Math.round(alt).toLocaleString('en-US'));setText('agl',Math.round(agl).toLocaleString('en-US'));setText('vertical',(vsi>=0?'+':'−')+Math.round(Math.abs(vsi)/10)*10);setText('throttle-value',Math.round(state.throttle*100)+'%');
  $('throttle').value=Math.round(state.throttle*100);$('speed-meter').style.width=clamp(state.speed/(state.profile.cruise*1.25)*100,0,100)+'%';$('speed-meter').style.background=state.speed<state.profile.stall?'#f6bc77':'#9cc9b3';
  setText('flight-state',state.grounded?'ON THE GROUND':Math.abs(vsi)<100?'LEVEL FLIGHT':vsi>0?'CLIMBING':'DESCENDING');setText('heading-number',String(Math.round(hdg)||360).padStart(3,'0')+'°');
  $('compass-scale').innerHTML=headings.map((label,i)=>{let delta=i*30-hdg;if(delta>180)delta-=360;if(delta<-180)delta+=360;return Math.abs(delta)<70?'<span style="left:'+((delta*3.5)+115)+'px">'+label+'</span>':'';}).join('');
  $('autopilot').classList.toggle('active',state.assist);$('autopilot').setAttribute('aria-pressed',String(state.assist));
  setText('distance',(state.distance/1852).toFixed(1)+' NM FLOWN');
  let warning='';if(!state.grounded&&state.speed<state.profile.stall)warning='STALL · LOWER THE NOSE';else if(!state.grounded&&agl<120&&state.vy<-1.5)warning='LOW ALTITUDE';else if(state.speed>state.profile.cruise*1.2)warning='OVERSPEED · REDUCE THROTTLE';else if(state.grounded&&keys.has('Space'))warning='WHEEL BRAKES';else if(state.grounded&&state.speed>state.profile.rotate)warning=Math.round(state.profile.rotate*1.94384)+' KTS · PITCH UP ↓';setText('warning',warning);
  if(state.mode==='free'){setText('ring-counter',state.ring+' / 6');if(state.ring<route.length){const r=route[state.ring],nm=Math.hypot(state.x-r[0],state.z-r[2])/1852;setText('objective','Ring '+(state.ring+1)+' · '+nm.toFixed(1)+' NM · '+Math.round(r[1]*3.28084).toLocaleString('en-US')+' FT');}else setText('objective','Route complete. The coast is yours to explore.');}
  else if(state.mode==='takeoff'){setText('ring-counter',state.takeoffComplete?'✓':'01');setText('objective',state.takeoffComplete?'Takeoff complete. Enjoy the view.':state.grounded?state.speed<state.profile.rotate?'Full throttle. Accelerate to rotation speed.':'Gently hold ↓ to rotate.':'Climb 600 FT above the airport.');}
  else{setText('ring-counter',state.landed?'✓':'36');setText('objective',state.landed?'Nice landing. Reduce throttle and hold Space to brake.':'Aim for a gentle touchdown at approach speed.');}
  if(getDestination()){const d=getDestination(),[x,z]=airportPosition(d);setText('objective','To '+d.id+' · '+(Math.hypot(x-state.x,z-state.z)/1852).toFixed(1)+' NM · HDG '+String(Math.round((Math.atan2(x-state.x,-(z-state.z))/rad+360)%360)).padStart(3,'0'));}drawMap();drawAttitude();updateAudio();
}
function onEvents(events){for(const e of events){if(e==='liftoff')toast('Positive climb. You’re airborne!');if(e==='ring')toast('Ring '+state.ring+' cleared. Next waypoint ahead.');if(e==='routeComplete')toast('All 6 rings cleared. Beautiful flying! Explore as long as you like.');if(e==='takeoffComplete')toast('Takeoff complete. Welcome to the Indonesia.');if(e==='landed')toast('Smooth touchdown! Throttle to 0%, then hold Space to brake.');if(['crashed','water','runway'].includes(e))setPause(true,e==='water'?'You touched the water. Keep some altitude and try again.':e==='runway'?'You left the runway at speed. Stay on the centerline, then lift off at rotation speed.':'A hard landing. Approach gently, keep your wings level, and reduce your descent rate.');}}
function frame(ms){
  chaseCamera?.update();
  const dt=Math.min((ms-lastTime)/1000||.016,.05);lastTime=ms;
  if(started&&!paused&&!document.querySelector('dialog[open]')){const substeps=Math.ceil(dt/.016);for(let i=0;i<substeps&&!paused;i++){const systemKeys=stepSystems(state,dt/substeps,keys,weather);if(!stepOperations(state,dt/substeps))onEvents(stepFlight(state,dt/substeps,systemKeys,weather));};uiTime+=dt;if(uiTime>.1){updateUI();uiTime=0;}}
  if(scene){if(Math.hypot(state.x-scene.worldCenter[0],state.z-scene.worldCenter[1])>16000)scene.makeWorld(state.x,state.z);if(!started){state.roll=Math.sin(ms*.0002)*.035;state.pitch=.015;}scene.render(state,weather,camera,!started,ms/1000,dt);}
  requestAnimationFrame(frame);
}
let mapPaused=false;
const indonesia=scene?installIndonesia(scene,{
 getState:()=>state,
 modal:open=>{if(open){mapPaused=paused;paused=true;keys.clear();}else paused=mapPaused;updateAudio();},
 airportChanged:()=>{mode='takeoff';$('mission').value='takeoff';state=newFlight(started?mode:'free',getSelectedAircraft());if(started)beginOperations(state);scene.firstCamera=true;updateUI();},
 travelRate:rate=>{state.travelRate=rate;},
 destinationChanged:()=>updateUI()
}):null;
if(scene){installAircraftPicker(scene);state=newFlight('free',getSelectedAircraft());}
window.addEventListener('aircraftchange',()=>{state=newFlight(started?mode:'free',getSelectedAircraft());if(started)beginOperations(state);updateUI();});
document.addEventListener('keydown',e=>{if(e.code==='KeyM'&&!['INPUT','SELECT'].includes(e.target.tagName)&&!document.querySelector('dialog[open]'))indonesia?.open();});
installOperations();
installSystems(()=>state);
installKeyboard(()=>state,toast);
updateUI();requestAnimationFrame(frame);
