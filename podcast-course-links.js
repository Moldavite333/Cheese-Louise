// Cheese Louise — Podcast 101 → Production Audio Course cross-links
// Keeps Podcast 101 operational tasks tied to the matching lesson in the producer audio course.

const PODCAST_AUDIO_COURSE_PAGE='podcast-production-audio-course.html';

const PODCAST_AUDIO_COURSE_LINKS={
  'foundation-promise':['show-concept-audience-promise-and-format','Show concept + audience promise'],
  'foundation-listener':['show-concept-audience-promise-and-format','Show concept + audience promise'],
  'foundation-format':['show-concept-audience-promise-and-format','Show format + architecture'],
  'foundation-runtime':['show-concept-audience-promise-and-format','Format + runtime'],
  'foundation-cadence':['the-weekly-production-pipeline','Production cadence'],
  'foundation-intro-outro':['deep-dive-designing-a-repeatable-cold-open-and-opening-five-minutes','Cold open + opening five minutes'],
  'foundation-boundaries':['show-concept-audience-promise-and-format','Editorial boundaries'],
  'foundation-naming':['metadata-artwork-chapters-and-transcripts','Episode packaging + metadata'],
  'recording-gear':['microphones-and-polar-patterns','Microphones + polar patterns'],
  'recording-room':['rooms-and-acoustics','Rooms + acoustics'],
  'recording-levels':['gain-staging-and-monitoring','Gain staging + monitoring'],
  'recording-template':['deep-dive-building-a-daw-session-template-and-controlling-latency','DAW session template'],
  'recording-backup':['redundancy-and-disaster-prevention','Backups + redundancy'],
  'recording-prerecord':['deep-dive-reliability-cables-media-power-maintenance-and-preflight','Recording preflight'],
  'recording-file-system':['file-management-and-version-control','Files + version control'],
  'recording-test':['local-multitrack-recording','Local multitrack recording'],
  'pilot-full':['one-episode-from-movie-selection-to-analytics-review','One episode end to end'],
  'pilot-edit':['editorial-philosophy','Editorial philosophy'],
  'pilot-listen':['deep-dive-the-final-qc-listen-how-to-hear-the-episode-like-a-listener','Final QC listen'],
  'pilot-edit-template':['deep-dive-building-a-daw-session-template-and-controlling-latency','Reusable edit/session template'],
  'pilot-outline':['pre-production-and-episode-planning','Pre-production + episode planning'],
  'pilot-shownotes':['metadata-artwork-chapters-and-transcripts','Show notes + metadata'],
  'pilot-qc':['quality-control','Quality control'],
  'pilot-buffer':['deep-dive-scheduling-buffers-batching-and-the-production-queue','Buffers + production queue'],
  'distribution-host':['hosting-rss-and-distribution-architecture','Hosting + RSS'],
  'distribution-description':['metadata-artwork-chapters-and-transcripts','Descriptions + metadata'],
  'distribution-art':['metadata-artwork-chapters-and-transcripts','Artwork + metadata'],
  'distribution-trailer':['deep-dive-trailers-launch-inventory-and-the-first-listener-experience','Trailer + first-listener experience'],
  'distribution-submit':['apple-spotify-and-youtube','Apple, Spotify + YouTube'],
  'distribution-links':['deep-dive-the-podcast-website-and-email-list-as-audience-infrastructure','Website + canonical links'],
  'distribution-test':['deep-dive-platform-strategy-without-letting-platforms-rewrite-the-show','Platform verification'],
  'distribution-analytics':['analytics-that-matter','Analytics baseline'],
  'assets-handles':['clips-social-email-website-and-community','Social + community'],
  'assets-social-kit':['clips-social-email-website-and-community','Social packaging'],
  'assets-video-template':['clips-social-email-website-and-community','Clip system'],
  'assets-quote-template':['podcast-marketing','Marketing assets'],
  'assets-photo-bank':['podcast-marketing','Marketing assets'],
  'assets-press-kit':['podcast-marketing','Press + promotion'],
  'assets-contact':['deep-dive-the-podcast-website-and-email-list-as-audience-infrastructure','Website + contact infrastructure'],
  'prelaunch-content-bank':['podcast-marketing','Pre-launch marketing'],
  'prelaunch-countdown':['launch-strategy','Launch strategy'],
  'prelaunch-warm-list':['deep-dive-marketing-as-a-system-discovery-sampling-conversion-and-return','Discovery + conversion'],
  'prelaunch-guests':['research-guests-and-rundowns','Guests + prep'],
  'prelaunch-cta':['deep-dive-marketing-as-a-system-discovery-sampling-conversion-and-return','CTA + conversion'],
  'prelaunch-polls':['clips-social-email-website-and-community','Audience participation'],
  'prelaunch-link-test':['deep-dive-the-podcast-website-and-email-list-as-audience-infrastructure','Website + link infrastructure'],
  'launch-publish':['launch-strategy','Launch strategy'],
  'launch-listings':['apple-spotify-and-youtube','Directory listings'],
  'launch-announce':['podcast-marketing','Launch promotion'],
  'launch-direct-share':['deep-dive-marketing-as-a-system-discovery-sampling-conversion-and-return','Launch conversion'],
  'launch-pin':['podcast-marketing','Launch packaging'],
  'launch-engage':['clips-social-email-website-and-community','Audience engagement'],
  'launch-fix':['failure-analysis-and-troubleshooting','Launch troubleshooting'],
  'launch-review':['deep-dive-the-episode-postmortem-turning-one-release-into-the-next-better-release','Launch debrief + postmortem'],
  'system-deadlines':['the-weekly-production-pipeline','Weekly production pipeline'],
  'system-episode-checklist':['sops-roles-calendars-and-meetings','SOPs + checklists'],
  'system-movie-pipeline':['deep-dive-scheduling-buffers-batching-and-the-production-queue','Production queue'],
  'system-guest-pipeline':['research-guests-and-rundowns','Guest pipeline'],
  'system-clip-workflow':['clips-social-email-website-and-community','Clip workflow'],
  'system-backup':['file-management-and-version-control','Archive + backup'],
  'system-feedback':['analytics-that-matter','Feedback + analytics'],
  'growth-metrics':['analytics-that-matter','Analytics that matter'],
  'growth-winners':['deep-dive-analytics-as-an-experiment-system-not-a-scoreboard','Find repeatable winners'],
  'growth-clips':['clips-social-email-website-and-community','Short-form clips'],
  'growth-search':['metadata-artwork-chapters-and-transcripts','Searchable packaging'],
  'growth-youtube':['apple-spotify-and-youtube','YouTube strategy'],
  'growth-crosspromo':['podcast-marketing','Cross-promotion'],
  'growth-community':['clips-social-email-website-and-community','Community participation'],
  'growth-email':['deep-dive-the-podcast-website-and-email-list-as-audience-infrastructure','Owned audience + email'],
  'growth-local':['podcast-marketing','Audience partnerships'],
  'revenue-patreon':['monetization','Membership + monetization'],
  'revenue-member-calendar':['bonus-lesson-budgeting-time-and-money-per-episode','Member workload + capacity'],
  'revenue-watchalong':['bingo-cocktail-lounge-patreon-website-and-community-flywheel','Watch-alongs + community flywheel'],
  'revenue-sponsor-fit':['bonus-lesson-sponsor-operations','Sponsor operations'],
  'revenue-merch':['monetization','Merch + monetization'],
  'revenue-live':['bingo-cocktail-lounge-patreon-website-and-community-flywheel','Live/community extensions'],
  'quarterly-retro':['deep-dive-postmortems-failure-drills-and-continuous-improvement','Production retrospective'],
  'quarterly-format':['cheese-louise-episode-architecture','Episode architecture review'],
  'quarterly-brand':['podcast-marketing','Brand + packaging review'],
  'quarterly-goals':['deep-dive-analytics-as-an-experiment-system-not-a-scoreboard','90-day measurable goals'],
  'quarterly-experiments':['deep-dive-analytics-as-an-experiment-system-not-a-scoreboard','Controlled experiments'],
  'quarterly-celebrate':['deep-dive-season-planning-sustainability-and-knowing-what-not-to-build','Sustainability + wins']
};

