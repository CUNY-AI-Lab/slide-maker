export const API_URL = import.meta.env.PUBLIC_API_URL ?? 'http://localhost:3001'

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

  // Decks
  listDecks: () => request<{ decks: any[] }>('/api/decks'),
  createDeck: (data: { name: string; themeId?: string }) =>
    request<{ deck: any }>('/api/decks', { method: 'POST', body: JSON.stringify(data) }),
  getDeck: (id: string) => request<{ deck: any; access: string }>(`/api/decks/${id}`),
  deleteDeck: (id: string) => request(`/api/decks/${id}`, { method: 'DELETE' }),

  // Sharing
  shareDeck: (id: string, data: { email: string; role: 'editor' | 'viewer' }) =>
    request(`/api/decks/${id}/share`, { method: 'POST', body: JSON.stringify(data) }),
  removeDeckShare: (id: string, userId: string) =>
    request(`/api/decks/${id}/share/${userId}`, { method: 'DELETE' }),
  getCollaborators: (id: string) =>
    request<{ collaborators: any[] }>(`/api/decks/${id}/collaborators`),

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

  // Chat
  getChatHistory: (deckId: string) =>
    request<{ messages: any[] }>(`/api/chat/${deckId}/history`),

  // Files
  uploadFile: async (deckId: string, file: File) => {
    const formData = new FormData()
    formData.append('file', file)
    const res = await fetch(`${API_URL}/api/decks/${deckId}/files`, {
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
  downloadImage: (url: string, deckId: string, filename?: string) =>
    request<{ file: { id: string; url: string; filename: string } }>('/api/search/download-image', {
      method: 'POST',
      body: JSON.stringify({ url, deckId, filename }),
    }),
}
