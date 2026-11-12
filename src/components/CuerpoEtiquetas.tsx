'use client'
import { useState, type ReactNode } from 'react'
import { normalizar } from '@/lib/texto'
import { categoriaDe } from '@/lib/etiquetas'

// ---------------------------------------------------------------------------
// MUÑECO PARA PONER ETIQUETAS DE MÚSCULO Y ARTICULACIÓN. Cada etiqueta sale al lado de
// su zona, unida con una línea; tocarla la pone o la quita y la zona se pinta. Músculo
// tiene frente y espalda (glúteo, isquios o gemelos solo se ven por detrás).
// Se colocan por NOMBRE de la etiqueta raíz; las que no tienen sitio aquí siguen en la
// lista de debajo. Las subetiquetas («Glúteo 3▾») se abren junto a su etiqueta.
// Medidas del dibujo: caja de 140 × 340, el centro del cuerpo en x = 70.
// ---------------------------------------------------------------------------
type Sitio = { x: number, y: number, lado: 'i' | 'd' }
type Vista = 'frente' | 'espalda'
const MUSCULOS: Record<Vista, Record<string, Sitio>> = {
  frente: {
    'maxilar': { x: 70, y: 30, lado: 'i' }, 'hombro': { x: 41, y: 58, lado: 'i' }, 'pectoral': { x: 57, y: 72, lado: 'i' },
    'biceps': { x: 35, y: 92, lado: 'i' }, 'braquioradial': { x: 30, y: 135, lado: 'i' }, 'flexor de muneca': { x: 27, y: 152, lado: 'i' },
    'flexor de dedos': { x: 25, y: 168, lado: 'i' }, 'dedos': { x: 23, y: 194, lado: 'i' }, 'cuadriceps': { x: 57, y: 208, lado: 'i' },
    'tibial': { x: 56, y: 262, lado: 'i' }, 'pie': { x: 54, y: 320, lado: 'i' },
    'intercostales': { x: 85, y: 90, lado: 'd' }, 'diafragma': { x: 72, y: 98, lado: 'd' }, 'abdomen': { x: 70, y: 118, lado: 'd' },
    'psoas': { x: 79, y: 143, lado: 'd' }, 'abductor - tfl': { x: 93, y: 155, lado: 'd' }, 'sartorio': { x: 83, y: 180, lado: 'd' },
    'aductores': { x: 76, y: 198, lado: 'd' }, 'peroneos': { x: 92, y: 268, lado: 'd' },
  },
  espalda: {
    'cervical': { x: 70, y: 42, lado: 'i' }, 'espalda': { x: 57, y: 100, lado: 'i' }, 'gluteo': { x: 58, y: 160, lado: 'i' },
    'isquiotibial': { x: 57, y: 205, lado: 'i' },
    'trapecio': { x: 85, y: 58, lado: 'd' }, 'triceps': { x: 105, y: 92, lado: 'd' }, 'extensor de munecas': { x: 111, y: 150, lado: 'd' },
    'extensor de dedos': { x: 114, y: 166, lado: 'd' }, 'gluteo - piramidal': { x: 83, y: 158, lado: 'd' }, 'triceps sural': { x: 85, y: 265, lado: 'd' },
  },
}
const ARTICULACIONES: Record<string, Sitio> = {
  'escapular': { x: 47, y: 64, lado: 'i' }, 'codo': { x: 32, y: 122, lado: 'i' }, 'muneca': { x: 25, y: 182, lado: 'i' },
  'mano': { x: 23, y: 198, lado: 'i' }, 'tobillo': { x: 56, y: 306, lado: 'i' },
  'maxilar': { x: 72, y: 32, lado: 'd' }, 'hombro': { x: 98, y: 57, lado: 'd' }, 'columna': { x: 70, y: 100, lado: 'd' },
  'cadera': { x: 83, y: 150, lado: 'd' }, 'rodilla': { x: 85, y: 230, lado: 'd' }, 'pie': { x: 87, y: 320, lado: 'd' },
}
const clave = (n: string) => normalizar(n).replace(/\s+/g, ' ').trim()
const mapaDe = (cat: string, vista: Vista) => cat === 'musculo' ? MUSCULOS[vista] : ARTICULACIONES

