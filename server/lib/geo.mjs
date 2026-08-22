import { domainToASCII } from 'node:url'
import { isPublicIp } from './network.mjs'
import { TaskQueue } from './queue.mjs'

const GEO_TTL = 24 * 60 * 60 * 1000
const DNS_TTL = 30 * 60 * 1000

async function fetchJson(url, options = {}, timeoutMs = 4_000) {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  try {
    const response = await fetch(url, { ...options, signal: controller.signal })
    if (!response.ok) throw new Error(`HTTP ${response.status}`)
    return await response.json()
  } finally {
    clearTimeout(timer)
  }
}

function cached(cache, key) {
  const entry = cache.get(key)
  if (!entry || entry.expiresAt < Date.now()) return undefined
  return entry.value
}

function validHostname(value) {
  const hostname = domainToASCII(String(value || '').trim().replace(/\.$/, '').toLowerCase())
  if (!hostname || hostname.length > 253 || hostname === 'localhost' || hostname.endsWith('.local')) return undefined
  if (!hostname.includes('.') || !/^[a-z0-9.-]+$/.test(hostname)) return undefined
  return hostname
}

export class GeoService {
  constructor() {
    this.geoCache = new Map()
    this.dnsCache = new Map()
    this.geoQueue = new TaskQueue(2, 280)
    this.dnsQueue = new TaskQueue(2, 120)
    this.proxyEgressPromise = undefined
  }

  async resolveHostname(hostname) {
    const safeName = validHostname(hostname)
    if (!safeName) return undefined
    const hit = cached(this.dnsCache, safeName)
    if (hit !== undefined) return hit
    return this.dnsQueue.add(async () => {
      const secondHit = cached(this.dnsCache, safeName)
      if (secondHit !== undefined) return secondHit
      try {
        const data = await fetchJson(`https://cloudflare-dns.com/dns-query?name=${encodeURIComponent(safeName)}&type=A`, { headers: { Accept: 'application/dns-json' } })
        const value = Array.isArray(data.Answer) ? data.Answer.find((answer) => answer.type === 1 && isPublicIp(answer.data))?.data : undefined
        this.dnsCache.set(safeName, { value, expiresAt: Date.now() + DNS_TTL })
        return value
      } catch {
        this.dnsCache.set(safeName, { value: undefined, expiresAt: Date.now() + 60_000 })
        return undefined
      }
    })
  }

  async locate(ip) {
    if (!isPublicIp(ip)) return undefined
    const hit = cached(this.geoCache, ip)
    if (hit !== undefined) return hit
    return this.geoQueue.add(async () => {
      const secondHit = cached(this.geoCache, ip)
      if (secondHit !== undefined) return secondHit
      try {
        const fields = 'success,city,country,latitude,longitude,connection'
        const data = await fetchJson(`https://ipwho.is/${encodeURIComponent(ip)}?fields=${fields}`)
        if (!data.success || !Number.isFinite(data.latitude) || !Number.isFinite(data.longitude)) throw new Error('GeoIP lookup failed')
        const value = {
          latitude: data.latitude,
          longitude: data.longitude,
          city: String(data.city || data.country || '未知位置'),
          country: String(data.country || '未知国家'),
          asn: String(data.connection?.asn || ''),
          provider: String(data.connection?.org || data.connection?.isp || 'GeoIP'),
        }
        this.geoCache.set(ip, { value, expiresAt: Date.now() + GEO_TTL })
        return value
      } catch {
        this.geoCache.set(ip, { value: undefined, expiresAt: Date.now() + 5 * 60_000 })
        return undefined
      }
    })
  }

  proxyEgressLocation() {
    if (!this.proxyEgressPromise) {
      this.proxyEgressPromise = this.geoQueue.add(async () => {
        try {
          const data = await fetchJson('https://ipwho.is/?fields=success,city,country,latitude,longitude')
          if (!data.success || !Number.isFinite(data.latitude) || !Number.isFinite(data.longitude)) throw new Error('Proxy egress GeoIP failed')
          return { latitude: data.latitude, longitude: data.longitude, city: String(data.city || '本机网络'), country: String(data.country || '') }
        } catch {
          return undefined
        }
      })
    }
    return this.proxyEgressPromise
  }
}
