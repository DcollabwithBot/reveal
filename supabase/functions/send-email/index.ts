import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// ── Email Template ────────────────────────────────────────────────────────────

function wrapTemplate(contentHtml: string): string {
  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><title>Reveal</title></head>
<body style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background: #0d0d1a; color: #e0e0e0;">
  <div style="background: #1a1a2e; border: 1px solid rgba(255,255,255,0.1); border-radius: 8px; padding: 24px;">
    <h1 style="color: #00c896; font-size: 20px; margin: 0 0 16px;">⚔️ Reveal</h1>
    ${contentHtml}
  </div>
  <p style="color: #666; font-size: 12px; margin-top: 16px; text-align: center;">Reveal · <a href="#" style="color: #666;">Unsubscribe</a></p>
</body>
</html>`
}

// ── Send Email via Resend ─────────────────────────────────────────────────────

export async function sendEmail(
  supabase: ReturnType<typeof createClient>,
  orgId: string | null,
  recipientEmail: string,
  subject: string,
  contentHtml: string
): Promise<{ ok: boolean; error?: string }> {
  const resendKey = Deno.env.get('RESEND_API_KEY')
  if (!resendKey) return { ok: false, error: 'RESEND_API_KEY not configured' }

  // Try to get SMTP config for custom from address
  let fromAddress = 'reveal@updates.reveal.ai'
  let fromName = 'Reveal'

  if (orgId) {
    const { data: smtpConfig } = await supabase
      .from('smtp_configs')
      .select('from_address, from_name')
      .eq('organization_id', orgId)
      .maybeSingle()

    if (smtpConfig?.from_address) fromAddress = smtpConfig.from_address
    if (smtpConfig?.from_name) fromName = smtpConfig.from_name
  }

  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${resendKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: `${fromName} <${fromAddress}>`,
        to: recipientEmail,
        subject,
        html: wrapTemplate(contentHtml),
      }),
    })

    if (!res.ok) {
      const err = await res.json().catch(() => ({ message: res.statusText }))
      return { ok: false, error: err.message || res.statusText }
    }

    return { ok: true }
  } catch (e) {
    return { ok: false, error: (e as Error).message }
  }
}

// ── Email Content Builders ────────────────────────────────────────────────────

export function approvalPendingEmail(itemName: string): { subject: string; html: string } {
  return {
    subject: `PM approval required — ${itemName}`,
    html: `
      <p style="color: #e0e0e0; font-size: 14px; line-height: 1.6;">
        A new approval request requires your attention:
      </p>
      <div style="background: #252540; border: 1px solid rgba(255,255,255,0.05); border-radius: 6px; padding: 16px; margin: 12px 0;">
        <p style="color: #00c896; font-weight: 600; margin: 0;">${itemName}</p>
        <p style="color: #999; font-size: 13px; margin: 8px 0 0;">Review and approve or reject this change in Reveal.</p>
      </div>
      <a href="https://reveal.blichert.net/dashboard" style="display: inline-block; background: #00c896; color: #0d0d1a; padding: 10px 20px; border-radius: 6px; text-decoration: none; font-weight: 600; margin-top: 8px;">Open Dashboard</a>
    `,
  }
}

export function sessionInviteEmail(sessionName: string, joinCode?: string): { subject: string; html: string } {
  return {
    subject: `You've been invited to join ${sessionName}`,
    html: `
      <p style="color: #e0e0e0; font-size: 14px; line-height: 1.6;">
        You've been invited to an estimation session:
      </p>
      <div style="background: #252540; border: 1px solid rgba(255,255,255,0.05); border-radius: 6px; padding: 16px; margin: 12px 0;">
        <p style="color: #00c896; font-weight: 600; margin: 0;">⚔️ ${sessionName}</p>
        ${joinCode ? `<p style="color: #999; font-size: 13px; margin: 8px 0 0;">Join code: <strong style="color: #e0e0e0;">${joinCode}</strong></p>` : ''}
      </div>
      <a href="https://reveal.blichert.net" style="display: inline-block; background: #00c896; color: #0d0d1a; padding: 10px 20px; border-radius: 6px; text-decoration: none; font-weight: 600; margin-top: 8px;">Join Session</a>
    `,
  }
}

