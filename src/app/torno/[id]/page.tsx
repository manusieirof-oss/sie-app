'use client'
import ImagenEjercicio from '@/components/ImagenEjercicio'
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { Ic } from '@/lib/icons'
import { traerTodo } from '@/lib/paginar'
import { cargarSistemas, PROGRESIONES } from '@/lib/sistemas'
import { sugerirObjetivos } from '@/lib/ejercicioObjetivos'
import MonedaObjetivo from '@/components/MonedaObjetivo'
import Torneado from './Torneado'

// ---------------------------------------------------------------------------
// EL BANCO DEL TORNO
//
// Donde se programa a mano, pero sin escribir: se eligen sus objetivos (las
// esferas de arriba) y se ve flotando lo que la biblioteca ya tiene para ellos
// —ciclos, sesiones y ejercicios—. Se elige lo que sirve y se acepta.
//
// La idea es aprovechar lo que ya está hecho: un ciclo, una sesión o un
// ejercicio de la biblioteca ya dicen qué objetivo trabajan, así que no hay que
// buscar a ciegas. Lo que no trabaja ninguno de sus objetivos ni sale.
//
// Las tres alturas van a distinta "distancia": ciclos delante y grandes,
// sesiones detrás, ejercicios al fondo y pequeños. Al pinchar una esfera, lo que
// la trabaja sube, se ilumina y se une a ella con un hilo; lo demás se hunde.
// ---------------------------------------------------------------------------

type Item = {
  clave: string
  tipo: 'c' | 's' | 'e'
  id: string
  nombre: string
  imagen?: string
  imagenes?: string[]
  color?: string
  sub?: string
  /** Objetivos SUYOS que trabaja. Fuera de sus objetivos no interesa. */
  objs: string[]
  /** Lo que lleva dentro: sesiones de un ciclo, ejercicios de una sesión. */
  dentro: string[]
  /** Ejercicio: la portada de su familia, si es variante. */
  portada?: string
  /** Ejercicio portada: las claves de sus variantes que trabajan algo suyo. */
  familia?: string[]
}


