/**
 * Pure release eligibility gate. This module does NOT publish to Buzzsprout,
 * query an RSS feed, or write to the public website.
 * Call only with episode items parsed from a freshly fetched, trusted RSS feed.
 * Never use a local checkbox or a scheduled date as proof of publication.
 */
export function verifyPublicRelease(draft, feedItems, checkedAt) {
  if (!draft || !Array.isArray(feedItems) || !Number.isFinite(Date.parse(checkedAt))) {
    return { status: 'failed', reason: 'Invalid release verification input' };
  }
  if (!draft.approved || !draft.movieId || !draft.episodeNumber ||
      !draft.buzzsproutGuid || !draft.recipeId || !draft.bingoMovieId) {
    return { status: 'pending', reason: 'Approval or public linkage incomplete' };
  }
  const matching = feedItems.filter(item => item && item.guid === draft.buzzsproutGuid);
  if (matching.length !== 1) {
    return { status: 'pending', reason: matching.length ? 'Ambiguous feed GUID' : 'Episode not present in public RSS' };
  }
  const item = matching[0];
  const publicationDate = Date.parse(item.pubDate);
  const checkDate = Date.parse(checkedAt);
  if (!Number.isFinite(publicationDate) || publicationDate > checkDate) {
    return { status: 'pending', reason: 'Episode publication date not yet verified' };
  }
  if (!item.audioUrl || !/^https:\/\//i.test(item.audioUrl)) {
    return { status: 'pending', reason: 'Public RSS item lacks HTTPS audio enclosure' };
  }
  return {
    status: 'published',
    verifiedAt: new Date(checkDate).toISOString(),
    guid: item.guid,
    audioUrl: item.audioUrl,
    publicationDate: new Date(publicationDate).toISOString(),
    idempotencyKey: `buzzsprout:${item.guid}`
  };
}

/** Only public fields; deliberately excludes notes, spoilers and host drafts. */
export function publicReleasePayload(draft, verification) {
  if (verification?.status !== 'published' || verification.guid !== draft?.buzzsproutGuid) {
    throw new Error('Verified public RSS publication required');
  }
  return {
    episodeNumber: draft.episodeNumber,
    movieId: draft.movieId,
    recipeId: draft.recipeId,
    bingoMovieId: draft.bingoMovieId,
    rssGuid: verification.guid,
    audioUrl: verification.audioUrl,
    publishedAt: verification.publicationDate,
    idempotencyKey: verification.idempotencyKey
  };
}
