import { supabase } from './supabase'

// ---------------------------------------------------------------------------
// HUCHAS: QUÉ HACER CON EL DINERO QUE DEJA LA CLÍNICA
//
// El beneficio no es todo tuyo para gastar: de él sale el 130 (el IRPF que
// adelantas cada trimestre). Lo que queda después es el DINERO LIBRE, y eso
// es lo que se reparte en huchas por porcentaje.
//
// Lo que sacas para ti no es un gasto de la clínica —un autónomo no se paga
// nómina—, por eso no va en Gastos ni toca el beneficio. Se apunta aquí como
// salida de su hucha, y la hucha enseña lo que le queda.
// ---------------------------------------------------------------------------

export type Hucha = { id: string, nombre: string, pct: number, orden: number }
export type Salida = { id: string, hucha_id: string, fecha: string, importe: number, nota: string | null }

export async function cargarHuchas() {
  const [h, s] = await Promise.all([
    supabase.from('huchas').select('id,nombre,pct,orden').order('orden'),
    supabase.from('huchas_salidas').select('id,hucha_id,fecha,importe,nota').order('fecha', { ascending: false }),
  ])
  const error = h.error?.message || s.error?.message || null
  return {
    error,
    huchas: (h.data || []).map((x: any) => ({ ...x, pct: Number(x.pct) })) as Hucha[],
    salidas: (s.data || []).map((x: any) => ({ ...x, importe: Number(x.importe) })) as Salida[],
  }
}

// El `.select()` en cada escritura: sin él, una escritura bloqueada por RLS
// devuelve lo mismo que una correcta y la pantalla diría "guardado" sin serlo.
const sinFilas = 'la base de datos no ha guardado nada (suele faltar el permiso en la tabla de huchas)'

export async function guardarHucha(h: Partial<Hucha> & { nombre: string, pct: number }) {
  const fila = { nombre: h.nombre.trim(), pct: Math.round(h.pct * 100) / 100, orden: h.orden ?? 0 }
  const r = h.id
    ? await supabase.from('huchas').update(fila).eq('id', h.id).select('id')
    : await supabase.from('huchas').insert(fila).select('id')
  if (r.error) return { ok: false as const, error: r.error.message }
  if (!r.data?.length) return { ok: false as const, error: sinFilas }
  return { ok: true as const }
}

export async function borrarHucha(id: string) {
  const r = await supabase.from('huchas').delete().eq('id', id).select('id')
  if (r.error) return { ok: false as const, error: r.error.message }
  if (!r.data?.length) return { ok: false as const, error: sinFilas }
  return { ok: true as const }
}

export async function apuntarSalida(s: { hucha_id: string, fecha: string, importe: number, nota?: string }) {
  const r = await supabase.from('huchas_salidas').insert({
    hucha_id: s.hucha_id, fecha: s.fecha, importe: Math.round(s.importe * 100) / 100, nota: s.nota?.trim() || null,
  }).select('id')
  if (r.error) return { ok: false as const, error: r.error.message }
  if (!r.data?.length) return { ok: false as const, error: sinFilas }
  return { ok: true as const }
}

export async function borrarSalida(id: string) {
  const r = await supabase.from('huchas_salidas').delete().eq('id', id).select('id')
  if (r.error) return { ok: false as const, error: r.error.message }
  if (!r.data?.length) return { ok: false as const, error: sinFilas }
  return { ok: true as const }
}

/**
 * Lo que le toca a cada hucha del dinero libre y lo que le queda.
 *
 * Si el dinero libre es negativo (un periodo con pérdidas) no hay nada que
 * repartir: se reparte 0, no un número negativo. Repartir pérdidas diría
 * "te toca sacar −300 €", que no significa nada.
 */
export function repartir(libre: number, huchas: Hucha[], salidas: Salida[], desde: string, hasta: string) {
  const base = Math.max(0, libre)
  return huchas.map(h => {
    const toca = base * (h.pct / 100)
    const sacado = salidas
      .filter(s => s.hucha_id === h.id && s.fecha >= desde && s.fecha <= hasta)
      .reduce((a, s) => a + s.importe, 0)
    return { ...h, toca, sacado, queda: toca - sacado }
  })
}
