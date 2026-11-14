(() => {
  let days = 7;
  const number = value => Number(value || 0).toLocaleString();
  const metrics = [['visitors','Visitors'],['previousVisitors','Visitors in prior period'],['sessions','Sessions'],['views','Pageviews'],['cards','Bingo cards started'],['clicks','Episode link clicks']];

  function panel() {
    setTimeout(refresh, 0);
    return `<section class="section card card-pad" id="website-traffic" aria-labelledby="website-traffic-title">
      <h2 id="website-traffic-title">Website Traffic</h2>
      <label for="website-traffic-range">Date range</label>
      <select id="website-traffic-range" onchange="clWebsiteTraffic.range(this.value)">
        <option value="7" ${days===7?'selected':''}>Last 7 days</option>
        <option value="30" ${days===30?'selected':''}>Last 30 days</option>
      </select>
      <p class="subtle">Includes today in Mountain Time. Visitors are estimates by browser.</p>
      <p data-traffic-status role="status">Loading website traffic…</p>
      <div data-traffic-report></div>
    </section>`;
  }

  function list(parent, title, items) {
    const heading = document.createElement('h3');
    heading.textContent = title;
    parent.append(heading);
    const results = document.createElement(items.length ? 'ul' : 'p');
    if (!items.length) results.textContent = 'Nothing recorded yet.';
    for (const item of items) {
      const line = document.createElement('li');
      line.textContent = item;
      results.append(line);
    }
    parent.append(results);
  }

  async function refresh() {
    const panel = document.getElementById('website-traffic');
    if (!panel || !workspace?.id) return;
    const range = days;
    const status = panel.querySelector('[data-traffic-status]');
    const report = panel.querySelector('[data-traffic-report]');
    status.textContent = 'Loading website traffic…';
    report.replaceChildren();
    try {
      const {data,error} = await db.rpc('website_traffic_report',{p_workspace:workspace.id,p_days:range});
      if (!panel.isConnected || range !== days) return;
      if (error || !data) throw new Error('Report unavailable');
      status.textContent = data.views ? '' : 'No pageviews recorded for this date range yet.';
      list(report,'Traffic summary',metrics.map(([key,label]) => label + ' · ' + number(data[key])));
      list(report,'Visitors by site',[
        'Cheese Louise website · ' + number(data.hosts.website),
        'Romantiverse Bingo · ' + number(data.hosts.bingo)
      ]);
      list(report,'Top traffic sources and campaigns',data.sources.map(row => [row.source,row.campaign,number(row.sessions) + ' sessions'].filter(Boolean).join(' · ')));
      list(report,'Recent trope suggestions',data.suggestions.map(row => [row.trope,row.movie].filter(Boolean).join(' · ')));
    } catch {
      if (!panel.isConnected || range !== days) return;
      status.textContent = 'Website traffic is temporarily unavailable.';
      const retry = document.createElement('button');
      retry.type = 'button';
      retry.textContent = 'Retry';
      retry.addEventListener('click',refresh);
      report.append(retry);
    }
  }
  window.clWebsiteTraffic = {panel,range(value) {days = Number(value);refresh();}};
})();
