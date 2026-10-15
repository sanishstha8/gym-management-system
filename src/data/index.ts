import type { GymApi } from "./api"
import { demoApi } from "./demo/adapter"
import { createSupabaseApi } from "./supabase/adapter"

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined

/**
 * Uses Supabase when configured in `.env.local`, otherwise a browser-local
 * demo backend with seeded fictional members.
 */
export const api: GymApi = url && anonKey ? createSupabaseApi(url, anonKey) : demoApi

export type { ChangeTopic, GymApi } from "./api"
