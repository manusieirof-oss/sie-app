import { supabase } from './supabase'
import { hoyISO } from '@/lib/fechas'

/**
 * Las listas clínicas del paciente: alergias, intolerancias y operaciones. UN SOLO SITIO.
 *
 * Las tres tienen la misma forma —una fila por entrada, con su nombre— y las tres se
 * gestionan desde dos pantallas distintas: la valoración y la pestaña Salud. Ese es
 * justo el reparto que ya salió mal:
 *
 *  - **La valoración no escribía en las tablas.** Metía las alergias dentro del JSON
 *    `estado_general` de `valoraciones` y ahí se quedaban. `alergias_paciente` existe
 *    desde el principio y es lo que lee Salud, así que una alergia apuntada en la
 *    valoración inicial no aparecía en la ficha. Guardada, pero donde nadie mira.
 *  - **Las operaciones no tenían tabla siquiera** (ver `sql/operaciones_paciente.sql`):
 *    solo existían dentro de ese JSON, sin forma de verlas ni de darlas de baja.
 *
 * Una alergia es del PACIENTE, no de la valoración en la que se apuntó. Guardarla dentro
 * de un acto fechado es el mismo error que guardar el valor actual de una meta: en cuanto
 * hay dos valoraciones hay dos verdades, y la vieja no se corrige nunca.
 *
 * Mismo patrón que `lib/tests.ts` y `lib/alertas.ts`: la fila y su evento se escriben en
 * la misma función, para que no se pueda hacer una sin la otra.
 */

const hoy = () => hoyISO()

export type ListaClinica = 'alergias' | 'intolerancias' | 'operaciones'

const CONFIG: Record<ListaClinica, { tabla: string; tipo: string; etiqueta: string }> = {
  alergias:      { tabla: 'alergias_paciente',      tipo: 'alergia',      etiqueta: 'Alergia' },
  intolerancias: { tabla: 'intolerancias_paciente', tipo: 'intolerancia', etiqueta: 'Intolerancia' },
  operaciones:   { tabla: 'operaciones_paciente',   tipo: 'operacion',    etiqueta: 'Operación' },
}

/** Una entrada. Solo el nombre es obligatorio; el resto lo usan las operaciones. */
export type EntradaLista = {
  nombre: string
  anio?: string | null
  lado?: string | null
  observaciones?: string | null
  tiene_informe?: boolean
  /**
   * De qué fila de la BIBLIOTECA salió. Solo la guardan las operaciones.
   *
   * Hasta ahora la biblioteca se usaba como ayuda para escribir y después se olvidaba que
   * había existido: se copiaba el nombre y no quedaba ningún enlace. Con eso, relacionar
   * una operación del paciente con cualquier otra cosa —un test indicado, una precaución—
   * obliga a comparar textos, y los textos se separan solos: se renombra la entrada de la
   * biblioteca, o se teclea una variante a mano, y deja de casar sin que nada avise.
   *
   * Lo escrito a mano se queda sin id a propósito. No es un hueco a rellenar: es el dato
   * de que esa entrada no está en la biblioteca, y por eso no puede relacionarse con nada.
   */
  biblioteca_id?: string | null
}

export type ResultadoLista = { ok: true; anadidas: number; repetidas: string[] } | { ok: false; error: string }

/** Lo que ya consta. Vacío si la tabla todavía no existe. */
export async function leerLista(pacienteId: string, lista: ListaClinica): Promise<any[]> {
  if (!pacienteId) return []
  const { data, error } = await supabase.from(CONFIG[lista].tabla)
    .select('*').eq('paciente_id', pacienteId).order('created_at', { ascending: false })
  if (error) return []
  return data || []
}

/**
 * Añade lo que falte y deja un evento por cada una.
 *
 * NO PISA NI DUPLICA: lo que ya consta con el mismo nombre se devuelve en `repetidas` y
 * no se toca. Es la misma regla que los sembradores —rellenar huecos, nunca deshacer
 * trabajo hecho— y aquí importa el doble, porque la revaloración vuelve a pasar por el
 * mismo formulario que la inicial.
 */
export async function anadirALista(
  pacienteId: string, lista: ListaClinica, entradas: (EntradaLista | string)[],
): Promise<ResultadoLista> {
  if (!pacienteId) return { ok: false, error: 'Falta el paciente' }
  const cfg = CONFIG[lista]
  const limpias = (entradas || [])
    .map(e => typeof e === 'string' ? { nombre: e } : e)
    .filter(e => e && e.nombre && String(e.nombre).trim())
  if (limpias.length === 0) return { ok: true, anadidas: 0, repetidas: [] }

  const existentes = await leerLista(pacienteId, lista)
  const yaEsta = new Set(existentes.map((x: any) => String(x.nombre || '').trim().toLowerCase()))

  const repetidas: string[] = []
  let anadidas = 0
  for (const e of limpias) {
    const nombre = String(e.nombre).trim()
    if (yaEsta.has(nombre.toLowerCase())) { repetidas.push(nombre); continue }
    // Se marca ya como vista, por si la misma entrada viene dos veces en la misma tanda.
    yaEsta.add(nombre.toLowerCase())

    const fila: any = { paciente_id: pacienteId, nombre }
    // Las columnas de más solo existen en operaciones. Mandarlas vacías a las otras dos
    // tablas daría error de columna desconocida, así que se añaden solo si vienen.
    if (lista === 'operaciones') {
      // Solo aquí: `alergias_paciente` e `intolerancias_paciente` no tienen la columna, y
      // mandarla daría error de columna desconocida. Si algún día se relacionan también,
      // se añade allí y se saca esta línea del `if`.
      if (e.biblioteca_id) fila.biblioteca_id = e.biblioteca_id
      if (e.anio) fila.anio = e.anio
      if (e.lado && e.lado !== 'no_aplica') fila.lado = e.lado
      if (e.observaciones) fila.observaciones = e.observaciones
      if (e.tiene_informe) fila.tiene_informe = true
    } else if (e.observaciones) {
      fila.observaciones = e.observaciones
    }

    const { error } = await supabase.from(cfg.tabla).insert(fila)
    if (error) return { ok: false, error: error.message }
    anadidas++

    const detalle = [e.anio || null, e.lado && e.lado !== 'no_aplica' ? e.lado : null].filter(Boolean).join(' · ')
    await supabase.from('eventos_paciente').insert({
      paciente_id: pacienteId, tipo: cfg.tipo,
      titulo: `${cfg.etiqueta}: ${nombre}${detalle ? ' · ' + detalle : ''}`,
      descripcion: e.observaciones || null,
      fecha: hoy(),
    })
  }
  return { ok: true, anadidas, repetidas }
}

/**
 * Quita la fila y deja el evento.
 *
 * La fila se borra pero el evento queda, igual que con la medicación: que el paciente
 * constara alérgico durante dos años es historia clínica y no puede evaporarse porque
 * hoy se corrija.
 */
export async function quitarDeLista(
  pacienteId: string, lista: ListaClinica, filaId: string, nombre: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const cfg = CONFIG[lista]
  const { error } = await supabase.from(cfg.tabla).delete().eq('id', filaId)
  if (error) return { ok: false, error: error.message }
  await supabase.from('eventos_paciente').insert({
    paciente_id: pacienteId, tipo: cfg.tipo,
    titulo: `Deja de constar ${cfg.etiqueta.toLowerCase()}: ${nombre}`,
    fecha: hoy(),
  })
  return { ok: true }
}
