import { createHash } from 'node:crypto'
import { basename } from 'node:path'
import ipaddr from 'ipaddr.js'

const LOCAL_PORTS = new Set([4173, 8788])
export const isDirectChain = (chains) => chains.some((item) => String(item).trim().toUpperCase() === 'DIRECT')
export function classifyRoute(chains) {
  if (isDirectChain(chains)) return 'direct'
  if (chains.some((item) => /(?:^|[-_\s])(vpn|corp|corporate|internal)(?:$|[-_\s])|企业|内网/i.test(String(item)))) return 'vpn'
  return 'proxy'
}

export function stableId(value) {
  return createHash('sha256').update(value).digest('hex').slice(0, 16)
}

export function isPublicIp(value) {
  if (!value || !ipaddr.isValid(value)) return false
  let address = ipaddr.parse(value)
  if (address.kind() === 'ipv6' && address.isIPv4MappedAddress()) address = address.toIPv4Address()
  return address.range() === 'unicast'
}

export function isFakeOrPrivateIp(value) {
  if (!value || !ipaddr.isValid(value)) return true
  const address = ipaddr.parse(value)
  if (address.kind() === 'ipv4') {
    const [a, b] = address.toByteArray()
    if (a === 198 && (b === 18 || b === 19)) return true
  }
  return !isPublicIp(value)
}

function cleanHostname(value) {
  const hostname = String(value || '').trim().replace(/\.$/, '').toLowerCase()
  if (!hostname || hostname === 'localhost' || hostname.endsWith('.local')) return undefined
  return hostname
}

function isOwnLoopback(ip, port, hostname) {
  if (!LOCAL_PORTS.has(Number(port))) return false
  return hostname === 'localhost' || ip === '127.0.0.1' || ip === '::1'
}

export function parseMihomoConnections(payload, now = new Date().toISOString()) {
  const rows = Array.isArray(payload?.connections) ? payload.connections : []
  let privateFiltered = 0
  const connections = []
  for (const row of rows) {
    const metadata = row?.metadata || {}
    const hostname = cleanHostname(metadata.host || metadata.sniffHost)
    const destinationIp = String(metadata.destinationIP || '').trim()
    const remotePort = Number(metadata.destinationPort || 0)
    if (isOwnLoopback(destinationIp, remotePort, hostname)) continue
    const remoteIp = isPublicIp(destinationIp) ? destinationIp : undefined
    if (!remoteIp) privateFiltered += 1
    if (!remoteIp && !hostname) continue
    const chains = Array.isArray(row.chains) ? row.chains.map(String).filter(Boolean) : []
    const routeKind = classifyRoute(chains)
    const processValue = metadata.process || metadata.processPath
    const process = processValue ? basename(String(processValue)) : undefined
    const network = String(metadata.network || metadata.type || 'tcp').toLowerCase()
    const identitySeed = row.id || `${hostname || remoteIp}:${remotePort}:${network}:${process || ''}`
    connections.push({
      id: stableId(String(identitySeed)), hostname, remoteIp, remotePort, network, process, chains,
      rule: row.rule ? String(row.rule) : undefined,
      upload: Number(row.upload || 0), download: Number(row.download || 0),
      start: String(row.start || row.startTime || now), lastSeen: now, source: 'mihomo',
      routeKind, direct: routeKind === 'direct',
    })
  }
  return { connections, collected: rows.length, privateFiltered }
}

function parseEndpoint(value) {
  const endpoint = value.replace(/\s+\(ESTABLISHED\)$/, '')
  const arrow = endpoint.lastIndexOf('->')
  if (arrow < 0) return null
  const remote = endpoint.slice(arrow + 2)
  const ipv6 = remote.match(/^\[([^\]]+)]:(\d+)$/)
  if (ipv6) return { ip: ipv6[1], port: Number(ipv6[2]) }
  const ipv4 = remote.match(/^(.+):(\d+)$/)
  return ipv4 ? { ip: ipv4[1], port: Number(ipv4[2]) } : null
}

export function parseLsofOutput(output, now = new Date().toISOString()) {
  const connections = []
  let process
  for (const line of String(output).split(/\r?\n/)) {
    if (line.startsWith('c')) process = line.slice(1).trim() || undefined
    if (!line.startsWith('n')) continue
    const remote = parseEndpoint(line.slice(1))
    if (!remote || isOwnLoopback(remote.ip, remote.port)) continue
    if (!isPublicIp(remote.ip)) continue
    const identitySeed = `${process || ''}:${remote.ip}:${remote.port}:tcp`
    connections.push({
      id: stableId(identitySeed), remoteIp: remote.ip, remotePort: remote.port, network: 'tcp', process,
      chains: ['DIRECT'], upload: 0, download: 0, start: now, lastSeen: now, source: 'lsof', routeKind: 'direct', direct: true,
    })
  }
  return { connections, collected: connections.length, privateFiltered: 0 }
}

export function aggregateConnections(connections, now = new Date().toISOString()) {
  const groups = new Map()
  for (const connection of connections) {
    const target = connection.hostname || connection.remoteIp
    if (!target) continue
    const key = `${target}:${connection.remotePort}:${connection.network}:${connection.routeKind}`
    const current = groups.get(key)
    if (!current) {
      groups.set(key, { ...connection, id: stableId(key), connectionCount: 1, lastSeen: now })
      continue
    }
    current.upload += connection.upload
    current.download += connection.download
    current.connectionCount += 1
    if (!current.process && connection.process) current.process = connection.process
    if (!current.remoteIp && connection.remoteIp) current.remoteIp = connection.remoteIp
    current.direct = current.direct && connection.direct
    current.routeKind = current.direct ? 'direct' : current.routeKind === connection.routeKind ? current.routeKind : 'proxy'
    current.chains = [...new Set([...current.chains, ...connection.chains])]
    if (String(connection.start) < String(current.start)) current.start = connection.start
  }
  return [...groups.values()]
}
