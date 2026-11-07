const clamp=(v,min,max)=>Math.max(min,Math.min(max,v));
export function orbitPosition(state,orbit,distance=31){
 const yaw=state.heading+orbit.yaw,horizontal=Math.cos(orbit.pitch)*distance;
 return [state.x-Math.sin(yaw)*horizontal,state.y+Math.sin(orbit.pitch)*distance,state.z+Math.cos(yaw)*horizontal];
}
export function installChaseCamera(canvas,scene,isActive){
 const orbit=scene.chaseOrbit={yaw:0,pitch:.30};let pointer=null,x=0,y=0;
 const finish=()=>{const id=pointer;pointer=null;canvas.classList.remove('orbit-dragging');if(id!==null&&canvas.hasPointerCapture(id))canvas.releasePointerCapture(id);};
 const reset=()=>{finish();orbit.yaw=0;orbit.pitch=.30;};
 canvas.addEventListener('pointerdown',e=>{if(!isActive()||e.button!==0||pointer!==null)return;e.preventDefault();pointer=e.pointerId;x=e.clientX;y=e.clientY;canvas.setPointerCapture(pointer);canvas.classList.add('orbit-dragging');});
 canvas.addEventListener('pointermove',e=>{if(pointer!==e.pointerId)return;if(!isActive()||!(e.buttons&1)){finish();return;}e.preventDefault();orbit.yaw=(orbit.yaw-(e.clientX-x)*.006)%(Math.PI*2);orbit.pitch=clamp(orbit.pitch+(e.clientY-y)*.006,-.45,1.35);x=e.clientX;y=e.clientY;});
 for(const event of['pointerup','pointercancel','lostpointercapture'])canvas.addEventListener(event,e=>{if(pointer===e.pointerId)finish();});
 canvas.addEventListener('dblclick',e=>{if(isActive()){e.preventDefault();reset();}});
 window.addEventListener('blur',finish);
 document.addEventListener('visibilitychange',()=>{if(document.hidden)finish();});
 return {reset,update(){const active=isActive();canvas.classList.toggle('orbit-ready',active);if(!active)finish();}};
}
