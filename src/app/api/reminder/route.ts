import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'
import { clerkClient } from '@clerk/nextjs/server'
import { Resend } from 'resend'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
const resendApiKey = process.env.RESEND_API_KEY
const resendFrom = process.env.RESEND_FROM_EMAIL || 'AI Coach <onboarding@resend.dev>'
const appUrl =
  process.env.NEXT_PUBLIC_APP_URL ||
  (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:3000')
const cronSecret = process.env.CRON_SECRET

if (!supabaseUrl || !supabaseServiceRoleKey) {
  throw new Error('Supabase Umgebungsvariablen fehlen')
}

const supabaseAdmin = createClient(supabaseUrl, supabaseServiceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
})

/** Prüft, ob der Request vom Vercel Cron kommt */
function isAuthorized(request: Request): boolean {
  if (!cronSecret) return false
  const authHeader = request.headers.get('authorization')
  return authHeader === `Bearer ${cronSecret}`
}

/**
 * GET /api/reminder
 * Wird stündlich per Vercel Cron aufgerufen (minute 0). Sendet Check-in Erinnerungs-Emails
 * an alle Nutzer, deren checkin_reminder_time in der aktuellen UTC-Stunde liegt.
 */
export async function GET(request: Request) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  if (!resendApiKey) {
    console.error('RESEND_API_KEY nicht gesetzt')
    return NextResponse.json({ error: 'Resend nicht konfiguriert' }, { status: 500 })
  }

  try {
    const now = new Date()
    const currentHour = now.getUTCHours()
    const hourStr = String(currentHour).padStart(2, '0')

    const { data: profiles, error: profileError } = await supabaseAdmin
      .from('profiles')
      .select('id, checkin_reminder_time')
      .not('checkin_reminder_time', 'is', null)

    if (profileError) {
      console.error('Reminder: Supabase Fehler', profileError)
      return NextResponse.json({ error: profileError.message }, { status: 500 })
    }

    const toSend = (profiles ?? []).filter((p) => {
      const t = p.checkin_reminder_time as string | undefined
      return t && t.startsWith(hourStr + ':')
    })

    const resend = new Resend(resendApiKey)
    let sent = 0

    for (const p of toSend) {
      const userId = p.id as string
      try {
        const client = await clerkClient()
        const user = await client.users.getUser(userId)
        const primaryEmail = user.emailAddresses.find((e) => e.id === user.primaryEmailAddressId)?.emailAddress
        const email = primaryEmail || user.emailAddresses[0]?.emailAddress
        if (!email) {
          console.warn(`Reminder: Keine Email für User ${userId}`)
          continue
        }

        const firstName = user.firstName || 'du'

        const { error: sendError } = await resend.emails.send({
          from: resendFrom,
          to: [email],
          subject: 'Check-in Erinnerung',
          html: `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"></head>
<body style="margin:0;font-family:system-ui,-apple-system,sans-serif;background:#0a0a0a;color:#e5e5e5;padding:32px 24px;">
  <p style="margin:0 0 24px;font-size:16px;line-height:1.5;">Hey ${firstName}, Zeit für deinen Check-in.</p>
  <p style="margin:0;">
    <a href="${appUrl}/checkin" style="display:inline-block;background:#fff;color:#0a0a0a;text-decoration:none;padding:12px 24px;border-radius:8px;font-size:14px;font-weight:500;">Check-in machen</a>
  </p>
</body>
</html>`,
        })

        if (sendError) {
          console.error(`Reminder send error for ${userId}:`, sendError)
          continue
        }
        sent++
      } catch (err) {
        console.error(`Reminder: Fehler für User ${userId}:`, err)
      }
    }

    return NextResponse.json({ sent, total: toSend.length })
  } catch (err) {
    console.error('Reminder API:', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Unbekannter Fehler' },
      { status: 500 }
    )
  }
}
