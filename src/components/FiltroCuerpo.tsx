'use client'
import { useEffect, useMemo, useRef, useState } from 'react'
import { normalizar } from '@/lib/texto'
import { categoriaDe, CATEGORIAS_ETIQUETA } from '@/lib/etiquetas'
import { MUS_RIG } from '@/lib/mapaTrabajo'
import IconoEtiqueta from './IconoEtiqueta'
import type { CuerpoFiltro3D, Proyeccion } from '@/lib/anim3d/cuerpoFiltro'

// ---------------------------------------------------------------------------
// EL FILTRO DE LA BIBLIOTECA, CON EL CUERPO EN 3D. Ocupa toda la pantalla con el
// fondo medio transparente: detrás se ven los ejercicios filtrándose mientras se
// eligen etiquetas. En el centro el cuerpo gira (Músculos o Articulaciones) con cada
// etiqueta junto a su zona: delante grande y nítida, detrás pequeña y transparente,
// y siempre escrita para leerse. El material, abajo con sus iconos. El resto de
// grupos, en pestañas a los lados. Sustituye a «Filtros» y «Zona».
// ---------------------------------------------------------------------------

type P3 = [number, number, number]
/* DÓNDE VA CADA ETIQUETA (coordenadas del cuerpo-rig: de pie, 90 de alto, delante +z).
   Las de los dos lados van en un lado: las de delante a un lado y las de detrás al otro,
   para que no se amontonen. */
const MUSCULOS: Record<string, P3> = {
  'maxilar': [0, 80, 6], 'cervical': [0, 75, -3.5], 'pectoral': [4, 65, 5.5], 'hombro': [9.5, 70, 1.5],
  'biceps': [11, 62, 2.8], 'braquioradial': [13, 50, 2], 'flexor de muneca': [13.8, 46, 2], 'flexor de dedos': [14.6, 43, 1.6],
  'dedos': [15.6, 38, 1], 'abdomen': [0, 53, 6], 'intercostales': [5.5, 58, 4], 'diafragma': [2, 58, 5.6],
  'psoas': [2.5, 45, 5], 'abductor - tfl': [6.8, 42, 1.5], 'sartorio': [4, 36, 4.2], 'cuadriceps': [5, 31, 4],
  'aductores': [1.8, 34, 1.8], 'tibial': [6.6, 14, 2.6], 'peroneos': [7.6, 14, 0], 'pie': [7, 1.5, 3.5],
  'trapecio': [-4, 72, -3.8], 'espalda': [-3, 56, -5.2], 'triceps': [-10.8, 62, -2.6], 'extensor de munecas': [-13.8, 47, -1.6],
  'extensor de dedos': [-14.6, 43, -1.2], 'gluteo': [-3, 43, -5.6], 'gluteo - piramidal': [-4.8, 39.5, -5.2],
  'isquiotibial': [-4, 30, -4.2], 'triceps sural': [-6.6, 14, -4.2], 'dorsal ancho': [-6, 60, -3.5],
}
const ARTICULACIONES: Record<string, P3> = {
  'maxilar': [3, 79, 4], 'cervical': [0, 74.5, -2.5], 'hombro': [9, 70.3, 0], 'escapular': [-6, 66, -4.5],
  'columna': [0, 58, -5.5], 'codo': [12.3, 54, -.7], 'muneca': [15, 41.2, .2], 'mano': [-15.6, 37, .5],
  'cadera': [5, 44, 1.5], 'rodilla': [6.45, 20.5, 2], 'tobillo': [-7, 3.8, 0], 'pie': [7, 1, 4.5],
}
const clave = (n: string) => normalizar(n).replace(/\s+/g, ' ').trim()
const LATERAL_IZQ = ['movimiento', 'posicion', 'apoyo']
const LATERAL_DER = ['agarre', 'patron', 'plano_eje', 'patologia']

