import { execFile } from 'node:child_process'
import { readFile } from 'node:fs/promises'
import { homedir } from 'node:os'
import { resolve } from 'node:path'
import { promisify } from 'node:util'
import YAML from 'yaml'
import { parseLsofOutput, parseMihomoConnections } from './network.mjs'

const execFileAsync = promisify(execFile)
const DEFAULT_CONFIGS = [
  process.env.MIHOMO_CONFIG,
  resolve(homedir(), '.config/mihomo/config.yaml'),
  resolve(homedir(), '.config/clash/config.yaml'),
].filter(Boolean)

function controllerUrl(value) {
  const raw = String(value || '').trim()
  if (!raw || raw.includes('/') || raw.startsWith('unix')) return undefined
  const match = raw.match(/^\[?([^\]]+)]?:(\d+)$/)
  if (!match || !['127.0.0.1', 'localhost', '::1'].includes(match[1])) return undefined
  return `http://${match[1] === '::1' ? '[::1]' : match[1]}:${match[2]}`
}

async function findActiveConfig() {
  if (!process.env.MIHOMO_CONFIG) {
    try {
      const { stdout } = await execFileAsync('/bin/ps', ['-axo', 'command='], { timeout: 2_000, maxBuffer: 2_000_000 })
      for (const line of stdout.split('\n')) {
        if (!/mihomo/i.test(line)) continue
        const match = line.match(/(?:^|\s)(?:-f|--config)(?:=|\s+)("[^"]+"|'[^']+'|\S+)/)
        if (match) DEFAULT_CONFIGS.unshift(match[1].replace(/^['"]|['"]$/g, ''))
      }
    } catch {
      // Known config locations remain available below.
    }
  }
  for (const path of [...new Set(DEFAULT_CONFIGS)]) {
    try {
      const config = YAML.parse(await readFile(path, 'utf8'))
      const baseUrl = controllerUrl(config?.['external-controller'])
      if (baseUrl) return { baseUrl, secret: String(config.secret || '') }
    } catch {
      // Continue to the next local candidate without logging config content.
    }
  }
  return undefined
}

async function fetchMihomo(config) {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), 3_000)
  try {
    const response = await fetch(`${config.baseUrl}/connections`, {
      headers: config.secret ? { Authorization: `Bearer ${config.secret}` } : {},
      signal: controller.signal,
    })
    if (!response.ok) throw new Error(`controller HTTP ${response.status}`)
    return parseMihomoConnections(await response.json())
  } finally {
    clearTimeout(timer)
  }
}

async function collectLsof() {
  const { stdout } = await execFileAsync('/usr/sbin/lsof', ['-nP', '-iTCP', '-sTCP:ESTABLISHED', '-Fpcn'], { timeout: 4_000, maxBuffer: 4_000_000 })
  return parseLsofOutput(stdout)
}

export class ConnectionCollector {
  constructor() {
    this.configPromise = findActiveConfig()
  }

  async collect() {
    const config = await this.configPromise
    if (config) {
      try {
        return { ...(await fetchMihomo(config)), source: 'mihomo' }
      } catch {
        // A controller outage is recoverable; lsof provides a reduced feed.
      }
    }
    return { ...(await collectLsof()), source: 'lsof' }
  }
}
