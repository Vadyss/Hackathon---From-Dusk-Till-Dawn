import assert from 'node:assert/strict';
import { readFileSync, writeFileSync } from 'node:fs';

const base=process.argv[2] || 'http://localhost:3000';
const phase=process.argv[3] || 'controls';
const path=phase==='restart'?'Docs/integration/restart.json':'Docs/integration/rest_controls.json';
const checks=[];
const request=async (url, method='GET', body)=> {
 const response=await fetch(base+'/api'+url,{method,...(body?{headers:{'Content-Type':'application/json'},body:JSON.stringify(body)}:{})});
 const data=await response.json(); return {status:response.status,data};
};
const save=extra=>writeFileSync(path,JSON.stringify({base,phase,checks,...extra},null,2)+'\n');
const check=(name,proof)=> {checks.push({name,status:'PASS',proof});console.log(name+': PASS');save({});};
const events=async id=> {const r=await request(`/runs/${id}/events`);assert.equal(r.status,200);return r.data.events;};
async function pending(label) {
 const created=await request('/runs','POST',{request:'Chci zachytit brute force na SSH.'});
 assert.equal(created.status,202); const id=created.data.run_id;
 const second=await request('/runs','POST',{request:'Chci zachytit password spraying na SSH.'});
 assert.equal(second.status,409);assert.equal(second.data.error.code,'RUN_ALREADY_ACTIVE');
 const end=Date.now()+1500000;
 while(Date.now()<end) {
  const result=await events(id);const last=result.at(-1)?.type;
  if(last==='awaiting_approval') {writeFileSync(`Docs/integration/${label}_before.json`,JSON.stringify({events:result},null,2)+'\n');return id;}
  if(last==='run_failed') throw new Error(`Control run failed: ${result.at(-1).data.reason_code}`);
  await new Promise(resolve=>setTimeout(resolve,2000));
 }
 throw new Error('Control run timeout.');
}
if(phase==='restart') {
 const previous=JSON.parse(readFileSync('Docs/integration/before_restart.json','utf8'));
 const list=await request('/runs');assert.equal(list.status,200);assert.deepEqual(list.data.runs,[]);
 for(const id of previous.run_ids) {const r=await request(`/runs/${id}/events`);assert.equal(r.status,404);assert.equal(r.data.error.code,'RUN_NOT_FOUND');}
 const skills=await request('/skills');assert.equal(skills.status,200);
 assert.deepEqual(skills.data.skills,previous.skills);
 check('restart_preserves_skills_and_forgets_runs',{old_run_ids:previous.run_ids,skills:skills.data.skills.map(s=>s.name)});
 save({status:'PASS',phase,checks});
} else {
 const live=JSON.parse(readFileSync('Docs/integration/browser_live.json','utf8'));
 assert.equal(live.status,'PASS');
 for(const {run_id:id} of live.runs) {
  const full=await events(id);
  assert.ok(full.every((e,i)=>e.seq===i+1 && e.run_id===id && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(e.timestamp)));
  const incremental=await request(`/runs/${id}/events?after_seq=2`);assert.equal(incremental.status,200);assert.deepEqual(incremental.data.events,full.filter(e=>e.seq>2));
  const invalid=await request(`/runs/${id}/events?after_seq=no`);assert.equal(invalid.status,400);assert.equal(invalid.data.error.code,'INVALID_REQUEST');
  const audio=await request(`/runs/${id}/audio`);assert.equal(audio.status,404);assert.equal(audio.data.error.code,'AUDIO_NOT_FOUND');
 }
 check('events_after_seq_timestamps_audio_without_voice',{run_ids:live.runs.map(r=>r.run_id)});
 const rejected=await pending('rejection');
 const rejection=await request(`/runs/${rejected}/reject`,'POST',{reason:'Integrační ověření zamítnutí.'});
 assert.equal(rejection.status,200);assert.deepEqual(rejection.data,{status:'rejected'});
 assert.equal((await events(rejected)).at(-1).type,'rule_rejected');
 const stale=await request(`/runs/${rejected}/approve`,'POST',{});assert.equal(stale.status,409);assert.equal(stale.data.error.code,'NOT_AWAITING_APPROVAL');
 check('rejection_and_active_run_conflict',{run_id:rejected});
 const race=await pending('race');
 const responses=await Promise.all([request(`/runs/${race}/approve`,'POST',{}),request(`/runs/${race}/reject`,'POST',{reason:'Souběžné rozhodnutí.'})]);
 assert.deepEqual(responses.map(r=>r.status).sort(),[200,409]);
 assert.equal(responses.find(r=>r.status===409).data.error.code,'NOT_AWAITING_APPROVAL');
 const final=await events(race);assert.equal(final.filter(e=>['rule_approved','rule_rejected'].includes(e.type)).length,1);
 writeFileSync('Docs/integration/race_after.json',JSON.stringify({events:final},null,2)+'\n');
 check('concurrent_approve_reject_one_winner',{run_id:race,responses});
 const runs=(await request('/runs')).data.runs;
 const skills=(await request('/skills')).data.skills;
 assert.deepEqual(skills.map(s=>s.name),skills.map(s=>s.name).sort());
 assert.ok(skills.every(s=>s.status==='installed'));
 assert.ok(skills.some(s=>s.name==='distinct_count_window' && s.origin==='agent'));
 check('runs_and_installed_skills',{run_count:runs.length,skill_count:skills.length});
 writeFileSync('Docs/integration/before_restart.json',JSON.stringify({run_ids:runs.map(r=>r.run_id),skills},null,2)+'\n');
 save({status:'PASS',phase,checks});
}
