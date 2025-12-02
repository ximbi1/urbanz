import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3'
import webpush from 'npm:web-push@3.6.1'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
const VAPID_PUBLIC_KEY = Deno.env.get('PUSH_VAPID_PUBLIC_KEY')
const VAPID_PRIVATE_KEY = Deno.env.get('PUSH_VAPID_PRIVATE_KEY')
const PUSH_CONTACT_EMAIL = Deno.env.get('PUSH_CONTACT_EMAIL') || 'mailto:support@urbanz.app'
const DAILY_LIMIT = 2
const MORNING_START = 6
const AFTERNOON_START = 14
const WINDOW_END = 22

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  throw new Error('Missing Supabase credentials')
}

if (!VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY) {
  throw new Error('Missing VAPID keys for push notifications')
}

webpush.setVapidDetails(PUSH_CONTACT_EMAIL, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY)
const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

const getWindowLabel = () => {
  const hour = new Date().getHours()
  if (hour < MORNING_START) return 'none'
  if (hour < AFTERNOON_START) return 'morning'
  if (hour < WINDOW_END) return 'afternoon'
  return 'late'
}

const selectMessage = (messages: any[], window: string) => {
  const filtered = messages.filter((msg) => msg.preferred_window === window || msg.preferred_window === 'any')
  const pool = filtered.length ? filtered : messages
  return pool[Math.floor(Math.random() * pool.length)]
}

Deno.serve(async () => {
  const windowLabel = getWindowLabel()
  if (windowLabel === 'none' || windowLabel === 'late') {
    return new Response(JSON.stringify({ skipped: 'Outside scheduling window' }), { status: 200 })
  }

  const { data: messages, error: messagesError } = await supabaseAdmin
    .from('engagement_messages')
    .select('*')
    .eq('active', true)

  if (messagesError || !messages?.length) {
    return new Response(JSON.stringify({ error: 'No engagement messages configured' }), { status: 500 })
  }

  const { data: candidates } = await supabaseAdmin
    .from('profiles')
    .select('id, username, last_engagement_sent, push_count_today, total_distance')
    .lte('push_count_today', DAILY_LIMIT)

  const targets = candidates?.filter((profile: any) => {
    const lastSent = profile.last_engagement_sent ? new Date(profile.last_engagement_sent) : null
    const now = new Date()
    if (lastSent && now.getTime() - lastSent.getTime() < 6 * 60 * 60 * 1000) {
      return false
    }
    return profile.total_distance > 0
  }) || []

  const notifications = await Promise.all(targets.slice(0, 200).map(async (profile: any) => {
    const message = selectMessage(messages, windowLabel)
    const { data: subscriptions } = await supabaseAdmin
      .from('push_subscriptions')
      .select('id, endpoint, p256dh, auth')
      .eq('user_id', profile.id)

    if (!subscriptions?.length) return null

    await Promise.all(subscriptions.map(async (sub: any) => {
      try {
        await webpush.sendNotification({
          endpoint: sub.endpoint,
          keys: { p256dh: sub.p256dh, auth: sub.auth },
        }, JSON.stringify({
          title: message.title,
          body: message.body,
          data: { url: '/challenges' },
          tag: `engagement-${message.identifier}`,
        }))
      } catch (error) {
        const statusCode = (error as any)?.statusCode
        if (statusCode === 404 || statusCode === 410) {
          await supabaseAdmin
            .from('push_subscriptions')
            .delete()
            .eq('id', sub.id)
        }
      }
    }))

    await supabaseAdmin
      .from('profiles')
      .update({
        last_engagement_sent: new Date().toISOString(),
        push_count_today: (profile.push_count_today || 0) + 1,
      })
      .eq('id', profile.id)

    return profile.id
  }))

  return new Response(JSON.stringify({ sent: notifications.filter(Boolean).length }), { status: 200 })
})
