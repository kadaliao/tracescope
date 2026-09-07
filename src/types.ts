export type HopState = 'complete' | 'active' | 'pending' | 'anomaly'
export interface GeoPoint { latitude: number; longitude: number; city: string; country: string }
export type HopRole = 'trace' | 'proxy-egress' | 'vpn-egress' | 'destination'
export interface TraceHop { id: string; ttl: number; ip: string; asn: string; provider: string; geo: GeoPoint; latencyMs: number; role?: HopRole; state?: HopState }
export type RouteKind = 'direct' | 'proxy' | 'vpn'
export type PathKind = 'trace' | 'logical-direct' | 'logical-proxy' | 'logical-vpn'
export type TraceState = 'pending' | 'complete' | 'unavailable' | 'not-applicable'
export type ConnectionSource = 'mihomo' | 'lsof' | 'demo'
export interface ConnectionDetails {
  hostname?: string
  remoteIp?: string
  remotePort: number
  network: string
  process?: string
  chains: string[]
  rule?: string
  upload: number
  download: number
  start: string
  lastSeen: string
  source: ConnectionSource
  routeKind: RouteKind
  pathKind: PathKind
  traceState: TraceState
  unknownHops: number
  stale?: boolean
}
export interface TraceResult {
  id: string
  target: string
  targetLabel: string
  sourceLabel: string
  physicalOrigin: GeoPoint
  proxyEgress?: GeoPoint
  vpnEgress?: GeoPoint
  destination: GeoPoint
  measuredAt: string
  hops: TraceHop[]
  isDemo: boolean
  connection?: ConnectionDetails
}
export type TracePlaybackStatus = 'tracing' | 'paused' | 'complete'
export interface TracePlayback { id: string; result: TraceResult; color: string; revealed: number; status: TracePlaybackStatus }

export type FeedState = 'connecting' | 'live' | 'reconnecting' | 'offline'
export interface FeedStatus {
  source: 'mihomo' | 'lsof' | 'none'
  collected: number
  publicTargets: number
  privateFiltered: number
  displayed: number
  maxRoutes: number
  geoProvider: string
  updatedAt: string
}
export interface LiveRoute {
  id: string
  target: string
  targetLabel: string
  physicalOrigin: GeoPoint
  proxyEgress?: GeoPoint
  vpnEgress?: GeoPoint
  destination: GeoPoint
  measuredAt: string
  hops: TraceHop[]
  connection: ConnectionDetails
}
export type ServerMessage =
  | { version: 2; type: 'status'; sentAt: string; status: FeedStatus }
  | { version: 2; type: 'snapshot' | 'update'; sentAt: string; status: FeedStatus; routes: LiveRoute[] }
  | { version: 2; type: 'error'; sentAt: string; code: string; message: string; recoverable: boolean }
