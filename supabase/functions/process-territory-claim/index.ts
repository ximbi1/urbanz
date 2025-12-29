import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3'
import { polygon, area as turfArea, intersect, booleanPointInPolygon, point, simplify, booleanContains, difference, buffer } from 'https://esm.sh/@turf/turf@6.5.0'
import webpush from 'https://esm.sh/web-push@3.6.1'
import {
  calculateAveragePace,
  calculateDistance,
  calculatePathDistance,
  calculatePerimeter,
  calculatePolygonArea,
  computeSafeDifference,
  ensureClosed,
  findClosedLoops,
  isPolygonClosed,
  mergeLoopsIntoPolygon,
  toLatLngCoordsFromGeo,
  toPolygonCoords,
} from './lib/geo.ts'
import { ClaimPayload, Coordinate } from './lib/types.ts'
import { calculateLevel, calculateRequiredPace, calculateRewardPoints, getMaxAreaForLevel } from './lib/rewards.ts'
import { createLogger } from './lib/logger.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const PROTECTION_DURATION_MS = 24 * 60 * 60 * 1000
const STEAL_COOLDOWN_MS = 6 * 60 * 60 * 1000
const MINIMUM_AREA_M2 = 50
const OVERLAP_THRESHOLD = 0.8
const PARTIAL_OVERLAP_THRESHOLD = 0.1 // Umbral mínimo para robo parcial
const CLAN_MISSION_LABELS: Record<string, string> = {
  park: 'Ruta de parques',
  fountain: 'Ruta de hidratación',
  district: 'Distritos dominados',
  territories: 'Territorios coordinados',
  points: 'Influencia acumulada',
}
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
  // Eliminar duplicados por nombre
  const uniq = new Map<string, { type: string; name: string }>()
  tags.forEach(tag => {
    if (!uniq.has(tag.name)) uniq.set(tag.name, tag)
  })
  return Array.from(uniq.values())
}

