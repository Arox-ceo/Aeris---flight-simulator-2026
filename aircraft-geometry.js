// Procedural, stylized airliners. Shapes follow family proportions, not certified geometry.
const rgb=hex=>[1,3,5].map(i=>parseInt((hex||'#eeeeee').slice(i,i+2),16)/255);
const tint=(a,f)=>a.map(v=>Math.min(1,v*f));
export function buildAircraftMeshes(Mesh,gl,aircraft={},livery={}){
  const spec={length:39.47,wingspan:35.79,fuselageDiameter:3.76,engines:2,configuration:'twin underwing',shape:'standard',family:'737',winglets:true,...aircraft};
  const p=new Mesh(),prop=new Mesh(),gear=new Mesh(),scale=.28,L=spec.length*scale,B=spec.wingspan*scale,R=spec.fuselageDiameter*scale/2;
  const white=rgb(livery.primary||'#F4F7F6'),paint=rgb(livery.secondary||'#007A93'),accent=rgb(livery.accent||'#52BDC5'),tail=rgb(livery.tail||'#07516E');
  const glass=[.075,.14,.20],silver=[.67,.72,.73],rubber=[.055,.065,.07],upper=spec.shape==='double-deck'?1.30:spec.shape==='beluga'?1.65:1;
  const sections=[[-.50,.025,0],[-.49,.25,-.02],[-.47,.50,-.05],[-.445,.73,-.02],[-.42,.88,0],[-.38,.97,0],[-.34,1,0],[.19,1,0],[.27,.93,.03],[.33,.78,.08],[.40,.48,.13],[.45,.21,.18],[.50,.015,.22]];
  const point=(q,t)=>[Math.cos(t)*q[1]*R,(q[2]+Math.sin(t)*q[1]*(Math.sin(t)>0?upper:1))*R,q[0]*L];
  for(let i=0;i<sections.length-1;i++)for(let j=0;j<48;j++){
    const a=j*Math.PI/24,b=(j+1)*Math.PI/24;
    let color=j>=24?tint(white,.83):white;
    if(j===22||j===23||j===46||j===47)color=paint;
    if(livery.id==='airasia'&&i<6&&j>=24)color=paint;
    if(spec.shape==='beluga'&&i<2)color=paint;
    p.quad(point(sections[i],a),point(sections[i+1],a),point(sections[i+1],b),point(sections[i],b),color);
  }
  // Glazed flight deck and evenly spaced passenger windows.
  for(const side of[-1,1]){
    p.quad([side*R*.49,R*.43,-L*.455],[side*R*.89,R*.47,-L*.408],[side*R*.85,R*.78,-L*.385],[side*R*.40,R*.67,-L*.427],glass);
    if(!spec.freighter&&spec.shape!=='beluga'){
      const count=Math.min(54,Math.max(12,Math.round(spec.length/.95)));
      for(let i=0;i<count;i++){
        const z=-L*.32+i/(count-1)*L*.55,w=L/count*.32,h=R*.19,x=side*R*.985,y=R*.29;
        p.quad([x,y,z-w],[x,y+h,z-w],[x,y+h,z+w],[x,y,z+w],glass);
        if(spec.shape==='double-deck')p.quad([x*.86,y+R*.62,z-w],[x*.86,y+R*.62+h,z-w],[x*.86,y+R*.62+h,z+w],[x*.86,y+R*.62,z+w],glass);
      }
    }
  }
  // Jumbo upper-deck hump is deliberately prominent in silhouette.
  if(spec.shape==='hump'){
    const hs=[[-.43,.1,.5],[-.36,.66,.68],[-.23,.7,.7],[-.08,.15,.65]];
    for(let i=0;i<hs.length-1;i++)for(let j=0;j<10;j++){
      const q=(s,t)=>[Math.cos(t)*s[1]*R,(s[2]+Math.sin(t)*s[1])*R,s[0]*L];
      p.quad(q(hs[i],j*Math.PI/10),q(hs[i+1],j*Math.PI/10),q(hs[i+1],(j+1)*Math.PI/10),q(hs[i],(j+1)*Math.PI/10),white);
    }
    for(const side of[-1,1])for(let i=0;i<9;i++){const z=-L*.33+i*L*.019;p.box(side*R*.59,R*.95,z,.03,R*.14,L*.008,glass);}
  }
  function wing(points,color,thickness=.07){const lower=points.map(v=>[v[0],v[1]-thickness,v[2]]);p.quad(...points,color);p.quad(lower[3],lower[2],lower[1],lower[0],tint(color,.78));for(let i=0;i<4;i++)p.quad(points[i],lower[i],lower[(i+1)%4],points[(i+1)%4],tint(color,.9));}
  const wy=-R*.5;
  for(const side of[-1,1]){
    wing([[side*R*.65,wy,-L*.13],[side*B*.5,R*.17,L*.075],[side*B*.5,R*.17,L*.13],[side*R*.7,wy,L*.20]],tint(white,.94),R*.15);
    // Flap panel, aileron and navigation light create readable detail from behind.
    p.quad([side*B*.15,wy+.015,L*.15],[side*B*.41,R*.03,L*.123],[side*B*.41,R*.03,L*.142],[side*B*.15,wy+.015,L*.185],silver);
    p.box(side*B*.495,R*.18,L*.10,.09,.06,.12,side<0?[.95,.16,.12]:[.14,.84,.44]);
    if(spec.winglets||spec.foldingWingtips){const tip=side*B*.5;p.quad([tip,R*.17,L*.075],[tip+side*R*.14,R*1.14,L*.105],[tip+side*R*.14,R*1.14,L*.155],[tip,R*.17,L*.13],paint);}
    const tailY=spec.shape==='t-tail'?R*3.6:R*.45;
    wing([[side*R*.12,tailY,L*.31],[side*B*.20,tailY+R*.15,L*.415],[side*B*.20,tailY+R*.15,L*.46],[side*R*.12,tailY,L*.43]],white,R*.10);
  }
  const finTop=R*(spec.shape==='double-deck'?4.2:3.8),finFront=L*.26,finEnd=L*.46;
  for(const side of[-1,1]){
    const x=side*.035;p.quad([x,R*.5,finFront],[x,finTop,L*.405],[x,finTop,L*.465],[x,R*.5,finEnd],tail);
    const inset=side*.043;
    p.quad([inset,R*1.45,L*.315],[inset,finTop*.88,L*.397],[inset,finTop*.88,L*.435],[inset,R*1.45,L*.387],accent);
    if(livery.pattern==='feathers'||livery.pattern==='bands')for(let k=0;k<3;k++){const y=R*(1.1+k*.65);p.quad([side*.05,y,L*(.32+k*.018)],[side*.05,y+R*.18,L*(.327+k*.018)],[side*.05,y+R*.18,L*.457],[side*.05,y,L*.453],k%2?paint:accent);}
    if(livery.pattern==='batik')for(let k=0;k<4;k++){const z=L*(.36+k*.02),y=R*(1.7+k*.3);p.quad([side*.052,y-R*.2,z],[side*.052,y,z-L*.012],[side*.052,y+R*.2,z],[side*.052,y,z+L*.012],accent);}
  }
  function engine(x,y,z,r,len){
    for(let j=0;j<48;j++){const a=j*Math.PI/24,b=(j+1)*Math.PI/24,pt=(t,zz,rr=r)=>[x+Math.cos(t)*rr,y+Math.sin(t)*rr,zz];
      p.quad(pt(a,z-len/2),pt(a,z+len/2),pt(b,z+len/2),pt(b,z-len/2),j<24?white:paint);
      p.quad(pt(a,z-len/2),pt(b,z-len/2),pt(b,z-len/2+.035,r*.78),pt(a,z-len/2+.035,r*.78),silver);
      p.tri([x,y,z-len/2+.08],pt(a,z-len/2+.08,r*.78),pt(b,z-len/2+.08,r*.78),j%2?glass:rubber);
      p.tri([x,y,z+len/2+.02],pt(b,z+len/2,r*.78),pt(a,z+len/2,r*.78),rubber);
    }
    for(let j=0;j<18;j++){const a=j*Math.PI/9,b=a+.12;const q=(t,rr,zz)=>[x+Math.cos(t)*rr,y+Math.sin(t)*rr,zz];p.quad(q(a,r*.15,z-len/2+.06),q(a+.3,r*.70,z-len/2+.07),q(b+.3,r*.70,z-len/2+.07),q(b,r*.15,z-len/2+.06),silver);p.tri([x,y,z-len/2-.01],q(a,r*.17,z-len/2+.06),q(a+Math.PI/9,r*.17,z-len/2+.06),silver);}
  }
  const engR=R*(spec.family==='777'||spec.family==='777X'?.58:.47),engLen=L*.11;
  if(spec.configuration.includes('rear')){
    for(const side of[-1,1])engine(side*R*1.45,R*.25,L*.29,R*.38,L*.12);
    if(spec.engines===3)engine(0,R*1.7,L*.34,R*.38,L*.13);
  }else{
    const positions=spec.engines===4?[.20,.35]:[.23];
    for(const side of[-1,1])for(const amount of positions){const x=side*B*amount,z=-L*.055+(amount-.2)*L*.7;p.box(x,-R*.75,z,engR*.35,R*.6,engLen*.65,silver);engine(x,-R*1.17,z,engR,engLen);}
  }

  // Door outlines, wing fairings and rooftop antennas scale with each airframe.
  for(const side of[-1,1]){
    for(const z of[-L*.29,L*.17]){const x=side*R*1.002,w=L*.014,y=R*.02,h=R*.70;for(const zz of[z-w,z+w])p.box(x,y,zz,.012,h,.014,silver);p.box(x,y+h,z,.012,.014,w*2,silver);p.box(x,y,z,.012,.014,w*2,silver);p.box(x+side*.008,y+h*.42,z+w*.5,.02,.02,w*.35,paint);}
    for(const k of[.16,.25,.34])p.box(side*B*k,wy-R*.14,L*(.20-k*.15),R*.13,R*.15,L*.055,silver);
    p.box(side*R*.85,-R*.3,-L*.16,.12,.08,.10,[1,.96,.74]);
  }
  p.quad([0,R,-L*.05],[0,R*1.35,-L*.03],[0,R*1.3,-L*.005],[0,R,-L*.005],white);
  p.box(0,R*upper+.015,L*.04,.08,.06,.09,[.95,.18,.12]);
  const gearY=-Math.min(2.25,R*1.9),wheelR=Math.max(.12,R*.27);
  function wheel(x,y,z,r){const w=r*.7;for(let i=0;i<20;i++){const a=i*Math.PI/10,b=(i+1)*Math.PI/10,q=(xx,t,rr=r)=>[xx,y+Math.sin(t)*rr,z+Math.cos(t)*rr];gear.quad(q(x-w/2,a),q(x+w/2,a),q(x+w/2,b),q(x-w/2,b),rubber);for(const side of[-1,1]){const xx=x+side*w/2;gear.tri([xx,y,z],q(xx,a),q(xx,b),rubber);gear.tri([xx+side*.002,y,z],q(xx+side*.002,a,r*.45),q(xx+side*.002,b,r*.45),silver);}}}
  for(const side of[-1,1]){const x=side*R*1.05;gear.box(x,gearY,L*.085,.07,-gearY-R*.35,.09,silver);for(const dx of[-wheelR*.5,wheelR*.5]){wheel(x+dx,gearY,L*.085,wheelR);if(spec.class==='widebody'||spec.class==='superheavy')wheel(x+dx,gearY,L*.085+wheelR*2.1,wheelR);}}
  gear.box(0,gearY,-L*.34,.06,-gearY-R*.4,.07,silver);for(const side of[-1,1])wheel(side*wheelR*.35,gearY,-L*.34,wheelR*.7);
  return {plane:p.upload(gl),prop:prop.upload(gl),gear:gear.upload(gl)};
}
