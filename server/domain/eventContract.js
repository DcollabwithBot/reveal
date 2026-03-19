const ALLOWED_EVENT_TYPES = new Set([
  'game.suggestion.created',
  'approval.request.created',
  'approval.request.updated',
  'approval.request.applied'
]);

/**
 * Validate event envelope for Reveal v3.1 contract baseline.
 * Returns normalized event if valid, throws otherwise.
 */
function validateEventEnvelope(event) {
  if (!event || typeof event !== 'object') {
    throw new Error('Event must be an object');
  }

  const { eventId, eventType, occurredAt, source, idempotencyKey, payload } = event;

  if (!eventId || typeof eventId !== 'string') {
    throw new Error('eventId is required');
  }
  if (!eventType || typeof eventType !== 'string' || !ALLOWED_EVENT_TYPES.has(eventType)) {
    throw new Error('eventType is invalid or unsupported');
  }
  if (!occurredAt || Number.isNaN(Date.parse(occurredAt))) {
    throw new Error('occurredAt must be an ISO date string');
  }
  if (!source || !['game', 'pm', 'system'].includes(source)) {
    throw new Error('source must be one of game|pm|system');
  }
  if (!idempotencyKey || typeof idempotencyKey !== 'string') {
    throw new Error('idempotencyKey is required');
  }
  if (!payload || typeof payload !== 'object') {
    throw new Error('payload is required');
  }

  return {
    eventId,
    eventType,
    occurredAt,
    source,
    idempotencyKey,
    payload
  };
}

module.exports = {
  ALLOWED_EVENT_TYPES,
  validateEventEnvelope
};
