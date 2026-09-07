import { useMemo, useState } from 'react'
import { Activity, ChevronRight, FastForward, Info, Languages, Link2, MapPin, Pause, Play, Radar, RefreshCw, RotateCcw, Settings2, ShieldCheck, Terminal, Wifi, WifiOff } from 'lucide-react'
import EarthScene from './EarthScene'
import { createStressDemoResults } from './demoProvider'
import { useLiveFeed } from './useLiveFeed'
import { cityName, countryName, pathKindText, routeKindText, stateText, useLanguage, useT } from './i18n'
import type { LiveRoute, TraceHop, TracePlayback } from './types'

const palette = ['#38d9c0', '#f2bb58', '#79c9ff', '#8bdc8a', '#ef9a67', '#dd8df1', '#f18ca4', '#9ed167']
const speeds = [.75, 1, 1.75]
const stressMode = new URLSearchParams(window.location.search).get('stress') === '100'
const earthOnlyMode = new URLSearchParams(window.location.search).get('earth') === '1'
const testMode = stressMode || earthOnlyMode

const bytes = (value: number) => {
  if (value < 1024) return `${value} B`
  if (value < 1024 ** 2) return `${(value / 1024).toFixed(1)} KB`
  if (value < 1024 ** 3) return `${(value / 1024 ** 2).toFixed(1)} MB`
  return `${(value / 1024 ** 3).toFixed(1)} GB`
}

function livePlayback(route: LiveRoute, index: number): TracePlayback {
  return {
    id: route.id,
    result: {
      id: route.id, target: route.target, targetLabel: route.targetLabel, sourceLabel: `本机 · ${route.physicalOrigin.city}`,
      physicalOrigin: route.physicalOrigin, proxyEgress: route.proxyEgress, vpnEgress: route.vpnEgress, destination: route.destination,
      measuredAt: route.measuredAt, hops: route.hops, isDemo: false, connection: route.connection,
    },
    color: palette[index % palette.length], revealed: route.hops.length, status: 'tracing',
  }
}

