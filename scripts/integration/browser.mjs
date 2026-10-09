import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync, readFileSync } from 'node:fs';
import { chromium } from 'playwright';

const mode = process.argv[2] || 'live';
const base = process.argv[3] || 'http://localhost:3000';
const output = `Docs/integration/browser_${mode}.json`;
const directory = 'Docs/integration/screenshots';
const resume = process.argv.includes('--resume');
mkdirSync(directory,{recursive:true});
const browser = await chromium.launch({headless:true, ...(process.env.CHROMIUM_EXECUTABLE ? {executablePath:process.env.CHROMIUM_EXECUTABLE} : {})});
const context = await browser.newContext({viewport:{width:1440,height:1000}});
const page = await context.newPage();
const errors = [], dialogs = [], screenshots = [], runs = [];
let auditSocket; const observedEvents=[];
if (resume) { const previous=JSON.parse(readFileSync(output,'utf8')); runs.push(...previous.runs); screenshots.push(...previous.screenshots); }
page.on('pageerror', error => errors.push(error.message));
page.on('console', message => { if(message.type()==='error') errors.push(message.text()); });
page.on('dialog', async dialog => { dialogs.push(dialog.type()); await dialog.dismiss(); });
const screenshot = async name => {
  const path = `${directory}/${mode}_${name}.png`;
  await page.screenshot({path,fullPage:true}); screenshots.push(path);
};
const wait = async (predicate, milliseconds=1500000) => {
  const end=Date.now()+milliseconds;
  while(Date.now()<end) { if(await predicate()) return; await new Promise(resolve=>setTimeout(resolve,1000)); }
  throw new Error('Timed out waiting for the integration condition.');
};
const api = async path => {
  const response = await fetch(base+'/api'+path);
  assert.equal(response.status,200);
  return await response.json();
};
try {
  if(mode==='safety') {
    const samples=['<img src=x onerror=alert(1)>','<script>alert(1)</script>','**tučně** [odkaz](javascript:alert(1))','A'.repeat(300)];
    const text=samples.join('\n'); const id='run_ui1234'; const timestamp='2026-10-09T00:00:00.000Z';
    const metrics={true_positives:0,false_positives:0,false_negatives:0,precision:null,recall:null,thresholds:{min_precision:0.9,min_recall:0.9},passed:false};
    const payloads=[['run_started',{request:text}],['plan_ready',{steps:samples,skills_needed:[]}],['rule_evaluated',{attempt:1,dataset:'tuning',metrics}],['summary',{text,stats:{duration_ms:100,llm_calls:1,tokens_total:null,cost_usd:null,skills_built:0,skills_reused:0}}],['rule_approved',{rule_name:'ui_safety_rule',comment:null}],['future_unknown_event',{unexpected:text}]];
    const events=payloads.map(([type,data],i)=>({type,data,run_id:id,seq:i+1,timestamp,phase:type==='rule_approved'?'done':'rule',message:samples[i%samples.length]}));
    await page.routeWebSocket('ws://127.0.0.1:8000/ws', () => {});
    await page.route('http://127.0.0.1:8000/**', async route=> {
      const path=new URL(route.request().url()).pathname;
      const body=path==='/health'?{status:'ok',contract_version:1}:path==='/runs'?{runs:[{run_id:id,request:text,status:'approved',created_at:timestamp,finished_at:timestamp,last_seq:events.length}]}:path==='/skills'?{skills:[]}:path.endsWith('/events')?{events}:{error:{code:'RUN_NOT_FOUND',message:'Běh neexistuje.'}};
      await route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(body)});
    });
    await page.goto(base,{waitUntil:'networkidle'});
    await page.getByRole('button',{name:'Current run',exact:true}).click();
    await page.locator('#run-request').waitFor();
    await wait(()=>page.locator('#run-request').textContent().then(value=>value===text),30000);
    assert.equal(await page.locator('#run-request').textContent(),text);
    await page.getByRole('button',{name:/Worked for .* steps/}).click();
    await page.getByRole('button',{name:/Below the thresholds on the tuning set/}).click();
    const body=await page.locator('body').innerText();
    for(const sample of samples) assert.ok(body.includes(sample));
    assert.equal(await page.locator('#run-view img').count(),0);
    assert.equal(await page.locator('#run-view script').count(),0);
    assert.equal(await page.locator('#run-view a[href^="javascript:"]').count(),0);
    assert.ok(body.includes('—'));
    assert.equal(dialogs.length,0);
    assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth+1));
    await screenshot('literal_text_null_metrics_unknown_event');
    await page.reload({waitUntil:'networkidle'});
    await page.getByRole('button',{name:'Current run',exact:true}).click();
    await wait(()=>page.locator('#run-request').textContent().then(value=>value===text),30000);
    assert.equal(await page.locator('#run-request').textContent(),text);
    await screenshot('reload');
  } else {
    auditSocket=new WebSocket(base.replace(/^http/,'ws')+'/api/ws');
    auditSocket.addEventListener('message',event=>observedEvents.push(JSON.parse(String(event.data))));
    await new Promise((resolve,reject)=>{auditSocket.addEventListener('open',resolve,{once:true});auditSocket.addEventListener('error',reject,{once:true});});
    await page.goto(base,{waitUntil:'networkidle'});
    await wait(()=>page.getByText('Connected',{exact:true}).isVisible(),30000);
    await screenshot(resume?'resumed':'initial');
    for(const [scenario,request] of [['a','Chci zachytit password spraying na SSH.'],['b','Chci zachytit distribuovaný brute force na SSH.']]) {
      if(runs.some(run=>run.scenario===scenario)) continue;
      if(scenario==='b') await page.getByRole('button',{name:'New detection',exact:true}).first().click();
      await page.locator('#prompt-input').fill(request);
      const created=page.waitForResponse(response=>response.request().method()==='POST' && new URL(response.url()).pathname==='/runs');
      await page.getByRole('button',{name:'Build detection',exact:true}).click();
      const response=await created; assert.equal(response.status(),202);
      const runId=(await response.json()).run_id;
      const blocked=await fetch(base+'/api/runs',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({request:'Chci zachytit brute force na SSH.'})});
      assert.equal(blocked.status,409); assert.equal((await blocked.json()).error.code,'RUN_ALREADY_ACTIVE');
      await page.locator('#run-request').waitFor();
      await screenshot(`${scenario}_activity`);
      let events=[];
      await wait(async()=> {
        events=(await api(`/runs/${runId}/events`)).events;
        const last=events.at(-1)?.type;
        if(last==='run_failed') throw new Error(`Live scenario ${scenario} failed: ${events.at(-1).data.reason_code}`);
        return last==='awaiting_approval';
      });
      const pending=events.findLast(event=>event.type==='awaiting_approval');
      assert.equal(pending.data.metrics_tuning.passed,true);
      assert.equal(pending.data.metrics_validation.passed,true);
      if(runs.some(run=>run.scenario===scenario)) continue;
      if(scenario==='b') {
        assert.ok(events.some(event=>event.type==='skill_reused' && event.data.skill.origin==='agent' && event.data.skill.name==='distinct_count_window'));
        assert.equal(events.find(event=>event.type==='summary').data.stats.skills_built,0);
      }
      await page.getByRole('button',{name:'Approve and install',exact:true}).waitFor({timeout:30000});
      await screenshot(`${scenario}_approval`);
      const decision=page.waitForResponse(response=>response.request().method()==='POST' && new URL(response.url()).pathname.endsWith('/approve'));
      await page.getByRole('button',{name:'Approve and install',exact:true}).dblclick();
      assert.equal((await decision).status(),200);
      await wait(async()=> (await api(`/runs/${runId}/events`)).events.at(-1)?.type==='rule_approved',30000);
      await wait(()=>page.getByRole('button',{name:'Approve and install',exact:true}).count().then(n=>n===0),30000);
      events=(await api(`/runs/${runId}/events`)).events;
      await wait(()=>Promise.resolve(observedEvents.filter(event=>event.run_id===runId).length===events.length),10000);
      assert.deepEqual(observedEvents.filter(event=>event.run_id===runId),events);
      writeFileSync(`Docs/integration/${mode}_run_${scenario}.json`,JSON.stringify({events},null,2)+'\n');
      runs.push({scenario,run_id:runId,stats:events.find(event=>event.type==='summary').data.stats,event_types:events.map(event=>event.type)});
      await screenshot(`${scenario}_approved`);
      await page.reload({waitUntil:'networkidle'});
      await page.getByRole('button',{name:'Current run',exact:true}).click();
      assert.equal(await page.locator('#run-request').textContent(),request);
      assert.equal(await page.getByRole('button',{name:'Approve and install',exact:true}).count(),0);
      await screenshot(`${scenario}_reload`);
    }
    await page.getByRole('button',{name:/^Skill library/}).click();
    assert.ok((await page.locator('#skills-view').innerText()).includes('distinct_count_window'));
    await screenshot('skills');
    await page.getByRole('button',{name:'Compare runs',exact:true}).click();
    assert.ok((await page.locator('body').innerText()).includes('Skills reused'));
    await screenshot('comparison');
  }
  assert.deepEqual(errors,[]);
  assert.deepEqual(dialogs,[]);
  writeFileSync(output,JSON.stringify({status:'PASS',mode,base,runs,screenshots,browser_errors:errors,dialogs},null,2)+'\n');
  console.log(JSON.stringify({status:'PASS',mode,runs,screenshots:screenshots.length,browser_errors:errors.length}));
} catch(error) {
  await screenshot('failure').catch(()=>{});
  writeFileSync(output,JSON.stringify({status:'FAIL',mode,base,error:error.message,runs,screenshots,browser_errors:errors,dialogs},null,2)+'\n');
  console.error(JSON.stringify({status:'FAIL',mode,error:error.message}));
  process.exitCode=1;
} finally { auditSocket?.close(); await browser.close(); }
