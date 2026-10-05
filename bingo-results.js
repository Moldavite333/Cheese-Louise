// Cheese Louise — Bingo results / season record
(() => {
  function bingoMembers(){
    const rows=(members||[]).filter(m=>m?.user_id);
    return rows.slice(0,2);
  }

  function bingoName(userId){
    return memberName(userId) || 'Player';
  }

  function bingoMovieResult(m){
    if(m?.bingo_draw) return {type:'draw', label:'Draw'};
    if(m?.bingo_winner_id) return {type:'win', winnerId:m.bingo_winner_id, label:`${bingoName(m.bingo_winner_id)} Wins`};
    return {type:'none', label:'Not recorded'};
  }

  function bingoRecord(){
    const players=bingoMembers();
    const results=(state.movies||[]).filter(m=>m?.bingo_draw || m?.bingo_winner_id);
    const draws=results.filter(m=>m.bingo_draw).length;
    return players.map(p=>{
      const wins=results.filter(m=>!m.bingo_draw && String(m.bingo_winner_id)===String(p.user_id)).length;
      const losses=results.filter(m=>!m.bingo_draw && m.bingo_winner_id && String(m.bingo_winner_id)!==String(p.user_id)).length;
      return {userId:p.user_id,name:bingoName(p.user_id),wins,losses,draws};
    });
  }

  async function setBingoMovieResult(movieId,winnerId=null,isDraw=false){
    const patch={
      bingo_winner_id:isDraw?null:winnerId,
      bingo_draw:!!isDraw,
      updated_at:new Date().toISOString()
    };
    const {error}=await db.from('movies').update(patch).eq('id',movieId).eq('workspace_id',workspace.id);
    if(error){ alert(`Could not save Bingo result: ${error.message}`); return; }
    const movie=(state.movies||[]).find(m=>String(m.id)===String(movieId));
    if(movie) Object.assign(movie,patch);
    render();
  }

  async function clearBingoMovieResult(movieId){
    const patch={bingo_winner_id:null,bingo_draw:false,updated_at:new Date().toISOString()};
    const {error}=await db.from('movies').update(patch).eq('id',movieId).eq('workspace_id',workspace.id);
    if(error){ alert(`Could not clear Bingo result: ${error.message}`); return; }
    const movie=(state.movies||[]).find(m=>String(m.id)===String(movieId));
    if(movie) Object.assign(movie,patch);
    render();
  }

  window.setBingoMovieResult=setBingoMovieResult;
  window.clearBingoMovieResult=clearBingoMovieResult;

  if(typeof clSavedMovieDetailModal==='function'){
    const original=clSavedMovieDetailModal;
    clSavedMovieDetailModal=function(){
      let html=original();
      const m=(state.movies||[]).find(x=>x.id===selectedMovie);
      if(!m) return html;

      const result=bingoMovieResult(m);
      const players=bingoMembers();
      const record=bingoRecord();
      const buttons=players.map(p=>`<button class="filter ${result.type==='win'&&String(result.winnerId)===String(p.user_id)?'active-filter':''}" onclick="setBingoMovieResult('${esc(m.id)}','${esc(p.user_id)}',false)">${esc(bingoName(p.user_id))} Wins</button>`).join('');
      const scoreboard=record.length
        ? `<div class="cl-bingo-record">${record.map(r=>`<div><strong>${esc(r.name)}</strong><span>${r.wins}-${r.losses}-${r.draws}</span><small>W-L-D</small></div>`).join('')}</div>`
        : '';

      const section=`<section class="cl-movie-detail-section cl-bingo-result-section">
        <div class="cl-movie-detail-section-head"><div><div class="kicker">Romantiverse Bingo</div><h3>Win, Lose or Draw</h3></div><span class="pill">${esc(result.label)}</span></div>
        <div class="movie-status-row cl-detail-status-row cl-bingo-result-buttons">
          ${buttons}
          <button class="filter ${result.type==='draw'?'active-filter':''}" onclick="setBingoMovieResult('${esc(m.id)}',null,true)">Draw</button>
          ${result.type!=='none'?`<button class="secondary" onclick="clearBingoMovieResult('${esc(m.id)}')">Clear</button>`:''}
        </div>
        ${scoreboard}
      </section>`;

      const marker='<section class="cl-movie-detail-section">\n      <div class="kicker">Radar status</div>';
      if(html.includes(marker)) html=html.replace(marker,section+marker);
      else html=html.replace('</div></div>',section+'</div></div>');
      return html;
    };
  }

  const style=document.createElement('style');
  style.textContent=`
    .cl-bingo-result-buttons{margin-top:10px;gap:8px;display:flex;flex-wrap:wrap}
    .cl-bingo-record{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px;margin-top:14px}
    .cl-bingo-record>div{display:grid;grid-template-columns:1fr auto;gap:2px 10px;align-items:end;padding:12px 14px;border:1px solid rgba(255,255,255,.12);border-radius:10px;background:rgba(255,255,255,.04)}
    .cl-bingo-record strong{font-size:1rem}.cl-bingo-record span{font-weight:800;font-size:1.2rem}.cl-bingo-record small{grid-column:1/-1;opacity:.65;letter-spacing:.08em}
    @media(max-width:620px){.cl-bingo-record{grid-template-columns:1fr}}
  `;
  document.head.appendChild(style);
})();
