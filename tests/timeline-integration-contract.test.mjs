import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const root=new URL('../',import.meta.url);
const html=readFileSync(new URL('index.html',root),'utf8');
const hub=readFileSync(new URL('recording-hub.js',root),'utf8');
test('evidence-first timeline is loaded before recording desk and styled',()=>{
  const core=html.indexOf('src="timeline-core.js?');
  const controller=html.indexOf('src="automatic-timeline.js?');
  const desk=html.indexOf('src="recording-hub.js?');
  assert.ok(core>=0&&core<controller&&controller<desk);
  assert.match(html,/href="automatic-timeline\.css\?/);
});
test('manual talk order coexists with evidence-first timeline',()=>{
  assert.match(hub,/clAutomaticTimeline\?\.html\(/);
  assert.match(hub,/Manual talk order/);
  assert.match(hub,/function timelineSave\(/);
});
test('scene-linked markers retain recording clock, note and conflict safeguards',()=>{
  assert.match(hub,/mark\(\)\{if\(guardExternal\(\)\)return;/);
  assert.match(hub,/if\(isPending\(getSession\(\)\)\)/);
  assert.match(hub,/markers\.push\(\{atMs:sessionNow\(s\),type,note,\.\.\.\(window\.clAutomaticTimeline\?\.selected\(\)\|\|\{\}\)\}\)/);
  assert.match(hub,/exportReaper/);
});
