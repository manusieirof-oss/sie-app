import { supabase } from '@/lib/supabase'

// VALD (DynaMo) desde la pantalla. Las llamadas pasan SIEMPRE por /api/vald: las
// claves de VALD no salen del servidor. Ver src/app/api/vald/route.ts.

export async function llamarVald(accion: 'perfiles' | 'crear' | 'sincronizar', extra: Record<string, any> = {}) {
  const { data: { session } } = await supabase.auth.getSession()
  const r = await fetch('/api/vald', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session?.access_token || ''}` },
    body: JSON.stringify({ accion, ...extra }),
  })
  const j = await r.json().catch(() => ({}))
  if (!r.ok) throw new Error(j.error || `Error ${r.status}`)
  return j
}

/** Sincroniza hasta el final: el servidor corta por tiempo y dice si quedan. */
export async function sincronizarVald(): Promise<number> {
  let total = 0
  for (let i = 0; i < 20; i++) {
    const { traidos, quedan } = await llamarVald('sincronizar')
    total += traidos || 0
    if (!quedan) break
  }
  return total
}

// ---------------------------------------------------------------------------
// EMPAREJAR: qué perfil de VALD es este paciente. Se puntúa nombre, apellidos y
// fecha de nacimiento; la fecha pesa más porque es lo que separa a dos "María
// García". No se enlaza solo: la ficha propone y tú confirmas.
// ---------------------------------------------------------------------------
const norm = (s: string) => (s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z ]/g, ' ').replace(/\s+/g, ' ').trim()
const palabras = (s: string) => norm(s).split(' ').filter(w => w.length > 1)
const comunes = (a: string, b: string) => { const B = new Set(palabras(b)); return palabras(a).filter(w => B.has(w)).length }

export interface PerfilVald { profileId: string, syncId: string | null, externalId: string | null, givenName: string, familyName: string, dateOfBirth: string | null }

export function puntuarPerfil(p: PerfilVald, pac: any): number {
  // El que ya trae el id de SIE (creado desde aquí) es seguro.
  if (p.syncId === pac.id || p.externalId === pac.id) return 100
  let s = 0
  if (comunes(p.givenName, pac.nombre || '') > 0) s += 25
  const ap = comunes(p.familyName, pac.apellidos || '')
  s += Math.min(ap, 2) * 15
  if (p.dateOfBirth && pac.fecha_nacimiento && p.dateOfBirth === String(pac.fecha_nacimiento).slice(0, 10)) s += 40
  return s
}

export function candidatos(perfiles: PerfilVald[], pac: any, n = 3) {
  return perfiles.map(p => ({ p, s: puntuarPerfil(p, pac) })).filter(x => x.s >= 40).sort((a, b) => b.s - a.s).slice(0, n)
}

// ---------------------------------------------------------------------------
// NOMBRES EN CASTELLANO. VALD los manda en inglés y pegados ("InternalRotation").
// Lo que no está en la lista se separa por mayúsculas, que al menos se lee.
// ---------------------------------------------------------------------------
const ES: Record<string, string> = {
  knee: 'Rodilla', hip: 'Cadera', shoulder: 'Hombro', ankle: 'Tobillo', elbow: 'Codo', wrist: 'Muñeca',
  neck: 'Cervical', cervical: 'Cervical', cervicalspine: 'Cervical', trunk: 'Tronco', lumbar: 'Lumbar', lumbarspine: 'Lumbar', thoracic: 'Dorsal',
  hand: 'Mano', fingers: 'Dedos', finger: 'Dedo', thumb: 'Pulgar', toe: 'Dedos del pie', toes: 'Dedos del pie', foot: 'Pie', grip: 'Agarre',
  flexion: 'Flexión', extension: 'Extensión', abduction: 'Abducción', adduction: 'Aducción',
  internalrotation: 'Rotación interna', externalrotation: 'Rotación externa', rotation: 'Rotación',
  dorsiflexion: 'Dorsiflexión', plantarflexion: 'Flexión plantar', inversion: 'Inversión', eversion: 'Eversión',
  lateralflexion: 'Flexión lateral', horizontalabduction: 'Abducción horizontal', horizontaladduction: 'Aducción horizontal',
  pronation: 'Pronación', supination: 'Supinación', radialdeviation: 'Desviación radial', ulnardeviation: 'Desviación cubital',
  seated: 'Sentado', supine: 'Supino', prone: 'Prono', standing: 'De pie', sidelying: 'Decúbito lateral', kneeling: 'De rodillas', halfkneeling: 'Semiarrodillado',
  rangeofmotion: 'Rango de movimiento', strength: 'Fuerza',
  left: 'Izq.', leftside: 'Izq.', right: 'Der.', rightside: 'Der.',
}
export function esVald(s: string | null | undefined): string {
  if (!s) return ''
  const k = String(s).toLowerCase().replace(/[^a-z]/g, '')
  if (ES[k]) return ES[k]
  return String(s).replace(/([a-z])([A-Z])/g, '$1 $2')
}
export const lado = (l: string | null | undefined): 'I' | 'D' | null => {
  const k = String(l || '').toLowerCase()
  return k.startsWith('left') ? 'I' : k.startsWith('right') ? 'D' : null
}
export const esRango = (cat: string | null | undefined) => /range|motion|rom/i.test(cat || '')
