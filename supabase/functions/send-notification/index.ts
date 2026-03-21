/**
 * send-notification — triggers web push + email for game events.
 * Events: session.invited, session.vote_ready, achievement.unlocked, sprint.report_ready
 *
 * Body: { event_type, user_id?, organization_id?, payload: { title, body, url, data } }
 */
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY');
const APP_URL = Deno.env.get('APP_URL') ?? 'https://reveal.blichert.net';

const SUPPORTED_EVENTS = [
  'session.invited',
  'session.vote_ready',
  'achievement.unlocked',
  'sprint.report_ready',
  'item.assigned',
  'approval.pending',
];

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { event_type, user_id, organization_id, payload } = await req.json();

    if (!event_type || !SUPPORTED_EVENTS.includes(event_type)) {
      return new Response(JSON.stringify({ error: `Unsupported event: ${event_type}` }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // 1. Store in-app notification
    const notifPayload = buildNotificationPayload(event_type, payload);

    // Determine recipients
    let recipientIds: string[] = [];
    if (user_id) {
      recipientIds = [user_id];
    } else if (organization_id) {
      const { data: members } = await supabase
        .from('organization_members')
        .select('user_id')
        .eq('organization_id', organization_id);
      recipientIds = (members || []).map((m: any) => m.user_id);
    }

    // Insert in-app notifications
    if (recipientIds.length > 0) {
      const notifs = recipientIds.map((uid: string) => ({
        user_id: uid,
        event_type,
        title: notifPayload.title,
        body: notifPayload.body,
        url: notifPayload.url || `${APP_URL}/dashboard`,
        read: false,
        metadata: payload || {},
      }));
      await supabase.from('notifications').insert(notifs).catch(() => {});
    }

    // 2. Email via Resend for high-priority events
    const HIGH_PRIORITY = ['session.invited', 'sprint.report_ready'];
    if (RESEND_API_KEY && HIGH_PRIORITY.includes(event_type) && user_id) {
      const { data: profile } = await supabase
        .from('profiles')
        .select('email, display_name')
        .eq('id', user_id)
        .maybeSingle();

      if (profile?.email) {
        const emailHtml = buildEmailHtml(event_type, notifPayload, profile.display_name, APP_URL);
        await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${RESEND_API_KEY}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            from: 'Reveal <noreply@reveal.blichert.net>',
            to: [profile.email],
            subject: notifPayload.emailSubject || notifPayload.title,
            html: emailHtml,
          }),
        }).catch(() => {});
      }
    }

    return new Response(JSON.stringify({
      ok: true,
      notified: recipientIds.length,
      event_type,
    }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

function buildNotificationPayload(eventType: string, data: any = {}) {
  switch (eventType) {
    case 'session.invited':
      return {
        title: '🎮 Du er inviteret til en session',
        body: `${data.host_name || 'En facilitator'} har startet "${data.session_name || 'en session'}"`,
        url: data.join_url || `${APP_URL}/dashboard`,
        emailSubject: '⚔️ Reveal: Session invitation',
      };
    case 'session.vote_ready':
      return {
        title: '🃏 Tid til at estimere!',
        body: `Session "${data.session_name || ''}" venter på din stemme`,
        url: data.session_url || `${APP_URL}/dashboard`,
      };
    case 'achievement.unlocked':
      return {
        title: `🏆 Achievement unlocked: ${data.achievement_label || ''}`,
        body: data.achievement_desc || 'Du har optjent et nyt achievement i Reveal!',
        url: `${APP_URL}/dashboard`,
      };
    case 'sprint.report_ready':
      return {
        title: '📊 Sprint rapport klar',
        body: `Sprint "${data.sprint_name || ''}" rapport er klar til review`,
        url: data.report_url || `${APP_URL}/dashboard`,
        emailSubject: '📊 Reveal: Din sprint rapport er klar',
      };
    case 'item.assigned':
      return {
        title: '📋 Ny opgave tildelt',
        body: `"${data.item_title || 'En opgave'}" er tildelt til dig`,
        url: data.item_url || `${APP_URL}/dashboard`,
      };
    case 'approval.pending':
      return {
        title: '⏳ Godkendelse afventer',
        body: `${data.request_title || 'En ændring'} afventer din godkendelse`,
        url: `${APP_URL}/dashboard`,
      };
    default:
      return {
        title: `Reveal: ${eventType}`,
        body: JSON.stringify(data).slice(0, 100),
        url: `${APP_URL}/dashboard`,
      };
  }
}

function buildEmailHtml(eventType: string, payload: any, displayName: string, appUrl: string) {
  return `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#0e1019;font-family:system-ui,sans-serif;color:#e2e8f0">
  <div style="max-width:480px;margin:0 auto;padding:32px 24px">
    <div style="font-size:24px;font-weight:700;color:#00c896;margin-bottom:8px">⚔️ REVEAL</div>
    <div style="font-size:14px;color:#6b7280;margin-bottom:32px">estimation platform</div>
    
    <div style="background:#14162a;border:1px solid #2d3748;border-radius:8px;padding:24px;margin-bottom:24px">
      <div style="font-size:20px;margin-bottom:8px">${payload.title}</div>
      <div style="font-size:14px;color:#94a3b8;line-height:1.6">${payload.body}</div>
    </div>
    
    ${payload.url ? `
    <a href="${payload.url}" style="display:inline-block;background:#00c896;color:#000;font-weight:700;font-size:13px;padding:12px 24px;text-decoration:none;border-radius:6px">
      Åbn Reveal →
    </a>
    ` : ''}
    
    <div style="margin-top:32px;font-size:11px;color:#374151">
      Du modtager denne email fordi du er tilmeldt Reveal. 
      <a href="${appUrl}/settings" style="color:#6b7280">Afmeld notifikationer</a>
    </div>
  </div>
</body>
</html>`;
}
