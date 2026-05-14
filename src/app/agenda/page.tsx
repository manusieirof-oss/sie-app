'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase'

const HORAS = ['08:30','09:30','10:30','11:30','15:30','16:30','17:30','18:30','19:30','20:30','21:30']

export default function AgendaPage() {
  const [citas, setCitas] = useState<any[]>([])
  const [pacientes, setPacientes] = useState<any[]>([])
  const [fecha, setFecha] = useState(new Date().toISOString().split('T')[0])
  const [loading, setLoading] = useState(true)
  const [modal, setModal] = useState(false)
  const [guardando, setGuardando] = useState(false)
  const [nuevaCita, setNuevaCita] = useState({ paciente_id:'', hora:'08:30', sala:'A', tipo:'clase', notas:'' })
  const [panelPac, setPanelPac] = useState<any>(null)
  const supabase = createClient()

  const fechaDisplay = new Date(fecha+'T12:00:00').toLocaleDateString('es-ES',{weekday:'long',day:'numeric',month:'long',year:'numeric'})
  const hoy = new Date().toISOString().split('T')[0]

  useEffect(() => { cargar() }, [fecha])

  async function cargar() {
    setLoading(true)
    const [{ data: c }, { data: p }] = await Promise.all([
      supabase.from('citas').select('*, pacientes(id,nombre,apellidos,telefono,email,tipo_clase)').eq('fecha',fecha).neq('estado','cancelada').order('hora'),
      supabase.from('pacientes').select('id,nombre,apellidos').eq('estado','activo').order('nombre'),
    ])
    setCitas(c || [])
    setPacientes(p || [])
    setLoading(false)
  }

  function getCitasSlot(hora: string, sala: string) {
    return citas.filter(c => c.hora.startsWith(hora) && c.sala === sala)
  }

  async function crearCita() {
    if (guardando) return
    if (!nuevaCita.paciente_id) { alert('Selecciona un paciente'); return }
    setGuardando(true)
    const { error } = await supabase.from('citas').insert({
      paciente_id: nuevaCita.paciente_id,
      hora: nuevaCita.hora + ':00',
      sala: nuevaCita.sala,
      tipo: nuevaCita.tipo,
      notas: nuevaCita.notas,
      fecha,
      duracion_min: nuevaCita.tipo === 'valoracion' ? 60 : 50,
      estado: 'programada',
    })
    if (error) { alert('Error: ' + error.message); setGuardando(false); return }
    setModal(false)
    setNuevaCita({ paciente_id:'', hora:'08:30', sala:'A', tipo:'clase', notas:'' })
    setGuardando(false)
    cargar()
  }

  async function cambiarEstado(id: string, estado: string) {
    await supabase.from('citas').update({ estado }).eq('id', id)
    cargar()
  }

  const prevDay = () => { const d=new Date(fecha+'T12:00:00'); d.setDate(d.getDate()-1); setFecha(d.toISOString().split('T')[0]) }
  const nextDay = () => { const d=new Date(fecha+'T12:00:00'); d.setDate(d.getDate()+1); setFecha(d.toISOString().split('T')[0]) }

  const totalPersonas = citas.length
  const clases = citas.filter(c=>c.tipo==='clase').length
  const individuales = citas.filter(c=>c.tipo==='individual').length
  const valoraciones = citas.filter(c=>c.tipo==='valoracion'||c.tipo==='revaloracion').length

  return (
    <>
      {/* BARRA FECHA */}
      <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:10,background:'var(--w)',border:'1px solid var(--bd)',borderRadius:'var(--rl)',padding:'8px 12px'}}>
        <button className="btn btn-s btn-sm" onClick={prevDay}>‹</button>
        <input type="date" className="input" value={fecha} onChange={e=>setFecha(e.target.value)} style={{width:'auto',maxWidth:160,flexShrink:0}}/>
        <span style={{fontSize:12,fontWeight:400,color:'var(--n)',flex:1}}>{fechaDisplay}</span>
        {fecha!==hoy && <button className="btn btn-t btn-sm" onClick={()=>setFecha(hoy)}>Hoy</button>}
        <button className="btn btn-s btn-sm" onClick={nextDay}>›</button>
        <button className="btn btn-p btn-sm" onClick={()=>setModal(true)}>+ Nueva cita</button>
      </div>

      {loading ? <div className="loading">Cargando agenda...</div> : (
        <div style={{display:'grid',gridTemplateColumns:'1fr 190px',border:'1px solid var(--bd)',borderRadius:'var(--rl)',overflow:'hidden',background:'var(--w)',height:'calc(100vh - 145px)'}}>

          {/* GRID */}
          <div style={{overflowY:'auto'}}>
            <div style={{display:'grid',gridTemplateColumns:'48px 1fr 1fr',background:'var(--bl)',borderBottom:'1px solid var(--bd)',position:'sticky',top:0,zIndex:2}}>
              <div/>
              {['Sala A','Sala B'].map(s=>(
                <div key={s} style={{fontSize:9,fontWeight:600,color:'var(--g)',padding:'7px 10px',textAlign:'center',letterSpacing:.5,borderLeft:'1px solid var(--bd)'}}>{s}</div>
              ))}
            </div>

            {HORAS.map(h=>(
              <div key={h}>
                {h==='15:30' && <div style={{padding:'4px 10px',background:'var(--bm)',borderBottom:'1px solid var(--bd)',fontSize:8,color:'var(--gr)'}}>— Pausa · 12:30–15:30</div>}
                <div style={{display:'grid',gridTemplateColumns:'48px 1fr 1fr',borderBottom:'1px solid var(--bl)'}}>
                  <div style={{fontSize:9,color:'var(--grl)',padding:'6px 3px',borderRight:'1px solid var(--bl)',display:'flex',alignItems:'flex-start',justifyContent:'flex-end',fontWeight:300}}>{h}</div>
                  {(['A','B'] as const).map(sala=>{
                    const slotCitas = getCitasSlot(h, sala)
                    const tipo = slotCitas[0]?.tipo
                    const bgColor = tipo==='valoracion'||tipo==='revaloracion' ? 'var(--ambl)' : 'var(--gl)'
                    const borderColor = tipo==='valoracion'||tipo==='revaloracion' ? 'var(--amb)' : 'var(--g)'
                    return (
                      <div key={sala} style={{borderLeft:'1px solid var(--bl)',padding:3,minHeight:52}}>
                        {slotCitas.length===0 ? (
                          <div onClick={()=>{setNuevaCita(p=>({...p,hora:h,sala}));setModal(true)}}
                            style={{border:'1.5px dashed var(--bm)',borderRadius:4,minHeight:44,display:'flex',alignItems:'center',justifyContent:'center',fontSize:9,color:'var(--grl)',cursor:'pointer',transition:'all .12s'}}
                            onMouseOver={e=>{const el=e.currentTarget;el.style.borderColor='var(--g)';el.style.color='var(--g)';el.style.background='var(--gl)'}}
                            onMouseOut={e=>{const el=e.currentTarget;el.style.borderColor='var(--bm)';el.style.color='var(--grl)';el.style.background=''}}>
                            + libre
                          </div>
                        ) : (
                          <div style={{borderRadius:4,padding:'3px 5px',background:bgColor,borderLeft:`2px solid ${borderColor}`}}>
                            <div style={{fontSize:7,color:'var(--gr)',marginBottom:2,display:'flex',justifyContent:'space-between'}}>
                              <span>{tipo==='valoracion'?'Valoración':tipo==='individual'?'Individual':tipo==='revaloracion'?'Revaloración':'Clase'}</span>
                              <span>{slotCitas.length}/6</span>
                            </div>
                            {slotCitas.map(c=>(
                              <div key={c.id}
                                onClick={()=>setPanelPac(c)}
                                style={{display:'flex',alignItems:'center',gap:3,padding:'2px 4px',borderRadius:3,cursor:'pointer',marginBottom:1,minHeight:28,transition:'background .1s'}}
                                onMouseOver={e=>(e.currentTarget as HTMLElement).style.background='rgba(90,150,158,.15)'}
                                onMouseOut={e=>(e.currentTarget as HTMLElement).style.background=''}>
                                <div style={{width:14,height:14,borderRadius:'50%',background:'var(--g)',color:'#fff',fontSize:7,fontWeight:600,display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0}}>
                                  {c.pacientes?.nombre?.[0]||'?'}
                                </div>
                                <span style={{fontSize:10,color:'var(--n)',flex:1,fontWeight:300,whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis'}}>
                                  {c.pacientes?.nombre} {c.pacientes?.apellidos}
                                </span>
                                <div style={{width:6,height:6,borderRadius:'50%',background:'var(--g)',flexShrink:0}}/>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
                <div style={{display:'grid',gridTemplateColumns:'48px 1fr 1fr',background:'var(--bl)'}}>
                  <div style={{borderRight:'1px solid var(--bm)'}}/>
                  <div style={{gridColumn:'2/-1',padding:'1px 6px',borderLeft:'1px solid var(--bm)',fontSize:7,color:'var(--grl)'}}>10 min cambio</div>
                </div>
              </div>
            ))}
          </div>

          {/* LATERAL */}
          <div style={{borderLeft:'1px solid var(--bd)',display:'flex',flexDirection:'column'}}>
            <div style={{padding:'9px 11px',borderBottom:'1px solid var(--bd)',background:'var(--bl)'}}>
              <div style={{fontSize:11,fontWeight:400,color:'var(--n)'}}>Resumen del día</div>
              <div style={{fontSize:9,color:'var(--grl)',fontWeight:300}}>{fechaDisplay}</div>
            </div>
            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:4,padding:'8px 9px',borderBottom:'1px solid var(--bd)'}}>
              {[['Personas',totalPersonas],['Clases',clases],['Individ.',individuales],['Valorac.',valoraciones]].map(([l,v])=>(
                <div key={String(l)} style={{background:'var(--bl)',borderRadius:4,padding:'5px 6px'}}>
                  <div style={{fontSize:16,fontWeight:300,color:'var(--n)'}}>{v}</div>
                  <div style={{fontSize:8,color:'var(--grl)'}}>{l}</div>
                </div>
              ))}
            </div>
            <div style={{flex:1,overflowY:'auto',padding:'7px 9px'}}>
              <div style={{fontSize:8,fontWeight:600,color:'var(--grl)',letterSpacing:.5,textTransform:'uppercase',marginBottom:6}}>Notas del día</div>
              {citas.filter(c=>c.notas).map(c=>(
                <div key={c.id} style={{borderRadius:5,padding:'5px 8px',borderLeft:'2px solid var(--g)',background:'var(--gl)',marginBottom:4}}>
                  <div style={{fontSize:8,color:'var(--gd)',marginBottom:1}}>{c.pacientes?.nombre}</div>
                  <div style={{fontSize:10,color:'var(--n)',fontWeight:300,lineHeight:1.4}}>{c.notas}</div>
                </div>
              ))}
              {citas.filter(c=>c.notas).length===0 && <div style={{fontSize:10,color:'var(--grl)',fontWeight:300}}>Sin notas para hoy</div>}
            </div>
            <div style={{padding:'8px 10px',borderTop:'1px solid var(--bd)',fontSize:9,color:'var(--g)',cursor:'pointer',fontWeight:400}} onClick={()=>setModal(true)}>+ Nueva cita</div>
          </div>
        </div>
      )}

      {/* PANEL FLOTANTE PACIENTE */}
      {panelPac && (
        <>
          <div onClick={()=>setPanelPac(null)} style={{position:'fixed',inset:0,background:'rgba(38,40,37,.12)',zIndex:48}}/>
          <div style={{position:'fixed',top:0,right:0,width:300,height:'100vh',background:'var(--w)',borderLeft:'1px solid var(--bd)',zIndex:49,display:'flex',flexDirection:'column',boxShadow:'-4px 0 20px rgba(38,40,37,.08)'}}>
            <div style={{padding:'12px 14px',borderBottom:'1px solid var(--bd)',background:'var(--bl)',display:'flex',alignItems:'center',gap:9}}>
              <div style={{width:34,height:34,borderRadius:'50%',background:'var(--gl)',border:'1.5px solid var(--gm)',display:'flex',alignItems:'center',justifyContent:'center',fontSize:12,fontWeight:500,color:'var(--gd)',flexShrink:0}}>
                {(panelPac.pacientes?.nombre?.[0]||'?')+( panelPac.pacientes?.apellidos?.[0]||'')}
              </div>
              <div style={{flex:1}}>
                <div style={{fontSize:12,fontWeight:400,color:'var(--n)'}}>{panelPac.pacientes?.nombre} {panelPac.pacientes?.apellidos}</div>
                <div style={{fontSize:9,color:'var(--grl)',fontWeight:300}}>{panelPac.hora?.slice(0,5)} · Sala {panelPac.sala} · {panelPac.tipo}</div>
              </div>
              <button onClick={()=>setPanelPac(null)} style={{width:24,height:24,borderRadius:'50%',border:'1px solid var(--bd)',background:'var(--w)',cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',fontSize:12,color:'var(--gr)'}}>✕</button>
            </div>

            <div style={{flex:1,overflowY:'auto',padding:14}}>
              {/* DATOS */}
              <div style={{marginBottom:12}}>
                <div style={{fontSize:9,fontWeight:600,color:'var(--grl)',letterSpacing:.5,textTransform:'uppercase',marginBottom:7}}>Datos</div>
                {panelPac.pacientes?.telefono && <div style={{fontSize:11,color:'var(--n)',fontWeight:300,marginBottom:4}}>📞 {panelPac.pacientes.telefono}</div>}
                {panelPac.pacientes?.email && <div style={{fontSize:11,color:'var(--n)',fontWeight:300,marginBottom:4}}>✉️ {panelPac.pacientes.email}</div>}
                <div style={{fontSize:11,color:'var(--n)',fontWeight:300}}>🏷 {panelPac.pacientes?.tipo_clase||'—'}</div>
              </div>

              {/* ESTADO CITA */}
              <div style={{marginBottom:12}}>
                <div style={{fontSize:9,fontWeight:600,color:'var(--grl)',letterSpacing:.5,textTransform:'uppercase',marginBottom:7}}>Estado de la cita</div>
                <div style={{display:'flex',gap:5,flexWrap:'wrap'}}>
                  {[['programada','Programada','var(--b)'],['realizada','✓ Realizada','var(--g)'],['falta','Falta','var(--red)'],['cancelada','Cancelar','var(--red)']].map(([est,lbl,col])=>(
                    <button key={est} onClick={()=>{cambiarEstado(panelPac.id,est);setPanelPac(null)}}
                      style={{fontSize:10,padding:'5px 10px',borderRadius:'var(--r)',border:`1px solid ${col}`,background:panelPac.estado===est?col:'var(--w)',color:panelPac.estado===est?'#fff':col,cursor:'pointer',fontFamily:'system-ui'}}>
                      {lbl}
                    </button>
                  ))}
                </div>
              </div>

              {/* NOTAS */}
              {panelPac.notas && (
                <div style={{marginBottom:12}}>
                  <div style={{fontSize:9,fontWeight:600,color:'var(--grl)',letterSpacing:.5,textTransform:'uppercase',marginBottom:7}}>Notas</div>
                  <div style={{padding:'7px 9px',background:'var(--ambl)',borderRadius:5,border:'1px solid var(--amb)',fontSize:10,color:'#7A5800'}}>{panelPac.notas}</div>
                </div>
              )}
            </div>

            <div style={{padding:'10px 14px',borderTop:'1px solid var(--bd)',display:'flex',gap:6}}>
              <a href={`/pacientes/${panelPac.paciente_id}`} className="btn btn-p" style={{flex:1,justifyContent:'center',textDecoration:'none'}}>Ver ficha ↗</a>
              <button className="btn btn-s" onClick={()=>setPanelPac(null)}>Cerrar</button>
            </div>
          </div>
        </>
      )}

      {/* MODAL NUEVA CITA */}
      {modal && (
        <div className="modal-bg" onClick={e=>{if(e.target===e.currentTarget&&!guardando)setModal(false)}}>
          <div className="modal">
            <div className="modal-title">
              Nueva cita
              <button className="modal-close" onClick={()=>{if(!guardando)setModal(false)}}>✕</button>
            </div>
            <div style={{fontSize:10,color:'var(--grl)',marginBottom:16,fontWeight:300}}>{fechaDisplay}</div>
            <div className="field">
              <label>Paciente</label>
              <select className="input" value={nuevaCita.paciente_id} onChange={e=>setNuevaCita(p=>({...p,paciente_id:e.target.value}))} disabled={guardando}>
                <option value="">Seleccionar paciente...</option>
                {pacientes.map(p=>(<option key={p.id} value={p.id}>{p.nombre} {p.apellidos}</option>))}
              </select>
            </div>
            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:8}}>
              <div className="field">
                <label>Hora</label>
                <select className="input" value={nuevaCita.hora} onChange={e=>setNuevaCita(p=>({...p,hora:e.target.value}))} disabled={guardando}>
                  {HORAS.map(h=><option key={h} value={h}>{h}</option>)}
                </select>
              </div>
              <div className="field">
                <label>Sala</label>
                <select className="input" value={nuevaCita.sala} onChange={e=>setNuevaCita(p=>({...p,sala:e.target.value}))} disabled={guardando}>
                  <option value="A">Sala A</option>
                  <option value="B">Sala B</option>
                </select>
              </div>
            </div>
            <div className="field">
              <label>Tipo de cita</label>
              <select className="input" value={nuevaCita.tipo} onChange={e=>setNuevaCita(p=>({...p,tipo:e.target.value}))} disabled={guardando}>
                <option value="clase">Clase grupal</option>
                <option value="individual">Individual / Pareja</option>
                <option value="valoracion">Valoración inicial (60 min)</option>
                <option value="revaloracion">Revaloración (60 min)</option>
              </select>
            </div>
            <div className="field">
              <label>Notas (opcional)</label>
              <input className="input" value={nuevaCita.notas} onChange={e=>setNuevaCita(p=>({...p,notas:e.target.value}))} placeholder="ej. Molestia lumbar, precaución..." disabled={guardando}/>
            </div>
            <div style={{display:'flex',gap:8,marginTop:8}}>
              <button className="btn btn-d btn-sm" onClick={()=>{if(!guardando)setModal(false)}} disabled={guardando}>Cancelar</button>
              <div style={{flex:1}}/>
              <button className="btn btn-p" onClick={crearCita} disabled={guardando} style={{opacity:guardando?0.7:1}}>
                {guardando ? '⏳ Guardando...' : '✓ Crear cita'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
