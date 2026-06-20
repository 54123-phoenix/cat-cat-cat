import { useEffect, useRef, useCallback } from 'react'
import { getToken } from '../api'

export function useEventStream(onEvent) {
  const onEventRef = useRef(onEvent)
  onEventRef.current = onEvent
  const sourceRef = useRef(null)

  const connect = useCallback(() => {
    const token = getToken()
    if (!token) return
    try {
      const base = `${window.location.origin}/api/events/stream`
      const url = `${base}?token=${encodeURIComponent(token)}`
      const es = new EventSource(url)
      sourceRef.current = es
      es.onmessage = (ev) => {
        try {
          const payload = JSON.parse(ev.data)
          if (onEventRef.current) onEventRef.current(payload)
        } catch {
          // ignore malformed
        }
      }
      es.onerror = () => {
        es.close()
        sourceRef.current = null
      }
    } catch {
      // EventSource unsupported
    }
  }, [])

  useEffect(() => {
    connect()
    return () => {
      if (sourceRef.current) {
        sourceRef.current.close()
        sourceRef.current = null
      }
    }
  }, [connect])

  return sourceRef
}
