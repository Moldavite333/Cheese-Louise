(function (root) {
  const normalize = value => String(value ?? '').normalize('NFKD')
    .replace(/\p{M}/gu, '').toLowerCase().replace(/[’‘']/g, '')
    .replace(/&/g, ' and ').replace(/[^\p{L}\p{N}]+/gu, ' ').trim();

  function parse(raw) {
    const clean = String(raw ?? '').trim().slice(0, 100);
    const match = clean.match(/^(.+?)(?:\s+|\s*\()(18\d{2}|19\d{2}|20\d{2}|21\d{2})\)?$/);
    const title = match ? match[1].trim() : clean;
    return {title, key: normalize(title), year: match ? Number(match[2]) : null};
  }

  function metadata(movie) {
    const value = movie.source_metadata;
    if (typeof value !== 'string') return value || {};
    try { return JSON.parse(value) || {}; } catch { return {}; }
  }

  function year(movie) {
    return Number(movie.year || movie.release_year || metadata(movie).year ||
      String(movie.premiere_date || '').slice(0, 4)) || null;
  }

  function release(movie, now = new Date()) {
    const meta = metadata(movie);
    const premiere = meta.premiere || {};
    const at = premiere.verified && /(?:Z|[+-]\d{2}:\d{2})$/.test(premiere.at || '') ? Date.parse(premiere.at) : NaN;
    if (Number.isFinite(at)) return at > now.getTime() ? 'upcoming' : 'released';
    const date = String(movie.premiere_date || '');
    const today = [now.getFullYear(), now.getMonth() + 1, now.getDate()]
      .map((part, index) => String(part).padStart(index ? 2 : 4, '0')).join('-');
    if (/^\d{4}-\d{2}-\d{2}$/.test(date)) return date === today ? 'today' : date > today ? 'upcoming' : 'released';
    const releaseYear = year(movie);
    if (!releaseYear) return 'unknown';
    return releaseYear < now.getFullYear() ? 'released' : 'unknown';
  }

  function cast(movie) {
    const meta = metadata(movie);
    return [...new Set([movie.stars, movie.cast, meta.stars, meta.cast].flat()
      .map(person => typeof person === 'string' ? person : person?.name).filter(Boolean))];
  }

  function words(key) {
    return key.split(' ').filter(word => word && !['a', 'an', 'the', 'to', 'of', 'in', 'and'].includes(word));
  }

  function studios(movie) {
    const meta = metadata(movie);
    return [movie.network, movie.studio, movie.production_company, movie.production_companies,
      meta.production_company, meta.production_companies].flat()
      .map(value => typeof value === 'string' ? value : value?.name).filter(Boolean);
  }

  function plotScore(movie, query) {
    const terms = words(query.key).filter(word => !['movie','film','with','about','where','who','that','find','at','for','from'].includes(word));
    const plot = normalize([movie.title, movie.summary, movie.synopsis, movie.overview].filter(Boolean).join(' '));
    const tokens = new Set(plot.split(' '));
    const hits = terms.filter(term => tokens.has(term) ||
      (term.length > 4 && [...tokens].some(token => token.startsWith(term))) ||
      (term === 'travel' && /\b(time travels?|travels? (back in|through) time)\b/.test(plot))).length;
    return terms.length >= 2 && hits >= Math.max(2, Math.ceil(terms.length * 0.75)) ? 40 + hits : 0;
  }

  function oneEdit(a, b) {
    if (Math.abs(a.length - b.length) > 1) return false;
    let i = 0;
    while (i < a.length && a[i] === b[i]) i++;
    if (a.length === b.length) {
      return a.slice(i + 1) === b.slice(i + 1) ||
        (a[i] === b[i + 1] && a[i + 1] === b[i] && a.slice(i + 2) === b.slice(i + 2));
    }
    return a.length > b.length ? a.slice(i + 1) === b.slice(i) : a.slice(i) === b.slice(i + 1);
  }

  function score(movie, query) {
    if (!query.key) return 0;
    const canonical = normalize(movie.title), meta = metadata(movie);
    const alternate = [movie.original_title, meta.original_title, movie.verified_aliases, meta.verified_aliases]
      .flat().map(value => normalize(typeof value === 'object' ? value?.title : value)).filter(Boolean);
    const requestedYear = query.year && year(movie) === query.year ? 1 : 0;
    if (canonical === query.key) return requestedYear ? 700 : 600;
    if (alternate.includes(query.key)) return 500 + requestedYear;
    if ([canonical, ...alternate].some(title => title.startsWith(query.key))) return 400 + requestedYear;
    const requestedWords = words(query.key);
    if (requestedWords.length) {
      for (const title of [canonical, ...alternate]) {
        const titleWords = words(title);
        if (requestedWords.every(word => titleWords.includes(word))) return 300 + requestedYear;
      }
      for (const title of [canonical, ...alternate]) {
        const titleWords = words(title);
        if (requestedWords.length !== titleWords.length || query.key.length < 5) continue;
        const changes = requestedWords.filter((word, i) => word !== titleWords[i]);
        if (changes.length === 1 && requestedWords.every((word, i) => word === titleWords[i] ||
          (word.length >= 3 && titleWords[i].length >= 4 && oneEdit(word, titleWords[i])))) return 200 + requestedYear;
      }
    }
    const credits = [...cast(movie), ...studios(movie)].map(normalize);
    if (credits.some(name => name.includes(query.key))) return 120 + requestedYear;
    const identityWords = new Set(words([canonical, ...alternate, ...credits].join(' ')));
    if (requestedWords.length > 1 && requestedWords.every(word => identityWords.has(word))) return 110 + requestedYear;
    return plotScore(movie, query);
  }

  function compare(a, b, query) {
    return (b.title_search_score ?? score(b, query)) - (a.title_search_score ?? score(a, query)) ||
      normalize(a.title).localeCompare(normalize(b.title), 'en') ||
      (year(b) || 0) - (year(a) || 0) ||
      String(a.id ?? a.catalog_id ?? a.tmdb_id).localeCompare(String(b.id ?? b.catalog_id ?? b.tmdb_id), 'en');
  }

  function confident(movie, query) {
    return (movie.title_search_score ?? score(movie, query)) >= 500 &&
      (!query.year || year(movie) === query.year);
  }

  function recorded(movie, episodes = []) {
    return movie?.status === 'recorded' || (!!movie?.id && episodes.some(episode =>
      episode.movie_id === movie.id && ['recorded', 'released', 'published'].includes(episode.status)));
  }

  root.clMovieTitleSearch = {normalize, parse, metadata, year, cast, studios, score, compare, confident, release, recorded};
})(globalThis);
