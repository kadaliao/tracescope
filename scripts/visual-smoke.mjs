import { chromium } from 'playwright'
import { readFileSync } from 'node:fs'

const browser = await chromium.launch({ headless: true })
const sceneSource = readFileSync(new URL('../src/EarthScene.tsx', import.meta.url), 'utf8')
const distance = (a, b) => Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z)

async function readyPage(viewport, path = '/') {
  const page = await browser.newPage({ viewport, reducedMotion: viewport.width <= 390 ? 'reduce' : 'no-preference' })
  const errors = []
  page.on('console', (message) => { if (message.type() === 'error') errors.push(message.text()) })
  page.on('pageerror', (error) => errors.push(error.message))
  await page.goto(`http://127.0.0.1:4173${path}`, { waitUntil: 'domcontentloaded' })
  await page.waitForFunction(() => Boolean(window.traceScopeCamera), undefined, { timeout: 15_000 })
  await page.waitForFunction(() => Number(window.traceScopeCountryBorders) > 1_000, undefined, { timeout: 15_000 })
  return { page, errors }
}

async function dragCamera(page) {
  const canvas = page.locator('canvas')
  const box = await canvas.boundingBox()
  if (!box) throw new Error('canvas missing')
  const before = await page.evaluate(() => ({ ...window.traceScopeCamera.position }))
  await page.mouse.move(box.x + box.width * .62, box.y + box.height * .45)
  await page.mouse.down()
  await page.mouse.move(box.x + box.width * .34, box.y + box.height * .58, { steps: 10 })
  await page.mouse.up()
  const after = await page.evaluate(() => ({ ...window.traceScopeCamera.position }))
  await page.waitForTimeout(700)
  const stable = await page.evaluate(() => ({ ...window.traceScopeCamera.position }))
  return { dragDistance: distance(before, after), driftDistance: distance(after, stable) }
}

async function inspectLive(name, viewport) {
  const { page, errors } = await readyPage(viewport)
  await page.getByTestId('feed-state').filter({ hasText: '实时' }).waitFor({ timeout: 15_000 })
  await page.locator('.route-row').first().waitFor({ timeout: 25_000 })
  await page.waitForTimeout(1_200)
  const routeRows = await page.locator('.route-row').count()
  const proxyRow = page.locator('.route-row').filter({ hasText: '代理' }).first()
  if (await proxyRow.count()) await proxyRow.click()
  const camera = await dragCamera(page)
  const checks = await page.evaluate(() => {
    const detail = document.querySelector('.detail-panel')?.getBoundingClientRect()
    const attribution = document.querySelector('.map-attribution')?.getBoundingClientRect()
    const panel = document.querySelector('.control-panel')?.getBoundingClientRect()
    const visible = (box) => Boolean(box && box.width > 0 && box.height > 0)
    const gap = visible(detail) && visible(attribution) ? detail.top - attribution.bottom : null
    return {
      canvasPngLength: document.querySelector('canvas').toDataURL().length,
      countryBorderVertices: window.traceScopeCountryBorders,
      labels: document.querySelectorAll('[data-testid="city-label"]').length,
      arrows: window.traceScopeArrowCount ?? document.querySelectorAll('[data-testid="path-arrow"]').length,
      panelContained: Boolean(panel && panel.top >= 0 && panel.bottom <= innerHeight),
      overlayGap: gap,
      overlayOverlap: gap === null ? false : gap < 0,
      detailVisible: visible(detail),
      liveState: document.querySelector('[data-testid="feed-state"]')?.textContent,
      maxRoutesText: document.querySelector('.metrics')?.textContent?.includes('最多 100'),
      physicalOrigins: [...document.querySelectorAll('[data-testid="physical-origin"]')].map((node) => node.textContent),
      proxyEgresses: [...document.querySelectorAll('[data-testid="proxy-egress"]')].map((node) => node.textContent),
    }
  })
  await page.addStyleTag({ content: '.hop-main strong,.hop-main small,.route-traffic,.detail-panel>strong,.detail-meta{filter:blur(5px)}' })
  await page.screenshot({ path: `/tmp/tracescope-${name}.png`, fullPage: true })
  await page.close()
  return { name, routeRows, routeRowsInRange: routeRows > 0 && routeRows <= 100, ...camera, cameraMovedByDrag: camera.dragDistance > .01, cameraStableAfterDrag: camera.driftDistance < .01, screenSpaceMarkers: /function ScreenSpaceScale/.test(sceneSource), checks, errors }
}

