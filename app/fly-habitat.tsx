"use client";

import { useEffect, useRef, useState } from "react";
import { ArrowUpRight, Pause, Play, Send, Moon, RotateCcw, Maximize, X, Info } from "lucide-react";
import { renderElectronicFly, type GestureName } from "./electronic-fly";
import { habitatBounds, constrainToHabitat, type ViewRect } from "./habitat-bounds";
import { BRAIN_ONLINE } from "./demo-workflow";

type Behavior = 'flying' | 'resting';
type Gait = 'cruise' | 'hold' | 'dart';
type Fly = { id:string; parent:string; generation:number; color:string; x:number;y:number;vx:number;vy:number;heading:number;energy:number;behavior:Behavior;restUntil:number;trail:{x:number;y:number}[];gesture:GestureName|null;gestureT:number;gestureDur:number;gesturePhase:number;nextGesture:number;arousal:number;gait:Gait;gaitT:number;gaitDur:number;tx:number;ty:number;retarget:number;cascade:GestureName[]|null;nextCascade:number;stepPhase:number;stepAmp:number };
type Snapshot = Pick<Fly,'id'|'parent'|'generation'|'energy'|'behavior'|'gesture'|'gait'|'arousal'> & {groom:number};
export type HabitatIntent = { action:'wake'|'rest'|'explore'; targetId:string; source:'local-preview'; sequence:number; reference:string };
export type NeuralState = { energy:number; curiosity:number; name:string };
type Message = { who:'You'|'Holo'; text:string };
const palette=['177,213,211','191,205,222','180,202,214','199,208,217'];
const NEURAL_TINT:Record<string,string>={Listening:'177,213,211',Remembering:'196,174,226',Seeking:'230,170,112'};
const GESTURES:{name:GestureName;dur:number}[]=[{name:'scratch',dur:1.6},{name:'rub',dur:1.9},{name:'antennae',dur:1.4},{name:'shudder',dur:.7},{name:'sip',dur:2.1}];
const GESTURE_LABEL:Record<GestureName,string>={scratch:'head scratch',rub:'leg rub',antennae:'antennae clean',shudder:'wing shudder',sip:'sip'};
// Real grooming runs as an ordered cascade (head → antennae → legs → sip), not isolated twitches.
const GROOM_CASCADE:GestureName[]=['scratch','antennae','rub','sip'];
// Low energy + high curiosity reads as restless: more frequent, more fidgety gestures.
const arousalOf=(n?:NeuralState)=>{const e=(n?.energy??70)/100,c=(n?.curiosity??70)/100;return Math.max(0,Math.min(1,(1-e)*.6+c*.4));};
function pickGesture(arousal:number,behavior:Behavior):GestureName{
  const pool:GestureName[]=['scratch','rub','antennae','sip'];
  // A wing shudder is a rare, high-arousal flick — not a constant tremor while idle.
  if(arousal>.62)pool.push('shudder');
  return pool[Math.floor(Math.random()*pool.length)];
}
const makeFly=(id:string,index:number,parent='Holo',generation=1):Fly=>({id,parent,generation,color:palette[index%4],x:.34+(index*.31)%.45,y:.42+(index%2)*.1,vx:.022,vy:.01,heading:-.9,energy:78-index*5,behavior:index%2===0?'flying':'resting',restUntil:14+index*8,trail:[],gesture:null,gestureT:0,gestureDur:0,gesturePhase:0,nextGesture:3+index*2,arousal:.45,gait:'cruise',gaitT:0,gaitDur:1+index*.7,tx:.5,ty:.45,retarget:0,cascade:null,nextCascade:4+index*3,stepPhase:0,stepAmp:0});
const initial=()=>[{...makeFly('Holo',0,'Genesis',0),x:.5,y:.43}];


