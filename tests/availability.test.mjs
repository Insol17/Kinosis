import assert from 'node:assert/strict';
import { applyAvailabilityOverride } from '../shared/availability-overrides.mjs';

const base = { providers: [{ id: 1, name: 'Netflix', type: 'subscription' }], theatricalStatus: 'past', availabilitySources: ['tmdb-justwatch'] };
const eureka = applyAvailabilityOverride('38047', 'KR', base);
assert.equal(eureka.theatricalStatus, 'past');
assert.ok(eureka.providers.some((row) => row.name === 'WATCHA' && row.type === 'subscription'));
assert.ok(eureka.providers.some((row) => row.name === 'YouTube' && row.type === 'rent'));
assert.ok(eureka.providers.some((row) => row.name === 'YouTube' && row.type === 'buy'));
assert.ok(eureka.availabilitySources.includes('kinosis-verified'));
assert.equal(applyAvailabilityOverride('999', 'KR', base), base);
console.log('availability.test: verified supplement + theatrical override contracts OK');