async function inspectStress() {
  const { page, errors } = await readyPage({ width: 1440, height: 900 }, '/?stress=100')
  await page.waitForFunction(() => document.querySelectorAll('.route-row').length === 100, undefined, { timeout: 15_000 })
  await page.waitForTimeout(1_000)
  const camera = await dragCamera(page)
  const checks = await page.evaluate(async () => {
    let frames = 0
    const started = performance.now()
    await new Promise((resolve) => { const tick = () => { frames += 1; if (performance.now() - started >= 800) resolve(undefined); else requestAnimationFrame(tick) }; requestAnimationFrame(tick) })
    return {
      routeRows: document.querySelectorAll('.route-row').length,
      canvasPngLength: document.querySelector('canvas').toDataURL().length,
      labels: document.querySelectorAll('[data-testid="city-label"]').length,
      arrows: window.traceScopeArrowCount ?? document.querySelectorAll('[data-testid="path-arrow"]').length,
      physicalOrigins: document.querySelectorAll('[data-testid="physical-origin"]').length,
      framesIn800ms: frames,
    }
  })
  await page.screenshot({ path: '/tmp/tracescope-stress-100.png', fullPage: true })
  await page.close()
  return { name: 'stress-100', ...camera, checks, errors }
}

async function inspectEarth() {
  const { page, errors } = await readyPage({ width: 1440, height: 900 }, '/?earth=1')
  await page.waitForTimeout(800)
  const checks = await page.evaluate(() => ({ canvasPngLength: document.querySelector('canvas').toDataURL().length, routes: document.querySelectorAll('.route-row').length, countryBorderVertices: window.traceScopeCountryBorders }))
  await page.screenshot({ path: '/tmp/tracescope-earth-borders.png', fullPage: true })
  await page.close()
  return { name: 'earth-borders', checks, errors }
}

async function inspectZoom() {
  const { page, errors } = await readyPage({ width: 1440, height: 900 })
  await page.locator('.route-row').first().waitFor({ timeout: 25_000 })
  await page.getByTestId('physical-origin').waitFor({ timeout: 15_000 })
  await page.waitForTimeout(800)
  const before = await page.evaluate(() => {
    const box = document.querySelector('[data-testid="physical-origin"]')?.getBoundingClientRect()
    return { cameraDistance: window.traceScopeCamera.position.length(), label: box ? { width: box.width, height: box.height } : null, marker: window.traceScopeMarkerTelemetry?.['physical-origin'] }
  })
  const canvas = page.locator('canvas')
  const box = await canvas.boundingBox()
  if (!box) throw new Error('canvas missing')
  await page.mouse.move(box.x + box.width * .62, box.y + box.height * .48)
  for (let index = 0; index < 12; index += 1) {
    await page.mouse.wheel(0, -900)
    await page.waitForTimeout(35)
  }
  await page.waitForTimeout(900)
  const after = await page.evaluate(() => {
    const box = document.querySelector('[data-testid="physical-origin"]')?.getBoundingClientRect()
    return { cameraDistance: window.traceScopeCamera.position.length(), label: box ? { width: box.width, height: box.height } : null, marker: window.traceScopeMarkerTelemetry?.['physical-origin'], visibleOrdinaryLabels: [...document.querySelectorAll('[data-testid="city-label"]')].filter((node) => getComputedStyle(node).visibility !== 'hidden').length, canvasPngLength: document.querySelector('canvas').toDataURL().length }
  })
  const labelDelta = before.label && after.label ? Math.max(Math.abs(after.label.width / before.label.width - 1), Math.abs(after.label.height / before.label.height - 1)) : null
  if (after.visibleOrdinaryLabels === 0) throw new Error(`city labels disappeared after zooming in (camera distance ${after.cameraDistance.toFixed(2)})`)
  await page.addStyleTag({ content: '.hop-main strong,.hop-main small,.route-traffic{filter:blur(5px)}' })
  await page.screenshot({ path: '/tmp/tracescope-zoom-in.png', fullPage: true })
  await page.close()
  return { name: 'zoom-in', before, after, cameraDistanceChanged: after.cameraDistance < before.cameraDistance * .8, labelSizeDelta: labelDelta, labelWithin25Percent: labelDelta !== null && labelDelta <= .25, markerTargetStable: before.marker?.targetPixels === after.marker?.targetPixels, errors }
}

const results = [
  await inspectLive('desktop', { width: 1440, height: 900 }),
  await inspectLive('800x600', { width: 800, height: 600 }),
  await inspectLive('mobile', { width: 390, height: 844 }),
  await inspectStress(),
  await inspectEarth(),
  await inspectZoom(),
]
console.log(JSON.stringify(results, null, 2))
await browser.close()
