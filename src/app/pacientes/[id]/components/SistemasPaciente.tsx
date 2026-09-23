'use client'
import { useEffect, useState } from 'react'
import { Ic } from '@/lib/icons'
import { supabase } from '@/lib/supabase'
import EvaluacionFase from './EvaluacionFase'
import { contiene } from '@/lib/texto'
import ModalSistema from '@/app/entrenamiento/components/ModalSistema'
import { esPlantilla } from '@/lib/sesiones'
import { PROGRESIONES } from '@/lib/sistemas'
import { duplicarSesion } from '@/lib/sesiones'
import { hoyISO } from '@/lib/fechas'
import { inicioParaEmpezarEn, actualizarAsignacion, finPrevisto } from '@/lib/sistemas'
import { cargarSistemas, asignarSistema, quitarSistema, marcarPrincipal,
         faseEn, tramos, Sistema, Asignacion } from '@/lib/sistemas'

// ---------------------------------------------------------------------------
// QUÉ SISTEMAS LLEVA HOY ESTE PACIENTE
//
// Pueden ser varios a la vez y cada uno corre a su ritmo: un embarazo va por
// semanas y un hombro por objetivos, sin saber nada el uno del otro. El MARCO
// —el que tiene las fechas inamovibles— es el que pinta las citas; los demás
// van por debajo. Por eso se marca a mano: automático se equivoca en cuanto
// alguien lleve dos por tiempo.
// ---------------------------------------------------------------------------

