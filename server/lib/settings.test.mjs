import test from 'node:test'
import assert from 'node:assert/strict'
import { DEFAULT_MAX_ROUTES, loadMaxRoutes, parseMaxRoutes } from './settings.mjs'

test('defaults the live route cap to 100', () => {
  assert.equal(loadMaxRoutes({}), 100)
  assert.equal(DEFAULT_MAX_ROUTES, 100)
})

test('accepts integer overrides from 1 through 200 and rejects invalid values', () => {
  assert.equal(parseMaxRoutes('1'), 1)
  assert.equal(parseMaxRoutes('72'), 72)
  assert.equal(parseMaxRoutes('200'), 200)
  for (const value of ['0', '201', '-1', '5.5', 'abc', '']) assert.equal(parseMaxRoutes(value), 100, value)
})
