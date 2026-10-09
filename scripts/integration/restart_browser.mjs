// Copyright (c) 2026 Adam Krúpa and Ondra Csajka. All rights reserved.
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { chromium } from 'playwright';

const base=process.argv[2] || 'http://localhost:3000';
const old=JSON.parse(readFileSync(process.argv[3] || 'Docs/integration/before_restart.json','utf8'));
const browser=await chromium.launch({headless:true});
const page=await browser.newPage({viewport:{width:1440,height:1000}});
const errors=[];
page.on('pageerror',error=>errors.push(error.message));
try {
 await page.goto(base,{waitUntil:'networkidle'});
 await page.getByRole('button',{name:'Current run',exact:true}).click();
 await page.locator('#run-request').waitFor();
 await page.screenshot({path:'Docs/integration/screenshots/restart_before.png',fullPage:true});
 execFileSync('docker',['compose','restart','backend'],{stdio:'pipe'});
 const end=Date.now()+60000;
 let cleared=false;
 while(Date.now()<end) {
  const response=await fetch(base+'/api/runs');
  if(!response.ok) {await new Promise(resolve=>setTimeout(resolve,1000));continue;}
  const json=await response.json();
  if(json.runs?.length===0 && await page.locator('.recent-runs .run-item').count()===0) {cleared=true;break;}
  await new Promise(resolve=>setTimeout(resolve,1000));
 }
 assert.equal(cleared,true);
 assert.deepEqual(errors,[]);
 await page.getByRole('button',{name:/^Skill library/}).click();
 assert.ok((await page.locator('#skills-view').innerText()).includes('distinct_count_window'));
 await page.screenshot({path:'Docs/integration/screenshots/restart_after_skills.png',fullPage:true});
 writeFileSync('Docs/integration/browser_restart.json',JSON.stringify({status:'PASS',old_run_ids:old.run_ids,history_removed:true,skill_preserved:'distinct_count_window',page_errors:errors},null,2)+'\n');
 console.log('Browser restart, forgotten history, persistent skills: PASS');
} finally {await browser.close();}
