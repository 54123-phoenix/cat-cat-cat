export interface SightingDraft {
  catId: number
  file: string
  location: string
  latitude?: number
  longitude?: number
  confidence?: number
  note?: string
}

export interface SightingReceipt { id: number; status?: string }

export function validCoordinates(value: unknown): value is { latitude: number; longitude: number } {
  if (!value || typeof value !== 'object') return false
  const point = value as { latitude?: unknown; longitude?: unknown }
  return typeof point.latitude === 'number' && Number.isFinite(point.latitude) && Math.abs(point.latitude) <= 90
    && typeof point.longitude === 'number' && Number.isFinite(point.longitude) && Math.abs(point.longitude) <= 180
}

// This is a request identity, not a credential. Keep it stable after a lost response.
function requestId() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, character => {
    const value = Math.floor(Math.random() * 16)
    return (character === 'x' ? value : (value & 3) | 8).toString(16)
  })
}

export function createSightingSubmission(
  send: (draft: SightingDraft & { client_request_id: string }) => Promise<SightingReceipt>,
  nextId: () => string = requestId,
) {
  let fingerprint = ''
  let id = ''
  let pending: Promise<SightingReceipt> | null = null
  let receipt: SightingReceipt | null = null
  return {
    submit(draft: SightingDraft): Promise<SightingReceipt> {
      if (receipt) return Promise.resolve(receipt)
      if (pending) return pending
      if (!draft.catId || !draft.file || !draft.location.trim()) return Promise.reject(new Error('请确认猫咪、照片和目击地点'))
      if (!validCoordinates(draft)) return Promise.reject(new Error('请使用当前位置或在地图上选择目击位置'))
      const fields = { ...draft, location: draft.location.trim(), note: draft.note?.trim() || undefined }
      const current = JSON.stringify(fields)
      if (current !== fingerprint) {
        fingerprint = current
        id = nextId()
      }
      pending = Promise.resolve().then(() => send({ ...fields, client_request_id: id })).then(result => {
        if (!Number.isInteger(result?.id) || result.id <= 0) throw new Error('未收到有效的记录回执，请重试确认提交结果')
        receipt = result
        return result
      }).finally(() => { pending = null })
      return pending
    },
  }
}
