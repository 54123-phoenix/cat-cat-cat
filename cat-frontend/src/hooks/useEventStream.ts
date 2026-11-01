// SECURITY NOTE: EventSource API doesn't support custom headers, so JWT is passed as query param.
// This is logged in server access logs. For production, implement a ticket-based approach:
// 1. POST /api/events/ticket → returns short-lived nonce
// 2. Connect EventSource with ?ticket=nonce (nonce is single-use)

import { useEffect, useRef } from 'react'
import { ApiError, getToken, getUserProfile } from '../api'

const MAX_DELAY = 30000

export interface StreamEvent {
  type: string
  data: Record<string, unknown>
}

interface StreamOptions {
  onOpen?: () => void
  onUnauthorized?: () => void
}

function getDelay(retryCount: number): number {
  const base = 1000
  const delay = base * Math.pow(2, retryCount)
  return Math.min(delay, MAX_DELAY)
}

export function useEventStream(onEvent: (event: StreamEvent) => void, options: StreamOptions = {}) {
  const callbacks = useRef({ onEvent, ...options })
  useEffect(() => { callbacks.current = { onEvent, ...options } }, [onEvent, options.onOpen, options.onUnauthorized])
  const sourceRef = useRef<EventSource | null>(null)
  const token = getToken()

  useEffect(() => {
    if (!token || typeof EventSource === 'undefined') return undefined
    let disposed = false
    let retryCount = 0
    let checkingAuth = false
    let timer: ReturnType<typeof setTimeout> | undefined
    const current = () => !disposed && getToken() === token

    function close() {
      clearTimeout(timer)
      timer = undefined
      sourceRef.current?.close()
      sourceRef.current = null
    }

    async function retry() {
      if (!current() || checkingAuth || !navigator.onLine) return
      checkingAuth = true
      try {
        // EventSource does not expose the HTTP status. A normal authenticated
        // request distinguishes an expired/revoked session from a Redis outage.
        await getUserProfile()
      } catch (error) {
        if (!disposed && (!getToken() || getToken() === token) && error instanceof ApiError && error.status === 401) {
          close()
          callbacks.current.onUnauthorized?.()
          return
        }
      } finally {
        checkingAuth = false
      }
      if (!current() || !navigator.onLine) return
      timer = setTimeout(connect, getDelay(Math.min(retryCount++, 5)))
    }

    function connect() {
      if (!current() || !navigator.onLine || sourceRef.current) return
      clearTimeout(timer)
      timer = undefined
      const base = `${window.location.origin}/api/events/stream`
      const url = `${base}?token=${encodeURIComponent(token)}`
      const es = new EventSource(url)
      sourceRef.current = es
      es.onmessage = (ev) => {
        if (!current() || sourceRef.current !== es) return
        try {
          const payload = JSON.parse(ev.data)
          if (payload && typeof payload.type === 'string') {
            callbacks.current.onEvent({ type: payload.type, data: payload.data || {} })
          }
        } catch {
          // ignore malformed
        }
      }
      es.onerror = () => {
        if (!current() || sourceRef.current !== es) return
        close()
        void retry()
      }
      es.onopen = () => {
        if (!current() || sourceRef.current !== es) return
        retryCount = 0
        // Also refresh on the first open: changes can occur between the initial
        // page request and subscription, or while its first connection is down.
        callbacks.current.onOpen?.()
      }
    }
    const online = () => { if (!checkingAuth) connect() }
    const offline = () => close()
    window.addEventListener('online', online)
    window.addEventListener('offline', offline)
    connect()
    return () => {
      disposed = true
      close()
      window.removeEventListener('online', online)
      window.removeEventListener('offline', offline)
    }
  }, [token])

  return sourceRef
}
