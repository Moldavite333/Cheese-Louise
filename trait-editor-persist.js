// Cheese Louise HQ — keep the saved-movie Cheese Trait editor open while working.
// The realtime subscription rerenders HQ after each database change; without this,
// the <details> editor collapses after every trait selection.

(() => {
  let openForMovieId = null;
  let lastScrollTop = 0;

  // Remember whether the Edit Cheese Traits section is open.
  document.addEventListener('toggle', event => {
    const details = event.target;
    if (!details?.matches?.('.cl-detail-editor')) return;
    openForMovieId = details.open && selectedMovie ? selectedMovie : null;
  }, true);

  // Remember the user's position in the movie detail sheet so a realtime refresh
  // does not throw them back to the top of a long trait list.
  document.addEventListener('scroll', event => {
    const modal = event.target;
    if (modal?.matches?.('.cl-movie-detail-modal') && selectedMovie) {
      lastScrollTop = modal.scrollTop || 0;
    }
  }, true);

  // Ensure the rebuilt saved-movie modal renders the editor open when it was open
  // immediately before the refresh.
  if (typeof clSavedMovieDetailModal === 'function') {
    const originalSavedMovieDetailModal = clSavedMovieDetailModal;
    clSavedMovieDetailModal = function(...args) {
      let html = originalSavedMovieDetailModal.apply(this, args);
      if (selectedMovie && openForMovieId === selectedMovie) {
        html = html.replace(
          '<details class="cl-movie-detail-section cl-detail-editor">',
          '<details class="cl-movie-detail-section cl-detail-editor" open>'
        );
      }
      return html;
    };
  }

  // Wrap the final render function. Realtime updates still happen normally, but
  // the editor and scroll position are restored after the DOM is rebuilt.
  if (typeof render === 'function') {
    const originalRender = render;
    render = function(...args) {
      const movieIdBefore = selectedMovie;
      const modalBefore = document.querySelector('.cl-movie-detail-modal');
      const detailsBefore = document.querySelector('.cl-detail-editor');
      const scrollBefore = modalBefore ? modalBefore.scrollTop : lastScrollTop;

      if (movieIdBefore && detailsBefore?.open) openForMovieId = movieIdBefore;

      const result = originalRender.apply(this, args);

      if (movieIdBefore && selectedMovie === movieIdBefore) {
        requestAnimationFrame(() => {
          const modalAfter = document.querySelector('.cl-movie-detail-modal');
          const detailsAfter = document.querySelector('.cl-detail-editor');
          if (openForMovieId === movieIdBefore && detailsAfter) detailsAfter.open = true;
          if (modalAfter) modalAfter.scrollTop = scrollBefore || 0;
        });
      }
      return result;
    };
    window.render = render;
  }

  // Closing the movie intentionally resets the editor state so reopening a movie
  // later starts clean instead of forcing Edit open forever.
  if (typeof clCloseSavedMovieDetails === 'function') {
    const originalCloseSavedMovieDetails = clCloseSavedMovieDetails;
    clCloseSavedMovieDetails = function(event) {
      if (!event || event.target === event.currentTarget) {
        openForMovieId = null;
        lastScrollTop = 0;
      }
      return originalCloseSavedMovieDetails.apply(this, arguments);
    };
    window.clCloseSavedMovieDetails = clCloseSavedMovieDetails;
  }
})();
