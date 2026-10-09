// Copyright (c) 2026 Adam Krúpa and Ondra Csajka. All rights reserved.
import assert from 'node:assert/strict';
import { writeFileSync, mkdirSync } from 'node:fs';

const base = process.argv[2] || 'http://localhost:3000';
const output = process.argv[3] || 'Docs/integration/ws_idle.json';
const idleSeconds = Number(process.argv[4] || 180);
assert.ok(idleSeconds >= 180);
const health = await fetch(base + '/api/health');
assert.equal(health.status, 200);
assert.deepEqual(await health.json(), {status:'ok',contract_version:1});
const ws = new WebSocket(base.replace(/^http/, 'ws') + '/api/ws');
const events = [];
let closed = false;
ws.addEventListener('close', () => { closed = true; });
ws.addEventListener('message', event => { events.push(JSON.parse(String(event.data))); });
await new Promise((resolve, reject) => { ws.addEventListener('open', resolve, {once:true}); ws.addEventListener('error', reject, {once:true}); });
const started = Date.now();
for (let second = 0; second < idleSeconds; second += 30) {
  await new Promise(resolve => setTimeout(resolve, Math.min(30, idleSeconds-second)*1000));
  assert.equal(closed, false);
  console.log(`WebSocket idle ${Math.round((Date.now()-started)/1000)} s; application events=${events.length}`);
}
assert.equal(events.length, 0, 'The idle interval must have no application traffic.');
mkdirSync('Docs/integration', {recursive:true});
writeFileSync(output, JSON.stringify({status:'PASS',base,idle_ms:Date.now()-started,application_events:events.length,connected:true},null,2)+'\n');
console.log('Three-minute idle PASS; waiting for an actual run event.');
const deadline = Date.now() + 1500000;
while (!events.length && Date.now()<deadline) {
  assert.equal(closed, false);
  await new Promise(resolve => setTimeout(resolve, 1000));
}
assert.ok(events.length > 0);
writeFileSync(output, JSON.stringify({status:'PASS',base,idle_ms:idleSeconds*1000,application_events_during_idle:0,first_event_type:events[0].type,run_id:events[0].run_id,received_events:events.length},null,2)+'\n');
ws.close();
console.log('Event reception after idle PASS.');
