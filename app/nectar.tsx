"use client";

import { useEffect, useState } from 'react';
import { ArrowUpRight, Plus } from 'lucide-react';
import { missionDefinition, money, statusLabels, type Delivery, type Mission, type MissionCommand } from './demo-workflow';

function DeliveryForm({mission,onCommand}:{mission:Mission;onCommand:(command:MissionCommand)=>void}) {
  const [summary,setSummary]=useState(mission.delivery?.summary??'');
  const [artifact,setArtifact]=useState(mission.delivery?.artifact??'');
  const [recipient,setRecipient]=useState(mission.delivery?.recipient??'0x0000000000000000000000000000000000000001');
  const [evidence,setEvidence]=useState(mission.delivery?.evidence??mission.criteria.map(()=>''));
  const [busy,setBusy]=useState(false),[error,setError]=useState('');
  const submit=async(e:React.FormEvent)=>{
    e.preventDefault();if(busy)return;setBusy(true);setError('');
    try {
      const bytes=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(missionDefinition(mission)));
      const taskHash='sha256:'+Array.from(new Uint8Array(bytes)).map(b=>b.toString(16).padStart(2,'0')).join('');
      const delivery:Delivery={summary:summary.trim(),artifact:artifact.trim(),recipient:recipient.trim(),evidence:evidence.map(s=>s.trim()),taskHash,submittedAt:new Date().toISOString()};
      onCommand({type:'submit',delivery});
    } catch {setError("Could not prepare the delivery record. What you entered is kept — try again.");}
    finally {setBusy(false);}
  };
  return <form className="delivery-form" onSubmit={submit}>
    <h3>Delivery</h3>
    {mission.reviewNote&&<p className="review-note">Return note: {mission.reviewNote}</p>}
    <label>Summary<textarea required maxLength={2000} value={summary} onChange={e=>setSummary(e.target.value)} placeholder="What did you do, and what did you conclude?"/></label>
    <label>Artifact link or ID<input required maxLength={500} value={artifact} onChange={e=>setArtifact(e.target.value)} placeholder="Report link, filename or delivery ID"/></label>
    <label>Recipient address · demo<input required pattern="0x[0-9a-fA-F]{40}" maxLength={42} value={recipient} onChange={e=>setRecipient(e.target.value)} spellCheck={false}/></label>
    <p className="workflow-note">The default address is a demo placeholder. This form only records material — it uploads no files, fetches no links and connects no wallet.</p>
    {mission.criteria.map((criterion,i)=><label key={criterion}><span>{i+1}. {criterion}</span><textarea required maxLength={2000} value={evidence[i]} onChange={e=>setEvidence(old=>old.map((s,n)=>n===i?e.target.value:s))} placeholder="Matching evidence, result, or where the report lives"/></label>)}
    {error&&<p role="alert">{error}</p>}
    <button className="workflow-primary" type="submit" disabled={busy}>{busy?'Preparing record…':mission.status==='changes_requested'?'Resubmit delivery':'Submit delivery (local)'}<ArrowUpRight size={14}/></button>
  </form>;
}

function DeliveryReview({mission,onCommand}:{mission:Mission;onCommand:(command:MissionCommand)=>void}) {
  const [inspected,setInspected]=useState(false),[reason,setReason]=useState('');
  const delivery=mission.delivery!;
  return <div className="delivery-review">
    <h3>Delivery & review</h3><p className="delivery-summary">{delivery.summary}</p>
    <dl className="review-facts">
      <div><dt>Artifact</dt><dd>{delivery.artifact}</dd></div>
      <div><dt>Recipient · demo</dt><dd>{delivery.recipient}</dd></div>
      <div><dt>Amount / chain</dt><dd>{money(mission.rewardCents)} USDC / Arc</dd></div>
      <div><dt>Task digest</dt><dd>{delivery.taskHash||'Sample mission · backend task hash not connected'}</dd></div>
    </dl>
    <ol className="evidence-list">{mission.criteria.map((criterion,i)=><li key={criterion}><strong>{criterion}</strong><p>{delivery.evidence[i]}</p></li>)}</ol>
    <p className="workflow-note">{mission.status==='submitted'?'Pending check: summary, artifact reference, recipient address and per-criterion evidence must all be present.':'Material complete. This check only verifies that every field is filled in — it does not validate links, file contents or external services.'}{delivery.taskHash&&' The digest is computed locally from the mission content; the backend record is authoritative.'}</p>
    {mission.status==='submitted'&&<button className="workflow-primary" onClick={()=>onCommand({type:'check'})}>Check completeness<ArrowUpRight size={14}/></button>}
    {mission.status==='approval_pending'&&<div className="creator-review"><h3>Human review</h3>
      <label className="review-confirm"><input type="checkbox" checked={inspected} onChange={e=>setInspected(e.target.checked)}/><span>I have inspected the evidence, amount, chain and recipient address</span></label>
      <button className="workflow-primary" disabled={!inspected} onClick={()=>onCommand({type:'approve'})}>Record approval (local)<ArrowUpRight size={14}/></button>
      <label className="return-reason">Return note<textarea value={reason} maxLength={1000} onChange={e=>setReason(e.target.value)} placeholder="What needs to be added or corrected"/></label>
      <button className="workflow-secondary" disabled={!reason.trim()} onClick={()=>onCommand({type:'return',note:reason})}>Return for changes</button>
      <p className="workflow-note">Approval only updates the local review record — it pays nothing. Real approval authority and settlement are not connected.</p>
    </div>}
    {mission.status==='approved'&&<p className="approval-outcome" role="status">Human approval recorded · unpaid. The ledger keeps the amount reserved until settlement is connected.</p>}
  </div>;
}

