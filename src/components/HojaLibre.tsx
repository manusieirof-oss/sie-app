'use client'
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import {
  HOJA_W, HOJA_H, TINTAS, UNIDADES, ejercicioMasCerca,
  type Hoja, type Peg, type Tinta, type Trazo, type Punto, type Unidad,
} from '@/lib/hoja'

/**
 * HOJA LIBRE. Papel en blanco, cuatro tintas y pegatinas encima.
 *
 * El mismo componente sirve para prepararla y para el taller, porque en el taller se
 * tiene que ver EXACTAMENTE lo que se dibujo: si fueran dos pintados distintos, antes o
 * despues uno dejaria de coincidir con el otro. Lo que cambia es que en el taller el
 * dibujo no se toca y las casillas pasan a ser huecos donde apuntar lo hecho.
 *
 * No lee ni escribe en la base: recibe la hoja, la biblioteca y los objetivos, y
 * devuelve la hoja cambiada. Quien la usa decide cuando guardar.
 */

type Opcion = { id: string, nombre: string }
type Herr = 'boli' | 'goma' | 'peg:obj' | 'peg:ej' | 'peg:cas'

export default function HojaLibre({ hoja, onCambio, modo, biblioteca, objetivos, hechos = {}, onHecho, altoMax }: {
  hoja: Hoja
  onCambio?: (h: Hoja) => void
  modo: 'preparar' | 'taller'
  biblioteca: Opcion[]
  /** Los objetivos abiertos del paciente; sin paciente (plantilla), vacio. */
  objetivos: Opcion[]
  hechos?: Record<string, string>
  onHecho?: (casillaId: string, valor: string) => void
  /** Alto maximo en pantalla. Por defecto, lo que quede de ventana: la hoja se ve ENTERA mientras se dibuja. */
  altoMax?: number
}) {
  const prep = modo === 'preparar'
  const envol = useRef<HTMLDivElement>(null)
  const cv = useRef<HTMLCanvasElement>(null)
  const [ancho, setAncho] = useState(600)
  const [tinta, setTinta] = useState<Tinta>('azul')
  const [herr, setHerr] = useState<Herr>('boli')
  const [sel, setSel] = useState<string | null>(null)
  const historia = useRef<Hoja[]>([])
  const [hayDeshacer, setHayDeshacer] = useState(false)
  // La hoja "viva" mientras se dibuja: pasar cada punto por el estado del padre
  // repintaria todo React a 120 Hz con el Pencil. Se emite al levantar el lapiz.
  const viva = useRef<Hoja>(hoja)
  const actual = useRef<Trazo | null>(null)
  const borrando = useRef(false)
  // Si alguna vez se ha visto un lapiz, el dedo deja de pintar: la palma apoyada no ensucia.
  const hayLapiz = useRef(false)
  const escala = ancho / HOJA_W

  useEffect(() => { if (!actual.current && !borrando.current) viva.current = hoja }, [hoja])

  // ── tamano ──────────────────────────────
  useLayoutEffect(() => {
    const medir = () => {
      const el = envol.current; if (!el) return
      const top = el.getBoundingClientRect().top
      const alto = altoMax ?? Math.max(420, window.innerHeight - Math.max(top, 0) - 24)
      setAncho(Math.max(280, Math.min(el.clientWidth, alto * HOJA_W / HOJA_H)))
    }
    medir()
    const ro = new ResizeObserver(medir)
    if (envol.current) ro.observe(envol.current)
    window.addEventListener('resize', medir)
    return () => { ro.disconnect(); window.removeEventListener('resize', medir) }
  }, [altoMax])

  // ── pintar ──────────────────────────────
  const pintar = useCallback(() => {
    const c = cv.current; if (!c) return
    const dpr = window.devicePixelRatio || 1
    const w = Math.round(ancho * dpr), h = Math.round(ancho * HOJA_H / HOJA_W * dpr)
    if (c.width !== w || c.height !== h) { c.width = w; c.height = h }
    const ctx = c.getContext('2d')!
    ctx.setTransform(1, 0, 0, 1, 0, 0)
    ctx.clearRect(0, 0, c.width, c.height)
    ctx.setTransform(escala * dpr, 0, 0, escala * dpr, 0, 0)
    ctx.lineCap = 'round'; ctx.lineJoin = 'round'
    for (const s of viva.current.trazos) {
      const p = s.pts
      ctx.strokeStyle = ctx.fillStyle = TINTAS[s.c]
      if (p.length === 1) { ctx.beginPath(); ctx.arc(p[0][0], p[0][1], s.w * .6, 0, 7); ctx.fill(); continue }
      // Grosor segun la presion del lapiz: es lo que hace que parezca tinta y no un rotulador.
      for (let i = 1; i < p.length; i++) {
        const a = p[i - 1], b = p[i]
        const m0 = i > 1 ? [(p[i - 2][0] + a[0]) / 2, (p[i - 2][1] + a[1]) / 2] : a
        const m1 = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2]
        ctx.lineWidth = s.w * (.55 + b[2] * .9)
        ctx.beginPath(); ctx.moveTo(m0[0], m0[1]); ctx.quadraticCurveTo(a[0], a[1], m1[0], m1[1])
        if (i === p.length - 1) ctx.lineTo(b[0], b[1])
        ctx.stroke()
      }
    }
  }, [ancho, escala])
  useEffect(() => { pintar() }, [pintar, hoja])

  // ── cambios ─────────────────────────────
  const apunta = () => {
    historia.current.push(JSON.parse(JSON.stringify(viva.current)))
    if (historia.current.length > 60) historia.current.shift()
    setHayDeshacer(true)
  }
  const emitir = (h: Hoja) => { viva.current = h; onCambio?.(h) }
  const deshacer = () => {
    const h = historia.current.pop(); if (!h) return
    setHayDeshacer(historia.current.length > 0); setSel(null); emitir(h)
  }
  const cambiarPeg = (id: string, cambios: Partial<Peg>) => {
    apunta()
    emitir({ ...viva.current, pegs: viva.current.pegs.map(p => p.id === id ? { ...p, ...cambios } as Peg : p) })
  }
  const quitarPeg = (id: string) => {
    apunta(); setSel(null)
    emitir({ ...viva.current, pegs: viva.current.pegs.filter(p => p.id !== id) })
  }

  // ── lapiz ───────────────────────────────
  const punto = (e: { clientX: number, clientY: number, pointerType: string, pressure: number }): Punto => {
    const r = cv.current!.getBoundingClientRect()
    return [(e.clientX - r.left) / escala, (e.clientY - r.top) / escala, e.pointerType === 'pen' ? (e.pressure || .5) : .5]
  }
  const borrar = ([x, y]: Punto) => {
    const antes = viva.current.trazos.length
    const trazos = viva.current.trazos.filter(s => !s.pts.some(p => Math.hypot(p[0] - x, p[1] - y) < 16 + s.w))
    if (trazos.length !== antes) { viva.current = { ...viva.current, trazos }; pintar() }
  }
  const ponerPeg = (tipo: 'obj' | 'ej' | 'cas', x: number, y: number) => {
    apunta()
    const id = tipo + Date.now().toString(36) + Math.random().toString(36).slice(2, 5)
    let p: Peg
    if (tipo === 'obj') p = { id, tipo, x, y, objetivo_id: null, nombre: '' }
    else if (tipo === 'ej') p = { id, tipo, x, y, ejercicio_id: null, nombre: '' }
    else p = { id, tipo, x, y, unidad: 'kg', previsto: '', de: ejercicioMasCerca(viva.current, x, y)?.id ?? null }
    emitir({ ...viva.current, pegs: [...viva.current.pegs, p] })
    setSel(id); setHerr('boli')
  }
  const abajo = (e: React.PointerEvent) => {
    if (!prep) return
    if (e.pointerType === 'pen') hayLapiz.current = true
    if (e.pointerType === 'touch' && hayLapiz.current) return
    const p = punto(e)
    if (herr.startsWith('peg:')) { ponerPeg(herr.slice(4) as any, p[0], p[1]); return }
    cv.current!.setPointerCapture(e.pointerId)
    apunta()
    if (herr === 'goma') { borrando.current = true; borrar(p); return }
    setSel(null)
    actual.current = { c: tinta, w: 2.3, pts: [p] }
    viva.current = { ...viva.current, trazos: [...viva.current.trazos, actual.current] }
    pintar()
  }
  const mueve = (e: React.PointerEvent) => {
    if (borrando.current) { borrar(punto(e)); return }
    if (!actual.current) return
    const evs = (e.nativeEvent as any).getCoalescedEvents?.() || [e]
    for (const ev of evs) actual.current.pts.push(punto(ev))
    pintar()
  }
  const arriba = () => {
    if (!actual.current && !borrando.current) return
    actual.current = null; borrando.current = false
    emitir(viva.current)
  }

  // ── arrastrar pegatinas ─────────────────
  const arr = useRef<{ id: string, x0: number, y0: number, px: number, py: number, movido: boolean } | null>(null)
  const [arrastre, setArrastre] = useState<{ id: string, x: number, y: number } | null>(null)
  const pegAbajo = (e: React.PointerEvent, p: Peg) => {
    if (!prep) return
    e.preventDefault(); (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
    arr.current = { id: p.id, x0: e.clientX, y0: e.clientY, px: p.x, py: p.y, movido: false }
  }
  const pegMueve = (e: React.PointerEvent) => {
    const a = arr.current; if (!a) return
    const dx = (e.clientX - a.x0) / escala, dy = (e.clientY - a.y0) / escala
    if (!a.movido && Math.hypot(dx, dy) < 4) return
    a.movido = true
    setArrastre({ id: a.id, x: Math.max(0, Math.min(HOJA_W - 40, a.px + dx)), y: Math.max(20, Math.min(HOJA_H - 20, a.py + dy)) })
  }
  const pegArriba = () => {
    const a = arr.current; arr.current = null; if (!a) return
    if (a.movido && arrastre) cambiarPeg(a.id, { x: arrastre.x, y: arrastre.y })
    setArrastre(null); setSel(a.id)
  }

  const seleccionada = hoja.pegs.find(p => p.id === sel) || null
  const nombreEj = (id: string | null) => {
    const e = hoja.pegs.find(p => p.id === id)
    return e && e.tipo === 'ej' ? (e.nombre || 'Sin nombre') : null
  }

  // ── pintado ─────────────────────────────
  const boton = (activo: boolean): React.CSSProperties => ({
    height: 32, padding: '0 11px', borderRadius: 'var(--r)', fontSize: 12, cursor: 'pointer', fontFamily: 'inherit',
    border: `1px solid ${activo ? 'var(--gd)' : 'var(--bd)'}`, background: activo ? 'var(--gl)' : 'var(--w)',
    color: activo ? 'var(--gd)' : 'var(--n)',
  })

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {prep && (
        <div role="toolbar" aria-label="Útiles" style={{ display: 'flex', flexWrap: 'wrap', gap: '8px 12px', alignItems: 'center',
          background: 'var(--w)', border: '1px solid var(--bd)', borderRadius: 'var(--rl)', padding: '7px 11px' }}>
          <div style={{ display: 'flex', gap: 4 }}>
            {(Object.keys(TINTAS) as Tinta[]).map(t => (
              <button key={t} type="button" aria-label={t} aria-pressed={tinta === t && herr === 'boli'}
                onClick={() => { setTinta(t); setHerr('boli') }}
                style={{ width: 32, height: 32, borderRadius: 99, padding: 0, cursor: 'pointer', background: 'transparent',
                  border: `2px solid ${tinta === t && herr === 'boli' ? 'var(--n)' : 'transparent'}`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <span style={{ width: 20, height: 20, borderRadius: 99, background: TINTAS[t] }} />
              </button>
            ))}
          </div>
          <button type="button" style={boton(herr === 'goma')} aria-pressed={herr === 'goma'} onClick={() => setHerr(herr === 'goma' ? 'boli' : 'goma')}>Goma</button>
          <button type="button" style={{ ...boton(false), opacity: hayDeshacer ? 1 : .4 }} disabled={!hayDeshacer} onClick={deshacer}>Deshacer</button>
          <span style={{ width: 1, height: 24, background: 'var(--bd)' }} />
          <span style={{ fontSize: 10, fontWeight: 600, color: 'var(--grl)', letterSpacing: .5, textTransform: 'uppercase' }}>Pegar</span>
          {([['obj', 'Objetivo'], ['ej', 'Ejercicio'], ['cas', 'Casilla de dato']] as const).map(([t, n]) => (
            <button key={t} type="button" style={boton(herr === 'peg:' + t)} aria-pressed={herr === 'peg:' + t}
              onClick={() => setHerr(herr === 'peg:' + t ? 'boli' : ('peg:' + t) as Herr)}>{n}</button>
          ))}
        </div>
      )}

      <div style={{ display: 'flex', gap: 14, alignItems: 'flex-start', flexWrap: 'wrap' }}>
        <div ref={envol} style={{ flex: '1 1 420px', minWidth: 0, display: 'flex', justifyContent: 'center' }}>
          <div style={{ position: 'relative', width: ancho, height: ancho * HOJA_H / HOJA_W, background: '#fff',
            border: '1px solid #D9D5CC', borderRadius: 3, boxShadow: '0 1px 2px rgba(0,0,0,.08),0 10px 30px rgba(0,0,0,.12)' }}>
            <canvas ref={cv} aria-label="Hoja de la sesión"
              onPointerDown={abajo} onPointerMove={mueve} onPointerUp={arriba} onPointerCancel={arriba}
              style={{ display: 'block', width: '100%', height: '100%', touchAction: 'none',
                cursor: !prep ? 'default' : herr === 'goma' ? 'cell' : herr.startsWith('peg:') ? 'copy' : 'crosshair' }} />
            <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', fontSize: Math.max(10, 21 * escala) }}>
              {hoja.pegs.map(p => {
                const pos = arrastre?.id === p.id ? arrastre : p
                return (
                  <div key={p.id} onPointerDown={e => pegAbajo(e, p)} onPointerMove={pegMueve} onPointerUp={pegArriba}
                    style={{ position: 'absolute', left: `${pos.x / HOJA_W * 100}%`, top: `${pos.y / HOJA_H * 100}%`,
                      transform: 'translateY(-50%)', pointerEvents: 'auto', touchAction: 'none', userSelect: 'none',
                      cursor: prep ? 'grab' : 'default', outline: prep && sel === p.id ? '.14em solid #2A2B28' : 'none',
                      outlineOffset: '.12em', borderRadius: p.tipo === 'cas' ? '.35em' : 99 }}>
                    <Pegatina p={p} taller={!prep} valor={hechos[p.id] || ''} onValor={v => onHecho?.(p.id, v)} />
                  </div>
                )
              })}
            </div>
          </div>
        </div>

        {prep && seleccionada && (
          <Editor p={seleccionada} biblioteca={biblioteca} objetivos={objetivos}
            ejercicios={hoja.pegs.filter(x => x.tipo === 'ej').map(x => ({ id: x.id, nombre: nombreEj(x.id) || '' }))}
            onCambio={c => cambiarPeg(seleccionada.id, c)} onQuitar={() => quitarPeg(seleccionada.id)} onListo={() => setSel(null)} />
        )}
      </div>
    </div>
  )
}

/**
 * Colores fijos y no del tema: la pegatina va sobre papel blanco, y el papel es blanco
 * tambien de noche.
 */
function Pegatina({ p, taller, valor, onValor }: { p: Peg, taller: boolean, valor: string, onValor: (v: string) => void }) {
  const base: React.CSSProperties = { display: 'flex', alignItems: 'center', gap: '.35em', whiteSpace: 'nowrap', lineHeight: 1.3,
    borderRadius: 99, padding: '.22em .7em', boxShadow: '0 .08em .3em rgba(0,0,0,.12)', fontFamily: 'inherit' }
  if (p.tipo === 'obj') return (
    <div style={{ ...base, background: '#E3F0F1', color: '#2E5E65', border: '.07em solid #8FBFC5' }}>
      <span style={{ width: '.6em', height: '.6em', borderRadius: 99, border: '.14em solid currentColor' }} />
      {p.nombre || 'Elige objetivo'}
    </div>
  )
  if (p.tipo === 'ej') return (
    <div style={{ ...base, background: '#fff', color: '#2A2B28', border: `.07em ${p.ejercicio_id ? 'solid' : 'dashed'} #B9B4A8` }}>
      <span style={{ width: '.5em', height: '.5em', borderRadius: 99, background: p.ejercicio_id ? '#5A969E' : 'transparent',
        border: p.ejercicio_id ? 'none' : '.1em solid #C9A84C' }} />
      {p.nombre || 'Elige ejercicio'}
    </div>
  )
  const caja: React.CSSProperties = { minWidth: '2.4em', width: '2.8em', height: '1.35em', border: '.07em solid #C9A84C', borderRadius: '.2em',
    background: '#fff', textAlign: 'center', fontFamily: 'inherit', fontSize: '1em', padding: 0 }
  return (
    <div style={{ ...base, borderRadius: '.35em', padding: '.18em .45em', gap: '.3em', background: '#FFF8E6', border: '.07em solid #C9A84C', color: '#6B4E00' }}>
      {taller
        ? <input value={valor} placeholder={p.previsto || '–'} inputMode="decimal" aria-label={`${p.unidad} hechos`}
            onChange={e => onValor(e.target.value)} style={{ ...caja, color: TINTAS.azul, fontWeight: 600 }} />
        : <span style={{ ...caja, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#8A7A55' }}>{p.previsto}</span>}
      <span style={{ fontSize: '.85em' }}>{p.unidad}</span>
    </div>
  )
}

const norm = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')

function Editor({ p, biblioteca, objetivos, ejercicios, onCambio, onQuitar, onListo }: {
  p: Peg, biblioteca: Opcion[], objetivos: Opcion[], ejercicios: Opcion[]
  onCambio: (c: Partial<Peg>) => void, onQuitar: () => void, onListo: () => void
}) {
  // El nombre del ejercicio se escribe aqui y se guarda al salir del campo: cada tecla
  // en el historial haria que "Deshacer" fuera letra a letra.
  const [texto, setTexto] = useState(p.tipo === 'ej' ? p.nombre : '')
  useEffect(() => { setTexto(p.tipo === 'ej' ? p.nombre : '') }, [p.id]) // eslint-disable-line react-hooks/exhaustive-deps
  const et: React.CSSProperties = { fontSize: 10, fontWeight: 600, color: 'var(--grl)', letterSpacing: .5, textTransform: 'uppercase', margin: '14px 0 6px' }
  const op = (activo: boolean): React.CSSProperties => ({ font: 'inherit', fontSize: 12, textAlign: 'left', width: '100%', padding: '7px 10px',
    borderRadius: 'var(--r)', border: `1px solid ${activo ? 'var(--g)' : 'var(--bd2)'}`, background: activo ? 'var(--gl)' : 'var(--w)',
    color: activo ? 'var(--gd)' : 'var(--n)', cursor: 'pointer', display: 'block', marginBottom: 5 })
  const tit = { obj: 'Pegatina de objetivo', ej: 'Pegatina de ejercicio', cas: 'Casilla de dato' }[p.tipo]

  return (
    <aside style={{ flex: '0 1 300px', minWidth: 240, background: 'var(--w)', border: '1px solid var(--bd)', borderRadius: 'var(--rl)', padding: '14px 16px' }}>
      <div style={{ fontSize: 10, fontWeight: 600, color: 'var(--gr)', letterSpacing: .5, textTransform: 'uppercase', marginBottom: 10 }}>{tit}</div>

      {p.tipo === 'obj' && (objetivos.length
        ? objetivos.map(o => <button key={o.id} type="button" style={op(p.objetivo_id === o.id)} onClick={() => onCambio({ objetivo_id: o.id, nombre: o.nombre })}>{o.nombre}</button>)
        : <div style={{ fontSize: 12, color: 'var(--grl)', fontStyle: 'italic' }}>El paciente no tiene objetivos abiertos.</div>)}

      {p.tipo === 'ej' && (() => {
        const q = norm(texto.trim())
        const lista = biblioteca.filter(b => !q || norm(b.nombre).includes(q)).slice(0, 7)
        return <>
          <input className="input" value={texto} placeholder="Nombre del ejercicio" autoComplete="off" style={{ width: '100%' }}
            onChange={e => setTexto(e.target.value)}
            onBlur={() => { if (texto !== p.nombre) onCambio({ nombre: texto, ejercicio_id: biblioteca.find(b => b.nombre === texto)?.id ?? null }) }} />
          <div style={et}>De la biblioteca</div>
          {lista.length
            ? lista.map(b => <button key={b.id} type="button" style={op(p.ejercicio_id === b.id)}
                onMouseDown={e => e.preventDefault()}
                onClick={() => { setTexto(b.nombre); onCambio({ ejercicio_id: b.id, nombre: b.nombre }) }}>{b.nombre}</button>)
            : <div style={{ fontSize: 12, color: 'var(--grl)', fontStyle: 'italic' }}>No está en la biblioteca: se guarda con este nombre.</div>}
        </>
      })()}

      {p.tipo === 'cas' && <>
        <div style={{ ...et, marginTop: 0 }}>Qué se apunta</div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
          {UNIDADES.map(u => <button key={u} type="button" style={{ ...op(p.unidad === u), width: 'auto', margin: 0, padding: '5px 11px' }}
            onClick={() => onCambio({ unidad: u as Unidad })}>{u}</button>)}
        </div>
        <div style={et}>Previsto (opcional)</div>
        <input className="input" inputMode="decimal" defaultValue={p.previsto} key={p.id} placeholder="p. ej. 16" style={{ width: '100%' }}
          onBlur={e => { if (e.target.value !== p.previsto) onCambio({ previsto: e.target.value }) }} />
        <div style={et}>De qué ejercicio</div>
        {ejercicios.length
          ? ejercicios.map(e => <button key={e.id} type="button" style={op(p.de === e.id)} onClick={() => onCambio({ de: e.id })}>{e.nombre || 'Sin nombre'}</button>)
          : <div style={{ fontSize: 12, color: 'var(--grl)', fontStyle: 'italic' }}>Pega antes un ejercicio.</div>}
      </>}

      <div style={{ display: 'flex', gap: 8, marginTop: 14, paddingTop: 12, borderTop: '1px solid var(--bd2)' }}>
        <button type="button" className="btn btn-sm" onClick={onListo}>Hecho</button>
        <button type="button" className="btn btn-sm" style={{ color: 'var(--gr)', borderColor: 'var(--bd)' }} onClick={onQuitar}>Quitar pegatina</button>
      </div>
    </aside>
  )
}

