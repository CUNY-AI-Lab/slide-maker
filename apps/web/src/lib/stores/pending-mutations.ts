import { writable, get } from 'svelte/store'

let nextId = 0

export type MutationStatus = 'pending' | 'accepted' | 'rejected'

export interface PendingMutation {
  id: string
  messageId: string
  mutation: Record<string, unknown>
  status: MutationStatus
  summary: string
}

export const pendingMutations = writable<PendingMutation[]>([])
export const autoApply = writable<boolean>(false)

export function summarizeMutation(m: Record<string, unknown>): string {
  const action = m.action as string
  const p = (m.payload ?? {}) as Record<string, unknown>
  switch (action) {
    case 'addSlide': {
      const count = ((p.modules as unknown[]) ?? []).length
      return `Add slide (${p.layout || 'layout-split'}, ${count} modules)`
    }
    case 'removeSlide': return 'Remove slide'
    case 'addBlock': return `Add ${(p.block as Record<string, unknown>)?.type || 'module'}`
    case 'removeBlock': return 'Remove module'
    case 'updateBlock': return 'Update module'
    case 'updateSlide': return 'Update slide properties'
    case 'reorderSlides': return 'Reorder slides'
    case 'moveBlockToZone': return 'Move module to different zone'
    case 'setTheme': return 'Change theme'
    case 'applyTemplate': return 'Apply template'
    case 'updateMetadata': return 'Update deck name'
    case 'updateArtifactConfig': return `Update ${p.artifactName ?? 'artifact'} config`
    case 'searchImage': return `Search images: "${(p as any).query || 'image'}"`
    default: return action
  }
}

export function addPendingMutation(messageId: string, mutation: Record<string, unknown>): string {
  const id = `pm-${++nextId}`
  const pm: PendingMutation = {
    id,
    messageId,
    mutation,
    status: 'pending',
    summary: summarizeMutation(mutation),
  }
  pendingMutations.update((list) => [...list, pm])
  return id
}

export function acceptMutation(id: string) {
  pendingMutations.update((list) =>
    list.map((pm) => (pm.id === id ? { ...pm, status: 'accepted' as const } : pm))
  )
}

export function rejectMutation(id: string) {
  pendingMutations.update((list) =>
    list.map((pm) => (pm.id === id ? { ...pm, status: 'rejected' as const } : pm))
  )
}

/** Prune resolved mutations to prevent unbounded growth */
export function pruneResolved(keepLast = 50) {
  pendingMutations.update((list) => {
    const pending = list.filter((pm) => pm.status === 'pending')
    const resolved = list.filter((pm) => pm.status !== 'pending')
    return [...resolved.slice(-keepLast), ...pending]
  })
}
