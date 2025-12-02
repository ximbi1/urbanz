import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3'
import { polygon, area as turfArea, intersect, booleanPointInPolygon, point } from 'npm:@turf/turf@6.5.0'
import webpush from 'npm:web-push@3.6.1'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const PROTECTION_DURATION_MS = 24 * 60 * 60 * 1000
const STEAL_COOLDOWN_MS = 6 * 60 * 60 * 1000
const MINIMUM_AREA_M2 = 50
const OVERLAP_THRESHOLD = 0.8
const LEVEL_THRESHOLDS = [
  0,
  100,
  250,
  500,
  850,
  1300,
  1900,
  2600,
  3400,
  4300,
  5300,
  6500,
  7900,
  9500,
  11300,
  13300,
  15500,
  18000,
  20800,
  24000,
]

const supabaseUrl = Deno.env.get('SUPABASE_URL')
const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
const VAPID_PUBLIC_KEY = Deno.env.get('PUSH_VAPID_PUBLIC_KEY')
const VAPID_PRIVATE_KEY = Deno.env.get('PUSH_VAPID_PRIVATE_KEY')
const PUSH_CONTACT = Deno.env.get('PUSH_CONTACT_EMAIL') || 'mailto:support@urbanz.app'

if (!supabaseUrl || !serviceRoleKey) {
  throw new Error('Missing Supabase environment variables')
}

const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey)
if (VAPID_PUBLIC_KEY && VAPID_PRIVATE_KEY) {
  webpush.setVapidDetails(PUSH_CONTACT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY)
}
const canSendPush = Boolean(VAPID_PUBLIC_KEY && VAPID_PRIVATE_KEY)

interface Coordinate {
  lat: number
  lng: number
  accuracy?: number
  timestamp?: number
}

interface ClaimPayload {
  path: Coordinate[]
  duration: number
  source?: 'live' | 'import'
}

const metersToKm = (meters: number) => meters / 1000

const calculateDistance = (point1: Coordinate, point2: Coordinate): number => {
  const R = 6371000
  const phi1 = (point1.lat * Math.PI) / 180
  const phi2 = (point2.lat * Math.PI) / 180
  const deltaPhi = ((point2.lat - point1.lat) * Math.PI) / 180
  const deltaLambda = ((point2.lng - point1.lng) * Math.PI) / 180

  const a =
    Math.sin(deltaPhi / 2) * Math.sin(deltaPhi / 2) +
    Math.cos(phi1) * Math.cos(phi2) * Math.sin(deltaLambda / 2) * Math.sin(deltaLambda / 2)
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))

  return R * c
}

const calculatePathDistance = (path: Coordinate[]): number => {
  let total = 0
  for (let i = 1; i < path.length; i++) {
    total += calculateDistance(path[i - 1], path[i])
  }
  return total
}

const isPolygonClosed = (path: Coordinate[], threshold = 50): boolean => {
  if (path.length < 3) return false
  const distance = calculateDistance(path[0], path[path.length - 1])
  return distance <= threshold
}

const calculatePolygonArea = (coordinates: Coordinate[]): number => {
  if (coordinates.length < 3) return 0
  let area = 0
  const R = 6371000
  for (let i = 0; i < coordinates.length; i++) {
    const j = (i + 1) % coordinates.length
    const lat1 = (coordinates[i].lat * Math.PI) / 180
    const lat2 = (coordinates[j].lat * Math.PI) / 180
    const lng1 = (coordinates[i].lng * Math.PI) / 180
    const lng2 = (coordinates[j].lng * Math.PI) / 180
    area += (lng2 - lng1) * (2 + Math.sin(lat1) + Math.sin(lat2))
  }
  area = (area * R * R) / 2
  return Math.abs(area)
}

const calculatePerimeter = (coordinates: Coordinate[]): number => {
  if (coordinates.length < 2) return 0
  let perimeter = 0
  for (let i = 0; i < coordinates.length; i++) {
    const j = (i + 1) % coordinates.length
    perimeter += calculateDistance(coordinates[i], coordinates[j])
  }
  return perimeter
}