// Verificar si el usuario ha conquistado algún parque rodeándolo completamente
const checkParkConquests = async (
  userId: string,
  runPolygon: any,
  pois: any[],
  runId: string | null
): Promise<{ conquered: string[]; stolen: string[] }> => {
  const result = { conquered: [] as string[], stolen: [] as string[] }
  
  const parks = pois.filter(poi => poi.category === 'park')
  if (!parks.length) return result

  for (const park of parks) {
    const coords = (park.coordinates as any[])?.map((coord) => [coord.lng, coord.lat])
    if (!coords || coords.length < 3) continue

    try {
      // Cerrar el polígono del parque si no está cerrado
      const closedCoords = [...coords]
      if (closedCoords[0][0] !== closedCoords[closedCoords.length - 1][0] ||
          closedCoords[0][1] !== closedCoords[closedCoords.length - 1][1]) {
        closedCoords.push(closedCoords[0])
      }
      
      const parkPolygon = polygon([closedCoords])
      
      // Verificar si el runPolygon CONTIENE completamente el parque
      if (!booleanContains(runPolygon, parkPolygon)) continue

      console.log(`Park ${park.name} (${park.id}) is fully contained in user's run polygon`)

      // Verificar si el parque ya tiene propietario
      const { data: existingConquest } = await supabaseAdmin
        .from('park_conquests')
        .select('id, user_id, profiles:user_id(username)')
        .eq('park_id', park.id)
        .maybeSingle()

      if (existingConquest) {
        if (existingConquest.user_id === userId) {
          // El usuario ya es propietario, no hacer nada
          continue
        }
        // Robar el parque al propietario anterior
        await supabaseAdmin
          .from('park_conquests')
          .update({ 
            user_id: userId, 
            conquered_at: new Date().toISOString(),
            run_id: runId 
          })
          .eq('id', existingConquest.id)
        
        const prevOwner = (existingConquest.profiles as any)?.username || 'Alguien'
        result.stolen.push(park.name)
        console.log(`Park ${park.name} stolen from ${prevOwner}`)

        // Notificar al propietario anterior
        await supabaseAdmin
          .from('notifications')
          .insert({
            user_id: existingConquest.user_id,
            type: 'park_lost',
            title: '🌳 Parque perdido',
            message: `Han conquistado tu parque "${park.name}"`,
            related_id: park.id,
          })
      } else {
        // Nuevo parque conquistado
        await supabaseAdmin
          .from('park_conquests')
          .insert({
            park_id: park.id,
            user_id: userId,
            run_id: runId,
          })
        result.conquered.push(park.name)
        console.log(`Park ${park.name} conquered for the first time`)
      }
    } catch (e) {
      console.warn('Error checking park conquest:', park.name, e)
    }
  }

  return result
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

    const clanData = Array.isArray(membership.clan) ? membership.clan[0] : membership.clan
    const clanPoints = (clanData?.total_points || 0) + basePoints + missionBonus
    const clanTerritories = Math.max((clanData?.territories_controlled || 0) + territoriesDelta, 0)

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
  notification: { title: string; body: string; data?: Record<string, unknown>; tag?: string },
  traceId?: string
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
        console.error('Error enviando notificación push', { traceId, error })
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
  const traceId = crypto.randomUUID()
  const logger = createLogger(traceId)
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
    logger.info('User authenticated', { userId: user.id })

    const payload = (await req.json()) as ClaimPayload
    if (!payload?.path || payload.path.length < 4) {
      logger.warn('Invalid payload path', { traceId, points: payload?.path?.length })
      return new Response(
        JSON.stringify({ error: 'Ruta inválida' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    if (!payload.duration || payload.duration <= 0) {
      logger.warn('Invalid payload duration', { traceId, duration: payload?.duration })
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
      logger.warn('Polygon not closed', { traceId, points: path.length })
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
      .select('id, username, total_points, total_territories, total_distance, season_points, social_points, historical_points, league_shard, explorer_mode, social_league')
      .eq('id', user.id)
      .single()

    if (profileError || !profile) {
      logger.error('Profile not found or error', { error: profileError?.message, userId: user.id })
      throw new Error('No se encontró el perfil del usuario')
    }

    const userLevel = calculateLevel(profile.total_points)
    const attackerName = profile.username || 'Un corredor'
    const profileState: any = { ...profile }
    const maxArea = getMaxAreaForLevel(userLevel)
    const isExplorerMode = Boolean(profile.explorer_mode)
    const isSocialLeague = Boolean(profile.social_league)

    // MODO EXPLORADOR: Solo guardar la ruta sin afectar territorios
    if (isExplorerMode) {
      logger.info('Explorer mode run, saving without territories', { userId: user.id })
      
      // Guardar en explorer_territories en lugar de territories
      await supabaseAdmin
        .from('explorer_territories')
        .insert({
          user_id: user.id,
          path: payload.path,
          distance,
          duration: payload.duration,
          metadata: { avg_pace: avgPace, area, perimeter }
        })
      
      // Actualizar distancia total del perfil
      await supabaseAdmin
        .from('profiles')
        .update({
          total_distance: (profile.total_distance || 0) + distance
        })
        .eq('id', user.id)
      
      return new Response(
        JSON.stringify({
          success: true,
          explorerMode: true,
          data: {
            action: 'explorer_run',
            distance,
            duration: payload.duration,
            avgPace,
            area,
            message: 'Ruta guardada en modo explorador'
          }
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    if (area > maxArea) {
      logger.warn('Area exceeds max limit', { area, maxArea, userLevel })
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
        is_social,
        social_participants,
        owner:profiles!territories_user_id_fkey(id, username, total_points, social_league)
      `)

    if (territoriesError) {
      throw new Error('No se pudieron cargar los territorios existentes')
    }

    let targetTerritory: any = null
    let highestOverlap = 0
    let targetTerritoryPolygon: any = null
    let targetOverlapGeom: any = null
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
              overlapArea,
              overlapGeom: overlap
            })
          }
          
          if (ratio > highestOverlap) {
            highestOverlap = ratio
            targetTerritory = territory
            targetTerritoryPolygon = territoryPolygon
            targetOverlapGeom = overlap
          }
        } catch (e) {
          console.warn('Error procesando territorio existente:', e)
        }
      }
    }

    const isStealAttempt = targetTerritory && targetTerritory.user_id !== user.id && highestOverlap >= OVERLAP_THRESHOLD
    const isPartialStealAttempt = targetTerritory && targetTerritory.user_id !== user.id &&
      highestOverlap >= PARTIAL_OVERLAP_THRESHOLD && highestOverlap < OVERLAP_THRESHOLD && Boolean(targetOverlapGeom)
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
    let parksConquered: string[] = []
    let parksStolen: string[] = []

    // CASO 1 y 2: Robo (parcial o alto solapamiento) sin tomar el 100% del territorio
    const rewardPoints = calculateRewardPoints(distance, area, Boolean(isStealAttempt || isPartialStealAttempt || isInnerConquest))
    pointsGained = rewardPoints

    // LIGA SOCIAL: Verificar si el atacante está en liga social (no puede robar)
    // o si el defensor está en liga social (su territorio no puede ser robado)
    const defenderInSocialLeague = targetTerritory?.owner?.social_league || targetTerritory?.is_social
    
    // Si el atacante está en Liga Social, NO puede robar - buscar territorios sociales para fusionar
    if (isSocialLeague) {
      logger.info('Social league mode - checking for existing social territories', { userId: user.id })
      
      // Buscar territorios sociales existentes que se solapen con el nuevo
      const socialOverlaps = overlappingTerritories.filter(ot => ot.territory.is_social)
      
      if (socialOverlaps.length > 0) {
        // Fusionar con territorio social existente
        const primarySocial = socialOverlaps[0].territory
        const existingParticipants: string[] = (primarySocial.social_participants as string[]) || []
        
        // Añadir usuario a participantes si no está ya
        const newParticipants = existingParticipants.includes(user.id) 
          ? existingParticipants 
          : [...existingParticipants, user.id]
        
        // Fusionar polígonos
        try {
          const existingCoords = (primarySocial.coordinates as any[]).map((c: any) => [c.lng, c.lat])
          if (existingCoords[0][0] !== existingCoords[existingCoords.length - 1][0] ||
              existingCoords[0][1] !== existingCoords[existingCoords.length - 1][1]) {
            existingCoords.push([...existingCoords[0]])
          }
          const existingPoly = polygon([existingCoords])
          
          // Usar union para fusionar polígonos (importar de turf)
          const { union } = await import('https://esm.sh/@turf/turf@6.5.0')
          const merged = union(existingPoly, runPolygon)
          
          if (merged && merged.geometry.type === 'Polygon') {
            const mergedCoords = merged.geometry.coordinates[0].map((c: number[]) => ({ lng: c[0], lat: c[1] }))
            const mergedArea = turfArea(merged)
            const mergedPerimeter = calculatePerimeter(mergedCoords)
            
            await supabaseAdmin
              .from('territories')
              .update({
                coordinates: mergedCoords,
                area: mergedArea,
                perimeter: mergedPerimeter,
                social_participants: newParticipants,
                points: (primarySocial.points || 0) + rewardPoints,
                conquest_points: (primarySocial.conquest_points || 0) + rewardPoints,
                league_shard: 'social', // Mundos separados: Liga Social tiene su propio shard
              })
              .eq('id', primarySocial.id)
            
            territoryId = primarySocial.id
          }
        } catch (e) {
          logger.warn('Error merging social territories, creating adjacent', { error: String(e) })
          // Si falla la fusión, crear territorio adyacente
        }
        
        if (territoryId) {
          action = 'conquered'
          territoriesConquered = 1
          
          profileState.total_points = (profileState.total_points || 0) + rewardPoints
          // Mundos separados: Liga Social suma a social_points, competitivo a season_points
          if (isSocialLeague) {
            profileState.social_points = (profileState.social_points || 0) + rewardPoints
          } else {
            profileState.season_points = (profileState.season_points || 0) + rewardPoints
          }
          profileState.historical_points = (profileState.historical_points || 0) + rewardPoints
          profileState.total_distance = (profileState.total_distance || 0) + distance
          
          await supabaseAdmin
            .from('profiles')
            .update({
              total_points: profileState.total_points,
              ...(isSocialLeague 
                ? { social_points: profileState.social_points }
                : { season_points: profileState.season_points }),
              historical_points: profileState.historical_points,
              total_distance: profileState.total_distance,
            })
            .eq('id', user.id)
          
          // Saltar al final del procesamiento de territorio
          // (el run se guarda más abajo)
        }
      }
      
      // Si no hay territorios sociales para fusionar, crear uno nuevo (se maneja en CASO 4)
      // Pero asegurarnos de que no se intente robar
    }
    
    // Si el defensor está en Liga Social, bloquear el robo y convertir en nuevo territorio
    if ((isStealAttempt || isPartialStealAttempt || isInnerConquest) && defenderInSocialLeague) {
      logger.info('Defender in social league - steal blocked', { 
        defenderId: targetTerritory?.user_id,
        attackerId: user.id 
      })
      
      // Convertir intento de robo en territorio nuevo sin afectar al defensor
      // Calcular la diferencia para que no se solapen
      const otherPolygons = [targetTerritoryPolygon].filter(Boolean)
      if (containingTerritory) {
        otherPolygons.push(containingTerritory.polygon)
      }
      
      try {
        const adjustedPolygon = calculatePolygonDifference(runPolygon, otherPolygons)
        if (adjustedPolygon && adjustedPolygon.geometry && adjustedPolygon.geometry.type === 'Polygon') {
          const adjustedArea = turfArea(adjustedPolygon)
          if (adjustedArea >= MINIMUM_AREA_M2) {
            const adjustedPath = adjustedPolygon.geometry.coordinates[0].map((c: number[]) => ({ lng: c[0], lat: c[1] }))
            const adjustedPerimeter = calculatePerimeter(adjustedPath)
            const adjustedReward = calculateRewardPoints(distance, adjustedArea, false)
            const requiredPace = calculateRequiredPace(avgPace, userLevel)
            
            const { data: inserted, error: insertError } = await supabaseAdmin
              .from('territories')
              .insert({
                user_id: user.id,
                coordinates: adjustedPath,
                area: adjustedArea,
                perimeter: adjustedPerimeter,
                avg_pace: avgPace,
                required_pace: requiredPace,
                protected_until: protectedUntil,
                cooldown_until: new Date(now.getTime() + STEAL_COOLDOWN_MS).toISOString(),
                status: 'protected',
                conquest_points: adjustedReward,
                points: adjustedReward,
                // Mundos separados: Liga Social usa 'social', competitivo usa league_shard normal
                league_shard: isSocialLeague ? 'social' : (profile.league_shard || 'bronze-1'),
                is_social: isSocialLeague,
                social_participants: isSocialLeague ? [user.id] : null,
              })
              .select('id')
              .single()
            
            if (!insertError && inserted) {
              territoryId = inserted.id
              territoriesConquered = 1
              action = 'conquered'
              pointsGained = adjustedReward
              
              profileState.total_points = (profileState.total_points || 0) + adjustedReward
              // Mundos separados: Liga Social suma a social_points
              if (isSocialLeague) {
                profileState.social_points = (profileState.social_points || 0) + adjustedReward
              } else {
                profileState.season_points = (profileState.season_points || 0) + adjustedReward
              }
              profileState.historical_points = (profileState.historical_points || 0) + adjustedReward
              profileState.total_territories = (profileState.total_territories || 0) + 1
              profileState.total_distance = (profileState.total_distance || 0) + distance
              
              await supabaseAdmin
                .from('profiles')
                .update({
                  total_points: profileState.total_points,
                  ...(isSocialLeague 
                    ? { social_points: profileState.social_points }
                    : { season_points: profileState.season_points }),
                  historical_points: profileState.historical_points,
                  total_territories: profileState.total_territories,
                  total_distance: profileState.total_distance,
                })
                .eq('id', user.id)
            }
          }
        }
      } catch (e) {
        logger.warn('Error creating non-overlapping territory for social league block', { error: String(e) })
      }
    }
    // Si el atacante está en Liga Social, convertir intento de robo en fusión/nuevo territorio
    else if ((isStealAttempt || isPartialStealAttempt || isInnerConquest) && isSocialLeague && !territoryId) {
      logger.info('Attacker in social league - converting steal to new territory', { userId: user.id })
      // Se manejará como nuevo territorio más abajo
    }
    // CASO NORMAL: Robo cuando ninguno está en Liga Social
    else if ((isStealAttempt || isPartialStealAttempt) && targetTerritory && targetTerritoryPolygon && targetOverlapGeom && !territoryId) {
      const ownerLevel = calculateLevel(targetTerritory.owner?.total_points || 0)
      const requiredPace = calculateRequiredPace(targetTerritory.avg_pace, ownerLevel)
      const overlapArea = turfArea(targetOverlapGeom)

      if (overlapArea < MINIMUM_AREA_M2) {
        return new Response(
          JSON.stringify({ error: 'La porción solapada es demasiado pequeña para robarla' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      if (avgPace > requiredPace) {
        return new Response(
          JSON.stringify({ error: `Necesitas un ritmo de ${requiredPace.toFixed(2)} min/km o menos para robar este territorio` }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      if (targetTerritory.protected_until && new Date(targetTerritory.protected_until) > now) {
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
        return new Response(
          JSON.stringify({ error: 'Debes esperar antes de volver a atacar este territorio', cooldown: remaining }),
          { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      const activeShield = await fetchActiveShield(targetTerritory.id)
      if (activeShield && targetTerritory.user_id !== user.id) {
        return new Response(
          JSON.stringify({ error: 'Este territorio está protegido con un escudo activo' }),
          { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      const overlapCoords = toLatLngCoordsFromGeo(targetOverlapGeom)
      if (overlapCoords.length < 3) {
        return new Response(
          JSON.stringify({ error: 'No se pudo calcular la porción robada' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      const reducedCoords = computeSafeDifference(targetTerritoryPolygon, targetOverlapGeom, MINIMUM_AREA_M2)
      if (!reducedCoords) {
        return new Response(
          JSON.stringify({ error: 'No se pudo recalcular el territorio original tras el recorte' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      const reducedArea = calculatePolygonArea(reducedCoords)
      const reducedPerimeter = calculatePerimeter(reducedCoords)
      const rewardPointsPartial = calculateRewardPoints(distance, overlapArea, true)
      const newRequiredPace = calculateRequiredPace(avgPace, userLevel)

      // Actualizar territorio original (defensor) con la porción restante
      await supabaseAdmin
        .from('territories')
        .update({
          coordinates: reducedCoords,
          area: reducedArea,
          perimeter: reducedPerimeter,
          protected_until: protectedUntil,
          cooldown_until: new Date(now.getTime() + STEAL_COOLDOWN_MS).toISOString(),
          status: 'protected',
          last_attacker_id: user.id,
          last_defender_id: targetTerritory.user_id,
          last_attack_at: now.toISOString(),
          points: Math.max((targetTerritory.points || 0) - rewardPointsPartial, 0),
          conquest_points: Math.max((targetTerritory.conquest_points || 0) - rewardPointsPartial, 0),
        })
        .eq('id', targetTerritory.id)

      // Crear territorio nuevo para el atacante con la porción robada
      const partialPerimeter = calculatePerimeter(overlapCoords)
      const { data: newPartial, error: newPartialError } = await supabaseAdmin
        .from('territories')
        .insert({
          user_id: user.id,
          coordinates: overlapCoords,
          area: overlapArea,
          perimeter: partialPerimeter,
          avg_pace: avgPace,
          required_pace: newRequiredPace,
          protected_until: protectedUntil,
          cooldown_until: new Date(now.getTime() + STEAL_COOLDOWN_MS).toISOString(),
          status: 'protected',
          conquest_points: rewardPointsPartial,
          points: rewardPointsPartial,
          league_shard: profile.league_shard || 'bronze-1',
        })
        .select('id')
        .single()

      if (newPartialError || !newPartial) {
        throw new Error('No se pudo crear el territorio parcial robado')
      }

      territoryId = newPartial.id
      territoriesStolen = 1
      action = 'stolen'
      pointsGained = rewardPointsPartial

      // Si el atacante recorrió zona fuera del territorio defensor, crear un territorio adicional con el resto de su polígono
      const attackerRemainderGeom = difference(runPolygon, targetTerritoryPolygon) || difference(buffer(runPolygon, 0), buffer(targetTerritoryPolygon, 0))
      if (attackerRemainderGeom) {
        const remainderCoords = toLatLngCoordsFromGeo(attackerRemainderGeom)
        const closedRemainder = ensureClosed(remainderCoords)
        const remainderArea = calculatePolygonArea(closedRemainder)
        if (remainderArea >= MINIMUM_AREA_M2 && closedRemainder.length >= 4) {
          const remainderPerimeter = calculatePerimeter(closedRemainder)
          const rewardPointsRemainder = calculateRewardPoints(distance, remainderArea, false)
          const { data: remainderInsert } = await supabaseAdmin
            .from('territories')
            .insert({
              user_id: user.id,
              coordinates: closedRemainder,
              area: remainderArea,
              perimeter: remainderPerimeter,
              avg_pace: avgPace,
              required_pace: newRequiredPace,
              protected_until: protectedUntil,
              cooldown_until: new Date(now.getTime() + STEAL_COOLDOWN_MS).toISOString(),
              status: 'protected',
              conquest_points: rewardPointsRemainder,
              points: rewardPointsRemainder,
              league_shard: profile.league_shard || 'bronze-1',
            })
            .select('id')
            .single()

          if (remainderInsert?.id) {
            territoriesConquered += 1
            pointsGained += rewardPointsRemainder
            profileState.total_points = (profileState.total_points || 0) + rewardPointsRemainder
            // Mundos separados: Liga Social suma a social_points
            if (isSocialLeague) {
              profileState.social_points = (profileState.social_points || 0) + rewardPointsRemainder
            } else {
              profileState.season_points = (profileState.season_points || 0) + rewardPointsRemainder
            }
            profileState.historical_points = (profileState.historical_points || 0) + rewardPointsRemainder
            profileState.total_territories = (profileState.total_territories || 0) + 1
          }
        }
      }

      profileState.total_points = (profileState.total_points || 0) + rewardPointsPartial
      // Mundos separados: Liga Social suma a social_points
      if (isSocialLeague) {
        profileState.social_points = (profileState.social_points || 0) + rewardPointsPartial
      } else {
        profileState.season_points = (profileState.season_points || 0) + rewardPointsPartial
      }
      profileState.historical_points = (profileState.historical_points || 0) + rewardPointsPartial
      profileState.total_territories = (profileState.total_territories || 0) + 1
      profileState.total_distance = (profileState.total_distance || 0) + distance

      await supabaseAdmin
        .from('profiles')
        .update({
          total_points: profileState.total_points,
          ...(isSocialLeague 
            ? { social_points: profileState.social_points }
            : { season_points: profileState.season_points }),
          historical_points: profileState.historical_points,
          total_territories: profileState.total_territories,
          total_distance: profileState.total_distance,
        })
        .eq('id', user.id)

      if (targetTerritory.user_id) {
        await sendPushNotification(targetTerritory.user_id, {
          title: '⚠️ Robo parcial',
          body: `${attackerName} ha conquistado una parte de tu territorio`,
          data: { url: `/territories/${targetTerritory.id}` },
          tag: targetTerritory.id,
        }, traceId)
      }

      await supabaseAdmin
        .from('territory_events')
        .insert({
          territory_id: targetTerritory.id,
          attacker_id: user.id,
          defender_id: targetTerritory.user_id,
          event_type: 'steal',
          result: 'partial',
          overlap_ratio: highestOverlap,
          pace: avgPace,
          area: overlapArea,
          points_awarded: rewardPointsPartial,
        })
    }
    // CASO 3: Conquista interior (correr dentro de territorio ajeno sin protección)
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
      // Mundos separados: Liga Social suma a social_points
      if (isSocialLeague) {
        profileState.social_points = (profileState.social_points || 0) + rewardPoints
      } else {
        profileState.season_points = (profileState.season_points || 0) + rewardPoints
      }
      profileState.historical_points = (profileState.historical_points || 0) + rewardPoints
      profileState.total_territories = (profileState.total_territories || 0) + 1
      profileState.total_distance = (profileState.total_distance || 0) + distance

      await supabaseAdmin
        .from('profiles')
        .update({
          total_points: profileState.total_points,
          ...(isSocialLeague 
            ? { social_points: profileState.social_points }
            : { season_points: profileState.season_points }),
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
      }, traceId)
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
    else if (isNewTerritory && !territoryId) {
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
      
      // Para Liga Social, intentar fusionar con territorios sociales existentes primero
      if (isSocialLeague && !territoryId) {
        const socialTerritories = territories?.filter(t => t.is_social) || []
        
        for (const socialTerr of socialTerritories) {
          const socialCoords = (socialTerr.coordinates as any[]).map((c: any) => [c.lng, c.lat])
          if (socialCoords.length < 3) continue
          
          // Cerrar polígono si no está cerrado
          if (socialCoords[0][0] !== socialCoords[socialCoords.length - 1][0] ||
              socialCoords[0][1] !== socialCoords[socialCoords.length - 1][1]) {
            socialCoords.push([...socialCoords[0]])
          }
          
          try {
            const socialPoly = polygon([socialCoords])
            const overlap = intersect(runPolygon, socialPoly)
            
            if (overlap) {
              // Fusionar territorios
              const { union } = await import('https://esm.sh/@turf/turf@6.5.0')
              const merged = union(socialPoly, runPolygon)
              
              if (merged && merged.geometry.type === 'Polygon') {
                const mergedCoords = merged.geometry.coordinates[0].map((c: number[]) => ({ lng: c[0], lat: c[1] }))
                const mergedArea = turfArea(merged)
                const mergedPerimeter = calculatePerimeter(mergedCoords)
                
                const existingParticipants: string[] = (socialTerr.social_participants as string[]) || []
                const newParticipants = existingParticipants.includes(user.id)
                  ? existingParticipants
                  : [...existingParticipants, user.id]
                
                await supabaseAdmin
                  .from('territories')
                  .update({
                    coordinates: mergedCoords,
                    area: mergedArea,
                    perimeter: mergedPerimeter,
                    social_participants: newParticipants,
                    points: (socialTerr.points || 0) + rewardPoints,
                    conquest_points: (socialTerr.conquest_points || 0) + rewardPoints,
                    league_shard: 'social', // Mundos separados
                  })
                  .eq('id', socialTerr.id)
                
                territoryId = socialTerr.id
                territoriesConquered = 1
                action = 'conquered'
                
                profileState.total_points = (profileState.total_points || 0) + rewardPoints
                // Mundos separados: Liga Social suma a social_points
                profileState.social_points = (profileState.social_points || 0) + rewardPoints
                profileState.historical_points = (profileState.historical_points || 0) + rewardPoints
                profileState.total_distance = (profileState.total_distance || 0) + distance
                
                await supabaseAdmin
                  .from('profiles')
                  .update({
                    total_points: profileState.total_points,
                    social_points: profileState.social_points,
                    historical_points: profileState.historical_points,
                    total_distance: profileState.total_distance,
                  })
                  .eq('id', user.id)
                
                logger.info('Merged with existing social territory', { 
                  territoryId: socialTerr.id,
                  participants: newParticipants.length 
                })
                break
              }
            }
          } catch (e) {
            logger.warn('Error checking/merging social territory', { error: String(e) })
          }
        }
      }
      
      // Si no se fusionó, crear nuevo territorio
      if (!territoryId) {
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
            // Mundos separados: Liga Social usa 'social', competitivo usa league_shard normal
            league_shard: isSocialLeague ? 'social' : (profile.league_shard || 'bronze-1'),
            is_social: isSocialLeague,
            social_participants: isSocialLeague ? [user.id] : null,
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
        // Mundos separados: Liga Social suma a social_points, competitivo a season_points
        if (isSocialLeague) {
          profileState.social_points = (profileState.social_points || 0) + rewardPoints
        } else {
          profileState.season_points = (profileState.season_points || 0) + rewardPoints
        }
        profileState.historical_points = (profileState.historical_points || 0) + rewardPoints
        profileState.total_territories = (profileState.total_territories || 0) + 1
        profileState.total_distance = (profileState.total_distance || 0) + distance

        await supabaseAdmin
          .from('profiles')
          .update({
            total_points: profileState.total_points,
            ...(isSocialLeague 
              ? { social_points: profileState.social_points }
              : { season_points: profileState.season_points }),
            historical_points: profileState.historical_points,
            total_territories: profileState.total_territories,
            total_distance: profileState.total_distance,
          })
          .eq('id', user.id)
      }
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
          }, traceId)
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

    // Verificar conquistas de parques (rodear completamente un parque)
    const parkConquestResult = await checkParkConquests(user.id, runPolygon, mapPois, runId)
    parksConquered = parkConquestResult.conquered
    parksStolen = parkConquestResult.stolen

    if (parksConquered.length || parksStolen.length) {
      const totalParks = parksConquered.length + parksStolen.length
      await sendPushNotification(user.id, {
        title: '🌳 ¡Parque conquistado!',
        body: totalParks === 1 
          ? `Has conquistado "${[...parksConquered, ...parksStolen][0]}"` 
          : `Has conquistado ${totalParks} parques`,
        data: { url: '/' },
        tag: 'park-conquest'
      }, traceId)
    }

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
          parksConquered,
          parksStolen,
          socialLeague: isSocialLeague,
          explorerMode: false,
        },
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Error inesperado'
    console.error('Unhandled process-territory-claim error', { traceId, error })
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
