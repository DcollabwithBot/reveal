/**
 * finalize-bluff: Resolves Bluff Poker round
 *
 * POST body: { sessionId, itemId }
 *
 * 1. Looks up bluff_assignments to get bluffer
 * 2. Evaluates bluff_guesses — marks correct/incorrect
 * 3. Awards XP: +10 for correct guessers, +15 for surviving bluffer
 * 4. Sets bluff_estimates.correct flag
 * 5. Checks & awards achievements
 */
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
      authHeader.replace('Bearer ', ''),
    );
    if (authErr || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { sessionId, itemId } = await req.json();
    if (!sessionId || !itemId) throw new Error('sessionId and itemId required');

    // ── 1. Get bluffer assignment ──────────────────────────────────────────
    const { data: assignment } = await db
      .from('bluff_assignments')
      .select('bluffer_user_id')
      .eq('session_id', sessionId)
      .eq('item_id', itemId)
      .maybeSingle();

    if (!assignment) {
      return new Response(JSON.stringify({ error: 'No bluff assignment found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const blufferId = assignment.bluffer_user_id;

    // ── 2. Evaluate guesses ────────────────────────────────────────────────
    const { data: guesses } = await db
      .from('bluff_guesses')
      .select('id, guesser_id, suspected_user_id')
      .eq('session_id', sessionId)
      .eq('item_id', itemId);

    const correctGuessers: string[] = [];
    const incorrectGuessers: string[] = [];

    for (const guess of (guesses || [])) {
      const isCorrect = guess.suspected_user_id === blufferId;
      await db
        .from('bluff_guesses')
        .update({ correct: isCorrect })
        .eq('id', guess.id);

      if (isCorrect) correctGuessers.push(guess.guesser_id);
      else incorrectGuessers.push(guess.guesser_id);
    }

    const blufferSurvived = correctGuessers.length === 0;

    // ── 3. Award XP ────────────────────────────────────────────────────────
    const xpEvents = [];

    // +10 XP for each correct guesser
    for (const uid of correctGuessers) {
      xpEvents.push({ user_id: uid, amount: 10, source: 'bluff_poker_detective', session_id: sessionId });
    }

    // +15 XP if bluffer survived
    if (blufferSurvived) {
      xpEvents.push({ user_id: blufferId, amount: 15, source: 'bluff_poker_survived', session_id: sessionId });
    }

    if (xpEvents.length > 0) {
      await db.from('xp_events').insert(xpEvents);

      // Update profile xp totals
      for (const ev of xpEvents) {
        await db.rpc('increment_user_xp', { uid: ev.user_id, amount: ev.amount });
      }
    }

    // ── 4. Check achievement: Master Bluffer ──────────────────────────────
    if (blufferSurvived) {
      // Count how many times this user has survived as bluffer
      const { count } = await db
        .from('xp_events')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', blufferId)
        .eq('source', 'bluff_poker_survived');

      if ((count || 0) >= 3) {
        const { data: achDef } = await db
          .from('achievement_definitions')
          .select('id')
          .eq('key', 'master_bluffer')
          .maybeSingle();

        if (achDef) {
          await db.from('user_achievements').upsert({
            user_id: blufferId,
            achievement_id: achDef.id,
            xp_at_unlock: 50,
          }, { onConflict: 'user_id,achievement_id', ignoreDuplicates: true });
        }
      }
    }

    // Check achievement: Detective (5 correct guesses)
    for (const uid of correctGuessers) {
      const { count } = await db
        .from('bluff_guesses')
        .select('id', { count: 'exact', head: true })
        .eq('guesser_id', uid)
        .eq('correct', true);

      if ((count || 0) >= 5) {
        const { data: achDef } = await db
          .from('achievement_definitions')
          .select('id')
          .eq('key', 'detective')
          .maybeSingle();

        if (achDef) {
          await db.from('user_achievements').upsert({
            user_id: uid,
            achievement_id: achDef.id,
            xp_at_unlock: 40,
          }, { onConflict: 'user_id,achievement_id', ignoreDuplicates: true });
        }
      }
    }

    // ── 5. Get estimates for consensus check (Poker Face achievement) ─────
    const { data: estimates } = await db
      .from('bluff_estimates')
      .select('user_id, estimate')
      .eq('session_id', sessionId)
      .eq('item_id', itemId)
      .eq('round', 1);

    if (estimates && estimates.length > 0) {
      const values = estimates.map(e => e.estimate);
      const avg = values.reduce((a, b) => a + b, 0) / values.length;
      const blufferEst = estimates.find(e => e.user_id === blufferId)?.estimate;

      if (blufferEst != null && Math.abs(blufferEst - avg) <= 1) {
        const { data: achDef } = await db
          .from('achievement_definitions')
          .select('id')
          .eq('key', 'poker_face')
          .maybeSingle();

        if (achDef) {
          await db.from('user_achievements').upsert({
            user_id: blufferId,
            achievement_id: achDef.id,
            xp_at_unlock: 30,
          }, { onConflict: 'user_id,achievement_id', ignoreDuplicates: true });
        }
      }
    }

    return new Response(
      JSON.stringify({
        ok: true,
        blufferId,
        blufferSurvived,
        correctGuessers,
        xpAwarded: xpEvents.map(e => ({ userId: e.user_id, amount: e.amount })),
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  } catch (err) {
    console.error('finalize-bluff error:', err);
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
