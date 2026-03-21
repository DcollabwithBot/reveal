import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

const RISK_KEYWORDS = [
  'integrat', 'migration', 'refactor', 'legacy', 'api', 'third-party',
  'auth', 'permission', 'import', 'export', 'sync', 'deploy', 'infrastructure',
  'performance', 'optimiz',
];

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { item_title, estimate } = await req.json();
    if (!item_title) {
      return new Response(JSON.stringify({ error: 'item_title required' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Fetch historical exploded items
    const { data: historicalItems } = await supabase
      .from('session_items')
      .select('title, final_estimate, actual_hours')
      .not('final_estimate', 'is', null)
      .not('actual_hours', 'is', null)
      .gt('actual_hours', 0)
      .limit(500);

    if (!historicalItems?.length) {
      return new Response(JSON.stringify({ risk_score: 0, examples: [], warning_text: null }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const titleLower = item_title.toLowerCase();
    const exploded = historicalItems.filter(i => i.actual_hours > i.final_estimate * 2);

    // Find similar items
    const keywords = item_title.toLowerCase().split(/\s+/).filter((w: string) => w.length > 3);
    const similar = historicalItems.filter(i =>
      keywords.some((kw: string) => i.title?.toLowerCase().includes(kw))
    );
    const similarExploded = similar.filter(i => i.actual_hours > i.final_estimate * 2);

    let riskScore = 0;
    const reasons: string[] = [];

    // Keyword risk
    for (const kw of RISK_KEYWORDS) {
      if (titleLower.includes(kw)) {
        const kwItems = historicalItems.filter(i => i.title?.toLowerCase().includes(kw));
        const kwExploded = kwItems.filter(i => i.actual_hours > i.final_estimate * 2);
        if (kwItems.length >= 2) {
          const rate = kwExploded.length / kwItems.length;
          if (rate > 0.4) {
            riskScore += rate * 0.4;
            reasons.push(`"${kw}"-tasks overskrides ${Math.round(rate * 100)}% af gangen`);
          }
        }
      }
    }

    // Similar title explosion rate
    if (similar.length >= 2) {
      const rate = similarExploded.length / similar.length;
      if (rate > 0.3) {
        riskScore += rate * 0.4;
        reasons.push(`${Math.round(rate * 100)}% af lignende tasks overskrides`);
      }
    }

    // Low estimate risk
    if (estimate && estimate <= 5) {
      const lowEst = historicalItems.filter(i => i.final_estimate <= 5);
      const lowEstExploded = lowEst.filter(i => i.actual_hours > 13);
      if (lowEst.length >= 3) {
        const rate = lowEstExploded.length / lowEst.length;
        riskScore += rate * 0.3;
        if (rate > 0.2) reasons.push(`Lave estimater (≤5) ender som 13+ i ${Math.round(rate * 100)}% af tilfælde`);
      }
    }

    const finalScore = Math.min(1, riskScore);
    const avgMultiplier = exploded.length > 0
      ? exploded.reduce((s: number, i: any) => s + i.actual_hours / Math.max(i.final_estimate, 1), 0) / exploded.length
      : null;

    const warningText = finalScore > 0.3 && avgMultiplier
      ? `Lignende tasks overskrides typisk med ${Math.round(avgMultiplier * 10) / 10}x — overvej lavere confidence`
      : reasons[0] || null;

    return new Response(JSON.stringify({
      risk_score: Math.round(finalScore * 100) / 100,
      examples: similarExploded.slice(0, 3).map((i: any) => ({
        title: i.title,
        estimated: i.final_estimate,
        actual: i.actual_hours,
      })),
      warning_text: warningText,
      reasons,
    }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
