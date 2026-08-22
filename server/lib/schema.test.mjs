import test from 'node:test'
import assert from 'node:assert/strict'
import { isServerMessage, message, SCHEMA_VERSION } from './schema.mjs'

test('creates and validates versioned feed messages', () => {
  const status = { source: 'mihomo', collected: 3, publicTargets: 2, privateFiltered: 1, displayed: 2, maxRoutes: 100, geoProvider: 'ipwho.is', updatedAt: new Date().toISOString() }
  const snapshot = message('snapshot', { status, routes: [{ physicalOrigin: { latitude: 39.9042, longitude: 116.4074, city: '北京', country: '中国' }, proxyEgress: { latitude: 37.7749, longitude: -122.4194, city: 'San Francisco', country: 'United States' }, destination: { latitude: 35.6762, longitude: 139.6503, city: 'Tokyo', country: 'Japan' } }] })
  assert.equal(snapshot.version, SCHEMA_VERSION)
  assert.equal(isServerMessage(snapshot), true)
  assert.equal(snapshot.version, 2)
  assert.equal(snapshot.routes[0].physicalOrigin.city, '北京')
  assert.equal(snapshot.routes[0].proxyEgress.city, 'San Francisco')
  assert.equal(isServerMessage({ ...snapshot, version: 1 }), false)
  assert.equal(isServerMessage({ ...snapshot, routes: [{ destination: snapshot.routes[0].destination }] }), false)
  assert.equal(isServerMessage(message('error', { code: 'SOURCE', message: 'unavailable', recoverable: true })), true)
})
