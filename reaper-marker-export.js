// Cheese Louise HQ — portable REAPER Region/Marker Manager CSV export.
// HQ time is relative to its timer start, not automatically synchronized with the audio recorder.
(function (root) {
  'use strict';
  const number = value => Number.isFinite(Number(value)) ? Math.max(0, Math.round(Number(value))) : 0;
  const time = value => {
    const ms = number(value);
    const minutes = Math.floor(ms / 60000);
    const seconds = Math.floor(ms % 60000 / 1000);
    return minutes + ':' + String(seconds).padStart(2, '0') + '.' + String(ms % 1000).padStart(3, '0');
  };
  const cell = value => {
    const text = String(value ?? '').replace(/\r?\n/g, ' ');
    return /[,"]/.test(text) ? '"' + text.replace(/"/g, '""') + '"' : text;
  };
  function build(session, segments, elapsedMs) {
    const s = session || {};
    const list = Array.isArray(segments) ? segments : [];
    const laps = Array.isArray(s.laps) ? s.laps : [];
    const markers = Array.isArray(s.markers) ? s.markers : [];
    const entries = [];
    laps.forEach(lap => {
      if (lap && typeof lap.name === 'string') entries.push({at: number(lap.startMs), priority: 0, name: 'SEGMENT: ' + lap.name});
    });
    if (!s.finished && (laps.length || markers.length || number(elapsedMs) > 0)) {
      const active = list[Number.isInteger(s.segment) ? s.segment : 0];
      if (active?.name) entries.push({at: laps.reduce((sum, lap) => sum + number(lap?.durationMs), 0), priority: 0, name: 'SEGMENT: ' + active.name});
    }
    markers.forEach(marker => {
      if (!marker) return;
      const type = String(marker.type || 'Moment').trim();
      const note = String(marker.note || '').trim();
      entries.push({at: number(marker.atMs), priority: 1, name: '[' + type + ']' + (note ? ' ' + note : '')});
    });
    if (s.finished) entries.push({at: number(elapsedMs ?? s.elapsedMs), priority: 2, name: 'RECORDING END'});
    entries.sort((a, b) => a.at - b.at || a.priority - b.priority);
    const rows = [['#', 'Name', 'Start', 'End', 'Length']];
    entries.forEach((entry, i) => rows.push(['M' + (i + 1), entry.name, time(entry.at), '', '']));
    return rows.map(row => row.map(cell).join(',')).join('\r\n') + '\r\n';
  }
  root.clReaperMarkers = {build, time};
})(typeof window !== 'undefined' ? window : globalThis);
