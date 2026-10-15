// Supabase Edge Function: delivers one renewal reminder by SMS or email.
// Deploy: supabase functions deploy send-reminder
//
// Delivery is a stub that only logs. To go live, set provider secrets
// (e.g. `supabase secrets set SPARROW_SMS_TOKEN=...`) and replace `deliver`.
import { createClient } from "npm:@supabase/supabase-js@2"

interface Body {
  reminderId: string
  channel: "sms" | "email"
}

async function deliver(channel: Body["channel"], to: string, message: string) {
  // TODO: call Sparrow SMS / Aakash SMS (Nepal) or an email provider here.
  console.log(`[send-reminder] ${channel} → ${to}: ${message}`)
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
      },
    })
  }

  // Use the caller's JWT so row level security still applies.
  const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, {
    global: { headers: { Authorization: req.headers.get("Authorization") ?? "" } },
  })

  const { reminderId, channel } = (await req.json()) as Body
  const { data: reminder, error } = await supabase
    .from("reminders")
    .select("id, kind, members(full_name, phone, email), memberships(end_date)")
    .eq("id", reminderId)
    .single()
  if (error || !reminder) {
    return Response.json({ error: error?.message ?? "Reminder not found" }, { status: 404 })
  }

  const member = reminder.members as unknown as { full_name: string; phone: string; email: string | null }
  const endDate = (reminder.memberships as unknown as { end_date: string }).end_date
  const to = channel === "sms" ? member.phone : member.email
  if (!to) return Response.json({ error: `Member has no ${channel === "sms" ? "phone" : "email"}` }, { status: 400 })

  await deliver(channel, to, `Namaste ${member.full_name.split(" ")[0]}, your gym membership ends on ${endDate}. Renew at the front desk anytime.`)

  await supabase
    .from("reminders")
    .update({ status: "sent", channel, sent_at: new Date().toISOString() })
    .eq("id", reminderId)

  return Response.json({ ok: true }, { headers: { "Access-Control-Allow-Origin": "*" } })
})
