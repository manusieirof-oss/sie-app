import { supabase } from './supabase'

/**
 * Borrar un paciente y todo lo que cuelga de él.
 *
 * ANTES NO BORRABA NADA Y NO LO DECÍA. La ficha llamaba a `delete` sobre `pacientes`, no
 * miraba el error y navegaba a la lista igual, así que un borrado bloqueado por una clave
 * ajena —tiene citas, tiene sesiones— se veía exactamente igual que uno correcto: el
 * paciente seguía ahí y parecía que la lista no se refrescaba.
 *
 * Se borra en cadena desde la app porque las tablas hijas no tienen `ON DELETE CASCADE`.
 * Se podría arreglar en la base, y sería mejor, pero mientras no esté hecho esto tiene que
 * funcionar y sobre todo tiene que AVISAR cuando no funciona.
 *
 * El orden importa: primero lo que apunta al paciente, el paciente al final. Si algo falla
 * por el camino se para y se dice cuál, en vez de dejar media ficha borrada sin avisar.
 */

/**
 * Tablas que guardan un `paciente_id`. Salidas de recorrer el código, no de memoria.
 *
 * Si algún día aparece una tabla nueva con `paciente_id` y no se añade aquí, el borrado
 * fallará con un error claro de clave ajena — que es justo lo que queremos que pase, en
 * vez de un borrado a medias.
 */
const TABLAS_HIJAS = [
  'alertas_paciente',
  'anotaciones_ejercicios',
  'bonos',
  'citas',
  'consentimientos',
  'deportes_paciente',
  'documentos_paciente',
  'escalas',
  'eventos_paciente',
  'medicamentos',
  'molestias',
  'notas',
  'objetivos_metas',
  'pacientes_objetivos',
  'patologias',
  'recuperaciones',
  'registros_ejercicio',
  'resultados_tests',
  'rondas_respuestas',
  'sesiones',
  'tareas',
  'valoraciones',
]

export type ResultadoBorrado =
  | { ok: true, borradas: string[] }
  | { ok: false, error: string, tabla?: string }

export async function borrarPaciente(pacienteId: string): Promise<ResultadoBorrado> {
  if (!pacienteId) return { ok: false, error: 'Falta el paciente' }

  const borradas: string[] = []

  for (const tabla of TABLAS_HIJAS) {
    const { error } = await supabase.from(tabla).delete().eq('paciente_id', pacienteId)
    if (!error) { borradas.push(tabla); continue }

    // Una tabla que no existe en esta base no es un fallo: la app ha crecido y no todas
    // las instalaciones tienen las mismas. Lo que sí es un fallo es cualquier otra cosa.
    const msg = error.message || ''
    const noExiste = /does not exist|schema cache|relation .* does not exist/i.test(msg)
    if (noExiste) continue

    return { ok: false, error: msg, tabla }
  }

  const { error } = await supabase.from('pacientes').delete().eq('id', pacienteId)
  if (error) return { ok: false, error: error.message, tabla: 'pacientes' }

  return { ok: true, borradas }
}

/**
 * Comprueba que ya no está. El `delete` de Supabase devuelve ok aunque no haya borrado
 * ninguna fila —por ejemplo si una política RLS lo impide— así que hay que mirarlo.
 */
export async function siguePaciente(pacienteId: string): Promise<boolean> {
  const { data } = await supabase.from('pacientes').select('id').eq('id', pacienteId).maybeSingle()
  return !!data
}
