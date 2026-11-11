'use client'
import BotonVista, { type OpcionVista } from './BotonVista'
import { zonasDe, subzonasEnUso, SIN_ZONA } from '@/lib/etiquetas'
import { ordenAnatomico } from '@/lib/anatomia'

/**
 * La fila de zonas. UNA SOLA, para tests, objetivos y el buscador de objetivos de dentro
 * de un test.
 *
 * Había tres, escritas por separado, y no coincidían: los tests agrupaban por la RAÍZ de
 * articulación —"Columna"— y la biblioteca de objetivos enseñaba la etiqueta tal cual se
 * puso —"Cervical"—. Las mismas etiquetas, dos vocabularios, y la sensación justificada de
 * que una de las dos pantallas estaba mal.
 *
 * RAÍCES DE ENTRADA, SUBZONAS A UN CLIC. Empezar desplegado sacaba treinta pastillas y
 * encontrar "Rodilla" costaba más que no tener filtro; no poder desplegar obligaba a
 * buscar a mano lo etiquetado en una subzona. El desplegable por raíz es el mismo patrón
 * que ya usa el filtro de etiquetas de los ejercicios.
 *
 * Elegir una RAÍZ trae también lo etiquetado por debajo de ella (lo resuelve `casaZona`),
 * así que desplegar solo hace falta para afinar, nunca para no perderse nada.
 */
export default function FiltroZonas({
  etiquetas = [], usadas, valor, onChange, nSinZona = 0, etiquetaSinZona = 'Sin zona',
  todas = 'Todas', compacto = false,
}: {
  etiquetas: any[]
  /** Ids de etiqueta de articulación que las filas usan de verdad, sin resolver a raíz. */
  usadas: string[]
  /** '' = todas · id de etiqueta · SIN_ZONA */
  valor: string
  onChange: (v: string) => void
  /** Cuántas filas no tienen ninguna zona. Con 0 no se pinta el cajón. */
  nSinZona?: number
  etiquetaSinZona?: string
  todas?: string
  /** Versión pequeña, para el buscador de objetivos de dentro de un test. */
  compacto?: boolean
}) {
  const raices = zonasDe(etiquetas, usadas)
    .sort((a: any, b: any) => ordenAnatomico(a.nombre, b.nombre))

  if (raices.length === 0 && nSinZona === 0) return null

  /* COMO BOTÓN DE LA BIBLIOTECA (BotonVista): una lista con las zonas y, debajo de cada
     una, sus subzonas en uso. Antes era una fila de pastillas que ocupaba media pantalla. */
  const opciones: OpcionVista[] = [{ k: '', t: todas }]
  raices.forEach((z: any) => {
    opciones.push({ k: z.id, t: z.nombre })
    subzonasEnUso(etiquetas, usadas, z.id).sort((a: any, b: any) => ordenAnatomico(a.nombre, b.nombre))
      .forEach((h: any) => opciones.push({ k: h.id, t: h.nombre, sub: true }))
  })
  if (nSinZona > 0) opciones.push({ k: SIN_ZONA, t: etiquetaSinZona, n: nSinZona })
  return <BotonVista opciones={opciones} valor={valor} onChange={onChange} icono="cuerpo" prefijo={compacto ? undefined : 'Zona'} lista titulo="Filtrar por zona del cuerpo"/>
}