function App() {
  const { lang, setLang } = useLanguage()
  const t = useT()
  const live = useLiveFeed(!testMode)
  const [paused, setPaused] = useState(false)
  const [speed, setSpeed] = useState(1)
  const [autoRotate, setAutoRotate] = useState(false)
  const [resetSignal, setResetSignal] = useState(0)
  const [selected, setSelected] = useState<{ route: TracePlayback; hop: TraceHop } | null>(null)
  const [privacyOpen, setPrivacyOpen] = useState(false)
  const [reducedMotion] = useState(() => window.matchMedia('(prefers-reduced-motion: reduce)').matches)

  const liveRoutes = useMemo(() => live.routes.map(livePlayback), [live.routes])
  const stressRoutes = useMemo<TracePlayback[]>(() => (stressMode ? createStressDemoResults(100).map((result, index) => ({ id: result.id, result, color: palette[index % palette.length], revealed: result.hops.length, status: 'tracing' })) : []), [])
  const routes = testMode ? (stressMode ? stressRoutes : []) : liveRoutes
  const feedState = live.state
  const selectedRoute = selected ? routes.find((route) => route.id === selected.route.id) : undefined
  const totalHops = routes.reduce((sum, route) => sum + route.result.hops.length, 0)
  const logicalCount = routes.filter((route) => route.result.connection?.pathKind !== 'trace').length
  const lastUpdated = live.status.updatedAt ? new Date(live.status.updatedAt).toLocaleTimeString(lang === 'zh' ? 'zh-CN' : 'en-US', { hour12: false }) : '—'
  const maxRoutes = live.status.maxRoutes

  return <main className="app-shell">
    <section className="scene-layer" aria-label={lang === 'zh' ? '三维实时网络连接地球' : '3D live network globe'}><EarthScene routes={routes} onSelect={(route, hop) => setSelected({ route, hop })} selectedRouteId={selected?.route.id} autoRotate={autoRotate && !reducedMotion} motion={!reducedMotion && !paused} speed={speed} resetSignal={resetSignal} onReset={() => setAutoRotate(false)} /></section>
    <header className="topbar">
      <div className="brand">
        <span className="brand-mark"><Radar size={20} /></span>
        <div><strong>TraceScope</strong><span>{t('brandTagline')}</span></div>
      </div>
      <div className="topbar-meta">
        <span className={`feed-badge ${feedState}`} data-testid="feed-state">{feedState === 'live' ? <Wifi size={12} /> : feedState === 'offline' ? <WifiOff size={12} /> : <RefreshCw size={12} />}{stateText[feedState][lang]}</span>
        <span className="live-dot">{routes.length} {t('visibleRoutes')}</span>
        <button className="lang-toggle" aria-label={lang === 'zh' ? 'Switch to English' : '切换到中文'} onClick={() => setLang(lang === 'zh' ? 'en' : 'zh')}><Languages size={13} />{t('langSwitch')}</button>
      </div>
    </header>
    <aside className="control-panel" aria-label={lang === 'zh' ? '实时网络连接控制' : 'Live network control'}>
      <div className="panel-heading">
        <div><p className="eyebrow">{t('eyebrow')}</p><h1>{t('panelTitle')}</h1></div>
        <span className={`state-label ${feedState === 'live' ? 'tracing' : ''}`}><Activity size={13} />{lastUpdated}</span>
      </div>
      <button className="connection-action" onClick={live.state === 'offline' ? live.connect : live.disconnect}>{live.state === 'offline' ? <><Wifi size={15} />{t('connectLive')}</> : <><WifiOff size={15} />{t('disconnectLive')}</>}</button>
      <div className="privacy-strip">
        <button onClick={() => setPrivacyOpen((value) => !value)} aria-expanded={privacyOpen}><ShieldCheck size={14} /><span>{t('localLocation')}{cityName(routes[0]?.result.physicalOrigin.city || '北京', lang)}{t('localConfig')}</span><i>{t('geoipOutbound')}</i><Info size={13} /></button>
        {privacyOpen && <p>{t('privacyText')}</p>}
      </div>
      {feedState === 'offline' && live.error && <p className="feed-error">{live.error}</p>}
      <div className="metrics">
        <div><small>{t('metricCollected')}</small><strong>{live.status.collected}</strong></div>
        <div><small>{t('metricGlobe')}（{t('metricMax')} {maxRoutes}）</small><strong>{routes.length}</strong></div>
        <div><small>{t('metricLogical')}</small><strong>{logicalCount}<em> {t('metricPaths')}</em></strong></div>
      </div>
      <div className="playback">
        <button title={paused ? t('resumeSignals') : t('pauseSignals')} aria-label={paused ? t('resumeSignals') : t('pauseSignals')} disabled={!routes.length} onClick={() => setPaused((value) => !value)}>{paused ? <Play size={16} fill="currentColor" /> : <Pause size={16} fill="currentColor" />}</button>
        <span className="collection-note">{t('pauseHint')}</span>
        <div className="speed-control"><FastForward size={15} /><input aria-label={t('signalSpeed')} type="range" min="0" max="2" step="1" value={speeds.indexOf(speed)} onChange={(event) => setSpeed(speeds[Number(event.target.value)])} /><span>{speed}x</span></div>
      </div>
      <div className="hop-section">
        <div className="section-label"><span>{t('routesHeading')}</span><small>{totalHops} {t('locatableNodes')}</small></div>
        <ol className="hop-list">{routes.map((route) => {
          const details = route.result.connection
          const state = details ? `${routeKindText[details.routeKind][lang]} · ${details.traceState === 'pending' ? t('traceQueued') : details.traceState === 'unavailable' ? t('traceUnavailable') : pathKindText[details.pathKind][lang]}` : ''
          const meta = [details?.process || details?.source, state, details?.chains.length ? details.chains.join(' → ') : ''].filter(Boolean).join(' · ')
          return <li key={route.id} className={details?.stale ? 'stale' : ''}><button className={`route-row ${selected?.route.id === route.id ? 'focused' : ''}`} onClick={() => setSelected({ route, hop: route.result.hops.at(-1)! })}><span className="route-swatch" style={{ background: route.color }} /><span className="hop-main"><strong>{route.result.targetLabel}</strong><small>{meta}</small></span><span className="route-traffic">{details ? bytes(details.upload + details.download) : `${route.result.hops.length} ${t('hops')}`}</span><ChevronRight size={14} /></button></li>
        })}</ol>
      </div>
    </aside>
    <div className="right-overlay">
      <div className="map-attribution"><MapPin size={13} />{t('attribution')}</div>
      <aside className="detail-panel">
        <div className="detail-title"><Terminal size={15} /><span>{t('detailTitle')}</span></div>
        {selected && selectedRoute ? <>
          <strong>{selectedRoute.result.targetLabel}</strong>
          <p>{cityName(selected.hop.geo.city, lang)} · {countryName(selected.hop.geo.country, lang)}</p>
          <div className="route-path-summary">
            <span>{t('origin')} · {cityName(selectedRoute.result.physicalOrigin.city, lang)}</span>
            {selectedRoute.result.proxyEgress && <span>{t('proxyEgress')} · {cityName(selectedRoute.result.proxyEgress.city, lang)}</span>}
            {selectedRoute.result.vpnEgress && <span>{t('vpnEgress')} · {cityName(selectedRoute.result.vpnEgress.city, lang)}</span>}
            <span>{t('target')} · {cityName(selectedRoute.result.destination.city, lang)}</span>
          </div>
          <dl>
            <div><dt>{t('type')}</dt><dd>{selectedRoute.result.connection ? routeKindText[selectedRoute.result.connection.routeKind][lang] : '—'}</dd></div>
            <div><dt>{t('path')}</dt><dd>{selectedRoute.result.connection ? pathKindText[selectedRoute.result.connection.pathKind][lang] : '—'}</dd></div>
            <div><dt>{t('rtt')}</dt><dd>{selected.hop.latencyMs ? `${selected.hop.latencyMs} ms` : '—'}</dd></div>
          </dl>
          {selectedRoute.result.connection && <div className="detail-meta"><span><Link2 size={12} />{selectedRoute.result.connection.chains.join(' → ') || t('noProxyChain')}</span><span>{selectedRoute.result.connection.process || t('unknownProcess')} · {selectedRoute.result.connection.rule || t('unknownRule')}</span></div>}
        </> : <p>{t('detailHint')}</p>}
      </aside>
    </div>
    <div className="scene-tools">
      <button title={t('autoRotate')} aria-label={t('autoRotate')} className={autoRotate ? 'active' : ''} onClick={() => setAutoRotate((value) => !value)}><RotateCcw size={16} /></button>
      <button title={t('resetView')} aria-label={t('resetView')} onClick={() => { setAutoRotate(false); setResetSignal((value) => value + 1) }}><Settings2 size={16} /></button>
    </div>
  </main>
}

export default App
