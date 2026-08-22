import { useEffect, useMemo, useState } from 'react'
import { Activity, ChevronRight, FastForward, Globe2, Info, Link2, MapPin, Pause, Play, Radar, RefreshCw, RotateCcw, Settings2, ShieldCheck, Terminal, Wifi, WifiOff } from 'lucide-react'
import EarthScene from './EarthScene'
import { createStressDemoResults, DeterministicDemoProvider, initialDemoTargets } from './demoProvider'
import { useLiveFeed } from './useLiveFeed'
import type { FeedMode, LiveRoute, TraceHop, TracePlayback } from './types'

const provider = new DeterministicDemoProvider()
const palette = ['#38d9c0', '#f2bb58', '#79c9ff', '#8bdc8a', '#ef9a67', '#dd8df1', '#f18ca4', '#9ed167']
const targets = [{ id: 'google', label: 'Google', detail: '8.8.8.8' }, { id: 'bilibili', label: 'Bilibili', detail: 'www.bilibili.com' }, { id: 'singapore', label: '新加坡节点', detail: 'sg-edge.demo' }]
const speeds = [.75, 1, 1.75]
const stateLabel = { connecting: '正在连接', live: '实时', reconnecting: '正在重连', offline: '已断开', demo: '演示' }
const routeKindLabel = { direct: '直连', proxy: '代理', vpn: 'VPN' }
const pathLabel = { trace: '真实 Trace', 'logical-direct': '逻辑直连', 'logical-proxy': '逻辑代理路径', 'logical-vpn': '逻辑 VPN 路径' }
const stressMode = new URLSearchParams(window.location.search).get('stress') === '100'
const earthOnlyMode = new URLSearchParams(window.location.search).get('earth') === '1'

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
  const [mode, setMode] = useState<FeedMode>(stressMode || earthOnlyMode ? 'demo' : 'live')
  const live = useLiveFeed(mode === 'live')
  const [demoRoutes, setDemoRoutes] = useState<TracePlayback[]>(() => stressMode ? createStressDemoResults(100).map((result, index) => ({ id: result.id, result, color: palette[index % palette.length], revealed: result.hops.length, status: 'tracing' })) : [])
  const [paused, setPaused] = useState(false)
  const [speed, setSpeed] = useState(1)
  const [autoRotate, setAutoRotate] = useState(false)
  const [resetSignal, setResetSignal] = useState(0)
  const [selected, setSelected] = useState<{ route: TracePlayback; hop: TraceHop } | null>(null)
  const [target, setTarget] = useState('google')
  const [customTarget, setCustomTarget] = useState('')
  const [privacyOpen, setPrivacyOpen] = useState(false)
  const [reducedMotion] = useState(() => window.matchMedia('(prefers-reduced-motion: reduce)').matches)

  const liveRoutes = useMemo(() => live.routes.map(livePlayback), [live.routes])
  const routes = mode === 'live' ? liveRoutes : demoRoutes
  const feedState = mode === 'live' ? live.state : 'demo'

  useEffect(() => {
    if (mode !== 'demo' || demoRoutes.length) return
    if (stressMode || earthOnlyMode) return
    void Promise.all(initialDemoTargets.map((id) => provider.trace(id))).then((results) => setDemoRoutes(results.map((result, index) => ({ id: result.target, result, color: palette[index % palette.length], revealed: result.hops.length, status: 'tracing' }))))
  }, [mode, demoRoutes.length])

  const addDemo = async () => {
    const label = customTarget.trim()
    const result = await provider.trace(label ? 'google' : target)
    const id = label ? `custom-${label}` : target
    const next: TracePlayback = { id, result: label ? { ...result, target: label, targetLabel: label } : result, color: palette[demoRoutes.length % palette.length], revealed: result.hops.length, status: 'tracing' }
    setDemoRoutes((value) => [...value.filter((item) => item.id !== id), next])
  }
  const selectedRoute = selected ? routes.find((route) => route.id === selected.route.id) : undefined
  const totalHops = routes.reduce((sum, route) => sum + route.result.hops.length, 0)
  const logicalCount = routes.filter((route) => route.result.connection?.pathKind !== 'trace').length
  const lastUpdated = mode === 'live' && live.status.updatedAt ? new Date(live.status.updatedAt).toLocaleTimeString('zh-CN', { hour12: false }) : '—'
  const maxRoutes = mode === 'live' ? live.status.maxRoutes : 100

  return <main className="app-shell">
    <section className="scene-layer" aria-label="三维实时网络连接地球"><EarthScene routes={routes} onSelect={(route, hop) => setSelected({ route, hop })} selectedRouteId={selected?.route.id} autoRotate={autoRotate && !reducedMotion} motion={!reducedMotion && !paused} speed={speed} resetSignal={resetSignal} onReset={() => setAutoRotate(false)} /></section>
    <header className="topbar"><div className="brand"><span className="brand-mark"><Radar size={20} /></span><div><strong>TraceScope</strong><span>本机网络路径可视化</span></div></div><div className="topbar-meta"><span className={`feed-badge ${feedState}`} data-testid="feed-state">{feedState === 'live' ? <Wifi size={12} /> : feedState === 'offline' ? <WifiOff size={12} /> : <RefreshCw size={12} />}{stateLabel[feedState]}</span><span className="live-dot">{routes.length} 条可视线路</span></div></header>
    <aside className="control-panel" aria-label="实时网络连接控制">
      <div className="panel-heading"><div><p className="eyebrow">NETWORK FLOW CONSOLE</p><h1>实时网络连接</h1></div><span className={`state-label ${feedState === 'live' ? 'tracing' : ''}`}><Activity size={13} />{lastUpdated}</span></div>
      <div className="mode-switch" aria-label="数据模式"><button className={mode === 'live' ? 'selected' : ''} onClick={() => { setMode('live'); setSelected(null) }}><Wifi size={14} />实时</button><button className={mode === 'demo' ? 'selected' : ''} onClick={() => { setMode('demo'); setSelected(null) }}><Globe2 size={14} />演示</button></div>
      {mode === 'demo' && <div className="demo-controls"><div className="target-grid">{targets.map((item) => <button className={`target-button ${target === item.id && !customTarget ? 'selected' : ''}`} key={item.id} onClick={() => { setTarget(item.id); setCustomTarget('') }}><span>{item.label}</span><small>{item.detail}</small></button>)}</div><label className="domain-input"><Globe2 size={16} /><input value={customTarget} onChange={(event) => setCustomTarget(event.target.value)} placeholder="自定义演示标签" /><button title="新增演示线路" aria-label="新增演示线路" onClick={() => void addDemo()}><Play size={15} fill="currentColor" /></button></label></div>}
      {mode === 'live' && <button className="connection-action" onClick={live.state === 'offline' ? live.connect : live.disconnect}>{live.state === 'offline' ? <><Wifi size={15} />连接本机实时服务</> : <><WifiOff size={15} />断开实时服务</>}</button>}
      <div className="privacy-strip"><button onClick={() => setPrivacyOpen((value) => !value)} aria-expanded={privacyOpen}><ShieldCheck size={14} /><span>本机位置：{routes[0]?.result.physicalOrigin.city || '北京'}（本地配置）</span><i>GeoIP 外发</i><Info size={13} /></button>{privacyOpen && <p>本机物理位置来自本地配置，不由公网 IP 推断，也不会发送给 GeoIP 服务。服务仅监听 127.0.0.1，不向网页发送本地源 IP 或 controller secret。公网目标 IP 与代理/VPN 公网出口会发送给 ipwho.is 定位；需解析域名时，域名会发送给 Cloudflare DoH。</p>}</div>
      {mode === 'live' && live.error && <p className="feed-error">{live.error}。可切换到演示模式查看界面。</p>}
      <div className="metrics"><div><small>采集连接</small><strong>{mode === 'live' ? live.status.collected : routes.length}</strong></div><div><small>地球线路（最多 {maxRoutes}）</small><strong>{routes.length}</strong></div><div><small>逻辑路径</small><strong>{logicalCount}<em> 条</em></strong></div></div>
      <div className="playback"><button title={paused ? '继续信号动画' : '暂停信号动画'} aria-label={paused ? '继续信号动画' : '暂停信号动画'} disabled={!routes.length} onClick={() => setPaused((value) => !value)}>{paused ? <Play size={16} fill="currentColor" /> : <Pause size={16} fill="currentColor" />}</button>{mode === 'live' ? <span className="collection-note">暂停不影响后台采集</span> : <button title="重新载入演示" aria-label="重新载入演示" onClick={() => setDemoRoutes([])}><RotateCcw size={16} /></button>}<div className="speed-control"><FastForward size={15} /><input aria-label="信号速度" type="range" min="0" max="2" step="1" value={speeds.indexOf(speed)} onChange={(event) => setSpeed(speeds[Number(event.target.value)])} /><span>{speed}x</span></div></div>
      <div className="hop-section"><div className="section-label"><span>线路与连接</span><small>{totalHops} 个可定位节点</small></div><ol className="hop-list">{routes.map((route) => { const details = route.result.connection; const state = details ? `${routeKindLabel[details.routeKind]} · ${details.traceState === 'pending' ? 'Trace 排队' : details.traceState === 'unavailable' ? 'Trace 无响应' : pathLabel[details.pathKind]}` : '演示路径'; return <li key={route.id} className={details?.stale ? 'stale' : ''}><button className={`route-row ${selected?.route.id === route.id ? 'focused' : ''}`} onClick={() => setSelected({ route, hop: route.result.hops.at(-1)! })}><span className="route-swatch" style={{ background: route.color }} /><span className="hop-main"><strong>{route.result.targetLabel}</strong><small>{details?.process || details?.source || 'demo'} · {state}{details?.chains.length ? ` · ${details.chains.join(' → ')}` : ''}</small></span><span className="route-traffic">{details ? bytes(details.upload + details.download) : `${route.result.hops.length} hops`}</span><ChevronRight size={14} /></button></li>})}</ol></div>
    </aside>
    <div className="right-overlay"><div className="map-attribution"><MapPin size={13} />拖拽旋转 · 滚轮缩放 · {mode === 'live' ? '连接实时更新' : '显式演示模式'}</div><aside className="detail-panel"><div className="detail-title"><Terminal size={15} /><span>连接详情</span></div>{selected && selectedRoute ? <><strong>{selectedRoute.result.targetLabel}</strong><p>{selected.hop.geo.city} · {selected.hop.geo.country}</p><div className="route-path-summary"><span>本机 · {selectedRoute.result.physicalOrigin.city}</span>{selectedRoute.result.proxyEgress && <span>代理出口 · {selectedRoute.result.proxyEgress.city}</span>}{selectedRoute.result.vpnEgress && <span>VPN 出口 · {selectedRoute.result.vpnEgress.city}</span>}<span>目标 · {selectedRoute.result.destination.city}</span></div><dl><div><dt>类型</dt><dd>{selectedRoute.result.connection ? routeKindLabel[selectedRoute.result.connection.routeKind] : '演示'}</dd></div><div><dt>路径</dt><dd>{selectedRoute.result.connection ? pathLabel[selectedRoute.result.connection.pathKind] : '演示'}</dd></div><div><dt>RTT</dt><dd>{selected.hop.latencyMs ? `${selected.hop.latencyMs} ms` : '—'}</dd></div></dl>{selectedRoute.result.connection && <div className="detail-meta"><span><Link2 size={12} />{selectedRoute.result.connection.chains.join(' → ') || '无代理链'}</span><span>{selectedRoute.result.connection.process || '进程未知'} · {selectedRoute.result.connection.rule || '规则未知'}</span></div>}</> : <p>点击任意线路查看本机、出口、目标和路径性质</p>}</aside></div>
    <div className="scene-tools"><button title="自动旋转" aria-label="自动旋转" className={autoRotate ? 'active' : ''} onClick={() => setAutoRotate((value) => !value)}><RotateCcw size={16} /></button><button title="复位视角" aria-label="复位视角" onClick={() => { setAutoRotate(false); setResetSignal((value) => value + 1) }}><Settings2 size={16} /></button></div>
  </main>
}

export default App
