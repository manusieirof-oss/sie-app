'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createPortal } from 'react-dom'
import { supabase } from '@/lib/supabase'
import { Ic } from '@/lib/icons'
import { contiene } from '@/lib/texto'
import { hoyISO } from '@/lib/fechas'
import { traerTodo } from '@/lib/paginar'
import { pacientesAgendables } from '@/lib/estadosPaciente'
import { PROGRESIONES } from '@/lib/sistemas'
import { FALTAS_AMASAR, faltasAmasar, guardarCola, guardarGrupo } from '@/lib/ejercicios'
import ImagenEjercicio from '@/components/ImagenEjercicio'

// Los mismos iconos que los quesitos del rosco de Amasar.
const ICONO_FALTA: Record<string, string> = { etiquetas: 'etiqueta', descripcion: 'nota', medida: 'regla', ejecucion: 'ok', feedbacks: 'mensaje', revisar: 'editar' }

// ---------------------------------------------------------------------------
// EL TORNO
//
// Donde se le da forma al entreno. Empieza VACIO a proposito: el logo, una
// pregunta y un buscador. Ver de entrada las cien fichas de la clinica no es
// informacion, es ruido — y ademas hay que ir a buscarla a la base para nada.
// Al pinchar el buscador, o al elegir un camino, es cuando se trae la gente.
//
// Lo primero que se ofrece no es quien viene hoy —eso es el taller— sino A
// QUIEN LE FALTA: quien tiene citas por delante y nada preparado.
// ---------------------------------------------------------------------------

type Fila = { id: string, nombre: string, sesiones: number, citas: number, sinSesion: number,
  /** Dias desde su primera cita. null si nunca ha tenido ninguna. */
  desdeQue: number | null, reciente: boolean }

/** Cuanto dura ser nuevo. Un mes: lo que tardas en aprenderte una cara. */
const DIAS_NUEVO = 30

const CAMINOS = [
  { valor: 'falta',  nombre: 'A quien más le falta', ayuda: 'Citas por delante sin nada preparado' },
  { valor: 'pocas',  nombre: 'Con menos sesiones',   ayuda: 'Los que tienen menos montado' },
  { valor: 'nombre', nombre: 'Por nombre',           ayuda: 'Toda la clínica, en orden' },
  // Recien llegado NO es "cambio de estado hace poco", que es lo que marca la
  // lista de pacientes: ese campo esta vacio en 160 fichas y nunca se rellena
  // solo. Aqui la pregunta de verdad es quien EMPEZO A VENIR hace poco, y eso
  // lo dice su primera cita, que la tiene todo el mundo.
  { valor: 'recientes', nombre: 'Recién llegados',   ayuda: `Empezaron a venir en los últimos ${DIAS_NUEVO} días` },
] as const

