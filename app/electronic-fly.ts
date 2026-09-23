import { anatomy, cognition, leftWing, rightWing, type NeuralMesh } from './neural-specimen';

export type GestureName='scratch'|'rub'|'antennae'|'shudder'|'sip';
type FlyAppearance = { id:string; heading:number; behavior:string; color:string; vx?:number; vy?:number; gesture?:GestureName|null; gesturePhase?:number; arousal?:number; stepPhase?:number; stepAmp?:number };
const TAU=Math.PI*2;
const cycle=(n:number)=>n-Math.floor(n);
const clamp01=(n:number)=>n<0?0:n>1?1:n;
const ease=(p:number)=>Math.sin(Math.PI*clamp01(p));
const gold='218,181,123', cyan='130,211,224';
// Stable per-fly phase so each specimen jitters with its own rhythm, frame to frame.
function seedOf(id:string){let s=2166136261;for(let i=0;i<id.length;i++){s^=id.charCodeAt(i);s=Math.imul(s,16777619)>>>0;}return (s%6283)/1000;}

type RenderStyle={rgb?:string;opacity?:number;bank?:number;wing?:boolean};
function mesh(ctx:CanvasRenderingContext2D,model:NeuralMesh,time:number,style:RenderStyle={}){
  const {rgb=cyan,opacity=1,bank=0,wing=false}=style;
  const sin=Math.sin(bank),cos=Math.cos(bank);
  const projected=model.nodes.map(n=>({x:n.x*cos+n.z*sin,y:n.y+n.z*Math.sin(bank*.7)*.7,depth:(n.z+5)/10,pulse:Math.pow(Math.max(0,Math.sin(time*2.1-(n.y+18)*.16-n.delay)),10),size:n.size}));
  ctx.lineCap='round';
  for(let i=0;i<model.edges.length;i++){
    const edge=model.edges[i],a=projected[edge.a],b=projected[edge.b];
    const alpha=(wing?.10:.14)+edge.strength*.12+Math.min(a.pulse,b.pulse)*.20;
    ctx.strokeStyle=`rgba(${rgb},${alpha*opacity})`;ctx.lineWidth=wing?.23:.28;
    ctx.beginPath();ctx.moveTo(a.x,a.y);ctx.lineTo(b.x,b.y);ctx.stroke();
    if(i%37===0){const p=cycle(time*.46+i*.037);ctx.fillStyle=`rgba(${cyan},${Math.sin(p*Math.PI)*.85*opacity})`;ctx.beginPath();ctx.arc(a.x+(b.x-a.x)*p,a.y+(b.y-a.y)*p,.36,0,TAU);ctx.fill();}
  }
  for(const p of projected){
    if(p.pulse>.55){ctx.fillStyle=`rgba(${cyan},${p.pulse*.1*opacity})`;ctx.beginPath();ctx.arc(p.x,p.y,1.4,0,TAU);ctx.fill();}
    ctx.fillStyle=`rgba(${p.pulse>.55?cyan:rgb},${(.2+p.depth*.2+p.pulse*.48)*opacity})`;
    ctx.beginPath();ctx.arc(p.x,p.y,p.size+.04+p.pulse*.1,0,TAU);ctx.fill();
  }
}

