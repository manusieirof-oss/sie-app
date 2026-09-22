'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { Ic } from '@/lib/icons'
import { contiene } from '@/lib/texto'
import { hoyISO } from '@/lib/fechas'
import { traerTodo } from '@/lib/paginar'
import { pacientesAgendables } from '@/lib/estadosPaciente'

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
  // A quien se va. La ficha no aparece de golpe: la tarjeta se acerca y el
  // resto se apaga, asi que el salto se lee como entrar y no como un corte.
  const [yendo, setYendo] = useState<string | null>(null)

  useEffect(() => {
    supabase.from('ajustes').select('valor').eq('clave', 'clinica_logo').maybeSingle()
      .then(({ data }) => setLogo(data?.valor || ''))
  }, [])

  // Solo al abrir, y una vez.
  useEffect(() => { if (abierto && filas.length === 0 && cargando === false) cargar() }, [abierto])

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
            ¿A quién le preparamos el entreno?
          </div>
        )}
        </div>

        <div style={{ display: 'flex', gap: 8, alignItems: 'center', width: '100%',
          maxWidth: 520, margin: abierto ? '14px auto 0' : '0 auto',
          transform: abierto ? 'none' : 'translateY(-50%)', position: 'relative' }}>
          <input className="input" value={busca}
            onFocus={() => setAbierto(true)}
            onChange={e => { setBusca(e.target.value); setAbierto(true) }}
            placeholder="Busca a alguien de la clínica…"
            style={{ flex: 1, fontSize: 14, padding: '11px 14px' }}/>

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
                {CAMINOS.map(c => (
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

      {abierto && (
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
                      onClick={() => {
                        setYendo(f.id)
                        setTimeout(() => router.push(`/pacientes/${f.id}?tab=entreno`), 360)
                      }}>
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
    </div>
  )
}
