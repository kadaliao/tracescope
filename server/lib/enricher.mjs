import { GeoService } from './geo.mjs'
import { DEFAULT_ORIGIN } from './origin.mjs'
import { TracerouteService } from './traceroute.mjs'

const hopFromGeo = (id, ttl, ip, geo, latencyMs = 0, role = 'trace') => ({
  id, ttl, ip, asn: geo.asn || '', provider: geo.provider || 'GeoIP', role,
  geo: { latitude: geo.latitude, longitude: geo.longitude, city: geo.city, country: geo.country }, latencyMs,
})

export class RouteEnricher {
  constructor(onChanged, options = {}) {
    this.geo = options.geo || new GeoService()
    this.traceroute = options.traceroute || new TracerouteService()
    this.physicalOrigin = options.physicalOrigin || DEFAULT_ORIGIN
    this.routes = new Map()
    this.pending = new Map()
    this.onChanged = onChanged
  }

  get(connection) {
    const cached = this.routes.get(connection.id)
    if (cached) return { ...cached, connection: this.connectionDetails(connection, cached.connection) }
    if (!this.pending.has(connection.id)) this.pending.set(connection.id, this.prepare(connection).finally(() => this.pending.delete(connection.id)))
    return undefined
  }

  connectionDetails(connection, previous = {}) {
    const initialPathKind = connection.routeKind === 'direct' ? 'logical-direct' : connection.routeKind === 'vpn' ? 'logical-vpn' : 'logical-proxy'
    return {
      hostname: connection.hostname,
      remoteIp: connection.remoteIp,
      remotePort: connection.remotePort,
      network: connection.network,
      process: connection.process,
      chains: connection.chains,
      rule: connection.rule,
      upload: connection.upload,
      download: connection.download,
      start: connection.start,
      lastSeen: connection.lastSeen,
      source: connection.source,
      routeKind: connection.routeKind,
      pathKind: previous.pathKind || initialPathKind,
      traceState: previous.traceState || (connection.routeKind === 'direct' ? 'pending' : 'not-applicable'),
      unknownHops: previous.unknownHops || 0,
      stale: connection.stale,
    }
  }

  async prepare(connection) {
    const destinationIp = connection.remoteIp || await this.geo.resolveHostname(connection.hostname)
    const needsEgress = connection.routeKind !== 'direct'
    const [destinationGeo, publicEgress] = await Promise.all([
      destinationIp ? this.geo.locate(destinationIp) : undefined,
      needsEgress ? this.geo.proxyEgressLocation() : undefined,
    ])
    if (!destinationIp || !destinationGeo) return
    const destination = hopFromGeo(`${connection.id}-destination`, 1, destinationIp, destinationGeo, 0, 'destination')
    const egressRole = connection.routeKind === 'vpn' ? 'vpn-egress' : 'proxy-egress'
    const egressHop = publicEgress ? hopFromGeo(`shared-${egressRole}`, 0, '', publicEgress, 0, egressRole) : undefined
    const route = {
      id: connection.id,
      target: connection.hostname || destinationIp,
      targetLabel: connection.hostname || `${destinationGeo.city} · ${destinationIp}`,
      physicalOrigin: { ...this.physicalOrigin },
      proxyEgress: connection.routeKind === 'proxy' && publicEgress ? { ...publicEgress } : undefined,
      vpnEgress: connection.routeKind === 'vpn' && publicEgress ? { ...publicEgress } : undefined,
      destination: { ...destination.geo },
      measuredAt: new Date().toISOString(),
      hops: egressHop ? [egressHop, destination] : [destination],
      connection: this.connectionDetails(connection),
    }
    this.routes.set(connection.id, route)
    this.onChanged()
    if (connection.routeKind !== 'direct') return
    const trace = await this.traceroute.trace(destinationIp)
    const located = []
    for (const hop of trace.hops) {
      const geo = await this.geo.locate(hop.ip)
      if (geo) located.push(hopFromGeo(`${connection.id}-${hop.ttl}-${hop.ip}`, hop.ttl, hop.ip, geo, hop.latencyMs))
    }
    if (!located.some((hop) => hop.ip === destinationIp)) located.push({ ...destination, ttl: Math.max(1, ...located.map((hop) => hop.ttl + 1)) })
    const realIntermediate = located.some((hop) => hop.ip !== destinationIp)
    route.hops = located
    route.measuredAt = new Date().toISOString()
    route.connection = {
      ...route.connection,
      pathKind: realIntermediate ? 'trace' : 'logical-direct',
      traceState: realIntermediate ? 'complete' : 'unavailable',
      unknownHops: trace.unknownHops,
    }
    this.routes.set(connection.id, route)
    this.onChanged()
  }
}