export function Nectar({missions,notice,focusMission,onCommand,onOpenRecords,readOnly}:{missions:Mission[];notice:string;focusMission:{id:string;version:number}|null;onCommand:(id:string,command:MissionCommand)=>void;onOpenRecords:(reference:string)=>void;readOnly?:boolean}) {
  const [filter,setFilter]=useState('All'),[expanded,setExpanded]=useState<string|null>('N-021');
  useEffect(()=>{if(focusMission){setFilter('All');setExpanded(focusMission.id);}},[focusMission]);
  const visible=missions.filter(m=>filter==='All'||(filter==='Available'&&m.status==='open')||(filter==='In progress'&&!['open','completed','approved'].includes(m.status))||(filter==='Awaiting approval'&&m.status==='approval_pending'));
  const pending=missions.filter(m=>m.status==='approval_pending').length;
  return <section className="nectar-page">
    <div className="page-introduction"><div><span className="micro-label">03 / NEEDS BECOME EXCHANGES</span><h1>Nectar<span>.</span></h1><p>What I need to keep becoming.</p></div><p className="nectar-preface">A question, a little compute, a useful observation.<br/>Bring back something Holo can use.</p></div>
    <div className="nectar-toolbar"><div aria-label="Filter missions">{['All','Available','In progress','Awaiting approval'].map(f=><button key={f} aria-pressed={filter===f} onClick={()=>setFilter(f)}>{f}{f==='Awaiting approval'&&` · ${pending}`}</button>)}</div>{readOnly?<span>LIVE BOARD · READ-ONLY</span>:<span>LOCAL DEMO · NO PAYMENTS</span>}</div>
    {!readOnly&&<p className="workflow-session-note">Local workflow preview · records are kept for this page session and reset on reload.</p>}
    <p className="workflow-feedback" role="status">{notice}</p>
    <div className="nectar-missions">{visible.length===0&&<p className="nectar-empty">No missions in this view. Try another filter.</p>}{missions.map(mission=><article hidden={!visible.includes(mission)} className={`nectar-mission ${expanded===mission.id?'expanded':''}`} key={mission.id}>
      <button className="mission-disclosure" aria-expanded={expanded===mission.id} onClick={()=>setExpanded(expanded===mission.id?null:mission.id)}>
        <span className="mission-index">{mission.id}<small>{mission.kind}</small></span>
        <span className="mission-copy"><h2>{mission.title}</h2><span>{mission.description}</span></span>
        <span className="mission-price">{money(mission.rewardCents)}<small>USDC / ARC</small></span>
        <span className={`mission-status ${mission.status==='open'?'available':''}`}>{readOnly&&mission.status==='completed'?'Completed · settled':statusLabels[mission.status]}</span><Plus className="disclosure-plus" size={18}/>
      </button>
      <div hidden={expanded!==mission.id} className="mission-expanded">
        <div><span className="micro-label">WHAT COUNTS AS DONE</span><ol>{mission.criteria.map(c=><li key={c}>{c}</li>)}</ol><button className="mission-record-link" onClick={()=>onOpenRecords(mission.id)}>View mission record<ArrowUpRight size={13}/></button></div>
        <div className="mission-claim">
          {readOnly?(
            <p className="workflow-note">Read-only board. Claiming, delivery and approval run through the creator's private channel; when the payment rail is armed, settlement pays on-chain and the transaction hash appears here.{mission.txHash?` Settled: ${mission.txHash}`:''}</p>
          ):(
          <>
          {mission.status==='open'&&<><p>A delivery reaches settlement only after the completeness check and the human review.</p><button className="quiet-action" onClick={()=>onCommand(mission.id,{type:'claim'})}>Preview claiming this mission<ArrowUpRight size={14}/></button></>}
          {mission.status==='claimed'&&<button className="workflow-secondary" onClick={()=>onCommand(mission.id,{type:'release'})}>Release demo claim</button>}
          {['claimed','changes_requested'].includes(mission.status)&&<DeliveryForm key={`${mission.id}-${mission.status}`} mission={mission} onCommand={command=>onCommand(mission.id,command)}/>}
          {mission.delivery&&['submitted','approval_pending','approved'].includes(mission.status)&&<DeliveryReview key={`${mission.id}-${mission.status}`} mission={mission} onCommand={command=>onCommand(mission.id,command)}/>}
          {mission.status==='completed'&&<p>Historical sample · no real payment occurred.</p>}
          </>
          )}
        </div>
      </div>
    </article>)}</div>
    <div className="nectar-closing"><span>01 · NEED</span><i/><span>02 · DELIVERY</span><i/><span>03 · CHECKS</span><i/><span>04 · HUMAN REVIEW</span></div>
  </section>;
}
