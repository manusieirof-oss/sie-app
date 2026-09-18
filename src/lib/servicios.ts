import { supabase } from './supabase'

// ---------------------------------------------------------------------------
// EL CATALOGO DE LO QUE VENDES
//
// Vivia partido en dos sitios que no se hablaban: `bonos_tipos` (una tabla, con
// los bonos) y `ajustes.servicios_lista` (un JSON, con las tarifas sueltas y el
// precio metido dentro). Resultado: Finanzas controlaba la mitad de tus precios
// y la otra mitad se editaba en Ajustes sin que Finanzas se enterara.
//
// Ahora hay un catalogo, `bonos_tipos`, y los precios estan todos en `planes`.
//
// DOS EJES QUE NO SE MEZCLAN:
//
//   modalidad → COMO se vende. Decide el comportamiento, y por eso es una lista
//               cerrada: cada valor se comporta distinto en el codigo.
//   categoria → QUE es. Solo agrupa y filtra, asi que es una lista abierta:
//               anadir "Online" manana tiene que ser escribir la palabra.
//
// Meter los dos en el mismo campo es el error que teniamos. Un entreno online
// puede ser mensual o de sesiones: son preguntas distintas.
//
// MODALIDAD vive en lib/bonoSesiones, junto al codigo que la obedece. Aqui solo
// esta la categoria: si estuviera en los dos sitios, volveriamos a empezar.
// ---------------------------------------------------------------------------

// Todo lo que existe hoy es presencial. Lo demas lo anades tu.
export const CATEGORIAS_POR_DEFECTO = ['Presencial']

export const CLAVE_CATEGORIAS = 'categorias_servicio'

/** Las categorias que hay definidas. Si falla la lectura se dice, no se finge. */
export async function cargarCategorias(): Promise<{ categorias: string[], error: string | null }> {
  const { data, error } = await supabase.from('ajustes')
    .select('valor').eq('clave', CLAVE_CATEGORIAS).maybeSingle()
  if (error) {
    console.error('No se han podido leer las categorias:', error.message)
    return { categorias: CATEGORIAS_POR_DEFECTO, error: error.message }
  }
  return { categorias: parsearCategorias(data?.valor), error: null }
}

/** Una lista guardada vacia es una decision; solo se rellena si no hay nada escrito. */
export function parsearCategorias(valor?: string | null): string[] {
  if (!valor) return CATEGORIAS_POR_DEFECTO
  try {
    const v = JSON.parse(valor)
    return Array.isArray(v) ? v.filter(x => typeof x === 'string') : CATEGORIAS_POR_DEFECTO
  } catch { return CATEGORIAS_POR_DEFECTO }
}
