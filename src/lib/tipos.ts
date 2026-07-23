// Helper central para tipos de clase: icono y color coherentes en toda la app
// (Agenda, Valoración, fichas...). El color real manda desde Ajustes (tipos_clase);
// aquí solo mapeamos el icono por 'valor' y damos fallbacks.

import { isIcon } from './icons'

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