export default function FiltroCuerpo({ etiquetas, valor, onChange, nResultado, onCerrar }: {
  etiquetas: any[], valor: string[], onChange: (v: string[]) => void, nResultado: number, onCerrar: () => void
}) {
  const [modo, setModo] = useState<'musculo' | 'articulacion'>('musculo')
  const [pestana, setPestana] = useState<string | null>(null)
  const [abierta, setAbierta] = useState<string | null>(null)
  const [fallo, setFallo] = useState('')
  const caja = useRef<HTMLDivElement>(null)
  const motor = useRef<CuerpoFiltro3D | null>(null)
  const rotulos = useRef<Record<string, HTMLDivElement | null>>({})
  const hilos = useRef<Record<string, SVGLineElement | null>>({})

  const raices = (cat: string) => etiquetas.filter(e => !e.padre_id && categoriaDe(etiquetas, e) === cat)
    .sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'))
  const hijas = (id: string) => etiquetas.filter(e => e.padre_id === id).sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'))
  const alternar = (id: string) => onChange(valor.includes(id) ? valor.filter(x => x !== id) : [...valor, id])
  const tieneAlgo = (r: any) => valor.includes(r.id) || etiquetas.some(e => valor.includes(e.id) && (e.padre_id === r.id || etiquetas.find(p => p.id === e.padre_id)?.padre_id === r.id))

  // Las etiquetas del modo, con su sitio en el cuerpo.
  const tabla = modo === 'musculo' ? MUSCULOS : ARTICULACIONES
  const enCuerpo = useMemo(() => raices(modo).filter(r => tabla[clave(r.nombre)]), [etiquetas, modo]) // eslint-disable-line react-hooks/exhaustive-deps
  const sinSitio = useMemo(() => raices(modo).filter(r => !tabla[clave(r.nombre)]), [etiquetas, modo]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── El motor 3D: se crea una vez ──
  useEffect(() => {
    let vivo = true
    ;(async () => {
      try {
        const { crearCuerpoFiltro } = await import('@/lib/anim3d/cuerpoFiltro')
        if (!vivo || !caja.current) return
        motor.current = await crearCuerpoFiltro(caja.current, (l: Proyeccion[]) => {
          /* Sin React: se mueven los rótulos directamente, en cada fotograma. Cada uno va
             en su órbita alrededor del cuerpo (lo calcula el motor), unido a su zona con un
             hilo. Delante, grande y encima de todo; detrás, pequeño y apagado. Si dos se
             tocan en pantalla, el de detrás se aparta hacia abajo. */
          const caidas = l.map(p => {
            const d = rotulos.current[p.k]
            return { p, d, w: (d?.offsetWidth || 90) * (.7 + .3 * p.frente), y: p.y }
          }).sort((a, b) => b.p.frente - a.p.frente)
          const puestos: typeof caidas = []
          caidas.forEach(c => {
            for (let it = 0; it < 24; it++) {
              const choca = puestos.find(o => Math.abs(o.p.x - c.p.x) < (o.w + c.w) / 2 + 4 && Math.abs(o.y - c.y) < 28)
              if (!choca) break
              c.y = choca.y + (c.y >= choca.y ? 28 : -28)
            }
            puestos.push(c)
          })
          puestos.forEach(({ p, d, y }) => {
            const t = p.frente, h = hilos.current[p.k]
            if (d) {
              d.style.transform = `translate(${p.x}px, ${y}px) translate(-50%, -50%) scale(${.7 + .35 * t})`
              d.style.opacity = String(.35 + .65 * t)
              d.style.zIndex = String(Math.round(10 + t * 50))
            }
            if (h) {
              h.setAttribute('x1', String(p.x)); h.setAttribute('y1', String(y)); h.setAttribute('x2', String(p.ax)); h.setAttribute('y2', String(p.ay))
              h.setAttribute('opacity', String(.2 + .6 * t))
            }
          })
        })
        if (!vivo) { motor.current.destruir(); motor.current = null }
      } catch (e: any) { setFallo(e?.message || 'No se ha podido cargar el cuerpo 3D') }
    })()
    return () => { vivo = false; motor.current?.destruir(); motor.current = null }
  }, [])

  // Anclas del modo, y lo que se enciende.
  useEffect(() => {
    const m = motor.current; if (!m) return
    m.anclas(enCuerpo.map(r => ({ k: r.id, p: tabla[clave(r.nombre)] })))
  })
  useEffect(() => {
    const m = motor.current; if (!m) return
    const porId: Record<string, any> = Object.fromEntries(etiquetas.map(e => [e.id, e]))
    const subir = (e: any) => { const r: any[] = []; const v = new Set<string>(); while (e && !v.has(e.id)) { v.add(e.id); r.push(e); e = porId[e.padre_id] } return r }
    const grupos = new Set<string>(), puntos: P3[] = []
    valor.forEach(id => {
      const cad = subir(porId[id]); if (!cad.length) return
      const cat = categoriaDe(etiquetas, cad[0])
      if (cat === 'musculo') { const g = cad.map(x => MUS_RIG[x.nombre]).find(Boolean); if (g) grupos.add(g) }
      if (cat === 'articulacion') { const p = cad.map(x => ARTICULACIONES[clave(x.nombre)]).find(Boolean); if (p) puntos.push(p) }
    })
    m.musculos(Array.from(grupos)); m.articulaciones(puntos)
  })

  // Cerrar con Escape.
  useEffect(() => {
    const f = (e: KeyboardEvent) => { if (e.key === 'Escape') onCerrar() }
    window.addEventListener('keydown', f); return () => window.removeEventListener('keydown', f)
  }, [onCerrar])

  const labelDe = (k: string) => CATEGORIAS_ETIQUETA.find(c => c.key === k)?.label || k
  const nGrupo = (k: string) => valor.filter(id => { const e = etiquetas.find(x => x.id === id); return e && categoriaDe(etiquetas, e) === k }).length
  const chip = (e: any, peq = false) => {
    const on = valor.includes(e.id)
    return (
      <button key={e.id} type="button" onClick={() => alternar(e.id)}
        style={{ display: 'inline-flex', alignItems: 'center', gap: 6, border: `1.5px solid ${on ? 'var(--g)' : 'var(--bd)'}`, borderRadius: 99,
          background: on ? 'var(--g)' : '#fff', color: on ? '#fff' : 'var(--n)', padding: peq ? '3px 10px' : '5px 12px', fontSize: peq ? 12 : 13,
          cursor: 'pointer', fontFamily: 'inherit', whiteSpace: 'nowrap' }}>
        <IconoEtiqueta etiquetas={etiquetas} et={e} size={peq ? 15 : 18}/>{e.nombre}
      </button>
    )
  }
  const pestanaBtn = (k: string, lado: 'izq' | 'der') => (
    <button key={k} type="button" onClick={() => setPestana(pestana === k ? null : k)}
      style={{ border: 'none', cursor: 'pointer', fontFamily: 'inherit', fontSize: 13, padding: '12px 14px', textAlign: lado === 'izq' ? 'left' : 'right',
        borderRadius: lado === 'izq' ? '0 12px 12px 0' : '12px 0 0 12px', background: pestana === k ? 'var(--g)' : 'rgba(255,255,255,.92)',
        color: pestana === k ? '#fff' : 'var(--n)', boxShadow: '0 3px 12px rgba(38,40,37,.12)', minWidth: 150 }}>
      {labelDe(k)}{nGrupo(k) ? <b style={{ marginLeft: 6 }}>· {nGrupo(k)}</b> : ''}
    </button>
  )
  const material = raices('material')

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 400, background: 'rgba(246,244,239,.72)', backdropFilter: 'blur(2px)', display: 'flex', flexDirection: 'column' }}>
      {/* ARRIBA: Músculos / Articulaciones, cuántos salen y cerrar */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '14px 20px', flexWrap: 'wrap' }}>
        <span style={{ fontSize: 17, fontWeight: 600, color: 'var(--n)' }}>Filtros</span>
        <div style={{ display: 'inline-flex', background: 'rgba(255,255,255,.9)', borderRadius: 99, padding: 3, margin: '0 auto', boxShadow: '0 3px 12px rgba(38,40,37,.1)' }}>
          {([['musculo', 'Músculos'], ['articulacion', 'Articulaciones']] as const).map(([k, t]) => (
            <button key={k} type="button" onClick={() => { setModo(k); setAbierta(null) }}
              style={{ border: 0, borderRadius: 99, padding: '8px 20px', fontSize: 14, cursor: 'pointer', fontFamily: 'inherit',
                background: modo === k ? 'var(--g)' : 'transparent', color: modo === k ? '#fff' : 'var(--n)' }}>
              {t}{nGrupo(k) ? ` · ${nGrupo(k)}` : ''}</button>
          ))}
        </div>
        <span style={{ fontSize: 13, color: 'var(--gd)', fontWeight: 600 }}>{nResultado} {nResultado === 1 ? 'ejercicio' : 'ejercicios'}</span>
        {valor.length > 0 && <button type="button" className="chip-sel" onClick={() => onChange([])}>Limpiar · {valor.length}</button>}
        <button type="button" className="btn btn-p btn-sm" onClick={onCerrar}>Ver ejercicios</button>
      </div>

      <div style={{ flex: 1, position: 'relative', minHeight: 0 }}>
        {/* PESTAÑAS DE LOS LADOS */}
        <div style={{ position: 'absolute', left: 0, top: 20, display: 'grid', gap: 8, zIndex: 80 }}>{LATERAL_IZQ.map(k => pestanaBtn(k, 'izq'))}</div>
        <div style={{ position: 'absolute', right: 0, top: 20, display: 'grid', gap: 8, zIndex: 80, justifyItems: 'end' }}>{LATERAL_DER.map(k => pestanaBtn(k, 'der'))}</div>
        {pestana && (
          <div style={{ position: 'absolute', top: 20, [LATERAL_IZQ.includes(pestana) ? 'left' : 'right']: 170, width: 'min(420px, 40vw)', maxHeight: 'calc(100% - 40px)',
            overflow: 'auto', background: '#fff', borderRadius: 16, padding: 14, boxShadow: '0 12px 34px rgba(38,40,37,.18)', zIndex: 90 } as any}>
            <div style={{ display: 'flex', alignItems: 'center', marginBottom: 10 }}>
              <b style={{ flex: 1, fontSize: 14 }}>{labelDe(pestana)}</b>
              <button type="button" className="btn btn-t btn-sm" onClick={() => setPestana(null)}>✕</button>
            </div>
            <div style={{ display: 'grid', gap: 8 }}>
              {raices(pestana).map(r => (
                <div key={r.id}>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>{chip(r)}</div>
                  {hijas(r.id).length > 0 && <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, margin: '5px 0 0 14px' }}>{hijas(r.id).map(h => chip(h, true))}</div>}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* EL CUERPO, y sus etiquetas encima */}
        <div ref={caja} style={{ position: 'absolute', left: '50%', top: 0, bottom: 0, transform: 'translateX(-50%)', width: 'min(820px, 64vw)' }}>
          {fallo && <div className="muted" style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{fallo}</div>}
          {/* Los hilos de cada etiqueta a su zona */}
          <svg style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', pointerEvents: 'none', zIndex: 5, overflow: 'visible' }}>
            {enCuerpo.map(r => <line key={r.id} ref={l => { hilos.current[r.id] = l }} stroke={tieneAlgo(r) ? '#3F7C84' : '#2F4F53'} strokeWidth={tieneAlgo(r) ? 2 : 1.2} strokeDasharray={tieneAlgo(r) ? undefined : '3 3'}/>)}
          </svg>
          {enCuerpo.map(r => {
            const n = hijas(r.id).length, on = valor.includes(r.id), algo = tieneAlgo(r)
            return (
              <div key={r.id} ref={d => { rotulos.current[r.id] = d }}
                style={{ position: 'absolute', left: 0, top: 0, willChange: 'transform, opacity', display: 'inline-flex', alignItems: 'center', gap: 2 }}>
                <button type="button" onClick={() => alternar(r.id)}
                  /* QUE SE LEAN SOBRE EL CUERPO: blanco macizo, letra oscura y gruesa, borde y
                     sombra marcados. La elegida, en verde con letra blanca. */
                  style={{ border: `2px solid ${algo ? 'var(--gd)' : '#2F4F53'}`, background: on ? 'var(--gd)' : algo ? '#E3F0F1' : '#fff',
                    color: on ? '#fff' : '#1E2B2D', borderRadius: 99, padding: '5px 13px', fontSize: 14, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit',
                    whiteSpace: 'nowrap', boxShadow: '0 3px 10px rgba(20,30,32,.28)' }}>{r.nombre}</button>
                {n > 0 && <button type="button" onClick={() => setAbierta(abierta === r.id ? null : r.id)}
                  style={{ border: 'none', background: 'rgba(255,255,255,.9)', borderRadius: 99, color: 'var(--g)', cursor: 'pointer', fontSize: 11, padding: '3px 6px' }}>{abierta === r.id ? '▴' : `${n}▾`}</button>}
                {abierta === r.id && (
                  <div style={{ position: 'absolute', top: '100%', left: 0, marginTop: 6, background: '#fff', borderRadius: 12, padding: 8, display: 'grid', gap: 5,
                    boxShadow: '0 8px 24px rgba(38,40,37,.2)', minWidth: 180 }}>
                    {hijas(r.id).map(h => <div key={h.id}>{chip(h, true)}</div>)}
                  </div>
                )}
              </div>
            )
          })}
        </div>
        {/* Las del modo que no tienen sitio en el cuerpo, debajo del cuerpo */}
        {sinSitio.length > 0 && (
          <div style={{ position: 'absolute', left: '50%', bottom: 8, transform: 'translateX(-50%)', display: 'flex', gap: 5, flexWrap: 'wrap', justifyContent: 'center', maxWidth: '60vw', zIndex: 70 }}>
            {sinSitio.map(r => chip(r, true))}
          </div>
        )}
      </div>

      {/* ABAJO: el material, con sus iconos */}
      <div style={{ padding: '10px 16px 16px', background: 'rgba(255,255,255,.85)', boxShadow: '0 -4px 16px rgba(38,40,37,.08)' }}>
        <div style={{ fontSize: 11, letterSpacing: 1.2, textTransform: 'uppercase', color: 'var(--gr)', marginBottom: 6 }}>Material{nGrupo('material') ? ` · ${nGrupo('material')}` : ''}</div>
        <div style={{ display: 'flex', gap: 6, overflowX: 'auto', paddingBottom: 4 }}>{material.map(m => chip(m))}</div>
      </div>
    </div>
  )
}
