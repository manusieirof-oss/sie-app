'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { traerTodo } from '@/lib/paginar'
import { Ic } from '@/lib/icons'
import { figuraDe, posturaDe, materialesDe, urlPostura, urlMaterial } from '@/lib/cuerpo'
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
  // Sin foto, por orden: su postura, sus músculos, su material solo, y el icono.
  // El material va además como insignia en la esquina de la postura o los músculos.
  const postura = cat ? posturaDe(ets, cat.etiquetas) : null
  const mats = cat ? materialesDe(ets, cat.etiquetas) : []
  const insignias = mats.length > 0 && (
    <span style={{ position: 'absolute', right: '5%', bottom: '5%', width: `${mats.length * 25}%`, display: 'flex', gap: '6%', zIndex: 2 }}>
      {mats.map(m => (
        <span key={m} style={{ flex: 1, aspectRatio: '1', borderRadius: '50%', background: '#fff', boxShadow: '0 1px 6px rgba(38,40,37,.18)',
          display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <img src={urlMaterial(m)} alt={m} draggable={false} style={{ width: '64%', height: '64%', objectFit: 'contain' }}/>
        </span>
      ))}
    </span>
  )
  if (postura) return (
    <span style={{ ...caja, background: '#fff' }} title="Imagen automática por su postura">
      <img src={urlPostura(postura)} alt={postura} draggable={false}
        style={{ position: 'absolute', inset: '9%', width: '82%', height: '82%', objectFit: 'contain' }}/>
      {insignias}
    </span>
  )
  if (cat && figuraDe(ets, cat.etiquetas)) return <span style={caja}><FiguraMusculos etiquetasEj={ets} etiquetas={cat.etiquetas}/>{insignias}</span>
  if (mats.length) return (
    <span style={{ ...caja, background: fondo }} title="Imagen automática por su material">
      <img src={urlMaterial(mats[0])} alt={mats[0]} draggable={false}
        style={{ position: 'absolute', inset: '24%', width: '52%', height: '52%', objectFit: 'contain', opacity: .85 }}/>
    </span>
  )
  return (
    <span style={{ ...caja, background: fondo, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--grl)' }}>
      <Ic name="fuerza" size={icono}/>
    </span>
  )
}
