import { useCallback, useEffect, useRef, useState } from 'react'
import type { FeedState, FeedStatus, LiveRoute, ServerMessage } from './types'

const emptyStatus: FeedStatus = { source: 'none', collected: 0, publicTargets: 0, privateFiltered: 0, displayed: 0, maxRoutes: 100, geoProvider: 'ipwho.is', updatedAt: '' }

function isMessage(value: unknown): value is ServerMessage {
  if (!value || typeof value !== 'object') return false
  const candidate = value as Partial<ServerMessage>
  return candidate.version === 2 && typeof candidate.type === 'string' && typeof candidate.sentAt === 'string'
}

export function useLiveFeed(enabled: boolean) {
  const [state, setState] = useState<FeedState>('offline')
  const [status, setStatus] = useState<FeedStatus>(emptyStatus)
  const [routes, setRoutes] = useState<LiveRoute[]>([])
  const [error, setError] = useState<string>()
  const [generation, setGeneration] = useState(0)
  const retryRef = useRef(0)
  const manualRef = useRef(false)
  const reconnectTimer = useRef<number | undefined>(undefined)
  const socketRef = useRef<WebSocket | undefined>(undefined)

  const connect = useCallback(() => {
    manualRef.current = false
    retryRef.current = 0
    setGeneration((value) => value + 1)
  }, [])
  const disconnect = useCallback(() => {
    manualRef.current = true
    window.clearTimeout(reconnectTimer.current)
    socketRef.current?.close(1000, 'User disconnected')
    socketRef.current = undefined
    setState('offline')
  }, [])

  useEffect(() => {
    if (!enabled || manualRef.current) return
    let disposed = false
    setState(retryRef.current ? 'reconnecting' : 'connecting')
    const socket = new WebSocket(`ws://${window.location.hostname || '127.0.0.1'}:8788/ws`)
    socketRef.current = socket
    socket.addEventListener('open', () => {
      retryRef.current = 0
      setState('live')
      setError(undefined)
    })
    socket.addEventListener('message', (event) => {
      try {
        const parsed: unknown = JSON.parse(String(event.data))
        if (!isMessage(parsed)) return
        if (parsed.type === 'status') setStatus(parsed.status)
        if (parsed.type === 'snapshot' || parsed.type === 'update') {
          setStatus(parsed.status)
          setRoutes(parsed.routes)
        }
        if (parsed.type === 'error') setError(parsed.message)
      } catch {
        setError('实时数据格式无法识别')
      }
    })
    socket.addEventListener('close', () => {
      if (disposed || manualRef.current) return
      retryRef.current += 1
      setState('reconnecting')
      const delay = Math.min(15_000, 700 * 2 ** Math.min(5, retryRef.current - 1))
      reconnectTimer.current = window.setTimeout(() => setGeneration((value) => value + 1), delay)
    })
    socket.addEventListener('error', () => setError('本机实时服务暂时不可达'))
    return () => {
      disposed = true
      socket.close()
    }
  }, [enabled, generation])

  return { state, status, routes, error, connect, disconnect }
}
