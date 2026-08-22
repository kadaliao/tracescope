import test from 'node:test'
import assert from 'node:assert/strict'
import { parseTracerouteOutput } from './traceroute.mjs'

test('parses macOS traceroute hops and preserves unknown hop count', () => {
  const output = `traceroute to fixture.invalid (1.1.1.1), 12 hops max, 40 byte packets
 1  192.168.1.1  1.112 ms
 2  *
 3  203.0.114.8  12.74 ms
 4  2606:4700:4700::1111  18.2 ms`
  const result = parseTracerouteOutput(output)
  assert.equal(result.unknownHops, 2)
  assert.equal(result.hops.length, 2)
  assert.deepEqual(result.hops.map((hop) => hop.ttl), [3, 4])
  assert.equal(result.hops[0].latencyMs, 12.74)
})
