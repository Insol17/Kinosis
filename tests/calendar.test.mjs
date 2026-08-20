import assert from 'node:assert/strict';
import { selectCalendarLead, uniqueCalendarMovieCount } from '../assets/js/features/calendar.js';

const logs = [
  { id:'a', movieId:'10', watchedAt:'2026-08-20', ratingSnapshot:4.5, createdAt:'2026-08-20T09:00:00Z' },
  { id:'b', movieId:'20', watchedAt:'2026-08-20', ratingSnapshot:5, createdAt:'2026-08-20T08:00:00Z' },
  { id:'c', movieId:'30', watchedAt:'2026-08-20', ratingSnapshot:5, createdAt:'2026-08-20T10:00:00Z' },
  { id:'d', movieId:'30', watchedAt:'2026-08-20', ratingSnapshot:5, createdAt:'2026-08-20T07:00:00Z' },
];
assert.equal(selectCalendarLead(logs)?.id, 'c', 'highest rating wins; rating tie must use latest-recorded event');
assert.equal(uniqueCalendarMovieCount(logs), 3, 'calendar 외 N편 must count unique movies, not viewing events');

const fallback = [
  { id:'x', movieId:'40', createdAt:'2026-08-20T08:00:00Z' },
  { id:'y', movieId:'50', createdAt:'2026-08-20T09:00:00Z' },
];
assert.equal(selectCalendarLead(fallback, (id) => id === '40' ? 4.5 : 4)?.id, 'x', 'current relationship rating may rank an unscored viewing event');
console.log('calendar.test: cinematic representative + unique-film count policy OK');
