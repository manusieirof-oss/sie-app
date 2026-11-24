'use client'
import { useEffect, useRef } from 'react'

// ---------------------------------------------------------------------------
// LA PARTE SE RECOGE SOLA AL ACABARLA. Cuando todos sus ejercicios están hechos (todas
// sus series apuntadas) o marcados «No lo hizo», la parte se pliega a los 0,7 s, para
// que quede a la vista lo que falta. Solo una vez: si se vuelve a abrir a mano, no se
// cierra otra vez sola; si se desmarca algo y se vuelve a acabar, sí.
// ---------------------------------------------------------------------------

export type GrupoPlegar = { datos: any[], nh: number[], clave: (ei: number, parte: string) => string }

const serieHecha = (e: any, si: number) => Object.keys(e?.hoy || {}).some(k => k.startsWith(si + '.'))
const ejAcabado = (e: any, ei: number, nh: number[]) =>
  nh.includes(ei) || (e.series || []).length === 0 || (e.series || []).every((_: any, si: number) => serieHecha(e, si))
const ejMarcado = (e: any, ei: number, nh: number[]) =>
  nh.includes(ei) || ((e.series || []).length > 0 && (e.series || []).every((_: any, si: number) => serieHecha(e, si)))

/** Las partes acabadas y las que no, por su clave. */
function estado(grupos: GrupoPlegar[]) {
  const acabadas: string[] = [], sin: string[] = []
  grupos.forEach(({ datos, nh, clave }) => {
    const partes: Record<string, { ok: boolean, algo: boolean }> = {}
    let primera = -1, ant: string | null = null
    datos.forEach((e, ei) => {
      const parte = e?.parte || ''
      if (parte !== ant) { primera = ei; ant = parte }
      if (!parte) return
      const k = clave(primera, parte)
      const x = partes[k] ||= { ok: true, algo: false }
      if (!ejAcabado(e, ei, nh)) x.ok = false
      if (ejMarcado(e, ei, nh)) x.algo = true
    })
    Object.entries(partes).forEach(([k, x]) => (x.ok && x.algo ? acabadas : sin).push(k))
  })
  return { acabadas, sin }
}

export function usePlegarAcabadas(grupos: GrupoPlegar[], plegadas: Set<string>, alternar: (k: string) => void) {
  const ya = useRef<Set<string>>(new Set())
  const pl = useRef(plegadas); pl.current = plegadas
  const alt = useRef(alternar); alt.current = alternar
  const { acabadas, sin } = estado(grupos)
  const firma = acabadas.join(',') + '|' + sin.join(',')
  useEffect(() => {
    sin.forEach(k => ya.current.delete(k))
    const nuevas = acabadas.filter(k => !ya.current.has(k))
    if (!nuevas.length) return
    const t = setTimeout(() => nuevas.forEach(k => {
      ya.current.add(k)
      if (!pl.current.has(k)) alt.current(k)
    }), 700)
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [firma])
}
