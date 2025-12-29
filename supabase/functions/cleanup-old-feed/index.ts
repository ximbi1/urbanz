import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey)
    
    const tenDaysAgo = new Date()
    tenDaysAgo.setDate(tenDaysAgo.getDate() - 10)
    const cutoffDate = tenDaysAgo.toISOString()
    
    console.log(`Cleaning up feed entries older than: ${cutoffDate}`)
    
    // Delete old clan feed entries
    const { error: clanFeedError, count: clanFeedCount } = await supabase
      .from('clan_feed')
      .delete({ count: 'exact' })
      .lt('created_at', cutoffDate)
    
    if (clanFeedError) {
      console.error('Error deleting old clan feed entries:', clanFeedError)
    } else {
      console.log(`Deleted ${clanFeedCount} old clan feed entries`)
    }
    
    // Delete old run reactions (before deleting runs)
    const { error: reactionsError, count: reactionsCount } = await supabase
      .from('run_reactions')
      .delete({ count: 'exact' })
      .lt('created_at', cutoffDate)
    
    if (reactionsError) {
      console.error('Error deleting old run reactions:', reactionsError)
    } else {
      console.log(`Deleted ${reactionsCount} old run reactions`)
    }
    
    return new Response(
      JSON.stringify({
        success: true,
        deleted: {
          clan_feed: clanFeedCount || 0,
          run_reactions: reactionsCount || 0,
        },
        cutoff_date: cutoffDate
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200 
      }
    )
  } catch (error: unknown) {
    console.error('Cleanup error:', error)
    const message = error instanceof Error ? error.message : 'Unknown error'
    return new Response(
      JSON.stringify({ error: message }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500 
      }
    )
  }
})
