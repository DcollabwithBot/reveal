const { validateEventEnvelope } = require('./eventContract');

class SupabaseEventLedger {
  constructor({ supabase }) {
    this.supabase = supabase;
  }

  async register({ event, direction = 'ingest' }) {
    const normalized = validateEventEnvelope(event);
    const { data, error } = await this.supabase
      .from('event_ledger')
      .insert({
        event_id: normalized.eventId,
        idempotency_key: normalized.idempotencyKey,
        event_type: normalized.eventType,
        occurred_at: normalized.occurredAt,
        source: normalized.source,
        direction,
        payload: normalized.payload
      })
      .select('id,event_id,idempotency_key,event_type,direction,created_at')
      .single();

    if (error) {
      if (error.code === '23505' || /duplicate key/i.test(error.message || '')) {
        const duplicate = new Error('Duplicate event replay detected');
        duplicate.code = 'DUPLICATE_EVENT';
        throw duplicate;
      }
      throw new Error(error.message || 'Unable to persist event ledger record');
    }

    return data;
  }
}

module.exports = {
  SupabaseEventLedger
};
