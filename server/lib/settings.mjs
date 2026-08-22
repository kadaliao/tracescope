export const DEFAULT_MAX_ROUTES = 100

export function parseMaxRoutes(value) {
  if (typeof value !== 'string' || !/^\d+$/.test(value)) return DEFAULT_MAX_ROUTES
  const parsed = Number(value)
  return parsed >= 1 && parsed <= 200 ? parsed : DEFAULT_MAX_ROUTES
}

export function loadMaxRoutes(env = process.env) {
  return parseMaxRoutes(env.TRACESCOPE_MAX_ROUTES)
}
