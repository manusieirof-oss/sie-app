// ---------------------------------------------------------------------------
// LEER UNA TABLA ENTERA SIN QUE EL SERVIDOR TE LA CORTE
//
// PostgREST recorta TODA respuesta en `max-rows` —1000 en Supabase por defecto—
// y no avisa de que ha cortado. Un `.limit(3000)` del cliente no sube ese techo:
// pides 3000, te da 1000 y parece que no había más.
//
// Eso no da un error, da un número más pequeño. Cobros decía 141 personas donde
// había 152, y Estadísticas calculaba el porcentaje de asistencia de seis meses
// sobre las tres últimas semanas. Un recuento que se queda corto en silencio es
// peor que no tenerlo: nadie lo revisa porque nadie sabe que está mal.
//
// LA CONSULTA TIENE QUE IR ORDENADA, y por algo que no se repita. Sin un orden
// estable, "las filas 1000 a 1999" no significa nada: dos páginas pueden traer
// la misma fila y saltarse otra.
// ---------------------------------------------------------------------------

type Pagina<T> = { data: T[] | null, error: { message: string } | null }

/**
 * Pide la consulta por páginas hasta que una vuelve incompleta.
 *
 * Se le pasa una función que construye la consulta con su rango, y no una
 * consulta ya hecha, porque un query de Supabase se consume al ejecutarlo: hay
 * que fabricar uno nuevo por página.
 *
 *   const { filas, error } = await traerTodo(( d, h ) =>
 *     supabase.from('citas').select('*').gte('fecha', desde).order('id').range(d, h))
 *
 * `cortado` avisa de que se alcanzó el tope y puede faltar algo. Quien llama
 * decide si eso es un fallo que enseñar o un límite razonable.
 */
export async function traerTodo<T = any>(
  construir: (desde: number, hasta: number) => PromiseLike<Pagina<T>>,
  opciones: { pagina?: number, tope?: number } = {},
): Promise<{ filas: T[], error: string | null, cortado: boolean }> {
  const pagina = opciones.pagina ?? 1000
  const tope = opciones.tope ?? 50000
  const filas: T[] = []

  for (let desde = 0; desde < tope; desde += pagina) {
    const { data, error } = await construir(desde, desde + pagina - 1)
    // Con un error a medias se devuelve lo leído y el motivo: media tabla con
    // aviso es más útil que un array vacío sin explicación.
    if (error) return { filas, error: error.message, cortado: true }
    filas.push(...((data || []) as T[]))
    if ((data?.length || 0) < pagina) return { filas, error: null, cortado: false }
  }

  return { filas, error: null, cortado: true }
}