export default function BancoPage({ params }: { params: { id: string } }) {
  const router = useRouter()
  const pid = params.id
  // Con useSearchParams y no con window.location: al llegar navegando, durante el
  // primer render la barra de direcciones todavía tiene la URL de la página anterior.
  const sp = useSearchParams()
  const cfg = { modo: sp.get('modo') || 'sesion', prog: sp.get('prog') || 'objetivos', fin: sp.get('fin') || '' }
  const [nombre, setNombre] = useState('')
  const [objs, setObjs] = useState<any[]>([])
  const [items, setItems] = useState<Item[]>([])
  const [cargando, setCargando] = useState(true)
  const [selObj, setSelObj] = useState<string[]>([])
  const [elegidos, setElegidos] = useState<string[]>([])
  const [encima, setEncima] = useState<string | null>(null)
  const [aceptado, setAceptado] = useState(false)
  // Lo crudo de la biblioteca, para poder tornearlo después de aceptar.
  const [bib, setBib] = useState<{ ses: Record<string, any>, ciclos: Record<string, any>, ej: Record<string, any> }>({ ses: {}, ciclos: {}, ej: {} })

  useEffect(() => { cargar() }, [pid]) // eslint-disable-line react-hooks/exhaustive-deps

  async function cargar() {
    setCargando(true)
    const [{ data: p }, { data: po }] = await Promise.all([
      supabase.from('pacientes').select('nombre,apellidos,nombre_clinica').eq('id', pid).maybeSingle(),
      supabase.from('pacientes_objetivos')
        .select('objetivo_id,logrado,nombre,objetivos(id,nombre,imagen_url,etiquetas,articulacion_id,movimientos)')
        .eq('paciente_id', pid),
    ])
    setNombre((p?.nombre_clinica || `${p?.nombre || ''} ${p?.apellidos || ''}`).trim())
    // Solo los abiertos: lo ya logrado no se programa.
    const abiertos = (po || []).filter((r: any) => !r.logrado && r.objetivos)
      .map((r: any) => ({ ...r.objetivos, nombre: r.nombre || r.objetivos.nombre }))
    setObjs(abiertos)
    const suyos = new Set(abiertos.map((o: any) => o.id))
    const corta = (ids: string[]) => Array.from(new Set(ids.filter(id => suyos.has(id))))

    const [ciclos, { filas: ses }, { filas: ejs }] = await Promise.all([
      cargarSistemas(),
      traerTodo<any>((d, h) => supabase.from('sesiones')
        .select('id,nombre,partes,sesiones_objetivos(objetivo_id)').is('paciente_id', null).order('id').range(d, h)),
      traerTodo<any>((d, h) => supabase.from('ejercicios')
        .select('id,nombre,imagen_url,etiquetas,portada_id,tipo_medida,variantes').order('id').range(d, h)),
    ])

    // EJERCICIOS: por lo que dicen las sesiones (el vínculo guardado) y, si no, por
    // etiquetas, igual que la sugerencia al montar una sesión.
    const porVinculo: Record<string, string[]> = {}
    ses.forEach((s: any) => (s.partes || []).forEach((pt: any) => (pt.ejercicios || []).forEach((ej: any) => {
      if (ej?.ejercicio_id && Array.isArray(ej.objetivos)) porVinculo[ej.ejercicio_id] = [...(porVinculo[ej.ejercicio_id] || []), ...ej.objetivos]
    })))
    const ejTodos: Item[] = ejs.map((e: any) => ({
      clave: 'e:' + e.id, tipo: 'e' as const, id: e.id, nombre: e.nombre, imagen: e.imagen_url || '',
      objs: corta([...(porVinculo[e.id] || []), ...sugerirObjetivos(e.etiquetas || [], abiertos)]), dentro: [],
      portada: e.portada_id || undefined,
    }))
    /* FAMILIAS: en la banda sale la portada con sus variantes plegadas. La portada
       entra si ella o alguna variante trabaja algo suyo, y lleva los objetivos de toda
       la familia; así no salen 25 curls flotando. */
    const hayId = new Set(ejTodos.map(i => i.id))
    const vars = (pid: string) => ejTodos.filter(i => i.portada === pid && i.objs.length > 0)
    const ejItems: Item[] = []
    ejTodos.forEach(i => {
      if (i.portada && hayId.has(i.portada)) { if (i.objs.length > 0) ejItems.push(i); return }
      const v = vars(i.id)
      const objsFam = corta([...i.objs, ...v.flatMap(x => x.objs)])
      if (objsFam.length === 0) return
      ejItems.push({ ...i, objs: objsFam, portada: undefined, familia: v.map(x => x.clave) })
    })

    const imgDe: Record<string, string> = {}
    ejs.forEach((e: any) => { if (e.imagen_url) imgDe[e.id] = e.imagen_url })
    const sesItems: Item[] = ses.map((s: any) => {
      const ejIds = (s.partes || []).flatMap((pt: any) => (pt.ejercicios || []).map((ej: any) => ej.ejercicio_id)).filter(Boolean)
      return {
        clave: 's:' + s.id, tipo: 's' as const, id: s.id, nombre: s.nombre || 'Sesión',
        imagenes: Array.from(new Set(ejIds.map((id: string) => imgDe[id]).filter(Boolean))).slice(0, 3) as string[],
        sub: `${(s.partes || []).length} partes · ${ejIds.length} ejercicios`,
        objs: corta((s.sesiones_objetivos || []).map((r: any) => r.objetivo_id)),
        dentro: Array.from(new Set<string>(ejIds.map((id: string) => 'e:' + id))),
      }
    }).filter(i => i.objs.length > 0)

    const cicItems: Item[] = (ciclos || []).map((c: any) => {
      const sesIds = (c.fases || []).flatMap((f: any) => f.sesiones || [])
      return {
        clave: 'c:' + c.id, tipo: 'c' as const, id: c.id, nombre: c.nombre, color: c.color || '#5A969E',
        sub: `${(c.fases || []).length} fase${(c.fases || []).length === 1 ? '' : 's'} · ${PROGRESIONES.find(p => p.valor === c.progresion)?.nombre || ''}`,
        objs: corta((c.fases || []).flatMap((f: any) => f.objetivos || [])),
        dentro: sesIds.map((id: string) => 's:' + id),
      }
    }).filter(i => i.objs.length > 0)

    setBib({
      ses: Object.fromEntries(ses.map((s: any) => [s.id, s])),
      ciclos: Object.fromEntries((ciclos || []).map((c: any) => [c.id, c])),
      ej: Object.fromEntries(ejs.map((e: any) => [e.id, e])),
    })
    // En modo SESIÓN los ciclos no se programan: no salen.
    setItems([...(cfg.modo === 'ciclo' ? cicItems : []), ...sesItems, ...ejItems])
    setCargando(false)
  }

  // ---- Qué se ve encendido -------------------------------------------------
  const nivel = (i: Item) => {
    if (selObj.length === 0) return 1
    const n = i.objs.filter(o => selObj.includes(o)).length
    return n === 0 ? 0 : n === selObj.length ? 2 : 1
  }
  // Lo que hay dentro de lo que tienes debajo del dedo: se ilumina.
  const relacionados = useMemo(() => {
    if (!encima) return new Set<string>()
    const it = items.find(i => i.clave === encima)
    const out = new Set<string>(it?.dentro || [])
    // Un ciclo ilumina también los ejercicios de sus sesiones.
    ;(it?.dentro || []).forEach(k => items.find(i => i.clave === k)?.dentro.forEach(x => out.add(x)))
    return out
  }, [encima, items])

  const ordenar = (lista: Item[]) => [...lista].sort((a, b) =>
    (nivel(b) - nivel(a)) || (b.objs.length - a.objs.length) || a.nombre.localeCompare(b.nombre))

  // Familias desplegadas en la banda de ejercicios.
  const [familiasAbiertas, setFamiliasAbiertas] = useState<string[]>([])
  const banda = (tipo: Item['tipo']) => {
    const lista = ordenar(items.filter(i => i.tipo === tipo && !(tipo === 'e' && i.portada)))
    if (tipo !== 'e') return lista
    // Cada portada abierta lleva detrás sus variantes.
    return lista.flatMap(i => familiasAbiertas.includes(i.clave)
      ? [i, ...items.filter(x => (i.familia || []).includes(x.clave))] : [i])
  }
  const toggle = (k: string) => setElegidos(p => p.includes(k) ? p.filter(x => x !== k) : [...p, k])

  // ---- Los hilos ------------------------------------------------------------
  // Del pie de cada esfera pinchada a lo que la trabaja. Se redibujan en cada
  // fotograma porque las tarjetas flotan; se pinta el SVG a mano para no volver
  // a pintar toda la página sesenta veces por segundo.
  const lienzo = useRef<HTMLDivElement>(null)
  const svg = useRef<SVGSVGElement>(null)
  const refs = useRef<Record<string, HTMLElement | null>>({})
  useLayoutEffect(() => {
    if (aceptado || selObj.length === 0) { if (svg.current) svg.current.innerHTML = ''; return }
    let vivo = true
    let ultimo = ''
    const pinta = () => {
      if (!vivo || !svg.current || !lienzo.current) return
      if (document.hidden) { requestAnimationFrame(pinta); return }
      const base = lienzo.current.getBoundingClientRect()
      let html = ''
      let n = 0
      for (const oid of selObj) {
        const esf = refs.current['o:' + oid]
        if (!esf) continue
        const a = esf.getBoundingClientRect()
        const x1 = a.left + a.width / 2 - base.left, y1 = a.bottom - base.top
        for (const it of items) {
          if (n > 140) break
          if (!it.objs.includes(oid) || it.tipo === 'e') continue
          const el = refs.current[it.clave]
          if (!el) continue
          const b = el.getBoundingClientRect()
          const x2 = b.left + b.width / 2 - base.left, y2 = b.top - base.top
          const my = (y1 + y2) / 2
          html += `<path d="M${x1},${y1} C${x1},${my} ${x2},${my} ${x2},${y2}" />`
          n++
        }
      }
      // Solo se reescribe si algo se ha movido: reescribir el SVG en cada fotograma
      // obligaba al navegador a recalcular la página sesenta veces por segundo.
      if (html !== ultimo) { svg.current.innerHTML = html; ultimo = html }
      requestAnimationFrame(pinta)
    }
    requestAnimationFrame(pinta)
    return () => { vivo = false }
  }, [selObj, items, aceptado])

  const elegidosItems = elegidos.map(k => items.find(i => i.clave === k)).filter(Boolean) as Item[]
  const modoTxt = cfg.modo === 'ciclo'
    ? `Ciclo · ${PROGRESIONES.find(p => p.valor === cfg.prog)?.nombre || ''}${cfg.fin ? ` hasta el ${new Date(cfg.fin + 'T12:00:00').toLocaleDateString('es-ES', { day: 'numeric', month: 'short' })}` : ''}`
    : 'Sesión'

  return (
    <div className="banco" ref={lienzo}>
      <style>{`
        .banco { background:#fff; margin:-16px -18px; padding:18px 22px 110px; min-height:calc(100vh - 32px);
                 position:relative; overflow:hidden }
        .banco svg.hilos { position:absolute; inset:0; width:100%; height:100%; pointer-events:none; z-index:1 }
        .banco svg.hilos path { fill:none; stroke:var(--g); stroke-width:1; opacity:.28 }
        @keyframes b-flota { 0%,100% { translate:0 0 } 50% { translate:0 -5px } }
        /* La entrada solo con 'backwards': si se quedara puesta al acabar, taparía la
           opacidad y el hundido de lo apagado. Flotar va en 'translate' y lo apagado en
           'transform': son propiedades distintas y no se pisan. */
        @keyframes b-entra { from { opacity:0; scale:.96 } to { opacity:1; scale:1 } }
        .b-it { position:relative; z-index:2; cursor:pointer; animation: b-entra .5s ease backwards, b-flota 6s ease-in-out infinite;
                transition: opacity .35s ease, transform .35s ease, filter .35s ease, box-shadow .2s ease }
        .b-it.apagado { opacity:.14; transform:translateY(10px) scale(.95); filter:grayscale(.7) }
        .b-it.sube { transform:translateY(-6px) }
        /* Variante desplegada: junto a su portada, algo más pequeña. scale y no transform, para no pisar la flotación. */
        .b-it.b-var { scale:.86; box-shadow:0 0 0 1.5px var(--gm) }
        .b-it.rel { box-shadow:0 0 0 2px var(--gm) }
        .b-it.elegido { box-shadow:0 0 0 3px var(--g), 0 14px 30px rgba(38,40,37,.16) }
        .b-esf { display:flex; flex-direction:column; align-items:center; gap:5px; width:92px; background:none; border:none;
                 cursor:pointer; font-family:inherit; transition: transform .25s ease, opacity .25s ease }
        .b-esf:hover { transform:translateY(-3px) }
        .b-esf.off { opacity:.35 }
        .b-esf.on .obj-moneda { box-shadow: 0 0 0 4px var(--gl), 0 0 0 6px var(--g), 0 6px 18px rgba(38,40,37,.25) !important }
        .b-banda { display:flex; flex-wrap:wrap; gap:14px; justify-content:center; margin:0 auto 34px; max-width:1200px }
        .b-rot { text-align:center; font-size:10px; letter-spacing:.8px; text-transform:uppercase; color:var(--grl); margin-bottom:12px }
      `}</style>
      <svg className="hilos" ref={svg}/>

      {/* CABECERA: quién y qué se le está haciendo. */}
      <div style={{ position: 'relative', zIndex: 2, display: 'flex', alignItems: 'center', gap: 10, marginBottom: 18 }}>
        <button className="btn btn-t btn-sm" onClick={() => aceptado ? setAceptado(false) : router.push('/torno')}>
          ← {aceptado ? 'Volver a elegir' : 'Torno'}
        </button>
        <div style={{ flex: 1, textAlign: 'center' }}>
          <div style={{ fontSize: 17 }}>{nombre || '…'}</div>
          <div style={{ fontSize: 11.5, color: 'var(--gd)' }}>{modoTxt}</div>
        </div>
        <div style={{ width: 90 }}/>
      </div>

      {/* LAS ESFERAS: lo que manda. Centradas, de izquierda a derecha. */}
      <div style={{ position: 'relative', zIndex: 2, display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: 12, marginBottom: 40 }}>
        {objs.map(o => {
          const on = selObj.includes(o.id)
          return (
            <button key={o.id} type="button" ref={el => { refs.current['o:' + o.id] = el }}
              className={`b-esf ${on ? 'on' : selObj.length > 0 ? 'off' : ''}`}
              onClick={() => setSelObj(p => p.includes(o.id) ? p.filter(x => x !== o.id) : [...p, o.id])}
              title={on ? 'Pulsa para soltarlo' : 'Ver lo que lo trabaja'}>
              <MonedaObjetivo objetivo={o} titulo=""/>
              <span style={{ fontSize: 11, lineHeight: 1.25, textAlign: 'center', color: on ? 'var(--gd)' : 'var(--n)', fontWeight: on ? 600 : 400 }}>{o.nombre}</span>
            </button>
          )
        })}
        {!cargando && objs.length === 0 && (
          <div style={{ fontSize: 13, color: 'var(--gr)' }}>No tiene objetivos abiertos. Pónselos en su ficha y vuelve.</div>
        )}
      </div>

      {cargando && <div className="muted" style={{ textAlign: 'center', padding: 40, position: 'relative', zIndex: 2 }}>Trayendo la biblioteca…</div>}

      {/* LO ELEGIBLE, a tres distancias. */}
      {!cargando && !aceptado && (['c', 's', 'e'] as const).map(tipo => {
        const lista = banda(tipo)
        if (lista.length === 0) return null
        return (
          <div key={tipo} style={{ position: 'relative', zIndex: 2 }}>
            <div className="b-rot">{tipo === 'c' ? 'Ciclos' : tipo === 's' ? 'Sesiones' : 'Ejercicios'}</div>
            <div className="b-banda">
              {lista.map((it, i) => {
                const nv = nivel(it)
                const cls = `b-it ${nv === 0 ? 'apagado' : nv === 2 && selObj.length > 0 ? 'sube' : ''} ${relacionados.has(it.clave) ? 'rel' : ''} ${elegidos.includes(it.clave) ? 'elegido' : ''}`
                const anim = { animationDelay: `${Math.min(i, 20) * 30}ms, ${(i * 0.37) % 3}s`, animationDuration: `.5s, ${5 + (i % 4)}s` }
                return (
                  <Tarjeta key={it.clave} it={it} cls={cls + (it.portada ? ' b-var' : '')} estilo={anim} objs={objs}
                    abierta={familiasAbiertas.includes(it.clave)}
                    onFamilia={() => setFamiliasAbiertas(l => l.includes(it.clave) ? l.filter(x => x !== it.clave) : [...l, it.clave])}
                    refEl={el => { refs.current[it.clave] = el }}
                    onClick={() => toggle(it.clave)}
                    onEncima={v => setEncima(v ? it.clave : null)}/>
                )
              })}
            </div>
          </div>
        )
      })}

      {/* DESPUÉS DE ACEPTAR: solo lo elegido. A la izquierda lo que hay, a la derecha
          lo que se le va a programar. (Arrastrar y tornear, en el siguiente paso.) */}
      {aceptado && (
        <Torneado modo={cfg.modo === 'ciclo' ? 'ciclo' : 'sesion'} bib={bib} objs={objs}
          pid={pid} paciente={nombre} prog={cfg.prog} fin={cfg.fin}
          onACitas={(g: { tipo: 'sesion' | 'ciclo', id: string }[]) => {
            const ses = g.filter(x => x.tipo === 'sesion').map(x => x.id).join(',')
            const sis = g.filter(x => x.tipo === 'ciclo').map(x => x.id).join(',')
            router.push(`/torno/${pid}/citas?${new URLSearchParams({ ...(ses ? { ses } : {}), ...(sis ? { sis } : {}) }).toString()}`)
          }}
          elegidos={elegidosItems.map(it => ({ tipo: it.tipo, id: it.id, nombre: it.nombre, color: it.color }))}/>
      )}

      {/* ACEPTAR, abajo y fijo: se ve siempre lo elegido. */}
      {!aceptado && elegidos.length > 0 && (
        <div style={{ position: 'fixed', left: 0, right: 0, bottom: 22, display: 'flex', justifyContent: 'center', zIndex: 20, pointerEvents: 'none' }}>
          <div style={{ pointerEvents: 'auto', display: 'flex', alignItems: 'center', gap: 12, background: 'var(--w)', border: '1px solid var(--bd)',
            borderRadius: 99, padding: '8px 10px 8px 18px', boxShadow: '0 12px 30px rgba(38,40,37,.18)', animation: 'b-entra .3s ease backwards' }}>
            <span style={{ fontSize: 13 }}>{elegidos.length} elegido{elegidos.length === 1 ? '' : 's'}</span>
            <button className="btn btn-t btn-sm" onClick={() => setElegidos([])}>Quitar</button>
            <button className="btn btn-p" onClick={() => setAceptado(true)}><Ic name="ok" size={13}/> Aceptar</button>
          </div>
        </div>
      )}
    </div>
  )
}