const calculateAveragePace = (distance: number, duration: number): number => {
  if (distance === 0) return 0
  const distanceKm = distance / 1000
  const durationMin = duration / 60
  return durationMin / distanceKm
}

const calculateLevel = (totalPoints: number) => {
  let level = 1
  for (let i = 0; i < LEVEL_THRESHOLDS.length; i++) {
    if (totalPoints >= LEVEL_THRESHOLDS[i]) {
      level = i + 1
    } else {
      break
    }
  }
  if (level >= LEVEL_THRESHOLDS.length) {
    const extraLevels = Math.floor((totalPoints - LEVEL_THRESHOLDS[LEVEL_THRESHOLDS.length - 1]) / 3000)
    level = LEVEL_THRESHOLDS.length + extraLevels
  }
  return level
}

const getMaxAreaForLevel = (level: number) => {
  const base = 200000
  const increment = 50000
  const max = base + (level - 1) * increment
  const hardCap = 5_000_000
  return Math.min(max, hardCap)
}

const calculateDefenseBonusMinutes = (level: number): number => {
  if (level >= 11) return 1
  if (level >= 6) return 0.75
  return 0.5
}

const calculateRequiredPace = (territoryPace: number, level: number): number => {
  const bonus = calculateDefenseBonusMinutes(level)
  const required = territoryPace - bonus
  return Math.max(required, 2.5)
}

const toPolygonCoords = (path: Coordinate[]) => {
  const coords = path.map((point) => [point.lng, point.lat])
  const first = coords[0]
  const last = coords[coords.length - 1]
  if (first[0] !== last[0] || first[1] !== last[1]) {
    coords.push([...first])
  }
  return coords
}

const calculateRewardPoints = (distance: number, area: number, isSteal: boolean) => {
  const distancePoints = Math.round(metersToKm(distance) * 10)
  const areaPoints = Math.floor(area / 2000)
  const actionPoints = isSteal ? 75 : 50
  return distancePoints + areaPoints + actionPoints
}

const fetchUserFromToken = async (token: string) => {
  const { data, error } = await supabaseAdmin.auth.getUser(token)
  if (error || !data?.user) {
    throw new Error('No se pudo autenticar al usuario')
  }
  return data.user
}

const decrementDefenderProfile = async (profileId: string, pointsToRemove: number | null) => {
  const { data: profile } = await supabaseAdmin
    .from('profiles')
    .select('total_territories, total_points')
    .eq('id', profileId)
    .single()

  if (!profile) return

  await supabaseAdmin
    .from('profiles')
    .update({
      total_territories: Math.max((profile.total_territories || 0) - 1, 0),
      total_points: Math.max((profile.total_points || 0) - (pointsToRemove || 0), 0),
    })
    .eq('id', profileId)
}

const fetchMapPois = async () => {
  const { data } = await supabaseAdmin
    .from('map_pois')
    .select('id, name, category, coordinates')
  return data || []
}

const derivePoiTags = (runPolygon: any, pois: any[]) => {
  const tags: { type: string; name: string }[] = []
  pois.forEach((poi) => {
    const coords = (poi.coordinates as any[])?.map((coord) => [coord.lng, coord.lat])
    if (!coords || coords.length < 3) return
    const poiPolygon = polygon([coords])
    if (intersect(runPolygon, poiPolygon)) {
      tags.push({ type: poi.category, name: poi.name })
    }
  })
  return tags
}

const fetchActiveMapChallenges = async () => {
  const now = new Date().toISOString()
  const { data } = await supabaseAdmin
    .from('map_challenges')
    .select('*')
    .eq('active', true)
    .lte('start_date', now)
    .gte('end_date', now)
  return data || []
}

