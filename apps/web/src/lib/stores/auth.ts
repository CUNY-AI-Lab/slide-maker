import { writable } from 'svelte/store'
import { api } from '$lib/api'

export interface AuthUser {
  id: string
  email: string
  name: string
  role: string
  authentication?: 'institutional' | 'local'
}

export const currentUser = writable<AuthUser | null>(null)
export const authLoading = writable(true)

export async function checkAuth(): Promise<AuthUser | null> {
  try {
    const { user } = await api.me()
    currentUser.set(user)
    return user
  } catch {
    currentUser.set(null)
    return null
  } finally {
    authLoading.set(false)
  }
}
