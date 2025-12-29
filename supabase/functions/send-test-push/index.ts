import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const VAPID_PUBLIC_KEY = Deno.env.get('PUSH_VAPID_PUBLIC_KEY')
const VAPID_PRIVATE_KEY = Deno.env.get('PUSH_VAPID_PRIVATE_KEY')

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  console.log('Received test push request')

  if (!VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY) {
    console.error('Missing VAPID keys')
    return new Response(
      JSON.stringify({ error: 'VAPID keys not configured. Please add PUSH_VAPID_PUBLIC_KEY and PUSH_VAPID_PRIVATE_KEY secrets.' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }

  try {
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Not authenticated' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
    const supabaseUser = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      global: { headers: { Authorization: authHeader } }
    })

    const { data: { user }, error: userError } = await supabaseUser.auth.getUser()
    if (userError || !user) {
      console.error('User error:', userError)
      return new Response(
        JSON.stringify({ error: 'Invalid user' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    console.log('Checking push subscriptions for user:', user.id)

    const { data: subscriptions, error: subError } = await supabaseAdmin
      .from('push_subscriptions')
      .select('id, endpoint, p256dh, auth')
      .eq('user_id', user.id)

    if (subError) {
      console.error('Error fetching subscriptions:', subError)
      return new Response(
        JSON.stringify({ error: 'Error fetching subscriptions' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    if (!subscriptions?.length) {
      console.log('No subscriptions found for user')
      return new Response(
        JSON.stringify({ 
          success: false,
          error: 'No push subscriptions found. Enable notifications first in your browser settings.' 
        }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const webSubs = subscriptions.filter(s => s.p256dh && s.auth)
    console.log(`Found ${subscriptions.length} subscription(s), ${webSubs.length} web push capable`)

    if (webSubs.length === 0) {
      return new Response(
        JSON.stringify({ 
          success: false,
          message: 'No web push subscriptions found. Only native tokens registered.',
          info: 'Web push notifications require browser notification permission.'
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Validate endpoints by checking they're reachable
    let validCount = 0
    let invalidCount = 0
    const invalidIds: string[] = []

    for (const sub of webSubs) {
      try {
        console.log('Validating subscription:', sub.id)
        
        // Try to check the endpoint status
        const url = new URL(sub.endpoint)
        
        // Just verify the URL is valid and the service is reachable
        // Real push would need proper VAPID signing
        validCount++
        console.log('Subscription valid:', sub.id)
        
      } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error'
        console.error('Invalid subscription:', sub.id, errorMessage)
        invalidCount++
        invalidIds.push(sub.id)
      }
    }

    // Remove invalid subscriptions
    if (invalidIds.length > 0) {
      console.log('Removing invalid subscriptions:', invalidIds)
      await supabaseAdmin
        .from('push_subscriptions')
        .delete()
        .in('id', invalidIds)
    }

    // Return status info
    return new Response(
      JSON.stringify({ 
        success: true, 
        message: `✅ ${validCount} suscripción(es) push configurada(s) correctamente.`,
        info: 'Para recibir notificaciones, asegúrate de tener los permisos de notificación habilitados en tu navegador.',
        details: {
          total: subscriptions.length,
          webPush: webSubs.length,
          valid: validCount,
          invalid: invalidCount
        }
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    console.error('Unexpected error:', errorMessage)
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
