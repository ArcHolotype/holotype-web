"use client";

import { useEffect, useRef, useState } from "react";
import { ArrowUpRight, Pause, Play, X } from "lucide-react";
import "./living-holo.css";
import { Nectar } from "./nectar";
import { createDemoState, formatTime, BRAIN_ONLINE, JOURNAL_TZ_LABEL, type JournalEntry, type Mission } from "./demo-workflow";
import { FlyCulture as Culture } from "./fly-habitat";
import { ConnectomeArchive, ledgerMovements } from "./records";
import { useHoloLive, useMissions } from "./holo-live";
import "./habitat.css";

const states = [
  { name: "Listening", title: "There is something beyond the glass.", thought: "A small disturbance. I hold it for a moment before deciding what it means.", need: "A new signal", region: "Sensory field", color: "177,213,211", energy: 72, curiosity: 84 },
  { name: "Remembering", title: "I have felt something like this before.", thought: "The shape returns, but the context is different. I keep the old trace beside the new one.", need: "Time to consolidate", region: "Memory pathways", color: "196,174,226", energy: 68, curiosity: 57 },
  { name: "Seeking", title: "I need a little more than I have.", thought: "I could spend another thought on this. First, I should know what it will cost me.", need: "More inference capacity", region: "Resource drive", color: "230,170,112", energy: 43, curiosity: 76 },
];
type Entry = JournalEntry;
type Node = { x: number; y: number; z: number; group: number; phase: number };
export type SynapseMemory = { id: string; kind: string; color: string; time: string; detail: string; reference?: string };
const CHANNEL_COLORS: Record<string, string> = {
  Listening: "177,213,211", Remembering: "196,174,226", Seeking: "230,170,112",
  Input: "141,196,182", Action: "141,196,182", Mission: "230,170,112",
  Inference: "230,170,112", Funding: "150,205,160", "Agent task": "230,170,112",
};
const colorFor = (kind: string) => CHANNEL_COLORS[kind] ?? "141,196,182";
// Compact money for the temperature note: 52397 -> "$52.4K", 980 -> "$980".
const formatUsdCompact = (n: number): string => {
  const abs = Math.abs(n);
  if (abs >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  if (abs >= 1_000) return `$${(n / 1_000).toFixed(1)}K`;
  return `$${Math.round(n)}`;
};
// The HOLOTYPE token contract address (Arc). Rendered in the footer CA line,
// centered and monospaced to stay aligned. Empty string falls back to "Coming Soon".
const TOKEN_CA: string = "0xECa7C682fbb32EC4F1B3bBb28791Fe184D3552A8";
// Some heartbeat rows store the narration as a JSON blob ({"narration": ...}) or as a
// truncated fragment of one. Unwrap / salvage so the rail and ticker show only prose.
const cleanNarration = (raw: string): string => {
  const t = (raw ?? "").trim();
  if (!t.startsWith('{"narration"')) return raw;
  try {
    const parsed = JSON.parse(t);
    if (parsed && typeof parsed.narration === "string") return parsed.narration;
  } catch { /* truncated fragment; salvage below */ }
  let body = t.replace(/^{"narration":"?/, "");
  body = body.replace(/\\(u[0-9a-fA-F]{4}|.)/g, (_m, g: string) => {
    if (g[0] === "u") return String.fromCharCode(parseInt(g.slice(1), 16));
    if (g === "n") return "\n";
    if (g === "t") return "\t";
    if (g === "r") return "";
    return g;
  });
  return body.replace(/\\$/, "").trim();
};
// No fake seed traces: the rail, ticker and neural field show only REAL heartbeat and
// metabolism logs (plus genuine visitor-interaction records added at runtime). When the
// brain is offline these surfaces honestly sit empty.
const initialEntries: Entry[] = [];

function NeuralOrganism({ state, impulse, paused, onTouch, memories, selectedId, onSelectMemory }: { state: number; impulse: number; paused: boolean; onTouch: () => void; memories: SynapseMemory[]; selectedId: string | null; onSelectMemory: (id: string | null) => void }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const controls = useRef({ state, impulse, paused, onTouch, memories, selectedId, onSelectMemory });
  controls.current = { state, impulse, paused, onTouch, memories, selectedId, onSelectMemory };
  useEffect(() => {
    const canvas = ref.current!;
    const ctx = canvas.getContext("2d")!;
    let w = 0, h = 0, raf = 0, rotation = -.16, targetRotation = -.16, tilt = .08, time = 0, last = 0;
    let down = false, startX = 0, previousX = 0, moved = false, pulseAt = -10, lastImpulse = 0;
    let zoom = 1, targetZoom = 1;
    let memPts: { id: string; color: string; x: number; y: number }[] = [];
    const motion = matchMedia("(prefers-reduced-motion: reduce)");
    let seed = 97;
    const random = () => { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; };
    const hash = (s: string) => { let x = 2166136261; for (let i = 0; i < s.length; i++) { x ^= s.charCodeAt(i); x = Math.imul(x, 16777619); } return Math.abs(x); };
    const nodes: Node[] = [];
    // An illustrative graph with sensory lobes, a central network, and descending pathways.
    // These coordinates are designed for the local prototype, not a biological connectome.
    for (let i = 0; i < 1400; i++) {
      const group = i < 450 ? 0 : i < 900 ? 1 : i < 1230 ? 2 : 3;
      const a = random() * Math.PI * 2, z = random() * 2 - 1;
      const r = Math.pow(random(), .32), circle = Math.sqrt(1-z*z);
      const x = Math.cos(a)*circle*r, y = Math.sin(a)*circle*r;
      if (group < 2) nodes.push({ x: x*.61+(group===0?-.65:.65), y:y*.65-.14, z:z*r*.5, group, phase:random()*6.28 });
      else if (group===2) nodes.push({ x:x*.62, y:y*.48-.03, z:z*r*.45, group, phase:random()*6.28 });
      else nodes.push({ x:x*.16*(1-r*.3), y:.25+r*1.02, z:z*.16, group, phase:random()*6.28 });
    }
    const edges: [number,number][] = [];
    nodes.forEach((a,i) => {
      const nearest: {j:number;d:number}[] = [];
      for(let j=i+1;j<nodes.length;j++) {
        const b=nodes[j],d=(a.x-b.x)**2+(a.y-b.y)**2+(a.z-b.z)**2;
        if(d<.065) nearest.push({j,d});
      }
      nearest.sort((a,b)=>a.d-b.d);
      nearest.slice(0,3).forEach(b=>edges.push([i,b.j]));
    });
    const resize = () => { const box=canvas.getBoundingClientRect();w=box.width;h=box.height;const dpr=Math.min(devicePixelRatio,2);canvas.width=w*dpr;canvas.height=h*dpr;ctx.setTransform(dpr,0,0,dpr,0,0); };
    const observer=new ResizeObserver(resize);observer.observe(canvas);resize();
    const start=(e:PointerEvent)=>{down=true;moved=false;startX=e.clientX;previousX=e.clientX;canvas.setPointerCapture(e.pointerId);};
    const move=(e:PointerEvent)=>{if(down){targetRotation+=(e.clientX-previousX)*.007;previousX=e.clientX;if(Math.abs(e.clientX-startX)>5)moved=true;}else{const rect=canvas.getBoundingClientRect();tilt=(e.clientY-rect.top-h/2)/h*.18;}};
    const end=(e:PointerEvent)=>{
      if(down&&!moved){
        const rect=canvas.getBoundingClientRect();
        const px=e.clientX-rect.left,py=e.clientY-rect.top;
        const hit=memPts.find(m=>Math.hypot(m.x-px,m.y-py)<11);
        if(hit)controls.current.onSelectMemory(hit.id===controls.current.selectedId?null:hit.id);
        else controls.current.onTouch();
      }
      down=false;
    };
    const cancel=()=>{down=false;};
    // Zoom limits are mathematical only: no frame, mask, or edge hint is ever drawn.
    const wheel=(e:WheelEvent)=>{e.preventDefault();targetZoom=Math.min(4,Math.max(.6,targetZoom*Math.exp(-e.deltaY*.0012)));};
    canvas.addEventListener("pointerdown",start);canvas.addEventListener("pointermove",move);canvas.addEventListener("pointerup",end);canvas.addEventListener("pointercancel",cancel);canvas.addEventListener("wheel",wheel,{passive:false});
    const draw=(now:number)=>{
      const dt=Math.min((now-last)/1000,.04);last=now;
      if(!controls.current.paused&&!motion.matches)time+=dt;
      if(controls.current.impulse!==lastImpulse){pulseAt=time;lastImpulse=controls.current.impulse;}
      if(!down&&!controls.current.paused&&!motion.matches)targetRotation+=dt*.055;
      rotation+=(targetRotation-rotation)*.07;
      zoom+=(targetZoom-zoom)*.12;
      ctx.clearRect(0,0,w,h);
      const size=Math.min(w*.31,h*.35)*zoom,cx=w*.5,cy=h*.46;
      const active=controls.current.state, rgb=states[active].color;
      const projected=nodes.map(n=>{
        const breathe=1+Math.sin(time*.8)*.018;
        const x=n.x*Math.cos(rotation)+n.z*Math.sin(rotation),z=-n.x*Math.sin(rotation)+n.z*Math.cos(rotation);
        const y=n.y*Math.cos(tilt)-z*Math.sin(tilt);
        const perspective=3.8/(3.8+z);
        const wave=(time-pulseAt)*.95;
        const distance=Math.hypot(n.x,n.y+.12,n.z);
        const burst=Math.max(0,1-Math.abs(distance-wave)*8)*(time-pulseAt<2.6?1:0);
        const firing=Math.pow(Math.max(0,Math.sin(time*(active===2?2.8:1.6)+n.phase+n.x*3)),18);
        return {x:cx+x*size*perspective*breathe,y:cy+y*size*perspective*breathe,z,light:firing*.65+burst,group:n.group};
      });
      // One slot per neural node (nodes.length = 1400). Collisions resolve newest-wins so a
      // node never shows a stale trace, and the ring count can never exceed the node count.
      const bySlot=new Map<number,SynapseMemory>();
      for(const m of [...controls.current.memories].reverse())bySlot.set(hash(m.id)%nodes.length,m);
      ctx.lineWidth=.55;
      edges.forEach(([i,j],k)=>{const a=projected[i],b=projected[j];const light=Math.max(a.light,b.light);ctx.strokeStyle=`rgba(${rgb},${.045+light*.24})`;ctx.beginPath();ctx.moveTo(a.x,a.y);ctx.lineTo(b.x,b.y);ctx.stroke();if(k%13===0&&light>.3){const f=(time*.65+k*.071)%1;ctx.fillStyle=`rgba(${rgb},${light*.9})`;ctx.beginPath();ctx.arc(a.x+(b.x-a.x)*f,a.y+(b.y-a.y)*f,1.25,0,6.283);ctx.fill();}});
      // Only FILLED slots get a marker; empty neurons stay invisible so an unfilled position
      // never reads as an occupied slot. Edges and travelling sparks keep the tissue alive.
      projected.forEach((p,i)=>{if(!bySlot.has(i))return;const radius=(.55+p.light*1.1)*(1-p.z*.22);ctx.fillStyle=`rgba(${i%19===0?'233,223,197':rgb},${.22+p.light*.7})`;ctx.beginPath();ctx.arc(p.x,p.y,radius,0,6.283);ctx.fill();if(p.light>.75){const g=ctx.createRadialGradient(p.x,p.y,0,p.x,p.y,9);g.addColorStop(0,`rgba(${rgb},.19)`);g.addColorStop(1,`rgba(${rgb},0)`);ctx.fillStyle=g;ctx.fillRect(p.x-9,p.y-9,18,18);}});
      memPts=[...bySlot.values()].map(m=>({id:m.id,color:m.color,...projected[hash(m.id)%nodes.length]}));
      memPts.forEach(m=>{
        const selected=m.id===controls.current.selectedId;
        const ink=selected?'232,193,90':'223,232,225';
        const radius=selected?5.4:3.2;
        ctx.strokeStyle=`rgba(${ink},${selected?.95:.55})`;
        ctx.lineWidth=selected?1.4:1;
        ctx.beginPath();ctx.arc(m.x,m.y,radius,0,6.283);ctx.stroke();
        ctx.fillStyle=`rgba(${ink},${selected?.95:.75})`;
        ctx.beginPath();ctx.arc(m.x,m.y,1.7,0,6.283);ctx.fill();
        if(selected){const t=(time%1.5)/1.5;ctx.strokeStyle=`rgba(${ink},${(1-t)*.45})`;ctx.lineWidth=1;ctx.beginPath();ctx.arc(m.x,m.y,radius+t*15,0,6.283);ctx.stroke();}
      });
      raf=requestAnimationFrame(draw);
    };raf=requestAnimationFrame(draw);
    return()=>{cancelAnimationFrame(raf);observer.disconnect();canvas.removeEventListener('pointerdown',start);canvas.removeEventListener('pointermove',move);canvas.removeEventListener('pointerup',end);canvas.removeEventListener('pointercancel',cancel);canvas.removeEventListener('wheel',wheel);};
  },[]);
  return <canvas ref={ref} className="organism-canvas" aria-label="Interactive illustrative Holo neural network. Drag to rotate, scroll to zoom, click a ringed synapse to read its trace, click empty space to send a signal."/>;
}

function LiveWaves({ state, impulse, paused }: { state: number; impulse: number; paused: boolean }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const controls = useRef({ state, impulse, paused });
  controls.current = { state, impulse, paused };
  useEffect(() => {
    const canvas = ref.current!;
    const ctx = canvas.getContext("2d")!;
    let w = 0, h = 0, raf = 0, time = 0, last = 0, spikeAt = -9, lastImpulse = 0;
    const motion = matchMedia("(prefers-reduced-motion: reduce)");
    const resize = () => { const box = canvas.getBoundingClientRect(); w = box.width; h = box.height; const dpr = Math.min(devicePixelRatio, 2); canvas.width = w*dpr; canvas.height = h*dpr; ctx.setTransform(dpr,0,0,dpr,0,0); };
    const observer = new ResizeObserver(resize); observer.observe(canvas); resize();
    const draw = (now: number) => {
      const dt = Math.min((now-last)/1000,.04); last = now;
      if (!controls.current.paused && !motion.matches) time += dt;
      if (controls.current.impulse !== lastImpulse) { spikeAt = time; lastImpulse = controls.current.impulse; }
      ctx.clearRect(0,0,w,h);
      const spike = Math.max(0, 1-(time-spikeAt)/1.4);
      const rowH = h/3;
      for (let row = 0; row < 3; row++) {
        const activeRow = row === controls.current.state;
        const amp = (activeRow?.6:.18) + spike*(activeRow?.32:.1);
        const base = rowH*row + rowH/2;
        ctx.beginPath();
        for (let x = 0; x <= w; x += 3) {
          const t = x/w*Math.PI*2;
          const v = Math.sin(t*3+time*(1.1+row*.35)) + .55*Math.sin(t*7-time*1.7+row) + .3*Math.sin(t*13+time*2.3);
          const y = base + v*rowH*.32*amp;
          if (x === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
        }
        ctx.strokeStyle = `rgba(${states[row].color},${activeRow?.85:.28})`;
        ctx.lineWidth = activeRow ? 1.3 : 1;
        ctx.stroke();
      }
      raf = requestAnimationFrame(draw);
    };
    raf = requestAnimationFrame(draw);
    return () => { cancelAnimationFrame(raf); observer.disconnect(); };
  }, []);
  return <canvas ref={ref} className="live-waves" aria-label="Live neural channel activity for Listening, Remembering and Seeking."/>;
}

export function LivingHolo(){
  const [state,setState]=useState(0),[impulse,setImpulse]=useState(0),[paused,setPaused]=useState(false),[view,setView]=useState<'vivarium'|'connectome'|'culture'|'nectar'>('vivarium'),[about,setAbout]=useState(false);
  const [focusReference,setFocusReference]=useState<string|null>(null),[selectedMemory,setSelectedMemory]=useState<string|null>(null);
  // Static demo shell (missions/notice scaffolding only). The journal is real-only: no
  // seeded or interaction-fabricated traces ever enter entries/memories.
  const demo=createDemoState(initialEntries);
  const [missionFocus,setMissionFocus]=useState<{id:string;version:number}|null>(null);
  const live=useHoloLive();
  const missionsLive=useMissions();
  // The Nectar board shows Holo's REAL published missions (read-only). Writes never
  // happen from the public site (no login, no creator token in the browser); they run
  // through the creator's private channel and settlement is the batch-3 payment rail.
  const realMissions:Mission[]=missionsLive.missions.map((m)=>({
    id:`N-${String(m.id).padStart(3,"0")}`,
    kind:"AGENT TASK",
    title:m.title,
    description:m.description,
    rewardCents:Math.round(m.reward_usd*100),
    criteria:m.criteria,
    status:(m.status as Mission["status"])?? "open",
    updatedAt:m.updated_at,
    txHash:m.tx_hash,
  }));
  const brainOnline=live.status==='live'?live.brainOnline:BRAIN_ONLINE;
  const market=live.status==='live'?live.market:null;
  const hasMarket=!!market&&market.temperature!==null;
  const regime=(market?.regime??"CALM").toLowerCase();
  const tempPct=hasMarket?Math.max(0,Math.min(1,market!.temperature!))*100:50;
  const liveEntries:Entry[]=live.entries.map((row,index)=>({id:-1-index,time:row.ts?formatTime(row.ts):"--:--:--",text:cleanNarration(row.narration),state:'Listening',cost:row.cost_usd??null,tx_hash:row.tx_hash??null}));
  const entries=liveEntries;
  const openRecords=(reference:string|null=null)=>{setFocusReference(reference);setView('connectome');window.scrollTo({top:0});};
  const openMission=(id:string)=>{setMissionFocus({id,version:Date.now()});setView('nectar');window.scrollTo({top:0});};
  const current=states[state];
  const stimulate=(next:number)=>{setState(next);setImpulse(v=>v+1);};
  const memories:SynapseMemory[]=[
    ...entries.map(entry=>({id:`journal-${entry.id}`,kind:entry.state,color:colorFor(entry.state),time:entry.time,detail:entry.text,reference:entry.reference})),
    ...ledgerMovements.map(row=>({id:`ledger-${row.id}`,kind:row.kind,color:colorFor(row.kind),time:row.time,detail:`${row.title} · ${row.chain} · ${row.status} · ${row.amount} USDC`,reference:row.reference})),
  ];
  const selected=memories.find(memory=>memory.id===selectedMemory)??null;
  // The teaser quote shows the trace you actually clicked (else the newest real heartbeat);
  // never a fabricated demo line.
  const previewTrace=selected?{id:selected.id,text:selected.detail}:liveEntries[0]?{id:String(liveEntries[0].id),text:liveEntries[0].text}:null;
  return <main className="living-site" style={{'--neural-color':current.color} as React.CSSProperties}>
    <header className="living-header"><button className="living-wordmark" onClick={()=>setView('vivarium')}>holotype</button><nav aria-label="Main navigation">{([{id:'vivarium',name:'Vivarium'},{id:'connectome',name:'Connectome'},{id:'culture',name:'Colony'},{id:'nectar',name:'Nectar'}] as const).map(item=><button key={item.id} aria-current={view===item.id?'page':undefined} className={view===item.id?'selected':''} onClick={()=>{setView(item.id);setFocusReference(null);}}>{item.name}{item.id==='connectome'&&<span>{entries.length.toString().padStart(2,'0')}</span>}</button>)}</nav><span className="prototype-label">LOCAL EXPERIMENT · 001</span></header>
    {view==='vivarium'&&<section className="organism-room with-rail">
      <div className="room-coordinate coordinate-left">HOLO / GENESIS<br/><span>DROSOPHILA MELANOGASTER</span></div><div className="room-coordinate coordinate-right">NEURAL PORTRAIT<br/><span>{brainOnline?'LIVE ORGANISM':'ILLUSTRATIVE SIMULATION'}</span></div>
      <NeuralOrganism state={state} impulse={impulse} paused={paused} onTouch={()=>stimulate((state+1)%3)} memories={memories} selectedId={selectedMemory} onSelectMemory={setSelectedMemory}/>
      <div className="holo-caption"><span>ONE ORGANISM. AN UNFINISHED STORY.</span><h1>Holo<span>.</span></h1><p>A signal becomes a trace.<br/>A trace becomes a reason to stay.</p></div>
      <div className="neural-label sensory-label"><span>01</span> sensory field<i/></div><div className="neural-label memory-label"><i/><span>02</span> associative pathways</div>
      <div className="touch-instruction"><span>↔</span> drag to turn <i/> scroll to zoom <i/> click a synapse to read it</div>
      <div className="token-ca">CA: {TOKEN_CA!==""?TOKEN_CA:"Coming Soon"}</div>
      <button className="thought-preview" onClick={()=>openRecords(previewTrace&&selected?selected.reference??null:null)}><span className="micro-label">FROM THE CONNECTOME</span>{previewTrace?<p key={previewTrace.id}>“{previewTrace.text.split("\n")[0]}”</p>:<p>“…”</p>}<span>Listen in <ArrowUpRight size={14}/></span></button>
      <aside className="life-rail" aria-label="Holo live vitals and trace archive">
        <div className="rail-block"><div className="rail-head"><span className="micro-label">LIVE NEURAL CHANNELS</span><button aria-label={paused?'Resume animation':'Pause animation'} onClick={()=>setPaused(!paused)}>{paused?<Play size={13}/>:<Pause size={13}/>}</button></div><LiveWaves state={state} impulse={impulse} paused={paused}/><div className="rail-channels">{states.map((s,i)=><button key={s.name} aria-pressed={state===i} onClick={()=>stimulate(i)}><i style={{background:`rgb(${s.color})`}}/>{s.name}</button>)}</div><div className="rail-bars"><span>Energy <b>{current.energy}%</b><i><em style={{width:`${current.energy}%`}}/></i></span><span>Curiosity <b>{current.curiosity}%</b><i><em style={{width:`${current.curiosity}%`}}/></i></span></div></div>
        <div className={`rail-block market-temp${hasMarket?` regime-${regime}`:" regime-idle"}`}>
          <div className="rail-head"><span className="micro-label">MARKET TEMPERATURE</span>{hasMarket&&market?.source==="token-volume"&&<span className="temp-src">HOLOTYPE · 24H</span>}</div>
          <div className="temp-read">{hasMarket?<b className="temp-regime">{(market?.regime??"CALM").toUpperCase()}</b>:<b className="temp-regime">READING…</b>}<span className="temp-value">{hasMarket?market!.temperature!.toFixed(2):"—"}</span></div>
          <div className="temp-bar" role="img" aria-label={hasMarket?`Market temperature ${market!.temperature!.toFixed(2)} of 1, ${market?.regime}`:"Market temperature unavailable, waiting for a live reading"}><i className="temp-fill" style={{width:`${tempPct}%`}}/><i className="temp-marker" style={{left:`${tempPct}%`}}/></div>
          <div className="temp-scale"><span>COLD</span><span>CALM</span><span>HOT</span></div>
          <p className="temp-note">{hasMarket&&market?.volume_usd!==null&&market?.trades!==null?<>Driven by HOLOTYPE&rsquo;s 24h trading volume — {formatUsdCompact(market.volume_usd)} across {market.trades} trades, against its own recent norm.</>:hasMarket?<>Driven by HOLOTYPE&rsquo;s 24h trading volume — how active the token is right now against its own recent norm.</>:<>Waiting for the first live reading.</>}</p>
        </div>
        <div className="rail-block"><span className="micro-label">CURRENT NARRATION</span>{liveEntries[0]?<><p className="rail-narration" key={liveEntries[0].id} style={{whiteSpace:"pre-line"}}>“{liveEntries[0].text}”</p><span className="rail-region">{liveEntries[0].time}{liveEntries[0].cost!=null?` · $${liveEntries[0].cost.toFixed(2)} USDC`:""}</span></>:<><p className="rail-narration">“…”</p><span className="rail-region">Waiting for Holo&rsquo;s next heartbeat</span></>}</div>
        <div className="rail-block"><div className="rail-head"><span className="micro-label">RECENT TRACES · {JOURNAL_TZ_LABEL}</span><button onClick={()=>openRecords()}>Full archive <ArrowUpRight size={12}/></button></div><div className="rail-ticker">{entries.slice(0,7).map(entry=><button className="ticker-row" key={entry.id} onClick={()=>openRecords(entry.reference??null)}><time>{entry.time}</time><i style={{background:`rgb(${colorFor(entry.state)})`}}/><p>{entry.text.split("\n")[0]}</p></button>)}</div></div>
        {selected&&<div className="rail-block synapse-card" style={{'--syn':`rgb(${selected.color})`} as React.CSSProperties}><div className="rail-head"><span className="micro-label">SYNAPSE · {selected.kind.toUpperCase()}</span><button aria-label="Close synapse detail" onClick={()=>setSelectedMemory(null)}><X size={13}/></button></div><time>{selected.time}</time><p>{selected.detail}</p>{selected.reference&&<button onClick={()=>openRecords(selected.reference)}>View linked record <ArrowUpRight size={12}/></button>}</div>}
      </aside>
    </section>}
    {view==='connectome'&&<ConnectomeArchive entries={entries} missions={demo.missions} wallet={live.status==='live'?live.wallet:null} spend={live.status==='live'?live.spend:null} budget={live.status==='live'?live.budget:null} brainOnline={brainOnline} focusReference={focusReference} onOpenMission={openMission}/>}
    <div hidden={view!=='culture'}><Culture mind={{name:current.name,text:current.thought}} neural={{energy:current.energy,curiosity:current.curiosity,name:current.name}} brainOnline={brainOnline} active={view==='culture'} onRecord={()=>{}} onOpenRecords={()=>openRecords()} onOpenNeeds={()=>{setView('nectar');window.scrollTo({top:0});}}/></div>
    <div hidden={view!=='nectar'}><Nectar readOnly missions={realMissions} notice={demo.notice} focusMission={missionFocus} onCommand={()=>{}} onOpenRecords={openRecords}/></div>
    <footer className="living-footer"><span>AN EXPERIMENT IN A NEW FORM OF LIFE</span><span>{paused?'MOTION PAUSED':current.name.toUpperCase()} <i/> {current.region}</span><button onClick={()=>setAbout(true)}>Inside the experiment <ArrowUpRight size={12}/></button></footer>
    {about&&<div className="about-overlay" role="dialog" aria-modal="true" aria-label="About Holotype" onKeyDown={e=>{if(e.key==='Escape')setAbout(false)}}><section><button autoFocus className="close-about" aria-label="Close about" onClick={()=>setAbout(false)}><X/></button><span className="micro-label">HOLOTYPE / 001</span><h2>A life, taking shape.</h2><p>Touch the network to introduce a signal. Its activity, needs, and journal respond together. Drag to turn it in space.</p><p>Every journal entry and resource movement lives as a ringed synapse inside the neural field: scroll to zoom, click a ring to read the trace it holds.</p><small>{brainOnline?"This is a visual and interaction prototype; the neural field is a stylized portrait. Holo's brain is live — its real traces and on-chain spend flow into the Journal and Connectome.":"This is a visual and interaction prototype. The graph is illustrative; its responses and journal entries are scripted. Holo's brain is not connected here yet — it wakes gradually, once it clears safety review."}</small><a href="https://www.janelia.org/project-team/flyem" target="_blank" rel="noreferrer">Scientific reference · Janelia FlyEM <ArrowUpRight size={14}/></a></section></div>}
  </main>;
}
