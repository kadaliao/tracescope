import test from 'node:test'
import assert from 'node:assert/strict'
import { aggregateConnections, classifyRoute, isDirectChain, isFakeOrPrivateIp, isPublicIp, parseLsofOutput, parseMihomoConnections } from './network.mjs'

const NOW = '2026-08-22T10:00:00.000Z'

test('parses Mihomo connections without exposing source addresses', () => {
  const payload = { connections: [
    { id: 'fixture-a', metadata: { network: 'tcp', host: 'example.test', destinationIP: '198.18.0.4', destinationPort: 443, processPath: '/Applications/Browser.app/Browser' }, chains: ['Proxy A'], rule: 'DomainSuffix', upload: 12, download: 34, start: '2026-08-22T09:00:00Z' },
    { id: 'fixture-b', metadata: { network: 'tcp', destinationIP: '1.1.1.1', destinationPort: 443 }, chains: ['DIRECT'], upload: 1, download: 2 },
    { id: 'fixture-local', metadata: { host: 'localhost', destinationIP: '127.0.0.1', destinationPort: 8788 }, chains: ['DIRECT'] },
  ] }
  const parsed = parseMihomoConnections(payload, NOW)
  assert.equal(parsed.collected, 3)
  assert.equal(parsed.privateFiltered, 1)
  assert.equal(parsed.connections.length, 2)
  assert.equal(parsed.connections[0].remoteIp, undefined)
  assert.equal(parsed.connections[0].hostname, 'example.test')
  assert.equal(parsed.connections[0].direct, false)
  assert.equal(parsed.connections[0].routeKind, 'proxy')
  assert.equal(parsed.connections[1].direct, true)
  assert.equal(parsed.connections[1].routeKind, 'direct')
  assert.ok(!('sourceIP' in parsed.connections[0]))
})

test('parses lsof field output and filters private or local destinations', () => {
  const output = ['p101', 'cBrowser', 'n192.0.2.10:50100->1.1.1.1:443 (ESTABLISHED)', 'n192.0.2.10:50101->127.0.0.1:4173 (ESTABLISHED)', 'p202', 'cAgent', 'n[2001:db8::2]:50102->[2606:4700:4700::1111]:443 (ESTABLISHED)'].join('\n')
  const parsed = parseLsofOutput(output, NOW)
  assert.equal(parsed.connections.length, 2)
  assert.deepEqual(parsed.connections.map((item) => item.process), ['Browser', 'Agent'])
  assert.deepEqual(parsed.connections.map((item) => item.remotePort), [443, 443])
})

test('classifies fake, private, loopback and public addresses', () => {
  for (const ip of ['198.18.0.1', '198.19.255.254', '10.1.2.3', '192.168.1.2', '127.0.0.1', '::1', 'fe80::1']) assert.equal(isFakeOrPrivateIp(ip), true, ip)
  for (const ip of ['1.1.1.1', '8.8.8.8', '2606:4700:4700::1111']) assert.equal(isPublicIp(ip), true, ip)
})

test('treats any exact DIRECT chain entry as direct without matching proxy names', () => {
  assert.equal(isDirectChain(['Rule Group', 'DIRECT']), true)
  assert.equal(isDirectChain(['DIRECT', 'Fallback']), true)
  assert.equal(isDirectChain(['Direct Proxy']), false)
  assert.equal(isDirectChain([]), false)
})

test('classifies direct, proxy selector and corporate VPN chains separately', () => {
  assert.equal(classifyRoute(['Fallback', 'DIRECT']), 'direct')
  assert.equal(classifyRoute(['Selector', 'Tokyo Node']), 'proxy')
  assert.equal(classifyRoute(['Product Gateway', 'External Proxy']), 'proxy')
  assert.equal(classifyRoute(['Product Gateway', 'Corporate VPN']), 'vpn')
})

test('aggregates duplicate targets into one stable route identity', () => {
  const base = { remoteIp: '1.1.1.1', remotePort: 443, network: 'tcp', process: 'Browser', chains: ['DIRECT'], upload: 2, download: 3, start: NOW, source: 'mihomo', routeKind: 'direct', direct: true }
  const groups = aggregateConnections([{ ...base, id: 'a' }, { ...base, id: 'b', upload: 5, download: 7 }], NOW)
  assert.equal(groups.length, 1)
  assert.equal(groups[0].connectionCount, 2)
  assert.equal(groups[0].upload, 7)
  assert.equal(groups[0].download, 10)
})
