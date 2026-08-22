import { spawn } from 'node:child_process'
import { isPublicIp } from './network.mjs'
import { TaskQueue } from './queue.mjs'

const TRACE_TTL = 30 * 60 * 1000

export function parseTracerouteOutput(output) {
  const hops = []
  let unknownHops = 0
  for (const line of String(output).split(/\r?\n/)) {
    const match = line.match(/^\s*(\d+)\s+(.*)$/)
    if (!match) continue
    const ttl = Number(match[1])
    const rest = match[2]
    const ip = rest.match(/(?:^|\s)((?:\d{1,3}\.){3}\d{1,3}|[0-9a-f:]{3,})(?:\s|$)/i)?.[1]
    const latency = rest.match(/([\d.]+)\s*ms/i)?.[1]
    if (!ip || !isPublicIp(ip)) {
      unknownHops += 1
      continue
    }
    hops.push({ ttl, ip, latencyMs: latency ? Number(latency) : 0 })
  }
  return { hops, unknownHops }
}

function runTraceroute(ip) {
  return new Promise((resolve) => {
    const child = spawn('/usr/sbin/traceroute', ['-n', '-q', '1', '-w', '1', '-m', '12', ip], { stdio: ['ignore', 'pipe', 'pipe'] })
    let output = ''
    const timer = setTimeout(() => child.kill('SIGTERM'), 15_000)
    child.stdout.on('data', (chunk) => { output += chunk })
    child.stderr.on('data', (chunk) => { output += chunk })
    child.on('close', () => {
      clearTimeout(timer)
      resolve(parseTracerouteOutput(output))
    })
    child.on('error', () => {
      clearTimeout(timer)
      resolve({ hops: [], unknownHops: 0 })
    })
  })
}

export class TracerouteService {
  constructor() {
    this.cache = new Map()
    this.queue = new TaskQueue(2)
  }

  trace(ip) {
    if (!isPublicIp(ip)) return Promise.resolve({ hops: [], unknownHops: 0 })
    const hit = this.cache.get(ip)
    if (hit && hit.expiresAt > Date.now()) return hit.promise
    const promise = this.queue.add(() => runTraceroute(ip))
    this.cache.set(ip, { promise, expiresAt: Date.now() + TRACE_TTL })
    return promise
  }
}