/** Si esta etiqueta raíz tiene sitio en el muñeco (las que no, siguen en la lista). */
export function enMuneco(cat: string, nombre: string) {
  const k = clave(nombre)
  return cat === 'musculo' ? !!(MUSCULOS.frente[k] || MUSCULOS.espalda[k]) : cat === 'articulacion' ? !!ARTICULACIONES[k] : false
}

function Silueta({ espalda }: { espalda: boolean }) {
  const c = 'var(--gl)'
  return (<g>
    <circle cx={70} cy={22} r={14} fill={c}/>
    <rect x={63} y={34} width={14} height={12} fill={c}/>
    <path d="M42 50 Q70 43 98 50 L93 150 Q70 158 47 150 Z" fill={c}/>
    <g stroke={c} strokeLinecap="round" strokeLinejoin="round" fill="none">
      <polyline points="43,57 33,120 25,182" strokeWidth={13}/><polyline points="97,57 107,120 115,182" strokeWidth={13}/>
      <polyline points="58,150 56,230 56,305" strokeWidth={20}/><polyline points="82,150 84,230 84,305" strokeWidth={20}/>
    </g>
    <circle cx={23} cy={196} r={7} fill={c}/><circle cx={117} cy={196} r={7} fill={c}/>
    <ellipse cx={53} cy={318} rx={9} ry={5} fill={c}/><ellipse cx={87} cy={318} rx={9} ry={5} fill={c}/>
    {espalda && <path d="M70 52 V146" stroke="var(--bl)" strokeWidth={1.2}/>}
  </g>)
}