function ellipse(ctx:CanvasRenderingContext2D,x:number,y:number,rx:number,ry:number,rotation=0){ctx.beginPath();ctx.ellipse(x,y,rx,ry,rotation,0,TAU);}
function body(ctx:CanvasRenderingContext2D,breath=1){
  // A broad mesothorax and a full, shorter abdomen give the dorsal fly its compact silhouette.
  // Narrow the torso slightly without changing its length or the head and wing proportions.
  ctx.save();ctx.scale(.9,1);
  // Abdomen pumps gently around the thorax junction — a slow breathing pulse, head/thorax unaffected.
  ctx.save();ctx.translate(0,5);ctx.scale(1,breath);ctx.translate(0,-5);
  const abdomen=ctx.createLinearGradient(-9,0,9,0);
  abdomen.addColorStop(0,'rgba(177,135,78,.25)');abdomen.addColorStop(.3,'rgba(190,164,111,.065)');abdomen.addColorStop(.56,'rgba(231,202,145,.10)');abdomen.addColorStop(1,'rgba(141,102,57,.26)');
  ctx.fillStyle=abdomen;ctx.strokeStyle='rgba(214,178,119,.45)';ctx.lineWidth=.38;
  ctx.beginPath();ctx.moveTo(-6.5,4);ctx.bezierCurveTo(-11,9,-10,20,-4,25);ctx.quadraticCurveTo(0,29,4,25);ctx.bezierCurveTo(10,20,11,9,6.5,4);ctx.closePath();ctx.fill();ctx.stroke();
  const segments=[{y:8,w:8},{y:11.8,w:8.8},{y:15.7,w:8.6},{y:19.5,w:7.4},{y:23,w:5.5}];
  for(const {y,w} of segments){
    ctx.strokeStyle='rgba(169,135,84,.35)';ctx.lineWidth=1.15;ctx.beginPath();ctx.moveTo(-w,y);ctx.quadraticCurveTo(0,y+2.5,w,y);ctx.stroke();
    ctx.strokeStyle='rgba(226,197,141,.23)';ctx.lineWidth=.22;ctx.beginPath();ctx.moveTo(-w,y-.65);ctx.quadraticCurveTo(0,y+1.9,w,y-.65);ctx.stroke();
  }
  ctx.restore();
  const thorax=ctx.createRadialGradient(-2,-5,.3,0,-2,12);
  thorax.addColorStop(0,'rgba(236,211,163,.17)');thorax.addColorStop(.5,'rgba(157,171,140,.075)');thorax.addColorStop(.8,'rgba(200,163,106,.15)');thorax.addColorStop(1,'rgba(223,187,123,.29)');
  ctx.fillStyle=thorax;ctx.strokeStyle='rgba(231,201,148,.49)';ctx.lineWidth=.42;
  ctx.beginPath();ctx.moveTo(-6.5,-12);ctx.bezierCurveTo(-11,-9,-12,2,-7,7);ctx.quadraticCurveTo(0,12,7,7);ctx.bezierCurveTo(12,2,11,-9,6.5,-12);ctx.quadraticCurveTo(0,-14, -6.5,-12);ctx.closePath();ctx.fill();ctx.stroke();
  // Rear scutellum joins thorax to abdomen; faint longitudinal sutures add volume.
  ctx.strokeStyle='rgba(218,190,137,.36)';ctx.lineWidth=.32;ctx.beginPath();ctx.moveTo(-6,6.4);ctx.quadraticCurveTo(0,13,6,6.4);ctx.stroke();
  for(const side of [-1,1]){ctx.strokeStyle='rgba(238,211,158,.20)';ctx.lineWidth=.25;ctx.beginPath();ctx.moveTo(side*3.3,-10);ctx.bezierCurveTo(side*5,-5,side*5,1,side*3.8,5);ctx.stroke();}
  // Sparse bristles sit on the cuticle instead of forming a circular fringe.
  for(let i=0;i<18;i++){const a=i/18*TAU,x=Math.cos(a)*9.4,y=-2+Math.sin(a)*10;ctx.strokeStyle=`rgba(${gold},${.20+(i%3)*.04})`;ctx.lineWidth=.19;ctx.beginPath();ctx.moveTo(x,y);ctx.quadraticCurveTo(x+Math.cos(a)*.9,y+Math.sin(a)*1.3,x+Math.cos(a+.2)*(1.1+i%3*.3),y+Math.sin(a+.2)*1.8);ctx.stroke();}
  // The head is a shallow transverse capsule; eye surfaces sit within its sides.
  ctx.restore();ctx.lineWidth=.19;
  const head=ctx.createLinearGradient(-8,-17,8,-17);head.addColorStop(0,'rgba(204,159,94,.27)');head.addColorStop(.5,'rgba(222,199,150,.17)');head.addColorStop(1,'rgba(184,132,71,.25)');
  ctx.fillStyle=head;ctx.strokeStyle='rgba(227,193,132,.47)';ellipse(ctx,0,-17.1,7.8,4.9);ctx.fill();ctx.stroke();
  ctx.strokeStyle='rgba(235,207,153,.36)';ctx.lineWidth=.28;ctx.beginPath();ctx.moveTo(-2,-20.3);ctx.quadraticCurveTo(-1.8,-24,0,-24.6);ctx.quadraticCurveTo(1.8,-24,2,-20.3);ctx.stroke();
}

