import { supabase } from './supabase'

/**
 * DE DÓNDE SALE UN OBJETIVO.
 *
 * Tres vías, y son tres cosas distintas que conviene no mezclar:
 *
 *   - LO PIDE      lo que quiere el paciente. Sale de la valoración. No hay que
 *                  demostrarlo: es suyo.
 *   - LO DICE UN TEST  hay causa. Se pasó el test apropiado y dio positivo. Si no
 *                  da positivo no hay causa, y el objetivo no se abre por aquí.
 *   - LO PONEMOS   de la programación: lo que sabemos que necesita, o lo que le
 *                  pidieron el fisio, el podólogo o un informe médico.
 *
 * Un objetivo puede tener VARIAS a la vez, y eso es información: que el paciente
 * pida ganar movilidad y que además un test la mida corta es más fuerte que
 * cualquiera de las dos por separado. Por eso se acumulan en vez de pisarse.
 *
 * `origen` sigue existiendo en la tabla como rastro de cómo se creó la fila; lo
 * que se lee en pantalla es esto.
 */

export type ViaOrigen = 'pide' | 'test' | 'plan'

export const VIAS: {
  valor: ViaOrigen, nombre: string, corto: string, ayuda: string,
  color: string, fondo: string,
  /** Los dos extremos de la esfera: el brillo de arriba y la sombra de abajo. */
  claro: string, oscuro: string,
}[] = [
  { valor: 'pide', nombre: 'Lo pide', corto: 'pide',
    ayuda: 'Lo quiere el paciente. Sale de su valoración.',
    color: '#7B4E86', fondo: '#F3ECF6', claro: '#C6A3D0', oscuro: '#432850' },
  { valor: 'test', nombre: 'Lo dice un test', corto: 'test',
    ayuda: 'Hay causa: el test apropiado dio positivo.',
    color: '#3E7179', fondo: '#EBF4F5', claro: '#A8CDD1', oscuro: '#23474D' },
  { valor: 'plan', nombre: 'Lo ponemos', corto: 'plan',
    ayuda: 'De la programación: lo que sabemos que necesita, o lo que le pidieron fuera.',
    color: '#B08A2A', fondo: '#FBF1DC', claro: '#E8D391', oscuro: '#6B5214' },
]

export const viaDe = (v: string) => VIAS.find(x => x.valor === v)

export const esVia = (v: any): v is ViaOrigen => VIAS.some(x => x.valor === v)

/** Las vías de una fila, limpias y en el orden en que se leen. */
export function viasDe(fila: any): ViaOrigen[] {
  const xs = Array.isArray(fila?.vias_origen) ? fila.vias_origen : []
  return VIAS.map(v => v.valor).filter(v => xs.includes(v))
}

/** Suma una vía sin pisar las que ya estuvieran. */
export function conVia(actuales: any, via: ViaOrigen): ViaOrigen[] {
  const xs = (Array.isArray(actuales) ? actuales : []).filter(esVia)
  return xs.includes(via) ? xs : [...xs, via]
}

/**
 * Anota que el objetivo también llega por esta vía.
 *
 * Se lee antes de escribir porque el array se acumula: un `update` a secas
 * borraría la vía por la que ya había entrado. No falla si el paciente no lo
 * lleva —quien llama no tiene por qué saberlo—.
 */
export async function marcarVia(pacienteId: string, objetivoId: string, via: ViaOrigen) {
  const { data } = await supabase.from('pacientes_objetivos')
    .select('vias_origen').eq('paciente_id', pacienteId).eq('objetivo_id', objetivoId).maybeSingle()
  if (data == null) return { ok: true as const, sinCambios: true }
  const nuevas = conVia(data.vias_origen, via)
  if (nuevas.length === (Array.isArray(data.vias_origen) ? data.vias_origen.length : 0)) {
    return { ok: true as const, sinCambios: true }
  }
  const { error } = await supabase.from('pacientes_objetivos')
    .update({ vias_origen: nuevas }).eq('paciente_id', pacienteId).eq('objetivo_id', objetivoId)
  return error ? { ok: false as const, error: error.message } : { ok: true as const }
}

/** Quita una vía. La última no se puede quitar: un objetivo sale de algún sitio. */
export async function quitarVia(pacienteId: string, objetivoId: string, via: ViaOrigen) {
  const { data } = await supabase.from('pacientes_objetivos')
    .select('vias_origen').eq('paciente_id', pacienteId).eq('objetivo_id', objetivoId).maybeSingle()
  const xs = (Array.isArray(data?.vias_origen) ? data!.vias_origen : []).filter(esVia)
  const nuevas = xs.filter((x: ViaOrigen) => x !== via)
  if (nuevas.length === 0) return { ok: false as const, error: 'Un objetivo tiene que salir de algún sitio.' }
  const { error } = await supabase.from('pacientes_objetivos')
    .update({ vias_origen: nuevas }).eq('paciente_id', pacienteId).eq('objetivo_id', objetivoId)
  return error ? { ok: false as const, error: error.message } : { ok: true as const }
}