export default function CuerpoEtiquetas({ etiquetas, cat, valor, onToggle, fila }: {
  etiquetas: any[], cat: 'musculo' | 'articulacion', valor: string[], onToggle: (id: string) => void,
  /** Cómo se pinta una subetiqueta en su desplegable (el mismo renglón que la lista). */
  fila: (e: any, nivel: number) => ReactNode
}) {
  const [vista, setVista] = useState<Vista>('frente')
  const [abierta, setAbierta] = useState<string | null>(null)
  const raices = etiquetas.filter(e => !e.padre_id && categoriaDe(etiquetas, e) === cat)
  const hijasDe = (id: string) => etiquetas.filter(e => e.padre_id === id).sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'))
  // Una raíz cuenta como puesta si lo está ella o alguna de sus hijas.
  const puesta = (r: any) => valor.includes(r.id) || etiquetas.some(e => valor.includes(e.id) && e.padre_id === r.id)
    || etiquetas.some(e => valor.includes(e.id) && etiquetas.find(p => p.id === e.padre_id)?.padre_id === r.id)

  const S = 1.15, ANCHO_ET = 132, HUECO = 22, W = 140 * S, H = 340 * S
  const X0 = ANCHO_ET + HUECO, TOTAL = X0 * 2 + W
  const mapa = mapaDe(cat, vista)
  const items = raices.map(r => ({ r, s: mapa[clave(r.nombre)] })).filter(x => x.s) as { r: any, s: Sitio }[]
  // Reparto de los rótulos en cada lado: en el orden de su zona y sin pisarse.
  const ALTO = 25
  const colocar = (lado: 'i' | 'd') => {
    const l = items.filter(x => x.s.lado === lado).sort((a, b) => a.s.y - b.s.y).map(x => ({ ...x, y: x.s.y * S }))
    for (let i = 1; i < l.length; i++) l[i].y = Math.max(l[i].y, l[i - 1].y + ALTO)
    for (let i = l.length - 1; i >= 0; i--) { const tope = i === l.length - 1 ? H - ALTO / 2 : l[i + 1].y - ALTO; l[i].y = Math.min(l[i].y, tope) }
    return l
  }
  const rotulos = [...colocar('i'), ...colocar('d')]
  const cuenta = (v: Vista) => raices.filter(r => MUSCULOS[v][clave(r.nombre)] && puesta(r)).length

  return (
    <div style={{ marginBottom: 14 }}>
      {cat === 'musculo' && (
        <div style={{ display: 'flex', gap: 6, justifyContent: 'center', marginBottom: 8 }}>
          {(['frente', 'espalda'] as Vista[]).map(v => (
            <button key={v} type="button" className={`chip-sel ${vista === v ? 'on' : ''}`} onClick={() => { setVista(v); setAbierta(null) }}>
              {v === 'frente' ? 'De frente' : 'De espaldas'}{cuenta(v) ? ` · ${cuenta(v)}` : ''}
            </button>
          ))}
        </div>
      )}
      <div style={{ position: 'relative', width: TOTAL, height: H, margin: '0 auto', maxWidth: '100%' }}>
        <svg width={TOTAL} height={H} style={{ position: 'absolute', inset: 0, overflow: 'visible' }}>
          <g transform={`translate(${X0} 0) scale(${S})`}>
            <Silueta espalda={vista === 'espalda'}/>
            {items.map(({ r, s }) => <ellipse key={r.id} cx={s.x} cy={s.y} rx={cat === 'musculo' ? 9 : 6} ry={cat === 'musculo' ? 12 : 6}
              fill={puesta(r) ? 'var(--g)' : 'transparent'} opacity={.6}/>)}
          </g>
          {rotulos.map(({ r, s, y }) => {
            const ax = X0 + s.x * S, ay = s.y * S, ex = s.lado === 'i' ? ANCHO_ET : X0 + W + HUECO
            return <g key={r.id}>
              <line x1={ex} y1={y} x2={ax} y2={ay} stroke={puesta(r) ? 'var(--g)' : 'var(--gm)'} strokeWidth={1} strokeDasharray={puesta(r) ? undefined : '2 2'}/>
              <circle cx={ax} cy={ay} r={2.6} fill={puesta(r) ? 'var(--g)' : '#fff'} stroke="var(--g)" strokeWidth={1.2}/>
            </g>
          })}
        </svg>
        {rotulos.map(({ r, s, y }) => {
          const on = valor.includes(r.id), algo = puesta(r), n = hijasDe(r.id).length
          return (
            <div key={r.id} style={{ position: 'absolute', top: y - 11, width: ANCHO_ET, display: 'flex', alignItems: 'center', gap: 2,
              justifyContent: s.lado === 'i' ? 'flex-end' : 'flex-start', zIndex: abierta === r.id ? 6 : 2,
              ...(s.lado === 'i' ? { left: 0 } : { left: X0 + W + HUECO }) }}>
              {s.lado === 'i' && n > 0 && <button type="button" onClick={() => setAbierta(abierta === r.id ? null : r.id)} style={flecha}>{abierta === r.id ? '▴' : `${n}▾`}</button>}
              <button type="button" onClick={() => onToggle(r.id)} title={r.nombre}
                style={{ border: `1.5px solid ${algo ? 'var(--g)' : 'var(--bd)'}`, background: on ? 'var(--g)' : algo ? 'var(--gl)' : '#fff',
                  color: on ? '#fff' : 'var(--n)', borderRadius: 99, padding: '2px 9px', fontSize: 11.5, cursor: 'pointer', fontFamily: 'inherit',
                  whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: ANCHO_ET - (n ? 26 : 0) }}>{r.nombre}</button>
              {s.lado === 'd' && n > 0 && <button type="button" onClick={() => setAbierta(abierta === r.id ? null : r.id)} style={flecha}>{abierta === r.id ? '▴' : `${n}▾`}</button>}
              {/* SUS SUBETIQUETAS, junto a ella */}
              {abierta === r.id && (
                <div style={{ position: 'absolute', top: 26, [s.lado === 'i' ? 'right' : 'left']: 0, width: 200, background: '#fff', borderRadius: 12,
                  boxShadow: '0 8px 24px rgba(38,40,37,.18)', padding: 6, zIndex: 7 } as any}>
                  {fila(r, 0)}
                  <div style={{ marginLeft: 10, paddingLeft: 6, borderLeft: '2px solid var(--gl)' }}>
                    {hijasDe(r.id).flatMap(h => [<div key={h.id}>{fila(h, 1)}</div>,
                      ...hijasDe(h.id).map(n2 => <div key={n2.id} style={{ marginLeft: 10 }}>{fila(n2, 2)}</div>)])}
                  </div>
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
const flecha: React.CSSProperties = { border: 'none', background: 'none', color: 'var(--g)', cursor: 'pointer', fontSize: 11, padding: '0 2px', flexShrink: 0 }
