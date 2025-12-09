import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3'
import { polygon, area as turfArea, intersect, difference, booleanPointInPolygon, point, simplify, buffer, union, booleanContains } from 'npm:@turf/turf@6.5.0'
import webpush from 'npm:web-push@3.6.1'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const PROTECTION_DURATION_MS = 24 * 60 * 60 * 1000
const STEAL_COOLDOWN_MS = 6 * 60 * 60 * 1000
const MINIMUM_AREA_M2 = 50
const OVERLAP_THRESHOLD = 0.8
const PARTIAL_OVERLAP_THRESHOLD = 0.1 // Umbral mínimo para considerar solapamiento parcial
const CLAN_MISSION_LABELS: Record<string, string> = {
  park: 'Ruta de parques',
  fountain: 'Ruta de hidratación',
  district: 'Distritos dominados',
  territories: 'Territorios coordinados',
  points: 'Influencia acumulada',
}
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

// Detectar loops cerrados dentro de una ruta (para vueltas a plazas, etc.)
const findClosedLoops = (path: Coordinate[], threshold = 30): Coordinate[][] => {
  const loops: Coordinate[][] = []
  if (path.length < 4) return loops

  // Buscar puntos donde la ruta se cruza consigo misma
  for (let i = 0; i < path.length - 3; i++) {
    for (let j = i + 3; j < path.length; j++) {
      const dist = calculateDistance(path[i], path[j])
      if (dist <= threshold) {
        // Encontramos un loop entre i y j
        const loopPath = path.slice(i, j + 1)
        if (loopPath.length >= 4) {
          // Cerrar el loop añadiendo el primer punto al final
          loopPath.push({ ...loopPath[0] })
          loops.push(loopPath)
        }
        // Saltamos j para no encontrar loops duplicados
        break
      }
    }
  }

  return loops
}

