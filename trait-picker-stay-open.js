// Cheese Louise — keep the movie Cheese Trait picker open while selecting traits.
// Overrides the original full-app rerender so users can select several traits in a row.

(() => {
  const pending = new Set();

  async function toggleMovieTraitStayOpen(movieId, traitId) {
    const key = `${movieId}:${traitId}`;
    if (pending.has(key)) return;

    const movie = (state.movies || []).find(m => m.id === movieId);
    if (!movie || !workspace) return;

    const modal = document.querySelector('.movie-modal');
    const savedScrollTop = modal ? modal.scrollTop : 0;
    const selected = (movie.selectedTraitIds || []).includes(traitId);
    pending.add(key);

    try {
      if (selected) {
        const { error } = await db
          .from('movie_traits')
          .delete()
          .eq('movie_id', movieId)
          .eq('trait_id', traitId);
        if (error) throw error;
      } else {
        const { error } = await db.from('movie_traits').insert({
          workspace_id: workspace.id,
          movie_id: movieId,
          trait_id: traitId,
          selected_by: me()
        });
        if (error) throw error;
      }

      // Refresh the data, but DO NOT call render(). Re-rendering the whole app was
      // what collapsed/reset the trait picker after every click.
      await loadAll();

      const freshMovie = (state.movies || []).find(m => m.id === movieId);
      if (!freshMovie || selectedMovie !== movieId) return;

      const body = document.getElementById('traitPickerBody');
      if (body) body.innerHTML = traitPickerHtml(freshMovie);

      const score = document.querySelector('.movie-modal .cheese-total strong');
      if (score) score.textContent = String(freshMovie.score ?? 0);

      const countLine = document.querySelector('.movie-modal .cheese-total + .subtle');
      if (countLine) {
        const count = freshMovie.selectedTraitIds?.length || 0;
        countLine.textContent = `${count} trait${count === 1 ? '' : 's'} selected · Higher = cheesier, not “better.”`;
      }

      // Keep the user exactly where they were in the list.
      requestAnimationFrame(() => {
        const currentModal = document.querySelector('.movie-modal');
        if (currentModal) currentModal.scrollTop = savedScrollTop;
      });
    } catch (err) {
      alert(err?.message || String(err));
    } finally {
      pending.delete(key);
    }
  }

  window.toggleMovieTrait = toggleMovieTraitStayOpen;
})();
