import { createContext, useContext } from 'react'
import type { StreamEvent } from './useEventStream'

export const LiveDataContext = createContext<{ revision: number; event: StreamEvent | null }>({ revision: 0, event: null })

// Local-state readers subscribe to the same revalidation as React Query readers.
// Updating a revision preserves mounted forms and their unsent input.
export function useLiveData() {
  return useContext(LiveDataContext)
}
