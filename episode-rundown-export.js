// Cheese Louise HQ — concise Samsung Notes episode handoff.
// Runs after watch-along.js; keeps the existing draft and ordering untouched.
(() => {
  'use strict';
  const byId = id => document.getElementById(id);
  const clean = value => String(value ?? '').replace(/\s+/g, ' ').trim();
  const lines = value => String(value || '').split(/\n+/).map(s => s.replace(/^\s*[•*-]\s*/, '').trim()).filter(Boolean);
  function current() {
    const movieId = document.querySelector('.watch-movie-select')?.value;
    const movie = (state.movies || []).find(m => String(m.id) === String(movieId));
    if (!movie) return null;
    const wid = workspace?.id || 'local';
    let draft = {};
    try { draft = JSON.parse(localStorage.getItem(`cheeseLouise:watchAlong:${wid}:draft:${movie.id}`) || '{}'); }
    catch { draft = {}; }
    return {movie, draft};
  }
  function generate() {
    const selected = current();
    if (!selected) return '';
    const {movie, draft} = selected;
    const traits = new Map((state.traits || []).map(t => [String(t.id), t]));
    const items = Array.isArray(draft.outlineItems) ? draft.outlineItems : [];
    const result = [`CHEESE LOUISE — ${clean(movie.title)}`, 'EPISODE RUNDOWN', ''];
    const used = new Set();
    if (items.length) {
      result.push('MOVIE TALK — IN ORDER');
      items.forEach(item => {
        if (item.type === 'trait') {
          const trait = traits.get(String(item.traitId));
          if (!trait) return;
          used.add(String(trait.id));
          result.push(`• ${clean(trait.name)}${Number.isFinite(Number(trait.points)) ? ` (+${Number(trait.points)})` : ''}`);
        } else if (clean(item.text)) result.push(`• ${clean(item.text)}`);
      });
    }
    const checked = [...new Set(Array.isArray(draft.traitIds) ? draft.traitIds.map(String) : [])]
      .filter(id => !used.has(id)).map(id => traits.get(id)).filter(Boolean);
    if (checked.length) {
      if (items.length) result.push('');
      result.push(items.length ? 'OTHER CHECKED TROPES' : 'CHECKED TROPES');
      checked.forEach(t => result.push(`• ${clean(t.name)} (+${Number(t.points || 0)})`));
    }
    // Notes added to the rundown are already represented; keep remaining raw watch notes accessible.
    const existingNotes = new Set(items.filter(i => i.type === 'note').map(i => clean(i.text).toLowerCase()));
    const notes = lines(draft.notes).filter(n => !existingNotes.has(clean(n).toLowerCase()));
    if (notes.length) { result.push('', 'EXTRA WATCH NOTES', ...notes.map(n => `• ${n}`)); }
    const scratch = lines(draft.rules);
    if (scratch.length) result.push('', 'OTHER IDEAS', ...scratch.map(n => `• ${n}`));
    const selectedIds = new Set(Array.isArray(draft.traitIds) ? draft.traitIds.map(String) : []);
    const total = [...selectedIds].map(id => traits.get(id)).filter(Boolean)
      .reduce((sum,t) => sum + (Number(t.points) || 0), 0);
    result.push('', `CHEESE GRATING — ${total} points from ${selectedIds.size} checked tropes (watch-along draft; verify against HQ final)`);
    return result.join('\n').trim() + '\n';
  }
  async function copyText(text) {
    if (navigator.clipboard?.writeText) {
      try { await navigator.clipboard.writeText(text); return true; } catch {}
    }
    const textarea = document.createElement('textarea');
    textarea.value = text;
    textarea.style.position = 'fixed';
    textarea.style.left = '-9999px';
    document.body.append(textarea);
    textarea.select();
    let ok = false;
    try { ok = document.execCommand('copy'); } catch {}
    textarea.remove();
    return ok;
  }
  function status(message) {
    const el = byId('watchSamsungStatus');
    if (el) el.textContent = message;
  }
  function openPreview() {
    const text = generate();
    if (!text) return status('Select a movie first.');
    const preview = byId('watchSamsungPreview');
    if (!preview) return;
    preview.hidden = false;
    byId('watchSamsungText').value = text;
    status('Ready. Copy or share, then edit independently in Samsung Notes.');
  }
  async function copyRundown() {
    const text = byId('watchSamsungText')?.value || generate();
    status(await copyText(text) ? 'Copied! Paste into a new Samsung Note.' : 'Copy was blocked. Select the preview text and copy manually.');
  }
  async function shareRundown() {
    const text = byId('watchSamsungText')?.value || generate();
    if (!navigator.share) { await copyRundown(); return; }
    try { await navigator.share({title:'Cheese Louise Episode Rundown',text}); }
    catch (error) { if (error?.name !== 'AbortError') status('Sharing unavailable. Use Copy instead.'); }
  }
  window.watchAlongGenerateSamsungRundown = openPreview;
  window.watchAlongCopySamsungRundown = copyRundown;
  window.watchAlongShareSamsungRundown = shareRundown;
  function mount() {
    const card = document.querySelector('.watch-outline-card');
    if (!card || byId('watchSamsungExport')) return;
    const host = document.createElement('div');
    host.id = 'watchSamsungExport';
    host.className = 'watch-samsung-export';
    host.innerHTML = `
      <div class="watch-samsung-actions">
        <button class="primary" type="button" onclick="watchAlongGenerateSamsungRundown()">Generate Episode Rundown</button>
        <span class="subtle">One concise outline for Nick and Jenny.</span>
      </div>
      <div id="watchSamsungPreview" hidden>
        <label for="watchSamsungText" class="kicker">Edit before copying if needed</label>
        <textarea id="watchSamsungText" class="watch-textarea" rows="12" spellcheck="true"></textarea>
        <div class="watch-samsung-actions">
          <button class="primary" type="button" onclick="watchAlongCopySamsungRundown()">Copy for Samsung Notes</button>
          <button class="secondary" type="button" onclick="watchAlongShareSamsungRundown()">Share to Samsung Notes</button>
        </div>
      </div>
      <div id="watchSamsungStatus" class="subtle" role="status" aria-live="polite"></div>`;
    card.append(host);
  }
  const observer = new MutationObserver(mount);
  observer.observe(document.documentElement, {childList:true,subtree:true});
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded',mount,{once:true});
  else mount();
})();
