import { Html, Line, OrbitControls, Stars, useTexture } from '@react-three/drei'
import { Canvas, useFrame } from '@react-three/fiber'
import { useEffect, useMemo, useRef, type ComponentRef, type CSSProperties, type ReactNode } from 'react'
import * as THREE from 'three'
import CountryBorders from './CountryBorders'
import type { GeoPoint, TraceHop, TracePlayback } from './types'

const R = 2.16
const UP = new THREE.Vector3(0, 1, 0)
const INITIAL_CAMERA: [number, number, number] = [1.208, 3.681, 5.95]
const geo = (lat: number, lon: number, altitude = 0) => {
  const radius = R + altitude
  const phi = (90 - lat) * Math.PI / 180
  const theta = (lon + 180) * Math.PI / 180
  return new THREE.Vector3(-radius * Math.sin(phi) * Math.cos(theta), radius * Math.cos(phi), radius * Math.sin(phi) * Math.sin(theta))
}
const curve = (a: THREE.Vector3, b: THREE.Vector3) => {
  const mid = a.clone().add(b).multiplyScalar(.5)
  const distance = a.distanceTo(b)
  mid.normalize().multiplyScalar(R + (distance < .35 ? .18 : Math.min(1.7, .42 + distance * .28)))
  return new THREE.QuadraticBezierCurve3(a, mid, b)
}
const pointKey = (role: string, point: GeoPoint) => `${role}:${point.latitude.toFixed(3)}:${point.longitude.toFixed(3)}`

function ScreenSpaceScale({ pixels, telemetryKey, children }: { pixels: number; telemetryKey?: string; children: ReactNode }) {
  const ref = useRef<THREE.Group>(null)
  const worldPosition = useMemo(() => new THREE.Vector3(), [])
  useFrame(({ camera, size }) => {
    if (!ref.current) return
    ref.current.getWorldPosition(worldPosition)
    const cameraDistance = camera.position.distanceTo(worldPosition)
    const fieldOfView = camera instanceof THREE.PerspectiveCamera ? THREE.MathUtils.degToRad(camera.fov) : THREE.MathUtils.degToRad(43)
    const worldPerPixel = 2 * cameraDistance * Math.tan(fieldOfView / 2) / Math.max(1, size.height)
    const scale = THREE.MathUtils.clamp(worldPerPixel * pixels, .0025, .16)
    ref.current.scale.setScalar(scale)
    if (telemetryKey) {
      const target = window as Window & { traceScopeMarkerTelemetry?: Record<string, { cameraDistance: number; worldScale: number; targetPixels: number }> }
      target.traceScopeMarkerTelemetry ||= {}
      target.traceScopeMarkerTelemetry[telemetryKey] = { cameraDistance, worldScale: scale, targetPixels: pixels }
    }
  })
  return <group ref={ref}>{children}</group>
}

function FixedLabel({ children, className, style, testId }: { children: ReactNode; className: string; style?: CSSProperties; testId: string }) {
  return <Html center style={{ pointerEvents: 'none' }}><span data-testid={testId} className={className} style={style}>{children}</span></Html>
}

function Earth() {
  const map = useTexture('/earth_atmos_2048.jpg')
  const correctedMap = useMemo(() => Object.assign(map.clone(), { colorSpace: THREE.SRGBColorSpace, needsUpdate: true }), [map])
  useEffect(() => () => correctedMap.dispose(), [correctedMap])
  return <group><mesh><sphereGeometry args={[R, 96, 96]} /><meshPhongMaterial map={correctedMap} color="#b7c9bd" emissive="#01080b" emissiveIntensity={.12} shininess={8} /></mesh><CountryBorders /><mesh scale={1.045}><sphereGeometry args={[R, 64, 64]} /><meshBasicMaterial color="#45bfb4" transparent opacity={.035} side={THREE.BackSide} /></mesh></group>
}

function Signal({ path, offset, color, motion, speed }: { path: THREE.QuadraticBezierCurve3; offset: number; color: string; motion: boolean; speed: number }) {
  const ref = useRef<THREE.Group>(null)
  const progress = useRef(offset % 1)
  useFrame((_, delta) => {
    if (!ref.current) return
    if (motion) progress.current = (progress.current + delta * .15 * speed) % 1
    ref.current.position.copy(path.getPoint(progress.current))
  })
  return <group ref={ref} renderOrder={8}><ScreenSpaceScale pixels={2.4}><mesh><sphereGeometry args={[1, 12, 12]} /><meshBasicMaterial color={color} depthTest={false} /></mesh></ScreenSpaceScale></group>
}

