'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'

// LAS PARTES DE LA APP QUE VE ESTE CLIENTE. Lo nuevo sale primero solo para quien está
// «en pruebas»; cuando se abre a todos, se añade a ajustes 'app_abierto'. La base lo
// comprueba igual (app_tiene): esto es solo para no enseñar botones que no van.
let cache: string[] | null = null
export function useActivas(): string[] | null {
  const [a, setA] = useState<string[] | null>(cache)
  useEffect(() => {
    if (cache) return
    supabase.rpc('app_activas').then(({ data }) => { cache = (data as string[]) || []; setA(cache) })
  }, [])
  return a
}
export const tiene = (activas: string[] | null, parte: string) => !!activas && (activas.includes('*') || activas.includes(parte))
