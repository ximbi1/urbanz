export interface Coordinate {
  lat: number
  lng: number
  accuracy?: number
  timestamp?: number
}

export interface ClaimPayload {
  path: Coordinate[]
  duration: number
  source?: 'live' | 'import'
  isPublic?: boolean
}