function FlyField({active,selected,onSnapshot,paused,intent,reset,zoom,onZoom,onApplied,onCatch,neural}:{active:boolean;selected:string;onSnapshot:(flies:Snapshot[])=>void;paused:boolean;intent:HabitatIntent|null;reset:number;zoom:number;onZoom:(zoom:number)=>void;onApplied:(text:string,reference?:string)=>void;onCatch:(point:{x:number;y:number})=>void;neural?:NeuralState}){
  const ref=useRef<HTMLCanvasElement>(null),latest=useRef({active,selected,onSnapshot,paused,intent,reset,zoom,onZoom,onApplied,onCatch,neural});
  latest.current={active,selected,onSnapshot,paused,intent,reset,zoom,onZoom,onApplied,onCatch,neural};
  useEffect(()=>{
    const canvas=ref.current!,ctx=canvas.getContext('2d')!;const flies=initial();let w=1,h=1,time=0,last=0,raf=0,lastSnapshot=-1,lastIntent=-1,lastReset=reset,lastDodge=-10;
    let streaks:{x:number;y:number;heading:number;t:number}[]=[];
    const LENS=[.55,.7,.85,1,1.3,1.5,1.8];
    let lensIdx=3;const cursor={x:0,y:0,inside:false,mouse:false};
    let pan={x:0,y:0},dragStart:{x:number;y:number;panX:number;panY:number}|null=null,dragged=false,pinchDistance=0,pinchZoom=1,gestureWasPinch=false;
    const touches=new Map<number,{x:number;y:number}>();
    const reduced=matchMedia('(prefers-reduced-motion: reduce)').matches;
    let visible:ViewRect|undefined;
    const measureVisible=()=>{
      const r=canvas.getBoundingClientRect(),viewport=window.visualViewport;
      const left=Math.max(0,(viewport?.offsetLeft??0)-r.left),top=Math.max(0,(viewport?.offsetTop??0)-r.top);
      const right=Math.min(w,(viewport?.offsetLeft??0)+(viewport?.width??innerWidth)-r.left),bottom=Math.min(h,(viewport?.offsetTop??0)+(viewport?.height??innerHeight)-r.top);
      // If the user has scrolled away from the habitat, do not squeeze Holo into a sliver.
      visible=right-left>=140&&bottom-top>=160?{left,top,right,bottom}:undefined;
    };
    const resize=()=>{const r=canvas.getBoundingClientRect();if(!r.width||!r.height)return;w=r.width;h=r.height;const dpr=Math.min(devicePixelRatio,2);canvas.width=w*dpr;canvas.height=h*dpr;ctx.setTransform(dpr,0,0,dpr,0,0);measureVisible();};
    const observer=new ResizeObserver(resize);observer.observe(canvas);resize();
    window.addEventListener('scroll',measureVisible,{passive:true,capture:true});
    window.addEventListener('resize',measureVisible);
    window.visualViewport?.addEventListener('resize',measureVisible);
    window.visualViewport?.addEventListener('scroll',measureVisible);
    const bounds=()=>habitatBounds(w,h,latest.current.zoom,pan,visible);
    const local=(e:PointerEvent)=>{const r=canvas.getBoundingClientRect();return{x:e.clientX-r.left,y:e.clientY-r.top};};
    const world=(p:{x:number;y:number})=>({x:(p.x-w/2-pan.x)/latest.current.zoom+w/2,y:(p.y-h/2-pan.y)/latest.current.zoom+h/2});
    const avoid=(point:{x:number;y:number},force=false)=>{
      if(latest.current.paused||reduced||time-lastDodge<1.2)return;
      const f=flies[0],dx=f.x*w-point.x,dy=f.y*h-point.y,distance=Math.hypot(dx,dy);
      if(distance<160&&(force||distance>45)){
        const b=bounds(),angle=distance>1?Math.atan2(dy,dx):f.heading+1.1;
        f.vx=Math.cos(angle)*.27;f.vy=Math.sin(angle)*.32;f.behavior='flying';f.restUntil=time+14;lastDodge=time;lastSnapshot=-1;
        f.gesture=null;f.gestureT=0;f.gesturePhase=0;f.cascade=null; // drop any fidget/grooming so the escape stays a clean glide
        // Escape glides away at normal cruise speed (no dart multiplier): face it, aim downrange.
        f.gait='cruise';f.gaitT=0;f.gaitDur=.7;f.heading=angle;f.retarget=time+.7;
        f.tx=Math.min(Math.max(f.x+Math.cos(angle)*180/w,b.minX),b.maxX);
        f.ty=Math.min(Math.max(f.y+Math.sin(angle)*180/h,b.minY),b.maxY);
      }
    };
    const down=(e:PointerEvent)=>{
      const p=local(e);touches.set(e.pointerId,p);canvas.setPointerCapture(e.pointerId);
      if(touches.size===2){gestureWasPinch=true;const [a,b]=[...touches.values()];pinchDistance=Math.hypot(a.x-b.x,a.y-b.y);pinchZoom=latest.current.zoom;return;}
      dragStart={...p,panX:pan.x,panY:pan.y};dragged=false;gestureWasPinch=false;
    };
    const move=(e:PointerEvent)=>{
      const p=local(e);
      if(e.pointerType!=='touch'){cursor.x=p.x;cursor.y=p.y;cursor.inside=true;cursor.mouse=true;}else cursor.mouse=false;
      if(touches.has(e.pointerId))touches.set(e.pointerId,p);
      if(touches.size===2){const [a,b]=[...touches.values()];latest.current.onZoom(Math.max(.65,Math.min(2.6,pinchZoom*Math.hypot(a.x-b.x,a.y-b.y)/Math.max(pinchDistance,1))));return;}
      if(dragStart&&touches.size===1){const dx=p.x-dragStart.x,dy=p.y-dragStart.y;if(Math.hypot(dx,dy)>6)dragged=true;if(dragged)pan={x:Math.max(-w*.6,Math.min(w*.6,dragStart.panX+dx)),y:Math.max(-h*.6,Math.min(h*.6,dragStart.panY+dy))};}
      else if(e.pointerType!=='touch')avoid(world(p));
    };
    const up=(e:PointerEvent)=>{
      const p=local(e);touches.delete(e.pointerId);
      if(!dragged&&!gestureWasPinch&&dragStart){
        if(e.button===2){lensIdx=Math.max(0,lensIdx-1);}
        else if(e.button===0){
          const point=world(p),f=flies[0],distance=Math.hypot(f.x*w-point.x,f.y*h-point.y);
          const scale=1.25*bounds().magnification,angle=f.heading+Math.PI/2,dx=point.x-f.x*w,dy=point.y-f.y*h+(f.behavior==='flying'?5+Math.sin(time*3.4)*1.3:0);
          const bodyX=(dx*Math.cos(angle)+dy*Math.sin(angle))/scale,bodyY=(-dx*Math.sin(angle)+dy*Math.cos(angle))/scale;
          if((bodyX/13)**2+((bodyY-2)/31)**2<1){latest.current.onCatch({x:p.x/w*100,y:p.y/h*100});latest.current.onApplied("Observation hit: showing Holo's current Connectome thought state.");lastDodge=time;}
          else lensIdx=Math.min(LENS.length-1,lensIdx+1);
        }
      }
      dragStart=null;
    };
    const cancel=(e:PointerEvent)=>{touches.delete(e.pointerId);dragStart=null;gestureWasPinch=true;};
    const leave=()=>{cursor.inside=false;};
    const noMenu=(e:Event)=>e.preventDefault();
    const wheel=(e:WheelEvent)=>{e.preventDefault();latest.current.onZoom(Math.max(.65,Math.min(2.6,latest.current.zoom*Math.exp(-e.deltaY*.0015))));};
    canvas.addEventListener('pointerdown',down);canvas.addEventListener('pointermove',move);canvas.addEventListener('pointerup',up);canvas.addEventListener('pointercancel',cancel);canvas.addEventListener('pointerleave',leave);canvas.addEventListener('contextmenu',noMenu);canvas.addEventListener('wheel',wheel,{passive:false});
    const draw=(now:number)=>{
      const dt=Math.min((now-last)/1000,.04);last=now;const p=latest.current;if(!p.active){raf=requestAnimationFrame(draw);return;}
      if(lastReset!==p.reset){pan={x:0,y:0};lastReset=p.reset;}
      const viewBounds=bounds();
      if(p.intent&&p.intent.sequence!==lastIntent){lastIntent=p.intent.sequence;const f=flies[0];f.behavior=p.intent.action==='rest'?'resting':'flying';f.restUntil=time+25;if(f.behavior==='flying'){f.vx=.055;f.vy=-.025;}p.onApplied('Local behavior demo applied: '+p.intent.action+' → '+f.behavior+'. No brain activity, no cost incurred.',p.intent.reference);lastSnapshot=-1;}
      if(!p.paused&&!reduced){time+=dt;const arousal=arousalOf(p.neural);flies.forEach(f=>{
        f.arousal=arousal;
        // Gesture scheduler: transient cosmetic habits, biased by the (simulated) neural state.
        if(f.gesture){f.gestureT+=dt;f.gesturePhase=f.gestureDur?f.gestureT/f.gestureDur:1;if(f.gestureT>=f.gestureDur){f.gesture=null;f.gestureT=0;f.gesturePhase=0;
          // A grooming cascade chains its next step after a brief beat; a lone gesture waits longer.
          f.nextGesture=f.cascade&&f.cascade.length?time+.25+Math.random()*.45:time+(2.4+Math.random()*5)*(1.25-arousal*.6);}}
        else if(time>f.nextGesture){
          if(f.cascade&&f.cascade.length){const g=f.cascade.shift()!;f.gesture=g;f.gestureT=0;f.gestureDur=GESTURES.find(v=>v.name===g)?.dur??1.4;f.gesturePhase=0;}
          else{
            f.cascade=null;
            const still=f.gait==='hold'||f.behavior==='resting';
            // Settled and unhurried: kick off an ordered grooming cascade (head → antennae → legs → sip).
            if(still&&time>f.nextCascade&&Math.random()<.6){f.cascade=GROOM_CASCADE.slice(1);f.nextCascade=time+10+Math.random()*12;const g=GROOM_CASCADE[0];f.gesture=g;f.gestureT=0;f.gestureDur=GESTURES.find(v=>v.name===g)?.dur??1.4;f.gesturePhase=0;}
            else{const moving=f.behavior==='flying';if(!moving||Math.random()<.28){const g=pickGesture(arousal,f.behavior);f.gesture=g;f.gestureT=0;f.gestureDur=GESTURES.find(v=>v.name===g)?.dur??1.4;f.gesturePhase=0;}else f.nextGesture=time+1.2;}
          }
        }
        // Tripod-gait tread: legs alternate only during genuine cruise locomotion; subtle, and it
        // ramps to zero while holding/resting so a settled fly never looks like it is spasming.
        const spNow=Math.hypot(f.vx*w,f.vy*h);
        const treadTarget=(f.behavior==='flying'&&f.gait==='cruise'&&spNow>10)?Math.max(0,Math.min(1,(spNow-10)/40)):0;
        f.stepAmp+=(treadTarget-f.stepAmp)*Math.min(1,dt*8);
        if(f.stepAmp>.02)f.stepPhase+=dt*(4+Math.min(7,spNow*.07));
        if(f.behavior==='resting'){if(time>f.restUntil){f.behavior='flying';f.restUntil=time+23;}return;}
        if(time>f.restUntil&&Math.sin(time*.27)>.7){f.behavior='resting';f.restUntil=time+9;return;}
        // Stop-and-go locomotion (real flies are intermittent): cruise → abrupt hold → dart off.
        f.gaitT+=dt;
        if(f.gaitT>=f.gaitDur){f.gaitT=0;f.retarget=time;
          if(f.gait==='cruise'){const r=Math.random();if(r<.42){f.gait='hold';f.gaitDur=.5+Math.random()*1.7;}else if(r<.62){f.gait='dart';f.gaitDur=.16+Math.random()*.2;}else{f.gait='cruise';f.gaitDur=.7+Math.random()*1.6;}}
          else if(f.gait==='hold'){f.gait='dart';f.gaitDur=.14+Math.random()*.16;}
          else{f.gait='cruise';f.gaitDur=.6+Math.random()*1.4;}}
        // Discrete waypoints: straight runs between them, a quick re-aim (saccade) only at switches.
        if(time>=f.retarget){f.retarget=time+1.1+Math.random()*2.2;f.tx=viewBounds.minX+Math.random()*(viewBounds.maxX-viewBounds.minX);f.ty=viewBounds.minY+Math.random()*(viewBounds.maxY-viewBounds.minY);}
        f.vx+=(f.tx-f.x)*dt*.5;f.vy+=(f.ty-f.y)*dt*.5;f.vx*=Math.exp(-dt*1.6);f.vy*=Math.exp(-dt*1.6);
        // Turn back gently before the edge; the hard guard also covers large evade impulses.
        const soften=(pos:number,min:number,max:number)=>Math.max(0,1-(pos-min)/.06)-Math.max(0,1-(max-pos)/.06);
        f.vx+=soften(f.x,viewBounds.minX,viewBounds.maxX)*dt*.4;
        f.vy+=soften(f.y,viewBounds.minY,viewBounds.maxY)*dt*.4;
        const gaitMul=f.gait==='hold'?.07:f.gait==='dart'?1.9:1;
        f.x+=f.vx*dt*gaitMul;f.y+=f.vy*dt*gaitMul;constrainToHabitat(f,viewBounds);
        // Snappier heading lerp reads as a saccade; during a hold (speed≈0) it pivots in place.
        const sp=Math.hypot(f.vx*w,f.vy*h);
        if(sp>3){const angle=Math.atan2(f.vy*h,f.vx*w);f.heading+=Math.atan2(Math.sin(angle-f.heading),Math.cos(angle-f.heading))*Math.min(1,dt*12);}
      });}
      // Camera changes and resizing must stay safe even while paused or resting.
      flies.forEach(f=>constrainToHabitat(f,viewBounds));
      ctx.clearRect(0,0,w,h);
      const tint=NEURAL_TINT[p.neural?.name??'']??'130,211,224';
      const f0=flies[0],reach=140;
      const sp0=Math.hypot(f0.vx*w,f0.vy*h);
      if(sp0>55||f0.gait==='dart')streaks.push({x:f0.x*w,y:f0.y*h,heading:f0.heading,t:time});
      streaks=streaks.filter(s=>time-s.t<.3);
      const worldTransform=()=>{ctx.translate(w/2+pan.x,h/2+pan.y);ctx.scale(p.zoom,p.zoom);ctx.translate(-w/2,-h/2);};
      const paintWorld=()=>{
        // World-space grain makes camera zoom and panning perceptible without orbit graphics.
        for(let i=0;i<140;i++){ctx.fillStyle='rgba(166,191,199,.055)';ctx.fillRect((i*91.713%1)*w,(i*37.917%1)*h,.8,.8);}
        const bx0=viewBounds.minX*w,bx1=viewBounds.maxX*w,by0=viewBounds.minY*h,by1=viewBounds.maxY*h,spanX=bx1-bx0,spanY=by1-by0;
        // Slow drifting dust gives the chamber air; positions wrap inside the flight bounds.
        for(let i=0;i<14;i++){const fx=(((i*.37713+time*.004*(1+(i%3)*.4))%1)+1)%1,fy=(((i*.51731+time*.0026+Math.sin(time*.07+i)*.02)%1)+1)%1;ctx.fillStyle=`rgba(166,191,199,${.045+.03*Math.sin(time*.6+i*2.1)})`;ctx.fillRect(bx0+fx*spanX,by0+fy*spanY,.9,.9);}
        // Walls breathe light only while Holo turns away from them: the bound stays invisible until touched.
        const band=(dist:number,vertical:boolean,edge:number)=>{if(dist>=reach)return;const a=(1-dist/reach)*.09*(.75+.25*Math.sin(time*2.2));const gr=vertical?ctx.createLinearGradient(edge,0,edge+(edge===bx0?70:-70),0):ctx.createLinearGradient(0,edge,0,edge+(edge===by0?70:-70));gr.addColorStop(0,`rgba(${tint},${a})`);gr.addColorStop(1,`rgba(${tint},0)`);ctx.fillStyle=gr;if(vertical)ctx.fillRect(edge===bx0?bx0:bx1-70,by0,70,spanY);else ctx.fillRect(bx0,edge===by0?by0:by1-70,spanX,70);};
        band(f0.x*w-bx0,true,bx0);band(bx1-f0.x*w,true,bx1);band(f0.y*h-by0,false,by0);band(by1-f0.y*h,false,by1);
        // Dart afterimages: brief amber streaks while Holo accelerates hard.
        for(const s of streaks){const a=(1-(time-s.t)/.3)*.09;ctx.save();ctx.translate(s.x,s.y);ctx.rotate(s.heading+Math.PI/2);ctx.scale(viewBounds.magnification,viewBounds.magnification);ctx.fillStyle=`rgba(218,181,123,${a})`;ctx.beginPath();ctx.ellipse(0,0,6,15,0,0,Math.PI*2);ctx.fill();ctx.restore();}
        flies.forEach(f=>renderElectronicFly(ctx,f,f.x*w,f.y*h,time,f.id===p.selected,viewBounds.magnification,reduced?0:1,tint));
      };
      ctx.save();worldTransform();paintWorld();ctx.restore();
      // Observer loupe: the cursor becomes a small viewfinder; its circle re-renders the chamber at the lens power.
      if(cursor.inside&&cursor.mouse){
        const power=LENS[lensIdx],cx=cursor.x,cy=cursor.y,sq=dragStart&&dragged?30:36;
        ctx.save();ctx.beginPath();ctx.arc(cx,cy,26,0,Math.PI*2);ctx.clip();
        ctx.translate(cx,cy);ctx.scale(power,power);ctx.translate(-cx,-cy);
        worldTransform();paintWorld();
        ctx.restore();
        ctx.lineWidth=1;
        ctx.strokeStyle='rgba(205,230,240,.30)';ctx.beginPath();ctx.arc(cx,cy,26,0,Math.PI*2);ctx.stroke();
        ctx.strokeStyle='rgba(205,230,240,.10)';ctx.beginPath();ctx.arc(cx,cy,27.5,0,Math.PI*2);ctx.stroke();
        ctx.strokeStyle='rgba(190,215,225,.42)';
        for(const [sx,sy] of [[1,1],[-1,1],[1,-1],[-1,-1]] as const){ctx.beginPath();ctx.moveTo(cx+sx*sq-sx*10,cy+sy*sq);ctx.lineTo(cx+sx*sq,cy+sy*sq);ctx.lineTo(cx+sx*sq,cy+sy*sq-sy*10);ctx.stroke();}
        ctx.strokeStyle='rgba(205,230,240,.35)';ctx.beginPath();ctx.moveTo(cx-3,cy);ctx.lineTo(cx+3,cy);ctx.moveTo(cx,cy-3);ctx.lineTo(cx,cy+3);ctx.stroke();
        ctx.font='9px monospace';ctx.fillStyle='rgba(166,191,199,.65)';ctx.textAlign='left';ctx.fillText(`×${power}`,cx+sq+8,cy+3);
      }
      if(time-lastSnapshot>.6||lastSnapshot<0){p.onSnapshot(flies.map(f=>({id:f.id,parent:f.parent,generation:f.generation,energy:Math.round(f.energy),behavior:f.behavior,gesture:f.gesture,gait:f.gait,arousal:f.arousal,groom:f.gesture&&f.cascade?GROOM_CASCADE.length-f.cascade.length:0})));lastSnapshot=time;}
      raf=requestAnimationFrame(draw);
    };raf=requestAnimationFrame(draw);
    return()=>{cancelAnimationFrame(raf);observer.disconnect();window.removeEventListener('scroll',measureVisible,true);window.removeEventListener('resize',measureVisible);window.visualViewport?.removeEventListener('resize',measureVisible);window.visualViewport?.removeEventListener('scroll',measureVisible);canvas.removeEventListener('pointerdown',down);canvas.removeEventListener('pointermove',move);canvas.removeEventListener('pointerup',up);canvas.removeEventListener('pointercancel',cancel);canvas.removeEventListener('pointerleave',leave);canvas.removeEventListener('contextmenu',noMenu);canvas.removeEventListener('wheel',wheel);};
  },[]);
  return <canvas ref={ref} className="habitat-field" aria-label="Holo habitat. Scroll or pinch to zoom, drag to pan. Holo avoids nearby pointers; click its body to reveal its Connectome thought. Left-click empty glass raises the observer lens through three powers, right-click lowers it through three."/>;
}

