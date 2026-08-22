import test from 'node:test'
import assert from 'node:assert/strict'
import { RouteEnricher } from './enricher.mjs'

const BEIJING = { latitude: 39.9042, longitude: 116.4074, city: '北京', country: '中国' }
const SAN_FRANCISCO = { latitude: 37.7749, longitude: -122.4194, city: 'San Francisco', country: 'United States' }
const DESTINATION = { latitude: 35.6762, longitude: 139.6503, city: 'Tokyo', country: 'Japan', asn: 'AS64500', provider: 'Fixture Net' }
const base = { remoteIp: '203.0.113.8', remotePort: 443, network: 'tcp', process: 'Fixture', rule: 'FixtureRule', upload: 1, download: 2, start: '2026-08-22T00:00:00Z', lastSeen: '2026-08-22T00:01:00Z', source: 'mihomo' }
const geo = { resolveHostname: async () => undefined, locate: async () => DESTINATION, proxyEgressLocation: async () => SAN_FRANCISCO }
const create = (overrideGeo = geo, traceroute = { trace: async () => ({ hops: [], unknownHops: 0 }) }) => new RouteEnricher(() => {}, { geo: overrideGeo, traceroute, physicalOrigin: BEIJING })

test('builds proxy routes in Beijing, San Francisco egress, destination order', async () => {
  const enricher = create()
  await enricher.prepare({ ...base, id: 'proxy-route', hostname: 'fixture.example', chains: ['Selector', 'Proxy Node'], routeKind: 'proxy' })
  const route = enricher.routes.get('proxy-route')
  assert.deepEqual(route.physicalOrigin, BEIJING)
  assert.deepEqual(route.proxyEgress, SAN_FRANCISCO)
  assert.equal(route.vpnEgress, undefined)
  assert.deepEqual(route.hops.map((hop) => hop.role), ['proxy-egress', 'destination'])
  assert.equal(route.connection.pathKind, 'logical-proxy')
  assert.equal(route.connection.routeKind, 'proxy')
  assert.equal(JSON.stringify(route).includes('sourceIP'), false)
  assert.equal(JSON.stringify(route).includes('secret'), false)
})

test('builds VPN routes with a distinct VPN egress semantic', async () => {
  const enricher = create()
  await enricher.prepare({ ...base, id: 'vpn-route', chains: ['Corporate VPN'], routeKind: 'vpn' })
  const route = enricher.routes.get('vpn-route')
  assert.deepEqual(route.vpnEgress, SAN_FRANCISCO)
  assert.equal(route.proxyEgress, undefined)
  assert.deepEqual(route.hops.map((hop) => hop.role), ['vpn-egress', 'destination'])
  assert.equal(route.connection.pathKind, 'logical-vpn')
  assert.equal(route.connection.routeKind, 'vpn')
})

test('keeps DIRECT routes free of egress and uses traceroute ordering', async () => {
  let egressCalls = 0
  const directGeo = { ...geo, proxyEgressLocation: async () => { egressCalls += 1; return SAN_FRANCISCO } }
  const traceroute = { trace: async () => ({ hops: [{ ttl: 3, ip: '203.0.113.7', latencyMs: 12 }], unknownHops: 2 }) }
  const enricher = create(directGeo, traceroute)
  await enricher.prepare({ ...base, id: 'direct-route', chains: ['Rule Group', 'DIRECT'], routeKind: 'direct' })
  const route = enricher.routes.get('direct-route')
  assert.equal(egressCalls, 0)
  assert.equal(route.proxyEgress, undefined)
  assert.equal(route.vpnEgress, undefined)
  assert.deepEqual(route.hops.map((hop) => hop.role), ['trace', 'destination'])
  assert.equal(route.connection.pathKind, 'trace')
  assert.equal(route.connection.routeKind, 'direct')
})
