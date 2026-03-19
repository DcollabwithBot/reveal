const test = require('node:test');
const assert = require('node:assert/strict');

const { EventReplayGuard, validateEventEnvelope } = require('../domain/eventContract');

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

test('event contract: replay guard blocks duplicate idempotency key', () => {
  const guard = new EventReplayGuard();
  assert.equal(guard.register('idem_001'), true);
  assert.throws(() => guard.register('idem_001'), /Duplicate event replay detected/);
});
