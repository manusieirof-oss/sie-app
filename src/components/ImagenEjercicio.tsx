'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { traerTodo } from '@/lib/paginar'
import { Ic } from '@/lib/icons'
import { figuraDe } from '@/lib/cuerpo'
import FiguraMusculos from './FiguraMusculos'

// ---------------------------------------------------------------------------
// LA IMAGEN DE UN EJERCICIO, EN CUALQUIER SITIO: su foto; si no tiene, la figura
// con sus músculos (lib/cuerpo); y si tampoco, el icono de siempre.
//
// En el taller, el torno y las sesiones el ejercicio llega como un trozo del JSON de
// la sesión (nombre, foto, id) sin sus etiquetas. Las etiquetas del catálogo se traen
// UNA vez por página y se comparten entre todas las imágenes: si cada una preguntara,
// una sesión de doce ejercicios serían doce consultas.
// ---------------------------------------------------------------------------

type Catalogo = { etiquetas: any[], deEj: Record<string, string[]> }
let pedido: Promise<Catalogo> | null = null
let listo: Catalogo | null = null

function catalogo(): Promise<Catalogo> {
  if (!pedido) pedido = (async () => {
    const [{ filas: et }, { filas: ejs }] = await Promise.all([
      traerTodo((d, h) => supabase.from('etiquetas').select('id,nombre,padre_id,categoria').order('id').range(d, h)),
      traerTodo((d, h) => supabase.from('ejercicios').select('id,etiquetas').order('id').range(d, h)),
    ])
    listo = { etiquetas: et, deEj: Object.fromEntries(ejs.map((e: any) => [e.id, e.etiquetas || []])) }
    return listo
  })()
  return pedido
}

export default function ImagenEjercicio({ src, ejercicioId, etiquetasEj, radio = 8, fondo = 'var(--bm)', icono = 26, relleno = false, alt = '' }: {
  src?: string | null, ejercicioId?: string | null, etiquetasEj?: string[],
  radio?: number, fondo?: string, icono?: number,
  /** true: ocupa todo su hueco (mosaicos). false: cuadrado a todo lo ancho. */
  relleno?: boolean, alt?: string,
}) {
  const [cat, setCat] = useState<Catalogo | null>(listo)
  useEffect(() => { if (!src && !cat) catalogo().then(setCat).catch(() => {}) }, [src]) // eslint-disable-line react-hooks/exhaustive-deps
  const caja = relleno
    // display:block hace falta: la figura va en un <span>, que en línea ignora ancho y alto
    // y se queda en 0x0 (por eso el centro del rosco salía en blanco).
    ? { position: 'relative' as const, width: '100%', height: '100%', overflow: 'hidden', borderRadius: radio, display: 'block' }
    : { position: 'relative' as const, width: '100%', aspectRatio: '1 / 1', overflow: 'hidden', borderRadius: radio, display: 'block' }
  if (src) return <img src={src} alt={alt} draggable={false} style={{ ...caja, objectFit: 'cover', display: 'block' }}/>
  const ets = etiquetasEj || (ejercicioId && cat ? cat.deEj[ejercicioId] : undefined) || []
  if (cat && figuraDe(ets, cat.etiquetas)) return <span style={caja}><FiguraMusculos etiquetasEj={ets} etiquetas={cat.etiquetas}/></span>
  return (
    <span style={{ ...caja, background: fondo, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--grl)' }}>
      <Ic name="fuerza" size={icono}/>
    </span>
  )
}
