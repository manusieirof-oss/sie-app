import { supabase } from './supabase'
import { conDescendientes } from './etiquetas'

/**
 * Qué tiene contraindicado un paciente por sus tests positivos.
 *
 * `tests.etiquetas_bloquea` existe desde el primer día y no la leía nadie. La idea era
 * clara: un test positivo desaconseja ciertas etiquetas de ejercicio. Sin esto, nada
 * impedía meter en una sesión un ejercicio contraindicado por un test de la semana pasada.
 *
 * AVISA, NO BLOQUEA. Impedir el ejercicio es tentador y probablemente equivocado: hay
 * motivos para prescribirlo igual —carga baja, rango parcial, trabajo isométrico— y un
 * bloqueo duro se acaba esquivando por fuera de la app, que es peor porque entonces no
 * queda registrado. El aviso dice qué test, de qué fecha y por qué, y decide el
 * entrenador.
 *
 * UN NEGATIVO POSTERIOR LO LEVANTA. Se mira el resultado MÁS RECIENTE de cada test y lado:
 * si el último es negativo, el positivo de marzo ya no contraindica nada. Sin esta regla,
 * un paciente acumularía contraindicaciones para siempre y a los seis meses el aviso
 * saldría en todo y se dejaría de leer.
 */

export type Contraindicacion = {
  /** Etiqueta desaconsejada, y todas sus descendientes. */
  etiqueta_id: string
  test: string
  fecha: string
  lado: string
}

/** Lo que un paciente tiene desaconsejado ahora mismo, por etiqueta. */
export async function contraindicacionesDe(pacienteId: string): Promise<Record<string, Contraindicacion>> {
  if (!pacienteId) return {}

  const [{ data: resultados }, { data: tests }, { data: etiquetas }] = await Promise.all([
    supabase.from('resultados_tests').select('test_id,lado,fecha,resultado')
      .eq('paciente_id', pacienteId).order('fecha', { ascending: false }),
    supabase.from('tests').select('id,nombre,etiquetas_bloquea'),
    supabase.from('etiquetas').select('id,padre_id'),
  ])

  const porTest: Record<string, any> = {}
  ;(tests || []).forEach((t: any) => { porTest[t.id] = t })

  // El más reciente de cada test+lado manda. Vienen ordenados por fecha descendente, así
  // que el primero de cada pareja es el que cuenta.
  const ultimo: Record<string, any> = {}
  ;(resultados || []).forEach((r: any) => {
    const clave = `${r.test_id}·${r.lado || 'bilateral'}`
    if (!ultimo[clave]) ultimo[clave] = r
  })

  const salida: Record<string, Contraindicacion> = {}
  for (const r of Object.values(ultimo) as any[]) {
    if (r.resultado !== 'positivo') continue
    const t = porTest[r.test_id]
    const bloquea: string[] = t?.etiquetas_bloquea || []
    if (bloquea.length === 0) continue

    for (const id of bloquea) {
      // Con descendientes: bloquear "Hombro" tiene que alcanzar a "Manguito rotador".
      // Si no, habría que enumerar cada subetiqueta y la primera que se añadiera al árbol
      // se quedaría fuera sin que nadie lo notara.
      for (const hijo of conDescendientes(etiquetas || [], id)) {
        if (!salida[hijo]) {
          salida[hijo] = { etiqueta_id: hijo, test: t?.nombre || 'Test', fecha: r.fecha, lado: r.lado || 'bilateral' }
        }
      }
    }
  }
  return salida
}

/**
 * Qué desaconseja un ejercicio concreto, o null si nada.
 *
 * Devuelve el primer motivo y cuántos más hay: enumerar cuatro etiquetas en un aviso hace
 * que no se lea ninguna. Lo que decide es "este ejercicio está desaconsejado y por qué
 * test", no la lista completa.
 */
export function motivoDe(ejercicio: any, contra: Record<string, Contraindicacion>, etiquetas: any[]) {
  const ids: string[] = ejercicio?.etiquetas || []
  const encontrados = ids.map(id => contra[id]).filter(Boolean)
  if (encontrados.length === 0) return null
  const c = encontrados[0]
  const nombre = etiquetas.find((e: any) => e.id === c.etiqueta_id)?.nombre || 'una etiqueta'
  return {
    ...c, nombre, otros: encontrados.length - 1,
    texto: `${nombre} · ${c.test}${c.lado !== 'bilateral' ? ' (' + c.lado + ')' : ''}`,
  }
}
