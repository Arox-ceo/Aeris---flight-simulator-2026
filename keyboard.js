import {systemNames,activateSystem} from './systems.js';
export function installKeyboard(getState,notify){
 let digits=null,timer;
 const guide=document.createElement('dialog');guide.id='keyboard-guide';guide.innerHTML='<button class="close" aria-label="Close keyboard guide">×</button><span class="overline">COMMAND REFERENCE</span><h2>Your keyboard. Your cockpit.</h2><p>Press X, then two digits to operate any system. Example: X → 2 → 5 toggles the APU. Escape cancels. Commands work during flight; typing in a field never operates the aircraft.</p><div class="quick-keys">G · Gear &nbsp; I · Engines &nbsp; U · APU &nbsp; V · Electrical &nbsp; J · Anti-ice &nbsp; L · Level assist &nbsp; K · This guide</div><input type="search" placeholder="Find a system or command…" aria-label="Search keyboard commands"><div class="command-list"></div>';
 document.body.append(guide);guide.querySelector('.close').onclick=()=>guide.close();
 const render=()=>{const q=guide.querySelector('input').value.toLowerCase();guide.querySelector('.command-list').innerHTML=systemNames.map((name,i)=>({name,code:String(i+1).padStart(2,'0')})).filter(x=>(x.name+' '+x.code).toLowerCase().includes(q)).map(x=>'<div><kbd>X '+x.code+'</kbd><span>'+x.name+'</span></div>').join('');};render();guide.querySelector('input').oninput=render;
 const b=document.createElement('button');b.className='icon-btn';b.textContent='K';b.title='Advanced keyboard controls (K)';b.setAttribute('aria-label','Advanced keyboard controls');b.onclick=()=>guide.showModal();document.querySelector('header nav').prepend(b);
 const cancel=()=>{digits=null;clearTimeout(timer);};
 window.addEventListener('blur',cancel);
 document.addEventListener('keydown',e=>{
  if(e.repeat||e.ctrlKey||e.metaKey||e.altKey||e.target.closest('input,select,textarea,[contenteditable="true"]'))return;
  if(document.querySelector('dialog[open]')){cancel();return;}
  if(e.code==='KeyK'){e.preventDefault();e.stopImmediatePropagation();cancel();guide.showModal();return;}
  if(!document.body.classList.contains('flying')||document.body.classList.contains('paused'))return;
  if(e.code==='KeyX'){e.preventDefault();e.stopImmediatePropagation();digits='';notify('SYSTEM COMMAND · Enter 01–47 · Esc to cancel');clearTimeout(timer);timer=setTimeout(()=>{cancel();notify('System command cancelled');},5000);return;}
  if(digits!==null){e.preventDefault();e.stopImmediatePropagation();if(e.code==='Escape'){cancel();notify('System command cancelled');return;}const m=e.code.match(/^(?:Digit|Numpad)(\d)$/);if(!m){cancel();notify('Command cancelled. Use X followed by 01–47.');return;}digits+=m[1];if(digits.length===2){const i=Number(digits)-1;cancel();notify(i>=0&&i<47?activateSystem(getState(),i):'Unknown command. Use 01–47.');}else notify('SYSTEM COMMAND · X '+digits+' _');return;}
  const direct={KeyG:10,KeyI:1,KeyU:24,KeyV:4,KeyJ:19};if(e.code in direct){e.preventDefault();e.stopImmediatePropagation();notify(activateSystem(getState(),direct[e.code]));}
 },true);
}
