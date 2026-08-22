export const SCHEMA_VERSION = 2

export function message(type, data = {}) {
  return { version: SCHEMA_VERSION, type, sentAt: new Date().toISOString(), ...data }
}

function isGeoPoint(value) {
  return Boolean(value && Number.isFinite(value.latitude) && Number.isFinite(value.longitude) && typeof value.city === 'string' && typeof value.country === 'string')
}

export function isServerMessage(value) {
  if (!value || value.version !== SCHEMA_VERSION || typeof value.type !== 'string' || typeof value.sentAt !== 'string') return false
  if (value.type === 'status') return Boolean(value.status)
  if (value.type === 'snapshot' || value.type === 'update') return Boolean(value.status) && Array.isArray(value.routes) && value.routes.every((route) => isGeoPoint(route.physicalOrigin) && isGeoPoint(route.destination) && (!route.proxyEgress || isGeoPoint(route.proxyEgress)) && (!route.vpnEgress || isGeoPoint(route.vpnEgress)))
  if (value.type === 'error') return typeof value.code === 'string' && typeof value.message === 'string' && typeof value.recoverable === 'boolean'
  return false
}
