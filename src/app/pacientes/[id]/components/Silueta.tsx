'use client'
import { useState } from 'react'
import { puntoDeZona, Cara } from '@/lib/anatomia'
import { Ic } from '@/lib/icons'

export type Indicador = {
  clave: string
  icono: string
  label: string
  color: string
  items: string[]
  /** Texto cuando no hay nada. */
  vacio?: string
  /** Contenido propio en lugar de la lista de textos (p. ej. los documentos). */
  contenido?: React.ReactNode
  /** Contador cuando no sale de items.length. */
  n?: number
}

export type MarcaCuerpo = {
  id: string
  zona: string
  lado?: string | null
  titulo: string
  detalle?: string
  estado: 'activo' | 'cronico' | 'resuelto'
  origen: 'molestia' | 'patologia' | 'operacion'
}

const COLOR: Record<string, string> = {
  activo: '#B05A5A',
  cronico: '#C9A84C',
  resuelto: '#5A969E',
}

// Prioridad al agrupar varias marcas en un mismo punto: manda la más grave.
const RANGO: Record<string, number> = { activo: 3, cronico: 2, resuelto: 1 }

const oscurecer = (hex: string, f = 0.45) => {
  const n = parseInt(hex.slice(1), 16)
  const c = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map(v => Math.round(v * (1 - f)))
  return `rgb(${c[0]},${c[1]},${c[2]})`
}

// Solo hay una silueta, de frente. La profundidad se sugiere con el tamaño y el
// difuminado: lo de delante se ve grande y blando, lo de detrás pequeño y nítido,
// como si se transparentara a través del cuerpo. Va explicado en la leyenda.
const PROFUNDIDAD: Record<Cara, { r: number, halo: number, opacidad: number, borde: number }> = {
  ant:  { r: 22, halo: 10, opacidad: 0.55, borde: 0 },
  lat:  { r: 17, halo: 5,  opacidad: 0.85, borde: 2 },
  post: { r: 12, halo: 0,  opacidad: 1,    borde: 2 },
}

