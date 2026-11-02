import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const root = new URL('../', import.meta.url);
const core = readFileSync(new URL('timeline-core.js', root), 'utf8');
const controller = readFileSync(new URL('automatic-timeline.js', root), 'utf8');
const css = readFileSync(new URL('automatic-timeline.css', root), 'utf8');
const page = readFileSync(new URL('index.html', root), 'utf8');

function setup() {
  const storage = new Map();
  let id = 0;
  const sandbox = {
    crypto: { randomUUID: () => 'test-id-' + ++id },
    localStorage: {
      getItem: key => storage.get(key) ?? null,
      setItem: (key, value) => storage.set(key, value)
    },
    document: {
      getElementById: () => null,
      querySelector: () => null,
      activeElement: null
    },
    setTimeout: () => {},
  };
  sandbox.window = sandbox;
  vm.createContext(sandbox);
  vm.runInContext(core, sandbox);
  vm.runInContext(controller, sandbox);
  const context = {
    movie: { id: 'movie-1', title: 'Sample Movie', summary: 'A short movie synopsis.' },
    workspace: 'test',
    notes: 'Jenny noticed a strange decision.',
    legacy: [],
    confirmed: [],
    redraw: () => {}
  };
  return { sandbox, context, storage };
}

test('storyboard shows separate chronological cards with timestamps and previews', () => {
  const { sandbox, context } = setup();
  const html = sandbox.clAutomaticTimeline.html(context);
  assert.match(html, /aria-label="Movie scene storyboard"/);
  assert.match(html, /class="cl-auto-scene-rail"/);
  assert.equal((html.match(/class="cl-auto-scene-card"/g) || []).length, 2);
  assert.match(html, /SCENE 1/);
  assert.match(html, /SCENE 2/);
  assert.match(html, /Time unknown/);
  assert.match(html, /A short movie synopsis/);
  assert.match(html, /Watch Along observations/);
  assert.equal((html.match(/aria-current="step"/g) || []).length, 1);
});

test('scene selection and separate host notes survive a redraw without AI', () => {
  const { sandbox, context, storage } = setup();
  const timeline = sandbox.clAutomaticTimeline;
  timeline.html(context);
  timeline.edit('nick_notes', 'Nick: festival finances make no sense.');
  let html = timeline.html(context);
  assert.match(html, /Nick note/);
  assert.match(html, /Nick: festival finances make no sense/);
  timeline.select(1);
  html = timeline.html(context);
  assert.match(html, /SCENE 2/);
  assert.equal((html.match(/aria-current="step"/g) || []).length, 1);
  assert.match(html, /Jenny noticed a strange decision/);
  assert.ok(storage.size > 0);
});

test('storyboard is a horizontal scrollable filmstrip with responsive mobile cards', () => {
  assert.match(css, /\.cl-auto-scene-rail\{[^}]*display:flex/);
  assert.match(css, /\.cl-auto-scene-rail\{[^}]*overflow-x:auto/);
  assert.match(css, /@media\(max-width:599px\)/);
  assert.match(controller, /scrollLeft=left/);
  assert.match(page, /automatic-timeline\.css\?v=storyboard-r18/);
  assert.match(page, /automatic-timeline\.js\?v=storyboard-r18/);
});
