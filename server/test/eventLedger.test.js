const test = require('node:test');
const assert = require('node:assert/strict');

const { SupabaseEventLedger } = require('../domain/eventLedger');

function createSupabaseStub({ mode = 'ok' } = {}) {
  return {
    from() {
      return {
        insert() {
          return {
            select() {
              return {
                async single() {
                  if (mode === 'duplicate') {
                    return { data: null, error: { code: '23505', message: 'duplicate key value violates unique constraint' } };
                  }
                  if (mode === 'error') {
                    return { data: null, error: { code: 'XX000', message: 'db down' } };
                  }
                  return {
                    data: {
                      id: 'ledger_1',
                      event_id: 'evt_001',
                      idempotency_key: 'idem_001',
                      event_type: 'approval.request.created',
                      direction: 'ingest',
                      created_at: new Date().toISOString()
                    },
                    error: null
                  };
                }
              };
            }
          };
        }
      };
    }
  };
}

function validEvent() {
  return {
    eventId: 'evt_001',
    eventType: 'approval.request.created',
    occurredAt: new Date().toISOString(),
    source: 'game',
    idempotencyKey: 'idem_001',
    payload: { foo: 'bar' }
  };
}

test('event ledger: persists a valid event', async () => {
  const ledger = new SupabaseEventLedger({ supabase: createSupabaseStub() });
  const result = await ledger.register({ event: validEvent(), direction: 'ingest' });
  assert.equal(result.idempotency_key, 'idem_001');
});

test('event ledger: maps DB duplicate errors to duplicate event error', async () => {
  const ledger = new SupabaseEventLedger({ supabase: createSupabaseStub({ mode: 'duplicate' }) });
  await assert.rejects(
    () => ledger.register({ event: validEvent(), direction: 'ingest' }),
    /Duplicate event replay detected/
  );
});

test('event ledger: throws generic persistence errors', async () => {
  const ledger = new SupabaseEventLedger({ supabase: createSupabaseStub({ mode: 'error' }) });
  await assert.rejects(
    () => ledger.register({ event: validEvent(), direction: 'ingest' }),
    /db down/
  );
});
