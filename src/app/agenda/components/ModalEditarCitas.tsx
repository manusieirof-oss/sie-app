'use client'
import { useEffect, useRef, useState } from 'react'
import { Ic } from '@/lib/icons'
import { iconTipoClase } from '@/lib/tipos'
import { ocupacionPorSala } from '@/lib/citas'

export default function ModalEditarCitas({ citas, pacienteNombre, pacienteId, horas=[], salas=['A','B'], tiposClase=[], maxPersonas=6, guardando, onGuardar, onEstado, onEliminar, onCrear, onCerrar }: any) {
  const [rows, setRows] = useState<any[]>(
    (citas||[]).slice().sort((a:any,b:any)=>(a.fecha+a.hora).localeCompare(b.fecha+b.hora)).map((c:any)=>({
      id:c.id, paciente_id:c.paciente_id, fecha:c.fecha, hora:(c.hora||'').slice(0,5), sala:c.sala, tipo:c.tipo, estado:c.estado,
    }))
  )
  const [busy, setBusy] = useState(false)
  // Lo que ya se ha aplicado en la base de datos mientras el modal está abierto.
  // Cancelar y eliminar guardan al momento (no esperan al botón Guardar), así que
  // hay que decirlo: si no, se pulsa Guardar esperando que "confirme" y no pasa nada.
  const [hechas, setHechas] = useState({ canceladas: 0, eliminadas: 0 })
  const [flash, setFlash] = useState('')
  const avisar = (t:string) => { setFlash(t); setTimeout(()=>setFlash(''), 2600) }
  const GT = '1.2fr 0.8fr 0.7fr 1fr 82px'
  const cancelarCita = async (r:any) => { if(!onEstado) return; setBusy(true); await onEstado(orig(r.id),'cancelada'); setRows(p=>p.map(x=>x.id===r.id?{...x,estado:'cancelada'}:x)); setHechas(h=>({...h,canceladas:h.canceladas+1})); avisar('Cita cancelada · se ha generado su recuperación'); setBusy(false) }
  const deshacerCita = async (r:any) => { if(!onEstado) return; setBusy(true); await onEstado(orig(r.id),'programada'); setRows(p=>p.map(x=>x.id===r.id?{...x,estado:'programada'}:x)); setHechas(h=>({...h,canceladas:Math.max(0,h.canceladas-1)})); avisar('Cancelación deshecha'); setBusy(false) }
  const eliminarUna = async (r:any) => { if(!onEliminar) return; if(!confirm('¿Eliminar esta cita definitivamente? Se usa para errores: no guarda falta ni recuperación.')) return; setBusy(true); await onEliminar(orig(r.id)); setRows(p=>p.filter(x=>x.id!==r.id)); setHechas(h=>({...h,eliminadas:h.eliminadas+1})); avisar('Cita eliminada'); setBusy(false) }
  const HORAS = horas && horas.length>0 ? horas : ['08:30','09:30','10:30','11:30','15:30','16:30','17:30','18:30','19:30','20:30','21:30']
  const colorTipo = (t:string) => (tiposClase.find((x:any)=>x.valor===t)?.color) || '#5A969E'
  const set = (id:string, k:string, v:string) => setRows(p=>p.map(r=>{
    if (r.id !== id) return r
    const nr = { ...r, [k]: v }
    // Mover una cita es la misma decision que crearla: lo que importa es quien
    // hay ya en el hueco al que la llevas.
    if (k === 'fecha' || k === 'hora') pedirOcupRef.current?.(nr.fecha, nr.hora)
    return nr
  }))
  // `pedirOcup` se declara mas abajo; el ref evita tener que reordenar medio fichero.
  const pedirOcupRef = useRef<((f:string,h:string)=>void)|null>(null)

  // Tambien mira en `rows`: una cita creada aqui mismo no esta en las que
  // llegaron por props, y cancelarla o borrarla se quedaba sin objeto.
  const orig = (id:string) => (citas||[]).find((c:any)=>c.id===id) || rows.find(r=>r.id===id)
  const cambiada = (r:any) => { const o=orig(r.id); return o && (o.fecha!==r.fecha || (o.hora||'').slice(0,5)!==r.hora || o.sala!==r.sala || o.tipo!==r.tipo) }
  const nCambios = rows.filter(cambiada).length

  const diaSemana = (f:string) => new Date(f+'T12:00:00').toLocaleDateString('es-ES',{weekday:'short'})

  /**
   * UNA CITA MAS, SIN SALIR DE AQUI.
   *
   * El paciente y su tipo de clase ya se saben; lo unico que falta es cuando. Y
   * para decidir cuando hace falta ver QUIEN HAY YA en cada sala a esa hora:
   * elegir a ciegas es como se llenan de mas unas y quedan vacias otras.
   */
  const ultima = rows[rows.length-1]
  const [nueva, setNueva] = useState({
    fecha: '', hora: HORAS[0],
    sala: ultima?.sala || salas[0],
    tipo: ultima?.tipo || tiposClase[0]?.valor || '',
  })
  const [creando, setCreando] = useState(false)
  const [errNueva, setErrNueva] = useState('')

  /**
   * LA OCUPACION, PREGUNTADA UNA VEZ POR HORA.
   *
   * La piden dos sitios —la cita nueva y cada fila que mueves de dia— y varias
   * filas acaban cayendo en el mismo hueco. Con una consulta por fila serian
   * cinco preguntas identicas seguidas, asi que se guarda por `fecha|hora`.
   *
   * `pedidas` es un ref y no estado a proposito: solo sirve para no disparar
   * dos veces la misma consulta, y meterlo en estado provocaria el render que
   * volveria a dispararla.
   */
  const [ocupCache, setOcupCache] = useState<Record<string, Record<string,number>|null>>({})
  const pedidas = useRef<Set<string>>(new Set())
  const claveOcup = (f:string, h:string) => `${f}|${h}`

  function pedirOcup(f:string, h:string) {
    if (!f || !h) return
    const k = claveOcup(f, h)
    if (pedidas.current.has(k)) return
    pedidas.current.add(k)
    setOcupCache(c => ({ ...c, [k]: null }))
    ocupacionPorSala(f, h).then(r => setOcupCache(c => ({ ...c, [k]: r.porSala })))
  }

  pedirOcupRef.current = pedirOcup

  useEffect(() => { pedirOcup(nueva.fecha, nueva.hora) }, [nueva.fecha, nueva.hora])

  /** Las pastillas de ocupacion. Funcion, no componente: asi React no remonta nada. */
  const pintaOcupacion = (f:string, h:string, salaSel:string, elegirSala:(s:string)=>void) => {
    const datos = ocupCache[claveOcup(f, h)]
    if (datos === undefined) return null
    if (datos === null) return <span style={{fontSize:9,color:'var(--grl)'}}>Mirando la ocupación…</span>
    return salas.map((sa:string) => {
      const n = datos[sa] || 0
      const lleno = n >= maxPersonas
      return (
        <span key={sa} onClick={()=>elegirSala(sa)}
          style={{fontSize:10,cursor:'pointer',padding:'2px 9px',borderRadius:99,
                  border:`1px solid ${salaSel===sa?'var(--g)':'var(--bd)'}`,
                  background:salaSel===sa?'var(--gl)':'var(--w)',
                  color:lleno?'var(--red)':'var(--gr)',fontWeight:lleno?600:400}}>
          Sala {sa} <strong style={{color:lleno?'var(--red)':'var(--n)'}}>{n}</strong>
          <span style={{color:'var(--grl)',fontWeight:400}}>/{maxPersonas}</span>
          {lleno && ' · llena'}
        </span>
      )
    })
  }

  async function crear() {
    if (!onCrear || !pacienteId || !nueva.fecha) return
    setErrNueva('')
    setCreando(true)
    const r = await onCrear({ ...nueva, pacienteId })
    setCreando(false)
    if (!r?.ok) { setErrNueva(r?.error || 'No se ha podido crear la cita'); return }
    setRows(p => [...p, {
      id: r.cita.id, paciente_id: r.cita.paciente_id, fecha: r.cita.fecha,
      hora: (r.cita.hora||'').slice(0,5), sala: r.cita.sala, tipo: r.cita.tipo, estado: r.cita.estado,
    }].sort((a,b)=>(a.fecha+a.hora).localeCompare(b.fecha+b.hora)))
    // El hueco acaba de ganar a alguien: se olvida lo cacheado y se vuelve a mirar.
    const k = claveOcup(nueva.fecha, nueva.hora)
    pedidas.current.delete(k)
    pedirOcup(nueva.fecha, nueva.hora)
    avisar('Cita creada')
    // La fecha se limpia y lo demas se queda: lo normal es añadir varias seguidas
    // al mismo paciente, en la misma sala y a la misma hora.
    setNueva(n => ({ ...n, fecha: '' }))
  }

  return (
    <div className="modal-bg" onClick={e=>{if(e.target===e.currentTarget&&!guardando)onCerrar()}}>
      <div className="modal" style={{width:620,maxWidth:'94vw'}}>
        <div className="modal-title">
          <span>Editar sesiones · {pacienteNombre}</span>
          <button className="modal-close" onClick={()=>{if(!guardando)onCerrar()}}>✕</button>
        </div>
        <div style={{fontSize:10,color:'var(--grl)',marginBottom:12}}>Edita día, hora, sala o tipo de varias citas a la vez (la sesión se mantiene). También puedes <b style={{fontWeight:600,color:'#8A6410'}}>Cancelar</b> (avisó, genera recuperación) o <b style={{fontWeight:600,color:'var(--red)'}}>eliminar</b> (borra, solo errores) cada cita.</div>

        <div style={{display:'grid',gridTemplateColumns:GT,gap:6,fontSize:9,fontWeight:600,color:'var(--grl)',letterSpacing:.4,textTransform:'uppercase',padding:'0 4px 6px'}}>
          <div>Día</div><div>Hora</div><div>Sala</div><div>Tipo</div><div/>
        </div>
        <div style={{maxHeight:'52vh',overflowY:'auto'}}>
          {rows.length===0 && <div style={{fontSize:11,color:'var(--grl)',padding:'10px 4px'}}>Este paciente no tiene citas este mes.</div>}
          {rows.map(r=>{
            const cancel = r.estado==='cancelada'
            const dis = guardando || busy || cancel
            const movida = !cancel && (() => { const o = orig(r.id); return !!o && (o.fecha !== r.fecha || (o.hora||'').slice(0,5) !== r.hora) })()
            return (
              <div key={r.id} style={{marginBottom:3}}>
              <div style={{display:'grid',gridTemplateColumns:GT,gap:6,alignItems:'center',padding:'5px 4px',borderRadius:7,background:cancel?'var(--redl)':(cambiada(r)?'var(--gl)':'transparent')}}>
                {cancel ? (
                  <div style={{display:'flex',alignItems:'center',gap:6,minWidth:0}}>
                    <span style={{fontSize:11,color:'var(--red)',textDecoration:'line-through',whiteSpace:'nowrap'}}>{new Date(r.fecha+'T12:00:00').toLocaleDateString('es-ES',{day:'numeric',month:'short'})}</span>
                    <span style={{fontSize:8,fontWeight:600,color:'var(--red)',background:'var(--w)',border:'1px solid var(--red)',borderRadius:99,padding:'1px 7px',flexShrink:0}}>CANCELADA</span>
                  </div>
                ) : (
                  <div style={{display:'flex',alignItems:'center',gap:5}}>
                    <input type="date" className="input" value={r.fecha} onChange={e=>set(r.id,'fecha',e.target.value)} disabled={dis} style={{fontSize:11,padding:'5px 7px'}}/>
                    <span style={{fontSize:9,color:'var(--grl)',width:24,flexShrink:0,textTransform:'capitalize'}}>{diaSemana(r.fecha)}</span>
                  </div>
                )}
                <select className="input" value={r.hora} onChange={e=>set(r.id,'hora',e.target.value)} disabled={dis} style={{fontSize:11,padding:'5px 7px',opacity:cancel?0.6:1}}>
                  {!HORAS.includes(r.hora)&&<option value={r.hora}>{r.hora}</option>}
                  {HORAS.map((h:string)=><option key={h} value={h}>{h}</option>)}
                </select>
                <select className="input" value={r.sala} onChange={e=>set(r.id,'sala',e.target.value)} disabled={dis} style={{fontSize:11,padding:'5px 7px',opacity:cancel?0.6:1}}>
                  {!salas.includes(r.sala)&&<option value={r.sala}>{r.sala}</option>}
                  {salas.map((s:string)=><option key={s} value={s}>{s}</option>)}
                </select>
                <div style={{display:'flex',alignItems:'center',gap:5,minWidth:0,opacity:cancel?0.6:1}}>
                  <span style={{display:'inline-flex',color:colorTipo(r.tipo),flexShrink:0}}><Ic name={iconTipoClase(r.tipo,(tiposClase.find((t:any)=>t.valor===r.tipo)||{}).icono)} size={14}/></span>
                  <select className="input" value={r.tipo} onChange={e=>set(r.id,'tipo',e.target.value)} disabled={dis} style={{fontSize:11,padding:'5px 7px'}}>
                    {tiposClase.map((t:any)=><option key={t.valor} value={t.valor}>{t.nombre}</option>)}
                  </select>
                </div>
                <div style={{display:'flex',alignItems:'center',gap:8,justifyContent:'flex-end'}}>
                  {cancel ? (
                    <button onClick={()=>deshacerCita(r)} disabled={busy} style={{fontSize:9,color:'var(--g)',background:'none',border:'none',cursor:'pointer',fontWeight:500,padding:0}} title="Deshacer la cancelación">Deshacer</button>
                  ) : (
                    <>
                      <button onClick={()=>cancelarCita(r)} disabled={busy} style={{fontSize:10,color:'#8A6410',background:'none',border:'none',cursor:'pointer',padding:0}} title="Cancelar (avisó; genera recuperación)">Cancelar</button>
                      <button onClick={()=>eliminarUna(r)} disabled={busy} style={{display:'inline-flex',color:'var(--red)',background:'none',border:'none',cursor:'pointer',padding:0}} title="Eliminar (borra la cita; solo para errores)"><Ic name="papelera" size={14}/></button>
                    </>
                  )}
                </div>
              </div>
              {/* Solo en la fila que has movido: quien hay en el hueco nuevo. */}
              {movida && (
                <div style={{display:'flex',alignItems:'center',gap:8,flexWrap:'wrap',padding:'4px 4px 6px 4px'}}>
                  {pintaOcupacion(r.fecha, r.hora, r.sala, (sa:string)=>set(r.id,'sala',sa))}
                </div>
              )}
              </div>
            )
          })}
        </div>

        {onCrear && pacienteId && (
          <div style={{marginTop:10,paddingTop:11,borderTop:'1px solid var(--bd)'}}>
            <div style={{fontSize:9,fontWeight:600,color:'var(--grl)',letterSpacing:.4,textTransform:'uppercase',marginBottom:6}}>
              Añadir una cita
            </div>
            <div style={{display:'grid',gridTemplateColumns:GT,gap:6,alignItems:'center'}}>
              <div style={{display:'flex',alignItems:'center',gap:5}}>
                <input type="date" className="input" value={nueva.fecha} onChange={e=>setNueva(n=>({...n,fecha:e.target.value}))}
                  disabled={creando||guardando} style={{fontSize:11,padding:'5px 7px'}}/>
                <span style={{fontSize:9,color:'var(--grl)',width:24,flexShrink:0,textTransform:'capitalize'}}>
                  {nueva.fecha ? diaSemana(nueva.fecha) : ''}
                </span>
              </div>
              <select className="input" value={nueva.hora} onChange={e=>setNueva(n=>({...n,hora:e.target.value}))}
                disabled={creando||guardando} style={{fontSize:11,padding:'5px 7px'}}>
                {HORAS.map((h:string)=><option key={h} value={h}>{h}</option>)}
              </select>
              <select className="input" value={nueva.sala} onChange={e=>setNueva(n=>({...n,sala:e.target.value}))}
                disabled={creando||guardando} style={{fontSize:11,padding:'5px 7px'}}>
                {salas.map((s:string)=><option key={s} value={s}>{s}</option>)}
              </select>
              <div style={{display:'flex',alignItems:'center',gap:5,minWidth:0}}>
                <span style={{display:'inline-flex',color:colorTipo(nueva.tipo),flexShrink:0}}>
                  <Ic name={iconTipoClase(nueva.tipo,(tiposClase.find((t:any)=>t.valor===nueva.tipo)||{}).icono)} size={14}/>
                </span>
                <select className="input" value={nueva.tipo} onChange={e=>setNueva(n=>({...n,tipo:e.target.value}))}
                  disabled={creando||guardando} style={{fontSize:11,padding:'5px 7px'}}>
                  {tiposClase.map((t:any)=><option key={t.valor} value={t.valor}>{t.nombre}</option>)}
                </select>
              </div>
              <div style={{display:'flex',justifyContent:'flex-end'}}>
                <button className="btn btn-p btn-sm" onClick={crear} disabled={!nueva.fecha||creando||guardando}>
                  {creando ? '…' : '+ Añadir'}
                </button>
              </div>
            </div>

            {/* QUIEN HAY YA a esa hora, sala por sala. Es el dato que decide. */}
            <div style={{display:'flex',alignItems:'center',gap:10,marginTop:7,flexWrap:'wrap',minHeight:16}}>
              {!nueva.fecha
                ? <span style={{fontSize:9,color:'var(--grl)'}}>Elige el día y verás cuánta gente hay en cada sala.</span>
                : pintaOcupacion(nueva.fecha, nueva.hora, nueva.sala, (sa:string)=>setNueva(x=>({...x,sala:sa})))}
            </div>
            {errNueva && <div style={{fontSize:10,color:'var(--red)',marginTop:6}}>{errNueva}</div>}
          </div>
        )}

        {flash && (
          <div style={{marginTop:10,fontSize:10,color:'var(--gd)',background:'var(--gl)',border:'1px solid var(--gm)',borderRadius:6,padding:'6px 10px',display:'flex',alignItems:'center',gap:6}}>
            <Ic name="ok" size={12}/> {flash}
          </div>
        )}
        {(hechas.canceladas>0||hechas.eliminadas>0) && (
          <div style={{marginTop:8,fontSize:10,color:'var(--gr)',display:'flex',alignItems:'center',gap:6,flexWrap:'wrap'}}>
            <span style={{fontWeight:600,color:'var(--n)'}}>Ya aplicado:</span>
            {hechas.canceladas>0&&<span style={{color:'#8A6410'}}>{hechas.canceladas} cancelada{hechas.canceladas>1?'s':''}</span>}
            {hechas.eliminadas>0&&<span style={{color:'var(--red)'}}>{hechas.eliminadas} eliminada{hechas.eliminadas>1?'s':''}</span>}
            <span style={{color:'var(--grl)'}}>· ya guardado, no hace falta pulsar Guardar</span>
          </div>
        )}

        <div style={{display:'flex',gap:8,marginTop:14,alignItems:'center'}}>
          <span style={{fontSize:10,color:'var(--grl)'}}>{nCambios>0?`${nCambios} cita${nCambios>1?'s':''} con cambios sin guardar`:'Sin cambios pendientes'}</span>
          <div style={{flex:1}}/>
          <button className="btn btn-d btn-sm" onClick={()=>{if(!guardando)onCerrar()}} disabled={guardando}>{nCambios>0?'Descartar':'Cancelar'}</button>
          {nCambios>0 ? (
            <button className="btn btn-p" onClick={()=>onGuardar(rows.filter(cambiada))} disabled={guardando}>
              {guardando?'Guardando…':`✓ Guardar (${nCambios})`}
            </button>
          ) : (
            <button className="btn btn-p" onClick={()=>{if(!guardando)onCerrar()}} disabled={guardando}>✓ Hecho</button>
          )}
        </div>
      </div>
    </div>
  )
}