function eye(ctx:CanvasRenderingContext2D,side:number,time:number){
  ctx.save();
  // Dorsal eye surfaces belong to the head capsule; trim the lens at its silhouette.
  ellipse(ctx,0,-17.1,7.8,4.9);ctx.clip();
  ctx.translate(side*5.5,-17.2);ctx.rotate(side*.12);
  // Smaller, flatter compound surfaces. Amber remains, without a detached glowing globe.
  const lens=ctx.createLinearGradient(-side*2.7,-1,side*2.7,1);
  lens.addColorStop(0,'rgba(181,109,48,.88)');lens.addColorStop(.4,'rgba(208,139,66,.90)');lens.addColorStop(.78,'rgba(141,79,35,.94)');lens.addColorStop(1,'rgba(84,53,31,.94)');
  ellipse(ctx,0,0,2.7,4.25);ctx.fillStyle=lens;ctx.fill();ctx.strokeStyle='rgba(225,166,87,.43)';ctx.lineWidth=.24;ctx.stroke();
  ctx.save();ctx.clip();
  for(let row=-7;row<=7;row++)for(let column=-5;column<=5;column++){
    const x=column*.65+(row%2)*.325,y=row*.58;
    if((x/2.7)**2+(y/4.25)**2>1)continue;
    const light=Math.max(0,1-Math.hypot(x+side*.9,y+1.5)/6),pulse=.96+Math.sin(time*.9+row*.3)*.02;
    ctx.strokeStyle=`rgba(245,188,105,${(.10+light*.28)*pulse})`;ctx.fillStyle=`rgba(230,145,58,${light*.10})`;ctx.lineWidth=.11;ctx.beginPath();
    for(let k=0;k<6;k++){const a=k/6*TAU,px=x+Math.cos(a)*.30,py=y+Math.sin(a)*.30;k?ctx.lineTo(px,py):ctx.moveTo(px,py);}ctx.closePath();ctx.fill();ctx.stroke();
  }
  // Lively specular glint that drifts across the lens with an occasional saccade-like jump.
  const gx=Math.sin(time*1.05+side*2.3)*.95+Math.sin(time*.31+side)*.5;
  const gy=Math.cos(time*1.37+side*1.7)*1.5;
  const glint=ctx.createRadialGradient(gx,gy,0,gx,gy,1.5);
  glint.addColorStop(0,'rgba(255,238,196,.50)');glint.addColorStop(.5,'rgba(255,225,160,.16)');glint.addColorStop(1,'rgba(255,225,160,0)');
  ctx.fillStyle=glint;ctx.beginPath();ctx.arc(gx,gy,1.5,0,TAU);ctx.fill();
  ctx.strokeStyle='rgba(255,211,137,.20)';ctx.lineWidth=.28;ctx.beginPath();ctx.ellipse(-side*.55,-.8,1.45,2.65,side*.12,Math.PI*1.08,Math.PI*1.8);ctx.stroke();ctx.restore();ctx.restore();
}

function wing(ctx:CanvasRenderingContext2D,model:NeuralMesh,time:number,bank:number){
  ctx.beginPath();ctx.moveTo(1,1);ctx.bezierCurveTo(14,-4,35,1,44,15);ctx.bezierCurveTo(48,23,37,26,25,20);ctx.bezierCurveTo(15,15,7,6,1,1);
  const membrane=ctx.createLinearGradient(0,0,48,19);membrane.addColorStop(0,'rgba(230,192,130,.095)');membrane.addColorStop(.6,'rgba(158,192,185,.025)');membrane.addColorStop(1,'rgba(244,205,138,.055)');
  ctx.fillStyle=membrane;ctx.fill();ctx.strokeStyle='rgba(239,196,124,.48)';ctx.lineWidth=.3;ctx.stroke();
  ctx.save();ctx.clip();
  // Long branching veins, with sparse cyan neural pulses visible between them.
  for(let i=0;i<5;i++){ctx.strokeStyle=`rgba(${gold},${.30-i*.018})`;ctx.lineWidth=i===0?.42:.25;ctx.beginPath();ctx.moveTo(1,1);ctx.bezierCurveTo(12,1+i*1.3,27,2+i*3.8,42-i*1.2,12+i*2.5);ctx.stroke();}
  mesh(ctx,model,time,{wing:true,rgb:gold,opacity:.78,bank});ctx.restore();
  ctx.fillStyle='rgba(241,208,144,.75)';ellipse(ctx,2,2,1.4,.8,.4);ctx.fill();
}

