import test from 'node:test'
import assert from 'node:assert/strict'
import { DEFAULT_ORIGIN, loadPhysicalOrigin } from './origin.mjs'

test('uses explicitly configured Beijing as the physical origin by default', () => {
  assert.deepEqual(loadPhysicalOrigin({ TRACESCOPE_CONFIG: '/fixture/does-not-exist' }), DEFAULT_ORIGIN)
})

test('allows a complete environment override and rejects partial coordinates', () => {
  assert.deepEqual(loadPhysicalOrigin({ TRACESCOPE_CONFIG: '/fixture/none', TRACESCOPE_ORIGIN_LATITUDE: '31.2', TRACESCOPE_ORIGIN_LONGITUDE: '121.5', TRACESCOPE_ORIGIN_CITY: '上海', TRACESCOPE_ORIGIN_COUNTRY: '中国' }), { latitude: 31.2, longitude: 121.5, city: '上海', country: '中国' })
  assert.deepEqual(loadPhysicalOrigin({ TRACESCOPE_CONFIG: '/fixture/none', TRACESCOPE_ORIGIN_LATITUDE: '31.2' }), DEFAULT_ORIGIN)
})
