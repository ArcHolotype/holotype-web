import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { createDemoState, demoReducer, transitionMission, arcSummary, missionDefinition, formatTime, JOURNAL_TZ_LABEL } from '../app/demo-workflow.ts';

const at='2026-09-21T08:00:00Z';
const deliveryFor=m=>({summary:'Compared both services',artifact:'report-01',recipient:'0x0000000000000000000000000000000000000001',evidence:m.criteria.map(c=>`Report evidence for ${c}`),taskHash:'sha256:'+createHash('sha256').update(missionDefinition(m)).digest('hex'),submittedAt:at});
const dispatch=(state,command)=>demoReducer(state,{type:'mission',id:'N-021',command,at});

test('claim, deliver, check and approve share events and reservations without settling',()=>{
  let state=createDemoState();
  const initial=arcSummary(state.missions);
  state=dispatch(state,{type:'claim'});
  assert.equal(arcSummary(state.missions).reserved,initial.reserved+40);
  state=dispatch(state,{type:'submit',delivery:deliveryFor(state.missions[0])});
  assert.equal(state.missions[0].status,'submitted');
  state=dispatch(state,{type:'check'});
  assert.equal(state.missions[0].status,'approval_pending');
  state=dispatch(state,{type:'approve'});
  assert.equal(state.missions[0].status,'approved');
  assert.deepEqual(arcSummary(state.missions),{balance:588,reserved:62,available:526});
  assert.equal(state.entries.length,4);
  assert.equal(new Set(state.entries.map(e=>e.id)).size,4);
  assert.ok(state.entries.every(e=>e.reference==='N-021'));
  assert.match(state.entries[0].text,/unpaid/);
  // Duplicate approval must not add an event or change available funds.
  const repeated=dispatch(state,{type:'approve'});
  assert.deepEqual(repeated.entries,state.entries);
  assert.deepEqual(repeated.missions,state.missions);
});

test('approval cannot bypass submission and incomplete delivery cannot advance',()=>{
  const m=createDemoState().missions[0];
  assert.throws(()=>transitionMission(m,{type:'approve'},at));
  const claimed=transitionMission(m,{type:'claim'},at);
  for(const patch of [{summary:''},{artifact:''},{evidence:[]},{recipient:'wrong'},{taskHash:''}]){
    assert.throws(()=>transitionMission(claimed,{type:'submit',delivery:{...deliveryFor(m),...patch}},at));
  }
  assert.throws(()=>transitionMission(claimed,{type:'check'},at));
});

test('return requires a reason and resubmission requires a fresh review',()=>{
  let m=createDemoState().missions[1];
  assert.throws(()=>transitionMission(m,{type:'return',note:' '},at));
  m=transitionMission(m,{type:'return',note:'Please supply reproducible evidence'},at);
  assert.equal(m.status,'changes_requested');
  assert.throws(()=>transitionMission(m,{type:'approve'},at));
  m=transitionMission(m,{type:'submit',delivery:deliveryFor(m)},at);
  assert.equal(m.status,'submitted');
  assert.equal(m.reviewNote,undefined);
  assert.throws(()=>transitionMission(m,{type:'approve'},at));
});

test('release restores available funds and input/action records retain their common reference',()=>{
  let state=createDemoState();
  const summary=arcSummary(state.missions);
  state=dispatch(state,{type:'claim'});state=dispatch(state,{type:'release'});
  assert.deepEqual(arcSummary(state.missions),summary);
  for(const kind of ['Input','Action']) state=demoReducer(state,{type:'record',kind,text:kind,reference:'HOLO-001',at});
  assert.equal(state.entries.filter(e=>e.reference==='HOLO-001').length,2);
});

test('journal times are fixed UTC-7, not the visitor’s local zone',()=>{
  assert.equal(JOURNAL_TZ_LABEL,'UTC-7');
  assert.equal(formatTime('2026-09-21T08:00:00Z'),'01:00:00');
  assert.equal(formatTime('2026-09-21T00:04:18Z'),'17:04:18'); // previous UTC day rolls back
});
