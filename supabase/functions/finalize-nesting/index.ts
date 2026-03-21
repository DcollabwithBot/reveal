/**
 * finalize-nesting: Finalizes Russian Nesting Scope session
 *
 * POST body: { sessionId, parentItemId, approvedSubItems: [{ title, description, storyPoints }] }
 *
 * 1. Creates child session_items with parent_item_id
 * 2. Awards XP for participants
 * 3. Checks achievements (Archaeologist, Scope Slayer, The Decomposer)
 */
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

const TSHIRT_MAP: Record<string, number> = {
  XS: 1, S: 2, M: 3, L: 5, XL: 8, XXL: 13,
};

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
      authHeader.replace('Bearer ', ''),
    );
    if (authErr || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { sessionId, parentItemId, approvedSubItems } = await req.json();
    if (!sessionId || !parentItemId || !Array.isArray(approvedSubItems)) {
      throw new Error('sessionId, parentItemId, and approvedSubItems required');
    }

    // ── 1. Fetch session info ──────────────────────────────────────────────
    const { data: session } = await db
      .from('sessions')
      .select('organization_id, team_id, project_id')
      .eq('id', sessionId)
      .maybeSingle();
    if (!session) throw new Error('Session not found');

    // ── 2. Get parent item info ────────────────────────────────────────────
    const { data: parentItem } = await db
      .from('session_items')
      .select('estimate, project_id, position')
      .eq('id', parentItemId)
      .maybeSingle();

    // ── 3. Create child session_items ──────────────────────────────────────
    const createdItems = [];
    for (let i = 0; i < approvedSubItems.length; i++) {
      const sub = approvedSubItems[i];
      const sp = sub.storyPoints || TSHIRT_MAP[sub.tshirtSize] || null;

      const { data: newItem, error } = await db
        .from('session_items')
        .insert({
          session_id: sessionId,
          project_id: session.project_id || parentItem?.project_id,
          title: sub.title,
          description: sub.description || '',
          estimate: sp,
          parent_item_id: parentItemId,
          status: 'pending',
          position: (parentItem?.position || 0) + i + 1,
        })
        .select()
        .maybeSingle();

      if (!error && newItem) createdItems.push(newItem);
    }

    // ── 4. Award XP to all participants ───────────────────────────────────
    const { data: participants } = await db
      .from('session_participants')
      .select('user_id')
      .eq('session_id', sessionId);

    const participantIds = (participants || []).map(p => p.user_id);

    if (participantIds.length > 0) {
      const xpEvents = participantIds.map(uid => ({
        user_id: uid,
        amount: 20,
        source: 'nesting_scope_complete',
        session_id: sessionId,
      }));

      await db.from('xp_events').insert(xpEvents);
      for (const uid of participantIds) {
        await db.rpc('increment_user_xp', { uid, amount: 20 });
      }
    }

    // ── 5. Achievement: Scope Slayer ───────────────────────────────────────
    // Check if total estimate of sub-items is 20%+ less than original
    const originalEst = parentItem?.estimate || 0;
    const subTotal = approvedSubItems.reduce((s, si) => s + (si.storyPoints || TSHIRT_MAP[si.tshirtSize] || 0), 0);

    if (originalEst > 0 && subTotal > 0 && subTotal <= originalEst * 0.8) {
      const { data: achDef } = await db
        .from('achievement_definitions')
        .select('id')
        .eq('key', 'scope_slayer')
        .maybeSingle();

      if (achDef) {
        for (const uid of participantIds) {
          await db.from('user_achievements').upsert({
            user_id: uid,
            achievement_id: achDef.id,
            xp_at_unlock: 40,
          }, { onConflict: 'user_id,achievement_id', ignoreDuplicates: true });
        }
      }
    }

    // ── 6. Achievement: The Decomposer (5 nesting sessions) ───────────────
    for (const uid of participantIds) {
      const { count } = await db
        .from('xp_events')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', uid)
        .eq('source', 'nesting_scope_complete');

      if ((count || 0) >= 5) {
        const { data: achDef } = await db
          .from('achievement_definitions')
          .select('id')
          .eq('key', 'the_decomposer')
          .maybeSingle();

        if (achDef) {
          await db.from('user_achievements').upsert({
            user_id: uid,
            achievement_id: achDef.id,
            xp_at_unlock: 60,
          }, { onConflict: 'user_id,achievement_id', ignoreDuplicates: true });
        }
      }
    }

    return new Response(
      JSON.stringify({
        ok: true,
        created: createdItems.length,
        items: createdItems,
        scopeSlayerTriggered: originalEst > 0 && subTotal <= originalEst * 0.8,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  } catch (err) {
    console.error('finalize-nesting error:', err);
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
