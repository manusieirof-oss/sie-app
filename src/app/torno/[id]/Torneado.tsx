'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import MonedaObjetivo from '@/components/MonedaObjetivo'
import { sugerirObjetivos } from '@/lib/ejercicioObjetivos'
import { guardarSesionTorno, guardarCicloTorno } from '@/lib/tornoGuardar'

// ---------------------------------------------------------------------------
// TORNEAR Y ARRASTRAR
//
// A la izquierda, lo elegido en el banco. "Tornear" lo abre por dentro: un ciclo
// en sus fases y sesiones, una sesión en sus partes y ejercicios. Cada pieza se
// puede llevar a la derecha, que es lo que se le va a programar:
//
//   - un CICLO entero rellena las fases;
//   - una SESIÓN va a la fase donde la sueltes;
//   - una PARTE entra en la sesión destino en su sitio, según el orden que tenía en
//     su sesión (el calentamiento delante, la vuelta a la calma detrás). Si ya hay
//     una parte que se llama igual, sus ejercicios se suman a esa;
//   - un EJERCICIO suelto va a una parte "Nueva".
//
// En tablet arrastrar con el dedo falla, así que además se puede TOCAR: tocas la
// pieza (queda "en la mano") y tocas dónde ponerla.
// ---------------------------------------------------------------------------

export type DestParte = { nombre: string, orden: number, base?: any, ejercicios: any[] }
export type DestSesion = { key: string, nombre: string, origenId?: string | null, partes: DestParte[] }
export type DestFase = { key: string, nombre: string, sesiones: DestSesion[], dias?: number | null, unidad?: string | null }
type Carga =
  | { tipo: 'c', id: string }
  | { tipo: 's', id: string }
  | { tipo: 'p', sesId: string, pi: number }
  | { tipo: 'e', ej: any }
type Sitio = { fase?: string, sesion?: string }

