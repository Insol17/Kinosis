function stamp(date) { return `${date}T20:00:00.000Z`; }

export function createDemoState(catalog = [], baseFactory = () => ({})) {
  const base = baseFactory();
  const rows = (catalog || []).filter((movie) => movie?.id).slice(0, 18);
  const ids = rows.map((movie) => String(movie.id));
  const now = new Date().toISOString();
  base.profile = { name: 'KINOSIS Demo', handle: 'demo', bio: '영화를 모으고, 보고, 기록하는 개인 영화장.', updatedAt: now };
  base.subscriptions = ['Netflix', 'WATCHA'];
  base.library = {};
  base.relationships = {};
  base.logs = [];
  base.collections = [];
  base.movieCache = {};
  rows.forEach((movie) => { base.movieCache[String(movie.id)] = { ...movie, source: 'demo-snapshot', detailLoaded: false }; });

  const viewingDates = ['2026-08-03','2026-08-05','2026-08-07','2026-08-10','2026-08-14','2026-08-18','2026-07-12','2026-07-26','2026-06-21','2026-05-09'];
  ids.slice(0, 10).forEach((id, index) => {
    const when = viewingDates[index];
    base.library[id] = { savedAt: stamp(when), updatedAt: stamp(when) };
    base.relationships[id] = {
      rating: [4.5, 4, 5, 3.5, 4.5, 4, 3, 5, 4, 4.5][index],
      comment: index < 5 ? ['다시 꺼내보고 싶은 영화.', '이미지보다 리듬이 오래 남는다.', '끝난 뒤에 더 커지는 장면.', '좋아하는 이유가 명확해진 영화.', '한동안 머릿속에서 떠나지 않았다.'][index] : '',
      watchlist: false,
      favorite: [0, 2, 4, 7].includes(index),
      updatedAt: stamp(when),
    };
    base.logs.push({ id: `demo-log-${index}`, movieId: id, watchedAt: when, rewatch: false, ratingSnapshot: base.relationships[id].rating, note: index % 3 === 0 ? '첫 감상 기록.' : '', createdAt: stamp(when), updatedAt: stamp(when) });
  });
  if (ids[0]) base.logs.push({ id: 'demo-log-rewatch-1', movieId: ids[0], watchedAt: '2026-08-12', rewatch: true, ratingSnapshot: 5, note: '재관람하면서 평점이 올랐다.', createdAt: stamp('2026-08-12'), updatedAt: stamp('2026-08-12') });
  if (ids[2]) base.logs.push({ id: 'demo-log-rewatch-2', movieId: ids[2], watchedAt: '2026-08-16', rewatch: true, ratingSnapshot: 4.5, note: '두 번째 감상.', createdAt: stamp('2026-08-16'), updatedAt: stamp('2026-08-16') });

  ids.slice(10, 14).forEach((id, index) => {
    base.relationships[id] = { rating: null, comment: '', watchlist: true, favorite: false, updatedAt: stamp(`2026-08-${10 + index}`) };
  });
  base.collections = [
    { id: 'demo-col-1', name: '2026 Best', description: '올해 다시 꺼내보고 싶은 영화', movieIds: ids.slice(0, 5), coverMovieId: ids[0] || null, type: 'manual', createdAt: now, updatedAt: now },
    { id: 'demo-col-2', name: '여름밤', description: '늦은 밤에 다시 볼 영화', movieIds: ids.slice(3, 8), coverMovieId: ids[3] || null, type: 'manual', createdAt: now, updatedAt: now },
    { id: 'demo-col-3', name: '다시 보기', description: '재관람 후보', movieIds: ids.slice(6, 10), coverMovieId: ids[6] || null, type: 'manual', createdAt: now, updatedAt: now },
  ];
  base.meta ||= {};
  base.meta.syncVersion = 8;
  base.meta.modifiedAt = now;
  base.meta.dirtySince = null;
  base.meta.localRevision = 0;
  return base;
}
