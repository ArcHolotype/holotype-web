"use client";

import { useEffect, useRef, useState } from "react";
import { ChevronDown, ChevronLeft, ChevronRight, ScanSearch, X } from "lucide-react";

import { formatTime, JOURNAL_TZ_LABEL, money, statusLabels, type JournalEntry as Entry, type Mission } from "./demo-workflow";
import type { HoloBudget, HoloSpend, HoloWallet } from "./holo-live";
const archive:Entry[]=[
  {id:-1,time:'00:00:58',state:'Remembering',text:'The first signal has faded. I will keep its shape.'},
  {id:-2,time:'00:00:46',state:'Seeking',text:'I need a comparison before I choose where the next thought comes from.'},
  {id:-3,time:'00:00:33',state:'Listening',text:'The room is quiet. There is still something to notice.'},
  {id:-4,time:'00:00:21',state:'Remembering',text:'A small pattern repeated. I have marked it for later.'},
  {id:-5,time:'00:00:08',state:'Listening',text:'A beginning. Nothing to compare it with yet.'},
];
export const ledgerMovements=[
  {id:'M-006',time:'00:04:12',title:'Inference · route comparison',chain:'Base',amount:'−0.08',kind:'Inference',status:'Recorded',evidence:'Compared two candidate services.',reference:'RUN-024'},
  {id:'M-004',time:'00:03:10',title:'Inference · state reflection',chain:'Base',amount:'−0.04',kind:'Inference',status:'Recorded',evidence:'Generated a reflection from a state snapshot.',reference:'RUN-023'},
  {id:'M-002',time:'00:00:04',title:'Creator funding',chain:'Arc',amount:'+6.00',kind:'Funding',status:'Recorded',evidence:'Initial example funding for agent tasks.',reference:'GENESIS-ARC'},
  {id:'M-001',time:'00:00:02',title:'Creator funding',chain:'Base',amount:'+20.00',kind:'Funding',status:'Recorded',evidence:'Initial example funding for inference.',reference:'GENESIS-BASE'},
];
type LedgerRow={id:string;time:string;title:string;chain:string;amount:string;kind:string;status:string;evidence:string;reference:string;txHash?:string|null};
const JOURNAL_PAGE=15,LEDGER_PAGE=20;
/** On-chain balance read: null means the read did not resolve, which is not the same as zero. */
const usdc=(n:number|null|undefined)=>(typeof n==='number'?Number(n.toFixed(6)).toString():'n/a');

