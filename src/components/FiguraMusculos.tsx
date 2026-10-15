'use client'
import { figuraDe, urlCapa, encuadre } from '@/lib/cuerpo'

/**
 * La imagen automática de un ejercicio sin foto: figura base y, encima, sus músculos
 * en amarillo (ver lib/cuerpo). Todas las capas miden lo mismo, así que se apilan
 * tal cual. Devuelve null si el ejercicio no tiene ningún músculo con capa.
 *
 * Llena su hueco cuadrado (posición absoluta, fondo blanco) y se ENCUADRA en lo que
 * trabaja: la figura entera en un cuadrado dejaba dos franjas beis a los lados.
 */
export default function FiguraMusculos({ etiquetasEj, etiquetas }: { etiquetasEj?: string[], etiquetas?: any[] }) {
  const f = figuraDe(etiquetasEj || [], etiquetas || [])
  if (!f) return null
  const { ancho, arriba } = encuadre(f.vista, f.capas)
  const capa = { position: 'absolute' as const, inset: 0, width: '100%', height: '100%', objectFit: 'fill' as const }
  return (
    <span title="Imagen automática por sus músculos"
      style={{ position: 'absolute', inset: 0, overflow: 'hidden', background: '#fff', display: 'block' }}>
      <span style={{ position: 'absolute', left: `${(100 - ancho) / 2}%`, top: `${arriba}%`, width: `${ancho}%`, aspectRatio: '360 / 640' }}>
        <img src={urlCapa(f.vista, 'base')} alt="" style={capa}/>
        {f.capas.map(c => <img key={c} src={urlCapa(f.vista, c)} alt="" style={capa}/>)}
      </span>
    </span>
  )
}
