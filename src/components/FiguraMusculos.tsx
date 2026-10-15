'use client'
import { figuraDe, urlCapa } from '@/lib/cuerpo'

/**
 * La imagen automática de un ejercicio sin foto: figura base y, encima, sus músculos
 * en amarillo (ver lib/cuerpo). Todas las capas miden lo mismo, así que se apilan
 * tal cual. Devuelve null si el ejercicio no tiene ningún músculo con capa.
 */
export default function FiguraMusculos({ etiquetasEj, etiquetas, alto = '100%' }: { etiquetasEj?: string[], etiquetas?: any[], alto?: string | number }) {
  const f = figuraDe(etiquetasEj || [], etiquetas || [])
  if (!f) return null
  return (
    <span style={{ position: 'relative', display: 'block', height: alto, aspectRatio: '360 / 640', margin: '0 auto' }}
      title="Imagen automática por sus músculos">
      <img src={urlCapa(f.vista, 'base')} alt="" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }}/>
      {f.capas.map(c => <img key={c} src={urlCapa(f.vista, c)} alt="" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }}/>)}
    </span>
  )
}