function Arrow({ path, color }: { path: THREE.QuadraticBezierCurve3; color: string }) {
  const data = useMemo(() => { const t = .62; return { point: path.getPoint(t), quat: new THREE.Quaternion().setFromUnitVectors(UP, path.getTangent(t).normalize()) } }, [path])
  return <group position={data.point} quaternion={data.quat} renderOrder={7}><ScreenSpaceScale pixels={8}><mesh><coneGeometry args={[.32, 1, 8]} /><meshBasicMaterial color={color} depthTest={false} /></mesh></ScreenSpaceScale><Html center style={{ pointerEvents: 'none' }}><span data-testid="path-arrow" className="path-arrow-marker" /></Html></group>
}

function Pulse({ color, motion }: { color: string; motion: boolean }) {
  const ref = useRef<THREE.Mesh>(null)
  const elapsed = useRef(0)
  useFrame((_, delta) => { if (ref.current) { elapsed.current += delta; const scale = motion ? 1 + (Math.sin(elapsed.current * 5) + 1) * .08 : 1; ref.current.scale.setScalar(scale) } })
  return <ScreenSpaceScale pixels={2.2}><mesh ref={ref}><ringGeometry args={[1.35, 1.7, 20]} /><meshBasicMaterial color={color} transparent opacity={.7} side={THREE.DoubleSide} /></mesh></ScreenSpaceScale>
}

function SharedMarker({ point, label, color, testId }: { point: GeoPoint; label: string; color: string; testId: string }) {
  return <group position={geo(point.latitude, point.longitude, .045)}><ScreenSpaceScale pixels={2.3} telemetryKey={testId === 'physical-origin' ? 'physical-origin' : undefined}><mesh><sphereGeometry args={[1, 12, 12]} /><meshBasicMaterial color={color} depthTest={false} /></mesh></ScreenSpaceScale><FixedLabel testId={testId} className="city-label shared-node-label" style={{ borderColor: color }}>{label}</FixedLabel></group>
}

function SharedMarkers({ routes }: { routes: TracePlayback[] }) {
  const markers = useMemo(() => {
    const unique = new Map<string, { point: GeoPoint; label: string; color: string; testId: string }>()
    for (const route of routes) {
      const origin = route.result.physicalOrigin
      unique.set(pointKey('origin', origin), { point: origin, label: `本机 · ${origin.city}`, color: '#4fe0ca', testId: 'physical-origin' })
      if (route.result.proxyEgress) {
        const point = route.result.proxyEgress
        unique.set(pointKey('proxy', point), { point, label: `代理出口 · ${point.city}`, color: '#f2bb58', testId: 'proxy-egress' })
      }
      if (route.result.vpnEgress) {
        const point = route.result.vpnEgress
        unique.set(pointKey('vpn', point), { point, label: `VPN 出口 · ${point.city}`, color: '#dd8df1', testId: 'vpn-egress' })
      }
    }
    return [...unique.values()]
  }, [routes])
  return <>{markers.map((marker) => <SharedMarker key={`${marker.testId}-${marker.point.latitude}-${marker.point.longitude}`} {...marker} />)}</>
}

const hopLabelKey = (hop: TraceHop) => `${hop.role || 'trace'}:${hop.geo.city}`
const hopOwner = (route: TracePlayback, hop: TraceHop) => `${route.id}:${hop.id}`

