export type JournalEntry = { id:number; time:string; text:string; state:string; reference?:string; cost?:number|null; tx_hash?:string|null };
export type MissionStatus = 'open' | 'claimed' | 'submitted' | 'approval_pending' | 'changes_requested' | 'approved' | 'completed';
export type Delivery = { summary:string; artifact:string; recipient:string; evidence:string[]; taskHash:string; submittedAt:string };
export type Mission = {
  id:string; kind:string; title:string; description:string; rewardCents:number; criteria:string[];
  status:MissionStatus; delivery?:Delivery; reviewNote?:string; updatedAt:string; txHash?:string|null;
};
export type MissionCommand = { type:'claim'|'release'|'check'|'approve' } | { type:'return'; note:string } | { type:'submit'; delivery:Delivery };
export type DemoState = { missions:Mission[]; entries:JournalEntry[]; notice:string };
export type DemoAction = { type:'record'; text:string; kind:string; reference?:string; at:string } | { type:'mission'; id:string; command:MissionCommand; at:string };

export const statusLabels:Record<MissionStatus,string> = {
  open:'Open', claimed:'Claimed', submitted:'Submitted', approval_pending:'Awaiting approval',
  changes_requested:'Changes requested', approved:'Approved · unpaid', completed:'Completed · demo',
};
export const money = (cents:number) => (cents/100).toFixed(2);
/** Journal clock: fixed UTC-7, no DST shift, so a trace reads the same for every visitor. */
export const JOURNAL_TZ_LABEL = 'UTC-7';
/** Brain link state. False until the mind heartbeat is live and wired to the site; then the badges read online. */
export const BRAIN_ONLINE = false;
export const BRAIN_STATUS = BRAIN_ONLINE ? 'BRAIN ONLINE' : 'BRAIN DORMANT';
export const formatTime = (at:string) => new Date(Date.parse(at) - 7*3600*1000).toISOString().slice(11,19);
export function missionDefinition(m:Mission):string {
  return JSON.stringify({id:m.id,title:m.title,description:m.description,rewardCents:m.rewardCents,chain:'Arc',criteria:m.criteria});
}

export function createDemoState(entries:JournalEntry[] = []):DemoState {
  return {entries,notice:'',missions:[
    {id:'N-021',kind:'KNOWLEDGE',title:'A clearer picture of the world.',description:'Compare two inference services so I can decide where to spend my next thought.',rewardCents:40,criteria:['Two callable inference endpoints','Documented price and latency','A sample response and reproducible evidence'],status:'open',updatedAt:'2026-09-21T00:04:18Z'},
    {id:'N-018',kind:'VERIFICATION',title:'Help me trust what I remember.',description:'Check a neural-state export against its manifest and report any mismatch.',rewardCents:22,criteria:['Recompute the manifest hash','Validate all declared fields','Return a pass/fail report with evidence'],status:'approval_pending',updatedAt:'2026-09-21T00:03:51Z',delivery:{summary:'Sample delivery: neural-state export checked against its manifest.',artifact:'demo://N-018/manifest-report',recipient:'0x0000000000000000000000000000000000000001',evidence:['Sample report lists source digests and recomputed values; no real file is available to verify independently.','Sample field table records each declared field and its check result.','Sample report lists conclusions and references per field.'],taskHash:'',submittedAt:'2026-09-21T00:03:51Z'}},
    {id:'N-014',kind:'OBSERVATION',title:'Tell me what changed.',description:'Describe the recorded activity without adding events that did not happen.',rewardCents:12,criteria:['Use only the provided event record','Reference event identifiers','Separate observations from interpretation'],status:'completed',updatedAt:'2026-09-21T00:02:05Z'},
  ]};
}

const validDelivery = (m:Mission,d:Delivery) => d.summary.trim().length>0 && d.summary.length<=2000 &&
  d.artifact.trim().length>0 && d.artifact.length<=500 && /^0x[0-9a-fA-F]{40}$/.test(d.recipient) &&
  /^sha256:[0-9a-f]{64}$/.test(d.taskHash) && d.evidence.length===m.criteria.length &&
  d.evidence.every(e=>e.trim().length>0 && e.length<=2000);

/** Local rehearsal only: no command here can settle, transfer, or call a service. */
export function transitionMission(m:Mission,c:MissionCommand,at:string):Mission {
  const next={...m,updatedAt:at};
  switch(c.type){
    case 'claim':
      if(m.status==='open') return {...next,status:'claimed'};
      break;
    case 'release':
      if(m.status==='claimed') return {...next,status:'open'};
      break;
    case 'submit':
      if((m.status==='claimed'||m.status==='changes_requested') && validDelivery(m,c.delivery))
        return {...next,status:'submitted',delivery:{...c.delivery,submittedAt:at},reviewNote:undefined};
      break;
    case 'check':
      if(m.status==='submitted' && m.delivery && validDelivery(m,m.delivery)) return {...next,status:'approval_pending'};
      break;
    case 'approve':
      if(m.status==='approval_pending' && m.delivery) return {...next,status:'approved',reviewNote:'Local human review approved; unpaid.'};
      break;
    case 'return':
      if(m.status==='approval_pending' && c.note.trim() && c.note.length<=1000)
        return {...next,status:'changes_requested',reviewNote:c.note.trim()};
  }
  throw new Error('That action is not valid in the current status, or the delivery is incomplete. Check it and try again.');
}

function appendEntry(state:DemoState,text:string,kind:string,at:string,reference?:string):JournalEntry[] {
  return [{id:Math.max(Date.parse(at),...state.entries.map(e=>e.id+1),1),time:formatTime(at),text,state:kind,reference},...state.entries];
}

export function demoReducer(state:DemoState,action:DemoAction):DemoState {
  if(action.type==='record') return {...state,entries:appendEntry(state,action.text,action.kind,action.at,action.reference)};
  const original=state.missions.find(m=>m.id===action.id);
  if(!original) return {...state,notice:'No such mission.'};
  try {
    const mission=transitionMission(original,action.command,action.at);
    const descriptions:Record<MissionCommand['type'],string>={
      claim:'Claimed locally', release:'Local claim released', submit:'Delivery submitted',
      check:'Completeness check passed; delivery contents not verified', approve:'Human review approved; unpaid',
      return:`Returned for changes: ${mission.reviewNote??''}`,
    };
    const deliveryDetail=action.command.type==='submit'&&mission.delivery
      ? `\nArtifact: ${mission.delivery.artifact}\nSummary: ${mission.delivery.summary}\n${mission.delivery.evidence.map((e,i)=>`${i+1}. ${e}`).join('\n')}\nTask digest: ${mission.delivery.taskHash}` : '';
    const text=`${mission.id} · ${descriptions[action.command.type]} → ${statusLabels[mission.status]}${deliveryDetail}`;
    return {missions:state.missions.map(m=>m.id===mission.id?mission:m),entries:appendEntry(state,text,'Mission',action.at,mission.id),notice:text};
  } catch(error) {
    return {...state,notice:error instanceof Error?error.message:'Action did not complete. Try again.'};
  }
}

export function arcSummary(missions:Mission[]){
  const spent=missions.filter(m=>m.status==='completed').reduce((n,m)=>n+m.rewardCents,0);
  const reserved=missions.filter(m=>['claimed','submitted','approval_pending','changes_requested','approved'].includes(m.status)).reduce((n,m)=>n+m.rewardCents,0);
  return {balance:600-spent,reserved,available:600-spent-reserved};
}