export function FlyCulture({active,mind,neural,brainOnline=BRAIN_ONLINE,onRecord,onOpenRecords,onOpenNeeds}:{active:boolean;mind:{name:string;text:string};neural?:NeuralState;brainOnline?:boolean;onRecord:(text:string,kind:string,reference?:string)=>void;onOpenRecords:()=>void;onOpenNeeds:()=>void}){
  const brainStatus=brainOnline?'BRAIN ONLINE':'BRAIN DORMANT';
  const [flies,setFlies]=useState<Snapshot[]>(()=>initial().map(f=>({id:f.id,parent:f.parent,generation:f.generation,energy:Math.round(f.energy),behavior:f.behavior,gesture:f.gesture,gait:f.gait,arousal:f.arousal,groom:0}))),[paused,setPaused]=useState(false),[reset,setReset]=useState(0),[zoom,setZoom]=useState(1),[intent,setIntent]=useState<HabitatIntent|null>(null),[draft,setDraft]=useState(''),[speech,setSpeech]=useState(false),[details,setDetails]=useState(false),[fullscreenError,setFullscreenError]=useState(''),[messages,setMessages]=useState<Message[]>([{who:'Holo',text:'Local observation channel ready. You can wake me, send me exploring, or let me rest.'}]);
  const sequence=useRef(0),stage=useRef<HTMLDivElement>(null);const current=flies[0];
  const gaitText=current.behavior==='resting'?'REST':({cruise:'CRUISE',hold:'HOLD',dart:'DART'} as Record<Gait,string>)[current.gait??'cruise'];
  const groomText=current.groom?`GROOM ${current.groom}/4${current.gesture?` ${GESTURE_LABEL[current.gesture]}`:''}`:current.gesture?GESTURE_LABEL[current.gesture]:null;
  const act=(action:HabitatIntent['action'],text?:string)=>{const next=++sequence.current,reference=`HOLO-${Date.now()}-${next}`;onRecord(text?`User input: ${text}`:`Observer panel command: ${action}`,'Input',reference);setPaused(false);setIntent({action,targetId:'Holo',source:'local-preview',sequence:next,reference});const responses={wake:'Local preview: Holo took the wake signal and started its wings.',rest:'Local preview: Holo settled into rest.',explore:'Local preview: Holo took off to explore.'};setMessages(m=>[...m,...(text?[{who:'You' as const,text}]:[]),{who:'Holo',text:responses[action]}]);};
  const send=(e:React.FormEvent)=>{e.preventDefault();const text=draft.trim();if(!text)return;setDraft('');const action=/wake/i.test(text)?'wake':/rest|sleep/i.test(text)?'rest':/explore|fly/i.test(text)?'explore':null;if(action){act(action,text);}else{onRecord(`User input: ${text}`,'Input');setMessages(m=>[...m,{who:'You',text},{who:'Holo',text:'Input recorded, no behavior executed. The brain is dormant right now — try "wake up", "explore" or "rest", or use the buttons in the observer panel.'}]);}};
  const catchHolo=()=>setSpeech(true);
  return <section className="culture-page electronic-culture immersive-culture">
    <div className="page-introduction"><div><span className="micro-label">03 / COLONY · LIVING SPACE & LINEAGE</span><h1>A room that becomes a world<span>.</span></h1></div><div className="population-summary"><strong>01</strong><span>HOLO · FIRST GENERATION<br/>LIVING SPACE NOW · LINEAGE TO COME</span></div></div>
    <div className="habitat-layout"><div className="habitat-stage" ref={stage}>
      <FlyField active={active} selected="Holo" onSnapshot={setFlies} paused={paused} intent={intent} reset={reset} zoom={zoom} onZoom={setZoom} onApplied={(text,reference)=>onRecord(text,'Action',reference)} onCatch={catchHolo} neural={neural}/>
      <span className="stage-glass" aria-hidden="true"/>
      <span className="habitat-location">CHAMBER 01 / LIVING FIELD<br/><em>One life, and the possibilities not yet unfolded.</em></span>
      <div className="field-tools"><button aria-label="Observe Holo state" aria-expanded={details} onClick={()=>setDetails(!details)}><Info size={16}/></button><button aria-label="Fullscreen habitat" onClick={async()=>{try{if(document.fullscreenElement)await document.exitFullscreen();else await stage.current?.requestFullscreen();}catch{setFullscreenError('This browser does not support fullscreen. Use the zoom lens instead.');}}}><Maximize size={16}/></button></div>
      {speech&&<div className="holo-thought" role="status"><div><span className="micro-label">HOLO / {mind.name.toUpperCase()}</span><button aria-label="Close Holo thought" onClick={()=>setSpeech(false)}><X size={14}/></button></div><p>“{mind.text}”</p><footer><span>CONNECTOME · DEMO STATE</span><button onClick={onOpenRecords}>View journal <ArrowUpRight size={13}/></button></footer></div>}
      {details&&<aside className="individual-inspector"><button className="inspector-close" aria-label="Close organism details" onClick={()=>setDetails(false)}><X size={14}/></button><span className="micro-label">SELECTED ORGANISM</span><h2>Holo</h2><p className="fly-identity-note">The only autonomous subject for now. The room is reserved for a future mate and offspring; nothing here is generated automatically.</p><dl><div><dt>Generation</dt><dd>G0</dd></div><div><dt>Behavior · demo</dt><dd>{current.behavior}{current.gesture?` · ${GESTURE_LABEL[current.gesture]}`:''}</dd></div><div><dt>Mind</dt><dd>{mind.name}</dd></div><div><dt>Brain</dt><dd>{brainOnline?"Online":"Dormant"}</dd></div></dl><div className="fly-actions"><button onClick={()=>act('explore')}>Explore <ArrowUpRight size={13}/></button><button onClick={()=>act('rest')}>Rest <Moon size={13}/></button></div><div className="habitat-destinations"><button onClick={onOpenRecords}>Activity journal <ArrowUpRight size={13}/></button><button onClick={onOpenNeeds}>Resource needs <ArrowUpRight size={13}/></button></div></aside>}
      <span className="habitat-mode">SCROLL TO ZOOM · DRAG TO EXPLORE · L-CLICK LENS + · R-CLICK LENS −<br/><em>It edges away as you approach · click its body to hear its current state · left-click lens + / right-click lens − ×0.55–×1.8</em></span>
      <div className="habitat-controls"><span title="Scroll to zoom">{Math.round(zoom*100)}%</span><button aria-label="Reset habitat view" onClick={()=>{setZoom(1);setReset(r=>r+1);setSpeech(false);}}><RotateCcw size={14}/></button><button aria-label={paused?'Resume habitat':'Pause habitat'} onClick={()=>setPaused(!paused)}>{paused?<Play size={14}/>:<Pause size={14}/>}</button><button className="accessible-thought" onClick={catchHolo}>Listen to Holo</button></div>
      {fullscreenError&&<span className="fullscreen-error">{fullscreenError}</span>}
    </div></div>
    <div className="behavior-caption"><span className="cap-dot" aria-hidden="true"/><span>{gaitText}{groomText?` · ${groomText}`:''} · AROUSAL {(current.arousal??0).toFixed(2)} · ENERGY {current.energy}</span><span>BEHAVIOR LIVE · LOCAL SIM · {brainStatus}</span></div>
    <div className="habitat-notice"><span>Scroll or pinch to zoom · drag to pan · click the body to read its current Connectome state. Dodging, flight and grooming habits (head scratch / wing shudder / sip) are a local behavior simulation scheduled from the simulated neural state — not output from a real nervous system.</span><span>{brainStatus}</span></div>
    <section className="holo-dialogue"><div><span className="micro-label">A CHANNEL TO HOLO</span><h2>Leave a thought.</h2><p>Give Holo an intent and watch how it acts.</p><small>LOCAL DEMO / {brainStatus}</small><small className="dialogue-note">(The Channel is a local preview — it isn&apos;t wired to Holo&apos;s brain yet. That link opens later, as the project moves forward.)</small></div><div className="dialogue-content"><div className="dialogue-history" aria-live="polite">{messages.slice(-6).map((m,i)=><article key={`${i}-${m.text}`}><span>{m.who}</span><p>{m.text}</p></article>)}</div><form onSubmit={send}><input aria-label="Message Holo" placeholder="Try: wake up / explore / rest" maxLength={500} value={draft} onChange={e=>setDraft(e.target.value)}/><button type="submit" aria-label="Send message to Holo" disabled={!draft.trim()}><Send size={16}/></button></form><p className="dialogue-route">Your words → Holo’s intent → habitat behavior <span>Inputs and outcomes are traceable in the Journal</span></p></div></section>
  </section>;
}