function Route({ route, onSelect, motion, speed, renderSharedIngress, labelOwners }: { route: TracePlayback; onSelect: (route: TracePlayback, hop: TraceHop) => void; motion: boolean; speed: number; renderSharedIngress: boolean; labelOwners: Map<string, string> }) {
  const points = useMemo(() => [geo(route.result.physicalOrigin.latitude, route.result.physicalOrigin.longitude, .045), ...route.result.hops.map((hop) => geo(hop.geo.latitude, hop.geo.longitude, .045))], [route])
  return <group>
    {points.slice(1, route.revealed + 1).map((point, index) => {
      const hop = route.result.hops[index]
      if (hop.role === 'proxy-egress' || hop.role === 'vpn-egress') return null
      const showLabel = labelOwners.get(hopLabelKey(hop)) === hopOwner(route, hop)
      const current = index + 1 === route.revealed && route.status === 'tracing'
      return <group key={`${route.id}-${index}`} position={point} onClick={(event) => { event.stopPropagation(); onSelect(route, hop) }}><ScreenSpaceScale pixels={current ? 2.7 : 2.1}><mesh><sphereGeometry args={[1, 12, 12]} /><meshBasicMaterial color={route.color} depthTest={false} /></mesh></ScreenSpaceScale>{current && <Pulse color={route.color} motion={route.status === 'tracing'} />}{showLabel && <FixedLabel testId="city-label" className={`city-label route-${route.id}`} style={{ borderColor: route.color }}>{hop.geo.city}</FixedLabel>}</group>
    })}
    {Array.from({ length: Math.max(0, route.revealed) }, (_, index) => {
      const hop = route.result.hops[index]
      const sharedIngress = index === 0 && (hop?.role === 'proxy-egress' || hop?.role === 'vpn-egress')
      if (sharedIngress && !renderSharedIngress) return null
      const path = curve(points[index], points[index + 1])
      const anomaly = hop?.latencyMs - (route.result.hops[index - 1]?.latencyMs ?? 0) > 55
      const color = anomaly ? '#ef735e' : route.color
      const terminal = index === route.result.hops.length - 1
      const showDirection = terminal || (sharedIngress && renderSharedIngress)
      return <group key={`${route.id}-segment-${index}`}><Line points={path.getPoints(48)} color={color} lineWidth={terminal ? 1.8 : .9} transparent opacity={terminal ? .74 : .3} depthTest={false} />{showDirection && <Arrow path={path} color={color} />}<Signal path={path} offset={index * .23} color={color} motion={motion && route.status === 'tracing'} speed={speed} /></group>
    })}
  </group>
}

function DenseSignals({ paths, colors, motion, speed }: { paths: THREE.QuadraticBezierCurve3[]; colors: Float32Array; motion: boolean; speed: number }) {
  const initialPositions = useMemo(() => new Float32Array(paths.length * 3), [paths.length])
  const attribute = useRef<THREE.BufferAttribute>(null)
  const progress = useRef(Float32Array.from({ length: paths.length }, (_, index) => (index * .137) % 1))
  useFrame((_, delta) => {
    if (!attribute.current) return
    const positions = attribute.current.array as Float32Array
    for (let index = 0; index < paths.length; index += 1) {
      if (motion) progress.current[index] = (progress.current[index] + delta * .15 * speed) % 1
      const point = paths[index].getPoint(progress.current[index])
      positions[index * 3] = point.x
      positions[index * 3 + 1] = point.y
      positions[index * 3 + 2] = point.z
    }
    attribute.current.needsUpdate = true
  })
  return <points renderOrder={8}><bufferGeometry><bufferAttribute ref={attribute} attach="attributes-position" args={[initialPositions, 3]} /><bufferAttribute attach="attributes-color" args={[colors, 3]} /></bufferGeometry><pointsMaterial size={4.8} sizeAttenuation={false} vertexColors depthTest={false} /></points>
}