/** Una tarjeta del banco: ciclo grande, sesión mediana, ejercicio pequeño. */
function Tarjeta({ it, cls, estilo, objs, refEl, onClick, onEncima, abierta, onFamilia }: {
  it: Item, cls: string, estilo: any, objs: any[], abierta?: boolean, onFamilia?: () => void,
  refEl: (el: HTMLElement | null) => void, onClick: () => void, onEncima: (v: boolean) => void,
}) {
  const esferas = (
    <div style={{ display: 'flex', justifyContent: 'center', gap: 2, marginTop: 6 }}>
      {it.objs.map(id => { const o = objs.find(x => x.id === id); return o ? <MonedaObjetivo key={id} objetivo={o} tam="mini"/> : null })}
    </div>
  )
  const comun = { ref: refEl as any, className: cls, onClick, onMouseEnter: () => onEncima(true), onMouseLeave: () => onEncima(false) }
  if (it.tipo === 'c') return (
    <div {...comun} style={{ ...estilo, width: 230, background: '#fff', borderRadius: 14, border: '1px solid var(--bd)', overflow: 'hidden' }}>
      <div style={{ height: 8, background: it.color }}/>
      <div style={{ padding: '12px 14px', textAlign: 'center' }}>
        <div style={{ fontSize: 14 }}>{it.nombre}</div>
        <div style={{ fontSize: 11, color: 'var(--grl)', marginTop: 2 }}>{it.sub}</div>
        {esferas}
      </div>
    </div>
  )
  if (it.tipo === 's') return (
    <div {...comun} style={{ ...estilo, width: 176, background: '#fff', borderRadius: 12, border: '1px solid var(--bd)', overflow: 'hidden' }}>
      <div style={{ display: 'flex', height: 70, background: 'var(--bl)' }}>
        {(it.imagenes || []).map((src, k) => <img key={k} src={src} alt="" style={{ flex: 1, minWidth: 0, objectFit: 'cover' }}/>)}
      </div>
      <div style={{ padding: '8px 10px', textAlign: 'center' }}>
        <div style={{ fontSize: 12.5, lineHeight: 1.3 }}>{it.nombre}</div>
        <div style={{ fontSize: 10, color: 'var(--grl)', marginTop: 1 }}>{it.sub}</div>
        {esferas}
      </div>
    </div>
  )
  return (
    <div {...comun} style={{ ...estilo, width: 96, textAlign: 'center', borderRadius: 10, background: '#fff', padding: 4, position: 'relative' }}>
      {/* Sus variantes: tocar el número las despliega a su lado. */}
      {(it.familia || []).length > 0 && (
        <span onClick={e => { e.stopPropagation(); onFamilia?.() }} title={abierta ? 'Plegar sus variantes' : 'Ver sus variantes'}
          style={{ position: 'absolute', top: -6, right: -6, minWidth: 22, height: 22, padding: '0 6px', borderRadius: 99, zIndex: 3,
            background: abierta ? 'var(--g)' : '#fff', color: abierta ? '#fff' : 'var(--gd)', fontSize: 11, fontWeight: 600, cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 2px 8px rgba(38,40,37,.2)' }}>
          {abierta ? '−' : `+${it.familia!.length}`}
        </span>
      )}
      <ImagenEjercicio insignias={false} src={it.imagen} ejercicioId={it.id} fondo="var(--bl)"/>
      <div style={{ fontSize: 10, lineHeight: 1.25, marginTop: 4 }}>{it.nombre}</div>
    </div>
  )
}
