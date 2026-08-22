import { readFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { resolve } from 'node:path'
import YAML from 'yaml'

const DEFAULT_ORIGIN = Object.freeze({ latitude: 39.9042, longitude: 116.4074, city: '北京', country: '中国' })

function validOrigin(value) {
  const latitude = Number(value?.latitude)
  const longitude = Number(value?.longitude)
  const city = String(value?.city || '').trim()
  const country = String(value?.country || '').trim()
  if (!Number.isFinite(latitude) || latitude < -90 || latitude > 90) return undefined
  if (!Number.isFinite(longitude) || longitude < -180 || longitude > 180) return undefined
  if (!city || !country) return undefined
  return { latitude, longitude, city, country }
}

export function loadPhysicalOrigin(env = process.env) {
  let configured
  const configPath = env.TRACESCOPE_CONFIG || resolve(homedir(), '.config/tracescope/config.yaml')
  try {
    configured = YAML.parse(readFileSync(configPath, 'utf8'))?.physicalOrigin
  } catch {
    // The local config is optional; Beijing remains the explicit default.
  }
  const fromFile = validOrigin(configured)
  const fromEnv = validOrigin({
    latitude: env.TRACESCOPE_ORIGIN_LATITUDE,
    longitude: env.TRACESCOPE_ORIGIN_LONGITUDE,
    city: env.TRACESCOPE_ORIGIN_CITY,
    country: env.TRACESCOPE_ORIGIN_COUNTRY,
  })
  return fromEnv || fromFile || { ...DEFAULT_ORIGIN }
}

export { DEFAULT_ORIGIN }
