import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const db = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      auth: { persistSession: false },
    });

    const anonKey = Deno.env.get('SUPABASE_ANON_KEY') || '';
    const authHeader = req.headers.get('Authorization') || '';
    const anonClient = createClient(SUPABASE_URL, anonKey);
    const { data: { user }, error: authErr } = await anonClient.auth.getUser(
      authHeader.replace('Bearer ', '')
    );
    if (authErr || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { sessionId, itemId } = await req.json();
    if (!sessionId || !itemId) throw new Error('sessionId and itemId required');

    // ── Fetch session for org/team ─────────────────────────────────────────
    const { data: session } = await db
      .from('sessions')
      .select('organization_id, team_id')
      .eq('id', sessionId)
      .maybeSingle();
    if (!session) throw new Error('Session not found');

    // ── Compute average scores for each submission ─────────────────────────
    const { data: submissions } = await db
      .from('spec_submissions')
      .select('id, author_id, content, vote_count, score')
      .eq('session_id', sessionId)
      .eq('session_item_id', itemId);

    if (!submissions?.length) {
      return new Response(JSON.stringify({ ok: true, winner: null }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Compute vote averages from spec_votes
    for (const sub of submissions) {
      const { data: votes } = await db
        .from('spec_votes')
        .select('rating')
        .eq('submission_id', sub.id);

      if (votes?.length) {
        const avg = votes.reduce((s, v) => s + v.rating, 0) / votes.length;
        await db
          .from('spec_submissions')
          .update({ score: avg, vote_count: votes.length })
          .eq('id', sub.id);
        sub.score = avg;
        sub.vote_count = votes.length;
      }
    }

    // ── Find winner (highest score, tie → earliest submission) ─────────────
    const sorted = [...submissions].sort((a, b) => (b.score - a.score) || 0);
    const winner = sorted[0];

    // Mark winner
    await db
      .from('spec_submissions')
      .update({ is_winner: true })
      .eq('id', winner.id);

    // Clear previous winners for this item
    await db
      .from('spec_submissions')
      .update({ is_winner: false })
      .eq('session_id', sessionId)
      .eq('session_item_id', itemId)
      .neq('id', winner.id);

    // ── Create approval request for acceptance_criteria write-back ─────────
    const { data: approval } = await db
      .from('approval_requests')
      .insert({
        organization_id: session.organization_id,
        team_id: session.team_id,
        target_type: 'spec_wars_acceptance_criteria',
        target_id: itemId,
        requested_by: user.id,
        requested_patch: {
          session_id: sessionId,
          session_item_id: itemId,
          acceptance_criteria: winner.content,
          winning_submission_id: winner.id,
          winner_author_id: winner.author_id,
          score: winner.score,
        },
        status: 'pending',
      })
      .select()
      .single();

    // Award XP + badge to winner
    // Award Spec Machine achievement
    try {
      await fetch(`${SUPABASE_URL}/functions/v1/award-xp-badges`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
        },
        body: JSON.stringify({
          user_id: winner.author_id,
          event: 'spec_wars_winner',
          xp: 20,
          badge_key: 'spec_machine',
          organization_id: session.organization_id,
        }),
      });
    } catch { /* non-fatal */ }

    return new Response(
      JSON.stringify({ ok: true, winner_id: winner.id, approval_id: approval?.id }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (err) {
    console.error('finalize-spec-wars error:', err);
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
