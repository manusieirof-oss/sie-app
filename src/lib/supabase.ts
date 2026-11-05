import { createClient } from '@supabase/supabase-js'

// MODO PRÁCTICA (lib/practica): con esta cabecera la base solo enseña los pacientes
// inventados, y sin ella, nunca. Se lee al crear el cliente; por eso cambiar de modo
// recarga la página.
const practica = (() => { if (typeof window === 'undefined') return false; try { return localStorage.getItem('sie_practica') === '1' } catch { return false } })()

export const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  {
    global: practica ? { headers: { 'x-sie-practica': '1' } } : undefined,
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: false,
    }
  }
)