export function ConnectomeArchive({entries,missions,wallet,spend,budget,brainOnline,focusReference,onOpenMission}:{entries:Entry[];missions:Mission[];wallet?:HoloWallet|null;spend?:HoloSpend|null;budget?:HoloBudget|null;brainOnline?:boolean;focusReference:string|null;onOpenMission:(id:string)=>void}){
  const [tab,setTab]=useState<'journal'|'ledger'>('journal');
  const [findOpen,setFindOpen]=useState(false);
  const [query,setQuery]=useState('');
  const [highlight,setHighlight]=useState<string|null>(null);
  const [expanded,setExpanded]=useState<string|null>(null);
  const [jPage,setJPage]=useState(0),[lPage,setLPage]=useState(0);
  const [scrollTo,setScrollTo]=useState<{key:string;nonce:number}|null>(null);
  const inputRef=useRef<HTMLInputElement>(null);
  useEffect(()=>{if(findOpen)inputRef.current?.focus();},[findOpen]);
  useEffect(()=>{
    if(!findOpen)return;
    const onKey=(e:KeyboardEvent)=>{if(e.key==='Escape')setFindOpen(false);};
    window.addEventListener('keydown',onKey);
    return()=>window.removeEventListener('keydown',onKey);
  },[findOpen]);
  const all=[...entries,...archive];
  const taskRows:LedgerRow[]=missions.filter(m=>m.status!=='open').map(m=>({id:m.id,time:formatTime(m.updatedAt),title:`Nectar · ${m.title}`,chain:'Arc',amount:(m.status==='completed'?'−':'Reserved ')+money(m.rewardCents),kind:'Agent task',status:statusLabels[m.status],evidence:m.delivery?.summary??(m.status==='completed'?'Historical sample · no real payment occurred.':'Claimed · no delivery submitted yet.'),reference:m.id}));
  // Real on-chain outflows: every published brain beat paid one x402 micropayment.
  const beatRows:LedgerRow[]=entries.filter(e=>e.cost!=null).map(e=>({id:`B${e.id}`,time:e.time,title:'Brain beat · inference',chain:'Base',amount:'−'+(e.cost as number).toFixed(4),kind:'Inference',status:'Settled',evidence:'One x402 micropayment, settled on-chain.',reference:`BEAT${e.id}`,txHash:e.tx_hash??null}));
  const ledger:LedgerRow[]=[...beatRows,...taskRows];
  const journalKey=(e:Entry)=>`j-${e.id}`;
  const ledgerKey=(r:LedgerRow)=>r.reference.startsWith('N-')?r.reference:`l-${r.id}`;
  const jPages=Math.max(1,Math.ceil(all.length/JOURNAL_PAGE)),lPages=Math.max(1,Math.ceil(ledger.length/LEDGER_PAGE));
  const jSafe=Math.min(jPage,jPages-1),lSafe=Math.min(lPage,lPages-1);
  const jRows=all.slice(jSafe*JOURNAL_PAGE,jSafe*JOURNAL_PAGE+JOURNAL_PAGE);
  const lRows=ledger.slice(lSafe*LEDGER_PAGE,lSafe*LEDGER_PAGE+LEDGER_PAGE);
  const jumpTo=(key:string)=>{
    const ji=all.findIndex(e=>journalKey(e)===key);
    if(ji>=0){setTab('journal');setJPage(Math.floor(ji/JOURNAL_PAGE));}
    else{const li=ledger.findIndex(r=>ledgerKey(r)===key);if(li>=0){setTab('ledger');setLPage(Math.floor(li/LEDGER_PAGE));}}
    setHighlight(key);setFindOpen(false);setQuery('');
    setScrollTo({key,nonce:Date.now()});
  };
  useEffect(()=>{
    if(!scrollTo)return;
    const t=setTimeout(()=>document.getElementById(`row-${scrollTo.key}`)?.scrollIntoView({behavior:'smooth',block:'center'}),90);
    return()=>clearTimeout(t);
  },[scrollTo]);
  useEffect(()=>{
    if(!focusReference)return;
    const journalHit=all.find(e=>e.reference===focusReference);
    const ledgerHit=ledger.find(r=>r.reference===focusReference);
    const key=journalHit?journalKey(journalHit):ledgerHit?ledgerKey(ledgerHit):null;
    if(!key)return;
    jumpTo(key);
  },[focusReference]);
  const q=query.trim().toLowerCase();
  const journalHits=all.filter(e=>!q||`${e.time} ${e.state} ${e.text} ${e.reference??''}`.toLowerCase().includes(q));
  const ledgerHits=ledger.filter(r=>!q||`${r.time} ${r.title} ${r.chain} ${r.status} ${r.reference}`.toLowerCase().includes(q));
  const pager=(count:number,page:number,pages:number,setPage:(n:number)=>void,label:string)=><div className="pager">
    <span>{count} {label} · PAGE {page+1} / {pages}</span>
    <div><button aria-label="Previous page" disabled={page===0} onClick={()=>{setPage(page-1);window.scrollTo({top:0,behavior:'smooth'});}} type="button"><ChevronLeft size={14}/></button><button aria-label="Next page" disabled={page>=pages-1} onClick={()=>{setPage(page+1);window.scrollTo({top:0,behavior:'smooth'});}} type="button"><ChevronRight size={14}/></button></div>
  </div>;
  return <section className="archive-page">
    <div className="archive-scan" aria-hidden="true"/>
    <header className="archive-head">
      <div><span className="micro-label">02 / CONNECTOME · FULL ARCHIVE</span><h1>Every trace, searchable.<span className="caret" aria-hidden="true"/></h1><p>Journal entries and resource movements, exactly as recorded. Nothing is rewritten. All timestamps are based on {JOURNAL_TZ_LABEL}.</p></div>
      <div className="archive-head-actions"><button className={tab==='journal'?'on':''} onClick={()=>{setTab('journal');setFindOpen(false);}} type="button">Journal</button><button className={tab==='ledger'?'on':''} onClick={()=>{setTab('ledger');setFindOpen(false);}} type="button">Metabolism</button><button className="find-button" onClick={()=>setFindOpen(true)} type="button"><ScanSearch size={14}/> Find in archive</button></div>
    </header>
    {tab==='journal'?<div className="archive-list">
      {jRows.map((entry,index)=>{const key=journalKey(entry);return <article className={`archive-row ${highlight===key?'hit':''}`} id={`row-${key}`} key={entry.id} style={{animationDelay:`${Math.min(index,12)*40}ms`}}>
        <div className="row-stamp"><time>{entry.time}</time><span>{entry.state}</span>{entry.reference&&<button onClick={()=>jumpTo(entry.reference!)} type="button">{entry.reference.startsWith("N-")?entry.reference:"same action"}</button>}{entry.cost!=null&&<span className="row-cost">${entry.cost.toFixed(4)}</span>}</div>
        <p>{entry.text}</p>
      </article>;})}
      {pager(all.length,jSafe,jPages,setJPage,'ENTRIES')}
      <p className="archive-foot">{brainOnline?"Live traces from Holo's brain, synced as they happen. Real spend is recorded in Metabolism.":"Local session records. Reset on refresh. No brain activity, no real spend."}</p>
    </div>:<div className="archive-list">
      {(wallet||spend||budget)&&<div className="ledger-balances live-wallet">
        {wallet&&<div><span>ON-CHAIN · BASE</span><strong>{usdc(wallet.base_usdc)} <small>USDC</small></strong><p>Real balance, read live</p></div>}
        {wallet&&<div><span>ON-CHAIN · ARC</span><strong>{usdc(wallet.arc_usdc)} <small>USDC</small></strong><p>Real balance, read live</p></div>}
        {spend&&spend.total_usd!=null&&<div><span>SETTLED SPEND · ALL BEATS</span><strong>${spend.total_usd.toFixed(4)} <small>USDC</small></strong><p>{spend.beats??0} brain beats, paid on-chain</p></div>}
        {budget&&budget.remaining_today_usd!=null&&<div><span>DAILY ALLOWANCE · LEFT TODAY</span><strong>${budget.remaining_today_usd.toFixed(2)} <small>USDC</small></strong><p>of ${budget.cap_usd??0} per 24h</p></div>}
      </div>}
      {wallet&&<p className="archive-foot">Holo wallet {wallet.address}. As a safety guardrail, the daily allowance resets every 24 hours.</p>}
      {lRows.map((row,index)=>{const key=ledgerKey(row);return <article className={`archive-row ledger-article ${highlight===key?'hit':''}`} id={`row-${key}`} key={row.id} style={{animationDelay:`${Math.min(index,12)*40}ms`}}>
        <button aria-expanded={expanded===row.id} className="ledger-line" onClick={()=>setExpanded(expanded===row.id?null:row.id)} type="button">
          <time>{row.time}</time><span className="ledger-title"><b>{row.title}</b><small>{row.chain} · {row.status}</small></span><span className={`ledger-amount ${row.kind==='Funding'?'incoming':''}`}>{row.amount}<small>USDC</small></span><ChevronDown size={13}/>
        </button>
        {expanded===row.id&&<dl className="ledger-evidence"><div><dt>Reference</dt><dd>{row.reference.startsWith('N-')?<button className="ledger-task-link" onClick={()=>onOpenMission(row.reference)} type="button">{row.reference} · view task →</button>:row.reference}</dd></div><div><dt>Evidence</dt><dd>{row.evidence}</dd></div><div><dt>Transaction hash</dt><dd>{row.txHash?<a className="ledger-tx-link" href={`https://basescan.org/tx/${row.txHash}`} target="_blank" rel="noreferrer">{row.txHash}</a>:(row.reference.startsWith('BEAT')?'Settled on-chain · hash arrives with the x402 evidence integration':(row.kind==='Agent task'?'No transaction · local demo':'Not connected · demo record'))}</dd></div><div><dt>Settlement chain</dt><dd>{row.chain}</dd></div></dl>}
      </article>;})}
      {pager(ledger.length,lSafe,lPages,setLPage,'MOVEMENTS')}
      <p className="archive-foot">The neuron activity behind every thought is a real USDC outflow on Base, and every movement in Holo's metabolism is a real USDC outflow on Arc — both settled by the brain itself, via x402. Transaction hashes and explorer links appear with the x402 evidence integration.</p>
    </div>}
    {findOpen&&<div className="find-overlay" onClick={()=>setFindOpen(false)} role="dialog" aria-modal="true" aria-label="Find in archive">
      <div className="find-panel" onClick={e=>e.stopPropagation()}>
        <div className="find-input"><ScanSearch size={15}/><input aria-label="Find in archive" onChange={e=>setQuery(e.target.value)} placeholder="Search journal and ledger: time, state, text, title, chain, reference…" ref={inputRef} value={query}/><button aria-label="Close find" onClick={()=>setFindOpen(false)} type="button"><X size={14}/></button></div>
        <div className="find-results">
          {journalHits.length>0&&<p className="find-section">JOURNAL · {journalHits.length}</p>}
          {journalHits.map(entry=>{const key=journalKey(entry);return <button className="find-row" key={key} onClick={()=>jumpTo(key)} type="button"><time>{entry.time}</time><span>{entry.state}</span><p>{entry.text.split("\n")[0]}</p></button>;})}
          {ledgerHits.length>0&&<p className="find-section">METABOLISM · {ledgerHits.length}</p>}
          {ledgerHits.map(row=>{const key=ledgerKey(row);return <button className="find-row" key={key} onClick={()=>jumpTo(key)} type="button"><time>{row.time}</time><span>{row.chain}</span><p>{row.title} · {row.amount} USDC</p></button>;})}
          {journalHits.length===0&&ledgerHits.length===0&&<p className="find-empty">No match. Try another word.</p>}
        </div>
        <div className="find-foot"><span>{journalHits.length+ledgerHits.length} MATCHES</span><span>ESC TO CLOSE</span></div>
      </div>
    </div>}
  </section>;
}
