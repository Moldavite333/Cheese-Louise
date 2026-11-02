import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
const source = readFileSync(new URL('../reaper-marker-export.js', import.meta.url), 'utf8');
const context = {window: {}};
vm.runInNewContext(source, context);
const {build, time} = context.window.clReaperMarkers;
const segments = [{name:'Opening & banter'}, {name:'Cheesy Concoctions'}, {name:'Movie & tropes'}];
const parse = csv => csv.trim().split(/\r\n/).map(row => [...row.matchAll(/(?:^|,)(?:"((?:[^"]|"")*)"|([^,]*))/g)].map(m => (m[1] ?? m[2]).replace(/""/g, '"')));
test('REAPER CSV uses Region/Marker Manager five-column schema and millisecond precision', () => {
  assert.equal(time(62015), '1:02.015');
  assert.equal(time(3600123), '60:00.123');
  const rows = parse(build({segment:1,laps:[{name:'Opening & banter',startMs:0,durationMs:62015}],markers:[{atMs:12345,type:'Retake',note:'Nick, repeat "hello"\nplease'}],finished:false},segments,65000));
  assert.deepEqual(rows[0], ['#','Name','Start','End','Length']);
  assert.deepEqual(rows.map(r=>r[0]), ['#','M1','M2','M3']);
  assert.deepEqual(rows.map(r=>r[2]), ['Start','0:00.000','0:12.345','1:02.015']);
  assert.equal(rows[2][1], '[Retake] Nick, repeat "hello" please');
  assert.equal(rows[3][1], 'SEGMENT: Cheesy Concoctions');
});
test('finished sessions export every segment boundary and recording end once', () => {
  const rows = parse(build({segment:2,laps:[{name:'Opening & banter',startMs:0,durationMs:10000},{name:'Cheesy Concoctions',startMs:10000,durationMs:20000},{name:'Movie & tropes',startMs:30000,durationMs:10000}],markers:[{atMs:30000,type:'Funny / Clip',note:'Big laugh'}],finished:true,elapsedMs:40000},segments,40000));
  assert.equal(rows.length,6);
  assert.deepEqual(rows.slice(1).map(r=>r[2]), ['0:00.000','0:10.000','0:30.000','0:30.000','0:40.000']);
  assert.equal(rows[3][1], 'SEGMENT: Movie & tropes');
  assert.equal(rows[4][1], '[Funny / Clip] Big laugh');
  assert.equal(rows[5][1], 'RECORDING END');
});
test('empty session has only a header; malformed timing never generates NaN or negative markers', () => {
  assert.equal(parse(build({},segments,0)).length,1);
  const rows=parse(build({segment:0,markers:[{atMs:-5000,type:'Technical Issue',note:'A, B'}]},segments,0));
  assert.equal(rows[1][2],'0:00.000');
  assert.equal(rows[2][1],'[Technical Issue] A, B');
  assert.ok(!build({markers:[{atMs:'oops'}]},segments,0).includes('NaN'));
});
