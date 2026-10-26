'use client'
import { useState } from 'react'
import { ZONAS_CUERPO } from '@/lib/zonasCuerpo'

/**
 * EL MUÑECO POR ZONAS: delante y detras, cada zona se toca y se puede pintar.
 * Lo usan la valoracion (que zonas testear) y la ficha (mapa de calor de los tests).
 *   - `color(id)`: como pintar cada zona ('rojo' | 'verde' | 'ambar' | null = sin pintar).
 *   - `marcadas`: zonas elegidas (borde marcado).
 *   - `onZona`: al tocar una.
 */
export type ColorZona = 'rojo' | 'verde' | 'ambar' | null
const FONDO: Record<string, string> = { rojo: 'rgba(192,80,77,.55)', verde: 'rgba(62,113,121,.6)', ambar: 'rgba(201,168,76,.55)' }

export default function CuerpoZonas({ color, marcadas = [], onZona, ancho = 190, cuenta }: {
  color?: (id: string) => ColorZona, marcadas?: string[], onZona?: (id: string) => void, ancho?: number,
  /* La figura va en gris: sobre el verde de siempre el color del test no se veia. */
  /** Un numero pequeño sobre la zona (p. ej. cuantos tests tiene). */
  cuenta?: (id: string) => number
}) {
  const [vista, setVista] = useState<'frente' | 'espalda'>('frente')
  return (
    <div style={{ width: ancho, flexShrink: 0 }}>
      <style>{CSS}</style>
      <div className="cz-seg">
        {([['frente', 'Delante'], ['espalda', 'Detrás']] as const).map(([v, l]) => (
          <button key={v} type="button" className={vista === v ? 'on' : ''} onClick={() => setVista(v)}>{l}</button>
        ))}
      </div>
      <div className="cz-fig" style={{ width: ancho }}>
        <img src={`/cuerpo/${vista}_base.svg`} alt=""/>
        {ZONAS_CUERPO.flatMap(z => ((vista === 'frente' ? z.frente : z.espalda) || []).map((r, k) => {
          const c = color?.(z.id) || null, on = marcadas.includes(z.id), n = cuenta?.(z.id) || 0
          return (
            <button key={z.id + k} type="button" title={z.nombre + (n ? ` · ${n}` : '')}
              className={`cz-z ${on ? 'on' : ''} ${onZona ? '' : 'quieta'}`}
              style={{ left: r[0] + '%', top: r[1] + '%', width: r[2] + '%', height: r[3] + '%', background: c ? FONDO[c] : undefined }}
              onClick={() => onZona?.(z.id)}>
              {k === 0 && n > 0 && <span className="cz-n">{n}</span>}
            </button>
          )
        }))}
      </div>
    </div>
  )
}

const CSS = `
.cz-seg{display:flex;background:#ECE9E2;border-radius:99px;padding:3px;margin:0 auto 8px;width:fit-content}
.cz-seg button{font-family:inherit;border:none;background:transparent;font-size:12px;padding:4px 12px;border-radius:99px;color:var(--gr);cursor:pointer}
.cz-seg button.on{background:#fff;color:var(--n);font-weight:500;box-shadow:0 1px 3px rgba(0,0,0,.08)}
.cz-fig{position:relative;aspect-ratio:360/640;margin:0 auto}
.cz-fig img{position:absolute;inset:0;width:100%;height:100%;pointer-events:none;opacity:.4;filter:grayscale(1)}
.cz-z{position:absolute;border:0;border-radius:10px;background:transparent;cursor:pointer;padding:0;transition:background .12s,box-shadow .12s}
.cz-z:hover{box-shadow:inset 0 0 0 2px rgba(63,120,128,.45)}
.cz-z.quieta{cursor:default}
.cz-z.on{box-shadow:inset 0 0 0 2.5px var(--n)}
.cz-n{position:absolute;top:-6px;right:-6px;min-width:16px;height:16px;border-radius:99px;background:#fff;color:var(--n);font-size:10px;font-weight:700;display:flex;align-items:center;justify-content:center;box-shadow:0 1px 3px rgba(0,0,0,.2);padding:0 3px}
`