/** Animated reference-inspired specimen. Illustrative anatomy, not measured connectome data. */
export function renderElectronicFly(ctx:CanvasRenderingContext2D,fly:FlyAppearance,x:number,y:number,time:number,selected:boolean,magnification=1,motion=1,tint=cyan){
  const flying=fly.behavior==='flying',scale=(fly.id==='Holo'?1.25:.95)*magnification;
  const seed=seedOf(fly.id),arousal=clamp01(fly.arousal??.45);
  // Fast flight (e.g. escaping a touch) must stay a smooth glide: damp all body shake by speed.
  const speed=Math.hypot(fly.vx??0,fly.vy??0),calm=clamp01(1-speed*2.4);
  const shudder=(fly.gesture==='shudder'?ease(fly.gesturePhase??0):0)*calm;
  // Fruit flies fidget at rest, not mid-flight: micro-motion fades out as speed rises.
  const jit=(.3+arousal*.5)*motion*calm;
  const jx=(Math.sin(time*11.3+seed)*.5+Math.sin(time*19.7+seed*1.7)*.3)*jit+Math.sin(time*61+seed)*shudder*.3*motion;
  const jy=(Math.cos(time*10.1+seed*1.3)*.5+Math.sin(time*21.3+seed)*.25)*jit+Math.cos(time*57+seed)*shudder*.3*motion;
  const headWob=Math.sin(time*7.3+seed)*.022*motion*(.5+arousal)*calm+shudder*.012*motion*Math.sin(time*48);
  const lift=(flying?5+Math.sin(time*3.4)*1.3:0)+Math.sin(time*1.7+seed)*.25*motion*calm,bank=Math.sin(time*.67)*.16;
  // Slow abdominal pumping (~0.34 Hz) reads as breathing; subtle so it never looks like a spasm.
  const breath=1+Math.sin(time*2.1+seed)*.02*motion;
  ctx.save();ctx.translate(x+jx,y-lift+jy);ctx.rotate(fly.heading+Math.PI/2+headWob);ctx.scale(scale,scale);
  ctx.lineCap='round';ctx.lineJoin='round';
  // Soft contact shadow: deep and tight when settled, wider and fainter as flight lift rises.
  const liftNow=flying?5+Math.sin(time*3.4)*1.3:0,shR=20+liftNow*1.4;
  ctx.save();ctx.translate(1.5,7);ctx.scale(1,1.3);
  const sh=ctx.createRadialGradient(0,0,0,0,0,shR);sh.addColorStop(0,`rgba(0,0,0,${.16-liftNow*.014})`);sh.addColorStop(1,'rgba(0,0,0,0)');
  ctx.fillStyle=sh;ctx.beginPath();ctx.arc(0,0,shR,0,TAU);ctx.fill();ctx.restore();
  const gp=fly.gesture??null,gphase=fly.gesturePhase??0;
  const ge=(gp==='scratch'||gp==='rub'||gp==='antennae')?ease(gphase):0,gosc=Math.sin(gphase*Math.PI*7)*ge*1.5;
  const stepPhase=fly.stepPhase??0,stepAmp=clamp01(fly.stepAmp??0);
  for(const side of [-1,1]){
    for(let leg=0;leg<3;leg++){
      const root=-7+leg*6,flex=Math.sin(time*1.8+leg)*.55,reach=flying?.88:1;
      const points=[{x:side*7,y:root},{x:side*(11.5+leg)*reach,y:root+(leg===0?-3:3)},{x:side*(16+leg)*reach,y:root+(leg===0?-10:10)+flex},{x:side*(19+leg)*reach,y:root+(leg===0?-14:15)+flex}];
      let pts=points;
      if(stepAmp>.02){
        // Tripod gait: a front+hind pair on one side swings together with the middle leg on the other.
        const groupA=(side===-1&&(leg===0||leg===2))||(side===1&&leg===1);
        const ph=stepPhase+(groupA?0:.5),s=ph-Math.floor(ph);
        const swing=s<.4?s/.4:1,stance=s<.4?0:(s-.4)/.6;
        const step=s<.4?-1+2*swing:1-2*stance,lift2=s<.4?Math.sin(Math.PI*swing):0;
        const knee=points[1],kx=1-lift2*.12*stepAmp,dy=-step*2.2*stepAmp;
        pts=points.map((q,i)=>i<2?q:{x:knee.x+(q.x-knee.x)*kx,y:knee.y+(q.y-knee.y)*kx+dy*(i===3?1:.65)});
      }
      if(ge>.001){
        let tx:number|null=null,ty=0;
        if(gp==='scratch'&&side===1&&leg===0){tx=5.6;ty=-16+gosc;}
        else if(gp==='antennae'&&side===-1&&leg===0){tx=-3.2;ty=-22.5+gosc;}
        else if(gp==='rub'&&leg===0){tx=side*1.7;ty=-13.5+gosc;}
        if(tx!==null){const gx2=tx;pts=pts.map((q,i)=>i<2?{x:q.x,y:q.y}:{x:q.x+(gx2-q.x)*ge*(i===2?.85:1),y:q.y+(ty-q.y)*ge*(i===2?.85:1)});}
      }
      ctx.strokeStyle='rgba(205,162,94,.52)';ctx.lineWidth=.65;ctx.beginPath();pts.forEach((p,i)=>i?ctx.lineTo(p.x,p.y):ctx.moveTo(p.x,p.y));ctx.stroke();
      ctx.strokeStyle='rgba(248,218,163,.45)';ctx.lineWidth=.22;ctx.stroke();
      for(let segment=1;segment<pts.length;segment++){const a=pts[segment-1],b=pts[segment];for(let k=1;k<6;k++){const t=k/6,px=a.x+(b.x-a.x)*t,py=a.y+(b.y-a.y)*t;ctx.strokeStyle='rgba(232,193,127,.34)';ctx.lineWidth=.18;ctx.beginPath();ctx.moveTo(px,py);ctx.lineTo(px+side*(.7+(k%2)*.4),py+1.2);ctx.stroke();}}
      for(const p of pts){ctx.fillStyle='rgba(239,202,138,.62)';ellipse(ctx,p.x,p.y,.45,.65);ctx.fill();}
    }
  }
  for(const side of [-1,1]){
    ctx.save();ctx.translate(side*7,-2.5);ctx.scale(side,1);
    const beat=flying?Math.sin(time*30+side*.1)*.055:(Math.sin(time*.7)*.012+Math.sin(time*47+side)*.05*shudder*motion);
    ctx.rotate((flying?.12:.46)+beat+shudder*.07*motion);ctx.scale(1,flying?.94+Math.cos(time*30)*.025:1);
    wing(ctx,side===-1?leftWing:rightWing,time,side*bank+.08);ctx.restore();
  }
  body(ctx,breath);
  mesh(ctx,anatomy,time,{bank,opacity:.66,rgb:tint});
  // Cool neural light inside the transparent thorax balances the amber compound eyes.
  const brain=ctx.createRadialGradient(-.4,-4,0,0,-4,8);brain.addColorStop(0,`rgba(${tint},.23)`);brain.addColorStop(.4,`rgba(${tint},.06)`);brain.addColorStop(1,`rgba(${tint},0)`);ctx.fillStyle=brain;ctx.fillRect(-8,-12,16,16);
  ctx.save();ctx.translate(0,13);ctx.scale(.9,1);mesh(ctx,cognition,time,{bank,rgb:tint,opacity:1});ctx.restore();
  for(const side of [-1,1]){
    eye(ctx,side,time);
    // Antennae flick independently; the cleaned antenna wiggles harder during the grooming gesture.
    const flick=Math.pow(Math.max(0,Math.sin(time*.83+seed*1.3+side*1.9)),12)*motion;
    const clean=(gp==='antennae'&&side===-1)?ease(gphase)*1.6:0;
    const tw=(flick*1.4+clean)*side;
    ctx.strokeStyle='rgba(236,203,145,.62)';ctx.lineWidth=.36;ctx.beginPath();ctx.moveTo(side*1.8,-20.5);ctx.quadraticCurveTo(side*2.2+tw*.6,-23.5-Math.abs(tw)*.5,side*3.7+tw,-25.2-tw*1.1);ctx.stroke();
    for(let i=0;i<5;i++){ctx.strokeStyle='rgba(226,193,127,.32)';ctx.lineWidth=.17;ctx.beginPath();ctx.moveTo(side*(2.1+i*.32)+tw*.3,-22.5-i*.42);ctx.lineTo(side*(3.0+i*.38)+tw*.7,-24-i*.42-tw*.3);ctx.stroke();}
  }
  // The central frons overlaps the medial eye rims, keeping a single connected head.
  ctx.fillStyle='rgba(210,187,134,.16)';ctx.strokeStyle='rgba(236,207,153,.30)';ctx.lineWidth=.25;
  ctx.beginPath();ctx.moveTo(-3.1,-20.9);ctx.quadraticCurveTo(0,-22.3,3.1,-20.9);ctx.lineTo(2.5,-14);ctx.quadraticCurveTo(0,-12.4,-2.5,-14);ctx.closePath();ctx.fill();ctx.stroke();
  // Proboscis extends forward while sipping; a small labellum bulb reads as a feeding gesture.
  if(gp==='sip'){const e=ease(gphase),ext=e*4.4;
    ctx.strokeStyle='rgba(238,205,150,.6)';ctx.lineWidth=.5;ctx.beginPath();ctx.moveTo(0,-21.6);ctx.lineTo(0,-21.6-ext);ctx.stroke();
    ctx.fillStyle='rgba(244,216,164,.72)';ellipse(ctx,0,-21.9-ext,.5+e*.45,.62+e*.5);ctx.fill();}
  ctx.restore();
  ctx.textAlign='center';ctx.font='10px monospace';ctx.fillStyle=selected?'#b8bcab':'#71867f';ctx.fillText(fly.id,x,y+68*magnification);
}