export default function TornoPage() {
  const router = useRouter()
  const [logo, setLogo] = useState('')
  const [abierto, setAbierto] = useState(false)
  const [filas, setFilas] = useState<Fila[]>([])
  const [cargando, setCargando] = useState(false)
  const [busca, setBusca] = useState('')
  const [camino, setCamino] = useState<string>('falta')
  const [menu, setMenu] = useState(false)
  /* QUÉ SE BUSCA: gente (tornear su entreno) o ejercicios (amasar el barro). El mismo
     buscador: a su derecha se elige. Los ejercicios se traen al abrir, como la gente. */
  const [que, setQue] = useState<'pacientes' | 'ejercicios'>('pacientes')
  const [ejs, setEjs] = useState<any[] | null>(null)
  const [soloIncompletos, setSoloIncompletos] = useState(false)
  // Por completar: qué falta (vacío = cualquier cosa).
  const [faltaFiltro, setFaltaFiltro] = useState<string[]>([])
  // Elegir varios: para completarlos seguidos o ponerles algo en común.
  const [modoSel, setModoSel] = useState(false)
  const [selec, setSelec] = useState<string[]>([])
  // A quien se va. La ficha no aparece de golpe: la tarjeta se acerca y el
  // resto se apaga, asi que el salto se lee como entrar y no como un corte.
  const [yendo, setYendo] = useState<string | null>(null)
  // EL PANEL DEL NOMBRE: qué se le prepara. Ciclo (y cómo avanza) o una sesión.
  const [panel, setPanel] = useState<Fila | null>(null)
  const [tipo, setTipo] = useState<'ciclo' | 'sesion' | null>(null)
  const [prog, setProg] = useState<string>('objetivos')
  const [fin, setFin] = useState('')
  function empezar() {
    if (!panel || !tipo) return
    const q = new URLSearchParams({ modo: tipo })
    if (tipo === 'ciclo') { q.set('prog', prog); if (prog === 'fecha_fin' && fin) q.set('fin', fin) }
    setYendo(panel.id)
    setTimeout(() => router.push(`/torno/${panel.id}?${q.toString()}`), 360)
  }

  useEffect(() => {
    supabase.from('ajustes').select('valor').eq('clave', 'clinica_logo').maybeSingle()
      .then(({ data }) => setLogo(data?.valor || ''))
  }, [])

  // Solo al abrir, y una vez.
  useEffect(() => { if (abierto && que === 'pacientes' && filas.length === 0 && cargando === false) cargar() }, [abierto, que]) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (!abierto || que !== 'ejercicios' || ejs) return
    recargarEjs()
  }, [abierto, que]) // eslint-disable-line react-hooks/exhaustive-deps
  const recargarEjs = () => traerTodo<any>((d, h) => supabase.from('ejercicios').select('*').order('nombre').order('id').range(d, h)).then(r => setEjs(r.filas))
  /** Los ejercicios que se enseñan: buscando, todo lo que casa; por completar, todos
   *  (las variantes también se rellenan); si no, las portadas y los sueltos. */
  const listaEj = (ejs || [])
    .filter(e => busca.trim() ? contiene(e.nombre, busca) : soloIncompletos || !e.portada_id)
    .filter(e => {
      if (!soloIncompletos) return true
      const f = faltasAmasar(e)
      return f.length > 0 && (faltaFiltro.length === 0 || faltaFiltro.some(k => f.includes(k)))
    })
  /** Abre su rosco. Desde una lista, la lista entera queda de cola para ir pasando al siguiente. */
  function amasar(id: string, cola?: string[]) {
    if (cola && cola.length > 1) guardarCola(cola)
    setYendo(id); setTimeout(() => router.push(`/torno/amasar/${id}${cola && cola.length > 1 ? '?cola=1' : ''}`), 360)
  }

  function abrir(c?: string) {
    if (c) setCamino(c)
    setMenu(false)
    setAbierto(true)
  }

  async function cargar() {
    setCargando(true)
    const hoy = hoyISO()
    const pacs = await pacientesAgendables('id,nombre,apellidos,nombre_clinica')

    // Paginado a mano: con mil filas de tope, un select se corta en silencio y
    // la cuenta sale mal justo en los que mas citas tienen.
    const { filas: ses } = await traerTodo<any>((d, h) =>
      supabase.from('sesiones').select('id,paciente_id')
        .not('paciente_id', 'is', null).order('id').range(d, h))
    const { filas: citas } = await traerTodo<any>((d, h) =>
      supabase.from('citas').select('id,paciente_id,sesion_id')
        .gte('fecha', hoy).neq('estado', 'cancelada').order('id').range(d, h))

    // La primera cita de cada uno. Es lo que dice desde cuando viene, y no hay
    // ningun campo que lo guarde: se saca de sus citas.
    const { filas: todas } = await traerTodo<any>((d, h) =>
      supabase.from('citas').select('paciente_id,fecha')
        .neq('estado', 'cancelada').order('fecha').range(d, h))
    const primera: Record<string, string> = {}
    todas.forEach((c: any) => {
      if (primera[c.paciente_id] == null || c.fecha < primera[c.paciente_id]) primera[c.paciente_id] = c.fecha
    })

    const nSes: Record<string, number> = {}
    ses.forEach((s: any) => { nSes[s.paciente_id] = (nSes[s.paciente_id] || 0) + 1 })
    const nCitas: Record<string, number> = {}
    const nSin: Record<string, number> = {}
    citas.forEach((c: any) => {
      nCitas[c.paciente_id] = (nCitas[c.paciente_id] || 0) + 1
      if (c.sesion_id == null) nSin[c.paciente_id] = (nSin[c.paciente_id] || 0) + 1
    })

    setFilas((pacs || []).map((p: any) => {
      const f0 = primera[p.id]
      const dias = f0
        ? Math.floor((Date.now() - new Date(f0 + 'T12:00:00').getTime()) / 86400000)
        : null
      return ({
      id: p.id,
      nombre: (p.nombre_clinica || `${p.nombre || ''} ${p.apellidos || ''}`).trim(),
      sesiones: nSes[p.id] || 0,
      citas: nCitas[p.id] || 0,
      sinSesion: nSin[p.id] || 0,
      desdeQue: dias,
      reciente: dias != null && dias <= DIAS_NUEVO,
      })
    }))
    setCargando(false)
  }

  const lista = filas
    .filter(f => camino === 'recientes' ? f.reciente : true)
    .filter(f => contiene(f.nombre, busca))
    .sort((a, b) => {
      if (camino === 'recientes') return (a.desdeQue ?? 9e9) - (b.desdeQue ?? 9e9)
      if (camino === 'nombre') return a.nombre.localeCompare(b.nombre)
      if (camino === 'pocas') {
        if (a.sesiones !== b.sesiones) return a.sesiones - b.sesiones
        return a.nombre.localeCompare(b.nombre)
      }
      if (b.sinSesion !== a.sinSesion) return b.sinSesion - a.sinSesion
      if (a.sesiones !== b.sesiones) return a.sesiones - b.sesiones
      return a.nombre.localeCompare(b.nombre)
    })

  const urgentes = filas.filter(f => f.sinSesion > 0).length
  const elegido = CAMINOS.find(c => c.valor === camino)

  return (
    <div className={`torno ${yendo ? 't-yendo' : ''}`}>
      <style>{`
        .torno { background: var(--w); margin: -16px -18px; padding: 16px 18px;
                 min-height: calc(100vh - 32px); display: flex; flex-direction: column;
                 align-items: center; position: relative }
        @keyframes t-entra { from { opacity:0; transform:translateY(10px) } to { opacity:1; transform:none } }
        /* UNA GOTA QUE CAE. Cae, toca el logo, y el agua se abre en ondas.
           El logo no aparece: lo descubre el golpe del agua. */
        @keyframes t-cae { 0% { transform:translateY(-120px) scaleY(1.4); opacity:0 }
                           30% { opacity:1 } 100% { transform:translateY(0) scaleY(.5); opacity:0 } }
        @keyframes t-onda { from { transform:scale(.3); opacity:.5 } to { transform:scale(1.85); opacity:0 } }
        @keyframes t-asoma { 0% { opacity:0; transform:scale(.9) }
                             60% { opacity:1; transform:scale(1.04) }
                             100% { opacity:1; transform:scale(1) } }
        .t-gota { animation: t-cae .68s cubic-bezier(.55,.06,.68,.19) both }
        .t-onda { animation: t-onda 1.6s ease-out .66s both }
        .t-onda.b { animation-delay: .92s }
        .t-onda.c { animation-delay: 1.18s }
        .t-logo { animation: t-asoma .75s cubic-bezier(.2,.9,.3,1.2) .64s both }
        .t-fade { animation: t-entra .45s ease both }
        .t-card { transition: transform .16s ease, box-shadow .16s ease, border-color .16s ease }
        .t-falta { display:inline-flex; align-items:center; gap:5px; padding:5px 9px; border-radius:99px; font-size:12.5px;
                   color:var(--gr); cursor:pointer; user-select:none; transition: color .15s, background .15s }
        .t-falta:hover { color:var(--gd) }
        .t-falta.on { color:var(--gd); background:#fff; box-shadow:0 2px 9px rgba(38,40,37,.12) }
        .t-card:hover { transform: translateY(-3px); box-shadow: 0 10px 22px rgba(38,40,37,.13); border-color: var(--g) }
        .t-menu-it { padding: 9px 12px; cursor: pointer; border-radius: 7px }
        .t-menu-it:hover { background: var(--bl) }
        @keyframes t-acerca { from { transform:scale(1); opacity:1 }
                              to { transform:scale(2.1); opacity:0 } }
        @keyframes t-apaga { to { opacity:0; transform:scale(.97) } }
        .t-yendo .t-card { animation: t-apaga .26s ease both }
        .t-yendo .t-cab { animation: t-apaga .26s ease both }
        .t-card.t-elegida { animation: t-acerca .42s cubic-bezier(.4,0,.2,1) both;
                            position: relative; z-index: 5; pointer-events: none }
      `}</style>

      {/* Sin nada abierto, todo vive en el centro de la pantalla. */}
      {/* CERRADO: el buscador cae EXACTAMENTE en la mitad de la pantalla y el logo
          cuelga justo encima. Centrar el bloque entero dejaba el buscador muy por
          debajo del centro, que es donde miras al entrar.
          ABIERTO: se vuelve una cabecera normal y las fichas van debajo. */}
      <div className="t-cab" style={ abierto
        ? { display: 'flex', flexDirection: 'column', alignItems: 'center', width: '100%', paddingTop: 10 }
        : { position: 'absolute', top: '50%', left: 0, right: 0, padding: '0 18px' } }>

        <div style={ abierto
          ? { display: 'flex', flexDirection: 'column', alignItems: 'center' }
          : { position: 'absolute', bottom: '100%', left: 0, right: 0,
              display: 'flex', flexDirection: 'column', alignItems: 'center',
              justifyContent: 'flex-end', paddingBottom: 48 } }>

        <div style={{ position: 'relative', width: abierto ? 130 : 'min(560px, 42vh)', height: abierto ? 130 : 'min(560px, 42vh)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          transition: 'width .35s ease, height .35s ease' }}>
          <span className="t-gota" style={{ position: 'absolute', width: 16, height: 22,
            borderRadius: '50% 50% 50% 50% / 60% 60% 40% 40%', background: 'var(--gm)' }}/>
          {['', 'b', 'c'].map(k => (
            <span key={k || 'a'} className={`t-onda ${k}`} style={{ position: 'absolute',
              width: '92%', height: '92%', borderRadius: '50%', border: '1.5px solid var(--gm)' }}/>
          ))}
          <div className="t-logo" style={{ width: '82%', height: '82%', display: 'flex',
            alignItems: 'center', justifyContent: 'center' }}>
            {logo
              ? <img src={logo} alt="" style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }}/>
              : <span style={{ color: 'var(--g)' }}><Ic name="recuperar" size={abierto ? 54 : 190}/></span>}
          </div>
        </div>

        {abierto === false && (
          <div className="t-fade" style={{ fontSize: 17, marginTop: 16 }}>
            {que === 'pacientes' ? '¿A quién le preparamos el entreno?' : '¿Qué ejercicio amasamos?'}
          </div>
        )}
        </div>

        <div style={{ display: 'flex', gap: 8, alignItems: 'center', width: '100%',
          maxWidth: 520, margin: abierto ? '14px auto 0' : '0 auto',
          transform: abierto ? 'none' : 'translateY(-50%)', position: 'relative' }}>
          <input className="input" value={busca}
            onFocus={() => setAbierto(true)}
            onChange={e => { setBusca(e.target.value); setAbierto(true) }}
            placeholder={que === 'pacientes' ? 'Busca a alguien de la clínica…' : 'Busca un ejercicio…'}
            style={{ flex: 1, fontSize: 14, padding: '11px 14px' }}/>

          {/* GENTE O EJERCICIOS: lo que se busca. */}
          <div style={{ display: 'inline-flex', background: 'var(--bl)', borderRadius: 99, padding: 3, gap: 2 }}>
            {([['pacientes', 'pacientes', 'Pacientes'], ['ejercicios', 'fuerza', 'Ejercicios']] as const).map(([v, ic, t]) => (
              <button key={v} type="button" title={t} onClick={() => { setQue(v); setMenu(false); setBusca('') }}
                style={{ border: 'none', cursor: 'pointer', borderRadius: 99, padding: '7px 11px', lineHeight: 0,
                  background: que === v ? '#fff' : 'transparent', color: que === v ? 'var(--gd)' : 'var(--grl)',
                  boxShadow: que === v ? '0 1px 5px rgba(38,40,37,.15)' : 'none' }}>
                <Ic name={ic} size={15}/>
              </button>
            ))}
          </div>
          {/* Los caminos, escondidos: son atajos, no la forma normal de entrar. */}
          <div style={{ position: 'relative' }}>
            <button className="btn btn-s" onClick={() => setMenu(v => v === false)}
              title="Otras formas de mirarlo" style={{ whiteSpace: 'nowrap' }}>
              <Ic name="lista" size={13}/>
            </button>
            {menu && (
              <div style={{ position: 'absolute', right: 0, top: 'calc(100% + 6px)', width: 250,
                background: 'var(--w)', border: '1px solid var(--bd)', borderRadius: 9,
                boxShadow: '0 10px 28px rgba(38,40,37,.16)', padding: 5, zIndex: 30 }}>
                {que === 'ejercicios' ? (<>
                  <div className="t-menu-it" onClick={() => { setMenu(false); router.push('/torno/amasar/nuevo') }}>
                    <div style={{ fontSize: 12.5 }}>+ Amasar uno nuevo</div>
                    <div style={{ fontSize: 10.5, color: 'var(--grl)', marginTop: 1 }}>Un ejercicio que aún no está en la biblioteca</div>
                  </div>
                  <div className="t-menu-it" onClick={() => { setSoloIncompletos(v => !v); setMenu(false); setAbierto(true) }}>
                    <div style={{ fontSize: 12.5, color: soloIncompletos ? 'var(--gd)' : 'var(--n)' }}>{soloIncompletos ? '✓ ' : ''}Por completar</div>
                    <div style={{ fontSize: 10.5, color: 'var(--grl)', marginTop: 1 }}>Los que les falta foto, etiquetas, descripción…</div>
                  </div>
                </>) : CAMINOS.map(c => (
                  <div key={c.valor} className="t-menu-it" onClick={() => abrir(c.valor)}>
                    <div style={{ fontSize: 12.5, color: camino === c.valor ? 'var(--gd)' : 'var(--n)' }}>
                      {camino === c.valor ? '✓ ' : ''}{c.nombre}
                    </div>
                    <div style={{ fontSize: 10.5, color: 'var(--grl)', marginTop: 1 }}>{c.ayuda}</div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {abierto === false && <div style={{ flex: 1 }}/>}

      {/* LOS EJERCICIOS: tarjetas con su imagen; tocar una va a su rosco. */}
      {abierto && que === 'ejercicios' && (
        <div className="t-fade" style={{ width: '100%', maxWidth: 980, margin: '16px auto 40px' }}>
          {!ejs ? <div className="muted" style={{ textAlign: 'center', padding: 30 }}>Trayendo la biblioteca…</div> : (<>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, marginBottom: 11 }}>
              <span style={{ fontSize: 11, color: 'var(--gr)' }}>
                {soloIncompletos ? 'Por completar' : busca.trim() ? 'Lo que casa' : 'Principales y sueltos'} · {listaEj.length}
              </span>
              <span className={`t-falta ${modoSel ? 'on' : ''}`} onClick={() => { setModoSel(v => !v); setSelec([]) }}>
                <Ic name="ok" size={13}/> {modoSel ? 'Dejar de elegir' : 'Elegir varios'}</span>
              {modoSel && listaEj.length > 0 && (
                <span className="t-falta" onClick={() => setSelec(selec.length === listaEj.length ? [] : listaEj.map(e => e.id))}>
                  {selec.length === listaEj.length ? 'Ninguno' : 'Todos'}</span>
              )}
            </div>
            {/* QUÉ FALTA: filtra la cola. Cada uno con cuántos hay. */}
            {soloIncompletos && (
              <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'center', alignItems: 'center', gap: 4, marginBottom: 16 }}>
                <span style={{ fontSize: 11, color: 'var(--grl)', marginRight: 4 }}>Le falta</span>
                {FALTAS_AMASAR.map(f => {
                  const n = (ejs || []).filter(e => (!busca.trim() || contiene(e.nombre, busca)) && f.falta(e)).length
                  if (!n) return null
                  const on = faltaFiltro.includes(f.k)
                  // Texto con su icono, sin caja ni número (el número va al pasar el ratón):
                  // se lee como una frase, "lo que falta: etiquetas, feedbacks…".
                  return (
                    <span key={f.k} className={`t-falta ${on ? 'on' : ''}`} title={`${n} ejercicios`}
                      onClick={() => setFaltaFiltro(l => on ? l.filter(x => x !== f.k) : [...l, f.k])}>
                      <Ic name={ICONO_FALTA[f.k] || 'ok'} size={13}/> {f.t}
                    </span>
                  )
                })}
              </div>
            )}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(150px,1fr))', gap: 12 }}>
              {listaEj.map((e, i) => {
                const fs = faltasAmasar(e)
                const faltan = fs.length
                const sel = selec.includes(e.id)
                return (
                  <div key={e.id} className={`t-card t-fade ${yendo === e.id ? 't-elegida' : ''}`}
                    title={faltan ? 'Falta: ' + FALTAS_AMASAR.filter(f => fs.includes(f.k)).map(f => f.t.toLowerCase()).join(', ') : ''}
                    onClick={() => modoSel ? setSelec(l => sel ? l.filter(x => x !== e.id) : [...l, e.id])
                      : amasar(e.id, soloIncompletos ? listaEj.map(x => x.id) : undefined)}
                    style={{ animationDelay: `${Math.min(i, 14) * 22}ms`, background: '#fff', borderRadius: 14, overflow: 'hidden', position: 'relative',
                      cursor: 'pointer', boxShadow: sel ? '0 0 0 2.5px var(--g), 0 6px 18px rgba(38,40,37,.14)' : '0 3px 12px rgba(38,40,37,.08)' }}>
                    {modoSel && (
                      <span style={{ position: 'absolute', top: 8, right: 8, zIndex: 2, width: 22, height: 22, borderRadius: 99,
                        background: sel ? 'var(--g)' : 'rgba(255,255,255,.9)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center',
                        boxShadow: '0 1px 5px rgba(38,40,37,.2)', fontSize: 13 }}>{sel ? '✓' : ''}</span>
                    )}
                    <ImagenEjercicio src={e.imagen_url} etiquetasEj={e.etiquetas} radio={0} fondo="var(--bl)" icono={30}/>
                    <div style={{ padding: '8px 10px' }}>
                      <div style={{ fontSize: 12.5, lineHeight: 1.25 }}>{e.nombre}</div>
                      {faltan > 0 && <div style={{ fontSize: 10.5, color: '#A87E2C', marginTop: 3 }}>Falta{faltan > 1 ? `n ${faltan} cosas` : ' 1 cosa'}</div>}
                    </div>
                  </div>
                )
              })}
            </div>
            {listaEj.length === 0 && <div className="muted" style={{ textAlign: 'center', padding: 24 }}>Ningún ejercicio coincide.</div>}
          </>)}
          {/* La barra y el panel van al <body> con un portal: dentro de .t-fade (que anima
              con transform) un position:fixed se pega a ese contenedor y no a la pantalla,
              así que la barra acababa al final de la lista y el panel ni se veía. */}
          {modoSel && selec.length > 0 && createPortal(
            <div style={{ position: 'fixed', left: 0, right: 0, bottom: 22, display: 'flex', justifyContent: 'center', zIndex: 40, pointerEvents: 'none' }}>
              <div className="t-fade" style={{ pointerEvents: 'auto', display: 'flex', alignItems: 'center', gap: 10, background: '#fff', borderRadius: 99,
                padding: '8px 10px 8px 18px', boxShadow: '0 12px 30px rgba(38,40,37,.18)' }}>
                <span style={{ fontSize: 12.5, color: 'var(--gd)' }}>{selec.length} elegido{selec.length === 1 ? '' : 's'}</span>
                <button className="btn btn-s btn-sm" onClick={() => {
                  // Al rosco de varios: el mismo que uno a uno, pero lo que se pone va a todos.
                  guardarGrupo(listaEj.map(e => e.id).filter(id => selec.includes(id)))
                  router.push('/torno/amasar/varios')
                }}>Poner en común</button>
                <button className="btn btn-p btn-sm" onClick={() => {
                  // En el orden en que se ven en la rejilla.
                  const cola = listaEj.map(e => e.id).filter(id => selec.includes(id))
                  amasar(cola[0], cola)
                }}>Completar uno a uno</button>
              </div>
            </div>, document.body
          )}
          {/* Hueco al final para que la barra no tape la última fila. */}
          {modoSel && <div style={{ height: 90 }}/>}
        </div>
      )}

      {abierto && que === 'pacientes' && (
        <div className="t-fade" style={{ width: '100%', maxWidth: 820, margin: '16px auto 40px' }}>
          {cargando
            ? <div className="muted" style={{ textAlign: 'center', padding: 30 }}>Trayendo a la gente…</div>
            : (
              <>
                <div style={{ fontSize: 11, color: 'var(--gr)', marginBottom: 11, textAlign: 'center' }}>
                  {elegido?.nombre}
                  {urgentes > 0 && ` · ${urgentes} ${urgentes === 1 ? 'tiene' : 'tienen'} citas sin preparar`}
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(235px,1fr))', gap: 11 }}>
                  {lista.map((f, i) => (
                    <div key={f.id} className={`t-card t-fade ${yendo === f.id ? 't-elegida' : ''}`}
                      style={{ animationDelay: `${Math.min(i, 12) * 26}ms`,
                        background: 'var(--w)', border: '1px solid var(--bd)', borderRadius: 10,
                        padding: '13px 14px', cursor: 'pointer' }}
                      onClick={() => { setPanel(f); setTipo(null); setFin('') }}>
                      <div style={{ fontSize: 14, color: 'var(--n)' }}>{f.nombre}</div>
                      {f.reciente && (
                        <div style={{ fontSize: 9, color: 'var(--gd)', fontWeight: 600, marginTop: 2 }}>
                          {f.desdeQue === 0 ? 'empieza hoy'
                            : `viene desde hace ${f.desdeQue} ${f.desdeQue === 1 ? 'día' : 'días'}`}
                        </div>
                      )}
                      <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap', marginTop: 8 }}>
                        <span className={`pill ${f.sesiones > 0 ? 'pill-o on' : 'pill-soft'}`}>
                          {f.sesiones} {f.sesiones === 1 ? 'sesión' : 'sesiones'}
                        </span>
                        <span className="pill pill-soft">{f.citas} citas</span>
                      </div>
                      {f.sinSesion > 0 && (
                        <div style={{ marginTop: 7, fontSize: 11, color: '#7A5800', background: 'var(--ambl)',
                          border: '1px solid var(--amb)', borderRadius: 6, padding: '4px 8px' }}>
                          {f.sinSesion} sin preparar
                        </div>
                      )}
                    </div>
                  ))}
                </div>

                {lista.length === 0 && (
                  <div className="muted" style={{ textAlign: 'center', padding: 24 }}>Nadie con ese nombre.</div>
                )}
              </>
            )}
        </div>
      )}
      {/* EL PANEL: qué se le prepara. Flota sobre el blanco; fuera de él, se cierra. */}
      {panel && !yendo && (
        <div onClick={() => setPanel(null)}
          style={{ position: 'fixed', inset: 0, zIndex: 40, display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: 'rgba(255,255,255,.72)', backdropFilter: 'blur(3px)' }}>
          <div className="t-fade" onClick={e => e.stopPropagation()}
            style={{ width: 'min(520px, 92vw)', background: 'var(--w)', borderRadius: 18, padding: '22px 22px 18px',
              boxShadow: '0 24px 60px rgba(38,40,37,.18)', border: '1px solid var(--bd2)' }}>
            <div style={{ textAlign: 'center', fontSize: 18 }}>{panel.nombre}</div>
            <div style={{ textAlign: 'center', fontSize: 12, color: 'var(--gr)', marginTop: 2 }}>¿Qué le preparamos?</div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginTop: 16 }}>
              {([['ciclo', 'Un ciclo', 'Fases con sus sesiones'], ['sesion', 'Una sesión', 'Partes y ejercicios']] as const).map(([v, n, a]) => (
                <button key={v} type="button" className="t-card" onClick={() => setTipo(v)}
                  style={{ fontFamily: 'inherit', cursor: 'pointer', textAlign: 'center', padding: '16px 10px', borderRadius: 12,
                    background: tipo === v ? 'var(--gl)' : 'var(--w)', border: `1.5px solid ${tipo === v ? 'var(--g)' : 'var(--bd)'}` }}>
                  <div style={{ fontSize: 15, color: tipo === v ? 'var(--gd)' : 'var(--n)' }}>{n}</div>
                  <div style={{ fontSize: 11, color: 'var(--grl)', marginTop: 3 }}>{a}</div>
                </button>
              ))}
            </div>

            {/* EL CICLO PIDE CÓMO AVANZA: por objetivos, por tiempo o hasta una fecha. */}
            {tipo === 'ciclo' && (
              <div className="t-fade" style={{ marginTop: 14, display: 'grid', gap: 6 }}>
                {PROGRESIONES.map(p => (
                  <label key={p.valor} style={{ display: 'flex', gap: 9, alignItems: 'flex-start', cursor: 'pointer', padding: '8px 10px',
                    borderRadius: 9, border: `1px solid ${prog === p.valor ? 'var(--gm)' : 'var(--bd2)'}`, background: prog === p.valor ? 'var(--gl)' : 'transparent' }}>
                    <input type="radio" checked={prog === p.valor} onChange={() => setProg(p.valor)} style={{ marginTop: 3, accentColor: 'var(--g)' }}/>
                    <span>
                      <span style={{ display: 'block', fontSize: 13 }}>{p.nombre}</span>
                      <span style={{ display: 'block', fontSize: 11, color: 'var(--grl)' }}>{p.ayuda}</span>
                    </span>
                  </label>
                ))}
                {prog === 'fecha_fin' && (
                  <input type="date" className="input" value={fin} min={hoyISO()} onChange={e => setFin(e.target.value)}/>
                )}
              </div>
            )}

            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 16 }}>
              <button className="btn btn-t btn-sm" onClick={() => router.push(`/pacientes/${panel.id}?tab=entreno`)}>Ver su ficha</button>
              <div style={{ flex: 1 }}/>
              <button className="btn btn-s" onClick={() => setPanel(null)}>Cancelar</button>
              <button className="btn btn-p" disabled={!tipo || (tipo === 'ciclo' && prog === 'fecha_fin' && !fin)} onClick={empezar}>Empezar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
