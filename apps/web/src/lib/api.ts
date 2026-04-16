import { base } from '$app/paths'

export const API_URL = base

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, {
    credentials: 'include',
    headers: { 'Content-Type': 'application/json', ...options?.headers },
    ...options,
  })

  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: res.statusText }))
    throw new Error(body.error ?? `Request failed: ${res.status}`)
  }

  return res.json()
}

export const api = {
  // Auth
  register: (data: { email: string; password: string; name: string }) =>
    request('/api/auth/register', { method: 'POST', body: JSON.stringify(data) }),
  login: (data: { email: string; password: string }) =>
    request<{ user: any }>('/api/auth/login', { method: 'POST', body: JSON.stringify(data) }),
  logout: () => request('/api/auth/logout', { method: 'POST' }),
  me: () => request<{ user: any }>('/api/auth/me'),
  verify: (token: string) => request<{ message: string }>(`/api/auth/verify?token=${token}`),
  forgotPassword: (email: string) =>
    request<{ message: string }>('/api/auth/forgot-password', { method: 'POST', body: JSON.stringify({ email }) }),
  resetPassword: (data: { token: string; password: string }) =>
    request<{ message: string }>('/api/auth/reset-password', { method: 'POST', body: JSON.stringify(data) }),

  // Decks
  listDecks: () => request<{ decks: any[] }>('/api/decks'),
  createDeck: (data: { name: string; themeId?: string }) =>
    request<{ deck: any }>('/api/decks', { method: 'POST', body: JSON.stringify(data) }),
  getDeck: (id: string) => request<{ deck: any; access: string }>(`/api/decks/${id}`),
  deleteDeck: (id: string) => request(`/api/decks/${id}`, { method: 'DELETE' }),

  // Sharing
  searchUsers: (q: string) =>
    request<{ users: { id: string; name: string; email: string }[] }>(`/api/decks/users/search?q=${encodeURIComponent(q)}`),
  shareDeck: (id: string, data: { email: string; role: 'editor' | 'viewer' }) =>
    request(`/api/decks/${id}/share`, { method: 'POST', body: JSON.stringify(data) }),
  removeDeckShare: (id: string, userId: string) =>
    request(`/api/decks/${id}/share/${userId}`, { method: 'DELETE' }),
  getCollaborators: (id: string) =>
    request<{ collaborators: any[] }>(`/api/decks/${id}/collaborators`),

  // Presence
  updatePresence: (deckId: string, activeSlideId: string | null) =>
    request<{ presences: any[] }>('/api/decks/' + deckId + '/presence', { method: 'POST', body: JSON.stringify({ activeSlideId }) }),
  getPresence: (deckId: string) =>
    request<{ presences: any[] }>('/api/decks/' + deckId + '/presence'),
  deletePresence: (deckId: string) =>
    request('/api/decks/' + deckId + '/presence', { method: 'DELETE' }),

  // Locking
  acquireLock: async (id: string): Promise<{ locked: boolean; by?: string; lockedBy?: { name: string; since: string } }> => {
    const res = await fetch(`${API_URL}/api/decks/${id}/lock`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
    })
    // 409 is an expected response (locked by someone else), not an error
    if (res.ok || res.status === 409) {
      return res.json()
    }
    const body = await res.json().catch(() => ({ error: res.statusText }))
    throw new Error(body.error ?? `Request failed: ${res.status}`)
  },
  releaseLock: (id: string) =>
    request(`/api/decks/${id}/lock`, { method: 'DELETE' }),
  refreshLock: (id: string) =>
    request(`/api/decks/${id}/lock/heartbeat`, { method: 'POST' }),

  // Admin
  listUsers: (status?: string) =>
    request<{ users: any[] }>(`/api/admin/users${status ? `?status=${status}` : ''}`),
  approveUser: (id: string) => request(`/api/admin/users/${id}/approve`, { method: 'POST' }),
  rejectUser: (id: string) => request(`/api/admin/users/${id}/reject`, { method: 'POST' }),
  listAllUsers: () => request<{ users: any[]; stats: any }>('/api/admin/users/all'),
  updateUser: (id: string, data: any) => request(`/api/admin/users/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  getUserUsage: (id: string) => request<any>(`/api/admin/users/${id}/usage`),
  adminResetPassword: (id: string) =>
    request<{ message: string }>(`/api/admin/users/${id}/reset-password`, { method: 'POST' }),

  // Chat
  getChatHistory: (deckId: string) =>
    request<{ messages: any[] }>(`/api/chat/${deckId}/history`),
  resetChatHistory: (deckId: string) =>
    request<{ ok: true }>(`/api/chat/${deckId}/history`, {
      method: 'DELETE',
      body: JSON.stringify({ confirm: deckId }),
    }),

  // Files
  uploadFile: async (deckId: string, file: File) => {
    const formData = new FormData()
    formData.append('file', file)
    const url = `${API_URL}/api/decks/${deckId}/files`
    const res = await fetch(url, {
      method: 'POST',
      credentials: 'include',
      body: formData,
      // NO Content-Type header — browser sets it with boundary for multipart
    })
    if (!res.ok) {
      const body = await res.json().catch(() => ({ error: res.statusText }))
      throw new Error(body.error ?? 'Upload failed')
    }
    return res.json()
  },
  listFiles: (deckId: string) =>
    request<{ files: any[] }>(`/api/decks/${deckId}/files`),
  deleteFile: (deckId: string, fileId: string) =>
    request(`/api/decks/${deckId}/files/${fileId}`, { method: 'DELETE' }),

  // Search
  webSearch: (query: string) =>
    request<{ answer?: string; results: any[]; images: string[] }>('/api/search', {
      method: 'POST',
      body: JSON.stringify({ query }),
    }),
  searchImages: (query: string, perPage?: number) =>
    request<{ images: { id: number; url: string; thumbnail: string; alt: string; photographer: string; pexelsUrl: string }[] }>(
      '/api/search/images',
      { method: 'POST', body: JSON.stringify({ query, perPage }) },
    ),
  downloadImage: (url: string, deckId: string, filename?: string) =>
    request<{ file: { id: string; url: string; filename: string } }>('/api/search/download-image', {
      method: 'POST',
      body: JSON.stringify({ url, deckId, filename }),
    }),
  saveChatMessages: (deckId: string, messages: { role: string; content: string }[]) =>
    request<{ ok: true }>(`/api/chat/${deckId}/messages`, {
      method: 'POST',
      body: JSON.stringify({ messages }),
    }),

  // Plan
  planDeck: (deckId: string, fileId: string, fidelity: string, modelId: string, slideRange?: { min: number; max: number }) =>
    request<{ plan: any; warnings?: string[]; hasExistingSlides: boolean }>(`/api/decks/${deckId}/plan`, {
      method: 'POST',
      body: JSON.stringify({ fileId, fidelity, modelId, slideRange }),
    }),
  applyPlan: (deckId: string, plan: any) =>
    request<{ slides: any[] }>(`/api/decks/${deckId}/plan/apply`, {
      method: 'POST',
      body: JSON.stringify({ plan }),
    }),

  // Debug
  listTranscripts: (params?: { limit?: number; deck?: string; model?: string }) => {
    const q = new URLSearchParams()
    if (params?.limit) q.set('limit', String(params.limit))
    if (params?.deck) q.set('deck', params.deck)
    if (params?.model) q.set('model', params.model)
    const qs = q.toString()
    return request<{ transcripts: any[] }>(`/api/debug/transcripts${qs ? `?${qs}` : ''}`)
  },
  clearTranscripts: () => request<{ ok: true }>(`/api/debug/transcripts`, { method: 'DELETE' }),
}