const awardMapChallenges = async (
  userId: string,
  runPolygon: any,
  profileState: any,
  notify: (body: string) => Promise<void>
) => {
  const challenges = await fetchActiveMapChallenges()
  const completed: any[] = []

  for (const challenge of challenges) {
    const challengePoint = point([challenge.longitude, challenge.latitude])
    if (!booleanPointInPolygon(challengePoint, runPolygon)) continue

    const { data: existing } = await supabaseAdmin
      .from('map_challenge_claims')
      .select('id')
      .eq('challenge_id', challenge.id)
      .eq('user_id', userId)
      .maybeSingle()

    if (existing) continue

    await supabaseAdmin
      .from('map_challenge_claims')
      .insert({ challenge_id: challenge.id, user_id: userId })

    profileState.total_points = (profileState.total_points || 0) + challenge.reward_points
    profileState.season_points = (profileState.season_points || 0) + challenge.reward_points
    profileState.historical_points = (profileState.historical_points || 0) + challenge.reward_points

    await supabaseAdmin
      .from('profiles')
      .update({
        total_points: profileState.total_points,
        season_points: profileState.season_points,
        historical_points: profileState.historical_points,
      })
      .eq('id', userId)

    await notify(`Has completado ${challenge.name}. +${challenge.reward_points} puntos`)
    completed.push(challenge)
  }

  return completed
}

const updateTerritoryThemeTags = async (territoryId: string, runPolygon: any, pois: any[]) => {
  const tags = derivePoiTags(runPolygon, pois)
  await supabaseAdmin
    .from('territories')
    .update({
      tags,
      poi_summary: tags.length ? tags.map(tag => tag.name).join(', ') : null,
    })
    .eq('id', territoryId)
  return tags
}

