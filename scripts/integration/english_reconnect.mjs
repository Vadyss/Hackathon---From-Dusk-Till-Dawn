// Copyright (c) 2026 Adam Krúpa and Ondra Csajka. All rights reserved.
import assert from 'node:assert/strict';
import { writeFileSync } from 'node:fs';
import { chromium } from 'playwright';

const base=process.argv[2] || 'http://localhost:3000';
const browser=await chromium.launch({headless:true});
const context=await browser.newContext({viewport:{width:1440,height:1000}});
await context.addInitScript(() => {
  const OriginalWebSocket=window.WebSocket;
  window.__integrationSockets=[];
  window.WebSocket=class extends OriginalWebSocket {
    constructor(...args){super(...args);window.__integrationSockets.push(this);}
  };
});
const page=await context.newPage();
const errors=[], expectedTransportErrors=[], screenshots=[];
let injectingOffline=false;
page.on('pageerror',e=>errors.push(e.message));
page.on('console',message=>{
  if(message.type()!=='error') return;
  if(injectingOffline && /ERR_INTERNET_DISCONNECTED|ERR_CONNECTION_CLOSED|WebSocket connection.*failed/.test(message.text())) expectedTransportErrors.push(message.text());
  else errors.push(message.text());
});
const wait=async predicate=>{
  const end=Date.now()+30000;
  while(Date.now()<end){if(await predicate())return;await new Promise(r=>setTimeout(r,100));}
  throw new Error('Reconnect condition timed out.');
};
const snapshot=async name=>{const path=`Docs/integration/screenshots-en/${name}.png`;await page.screenshot({path,fullPage:true});screenshots.push(path);};
try {
  await page.goto(base,{waitUntil:'networkidle'});
  await wait(()=>page.getByText('Connected',{exact:true}).isVisible());
  await page.getByRole('button',{name:'Current run',exact:true}).click();
  await page.locator('#run-request').waitFor();
  const before=await page.locator('#run-request').innerText();
  const runs=await fetch(base+'/api/runs').then(r=>r.json());
  injectingOffline=true;
  await context.setOffline(true);
  await page.evaluate(()=>window.__integrationSockets.forEach(socket=>socket.close(1000,'Integration disconnect')));
  await wait(()=>page.getByText('Connection needs attention',{exact:true}).isVisible());
  assert.match(await page.locator('body').innerText(),/interrupted|not responding/);
  await snapshot('connection_offline');
  await context.setOffline(false);
  await wait(()=>page.getByText('Connected',{exact:true}).isVisible());
  await wait(()=>page.getByText('Connection needs attention',{exact:true}).count().then(n=>n===0));
  injectingOffline=false;
  assert.equal(await page.locator('#run-request').innerText(),before);
  assert.deepEqual(await fetch(base+'/api/runs').then(r=>r.json()),runs);
  await snapshot('connection_recovered');
  assert.equal(/[áčďéěíňóřšťúůýžÁČĎÉĚÍŇÓŘŠŤÚŮÝŽ]/.test(await page.locator('body').innerText()),false);
  assert.deepEqual(errors,[]);
  writeFileSync('Docs/integration/english_reconnect.json',JSON.stringify({status:'PASS',screenshots,backend_state_unchanged:true,unexpected_browser_errors:errors,intentionally_injected_transport_errors:expectedTransportErrors},null,2)+'\n');
  console.log(JSON.stringify({status:'PASS',screenshots,unexpected_browser_errors:errors.length}));
}finally{await browser.close();}