function DenseArrows({ arrows }: { arrows: { id: string; path: THREE.QuadraticBezierCurve3; color: string }[] }) {
  const ref = useRef<THREE.InstancedMesh>(null)
  const data = useMemo(() => arrows.map((arrow) => { const t = .62; return { point: arrow.path.getPoint(t), quaternion: new THREE.Quaternion().setFromUnitVectors(UP, arrow.path.getTangent(t).normalize()), color: new THREE.Color(arrow.color) } }), [arrows])
  const matrix = useMemo(() => new THREE.Matrix4(), [])
  const scale = useMemo(() => new THREE.Vector3(), [])
  useEffect(() => {
    if (!ref.current) return
    data.forEach((item, index) => ref.current?.setColorAt(index, item.color))
    if (ref.current.instanceColor) ref.current.instanceColor.needsUpdate = true
    const target = window as Window & { traceScopeArrowCount?: number }
    target.traceScopeArrowCount = data.length
    return () => { delete target.traceScopeArrowCount }
  }, [data])
  useFrame(({ camera, size }) => {
    if (!ref.current) return
    const fieldOfView = camera instanceof THREE.PerspectiveCamera ? THREE.MathUtils.degToRad(camera.fov) : THREE.MathUtils.degToRad(43)
    data.forEach((item, index) => {
      const worldPerPixel = 2 * camera.position.distanceTo(item.point) * Math.tan(fieldOfView / 2) / Math.max(1, size.height)
      const markerScale = THREE.MathUtils.clamp(worldPerPixel * 8, .0025, .16)
      scale.setScalar(markerScale)
      matrix.compose(item.point, item.quaternion, scale)
      ref.current?.setMatrixAt(index, matrix)
    })
    ref.current.instanceMatrix.needsUpdate = true
  })
  return <instancedMesh ref={ref} args={[undefined, undefined, data.length]} renderOrder={7}><coneGeometry args={[.32, 1, 8]} /><meshBasicMaterial vertexColors depthTest={false} /></instancedMesh>
}

function DenseRoutes({ routes, labelOwners, motion, speed }: { routes: TracePlayback[]; labelOwners: Map<string, string>; motion: boolean; speed: number }) {
  const data = useMemo(() => {
    const linePositions: number[] = []
    const lineColors: number[] = []
    const nodePositions: number[] = []
    const nodeColors: number[] = []
    const signalPaths: THREE.QuadraticBezierCurve3[] = []
    const signalColors: number[] = []
    const terminalArrows: { id: string; path: THREE.QuadraticBezierCurve3; color: string }[] = []
    const labels: { id: string; point: THREE.Vector3; text: string; color: string }[] = []
    const sharedIngress = new Set<string>()
    for (const route of routes) {
      const color = new THREE.Color(route.color)
      const points = [geo(route.result.physicalOrigin.latitude, route.result.physicalOrigin.longitude, .045), ...route.result.hops.map((hop) => geo(hop.geo.latitude, hop.geo.longitude, .045))]
      for (let index = 0; index < route.result.hops.length; index += 1) {
        const hop = route.result.hops[index]
        const ingressRole = index === 0 && (hop.role === 'proxy-egress' || hop.role === 'vpn-egress') ? hop.role : undefined
        const ingressKey = ingressRole ? pointKey(ingressRole, hop.geo) : undefined
        const duplicateIngress = Boolean(ingressKey && sharedIngress.has(ingressKey))
        if (ingressKey) sharedIngress.add(ingressKey)
        const path = curve(points[index], points[index + 1])
        if (!duplicateIngress) {
          const samples = path.getPoints(18)
          for (let sample = 1; sample < samples.length; sample += 1) {
            linePositions.push(samples[sample - 1].x, samples[sample - 1].y, samples[sample - 1].z, samples[sample].x, samples[sample].y, samples[sample].z)
            lineColors.push(color.r, color.g, color.b, color.r, color.g, color.b)
          }
        }
        if (index === route.result.hops.length - 1) {
          signalPaths.push(path)
          signalColors.push(color.r, color.g, color.b)
          terminalArrows.push({ id: route.id, path, color: route.color })
        }
        if (hop.role !== 'proxy-egress' && hop.role !== 'vpn-egress') {
          const point = points[index + 1]
          nodePositions.push(point.x, point.y, point.z)
          nodeColors.push(color.r, color.g, color.b)
          if (labelOwners.get(hopLabelKey(hop)) === hopOwner(route, hop)) labels.push({ id: `${route.id}-${hop.id}`, point, text: hop.geo.city, color: route.color })
        }
      }
    }
    return { linePositions: new Float32Array(linePositions), lineColors: new Float32Array(lineColors), nodePositions: new Float32Array(nodePositions), nodeColors: new Float32Array(nodeColors), signalPaths, signalColors: new Float32Array(signalColors), terminalArrows, labels }
  }, [routes, labelOwners])
  return <group><lineSegments renderOrder={3}><bufferGeometry><bufferAttribute attach="attributes-position" args={[data.linePositions, 3]} /><bufferAttribute attach="attributes-color" args={[data.lineColors, 3]} /></bufferGeometry><lineBasicMaterial vertexColors transparent opacity={.38} depthTest={false} depthWrite={false} /></lineSegments><points renderOrder={6}><bufferGeometry><bufferAttribute attach="attributes-position" args={[data.nodePositions, 3]} /><bufferAttribute attach="attributes-color" args={[data.nodeColors, 3]} /></bufferGeometry><pointsMaterial size={3.8} sizeAttenuation={false} vertexColors depthTest={false} /></points><DenseSignals paths={data.signalPaths} colors={data.signalColors} motion={motion} speed={speed} /><DenseArrows arrows={data.terminalArrows} />{data.labels.map((label) => <group key={label.id} position={label.point}><FixedLabel testId="city-label" className="city-label" style={{ borderColor: label.color }}>{label.text}</FixedLabel></group>)}</group>
}

