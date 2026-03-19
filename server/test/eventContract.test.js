const test = require('node:test');
const assert = require('node:assert/strict');

const { validateEventEnvelope } = require('../domain/eventContract');

function validEvent(overrides = {}) {
  return {
    eventId: 'evt_001',
    eventType: 'game.suggestion.created',
    occurredAt: new Date().toISOString(),
    source: 'game',
    idempotencyKey: 'idem_001',
    payload: { suggestionId: 'sug_001' },
    ...overrides
  };
}

test('event contract: accepts valid event envelope', () => {
  const normalized = validateEventEnvelope(validEvent());
  assert.equal(normalized.eventType, 'game.suggestion.created');
});

test('event contract: rejects malformed schema', () => {
  assert.throws(() => validateEventEnvelope(validEvent({ eventType: 'unknown.type' })), /unsupported/);
  assert.throws(() => validateEventEnvelope(validEvent({ occurredAt: 'not-a-date' })), /occurredAt/);
  assert.throws(() => validateEventEnvelope(validEvent({ idempotencyKey: '' })), /idempotencyKey/);
});