function podcastAudioCourseLink(taskKey){
  const hit=PODCAST_AUDIO_COURSE_LINKS[taskKey];
  if(!hit) return null;
  return {anchor:hit[0],label:hit[1],href:`${PODCAST_AUDIO_COURSE_PAGE}#${hit[0]}`};
}

function podcastAudioCourseButton(taskKey,compact=false){
  const link=podcastAudioCourseLink(taskKey);
  if(!link) return '';
  return `<a class="pc-audio-link ${compact?'compact':''}" href="${link.href}" target="_blank" rel="noopener" onclick="event.stopPropagation()" title="Open matching lesson in the Podcast Production Audio Course">🎧 ${compact?'Learn':esc(link.label)}</a>`;
}

const audioCourseOriginalTaskRow=pcTaskRow;
pcTaskRow=function(task,compact=false){
  const html=audioCourseOriginalTaskRow(task,compact);
  const link=podcastAudioCourseButton(task.key,compact);
  if(!link) return html;
  const marker='</div>\n    <button class="secondary pc-plan-btn"';
  if(!html.includes(marker)) return html;
  return html.replace(marker,`${link}</div>\n    <button class="secondary pc-plan-btn"`);
};

const audioCourseOriginalTaskModal=pcTaskModal;
pcTaskModal=function(){
  const task=pcTaskByKey(pcEditingTaskKey);
  const html=audioCourseOriginalTaskModal();
  if(!task) return html;
  const link=podcastAudioCourseLink(task.key);
  if(!link) return html;
  const button=`<a class="secondary pc-audio-modal-link" href="${link.href}" target="_blank" rel="noopener">🎧 Open audio-course lesson: ${esc(link.label)}</a>`;
  return html.replace('<div class="episode-editor-grid"',`${button}<div class="episode-editor-grid"`);
};

const audioCourseOriginalChecklistPage=pcChecklistPage;
pcChecklistPage=function(){
  const html=audioCourseOriginalChecklistPage();
  const resource=`<section class="section"><div class="card card-pad pc-audio-resource"><div><div class="kicker">Producer training</div><h2 style="margin:5px 0">🎧 Podcast Production Audio Course</h2><div class="subtle">Podcast 101 is now cross-linked to the professional production course. Tap any <strong>Learn</strong> link beside a checklist item to jump directly to the matching lesson.</div></div><a class="primary pc-audio-master" href="${PODCAST_AUDIO_COURSE_PAGE}" target="_blank" rel="noopener">Open full course →</a></div></section>`;
  return resource+html;
};

window.podcastAudioCourseLink=podcastAudioCourseLink;