export default function SistemasPaciente({ pacienteId, asignaciones, logrados, onCambio, onRecargar }: {
  pacienteId: string
  asignaciones: Asignacion[]
  logrados: Record<string, string | null>
  onCambio: () => void
  onRecargar?: () => void
}) {
  const [trayendo, setTrayendo] = useState('')
  const [busca, setBusca] = useState('')
  // Crear el sistema sin salirse: te das cuenta de que hace falta justo cuando
  // vas a ponerselo a alguien, y volver a la biblioteca pierde el paciente.
  const [creando, setCreando] = useState(false)
  const [biblio, setBiblio] = useState<any>(null)
  const [editandoSistema, setEditandoSistema] = useState<any>(null)

  async function cargarBiblio() {
    if (biblio == null) {
      const [o, se, ej, et, te] = await Promise.all([
        supabase.from('objetivos').select('*').eq('activo', true).order('nombre'),
        supabase.from('sesiones').select('*, sesiones_objetivos(objetivo_id,movimientos)').order('nombre'),
        supabase.from('ejercicios').select('*').order('nombre'),
        supabase.from('etiquetas').select('*').order('nombre'),
        supabase.from('tests').select('*').order('nombre'),
      ])
      setBiblio({
        objetivos: o.data || [],
        sesiones: (se.data || []).filter(esPlantilla),
        ejercicios: ej.data || [],
        etiquetas: et.data || [],
        tests: te.data || [],
      })
    }
  }

  async function abrirCreacion() { await cargarBiblio(); setCreando(true) }
  const corto = (iso: string) => new Date(iso + 'T12:00:00')
    .toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: 'numeric' })

  const [anadiendo, setAnadiendo] = useState(false)
  const [catalogo, setCatalogo] = useState<Sistema[]>([])
  const [sel, setSel] = useState('')
  const [faseIni, setFaseIni] = useState(0)
  const [editando, setEditando] = useState<Asignacion | null>(null)
  const [eIni, setEIni] = useState('')
  const [eFin, setEFin] = useState('')
  const [eFase, setEFase] = useState(0)
  const [ini, setIni] = useState(hoyISO())
  const [fin, setFin] = useState('')
  const hoy = hoyISO()

  useEffect(() => { if (anadiendo && catalogo.length === 0) cargarSistemas(true).then(setCatalogo) }, [anadiendo])

  const elegido = catalogo.find(s => s.id === sel)
  const pideFin = elegido?.progresion === 'fecha_fin'

  async function anadir() {
    if (!sel) return
    // Si entra a mitad, la fecha de inicio se calcula hacia atras: lo que se
    // guarda sigue siendo una sola fecha, como en todos los demas.
    // Por calendario la fase de entrada se traduce a una fecha de inicio hacia
    // atras; por objetivos no hay fechas que mover, asi que se guarda la fase.
    const porObjetivos = elegido?.progresion === 'objetivos'
    const arranca = (elegido && faseIni > 0 && porObjetivos === false)
      ? inicioParaEmpezarEn(elegido, faseIni, ini || hoy)
      : (ini || null)
    const r = await asignarSistema(pacienteId, sel, {
      fecha_inicio: arranca, fecha_fin: fin || null,
      faseInicial: porObjetivos ? faseIni : 0,
    })
    if (!r.ok) { alert(r.error); return }
    setAnadiendo(false); setSel(''); setFin(''); setFaseIni(0); onCambio()
  }

  /**
   * Las sesiones de la fase se COPIAN a la ficha, igual que cualquier plantilla: a
   * partir de ahí son suyas. `plantilla_id` deja reconocer las que ya tiene, para que
   * volver a pulsar no le monte una segunda copia de lo mismo.
   */
  async function traer(faseId: string, ids: string[]) {
    if (ids.length === 0) return
    setTrayendo(faseId)
    const { data: yaTiene } = await supabase.from('sesiones')
      .select('plantilla_id').eq('paciente_id', pacienteId).in('plantilla_id', ids)
    const puestas = new Set((yaTiene || []).map((x: any) => x.plantilla_id))
    const faltan = ids.filter(id => !puestas.has(id))
    if (faltan.length === 0) { setTrayendo(''); alert('Ya las tiene todas.'); return }
    const { data: plantillas } = await supabase.from('sesiones').select('*').in('id', faltan)
    let n = 0
    for (const pl of plantillas || []) {
      const r = await duplicarSesion(pl, pacienteId, { sufijo: '', plantillaId: pl.id,
        motivo: 'Desde el sistema' })
      if (r.ok) n++
    }
    setTrayendo('')
    onRecargar?.()
    alert(`${n} sesión${n === 1 ? '' : 'es'} a la ficha. Ya puedes asignarlas a sus citas.`)
  }

  function abrirEdicion(a: Asignacion) {
    setEditando(a); setEFase(Number(a.fase_inicial) || 0)
    setEIni(a.fecha_inicio || hoy); setEFin(a.fecha_fin || '')
  }

  async function guardarEdicion() {
    if (editando == null) return
    const sis = editando.sistema
    const porObj = sis?.progresion === 'objetivos'
    const arranca = (sis && eFase > 0 && porObj === false) ? inicioParaEmpezarEn(sis, eFase, eIni || hoy) : (eIni || null)
    const r = await actualizarAsignacion(editando.id, {
      fecha_inicio: arranca, fecha_fin: eFin || null,
      faseInicial: porObj ? eFase : 0,
    })
    if (r.ok === false) { alert(r.error); return }
    setEditando(null); onCambio()
  }

  async function quitar(a: Asignacion) {
    if (!confirm(`¿Quitar «${a.sistema?.nombre}»? Las citas que ya pasaron siguen contando.`)) return
    await quitarSistema(a.id); onCambio()
  }

  return (
    <div className="sec">
      <div className="sec-h">
        <span className="sh-l"><span className="ct-l"><Ic name="objetivo" size={13}/> Sistemas</span></span>
        <button className="btn btn-s btn-sm" onClick={() => setAnadiendo(v => !v)}>
          {anadiendo ? 'Cancelar' : '+ Añadir'}
        </button>
      </div>

      {anadiendo && (
        <div className="modal-bg" onClick={e => { if (e.target === e.currentTarget) setAnadiendo(false) }}>
          <div style={{ background:'var(--w)', border:'1px solid var(--bd)', borderRadius:14, width:'94vw',
            maxWidth:660, maxHeight:'88vh', display:'flex', flexDirection:'column', overflow:'hidden',
            boxShadow:'var(--sh-md)' }}>

            <div style={{ padding:'13px 17px', borderBottom:'1px solid var(--bd)', display:'flex', alignItems:'center', gap:10 }}>
              <div style={{ flex:1, fontSize:16, fontWeight:500 }}>Añadir sistema</div>
              <button className="btn btn-s btn-sm" onClick={abrirCreacion}>+ Nuevo sistema</button>
              <button className="modal-close" onClick={() => setAnadiendo(false)}>✕</button>
            </div>

            <div style={{ padding:'11px 17px 0' }}>
              <input className="input" autoFocus value={busca} onChange={e => setBusca(e.target.value)}
                placeholder="Buscar sistema…"/>
            </div>

            {/* Tarjetas, no una lista desplegable: el sistema se reconoce por su color
                y su icono, igual que en la biblioteca. */}
            <div style={{ flex:1, overflowY:'auto', padding:'12px 17px', display:'grid',
              gridTemplateColumns:'repeat(auto-fill,minmax(190px,1fr))', gap:10 }}>
              {catalogo
                .filter(x => asignaciones.some(a => a.sistema_id === x.id) === false)
                .filter(x => contiene(x.nombre, busca) || contiene(x.descripcion || '', busca))
                .map(x => {
                  const prog = PROGRESIONES.find(pr => pr.valor === x.progresion)
                  const elegida = sel === x.id
                  return (
                    <div key={x.id} onClick={() => { setSel(x.id); setFaseIni(0) }}
                      style={{ border:`1px solid ${elegida ? x.color : 'var(--bd)'}`, borderRadius:8,
                        overflow:'hidden', cursor:'pointer', background:'var(--w)',
                        boxShadow: elegida ? `0 0 0 2px ${x.color}33` : undefined }}>
                      <div style={{ height:4, background:x.color }}/>
                      <div style={{ padding:'10px 12px 12px' }}>
                        <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                          <span style={{ width:24, height:24, borderRadius:6, background:x.color, color:'#fff',
                            display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
                            {x.icono ? <Ic name={x.icono} size={12}/> : null}
                          </span>
                          <div style={{ flex:1, minWidth:0, fontSize:13 }}>{x.nombre}</div>
                        </div>
                        {x.descripcion && (
                          <div style={{ fontSize:11, color:'var(--gr)', marginTop:5, lineHeight:1.4 }}>
                            {x.descripcion.slice(0,60)}{x.descripcion.length > 60 ? '…' : ''}
                          </div>
                        )}
                        <div style={{ fontSize:11, color:'var(--gr)', marginTop:6 }}>
                          {(x.fases || []).length} fase{(x.fases || []).length === 1 ? '' : 's'}
                        </div>
                        <div style={{ marginTop:6 }}>
                          <span className="pill pill-o on">{prog?.nombre || x.progresion}</span>
                        </div>
                      </div>
                    </div>
                  )
                })}
              {catalogo.length === 0 && <div className="muted">Cargando…</div>}
            </div>

            <div style={{ padding:'12px 17px', borderTop:'1px solid var(--bd)', display:'flex',
              gap:8, alignItems:'center', flexWrap:'wrap' }}>
              {pideFin === false && (elegido?.fases || []).length > 1 && (
                <>
                  <span style={{ fontSize:11, color:'var(--gr)' }}>empieza en</span>
                  <select className="input" style={{ width:190 }} value={faseIni}
                    onChange={ev => setFaseIni(Number(ev.target.value))}>
                    {(elegido?.fases || []).map((fa, k) => (
                      <option key={fa.id} value={k}>{k + 1}. {fa.nombre}</option>
                    ))}
                  </select>
                </>
              )}
              <span style={{ fontSize:11, color:'var(--gr)' }}>{faseIni > 0 ? 'ese día es' : 'desde'}</span>
              <input className="input" style={{ width:150 }} type="date" value={ini} onChange={e => setIni(e.target.value)}/>
              {pideFin && (
                <>
                  <span style={{ fontSize:11, color:'var(--gr)' }}>hasta</span>
                  <input className="input" style={{ width:150 }} type="date" value={fin} onChange={e => setFin(e.target.value)}/>
                </>
              )}
              <div style={{ flex:1 }}/>
              <button className="btn btn-s" onClick={() => setAnadiendo(false)}>Cancelar</button>
              <button className="btn btn-p" onClick={anadir} disabled={sel === '' || (pideFin && fin === '')}>Añadir</button>
            </div>
          </div>
        </div>
      )}

      {editando && (() => {
        const sis = editando.sistema
        const fin = sis?.progresion === 'fecha_fin'
        return (
          <div className="modal-bg" onClick={ev => { if (ev.target === ev.currentTarget) setEditando(null) }}>
            <div className="modal" style={{ width: 460 }}>
              <div className="modal-title">
                {sis?.nombre}
                <button className="modal-close" onClick={() => setEditando(null)}>✕</button>
              </div>

              {fin === false && (sis?.fases || []).length > 1 && (
                <div className="field"><label>Empieza en</label>
                  <select className="input" value={eFase} onChange={ev => setEFase(Number(ev.target.value))}>
                    {(sis?.fases || []).map((fa, k) => (
                      <option key={fa.id} value={k}>{k + 1}. {fa.nombre}</option>
                    ))}
                  </select>
                </div>
              )}

              <div className="field">
                <label>{eFase > 0 ? 'Entra en esa fase el' : 'Empieza el'}</label>
                <input className="input" type="date" value={eIni} onChange={ev => setEIni(ev.target.value)}/>
              </div>

              {fin && (
                <div className="field"><label>Termina el</label>
                  <input className="input" type="date" value={eFin} onChange={ev => setEFin(ev.target.value)}/>
                </div>
              )}

              {(() => {
                const f = sis ? finPrevisto(sis, { ...editando, fecha_inicio: eIni, fecha_fin: eFin }) : null
                if (f == null) return null
                return (
                  <div style={{ fontSize: 12, color: 'var(--gd)', background: 'var(--gl)',
                    border: '1px solid var(--gm)', borderRadius: 6, padding: '7px 10px', marginBottom: 12 }}>
                    {fin ? 'Termina el' : 'Posible fin:'} <b>{corto(f)}</b>
                  </div>
                )
              })()}

              <div style={{ fontSize: 11, color: 'var(--gr)', lineHeight: 1.6, marginBottom: 12 }}>
                Las fases se recolocan solas. Las citas que ya pasaron siguen contando en la
                fase que les toque con las fechas nuevas: no hay nada congelado en ellas.
              </div>

              <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                <button className="btn btn-s" onClick={() => setEditando(null)}>Cancelar</button>
                <button className="btn btn-p" onClick={guardarEdicion}>Guardar</button>
              </div>
            </div>
          </div>
        )
      })()}

      {editandoSistema && biblio && (
        <ModalSistema sistema={editandoSistema}
          objetivos={biblio.objetivos} sesiones={biblio.sesiones}
          ejercicios={biblio.ejercicios} etiquetas={biblio.etiquetas} tests={biblio.tests}
          onCerrar={() => setEditandoSistema(null)}
          onGuardado={onCambio}/>
      )}

      {creando && biblio && (
        <ModalSistema sistema={null}
          objetivos={biblio.objetivos} sesiones={biblio.sesiones}
          ejercicios={biblio.ejercicios} etiquetas={biblio.etiquetas} tests={biblio.tests}
          onCerrar={() => setCreando(false)}
          onGuardado={() => { setCatalogo([]); cargarSistemas(true).then(setCatalogo) }}/>
      )}

      {asignaciones.length === 0 && !anadiendo && (
        <div className="muted">Sin sistema. Sus citas se ven como hasta ahora.</div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
        {asignaciones.map(a => {
          const s = a.sistema
          if (!s) return null
          const t = faseEn(s, a, hoy, logrados)
          const todas = tramos(s, a)
          const i = t ? (s.fases || []).findIndex(f => f.id === t.fase.id) : -1
          return (
            <div key={a.id}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 9, background: 'var(--w)',
              border: '1px solid var(--bd)', borderLeft: `4px solid ${s.color}`, borderRadius: 7,
              padding: '7px 11px 7px 9px' }}>
              <span style={{ width: 24, height: 24, borderRadius: 6, background: s.color, color: '#fff',
                display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                {s.icono ? <Ic name={s.icono} size={12}/> : null}
              </span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 12, color: 'var(--n)' }}>{s.nombre}</div>
                <div style={{ fontSize: 11, color: 'var(--gr)' }}>
                  {t ? `${t.fase.nombre}${i >= 0 && (s.fases||[]).length > 1 ? ` · ${i + 1} de ${(s.fases||[]).length}` : ''}`
                     : (todas.length === 0 && s.progresion !== 'objetivos' ? 'Le faltan fechas' : 'Fuera de fase')}
                </div>
                {(() => {
                  const f = finPrevisto(s, a)
                  if (f == null) return null
                  const cerrado = s.progresion === 'fecha_fin'
                  return (
                    <div style={{ fontSize: 10, color: 'var(--grl)' }}>
                      {cerrado ? 'termina el' : 'posible fin'} {corto(f)}
                    </div>
                  )
                })()}
              </div>
              {t && (t.fase.sesiones || []).length > 0 && (
                <button className="pill pill-soft" style={{ border: 'none', cursor: 'pointer', flexShrink: 0 }}
                  title="Copia a su ficha las sesiones que propone esta fase"
                  disabled={trayendo === t.fase.id}
                  onClick={() => traer(t.fase.id, t.fase.sesiones || [])}>
                  {trayendo === t.fase.id ? '…' : `traer ${(t.fase.sesiones || []).length}`}
                </button>
              )}
              {asignaciones.length > 1 && (a.principal
                ? <span className="pill pill-o on" style={{ flexShrink: 0 }} title="Marca el color de las citas">marco</span>
                : <button className="pill pill-soft" style={{ border: 'none', cursor: 'pointer', flexShrink: 0 }}
                    title="Hacer que sea este el que pinta las citas"
                    onClick={() => marcarPrincipal(pacienteId, a.id).then(onCambio)}>hacer marco</button>)}
              <button className="btn btn-s btn-sm" title="Cambiar fechas o fase"
                onClick={() => abrirEdicion(a)}><Ic name="calendario" size={12}/></button>
              {/* El sistema es SUYO: una copia. Retocarle una fase aqui no toca
                  el molde de la biblioteca ni a nadie mas que lo lleve. */}
              <button className="btn btn-s btn-sm" title="Editar este sistema solo para él"
                onClick={async () => { await cargarBiblio(); setEditandoSistema(s) }}>
                <Ic name="editar" size={12}/>
              </button>
              <button className="btn btn-s btn-sm" title="Quitar" onClick={() => quitar(a)}>✕</button>
            </div>
            {/* La evaluacion cuelga de la fase en la que esta HOY: es lo que hay que
                pasarle para poder salir de ella. */}
            {t && (
              <EvaluacionFase pacienteId={pacienteId} asignacion={a} fase={t.fase} color={s.color}/>
            )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