function Scene({ routes, onSelect, selectedRouteId, autoRotate, motion, speed, resetSignal, onReset }: { routes: TracePlayback[]; onSelect: (route: TracePlayback, hop: TraceHop) => void; selectedRouteId?: string; autoRotate: boolean; motion: boolean; speed: number; resetSignal: number; onReset: () => void }) {
  const controls = useRef<ComponentRef<typeof OrbitControls>>(null)
  const firstIngress = useMemo(() => {
    const map = new Map<string, string>()
    for (const route of routes) {
      const point = route.result.proxyEgress || route.result.vpnEgress
      const role = route.result.proxyEgress ? 'proxy' : route.result.vpnEgress ? 'vpn' : undefined
      if (point && role) { const key = pointKey(role, point); if (!map.has(key)) map.set(key, route.id) }
    }
    return map
  }, [routes])
  const labelOwners = useMemo(() => {
    const owners = new Map<string, string>()
    const limit = routes.length > 50 ? 8 : routes.length > 20 ? 12 : 20
    const preferred = routes.find((route) => route.id === selectedRouteId)
    const candidates = [...(preferred ? preferred.result.hops.map((hop) => ({ route: preferred, hop })) : []), ...routes.flatMap((route) => route.result.hops.filter((hop) => hop.role === 'destination').map((hop) => ({ route, hop }))), ...routes.flatMap((route) => route.result.hops.filter((hop) => !hop.role || hop.role === 'trace').map((hop) => ({ route, hop })))]
    for (const { route, hop } of candidates) {
      if (hop.role === 'proxy-egress' || hop.role === 'vpn-egress') continue
      const key = hopLabelKey(hop)
      if (!owners.has(key)) owners.set(key, hopOwner(route, hop))
      if (owners.size >= limit) break
    }
    return owners
  }, [routes, selectedRouteId])
  const dense = routes.length > 40
  useEffect(() => { controls.current?.reset() }, [resetSignal])
  return <Canvas camera={{ position: INITIAL_CAMERA, fov: 43 }} dpr={[1, 1.25]} gl={{ antialias: true }} onCreated={({ camera }) => { camera.lookAt(0, 0, 0); camera.updateMatrixWorld(); (window as Window & { traceScopeCamera?: THREE.Camera }).traceScopeCamera = camera }} onDoubleClick={() => { controls.current?.reset(); onReset() }}><color attach="background" args={['#061016']} /><ambientLight intensity={.42} /><directionalLight position={[5, 3, 4]} intensity={1.65} color="#e5fff6" /><directionalLight position={[-4, -1, -3]} intensity={.28} color="#6c9ba2" /><Stars radius={90} depth={50} count={1400} factor={3} fade speed={.2} /><Earth /><SharedMarkers routes={routes} />{dense ? <DenseRoutes routes={routes} labelOwners={labelOwners} motion={motion} speed={speed} /> : routes.map((route) => { const point = route.result.proxyEgress || route.result.vpnEgress; const role = route.result.proxyEgress ? 'proxy' : route.result.vpnEgress ? 'vpn' : undefined; const renderSharedIngress = !point || !role || firstIngress.get(pointKey(role, point)) === route.id; return <Route key={route.id} route={route} onSelect={onSelect} motion={motion} speed={speed} renderSharedIngress={renderSharedIngress} labelOwners={labelOwners} /> })}<OrbitControls ref={controls} enablePan={false} enableDamping={false} minDistance={3.3} maxDistance={10} autoRotate={autoRotate} autoRotateSpeed={.38} /></Canvas>
}

export default Scene
