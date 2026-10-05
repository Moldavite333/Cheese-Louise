// Cheese Louise HQ — interaction stability pass.
// Complex work surfaces should close only when the user explicitly asks them to.

(() => {
  // Prevent accidental click-outside closure of modal work surfaces. Trackpad drift,
  // scrollbar misses, or tiny pointer slips should never throw away the user's place.
  document.addEventListener('click', event => {
    if (event.target?.matches?.('.modal-backdrop')) {
      event.preventDefault();
      event.stopPropagation();
    }
  }, true);

  // Escape remains a deliberate, predictable way to close the active modal.
  document.addEventListener('keydown', event => {
    if (event.key !== 'Escape') return;
    const topModal = document.querySelector('.modal-backdrop .modal');
    if (!topModal) return;
    const closeButton = topModal.querySelector('.close, [data-close-modal]');
    if (closeButton) {
      event.preventDefault();
      closeButton.click();
    }
  });

  // Once the saved-movie Cheese Trait editor is opened, keep it open for the rest
  // of that movie-detail session. This eliminates accidental summary clicks and
  // complements trait-editor-persist.js, which already protects against rerenders.
  const lockedEditors = new WeakSet();
  document.addEventListener('toggle', event => {
    const details = event.target;
    if (!details?.matches?.('.cl-detail-editor')) return;

    if (details.open) {
      lockedEditors.add(details);
      return;
    }

    if (lockedEditors.has(details) && document.body.contains(details)) {
      requestAnimationFrame(() => {
        if (document.body.contains(details)) details.open = true;
      });
    }
  }, true);
})();