// Unir múltiples loops en un solo polígono
const mergeLoopsIntoPolygon = (mainPath: Coordinate[], loops: Coordinate[][]): Coordinate[] => {
  if (loops.length === 0) return mainPath

  try {
    // Crear polígono principal
    const mainCoords = toPolygonCoords(mainPath)
    let mergedPolygon = polygon([mainCoords])

    // Unir cada loop al polígono principal
    for (const loop of loops) {
      try {
        const loopCoords = toPolygonCoords(loop)
        const loopPolygon = polygon([loopCoords])
        const unified = union(mergedPolygon, loopPolygon)
        if (unified && unified.geometry.type === 'Polygon') {
          mergedPolygon = unified as any
        }
      } catch (e) {
        console.warn('Error uniendo loop:', e)
      }
    }

    // Convertir de vuelta a coordenadas
    const resultCoords = mergedPolygon.geometry.coordinates[0]
    return resultCoords.map((coord: number[]) => ({ lng: coord[0], lat: coord[1] }))
  } catch (e) {
    console.warn('Error en mergeLoopsIntoPolygon:', e)
    return mainPath
  }
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

const getMaxAreaForLevel = (_level: number) => {
  return 5_000_000
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
    try {
      const poiPolygon = polygon([coords])
      if (intersect(runPolygon, poiPolygon)) {
        tags.push({ type: poi.category, name: poi.name })
      }
    } catch (e) {
      console.warn('Error checking POI intersection:', e)
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

    // Actualizar puntos en el perfil
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

    // Crear notificación en la base de datos
    await supabaseAdmin
      .from('notifications')
      .insert({
        user_id: userId,
        type: 'challenge',
        title: '🏅 Desafío completado',
        message: `Has completado "${challenge.name}" y ganado +${challenge.reward_points} puntos`,
        related_id: challenge.id,
      })

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

const updateMissionProgress = async (
  userId: string,
  poiTags: { type: string; name: string }[] | null,
  profileState: any
) => {
  const validTypes = ['park', 'fountain', 'district']
  const missionTypes = Array.from(new Set((poiTags || []).map(tag => tag.type).filter(type => validTypes.includes(type))))
  if (!missionTypes.length) {
    return { rewardPoints: 0, rewardShields: 0, completed: [] as string[] }
  }

  const now = new Date().toISOString()
  const { data: missions, error } = await supabaseAdmin
    .from('missions')
    .select('*')
    .eq('active', true)
    .in('mission_type', missionTypes)
    .lte('start_date', now)
    .gte('end_date', now)

  if (error || !missions) {
    console.error('Error loading missions:', error)
    return { rewardPoints: 0, rewardShields: 0, completed: [] as string[] }
  }

  const result = { rewardPoints: 0, rewardShields: 0, completed: [] as string[] }

  for (const mission of missions) {
    const { data: progressRow, error: progressError } = await supabaseAdmin
      .from('mission_progress')
      .select('id, progress, completed, completed_at')
      .eq('mission_id', mission.id)
      .eq('user_id', userId)
      .maybeSingle()

    if (progressError) {
      console.error('Mission progress error', progressError)
      continue
    }

    if (progressRow?.completed) continue

    const newProgress = (progressRow?.progress || 0) + 1
    const completedNow = newProgress >= mission.target_count

    if (progressRow) {
      await supabaseAdmin
        .from('mission_progress')
        .update({
          progress: newProgress,
          completed: completedNow,
          completed_at: completedNow ? now : progressRow.completed_at,
        })
        .eq('id', progressRow.id)
    } else {
      await supabaseAdmin
        .from('mission_progress')
        .insert({
          mission_id: mission.id,
          user_id: userId,
          progress: newProgress,
          completed: completedNow,
          completed_at: completedNow ? now : null,
        })
    }

    if (completedNow) {
      result.completed.push(mission.title)
      if (mission.reward_points) {
        profileState.total_points = (profileState.total_points || 0) + mission.reward_points
        profileState.season_points = (profileState.season_points || 0) + mission.reward_points
        profileState.historical_points = (profileState.historical_points || 0) + mission.reward_points

        await supabaseAdmin
          .from('profiles')
          .update({
            total_points: profileState.total_points,
            season_points: profileState.season_points,
            historical_points: profileState.historical_points,
          })
          .eq('id', userId)

        result.rewardPoints += mission.reward_points
      }

      if (mission.reward_shields) {
        await supabaseAdmin
          .from('user_shields')
          .insert({ user_id: userId, source: 'mission', charges: mission.reward_shields })
        result.rewardShields += mission.reward_shields
      }

      await sendPushNotification(userId, {
        title: '✅ Misión completada',
        body: mission.title,
        data: { url: '/challenges' },
        tag: `mission-${mission.id}`,
      })
    }
  }

  return result
}

const updateClanCollaboration = async (
  params: {
    userId: string
    userName: string
    poiTags: { type: string; name: string }[] | null
    territoriesConquered: number
    territoriesStolen: number
    territoriesLost: number
    pointsGained: number
  }
) => {
  const { data: memberships, error } = await supabaseAdmin
    .from('clan_members')
    .select('id, clan_id, contribution_points, clan:clans(total_points, territories_controlled)')
    .eq('user_id', params.userId)

  if (error) {
    console.error('Error loading clan memberships:', error)
    return { completed: [] as string[] }
  }

  if (!memberships?.length) {
    return { completed: [] as string[] }
  }

  const poiTypes = new Set((params.poiTags || []).map((tag) => tag.type))
  const completedNames: string[] = []

  for (const membership of memberships) {
    const basePoints = Math.max(params.pointsGained, 0)
    const territoriesDelta = params.territoriesConquered + params.territoriesStolen - params.territoriesLost
    let missionBonus = 0

    const { data: clanMissions, error: missionsError } = await supabaseAdmin
      .from('clan_missions')
      .select('*')
      .eq('clan_id', membership.clan_id)
      .eq('active', true)

    if (missionsError) {
      console.error('Error loading clan missions:', missionsError)
    }

    if (clanMissions?.length) {
      for (const mission of clanMissions) {
        let delta = 0
        switch (mission.mission_type) {
          case 'park':
          case 'fountain':
          case 'district':
            delta = poiTypes.has(mission.mission_type) ? 1 : 0
            break
          case 'territories':
            delta = params.territoriesConquered + params.territoriesStolen
            break
          case 'points':
            delta = Math.round(basePoints)
            break
          default:
            break
        }

        if (!delta) continue

        const newProgress = Math.min((mission.current_progress || 0) + delta, mission.target_count)
        const missionCompleted = newProgress >= mission.target_count

        await supabaseAdmin
          .from('clan_missions')
          .update({
            current_progress: newProgress,
            active: missionCompleted ? false : mission.active,
          })
          .eq('id', mission.id)

        if (missionCompleted) {
          const label = CLAN_MISSION_LABELS[mission.mission_type] || 'Misión del clan'
          completedNames.push(label)
          missionBonus += mission.reward_points || 0

          await supabaseAdmin
            .from('clan_feed')
            .insert({
              clan_id: membership.clan_id,
              user_id: params.userId,
              event_type: 'mission_completed',
              payload: {
                missionName: label,
                rewardPoints: mission.reward_points || 0,
                rewardShields: mission.reward_shields || 0,
              },
            })
        } else {
          await supabaseAdmin
            .from('clan_feed')
            .insert({
              clan_id: membership.clan_id,
              user_id: params.userId,
              event_type: 'territory_help',
              payload: {
                territoryName: CLAN_MISSION_LABELS[mission.mission_type] || 'Territorio aliado',
              },
            })
        }
      }
    }

    await supabaseAdmin
      .from('clan_members')
      .update({
        contribution_points: (membership.contribution_points || 0) + basePoints + missionBonus,
      })
      .eq('id', membership.id)

    const clanPoints = (membership.clan?.total_points || 0) + basePoints + missionBonus
    const clanTerritories = Math.max((membership.clan?.territories_controlled || 0) + territoriesDelta, 0)

    await supabaseAdmin
      .from('clans')
      .update({
        total_points: clanPoints,
        territories_controlled: clanTerritories,
      })
      .eq('id', membership.clan_id)

    await supabaseAdmin
      .from('clan_feed')
      .insert({
        clan_id: membership.clan_id,
        user_id: params.userId,
        event_type: 'run_contribution',
        payload: {
          points: basePoints,
          territories: params.territoriesConquered + params.territoriesStolen,
        },
      })
  }

  return { completed: completedNames }
}

const fetchActiveShield = async (territoryId: string) => {
  const { data } = await supabaseAdmin
    .from('territory_shields')
    .select('*, user:profiles!territory_shields_user_id_fkey(username)')
    .eq('territory_id', territoryId)
    .gt('expires_at', new Date().toISOString())
    .maybeSingle()
  return data
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

// Calcular diferencia de polígonos para manejar solapamientos parciales
const calculatePolygonDifference = (newPolygon: any, existingPolygons: any[]): any => {
  let resultPolygon = newPolygon
  
  for (const existing of existingPolygons) {
    try {
      const diff = difference(resultPolygon, existing)
      if (diff && diff.geometry.type === 'Polygon') {
        resultPolygon = diff
      } else if (diff && diff.geometry.type === 'MultiPolygon') {
        // Tomar el polígono más grande si se divide en múltiples
        let largestArea = 0
        let largestPoly = null
        for (const coords of diff.geometry.coordinates) {
          const poly = polygon(coords)
          const polyArea = turfArea(poly)
          if (polyArea > largestArea) {
            largestArea = polyArea
            largestPoly = poly
          }
        }
        if (largestPoly) {
          resultPolygon = largestPoly
        }
      }
    } catch (e) {
      console.warn('Error calculando diferencia de polígonos:', e)
    }
  }
  
  return resultPolygon
}

// Dividir territorio existente cuando alguien conquista una parte interior
const splitTerritoryWithInnerConquest = async (
  existingTerritory: any,
  innerPolygon: any,
  attackerId: string,
  attackerLeagueShard: string
): Promise<{ remainingCoords: Coordinate[] | null; innerArea: number }> => {
  try {
    const existingCoords = (existingTerritory.coordinates as any[]).map((coord: any) => [coord.lng, coord.lat])
    if (existingCoords[0][0] !== existingCoords[existingCoords.length - 1][0] || 
        existingCoords[0][1] !== existingCoords[existingCoords.length - 1][1]) {
      existingCoords.push([...existingCoords[0]])
    }
    const existingPoly = polygon([existingCoords])
    
    // Verificar si el polígono interior está completamente dentro del existente
    if (!booleanContains(existingPoly, innerPolygon)) {
      return { remainingCoords: null, innerArea: 0 }
    }
    
    // Calcular la diferencia (territorio que queda al propietario original)
    const remainingPoly = difference(existingPoly, innerPolygon)
    
    if (!remainingPoly) {
      return { remainingCoords: null, innerArea: turfArea(innerPolygon) }
    }
    
    if (remainingPoly.geometry.type === 'Polygon') {
      const coords = remainingPoly.geometry.coordinates[0].map((c: number[]) => ({ lng: c[0], lat: c[1] }))
      return { remainingCoords: coords, innerArea: turfArea(innerPolygon) }
    } else if (remainingPoly.geometry.type === 'MultiPolygon') {
      // Tomar el polígono más grande
      let largestArea = 0
      let largestCoords: Coordinate[] | null = null
      for (const coords of remainingPoly.geometry.coordinates) {
        const poly = polygon(coords)
        const polyArea = turfArea(poly)
        if (polyArea > largestArea) {
          largestArea = polyArea
          largestCoords = coords[0].map((c: number[]) => ({ lng: c[0], lat: c[1] }))
        }
      }
      return { remainingCoords: largestCoords, innerArea: turfArea(innerPolygon) }
    }
    
    return { remainingCoords: null, innerArea: 0 }
  } catch (e) {
    console.error('Error en splitTerritoryWithInnerConquest:', e)
    return { remainingCoords: null, innerArea: 0 }
  }
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

    let path = payload.path

    // Detectar loops cerrados dentro de la ruta (para vueltas a plazas)
    const loops = findClosedLoops(path, 30)
    if (loops.length > 0) {
      console.log(`Detectados ${loops.length} loops en la ruta`)
      path = mergeLoopsIntoPolygon(path, loops)
    }

    if (!isPolygonClosed(path)) {
      return new Response(
        JSON.stringify({ error: 'Debes cerrar el polígono para reclamar un territorio' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const distance = calculatePathDistance(payload.path) // Usar path original para distancia
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
      .select('id, username, total_points, total_territories, total_distance, season_points, historical_points, league_shard')
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
        JSON.stringify({ error: `El área (${Math.round(area)} m²) supera el límite permitido (${Math.round(maxArea)} m²)` }),
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
    let overlappingTerritories: any[] = []
    let containingTerritory: any = null // Territorio que contiene completamente al nuevo

    if (territories) {
      for (const territory of territories) {
        const coords = (territory.coordinates as any[] | null) ?? []
        if (!coords.length) continue
        
        try {
          const territoryCoords = coords.map((coord: any) => [coord.lng, coord.lat])
          if (territoryCoords[0][0] !== territoryCoords[territoryCoords.length - 1][0] || 
              territoryCoords[0][1] !== territoryCoords[territoryCoords.length - 1][1]) {
            territoryCoords.push([...territoryCoords[0]])
          }
          const territoryPolygon = polygon([territoryCoords])
          
          // Verificar si el nuevo polígono está dentro de uno existente
          if (booleanContains(territoryPolygon, runPolygon)) {
            containingTerritory = { ...territory, polygon: territoryPolygon }
          }
          
          const overlap = intersect(runPolygon, territoryPolygon)
          if (!overlap) continue
          
          const overlapArea = turfArea(overlap)
          const ratio = territory.area > 0 ? overlapArea / territory.area : 0
          const newRatio = area > 0 ? overlapArea / area : 0
          
          // Guardar todos los territorios con solapamiento significativo
          if (ratio > PARTIAL_OVERLAP_THRESHOLD || newRatio > PARTIAL_OVERLAP_THRESHOLD) {
            overlappingTerritories.push({
              territory,
              polygon: territoryPolygon,
              overlapRatio: ratio,
              newOverlapRatio: newRatio,
              overlapArea
            })
          }
          
          if (ratio > highestOverlap) {
            highestOverlap = ratio
            targetTerritory = territory
          }
        } catch (e) {
          console.warn('Error procesando territorio existente:', e)
        }
      }
    }

    const isStealAttempt = targetTerritory && targetTerritory.user_id !== user.id && highestOverlap >= OVERLAP_THRESHOLD
    const isOwnTerritory = targetTerritory && targetTerritory.user_id === user.id && highestOverlap >= OVERLAP_THRESHOLD
    
    // Verificar si es una conquista interior (correr dentro de territorio ajeno)
    const isInnerConquest = containingTerritory && 
                           containingTerritory.territory.user_id !== user.id && 
                           !isStealAttempt
    
    // Verificar si hay solapamiento parcial con territorios ajenos
    const hasPartialOverlap = overlappingTerritories.some(
      ot => ot.territory.user_id !== user.id && 
           ot.overlapRatio < OVERLAP_THRESHOLD && 
           ot.overlapRatio > PARTIAL_OVERLAP_THRESHOLD
    )
    
    const isNewTerritory = !isStealAttempt && !isOwnTerritory && !isInnerConquest

    let territoriesConquered = 0
    let territoriesStolen = 0
    let territoriesLost = 0
    let pointsGained = 0
    let territoryId: string | null = null
    let runId: string | null = null
    let action: 'conquered' | 'stolen' | 'reinforced' | 'inner_conquest' = 'conquered'
    let poiTags: { type: string; name: string }[] = []
    let challengeRewards: string[] = []
    let missionsCompleted: string[] = []
    let clanMissionsCompleted: string[] = []
    let missionRewardPoints = 0
    let missionRewardShields = 0

    const rewardPoints = calculateRewardPoints(distance, area, Boolean(isStealAttempt || isInnerConquest))
    pointsGained = rewardPoints

    // CASO 1: Intento de robo (solapamiento >= 80%)
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

      const activeShield = await fetchActiveShield(targetTerritory.id)
      if (activeShield && targetTerritory.user_id !== user.id) {
        await notifyDefender(`${attackerName} ha intentado atacar, pero tu escudo sigue activo.`)
        return new Response(
          JSON.stringify({ error: 'Este territorio está protegido con un escudo activo' }),
          { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
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
          league_shard: profile.league_shard || 'bronze-1',
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
        await supabaseAdmin
          .from('territory_shields')
          .delete()
          .eq('territory_id', targetTerritory.id)
        await notifyDefender(`${attackerName} conquistó uno de tus territorios.`)
      }
    }
    // CASO 2: Conquista interior (correr dentro de territorio ajeno sin protección)
    else if (isInnerConquest && containingTerritory) {
      const targetTerr = containingTerritory.territory
      
      // Verificar protección
      if (targetTerr.protected_until && new Date(targetTerr.protected_until) > now) {
        return new Response(
          JSON.stringify({ error: 'El territorio está protegido temporalmente. Espera a que expire el escudo.' }),
          { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }
      
      const activeShield = await fetchActiveShield(targetTerr.id)
      if (activeShield) {
        return new Response(
          JSON.stringify({ error: 'Este territorio está protegido con un escudo activo' }),
          { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }
      
      // Dividir el territorio
      const { remainingCoords, innerArea } = await splitTerritoryWithInnerConquest(
        targetTerr,
        runPolygon,
        user.id,
        profile.league_shard || 'bronze-1'
      )
      
      if (remainingCoords && remainingCoords.length >= 4) {
        // Actualizar territorio original con la parte restante
        const remainingArea = calculatePolygonArea(remainingCoords)
        const remainingPerimeter = calculatePerimeter(remainingCoords)
        
        await supabaseAdmin
          .from('territories')
          .update({
            coordinates: remainingCoords,
            area: remainingArea,
            perimeter: remainingPerimeter,
            points: Math.floor(targetTerr.points * (remainingArea / targetTerr.area)),
          })
          .eq('id', targetTerr.id)
      }
      
      // Crear nuevo territorio para el atacante
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
          league_shard: profile.league_shard || 'bronze-1',
        })
        .select('id')
        .single()

      if (insertError || !inserted) {
        throw new Error('No se pudo crear el territorio interior')
      }
      
      territoryId = inserted.id
      territoriesConquered = 1
      action = 'inner_conquest'
      
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
      
      // Notificar al defensor
      await sendPushNotification(targetTerr.user_id, {
        title: '⚔️ Conquista interior',
        body: `${attackerName} ha conquistado una zona dentro de tu territorio`,
        data: { url: `/territories/${targetTerr.id}` },
        tag: targetTerr.id,
      })
    }
    // CASO 3: Reforzar territorio propio
    else if (isOwnTerritory && targetTerritory) {
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
    }
    // CASO 4: Nuevo territorio (con posible solapamiento parcial)
    else if (isNewTerritory) {
      let finalPath = path
      let finalArea = area
      
      // Si hay solapamientos parciales con territorios ajenos, calcular la diferencia
      if (hasPartialOverlap) {
        const otherPolygons = overlappingTerritories
          .filter(ot => ot.territory.user_id !== user.id)
          .map(ot => ot.polygon)
        
        if (otherPolygons.length > 0) {
          try {
            const adjustedPolygon = calculatePolygonDifference(runPolygon, otherPolygons)
            if (adjustedPolygon && adjustedPolygon.geometry) {
              const adjustedArea = turfArea(adjustedPolygon)
              if (adjustedArea >= MINIMUM_AREA_M2) {
                finalPath = adjustedPolygon.geometry.coordinates[0].map((c: number[]) => ({ lng: c[0], lat: c[1] }))
                finalArea = adjustedArea
              }
            }
          } catch (e) {
            console.warn('Error ajustando polígono por solapamiento:', e)
          }
        }
      }
      
      const requiredPace = calculateRequiredPace(avgPace, userLevel)
      const { data: inserted, error: insertError } = await supabaseAdmin
        .from('territories')
        .insert({
          user_id: user.id,
          coordinates: finalPath,
          area: finalArea,
          perimeter: calculatePerimeter(finalPath),
          avg_pace: avgPace,
          required_pace: requiredPace,
          protected_until: protectedUntil,
          cooldown_until: new Date(now.getTime() + STEAL_COOLDOWN_MS).toISOString(),
          status: 'protected',
          conquest_points: rewardPoints,
          points: rewardPoints,
          league_shard: profile.league_shard || 'bronze-1',
        })
        .select('id')
        .single()

      if (insertError || !inserted) {
        console.error('Error insertando territorio:', insertError)
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

      const missionResult = await updateMissionProgress(user.id, poiTags, profileState)
      if (missionResult.rewardPoints) {
        missionRewardPoints += missionResult.rewardPoints
        pointsGained += missionResult.rewardPoints
      }
      if (missionResult.rewardShields) {
        missionRewardShields += missionResult.rewardShields
      }
      if (missionResult.completed.length) {
        missionsCompleted = [...missionsCompleted, ...missionResult.completed]
      }

      const clanResult = await updateClanCollaboration({
        userId: user.id,
        userName: attackerName,
        poiTags,
        territoriesConquered: territoriesConquered,
        territoriesStolen: territoriesStolen,
        territoriesLost: territoriesLost,
        pointsGained,
      })
      if (clanResult.completed.length) {
        clanMissionsCompleted = [...clanMissionsCompleted, ...clanResult.completed]
      }
    }

    const { data: run } = await supabaseAdmin
      .from('runs')
      .insert({
        user_id: user.id,
        path: payload.path as any, // Guardar path original
        distance,
        duration: payload.duration,
        avg_pace: avgPace,
        territories_conquered: territoriesConquered,
        territories_stolen: territoriesStolen,
        territories_lost: territoriesLost,
        points_gained: pointsGained,
        league_shard: profile.league_shard || 'bronze-1',
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
          defender_id: targetTerritory?.user_id || containingTerritory?.territory?.user_id,
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
          missionsCompleted,
          missionRewards: {
            points: missionRewardPoints,
            shields: missionRewardShields,
          },
          clanMissionsCompleted,
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
