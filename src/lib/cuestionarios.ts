import { supabase } from './supabase'

/**
 * CUESTIONARIOS. Un cuestionario es un test que se responde distinto.
 *
 * Misma tabla, mismos resultados, mismo enlace con objetivos: lo unico que
 * cambia es como se rellena un item —texto corto, una opcion, varias, si/no—
 * en vez de una casilla o una medida. Separarlo en su propia tabla habria
 * obligado a duplicar resultados, enlaces y el motor entero para que luego un
 * cuestionario y un test no pudieran convivir en la misma evaluacion.
 */

export type Formato = 'texto' | 'una' | 'varias' | 'si_no'

export const FORMATOS: { valor: Formato, nombre: string, ayuda: string }[] = [
  { valor:'si_no',  nombre:'Sí / No',          ayuda:'Dos respuestas y ninguna duda.' },
  { valor:'una',    nombre:'Elegir una',        ayuda:'Varias opciones, se marca una.' },
  { valor:'varias', nombre:'Elegir varias',     ayuda:'Varias opciones, se marcan las que sean.' },
  { valor:'texto',  nombre:'Respuesta corta',   ayuda:'Se escribe. No se puede contar ni comparar.' },
]

export type Pregunta = {
  nombre: string
  formato: Formato
  /** Solo en 'una' y 'varias'. */
  opciones?: string[]
}

export const esCuestionario = (t: any) => t?.tipo === 'cuestionario'

export const textoFormato = (f?: string) =>
  FORMATOS.find(x => x.valor === f)?.nombre || 'Sí / No'

/** Las preguntas viven en `items`, como los items de un test. */
export function preguntasDe(t: any): Pregunta[] {
  const items = Array.isArray(t?.items) ? t.items : []
  return items.map((i: any) => ({
    nombre: String(i?.nombre || ''),
    formato: (i?.formato || 'si_no') as Formato,
    opciones: Array.isArray(i?.opciones) ? i.opciones : [],
  }))
}

export async function cargarCuestionarios() {
  const { data } = await supabase.from('tests').select('*')
    .eq('tipo', 'cuestionario').order('nombre')
  return data || []
}

export async function guardarCuestionario(c: any): Promise<{ ok: boolean, id?: string, error?: string }> {
  const nombre = (c.nombre || '').trim()
  if (nombre === '') return { ok: false, error: 'Ponle un nombre.' }
  const fila = {
    nombre,
    descripcion: (c.descripcion || '').trim() || null,
    tipo: 'cuestionario',
    // Un cuestionario no tiene logica de test: no hay positivo ni negativo que
    // deducir de las respuestas. Lo que valga cada una se decide al mirarlo.
    logica: null,
    items: (c.preguntas || [])
      .filter((p: any) => (p.nombre || '').trim() !== '')
      .map((p: any) => ({
        nombre: (p.nombre || '').trim(),
        formato: p.formato || 'si_no',
        opciones: (p.formato === 'una' || p.formato === 'varias')
          ? (p.opciones || []).map((o: string) => String(o || '').trim()).filter(Boolean)
          : [],
      })),
  }
  if (c.id) {
    const { error } = await supabase.from('tests').update(fila).eq('id', c.id)
    return error ? { ok: false, error: error.message } : { ok: true, id: c.id }
  }
  const { data, error } = await supabase.from('tests').insert(fila).select('id').single()
  return error ? { ok: false, error: error.message } : { ok: true, id: data!.id }
}

export async function borrarCuestionario(id: string) {
  const { error } = await supabase.from('tests').delete().eq('id', id)
  return error ? { ok: false as const, error: error.message } : { ok: true as const }
}
