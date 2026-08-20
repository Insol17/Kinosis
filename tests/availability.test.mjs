import assert from 'node:assert/strict';
import { applyAvailabilityOverride } from '../shared/availability-overrides.mjs';

const base = { providers: [{ id: 1, name: 'Netflix', type: 'subscription' }], theatricalStatus: 'past', availabilitySources: ['tmdb-justwatch'] };
const eureka = applyAvailabilityOverride('38047', 'KR', base);
assert.equal(eureka.theatricalStatus, 'past');
assert.ok(eureka.providers.some((row) => row.name === 'WATCHA' && row.type === 'subscription'));
assert.equal(eureka.providers.find((row) => row.name === 'WATCHA' && row.type === 'subscription')?.confidence, 'verified');
const staleWatcha = applyAvailabilityOverride('38047', 'KR', { providers: [{ id: 97, name: 'WATCHA', type: 'subscription', source: 'tmdb-justwatch', confidence: 'reported' }], availabilitySources: ['tmdb-justwatch'] });
assert.equal(staleWatcha.providers.length, 3, 'verified correction should upgrade duplicate aggregator provider, not duplicate it');
assert.equal(staleWatcha.providers.find((row) => row.name === 'WATCHA')?.confidence, 'verified');
assert.equal(staleWatcha.providers.find((row) => row.name === 'WATCHA')?.source, 'kinosis-verified');
assert.ok(eureka.providers.some((row) => row.name === 'YouTube' && row.type === 'rent'));
assert.ok(eureka.providers.some((row) => row.name === 'YouTube' && row.type === 'buy'));
assert.ok(eureka.availabilitySources.includes('kinosis-verified'));
assert.equal(applyAvailabilityOverride('999', 'KR', base), base);
console.log('availability.test: verified supplement + theatrical override contracts OK');
