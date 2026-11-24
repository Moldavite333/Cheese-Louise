import assert from 'node:assert/strict';
import { test } from 'node:test';
import { verifyPublicRelease, publicReleasePayload } from '../release-verification-core.mjs';

const draft = { approved: true, movieId: 'movie-1', episodeNumber: 1,
  buzzsproutGuid: 'guid-1', recipeId: 'drink-1', bingoMovieId: 'movie-1',
  privateNotes: 'Never publish this' };
const item = { guid: 'guid-1', pubDate: '2026-11-20T09:00:00Z',
  audioUrl: 'https://example.org/episode1.mp3' };
const checked = '2026-11-20T10:00:00Z';

test('published only after GUID, enclosure and date verification', () => {
  const v = verifyPublicRelease(draft, [item], checked);
  assert.equal(v.status, 'published');
  assert.equal(v.idempotencyKey, 'buzzsprout:guid-1');
  assert.deepEqual(publicReleasePayload(draft, v), {
    episodeNumber: 1, movieId: 'movie-1', recipeId: 'drink-1',
    bingoMovieId: 'movie-1', rssGuid: 'guid-1',
    audioUrl: item.audioUrl, publishedAt: '2026-11-20T09:00:00.000Z',
    idempotencyKey: 'buzzsprout:guid-1'
  });
  assert.equal(JSON.stringify(publicReleasePayload(draft, v)).includes('Never publish'), false);
});
test('scheduled, absent, unapproved and incomplete drafts stay private', () => {
  assert.equal(verifyPublicRelease(draft, [], checked).status, 'pending');
  assert.equal(verifyPublicRelease(draft, [{...item, pubDate:'2026-11-21T09:00:00Z'}], checked).status, 'pending');
  assert.equal(verifyPublicRelease({...draft, approved:false}, [item], checked).status, 'pending');
  assert.equal(verifyPublicRelease({...draft, recipeId:null}, [item], checked).status, 'pending');
});
test('ambiguous GUIDs and missing audio cannot publish', () => {
  assert.equal(verifyPublicRelease(draft, [item,item], checked).status, 'pending');
  assert.equal(verifyPublicRelease(draft, [{...item, audioUrl:''}], checked).status, 'pending');
  assert.throws(() => publicReleasePayload(draft, {status:'pending'}));
});