export default function Silueta({ marcas, onAbrir, altura, peso, izquierda = [], derecha = [], flancoIzq, flancoDer }: {
  marcas: MarcaCuerpo[]
  onAbrir?: (m: MarcaCuerpo[]) => void
  altura?: number | null
  peso?: number | null
  /** Indicadores de la fila superior. */
  izquierda?: Indicador[]
  derecha?: Indicador[]
  /** Contenido libre a cada lado del cuerpo (los tests). */
  flancoIzq?: React.ReactNode
  flancoDer?: React.ReactNode
}) {
  const [hover, setHover] = useState<string | null>(null)
  const [abierto, setAbierto] = useState<string | null>(null)

  // En fila y sin recuadro: el icono a pelo, con su contador y su etiqueta.
  const fila = (inds: Indicador[]) => (
    <div style={{ display: 'flex', justifyContent: 'center', gap: 26, flexWrap: 'wrap' }}>
      {inds.map(ind => {
        const on = abierto === ind.clave
        return (
          <div key={ind.clave} style={{ position: 'relative', textAlign: 'center' }}>
            <button className={`ind-ic ${on ? 'on' : ''}`} onClick={() => setAbierto(on ? null : ind.clave)}
              title={ind.label} style={{ color: ind.color }}>
              <Ic name={ind.icono} size={24} />
              {(ind.n ?? ind.items.length) > 0 && (
                <span className="ind-n" style={{ background: ind.color }}>{ind.n ?? ind.items.length}</span>
              )}
            </button>
            <div style={{ fontSize: 11, color: on ? 'var(--n)' : 'var(--gr)', marginTop: 2 }}>{ind.label}</div>

            {on && (
              <>
                <div style={{ position: 'fixed', inset: 0, zIndex: 8 }} onClick={() => setAbierto(null)} />
                <div className="ind-pop" style={{ left: '50%', transform: 'translateX(-50%)', textAlign: 'left', minWidth: ind.contenido ? 260 : 180 }}>
                  <div style={{ fontSize: 12, color: 'var(--gr)', marginBottom: 6 }}>{ind.label}</div>
                  {ind.contenido
                    ? ind.contenido
                    : ind.items.length === 0
                      ? <div style={{ fontSize: 13, color: 'var(--gr)' }}>{ind.vacio || 'Sin registros'}</div>
                      : ind.items.map((t, i) => (
                          <div key={i} style={{ fontSize: 13, color: 'var(--n)', padding: '3px 0 3px 9px', borderLeft: `2px solid ${ind.color}`, marginBottom: 3 }}>{t}</div>
                        ))}
                </div>
              </>
            )}
          </div>
        )
      })}
    </div>
  )

  // Cada marca puede dar 0 puntos (zona sin mapear), 1 (con lado) o 2 (bilateral).
  const situadas: { clave: string, x: number, y: number, cara: Cara, marcas: MarcaCuerpo[] }[] = []
  const sinSituar: MarcaCuerpo[] = []

  marcas.forEach(m => {
    const puntos = puntoDeZona(m.zona, m.lado)
    if (puntos.length === 0) { sinSituar.push(m); return }
    puntos.forEach(p => {
      const clave = `${p.x}_${p.y}`
      const ya = situadas.find(s => s.clave === clave)
      if (ya) ya.marcas.push(m)
      else situadas.push({ clave, x: p.x, y: p.y, cara: p.cara, marcas: [m] })
    })
  })

  return (
    <div>
      {/* Banda propia: las etiquetas de los iconos cuelgan hacia abajo y sin este
          aire se pegaban a los títulos de los flancos. */}
      {(izquierda.length > 0 || derecha.length > 0) && (
        <div style={{ marginBottom: 30 }}>
          {fila([...izquierda, ...derecha])}
        </div>
      )}
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'flex-start', gap: 24 }}>
      {flancoIzq && <div style={{ flex: 1, minWidth: 0 }}>{flancoIzq}</div>}
      <div style={{ position: 'relative', width: '100%', maxWidth: 300, flexShrink: 0 }}>
        <img src="/silueta.webp" alt="Silueta del paciente" style={{ width: '100%', display: 'block' }} />

        {situadas.map(s => {
          const peor = [...s.marcas].sort((a, b) => RANGO[b.estado] - RANGO[a.estado])[0]
          const color = COLOR[peor.estado]
          const activo = hover === s.clave
          const prof = PROFUNDIDAD[s.cara]
          return (
            <div key={s.clave}
              onMouseEnter={() => setHover(s.clave)}
              onMouseLeave={() => setHover(null)}
              onClick={() => onAbrir?.(s.marcas)}
              style={{
                position: 'absolute', left: `${s.x}%`, top: `${s.y}%`,
                transform: 'translate(-50%,-50%)', cursor: 'pointer', zIndex: activo ? 3 : 2,
              }}>
              <div style={{
                width: prof.r + (activo ? 4 : 0), height: prof.r + (activo ? 4 : 0), borderRadius: '50%',
                background: s.cara === 'post' ? oscurecer(color) : color,
                opacity: prof.opacidad,
                border: prof.borde ? `${prof.borde}px solid var(--w)` : 'none',
                filter: prof.halo ? `blur(${s.cara === 'ant' ? 1.2 : 0.4}px)` : 'none',
                boxShadow: prof.halo ? `0 0 ${prof.halo}px ${prof.halo / 2}px ${color}55` : 'none',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                color: '#fff', fontSize: 11, fontWeight: 600, transition: 'all .12s',
              }}>
                {s.marcas.length > 1 ? s.marcas.length : ''}
              </div>

              {activo && (
                <div style={{
                  position: 'absolute', left: '50%', bottom: '100%', marginBottom: 8,
                  transform: 'translateX(-50%)', background: 'var(--n)', color: '#fff',
                  padding: '7px 10px', borderRadius: 7, whiteSpace: 'nowrap',
                  fontSize: 12, lineHeight: 1.5, zIndex: 4, boxShadow: 'var(--sh-md)',
                }}>
                  {s.marcas.map(m => (
                    <div key={m.id}>
                      {m.titulo}
                      {m.detalle && <span style={{ color: 'rgba(255,255,255,.6)' }}> · {m.detalle}</span>}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )
        })}
      </div>
      {flancoDer && <div style={{ flex: 1, minWidth: 0 }}>{flancoDer}</div>}
      </div>

      {(altura || peso) && (
        <div style={{ display: 'flex', justifyContent: 'center', gap: 16, fontSize: 12, color: 'var(--gr)', marginTop: 10 }}>
          {altura && <span>{altura} cm</span>}
          {peso && <span>{peso} kg</span>}
        </div>
      )}

      <div style={{ display: 'flex', justifyContent: 'center', gap: 16, fontSize: 12, color: 'var(--gr)', marginTop: 8 }}>
        {([['activo', 'Activo'], ['cronico', 'Crónico'], ['resuelto', 'Resuelto']] as const).map(([k, l]) => (
          <span key={k} style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
            <span style={{ width: 8, height: 8, borderRadius: '50%', background: COLOR[k] }} />{l}
          </span>
        ))}
      </div>

      <div style={{ display: 'flex', justifyContent: 'center', gap: 16, fontSize: 12, color: 'var(--gr)', marginTop: 6 }}>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
          <span style={{ width: 14, height: 14, borderRadius: '50%', background: 'var(--gr)', opacity: .55, filter: 'blur(1.2px)' }} />delante
        </span>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
          <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#3b3b3b', border: '2px solid var(--w)' }} />detrás
        </span>
      </div>

      {/* Red de seguridad: una zona sin coordenada no puede hacer desaparecer el dato. */}
      {sinSituar.length > 0 && (
        <div style={{ marginTop: 20, fontSize: 12, color: 'var(--gr)' }}>
          <div style={{ marginBottom: 4 }}>Sin localizar en el cuerpo</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
            {sinSituar.map(m => (
              <span key={m.id} onClick={() => onAbrir?.([m])}
                style={{ fontSize: 12, padding: '2px 9px', borderRadius: 99, background: 'var(--bl)', color: 'var(--n)', cursor: 'pointer', border: `1px solid ${COLOR[m.estado]}` }}>
                {m.titulo}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
