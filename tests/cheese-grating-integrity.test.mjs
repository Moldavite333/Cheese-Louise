import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';

const source=readFileSync(new URL('../cheese-grating-integrity.js',import.meta.url),'utf8');
const context={window:{}};
vm.runInNewContext(source,context);
const {audit}=context.window.clCheeseGratingIntegrity;

test('legacy positive score with no checked traits is flagged but retained',()=>{
  const result=audit({cheese_score:23},[],[]);
  assert.equal(result.confirmedScore,0);
  assert.equal(result.storedScore,23);
  assert.equal(result.needsReview,true);
  assert.equal(result.complete,true);
});

test('checked trait total is uncapped and duplicate selections do not double count',()=>{
  const traits=[{id:'a',points:75},{id:'b',points:65}];
  const result=audit({cheese_score:140},['a','b','a'],traits);
  assert.equal(result.confirmedScore,140);
  assert.equal(result.needsReview,false);
});

test('missing trait definitions are marked incomplete, not silently verified',()=>{
  const result=audit({cheese_score:10},['known','missing'],[{id:'known',points:10}]);
  assert.equal(result.confirmedScore,10);
  assert.equal(result.complete,false);
  assert.equal(result.needsReview,true);
  assert.deepEqual(Array.from(result.unknownTraitIds),['missing']);
});

test('missing stored score is not fabricated as a discrepancy',()=>{
  const result=audit({cheese_score:null},[],[]);
  assert.equal(result.storedScore,null);
  assert.equal(result.needsReview,false);
});

test('score check is pure and does not modify source records',()=>{
  const movie=Object.freeze({cheese_score:99});
  const ids=Object.freeze(['one']);
  const traits=Object.freeze([Object.freeze({id:'one',points:3})]);
  const result=audit(movie,ids,traits);
  assert.equal(result.confirmedScore,3);
  assert.equal(movie.cheese_score,99);
});
