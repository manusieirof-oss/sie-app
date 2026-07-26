// Helper central para tipos de clase: icono y color coherentes en toda la app
// (Agenda, Valoración, fichas...). El color real manda desde Ajustes (tipos_clase);
// aquí solo mapeamos el icono por 'valor' y damos fallbacks.

import { isIcon } from './icons'
import { supabase } from './supabase'

export type TipoClase = {
  valor: string
  nombre: string
  icono?: string
  color: string
  duracion: number
}

// FUENTE ÚNICA DE VERDAD del fallback. Antes cada pantalla tenía su propia lista
// hardcodeada y no coincidían (unas con 'mayores', otras no; Pilates de dos colores
// distintos). Si tocas esto, lo tocas para toda la app.
// Manda siempre ajustes.tipos_clase: esto solo se usa si esa fila no existe o falla.
export const TIPOS_CLASE_FALLBACK: TipoClase[] = [
  { valor:'entrenamiento',  nombre:'Entrenamiento',  icono:'', color:'#5A969E', duracion:50 },
  { valor:'pilates',        nombre:'Pilates',        icono:'', color:'#7EA98F', duracion:50 },
  { valor:'rehabilitacion', nombre:'Rehabilitación', icono:'', color:'#C9A84C', duracion:50 },
  { valor:'individual',     nombre:'Individual',     icono:'', color:'#6E7CA8', duracion:50 },
  { valor:'embarazadas',    nombre:'Embarazadas',    icono:'', color:'#C486A0', duracion:50 },
  { valor:'mayores',        nombre:'Mayores',        icono:'', color:'#C08457', duracion:50 },
]

// Parsea el valor crudo de ajustes.tipos_clase, cayendo al fallback si viene vacío o roto.
export function parseTiposClase(valor?: string | null): TipoClase[] {
  if (!valor) return TIPOS_CLASE_FALLBACK
  try {
    const p = JSON.parse(valor)
    return Array.isArray(p) && p.length > 0 ? p : TIPOS_CLASE_FALLBACK
  } catch {
    return TIPOS_CLASE_FALLBACK
  }
}

// Carga los tipos de clase para pantallas que no leen la tabla ajustes entera.
export async function cargarTiposClase(): Promise<TipoClase[]> {
  const { data } = await supabase.from('ajustes').select('valor').eq('clave','tipos_clase').maybeSingle()
  return parseTiposClase(data?.valor)
}

// ---- VÍAS DE CAPTACIÓN (cómo nos conoció) --------------------------------
// OJO: este campo guarda el TEXTO, no un código. Si dos pantallas ofrecen
// cadenas distintas para la misma vía, en Estadísticas salen como barras
// separadas. Por eso la lista vive aquí y nadie la escribe a mano.
export const VIAS_CAPTACION_FALLBACK: string[] = [
  'Recomendación de un conocido', 'Instagram', 'Google', 'Facebook', 'Pasó por aquí', 'Otro',
]

// Parser genérico para las listas de Ajustes que son un array de textos.
export function parseListaSimple(valor: string | null | undefined, fallback: string[]): string[] {
  if (!valor) return fallback
  try {
    const p = JSON.parse(valor)
    return Array.isArray(p) && p.length > 0 ? p : fallback
  } catch {
    return fallback
  }
}

export async function cargarViasCaptacion(): Promise<string[]> {
  const { data } = await supabase.from('ajustes').select('valor').eq('clave','como_nos_conocio').maybeSingle()
  return parseListaSimple(data?.valor, VIAS_CAPTACION_FALLBACK)
}

export const ICON_TIPO_CLASE: Record<string, string> = {
  entrenamiento: 'rayo',
  pilates: 'pilates',
  rehabilitacion: 'rehab',
  individual: 'usuario',
  embarazadas: 'bebe',
  mayores: 'plantillas',
}

// Iconos disponibles para elegir al crear/editar un tipo de clase en Ajustes.
export const ICON_OPCIONES: { name: string; label: string }[] = [
  { name: 'rayo', label: 'Rayo' },
  { name: 'entreno', label: 'Mancuerna' },
  { name: 'fuerza', label: 'Pesas' },
  { name: 'pilates', label: 'Flor' },
  { name: 'rehab', label: 'Pulso' },
  { name: 'patologia', label: 'Fonendo' },
  { name: 'usuario', label: 'Persona' },
  { name: 'pacientes', label: 'Personas' },
  { name: 'bebe', label: 'Bebé' },
  { name: 'plantillas', label: 'Pisadas' },
  { name: 'deporte', label: 'Actividad' },
  { name: 'salud', label: 'Corazón' },
  { name: 'agua', label: 'Gota' },
  { name: 'estrella', label: 'Estrella' },
  { name: 'objetivo', label: 'Diana' },
  { name: 'etiqueta', label: 'Etiqueta' },
]

// Prioriza el icono guardado en el tipo (si es válido); si no, el del mapa por 'valor'.
export const iconTipoClase = (valor: string, icono?: string) =>
  isIcon(icono) ? (icono as string) : (ICON_TIPO_CLASE[valor] || 'etiqueta')

export const colorTipoClase = (tipos: any[] | undefined, valor: string) =>
  (tipos?.find((x: any) => x.valor === valor)?.color) || '#5A969E'

export const nombreTipoClase = (tipos: any[] | undefined, valor: string) =>
  (tipos?.find((x: any) => x.valor === valor)?.nombre) ||
  (valor ? valor.charAt(0).toUpperCase() + valor.slice(1) : 'Clase')