export function sprintCloseSummaryEmail(sprintName: string, accuracy: number | null): { subject: string; html: string } {
  return {
    subject: `Sprint ${sprintName} closed${accuracy != null ? ` — accuracy: ${accuracy}%` : ''}`,
    html: `
      <p style="color: #e0e0e0; font-size: 14px; line-height: 1.6;">
        Sprint <strong>${sprintName}</strong> has been completed.
      </p>
      ${accuracy != null ? `
      <div style="background: #252540; border: 1px solid rgba(255,255,255,0.05); border-radius: 6px; padding: 16px; margin: 12px 0;">
        <p style="color: #999; font-size: 13px; margin: 0;">Estimation accuracy</p>
        <p style="color: #00c896; font-size: 28px; font-weight: 700; margin: 4px 0 0;">${accuracy}%</p>
      </div>
      ` : ''}
      <a href="https://reveal.blichert.net/dashboard" style="display: inline-block; background: #00c896; color: #0d0d1a; padding: 10px 20px; border-radius: 6px; text-decoration: none; font-weight: 600; margin-top: 8px;">View Results</a>
    `,
  }
}

export function onboardingInviteEmail(orgName: string, inviterName: string): { subject: string; html: string } {
  return {
    subject: `${inviterName} invited you to join ${orgName} on Reveal`,
    html: `
      <p style="color: #e0e0e0; font-size: 14px; line-height: 1.6;">
        <strong>${inviterName}</strong> invited you to join <strong>${orgName}</strong> on Reveal — the gamified estimation platform.
      </p>
      <p style="color: #999; font-size: 13px; line-height: 1.6;">
        Make uncertainty visible. Earlier. ⚔️
      </p>
      <a href="https://reveal.blichert.net" style="display: inline-block; background: #00c896; color: #0d0d1a; padding: 10px 20px; border-radius: 6px; text-decoration: none; font-weight: 600; margin-top: 12px;">Get Started</a>
    `,
  }
}

// ── HTTP Handler ──────────────────────────────────────────────────────────────

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    { auth: { persistSession: false } }
  )

  const authHeader = req.headers.get('Authorization')
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? ''
  const anonClient = createClient(Deno.env.get('SUPABASE_URL') ?? '', anonKey)
  const { data: { user }, error: authError } = await anonClient.auth.getUser(
    authHeader?.replace('Bearer ', '') ?? ''
  )
  if (authError || !user) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }

  try {
    const { to, subject, html, org_id, template, template_data } = await req.json()

    let emailSubject = subject
    let emailHtml = html

    // Support template-based emails
    if (template && template_data) {
      switch (template) {
        case 'approval_pending': {
          const e = approvalPendingEmail(template_data.item_name)
          emailSubject = e.subject; emailHtml = e.html; break
        }
        case 'session_invite': {
          const e = sessionInviteEmail(template_data.session_name, template_data.join_code)
          emailSubject = e.subject; emailHtml = e.html; break
        }
        case 'sprint_close': {
          const e = sprintCloseSummaryEmail(template_data.sprint_name, template_data.accuracy)
          emailSubject = e.subject; emailHtml = e.html; break
        }
        case 'onboarding_invite': {
          const e = onboardingInviteEmail(template_data.org_name, template_data.inviter_name)
          emailSubject = e.subject; emailHtml = e.html; break
        }
      }
    }

    if (!to || !emailSubject || !emailHtml) throw new Error('to, subject, and html required')

    const recipients = Array.isArray(to) ? to : [to]
    const results = []

    for (const recipient of recipients) {
      const result = await sendEmail(supabase, org_id || null, recipient, emailSubject, emailHtml)
      results.push({ email: recipient, ...result })
    }

    return new Response(JSON.stringify({ results }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  } catch (err) {
    return new Response(JSON.stringify({ error: (err as Error).message }), {
      status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
})
