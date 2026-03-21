import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

function median(nums: number[]): number {
  if (!nums.length) return 0;
  const sorted = [...nums].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? (sorted[mid - 1] + sorted[mid]) / 2
    : sorted[mid];
}

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

    const { sessionId, itemId, revotes } = await req.json();
    // revotes: [{ user_id, estimate }]
    if (!sessionId || !itemId) throw new Error('sessionId and itemId required');

    const { data: session } = await db
      .from('sessions')
      .select('organization_id, team_id')
      .eq('id', sessionId)
      .maybeSingle();
    if (!session) throw new Error('Session not found');

    // ── Get first-round votes with perspective assignments ─────────────────
    const { data: assignments } = await db
      .from('perspective_assignments')
      .select('user_id, perspective')
      .eq('session_id', sessionId)
      .eq('session_item_id', itemId);

    const perspectiveMap: Record<string, string> = {};
    (assignments || []).forEach(a => { perspectiveMap[a.user_id] = a.perspective; });

    // ── Compute final estimate (median of re-votes) ────────────────────────
    const revoteEstimates: number[] = (revotes || []).map((r: { estimate: number }) => r.estimate).filter((n: unknown) => typeof n === 'number');
    const finalEstimate = median(revoteEstimates);

    // ── Get first-round votes from votes table ─────────────────────────────
    const { data: firstVotes } = await db
      .from('votes')
      .select('user_id, estimate')
      .eq('session_id', sessionId)
      .eq('session_item_id', itemId);

    const firstByPerspective: Record<string, number[]> = {};
    (firstVotes || []).forEach((v: { user_id: string; estimate: number }) => {
      const p = perspectiveMap[v.user_id] || 'developer';
      if (!firstByPerspective[p]) firstByPerspective[p] = [];
      firstByPerspective[p].push(v.estimate);
    });

    // ── Gap analysis ───────────────────────────────────────────────────────
    const perspectiveMedians: Record<string, number> = {};
    for (const [p, vals] of Object.entries(firstByPerspective)) {
      perspectiveMedians[p] = median(vals);
    }

    const allMedians = Object.values(perspectiveMedians);
    const gap = allMedians.length >= 2
      ? Math.max(...allMedians) - Math.min(...allMedians)
      : 0;

    // ── Generate risk_notes if gap is large ────────────────────────────────
    let riskNotes: string | null = null;
    if (gap >= 3) {
      const highPerspective = Object.entries(perspectiveMedians)
        .sort((a, b) => b[1] - a[1])[0];
      const lowPerspective = Object.entries(perspectiveMedians)
        .sort((a, b) => a[1] - b[1])[0];
      riskNotes = `⚠️ Perspektiv-gap: ${gap.toFixed(1)} point spread\n` +
        `Højest: ${highPerspective[0]} (${highPerspective[1]})\n` +
        `Lavest: ${lowPerspective[0]} (${lowPerspective[1]})\n` +
        `Diskuter kompleksitet og risici fra ${highPerspective[0]}-perspektivet.`;
    }

    // ── Create approval request for final_estimate + risk_notes ───────────
    const { data: approval } = await db
      .from('approval_requests')
      .insert({
        organization_id: session.organization_id,
        team_id: session.team_id,
        target_type: 'perspective_poker_estimate',
        target_id: itemId,
        requested_by: user.id,
        requested_patch: {
          session_id: sessionId,
          session_item_id: itemId,
          final_estimate: finalEstimate,
          risk_notes: riskNotes,
          perspective_breakdown: perspectiveMedians,
          gap_score: gap,
        },
        status: 'pending',
      })
      .select()
      .single();

    // Award Perspective Master badge if gap was closed (large gap → player narrowed it)
    if (gap >= 3 && revotes?.length) {
      for (const rv of revotes) {
        await fetch(`${SUPABASE_URL}/functions/v1/award-xp-badges`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
          },
          body: JSON.stringify({
            user_id: rv.user_id,
            event: 'perspective_gap_closed',
            xp: 25,
            badge_key: 'perspective_master',
            organization_id: session.organization_id,
          }),
        }).catch(() => {});
      }
    }

    return new Response(
      JSON.stringify({
        ok: true,
        final_estimate: finalEstimate,
        gap,
        risk_notes: riskNotes,
        perspective_breakdown: perspectiveMedians,
        approval_id: approval?.id,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (err) {
    console.error('finalize-perspective error:', err);
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
