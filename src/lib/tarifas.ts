import { supabase } from './supabase'

// Catálogos de Ajustes → Tarifas: servicios sueltos y descuentos guardados.
//
// Único sitio que sabe leerlos y qué trae la app de fábrica. Estaba copiado en
// la pantalla de Cobros, en la lista de pacientes y en la ficha, y con eso una
// pestaña acaba enseñando cosas que las otras dos no.
//
// Los valores por defecto viven AQUÍ y no dentro del formulario de Ajustes: si
// solo estuvieran en la pantalla, se verían allí pero no en el modal de cobro
// hasta que alguien pulsara Guardar. Que es exactamente lo que pasaba.

export type Servicio  = { nombre: string, precio: number, iva: number }
export type Descuento = { nombre: string, tipo: string, valor: number }

export const SERVICIOS_POR_DEFECTO: Servicio[] = [
  { nombre: 'Valoración inicial', precio: 36, iva: 21 },
  { nombre: 'Sesión individual',  precio: 36, iva: 21 },
]

export const DESCUENTOS_POR_DEFECTO: Descuento[] = []

function parsear<T>(valor: string | undefined, porDefecto: T[]): T[] {
  if (!valor) return porDefecto
  try {
    const v = JSON.parse(valor)
    // Una lista guardada vacía es una decisión ("no quiero ninguno"), así que se
    // respeta. Solo se rellena con los de fábrica cuando no hay nada escrito.
    return Array.isArray(v) ? v : porDefecto
  } catch { return porDefecto }
}

export function tarifasDeAjustes(mapa: Record<string, string>) {
  return {
    servicios:  parsear<Servicio>(mapa.servicios_lista,  SERVICIOS_POR_DEFECTO),
    descuentos: parsear<Descuento>(mapa.descuentos_lista, DESCUENTOS_POR_DEFECTO),
  }
}

/** Lee los catálogos. Si la consulta falla lo dice: sin esto, el modal de cobro
 *  se quedaría sin atajos y parecería que no los has configurado. */
export async function cargarTarifas() {
  const { data, error } = await supabase.from('ajustes').select('clave,valor')
    .in('clave', ['servicios_lista', 'descuentos_lista'])
  if (error) {
    console.error('No se han podido leer las tarifas:', error.message)
    return { servicios: SERVICIOS_POR_DEFECTO, descuentos: DESCUENTOS_POR_DEFECTO, error: error.message }
  }
  const mapa = Object.fromEntries((data || []).map((a: any) => [a.clave, a.valor]))
  return { ...tarifasDeAjustes(mapa), error: null }
}