const sendPushNotification = async (
  userId: string | null,
  notification: { title: string; body: string; data?: Record<string, unknown>; tag?: string }
) => {
  if (!canSendPush || !userId) return
  const { data: subscriptions } = await supabaseAdmin
    .from('push_subscriptions')
    .select('id, endpoint, p256dh, auth')
    .eq('user_id', userId)

  if (!subscriptions?.length) return

  await Promise.all(subscriptions.map(async (sub) => {
    try {
      await webpush.sendNotification(
        {
          endpoint: sub.endpoint,
          keys: {
            p256dh: sub.p256dh,
            auth: sub.auth,
          },
        },
        JSON.stringify(notification)
      )
    } catch (error) {
      const statusCode = (error as any)?.statusCode
      if (statusCode === 404 || statusCode === 410) {
        await supabaseAdmin
          .from('push_subscriptions')
          .delete()
          .eq('id', sub.id)
      } else {
        console.error('Error enviando notificación push', error)
      }
    }
  }))
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Falta token de autenticación' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const token = authHeader.replace('Bearer ', '').trim()
    const user = await fetchUserFromToken(token)

    const payload = (await req.json()) as ClaimPayload
    if (!payload?.path || payload.path.length < 4) {
      return new Response(
        JSON.stringify({ error: 'Ruta inválida' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    if (!payload.duration || payload.duration <= 0) {
      return new Response(
        JSON.stringify({ error: 'Duración inválida' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const path = payload.path

    if (!isPolygonClosed(path)) {
      return new Response(
        JSON.stringify({ error: 'Debes cerrar el polígono para reclamar un territorio' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const distance = calculatePathDistance(path)
    const area = calculatePolygonArea(path)
    const perimeter = calculatePerimeter(path)
    const avgPace = calculateAveragePace(distance, payload.duration)

    if (area < MINIMUM_AREA_M2) {
      return new Response(
        JSON.stringify({ error: 'El territorio es demasiado pequeño' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const { data: profile, error: profileError } = await supabaseAdmin
      .from('profiles')
      .select('id, username, total_points, total_territories, total_distance, season_points, historical_points')
      .eq('id', user.id)
      .single()

    if (profileError || !profile) {
      throw new Error('No se encontró el perfil del usuario')
    }

    const userLevel = calculateLevel(profile.total_points)
    const attackerName = profile.username || 'Un corredor'
    const profileState: any = { ...profile }
    const maxArea = getMaxAreaForLevel(userLevel)

    if (area > maxArea) {
      return new Response(
        JSON.stringify({ error: `El área (${Math.round(area)} m²) supera tu límite actual` }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const now = new Date()
    const protectedUntil = new Date(now.getTime() + PROTECTION_DURATION_MS).toISOString()

    const runPolygon = polygon([toPolygonCoords(path)])
    const mapPois = await fetchMapPois()

    const { data: territories, error: territoriesError } = await supabaseAdmin
      .from('territories')
      .select(`
        id,
        user_id,
        coordinates,
        area,
        perimeter,
        avg_pace,
        protected_until,
        cooldown_until,
        conquest_points,
        required_pace,
        status,
        points,
        owner:profiles!territories_user_id_fkey(id, username, total_points)
      `)

    if (territoriesError) {
      throw new Error('No se pudieron cargar los territorios existentes')
    }

    let targetTerritory: any = null
    let highestOverlap = 0

    if (territories) {
      for (const territory of territories) {
        const coords = (territory.coordinates as any[] | null) ?? []
        if (!coords.length) continue
        const territoryPolygon = polygon([
          coords.map((coord: any) => [coord.lng, coord.lat])
        ])
        const overlap = intersect(runPolygon, territoryPolygon)
        if (!overlap) continue
        const overlapArea = turfArea(overlap)
        const ratio = territory.area > 0 ? overlapArea / territory.area : 0
        if (ratio > highestOverlap) {
          highestOverlap = ratio
          targetTerritory = territory
        }
      }
    }

    const isStealAttempt = targetTerritory && targetTerritory.user_id !== user.id && highestOverlap >= OVERLAP_THRESHOLD
    const isOwnTerritory = targetTerritory && targetTerritory.user_id === user.id && highestOverlap >= OVERLAP_THRESHOLD
    const isNewTerritory = !isStealAttempt && !isOwnTerritory

    let territoriesConquered = 0
    let territoriesStolen = 0
    let territoriesLost = 0
    let pointsGained = 0
    let territoryId: string | null = null
    let runId: string | null = null
    let action: 'conquered' | 'stolen' | 'reinforced' = 'conquered'
    let poiTags: { type: string; name: string }[] = []
    let challengeRewards: string[] = []

    const rewardPoints = calculateRewardPoints(distance, area, Boolean(isStealAttempt))
    pointsGained = rewardPoints

    if (isStealAttempt && targetTerritory) {
      const ownerLevel = calculateLevel(targetTerritory.owner?.total_points || 0)
      const requiredPace = calculateRequiredPace(targetTerritory.avg_pace, ownerLevel)
      const territoryUrl = `/territories/${targetTerritory.id}`
      const notifyDefender = async (body: string) => {
        await sendPushNotification(targetTerritory.user_id, {
          title: 'Actividad en tus territorios',
          body,
          data: { url: territoryUrl },
          tag: targetTerritory.id,
        })
      }

      if (avgPace > requiredPace) {
        await supabaseAdmin
          .from('territory_events')
          .insert({
            territory_id: targetTerritory.id,
            attacker_id: user.id,
            defender_id: targetTerritory.user_id,
            event_type: 'steal',
            result: 'failed',
            overlap_ratio: highestOverlap,
            pace: avgPace,
            area,
        })
        await notifyDefender(`${attackerName} intentó robarte un territorio, pero no alcanzó el ritmo necesario.`)
        return new Response(
          JSON.stringify({ error: `Necesitas un ritmo de ${requiredPace.toFixed(2)} min/km o menos para robar este territorio` }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      if (targetTerritory.protected_until && new Date(targetTerritory.protected_until) > now) {
        await supabaseAdmin
          .from('territory_events')
          .insert({
            territory_id: targetTerritory.id,
            attacker_id: user.id,
            defender_id: targetTerritory.user_id,
            event_type: 'steal',
            result: 'failed',
            overlap_ratio: highestOverlap,
            pace: avgPace,
            area,
        })
        await notifyDefender(`${attackerName} atacó tu territorio, pero sigues protegido.`)
        return new Response(
          JSON.stringify({ error: 'El territorio está protegido temporalmente' }),
          { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      const { data: lastAttempt } = await supabaseAdmin
        .from('territory_events')
        .select('id, created_at')
        .eq('territory_id', targetTerritory.id)
        .eq('attacker_id', user.id)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle()

      const cooldownBlocked = targetTerritory.cooldown_until && new Date(targetTerritory.cooldown_until) > now
      const lastAttemptBlocked = lastAttempt && Date.now() - new Date(lastAttempt.created_at).getTime() < STEAL_COOLDOWN_MS
      if (cooldownBlocked || lastAttemptBlocked) {
        const baseRemaining = lastAttempt
          ? STEAL_COOLDOWN_MS - (Date.now() - new Date(lastAttempt.created_at).getTime())
          : 0
        const cooldownRemaining = targetTerritory.cooldown_until
          ? new Date(targetTerritory.cooldown_until).getTime() - now.getTime()
          : 0
        const remaining = Math.max(baseRemaining, cooldownRemaining, 0)
        await supabaseAdmin
          .from('territory_events')
          .insert({
            territory_id: targetTerritory.id,
            attacker_id: user.id,
            defender_id: targetTerritory.user_id,
            event_type: 'steal',
            result: 'failed',
            overlap_ratio: highestOverlap,
            pace: avgPace,
            area,
        })
        await notifyDefender(`${attackerName} debe esperar antes de volver a atacar tu territorio.`)
        return new Response(
          JSON.stringify({ error: 'Debes esperar antes de volver a atacar este territorio', cooldown: remaining }),
          { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      const newRequiredPace = calculateRequiredPace(avgPace, userLevel)

      const { data: updated, error: updateError } = await supabaseAdmin
        .from('territories')
        .update({
          user_id: user.id,
          coordinates: path,
          area,
          perimeter,
          avg_pace: avgPace,
          required_pace: newRequiredPace,
          protected_until: protectedUntil,
          cooldown_until: new Date(now.getTime() + STEAL_COOLDOWN_MS).toISOString(),
          status: 'protected',
          last_attacker_id: user.id,
          last_defender_id: targetTerritory.user_id,
          last_attack_at: now.toISOString(),
          conquest_points: rewardPoints,
          points: rewardPoints,
        })
        .eq('id', targetTerritory.id)
        .select('id')
        .single()

      if (updateError || !updated) {
        throw new Error('No se pudo actualizar el territorio robado')
      }

      territoryId = updated.id
      territoriesStolen = 1
      action = 'stolen'

      profileState.total_points = (profileState.total_points || 0) + rewardPoints
      profileState.season_points = (profileState.season_points || 0) + rewardPoints
      profileState.historical_points = (profileState.historical_points || 0) + rewardPoints
      profileState.total_territories = (profileState.total_territories || 0) + 1
      profileState.total_distance = (profileState.total_distance || 0) + distance

      await supabaseAdmin
        .from('profiles')
        .update({
          total_points: profileState.total_points,
          season_points: profileState.season_points,
          historical_points: profileState.historical_points,
          total_territories: profileState.total_territories,
          total_distance: profileState.total_distance,
        })
        .eq('id', user.id)

      if (targetTerritory.user_id) {
        await decrementDefenderProfile(targetTerritory.user_id, targetTerritory.conquest_points)
        await notifyDefender(`${attackerName} conquistó uno de tus territorios.`)
      }
    } else if (isOwnTerritory && targetTerritory) {
      const newRequiredPace = calculateRequiredPace(avgPace, userLevel)
      const { data: updated } = await supabaseAdmin
        .from('territories')
        .update({
          coordinates: path,
          area,
          perimeter,
          avg_pace: avgPace,
          required_pace: newRequiredPace,
          protected_until: protectedUntil,
          status: 'protected',
          conquest_points: rewardPoints,
          points: rewardPoints,
        })
        .eq('id', targetTerritory.id)
        .select('id')
        .single()

      territoryId = updated?.id || targetTerritory.id
      action = 'reinforced'
      pointsGained = 0

      profileState.total_distance = (profileState.total_distance || 0) + distance
      await supabaseAdmin
        .from('profiles')
        .update({
          total_distance: profileState.total_distance,
        })
        .eq('id', user.id)
    } else if (isNewTerritory) {
      const requiredPace = calculateRequiredPace(avgPace, userLevel)
      const { data: inserted, error: insertError } = await supabaseAdmin
        .from('territories')
        .insert({
          user_id: user.id,
          coordinates: path,
          area,
          perimeter,
          avg_pace: avgPace,
          required_pace: requiredPace,
          protected_until: protectedUntil,
          cooldown_until: new Date(now.getTime() + STEAL_COOLDOWN_MS).toISOString(),
          status: 'protected',
          conquest_points: rewardPoints,
          points: rewardPoints,
        })
        .select('id')
        .single()

      if (insertError || !inserted) {
        throw new Error('No se pudo crear el territorio')
      }
      territoryId = inserted.id
      territoriesConquered = 1
      action = 'conquered'

      profileState.total_points = (profileState.total_points || 0) + rewardPoints
      profileState.season_points = (profileState.season_points || 0) + rewardPoints
      profileState.historical_points = (profileState.historical_points || 0) + rewardPoints
      profileState.total_territories = (profileState.total_territories || 0) + 1
      profileState.total_distance = (profileState.total_distance || 0) + distance

      await supabaseAdmin
        .from('profiles')
        .update({
          total_points: profileState.total_points,
          season_points: profileState.season_points,
          historical_points: profileState.historical_points,
          total_territories: profileState.total_territories,
          total_distance: profileState.total_distance,
        })
        .eq('id', user.id)
    }

    if (territoryId) {
      poiTags = await updateTerritoryThemeTags(territoryId, runPolygon, mapPois)
      const completedChallenges = await awardMapChallenges(
        user.id,
        runPolygon,
        profileState,
        async (body: string) => {
          await sendPushNotification(user.id, {
            title: 'Desafío del mapa',
            body,
            data: { url: '/challenges' },
            tag: 'map-challenge'
          })
        }
      )
      challengeRewards = completedChallenges.map(ch => ch.name)
      const challengeBonus = completedChallenges.reduce((sum, ch) => sum + ch.reward_points, 0)
      pointsGained += challengeBonus
    }

    const { data: run } = await supabaseAdmin
      .from('runs')
      .insert({
        user_id: user.id,
        path: path as any,
        distance,
        duration: payload.duration,
        avg_pace: avgPace,
        territories_conquered: territoriesConquered,
        territories_stolen: territoriesStolen,
        territories_lost: territoriesLost,
        points_gained: pointsGained,
      })
      .select('id')
      .single()

    runId = run?.id || null

    if (territoryId) {
      await supabaseAdmin
        .from('territory_events')
        .insert({
          territory_id: territoryId,
          attacker_id: user.id,
          defender_id: targetTerritory?.user_id,
          event_type: action === 'stolen' ? 'steal' : action === 'reinforced' ? 'reinforce' : 'conquest',
          result: action === 'reinforced' ? 'neutral' : 'success',
          overlap_ratio: highestOverlap || 1,
          pace: avgPace,
          area,
          points_awarded: pointsGained,
        })
    }

    return new Response(
      JSON.stringify({
        success: true,
        data: {
          action,
          territoryId,
          runId,
          pointsGained,
          territoriesConquered,
          territoriesStolen,
          territoriesLost,
          protectedUntil,
          cooldownDuration: STEAL_COOLDOWN_MS,
          poiTags,
          challengeRewards,
        },
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (error) {
    console.error(error)
    const message = error instanceof Error ? error.message : 'Error inesperado'
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
