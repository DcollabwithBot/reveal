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
    const { session_id, item_title } = await req.json();
    if (!item_title) {
      return new Response(JSON.stringify({ error: 'item_title required' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Find similar historical items using ilike pattern matching
    // Extract keywords from item_title (split on spaces, use words > 3 chars)
    const keywords = item_title
      .toLowerCase()
      .split(/\s+/)
      .filter((w: string) => w.length > 3)
      .slice(0, 3);

    if (keywords.length === 0) {
      return new Response(JSON.stringify({
        avg_estimate: null,
        min_estimate: null,
        max_estimate: null,
        similar_items_count: 0,
        error: 'Item title too short for AI analysis',
      }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // Query for items with similar titles that have final estimates
    let query = supabase
      .from('session_items')
      .select('title, final_estimate, actual_hours')
      .not('final_estimate', 'is', null);

    // Apply keyword filters (OR logic — any keyword match)
    // Use the first keyword as primary filter
    query = query.ilike('title', `%${keywords[0]}%`);

    const { data: similar, error } = await query.limit(50);

    if (error || !similar?.length) {
      // Fallback: just return no data
      return new Response(JSON.stringify({
        avg_estimate: null,
        min_estimate: null,
        max_estimate: null,
        similar_items_count: 0,
        error: 'Ingen historiske items fundet med lignende titel',
      }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // Filter to items where the title contains at least one keyword
    const matched = similar.filter(item => {
      const titleLower = item.title?.toLowerCase() || '';
      return keywords.some((kw: string) => titleLower.includes(kw));
    });

    if (!matched.length) {
      return new Response(JSON.stringify({
        avg_estimate: null, min_estimate: null, max_estimate: null,
        similar_items_count: 0,
        error: 'Ingen matches fundet',
      }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const estimates = matched.map(i => Number(i.final_estimate)).filter(Boolean);
    const avg = Math.round(estimates.reduce((a, b) => a + b, 0) / estimates.length);
    const min = Math.min(...estimates);
    const max = Math.max(...estimates);

    // Also check explosion rate for context
    const exploded = matched.filter(i => i.actual_hours && i.actual_hours > i.final_estimate * 2);
    const explosionRate = matched.length > 0 ? Math.round((exploded.length / matched.length) * 100) : 0;

    return new Response(JSON.stringify({
      avg_estimate: avg,
      min_estimate: min,
      max_estimate: max,
      similar_items_count: estimates.length,
      explosion_rate_pct: explosionRate,
      examples: matched.slice(0, 3).map(i => ({
        title: i.title,
        estimate: i.final_estimate,
        actual: i.actual_hours,
      })),
    }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