let cuenta = 0
const nk = () => `k${++cuenta}`
const copia = (x: any) => JSON.parse(JSON.stringify(x ?? null))
const norm = (x: any) => String(x || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim()

function parteDe(ses: any, pi: number): DestParte {
  const p = (ses?.partes || [])[pi] || {}
  const { ejercicios, ...resto } = p
  return { nombre: p.nombre || `Parte ${pi + 1}`, orden: pi, base: copia(resto), ejercicios: copia(ejercicios || []) }
}
const partesDe = (ses: any): DestParte[] => (ses?.partes || []).map((_: any, pi: number) => parteDe(ses, pi))

/** Mete una parte respetando el orden de origen; si ya hay una igual, se suman. */
function meterParte(partes: DestParte[], nueva: DestParte): DestParte[] {
  const i = partes.findIndex(p => norm(p.nombre) === norm(nueva.nombre))
  if (i >= 0) {
    const out = [...partes]
    out[i] = { ...out[i], ejercicios: [...out[i].ejercicios, ...nueva.ejercicios] }
    return out
  }
  return [...partes, nueva].sort((a, b) => a.orden - b.orden)
}
const ejDeCatalogo = (e: any) => ({ ejercicio_id: e.id, nombre: e.nombre, imagen_url: e.imagen_url || '', series: '3', reps: '10' })
const meterEjercicio = (partes: DestParte[], ej: any) =>
  meterParte(partes, { nombre: 'Nueva', orden: 999, ejercicios: [copia(ej)] })

export default function Torneado({ modo, elegidos, bib, objs, pid, paciente, prog, fin, onACitas }: {
  modo: 'ciclo' | 'sesion'
  pid: string, paciente: string, prog: string, fin?: string
  /** Lo guardado hasta ahora, para ponerlo en sus citas cuando se acabe. */
  onACitas: (g: { tipo: 'sesion' | 'ciclo', id: string }[]) => void
  elegidos: { tipo: 'c' | 's' | 'e', id: string, nombre: string, color?: string }[]
  bib: { ses: Record<string, any>, ciclos: Record<string, any>, ej: Record<string, any> }
  objs: any[]
}) {
  const [ses, setSes] = useState<Record<string, any>>(bib.ses)
  const [abiertos, setAbiertos] = useState<string[]>([])
  const [carga, setCarga] = useState<Carga | null>(null)
  const [enMano, setEnMano] = useState<Carga | null>(null)
  const [sobre, setSobre] = useState<string | null>(null)
  const [partes, setPartes] = useState<DestParte[]>([])
  const [fases, setFases] = useState<DestFase[]>([{ key: nk(), nombre: 'Fase 1', sesiones: [] }])
  // El nombre de lo que se crea: el del primer ciclo o sesión que se suelte, si no se ha escrito otro.
  const [nombre, setNombre] = useState('')
  const [color, setColor] = useState('')
  const [guardando, setGuardando] = useState(false)
  async function guardar() {
    setGuardando(true)
    const r = modo === 'sesion'
      ? await guardarSesionTorno(pid, nombre || `Sesión de ${paciente}`, partes, objsEj)
      : await guardarCicloTorno(pid, { nombre: nombre || `Ciclo de ${paciente}`, color, progresion: prog, fin: fin || null }, fases, objsEj)
    setGuardando(false)
    if (r.ok === false) { alert('No se ha guardado: ' + r.error); return }
    // GUARDAR Y SEGUIR. Antes saltaba directo al calendario y no se podía hacer una
    // segunda sesión. Ahora lo guardado se apunta, la derecha se vacía para la
    // siguiente, y a las citas se va cuando se quiera, con todo lo hecho.
    setGuardadas(g => [...g, { tipo: modo, id: r.id, nombre: nombre || (modo === 'sesion' ? `Sesión de ${paciente}` : `Ciclo de ${paciente}`) }])
    setPartes([]); setFases([{ key: nk(), nombre: 'Fase 1', sesiones: [] }]); setNombre(''); setColor('')
  }
  const [guardadas, setGuardadas] = useState<{ tipo: 'sesion' | 'ciclo', id: string, nombre: string }[]>([])
  const vacio = modo === 'sesion' ? partes.every(p => p.ejercicios.length === 0) : fases.every(f => f.sesiones.length === 0)

  // Un ciclo puede llevar sesiones que no estaban en la lista de plantillas.
  useEffect(() => {
    const faltan = elegidos.filter(e => e.tipo === 'c')
      .flatMap(e => (bib.ciclos[e.id]?.fases || []).flatMap((f: any) => f.sesiones || []))
      .filter((id: string) => !ses[id])
    if (faltan.length === 0) return
    supabase.from('sesiones').select('id,nombre,partes').in('id', faltan).then(({ data }) => {
      if (data) setSes(p => ({ ...p, ...Object.fromEntries(data.map((s: any) => [s.id, s])) }))
    })
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const objsEj = (ej: any): string[] => {
    const suyos = objs.map(o => o.id)
    if (Array.isArray(ej?.objetivos)) return ej.objetivos.filter((id: string) => suyos.includes(id))
    return sugerirObjetivos(bib.ej[ej?.ejercicio_id]?.etiquetas || [], objs)
  }
  const sesDest = (id: string): DestSesion | null =>
    ses[id] ? { key: nk(), nombre: ses[id].nombre || 'Sesión', origenId: id, partes: partesDe(ses[id]) } : null

  // ---- Soltar ---------------------------------------------------------------
  function soltar(c: Carga | null, sitio: Sitio) {
    if (!c) return
    setCarga(null); setEnMano(null); setSobre(null)
    if (!nombre) {
      if (c.tipo === 'c' && modo === 'ciclo') { setNombre(bib.ciclos[c.id]?.nombre || ''); setColor(bib.ciclos[c.id]?.color || '') }
      if (c.tipo === 's' && modo === 'sesion') setNombre(ses[c.id]?.nombre || '')
    }
    // Lo que una carga añade a una lista de partes.
    const aPartes = (lista: DestParte[]): DestParte[] => {
      if (c.tipo === 's') return partesDe(ses[c.id]).reduce(meterParte, lista)
      if (c.tipo === 'p') return meterParte(lista, parteDe(ses[c.sesId], c.pi))
      if (c.tipo === 'e') return meterEjercicio(lista, c.ej)
      return lista
    }
    if (modo === 'sesion') { if (c.tipo !== 'c') setPartes(aPartes); return }

    setFases(prev => {
      if (c.tipo === 'c') {
        const ci = bib.ciclos[c.id]
        const nuevas: DestFase[] = (ci?.fases || []).map((f: any, i: number) => ({
          key: nk(), nombre: f.nombre || `Fase ${i + 1}`, dias: f.dias ?? null, unidad: f.unidad || null,
          sesiones: (f.sesiones || []).map(sesDest).filter(Boolean) as DestSesion[],
        }))
        // Si lo que había era la fase vacía de partida, se sustituye.
        const vacio = prev.every(f => f.sesiones.length === 0)
        return vacio ? nuevas : [...prev, ...nuevas]
      }
      const fk = sitio.fase || prev[prev.length - 1]?.key
      return prev.map(f => {
        if (f.key !== fk) return f
        // Sobre una sesión: se mete dentro.
        if (sitio.sesion) return { ...f, sesiones: f.sesiones.map(s => s.key === sitio.sesion ? { ...s, partes: aPartes(s.partes) } : s) }
        // Una sesión entera, como sesión nueva de la fase.
        if (c.tipo === 's') { const d = sesDest(c.id); return d ? { ...f, sesiones: [...f.sesiones, d] } : f }
        // Una parte o un ejercicio sobre la fase: sesión nueva con eso dentro.
        return { ...f, sesiones: [...f.sesiones, { key: nk(), nombre: 'Sesión nueva', origenId: null, partes: aPartes([]) }] }
      })
    })
  }

  // ---- Lo que se coge y donde se suelta --------------------------------------
  const cogible = (c: Carga) => ({
    draggable: true,
    onDragStart: (e: React.DragEvent) => { e.stopPropagation(); e.dataTransfer.setData('text/plain', 'x'); setCarga(c) },
    onDragEnd: () => { setCarga(null); setSobre(null) },
    onClick: (e: React.MouseEvent) => { e.stopPropagation(); setEnMano(m => JSON.stringify(m) === JSON.stringify(c) ? null : c) },
  })
  const enLaMano = (c: Carga) => enMano != null && JSON.stringify(enMano) === JSON.stringify(c)
  const destino = (clave: string, sitio: Sitio) => ({
    onDragOver: (e: React.DragEvent) => { if (!carga) return; e.preventDefault(); e.stopPropagation(); if (sobre !== clave) setSobre(clave) },
    onDragLeave: (e: React.DragEvent) => { e.stopPropagation(); if (sobre === clave) setSobre(null) },
    onDrop: (e: React.DragEvent) => { e.preventDefault(); e.stopPropagation(); soltar(carga, sitio) },
    onClick: (e: React.MouseEvent) => { if (!enMano) return; e.stopPropagation(); soltar(enMano, sitio) },
  })
  const vivo = (clave: string) => sobre === clave || (enMano != null && sobre == null)

  // ---- Piezas --------------------------------------------------------------
  const esferas = (ids: string[]) => (
    <span style={{ display: 'inline-flex', gap: 1, justifyContent: 'center' }}>
      {ids.map(id => { const o = objs.find(x => x.id === id); return o ? <span key={id} style={{ lineHeight: 0, transform: 'scale(.7)', margin: '-4px' }}><MonedaObjetivo objetivo={o} tam="mini"/></span> : null })}
    </span>
  )
  // Funciones y no componentes: un componente definido aquí dentro sería un tipo nuevo
  // en cada render, y al empezar a arrastrar React desmontaría justo lo que arrastras.
  const verEj = (ej: any, c?: Carga, peq?: boolean, key?: any) => (
    <div key={key} {...(c ? cogible(c) : {})} className={`tn-ej ${c && enLaMano(c) ? 'mano' : ''}`} title={ej.nombre}
      style={{ width: peq ? 64 : 82, textAlign: 'center', cursor: c ? 'grab' : 'default' }}>
      {ej.imagen_url
        ? <img src={ej.imagen_url} alt="" draggable={false} style={{ width: '100%', aspectRatio: '1/1', objectFit: 'cover', borderRadius: 8, display: 'block' }}/>
        : <div style={{ width: '100%', aspectRatio: '1/1', borderRadius: 8, background: 'var(--bl)' }}/>}
      <div style={{ fontSize: 9.5, lineHeight: 1.2, marginTop: 3, overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>{ej.nombre}</div>
      {!peq && <div style={{ marginTop: 2 }}>{esferas(objsEj(ej))}</div>}
    </div>
  )

  /** Los objetivos SUYOS que trabaja una sesión: lo que diga la sesión y lo de sus ejercicios. */
  const objsSes = (s: any): string[] => {
    const suyos = objs.map(o => o.id)
    const deSes = (s?.sesiones_objetivos || []).map((r: any) => r.objetivo_id).filter((id: string) => suyos.includes(id))
    const deEj = (s?.partes || []).flatMap((p: any) => (p.ejercicios || []).flatMap((e: any) => objsEj(e)))
    return Array.from(new Set([...deSes, ...deEj]))
  }

  /**
   * UNA SESIÓN EN CUADRADO. Las fotos de sus ejercicios en mosaico y el nombre encima.
   * Al pasar por encima crece y cuenta lo que no cabe: qué objetivos trabaja y qué
   * partes lleva. Era una fila de texto en un rectángulo, que no decía nada.
   */
  const verSes = (s: any, o: { c?: Carga, tam?: number, quitar?: () => void, extra?: any, key?: any, pie?: any }) => {
    const ejs = (s?.partes || []).flatMap((p: any) => p.ejercicios || [])
    const imgs = Array.from(new Set(ejs.map((e: any) => e.imagen_url || bib.ej[e.ejercicio_id]?.imagen_url).filter(Boolean))).slice(0, 4) as string[]
    const ob = objsSes(s)
    const tam = o.tam || 150
    return (
      <div key={o.key} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
        <div {...(o.c ? cogible(o.c) : {})} {...(o.extra || {})} className={`tn-sq ${o.c && enLaMano(o.c) ? 'mano' : ''}`} style={{ width: tam, height: tam }}>
          <div className="tn-sq-fotos" style={{ gridTemplateColumns: imgs.length > 1 ? '1fr 1fr' : '1fr', gridTemplateRows: imgs.length > 2 ? '1fr 1fr' : '1fr' }}>
            {imgs.map((src, k) => <img key={k} src={src} alt="" draggable={false}/>)}
          </div>
          <div className="tn-sq-nom" style={{ fontSize: tam < 130 ? 11 : 12.5 }}>{s?.nombre || 'Sesión'}</div>
          {o.quitar && <button className="tn-x tn-sq-x" title="Quitar" onClick={e => { e.stopPropagation(); o.quitar!() }}>✕</button>}
          <div className="tn-sq-info">
            {ob.length > 0 && (
              <div style={{ display: 'grid', gap: 4, marginBottom: 8 }}>
                {ob.map(id => { const x = objs.find(y => y.id === id); return x ? (
                  <div key={id} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11.5 }}>
                    <MonedaObjetivo objetivo={x} tam="mini"/> {x.nombre}
                  </div>) : null })}
              </div>
            )}
            {(s?.partes || []).map((p: any, pi: number) => (
              <div key={pi} style={{ fontSize: 11, color: 'var(--gr)' }}>{p.nombre || `Parte ${pi + 1}`} · {(p.ejercicios || []).length}</div>
            ))}
          </div>
        </div>
        {o.pie}
      </div>
    )
  }

  /** Una sesión abierta por dentro: sus partes, y en cada parte sus ejercicios. */
  const sesionAbierta = (id: string) => {
    const s = ses[id]
    if (!s) return <div className="muted" style={{ fontSize: 11 }}>Cargando…</div>
    return (
      <div style={{ display: 'grid', gap: 8 }}>
        {(s.partes || []).map((p: any, pi: number) => {
          const c: Carga = { tipo: 'p', sesId: id, pi }
          return (
            <div key={pi} className="tn-parte">
              <div {...cogible(c)} className={`tn-cab ${enLaMano(c) ? 'mano' : ''}`} title="Arrastra la parte entera">
                ⠿ {p.nombre || `Parte ${pi + 1}`}
                {p.modo && <span style={{ color: 'var(--grl)', fontWeight: 400 }}> · {p.modo}</span>}
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 7, padding: '6px 2px 2px' }}>
                {(p.ejercicios || []).map((ej: any, ei: number) => verEj(ej, { tipo: 'e', ej }, false, ei))}
              </div>
            </div>
          )
        })}
      </div>
    )
  }

  const tornea = (k: string) => setAbiertos(p => p.includes(k) ? p.filter(x => x !== k) : [...p, k])

  return (
    <div className="tn" style={{ position: 'relative', zIndex: 2, display: 'grid', gridTemplateColumns: 'minmax(280px, 1fr) minmax(340px, 1.25fr)', gap: 22, maxWidth: 1360, margin: '0 auto' }}>
      <style>{`
        .tn [draggable=true] { user-select:none }
        .tn-it { background:#fff; border:1px solid var(--bd); border-radius:14px; padding:12px 14px; animation: b-entra .45s ease backwards }
        .tn-cab { font-size:13px; font-weight:600; color:var(--gd); padding:2px 0; cursor:grab; display:inline-block; border-bottom:1.5px solid transparent }
        .tn-cab:hover { border-bottom-color: var(--gm) }
        .tn-sq { position:relative; border-radius:16px; background:#fff; box-shadow:0 3px 12px rgba(38,40,37,.12); cursor:grab;
                 transition: transform .2s ease, box-shadow .2s ease; animation: b-entra .45s ease backwards }
        .tn-sq:hover { transform: scale(1.07); z-index:8; box-shadow:0 16px 34px rgba(38,40,37,.2) }
        .tn-sq.mano { box-shadow:0 0 0 3px var(--g), 0 12px 26px rgba(38,40,37,.16) }
        .tn-sq-fotos { position:absolute; inset:0; border-radius:16px; overflow:hidden; display:grid; background:var(--bl) }
        .tn-sq-fotos img { width:100%; height:100%; object-fit:cover; display:block; min-width:0; min-height:0 }
        .tn-sq-nom { position:absolute; left:0; right:0; bottom:0; padding:26px 8px 8px; text-align:center; line-height:1.25;
                     background:linear-gradient(rgba(255,255,255,0), rgba(255,255,255,.96) 48%); border-radius:0 0 16px 16px }
        .tn-sq-x { position:absolute; top:5px; right:5px; background:#fff; border-radius:99px; z-index:2 }
        .tn-sq-info { display:none; position:absolute; left:50%; top:calc(100% + 8px); transform:translateX(-50%); width:240px;
                      background:#fff; border-radius:12px; box-shadow:0 14px 32px rgba(38,40,37,.2); padding:10px 12px; z-index:9; text-align:left; cursor:default }
        .tn-sq:hover .tn-sq-info { display:block; animation: b-entra .2s ease backwards }
        .tn-cab.mano, .tn-ej.mano, .tn-ses.mano { box-shadow:0 0 0 3px var(--g); border-radius:9px }
        .tn-ej { transition: transform .15s ease } .tn-ej:hover { transform: translateY(-2px) }
        .tn-ses { cursor:grab; display:flex; align-items:center; gap:8px; padding:7px 10px; border-radius:9px; border:1px solid var(--bd); background:#fff; font-size:12.5px }
        .tn-dest { border-radius:12px; transition: background .15s ease, box-shadow .15s ease }
        .tn-dest.vivo { background: var(--gl); box-shadow: inset 0 0 0 2px var(--gm) }
        .tn-x { border:none; background:none; color:var(--grl); cursor:pointer; font-size:13px; padding:0 3px }
        .tn-x:hover { color: var(--red) }
        .tn-dest.vivo .tn-sq { box-shadow: 0 0 0 2px var(--gm), 0 3px 12px rgba(38,40,37,.12) }
      `}</style>

      {/* IZQUIERDA: lo elegido, para tornear. Como en el banco: tarjetas flotando sin
          caja alrededor y los ejercicios en fila, de izquierda a derecha. Lo torneado se
          abre debajo, a todo el ancho. */}
      <div>
        <div className="b-rot" style={{ textAlign: 'left' }}>Lo elegido · tornéalo y arrastra</div>
        {enMano && <div style={{ fontSize: 11.5, color: 'var(--gd)', marginBottom: 8 }}>En la mano · toca a la derecha dónde ponerlo</div>}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 14, alignItems: 'flex-start' }}>
          {elegidos.filter(it => it.tipo !== 'e').flatMap((it, i) => {
            const c = { tipo: it.tipo, id: it.id } as Carga
            const abierto = abiertos.includes(it.tipo + it.id)
            const esCiclo = it.tipo === 'c'
            const s = ses[it.id]
            const nombre = esCiclo ? bib.ciclos[it.id]?.nombre : s?.nombre
            const ejIds: string[] = esCiclo ? [] : (s?.partes || []).flatMap((p: any) => (p.ejercicios || []).map((e: any) => e.ejercicio_id)).filter(Boolean)
            const imgs = Array.from(new Set(ejIds.map(id => bib.ej[id]?.imagen_url).filter(Boolean))).slice(0, 3) as string[]
            const nf = (bib.ciclos[it.id]?.fases || []).length
            const tarjeta = (
              <div key={'t' + it.tipo + it.id} {...(modo === 'sesion' && esCiclo ? {} : cogible(c))}
                className={`b-it ${enLaMano(c) ? 'elegido' : ''}`}
                style={{ animationDelay: `${i * 40}ms, ${(i * 0.37) % 3}s`, width: esCiclo ? 230 : 176, background: '#fff',
                  borderRadius: esCiclo ? 14 : 12, border: '1px solid var(--bd)', overflow: 'hidden', cursor: 'grab' }}>
                {esCiclo
                  ? <div style={{ height: 8, background: it.color || 'var(--g)' }}/>
                  : <div style={{ display: 'flex', height: 70, background: 'var(--bl)' }}>
                      {imgs.map((src, k) => <img key={k} src={src} alt="" draggable={false} style={{ flex: 1, minWidth: 0, objectFit: 'cover' }}/>)}
                    </div>}
                <div style={{ padding: '8px 10px 10px', textAlign: 'center' }}>
                  <div style={{ fontSize: esCiclo ? 14 : 12.5, lineHeight: 1.3 }}>{nombre || it.nombre}</div>
                  <div style={{ fontSize: 10, color: 'var(--grl)', marginTop: 1 }}>
                    {esCiclo ? `ciclo · ${nf} fase${nf === 1 ? '' : 's'}` : `${(s?.partes || []).length} partes · ${ejIds.length} ejercicios`}
                  </div>
                  <button className="btn btn-s btn-sm" style={{ marginTop: 7 }}
                    onClick={e => { e.stopPropagation(); tornea(it.tipo + it.id) }}>{abierto ? 'Cerrar' : 'Tornear'}</button>
                </div>
              </div>
            )
            const cuadrado = !esCiclo ? verSes(s, { c, tam: 170, key: 't' + it.id,
              pie: <button className="btn btn-s btn-sm" onClick={e => { e.stopPropagation(); tornea(it.tipo + it.id) }}>{abierto ? 'Cerrar' : 'Tornear'}</button> }) : null
            const pieza = cuadrado || tarjeta
            if (!abierto) return [pieza]
            // Lo torneado, debajo y a todo el ancho.
            return [pieza, (
              <div key={'a' + it.tipo + it.id} style={{ flexBasis: '100%', padding: '4px 2px 6px', animation: 'b-entra .35s ease backwards' }}>
                {!esCiclo && sesionAbierta(it.id)}
                {esCiclo && (
                  <div style={{ display: 'grid', gap: 10 }}>
                    {(bib.ciclos[it.id]?.fases || []).map((f: any, fi: number) => (
                      <div key={fi}>
                        <div style={{ fontSize: 10.5, letterSpacing: .6, textTransform: 'uppercase', color: 'var(--grl)', marginBottom: 5 }}>{f.nombre || `Fase ${fi + 1}`}</div>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 14 }}>
                          {(f.sesiones || []).map((sid: string) => {
                            const ab = abiertos.includes('s' + sid + ':' + it.id)
                            return verSes(ses[sid], { c: { tipo: 's', id: sid }, tam: 120, key: sid,
                              pie: <button className="btn btn-t btn-sm" onClick={e => { e.stopPropagation(); tornea('s' + sid + ':' + it.id) }}>{ab ? 'Cerrar' : 'Tornear'}</button> })
                          })}
                        </div>
                        {(f.sesiones || []).filter((sid: string) => abiertos.includes('s' + sid + ':' + it.id)).map((sid: string) => (
                          <div key={'ab' + sid} style={{ margin: '12px 0 4px' }}>
                            <div style={{ fontSize: 12, color: 'var(--gr)', marginBottom: 6 }}>{ses[sid]?.nombre}</div>
                            {sesionAbierta(sid)}
                          </div>
                        ))}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )]
          })}
        </div>
        {/* Los ejercicios sueltos, en fila. */}
        {elegidos.some(it => it.tipo === 'e') && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, marginTop: 18 }}>
            {elegidos.filter(it => it.tipo === 'e').map((it, i) => {
              const c: Carga = { tipo: 'e', ej: ejDeCatalogo(bib.ej[it.id] || { id: it.id, nombre: it.nombre }) }
              return (
                <div key={it.id} className="b-it" style={{ animationDelay: `${i * 30}ms, ${(i * 0.37) % 3}s`, background: '#fff', borderRadius: 10, padding: 4 }}>
                  {verEj((c as any).ej, c)}
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* DERECHA: lo que se le programa. */}
      <div>
        <div className="b-rot" style={{ textAlign: 'left' }}>Lo que se le programa</div>
        {/* LO YA GUARDADO, y el paso siguiente: ponerlo en sus citas. */}
        {guardadas.length > 0 && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 10, padding: '9px 12px',
            borderRadius: 12, background: 'var(--gl)', border: '1px solid var(--gm)', animation: 'b-entra .35s ease backwards' }}>
            <span style={{ fontSize: 12.5, color: 'var(--gd)' }}>✓ Guardado:</span>
            {guardadas.map(g => <span key={g.id} className="pill pill-o on">{g.nombre}</span>)}
            <span style={{ flex: 1 }}/>
            <button className="btn btn-p btn-sm" onClick={() => onACitas(guardadas)}>Ponerlo en sus citas →</button>
          </div>
        )}
        {/* NOMBRE Y GUARDAR: arriba, que es donde se mira al acabar. */}
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 10 }}>
          <input className="input" value={nombre} onChange={e => setNombre(e.target.value)}
            placeholder={modo === 'sesion' ? `Sesión de ${paciente}` : `Ciclo de ${paciente}`} style={{ flex: 1, fontSize: 13 }}/>
          <button className="btn btn-p" disabled={vacio || guardando} onClick={guardar}>
            {guardando ? 'Guardando…' : guardadas.length > 0 ? 'Guardar otra' : 'Guardar como suyo'}
          </button>
        </div>
        {modo === 'sesion' ? (
          <div {...destino('S', {})} className={`tn-dest ${vivo('S') ? 'vivo' : ''}`}
            style={{ minHeight: 380, background: 'var(--bl)', borderRadius: 18, padding: 16, display: 'grid', gap: 16, alignContent: 'start' }}>
            {partes.length === 0 && <div style={{ color: 'var(--grl)', fontSize: 12.5, textAlign: 'center', padding: 40 }}>Suelta aquí sesiones, partes o ejercicios</div>}
            {partes.map((p, pi) => (
              <div key={pi} style={{ animation: 'b-entra .35s ease backwards' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span style={{ flex: 1, fontSize: 13, fontWeight: 600, color: 'var(--gd)' }}>{p.nombre}</span>
                  <button className="tn-x" title="Quitar la parte" onClick={() => setPartes(l => l.filter((_, j) => j !== pi))}>✕</button>
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 7, marginTop: 6 }}>
                  {p.ejercicios.map((ej, ei) => (
                    <div key={ei} style={{ position: 'relative' }}>
                      {verEj(ej, undefined, true)}
                      <button className="tn-x" style={{ position: 'absolute', top: -4, right: -4, background: '#fff', borderRadius: 99 }}
                        onClick={() => setPartes(l => l.map((x, j) => j === pi ? { ...x, ejercicios: x.ejercicios.filter((_, m) => m !== ei) } : x).filter(x => x.ejercicios.length > 0))}>✕</button>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div style={{ display: 'flex', gap: 10, alignItems: 'stretch', overflowX: 'auto', paddingBottom: 6 }}>
            {fases.map((f, fi) => (
              <div key={f.key} {...destino(f.key, { fase: f.key })} className={`tn-dest ${vivo(f.key) ? 'vivo' : ''}`}
                style={{ flex: '1 0 240px', minHeight: 380, background: 'var(--bl)', borderRadius: 18, padding: 12, display: 'flex', flexDirection: 'column', gap: 10 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <input value={f.nombre} onChange={e => setFases(l => l.map(x => x.key === f.key ? { ...x, nombre: e.target.value } : x))}
                    onClick={e => e.stopPropagation()}
                    style={{ flex: 1, border: 'none', background: 'transparent', fontFamily: 'inherit', fontSize: 12.5, fontWeight: 600, color: 'var(--gd)' }}/>
                  {fases.length > 1 && <button className="tn-x" title="Quitar la fase" onClick={e => { e.stopPropagation(); setFases(l => l.filter(x => x.key !== f.key)) }}>✕</button>}
                </div>
                {f.sesiones.length === 0 && <div style={{ color: 'var(--grl)', fontSize: 11.5, textAlign: 'center', padding: '30px 6px' }}>Suelta aquí {fi === 0 ? 'el ciclo, ' : ''}sesiones, partes o ejercicios</div>}
                {/* Sus sesiones en cuadrado; soltar encima mete lo que traes dentro. */}
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 14, justifyContent: 'center' }}>
                  {f.sesiones.map(sd => verSes(sd, { tam: 128, key: sd.key,
                    extra: { ...destino(sd.key, { fase: f.key, sesion: sd.key }), style: undefined },
                    quitar: () => setFases(l => l.map(x => x.key === f.key ? { ...x, sesiones: x.sesiones.filter(y => y.key !== sd.key) } : x)),
                    pie: sobre === sd.key ? <span style={{ fontSize: 10.5, color: 'var(--gd)' }}>soltar dentro</span> : null }))}
                </div>
              </div>
            ))}
            <button type="button" onClick={() => setFases(l => [...l, { key: nk(), nombre: `Fase ${l.length + 1}`, sesiones: [] }])}
              style={{ flex: '0 0 84px', border: '1.5px dashed var(--bd)', borderRadius: 12, background: 'transparent', color: 'var(--grl)', cursor: 'pointer', fontFamily: 'inherit', fontSize: 12.5 }}>
              + Fase
            </button>
          </div>
        )}
        <div style={{ fontSize: 11, color: 'var(--grl)', marginTop: 10 }}>
          Se crea {modo === 'sesion' ? 'una sesión suya' : 'un ciclo suyo, con sus sesiones, y se le pone desde hoy'}. La biblioteca no cambia.
        </div>
      </div>
    </div>
  )
}
