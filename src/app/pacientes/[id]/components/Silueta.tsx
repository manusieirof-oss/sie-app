'use client'
import { useState } from 'react'
import { puntoDeZona } from '@/lib/anatomia'
import { Ic } from '@/lib/icons'

export type Indicador = {
  clave: string
  icono: string
  label: string
  color: string
  items: string[]
  /** Texto cuando no hay nada. */
  vacio?: string
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

export default function Silueta({ marcas, onAbrir, altura, peso, izquierda = [], derecha = [] }: {
  marcas: MarcaCuerpo[]
  onAbrir?: (m: MarcaCuerpo[]) => void
  altura?: number | null
  peso?: number | null
  izquierda?: Indicador[]
  derecha?: Indicador[]
}) {
  const [hover, setHover] = useState<string | null>(null)
  const [abierto, setAbierto] = useState<string | null>(null)

  const columna = (inds: Indicador[], lado: 'izq' | 'der') => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 18, paddingTop: 8 }}>
      {inds.map(ind => {
        const on = abierto === ind.clave
        return (
          <div key={ind.clave} style={{ position: 'relative', textAlign: 'center' }}>
            <button className={`ind-b ${on ? 'on' : ''}`} onClick={() => setAbierto(on ? null : ind.clave)}
              title={ind.label} style={{ color: ind.color }}>
              <Ic name={ind.icono} size={20} />
              {ind.items.length > 0 && (
                <span className="ind-n" style={{ background: ind.color }}>{ind.items.length}</span>
              )}
            </button>
            <div style={{ fontSize: 11, color: 'var(--gr)', marginTop: 3 }}>{ind.label}</div>

            {on && (
              <>
                <div style={{ position: 'fixed', inset: 0, zIndex: 8 }} onClick={() => setAbierto(null)} />
                <div className="ind-pop" style={{ [lado === 'izq' ? 'left' : 'right']: 0, textAlign: 'left' } as any}>
                  <div style={{ fontSize: 12, color: 'var(--gr)', marginBottom: 6 }}>{ind.label}</div>
                  {ind.items.length === 0
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
  const situadas: { clave: string, x: number, y: number, marcas: MarcaCuerpo[] }[] = []
  const sinSituar: MarcaCuerpo[] = []

  marcas.forEach(m => {
    const puntos = puntoDeZona(m.zona, m.lado)
    if (puntos.length === 0) { sinSituar.push(m); return }
    puntos.forEach(p => {
      const clave = `${p.x}_${p.y}`
      const ya = situadas.find(s => s.clave === clave)
      if (ya) ya.marcas.push(m)
      else situadas.push({ clave, x: p.x, y: p.y, marcas: [m] })
    })
  })

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'flex-start', gap: 22 }}>
      {izquierda.length > 0 && columna(izquierda, 'izq')}
      <div style={{ position: 'relative', width: '100%', maxWidth: 300 }}>
        <img src="/silueta.webp" alt="Silueta del paciente" style={{ width: '100%', display: 'block' }} />

        {situadas.map(s => {
          const peor = [...s.marcas].sort((a, b) => RANGO[b.estado] - RANGO[a.estado])[0]
          const color = COLOR[peor.estado]
          const activo = hover === s.clave
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
                width: activo ? 22 : 18, height: activo ? 22 : 18, borderRadius: '50%',
                background: color, border: '2px solid var(--w)',
                boxShadow: `0 0 0 ${activo ? 7 : 5}px ${color}26`,
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
      {derecha.length > 0 && columna(derecha, 'der')}
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

      {/* Red de seguridad: una zona sin coordenada no puede hacer desaparecer el dato. */}
      {sinSituar.length > 0 && (
        <div style={{ marginTop: 12, paddingTop: 10, borderTop: '1px solid var(--bd)', fontSize: 12, color: 'var(--gr)' }}>
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
