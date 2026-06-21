// SECURITY NOTE: EventSource API doesn't support custom headers, so JWT is passed as query param.
// This is logged in server access logs. For production, implement a ticket-based approach:
// 1. POST /api/events/ticket → returns short-lived nonce
// 2. Connect EventSource with ?ticket=nonce (nonce is single-use)

import { useEffect, useRef, useCallback } from 'react'
import { getToken } from '../api'

const MAX_RETRIES = 5
const MAX_DELAY = 30000

function getDelay(retryCount: number): number {
  const base = 1000
  const delay = base * Math.pow(2, retryCount)
  return Math.min(delay, MAX_DELAY)
}

export function useEventStream(onEvent) {
  const onEventRef = useRef(onEvent)
  onEventRef.current = onEvent
  const sourceRef = useRef<EventSource | null>(null)
  const retryRef = useRef(0)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

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
        if (retryRef.current < MAX_RETRIES) {
          const delay = getDelay(retryRef.current)
          retryRef.current++
          timerRef.current = setTimeout(() => {
            connect()
          }, delay)
        }
      }
      es.onopen = () => {
        retryRef.current = 0
      }
    } catch {
      // EventSource unsupported
    }
  }, [])

  useEffect(() => {
    connect()
    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current)
        timerRef.current = null
      }
      if (sourceRef.current) {
        sourceRef.current.close()
        sourceRef.current = null
      }
    }
  }, [connect])

  return sourceRef
}
