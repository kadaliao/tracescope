import { feature } from 'topojson-client'
import { useEffect, useMemo, useState } from 'react'
import * as THREE from 'three'
import type { FeatureCollection, Geometry, Position } from 'geojson'
import type { GeometryCollection, Objects, Topology } from 'topojson-specification'

const RADIUS = 2.178
const project = ([longitude, latitude]: Position) => {
  const phi = (90 - latitude) * Math.PI / 180
  const theta = (longitude + 180) * Math.PI / 180
  return new THREE.Vector3(-RADIUS * Math.sin(phi) * Math.cos(theta), RADIUS * Math.cos(phi), RADIUS * Math.sin(phi) * Math.sin(theta))
}

function geometryRings(geometry: Geometry): Position[][] {
  if (geometry.type === 'Polygon') return geometry.coordinates
  if (geometry.type === 'MultiPolygon') return geometry.coordinates.flat()
  return []
}

function borderVertices(collection: FeatureCollection): Float32Array {
  const values: number[] = []
  for (const item of collection.features) {
    if (!item.geometry) continue
    for (const ring of geometryRings(item.geometry)) {
      for (let index = 1; index < ring.length; index += 1) {
        const from = ring[index - 1]
        const to = ring[index]
        const longitudeDelta = to[0] - from[0]
        if (Math.abs(longitudeDelta) > 180) continue
        const steps = Math.max(1, Math.ceil(Math.max(Math.abs(longitudeDelta), Math.abs(to[1] - from[1])) / 1.5))
        for (let step = 0; step < steps; step += 1) {
          const first = step / steps
          const second = (step + 1) / steps
          const a = project([from[0] + longitudeDelta * first, from[1] + (to[1] - from[1]) * first])
          const b = project([from[0] + longitudeDelta * second, from[1] + (to[1] - from[1]) * second])
          values.push(a.x, a.y, a.z, b.x, b.y, b.z)
        }
      }
    }
  }
  return new Float32Array(values)
}

export default function CountryBorders() {
  const [vertices, setVertices] = useState<Float32Array>()
  useEffect(() => {
    const controller = new AbortController()
    void fetch('/countries-110m.json', { signal: controller.signal }).then((response) => {
      if (!response.ok) throw new Error(`Country borders HTTP ${response.status}`)
      return response.json()
    }).then((topology: Topology<Objects<{ countries: GeometryCollection }>>) => {
      const collection = feature(topology, topology.objects.countries) as unknown as FeatureCollection
      setVertices(borderVertices(collection))
    }).catch((error: unknown) => { if (!(error instanceof DOMException && error.name === 'AbortError')) console.error('Country borders unavailable') })
    return () => controller.abort()
  }, [])
  const count = useMemo(() => vertices ? vertices.length / 3 : 0, [vertices])
  useEffect(() => {
    if (count) (window as Window & { traceScopeCountryBorders?: number }).traceScopeCountryBorders = count
    return () => { delete (window as Window & { traceScopeCountryBorders?: number }).traceScopeCountryBorders }
  }, [count])
  if (!vertices) return null
  return <lineSegments renderOrder={1}><bufferGeometry><bufferAttribute attach="attributes-position" args={[vertices, 3]} count={count} /></bufferGeometry><lineBasicMaterial color="#a9c5bd" transparent opacity={.36} depthWrite={false} /></lineSegments>
}
