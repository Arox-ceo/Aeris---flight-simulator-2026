import {getAirport,airports,airportPosition,runwayToWorld,worldToRunway} from './geography.js';
import {orbitPosition} from './chase-camera.js';
import {buildAircraftMeshes} from './aircraft-geometry.js';
import {terrainHeight,basis,route,clamp} from './flight.js';
const identity=()=>new Float32Array([1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1]);
const sub=(a,b)=>a.map((v,i)=>v-b[i]);
const cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
const norm=a=>{const l=Math.hypot(...a)||1;return a.map(v=>v/l)};
const dot=(a,b)=>a.reduce((s,v,i)=>s+v*b[i],0);
const mix=(a,b,t)=>a.map((v,i)=>v+(b[i]-v)*t);
function mult(a,b){const o=new Float32Array(16);for(let c=0;c<4;c++)for(let r=0;r<4;r++)for(let k=0;k<4;k++)o[c*4+r]+=a[k*4+r]*b[c*4+k];return o;}
function perspective(aspect){const n=3,f=50000,t=1/Math.tan(60*Math.PI/360);return new Float32Array([t/aspect,0,0,0,0,t,0,0,0,0,(f+n)/(n-f),-1,0,0,2*f*n/(n-f),0]);}
function view(eye,target,up){const z=norm(sub(eye,target)),x=norm(cross(up,z)),y=cross(z,x);return new Float32Array([x[0],y[0],z[0],0,x[1],y[1],z[1],0,x[2],y[2],z[2],0,-dot(x,eye),-dot(y,eye),-dot(z,eye),1]);}
function matAt(pos,b,scale=1){return new Float32Array([b.r[0]*scale,b.r[1]*scale,b.r[2]*scale,0,b.u[0]*scale,b.u[1]*scale,b.u[2]*scale,0,-b.f[0]*scale,-b.f[1]*scale,-b.f[2]*scale,0,...pos,1]);}
class Mesh {
  constructor(){this.data=[];}
  tri(a,b,c,color){const n=norm(cross(sub(b,a),sub(c,a)));for(const p of[a,b,c])this.data.push(...p,...n,...color);}
  quad(a,b,c,d,color){this.tri(a,b,c,color);this.tri(a,c,d,color);}
  box(x,y,z,w,h,d,col){let a=[x-w/2,y,z-d/2],b=[x+w/2,y,z-d/2],c=[x+w/2,y,z+d/2],e=[x-w/2,y,z+d/2],A=[a[0],y+h,a[2]],B=[b[0],y+h,b[2]],C=[c[0],y+h,c[2]],E=[e[0],y+h,e[2]];this.quad(A,E,C,B,col);this.quad(e,a,b,c,col);this.quad(a,A,B,b,col);this.quad(b,B,C,c,col);this.quad(c,C,E,e,col);this.quad(e,E,A,a,col);}
  cylinder(x,y,z,r,h,col,n=8){for(let i=0;i<n;i++){let a=i/n*Math.PI*2,b=(i+1)/n*Math.PI*2;let p=[x+Math.sin(a)*r,y,z+Math.cos(a)*r],q=[x+Math.sin(b)*r,y,z+Math.cos(b)*r],P=[p[0],y+h,p[2]],Q=[q[0],y+h,q[2]];this.quad(p,P,Q,q,col);this.tri([x,y+h,z],Q,P,col);}}
  cone(x,y,z,r,h,col,n=7){for(let i=0;i<n;i++){const a=i/n*Math.PI*2,b=(i+1)/n*Math.PI*2;this.tri([x+Math.sin(a)*r,y,z+Math.cos(a)*r],[x,y+h,z],[x+Math.sin(b)*r,y,z+Math.cos(b)*r],col);}}
  upload(gl){this.count=this.data.length/9;this.buffer=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,this.buffer);gl.bufferData(gl.ARRAY_BUFFER,new Float32Array(this.data),gl.STATIC_DRAW);this.data=null;return this;}
}
export class Scene {
  constructor(canvas){
    this.canvas=canvas;const gl=canvas.getContext('webgl',{antialias:true,alpha:false,powerPreference:'high-performance'});if(!gl)throw Error('WebGL unavailable');this.gl=gl;
    this.program=this.programFrom(`attribute vec3 aPosition,aNormal,aColor;uniform mat4 uVP,uModel;varying vec3 vColor,vNormal,vWorld;void main(){vec4 p=uModel*vec4(aPosition,1.);vWorld=p.xyz;vNormal=mat3(uModel)*aNormal;vColor=aColor;gl_Position=uVP*p;}`,`precision highp float;varying vec3 vColor,vNormal,vWorld;uniform vec3 uCamera,uFog,uSun;uniform float uTime,uWater,uMood;void main(){float light=.62+.38*max(dot(normalize(vNormal),normalize(uSun)),0.);vec3 color=vColor*light;float d=distance(vWorld,uCamera);if(uWater>.5){float wave=sin(vWorld.x*.015+uTime*.65)*sin(vWorld.z*.011+uTime*.37);float ripples=pow(max(0.,sin(vWorld.x*.055+vWorld.z*.04+uTime)),16.);color=mix(vec3(.055,.30,.37),vec3(.13,.47,.49),.5+wave*.07);color+=ripples*.025;vec3 look=normalize(uCamera-vWorld);float sparkle=pow(max(0.,dot(reflect(-normalize(uSun),normalize(vec3(wave*.07,1.,wave*.08))),look)),60.);color+=sparkle*vec3(.55,.5,.35);if(uMood>.5&&uMood<1.5)color=mix(color,vec3(.30,.36,.38),.25);if(uMood>1.5)color*=.8;}else if(uMood>.5&&uMood<1.5){color*=vec3(1.1,.94,.80);}float fog=1.-exp(-d*(uMood>1.5?.000145:.000066));color=mix(color,uFog,clamp(fog,0.,.96));gl_FragColor=vec4(color,1.);}`);
    this.skyProgram=this.programFrom(`attribute vec2 aPosition;varying vec2 vUV;void main(){vUV=aPosition;gl_Position=vec4(aPosition,.9999,1.);}`,`precision mediump float;varying vec2 vUV;uniform vec3 uForward,uRight,uUp,uSun;uniform float uAspect,uMood;float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}float noise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(hash(i),hash(i+vec2(1.,0.)),f.x),mix(hash(i+vec2(0.,1.)),hash(i+vec2(1.,1.)),f.x),f.y);}void main(){vec3 ray=normalize(uForward+uRight*vUV.x*.57735*uAspect+uUp*vUV.y*.57735);float t=pow(clamp(ray.y,0.,1.),.45);vec3 low=vec3(.73,.83,.84),high=vec3(.24,.52,.68);if(uMood>.5&&uMood<1.5){low=vec3(.90,.71,.55);high=vec3(.32,.49,.61);}if(uMood>1.5){low=vec3(.64,.71,.73);high=vec3(.37,.49,.56);}vec3 col=mix(low,high,t);float sun=dot(ray,normalize(uSun));col+=vec3(1.,.8,.5)*pow(max(sun,0.),250.)*.35;col=mix(col,vec3(1.,.96,.80),smoothstep(.9994,.9997,sun));if(ray.y>.02){vec2 uv=ray.xz/(ray.y+.12)*2.3;float n=noise(uv)+noise(uv*2.)*.42+noise(uv*4.)*.17;float clouds=smoothstep(uMood>1.5?.55:.91,1.3,n)*smoothstep(.01,.2,ray.y)*(1.-smoothstep(.7,1.,ray.y));col=mix(col,vec3(.95,.95,.90),clouds*(uMood>1.5?.72:.60));}gl_FragColor=vec4(col,1.);}`);
    this.locations={};for(const n of['aPosition','aNormal','aColor'])this.locations[n]=gl.getAttribLocation(this.program,n);for(const n of['uVP','uModel','uCamera','uFog','uSun','uTime','uWater','uMood'])this.locations[n]=gl.getUniformLocation(this.program,n);
    this.skyBuffer=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,this.skyBuffer);gl.bufferData(gl.ARRAY_BUFFER,new Float32Array([-1,-1,1,-1,-1,1,-1,1,1,-1,1,1]),gl.STATIC_DRAW);
    this.makeWorld();this.makePlane();this.makeRings();this.eye=[0,0,0];this.target=[0,0,-1];this.firstCamera=true;this.resize();
    addEventListener('resize',()=>this.resize());
  }
  programFrom(v,f){const gl=this.gl;const compile=(type,src)=>{const s=gl.createShader(type);gl.shaderSource(s,src);gl.compileShader(s);if(!gl.getShaderParameter(s,gl.COMPILE_STATUS))throw Error(gl.getShaderInfoLog(s));return s;};const p=gl.createProgram();gl.attachShader(p,compile(gl.VERTEX_SHADER,v));gl.attachShader(p,compile(gl.FRAGMENT_SHADER,f));gl.linkProgram(p);if(!gl.getProgramParameter(p,gl.LINK_STATUS))throw Error(gl.getProgramInfoLog(p));return p;}
  resize(){const dpr=Math.min(devicePixelRatio||1,1.6);this.canvas.width=Math.round(innerWidth*dpr);this.canvas.height=Math.round(innerHeight*dpr);this.gl.viewport(0,0,this.canvas.width,this.canvas.height);}
  makeWorld(centerX=0,centerZ=0){
    const gl=this.gl,land=new Mesh(),objects=new Mesh(),cx=Math.round(centerX/16000)*16000,cz=Math.round(centerZ/16000)*16000;
    this.worldCenter=[cx,cz];this.worldAirport=getAirport().id;
    for(const key of['terrain','water','objects'])if(this[key]?.buffer)gl.deleteBuffer(this[key].buffer);
    const color=(x,y,z)=>{const n=.025*Math.sin(x*.0017+z*.0013);return y<35?[.49+n,.59+n,.35+n]:y<600?[.26+n,.44+n,.29+n]:y<1800?[.27+n,.39+n,.29+n]:y<3000?[.43+n,.47+n,.41+n]:[.65+n,.68+n,.63+n];};
    const samples=new Map(),point=(x,z)=>{const k=x+','+z;if(!samples.has(k))samples.set(k,[x,terrainHeight(x,z),z]);return samples.get(k);};
    const grid=(radius,step,skip)=>{for(let x=cx-radius;x<cx+radius;x+=step)for(let z=cz-radius;z<cz+radius;z+=step){if(skip&&Math.abs(x+step/2-cx)<skip&&Math.abs(z+step/2-cz)<skip)continue;const a=point(x,z),b=point(x+step,z),c=point(x+step,z+step),d=point(x,z+step);if(Math.max(a[1],b[1],c[1],d[1])<0)continue;land.tri(a,d,b,color(x,(a[1]+d[1]+b[1])/3,z));land.tri(b,d,c,color(x+step/2,(b[1]+d[1]+c[1])/3,z+step/2));}};
    grid(19200,400,0);grid(64000,1600,19200);this.terrain=land.upload(gl);
    const water=new Mesh();water.quad([cx-120000,-.5,cz-120000],[cx-120000,-.5,cz+120000],[cx+120000,-.5,cz+120000],[cx+120000,-.5,cz-120000],[.1,.4,.5]);this.water=water.upload(gl);
    const white=[.92,.93,.85],pavement=[.21,.25,.27];
    for(const airport of airports){const[ax,az]=airportPosition(airport);if(Math.hypot(ax-cx,az-cz)>61000)continue;const ap=new Mesh(),h=airport.elevation,L=airport.length,W=Math.max(airport.width,48),half=L/2;
      ap.box(0,h-.2,0,W+40,.6,L+110,[.49,.53,.39]);ap.box(0,h+.4,0,W,.35,L,pavement);ap.box(-W-80,h+.3,0,95,.35,L*.62,[.35,.40,.39]);
      for(const z of[-L*.3,L*.3])ap.box(-W/2-50,h+.4,z,105,.3,30,[.33,.38,.38]);
      for(let z=-half+80;z<half-80;z+=110){ap.box(0,h+.91,z,2,.02,43,white);for(const x of[-W/2+2,W/2-2])ap.box(x,h+.91,z,1,.02,100,white);}
      for(const z of[-half+65,half-65])for(let x=-W/2+6;x<W/2-4;x+=6)if(Math.abs(x)>3)ap.box(x,h+.95,z,2.5,.02,45,white);
      const glyphs=['111101101101111','010110010010111','111001111100111','111001111001111','101101111001001','111100111001111','111100111101111','111001001001001','111101111101111','111101111001111'];
      const digits=String(Math.round(airport.heading/10)||36).padStart(2,'0');for(let n=0;n<2;n++)for(let i=0;i<15;i++)if(glyphs[+digits[n]][i]==='1')ap.box(-11+n*13+(i%3)*3.4,h+.97,half-170+Math.floor(i/3)*5,3,.02,4.4,white);
      for(let z=-half;z<=half;z+=100)for(const x of[-W/2-5,W/2+5])ap.cylinder(x,h+.8,z,.6,1.5,[.96,.76,.35],5);
      for(let z=-L*.25;z<L*.25;z+=220){ap.box(-W-125,h,z,75,22,105,[.70,.73,.66]);ap.box(-W-125,h+22,z,79,3,109,[.39,.47,.47]);ap.box(-W-87,h+1,z,1,17,68,[.23,.34,.37]);}
      ap.box(-W-155,h,L*.31,140,14,60,[.80,.79,.69]);ap.box(-W-155,h+14,L*.31,145,3,65,[.36,.46,.48]);ap.box(-W-80,h,L*.35,15,47,15,[.67,.71,.65]);ap.box(-W-80,h+47,L*.35,25,8,25,[.20,.36,.41]);ap.box(-W-80,h+55,L*.35,28,2,28,[.66,.71,.67]);
      ap.cylinder(W/2+65,h,L*.3,.4,17,[.86,.88,.80]);ap.box(W/2+72,h+15,L*.3,14,2.2,2.2,[.93,.37,.12]);
      // Terminal, gates, service vehicles and boarding activity at every airport.
      ap.box(-250,h+.4,300,280,.4,760,[.39,.43,.43]);
      ap.box(-390,h,300,70,23,560,[.72,.76,.73]);ap.box(-390,h+23,300,77,3,570,[.26,.40,.44]);
      for(let gate=-2;gate<=2;gate++){const gz=300+gate*100;ap.box(-325,h+9,gz,65,6,10,[.65,.73,.74]);ap.box(-285,h+7,gz,15,9,15,[.26,.43,.49]);for(let n=0;n<7;n++){ap.box(-354,h+9,gz-38+n*11,1,7,7,[.18,.42,.51]);}ap.box(-230,h+1,gz,2,.05,55,[.94,.78,.3]);}
      for(let i=0;i<4;i++){const z=230+i*35;ap.box(-285,h+1,z,9,4,4,[.9,.75,.18]);ap.box(-285,h+1,z+8,12,3,5,[.74,.78,.77]);}
      for(let i=0;i<18;i++){const x=-305+(i%3)*4,z=250+Math.floor(i/3)*6;ap.cylinder(x,h,z,.65,2.1,i<6?[.95,.51,.08]:[.21,.35,.55],6);ap.cylinder(x,h+2.1,z,.55,.8,[.73,.54,.39],6);}
      if(airport.id==='CGK'){for(let t=0;t<3;t++){ap.box(-650-t*160,h,300+t*380,110,28,260,[.72,.65,.49]);ap.box(-650-t*160,h+28,300+t*380,120,5,270,[.56,.31,.18]);}}
      const angle=airport.heading*Math.PI/180,co=Math.cos(angle),si=Math.sin(angle);for(let i=0;i<ap.data.length;i+=9){const x=ap.data[i],z=ap.data[i+2],nx=ap.data[i+3],nz=ap.data[i+5];ap.data[i]=ax+co*x-si*z;ap.data[i+2]=az+si*x+co*z;ap.data[i+3]=co*nx-si*nz;ap.data[i+5]=si*nx+co*nz;}objects.data.push(...ap.data);
    }
    let seed=(Math.round(cx+cz)+4391)>>>0;const rand=()=>{seed=(seed*1664525+1013904223)>>>0;return seed/4294967296;};
    for(let i=0;i<550;i++){const x=cx+(rand()-.5)*32000,z=cz+(rand()-.5)*32000,h=terrainHeight(x,z);if(h<20||h>2400)continue;let nearAirport=false;for(const a of airports){const[p,q]=worldToRunway(x,z,a);if(Math.abs(p)<600&&Math.abs(q)<a.length/2+500){nearAirport=true;break;}}if(nearAirport)continue;const height=12+rand()*18;objects.cylinder(x,h,z,1,height*.45,[.32,.29,.21],4);objects.cone(x,h+height*.2,z,height*.27,height*.85,[.19,.33+rand()*.06,.23],6);}
    const airport=getAirport(),[ax,az]=airportPosition(airport);if(Math.hypot(ax-cx,az-cz)<20000)for(let i=0;i<100;i++){const[x,z]=runwayToWorld(650+rand()*1900,(rand()-.5)*5000,airport),h=terrainHeight(x,z);if(h<4||h>airport.elevation+220)continue;const w=14+rand()*22,d=18+rand()*25,ht=10+rand()*28;objects.box(x,h,z,w,ht,d,[.77+rand()*.1,.77,.66]);objects.box(x,h+ht,z,w+2,2,d+2,[.57,.35+rand()*.1,.25]);}
    this.objects=objects.upload(gl);
  }
  makePlane(aircraft,livery){
    if(this.plane?.buffer)this.gl.deleteBuffer(this.plane.buffer);
    if(this.gear?.buffer)this.gl.deleteBuffer(this.gear.buffer);
    if(this.prop?.buffer)this.gl.deleteBuffer(this.prop.buffer);
    const meshes=buildAircraftMeshes(Mesh,this.gl,aircraft,livery);
    this.plane=meshes.plane;this.prop=meshes.prop;this.gear=meshes.gear;
    this.aircraftModel=aircraft;this.aircraftLivery=livery;this.firstCamera=true;
  }
  makeRings(){const r=new Mesh();const n=80,rad=150,tube=2.3;for(let i=0;i<n;i++)for(let j=0;j<6;j++){const point=(a,b)=>[(rad+Math.cos(b)*tube)*Math.cos(a),(rad+Math.cos(b)*tube)*Math.sin(a),Math.sin(b)*tube];let a=i/n*Math.PI*2,b=(i+1)/n*Math.PI*2,c=j/6*Math.PI*2,d=(j+1)/6*Math.PI*2;r.quad(point(a,c),point(b,c),point(b,d),point(a,d),[1,.69,.28]);}this.ring=r.upload(this.gl);}
  drawMesh(mesh,model=identity(),water=false){const g=this.gl,l=this.locations;g.bindBuffer(g.ARRAY_BUFFER,mesh.buffer);for(const [n,offset]of[['aPosition',0],['aNormal',12],['aColor',24]]){g.enableVertexAttribArray(l[n]);g.vertexAttribPointer(l[n],3,g.FLOAT,false,36,offset);}g.uniformMatrix4fv(l.uModel,false,model);g.uniform1f(l.uWater,water?1:0);g.drawArrays(g.TRIANGLES,0,mesh.count);}
  render(state,weather,camera,lobby,time,dt){
    const g=this.gl,b=basis(state);let target,eye,up;
    const pos=[state.x,state.y,state.z];
    if(lobby){const size=Math.max(16,(this.aircraftModel?.wingspan||36)*.28*1.8);eye=pos.map((v,i)=>v-b.f[i]*size*.85+b.r[i]*size*.9+b.u[i]*size*.38);target=pos.map((v,i)=>v+b.r[i]*size*.48);up=[0,1,0];}
    else if(camera==='cockpit'){eye=pos.map((v,i)=>v+b.u[i]*1.5+b.f[i]*1.4);target=eye.map((v,i)=>v+b.f[i]*100);up=b.u;}
    else{eye=orbitPosition(state,this.chaseOrbit||{yaw:0,pitch:.30},Math.max(31,(this.aircraftModel?.wingspan||36)*.28*1.35));eye[1]=Math.max(eye[1],terrainHeight(eye[0],eye[2])+3,2);target=pos;up=[0,1,0];}
    if(this.firstCamera||camera==='cockpit'){this.eye=eye;this.target=target;this.firstCamera=false;}else{const t=1-Math.exp(-dt*6);this.eye=mix(this.eye,eye,t);this.target=mix(this.target,target,t);}
    const f=norm(sub(this.target,this.eye)),right=norm(cross(f,up)),u=cross(right,f),mood=weather==='golden'?1:weather==='cloudy'?2:0;
    const sun=weather==='golden'?[-.85,.2,-.7]:[-.65,.65,-.7];const fog=weather==='golden'?[.90,.71,.55]:weather==='cloudy'?[.64,.71,.73]:[.73,.83,.84];
    g.clear(g.COLOR_BUFFER_BIT|g.DEPTH_BUFFER_BIT);g.disable(g.DEPTH_TEST);g.useProgram(this.skyProgram);g.bindBuffer(g.ARRAY_BUFFER,this.skyBuffer);const loc=g.getAttribLocation(this.skyProgram,'aPosition');g.enableVertexAttribArray(loc);g.vertexAttribPointer(loc,2,g.FLOAT,false,0,0);
    for(const[n,v]of[['uForward',f],['uRight',right],['uUp',u],['uSun',sun]])g.uniform3fv(g.getUniformLocation(this.skyProgram,n),v);g.uniform1f(g.getUniformLocation(this.skyProgram,'uAspect'),this.canvas.width/this.canvas.height);g.uniform1f(g.getUniformLocation(this.skyProgram,'uMood'),mood);g.drawArrays(g.TRIANGLES,0,6);
    g.enable(g.DEPTH_TEST);g.useProgram(this.program);const l=this.locations;g.uniformMatrix4fv(l.uVP,false,mult(perspective(this.canvas.width/this.canvas.height),view(this.eye,this.target,up)));g.uniform3fv(l.uCamera,this.eye);g.uniform3fv(l.uFog,fog);g.uniform3fv(l.uSun,sun);g.uniform1f(l.uTime,time);g.uniform1f(l.uMood,mood);
    this.drawMesh(this.water,identity(),true);this.drawMesh(this.terrain);this.drawMesh(this.objects);
    if(!lobby&&state.mode==='free')for(let i=state.ring;i<Math.min(state.ring+2,route.length);i++){const p=route[i],prev=i?route[i-1]:[0,480,1400],dir=norm(sub(p,prev)),rr=norm(cross(dir,[0,1,0])),uu=cross(rr,dir);this.drawMesh(this.ring,matAt(p,{r:rr,u:uu,f:dir}));}
    if(camera!=='cockpit'||lobby){const m=matAt(pos,b);this.drawMesh(this.plane,m);if(state.systems?.gear!==false)this.drawMesh(this.gear,m);const pr=identity(),a=time*(25+state.throttle*90);pr[0]=Math.cos(a);pr[1]=Math.sin(a);pr[4]=-Math.sin(a);pr[5]=Math.cos(a);this.drawMesh(this.prop,mult(m,pr));}
  }
}
