'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'

const HORAS = ['08:30','09:30','10:30','11:30','15:30','16:30','17:30','18:30','19:30','20:30','21:30']
const DIAS_SEMANA = ['Lun','Mar','Mié','Jue','Vie','Sáb']

export default function AgendaPage() {
  const [vista, setVista] = useState<'dia'|'semana'|'mes'>('dia')
  const [citas, setCitas] = useState<any[]>([])
  const [pacientes, setPacientes] = useState<any[]>([])
  const [fecha, setFecha] = useState(new Date().toISOString().split('T')[0])
  const [loading, setLoading] = useState(true)
  const [modal, setModal] = useState(false)
  const [guardando, setGuardando] = useState(false)
  const [panelPac, setPanelPac] = useState<any>(null)
  const [panelTab, setPanelTab] = useState<'sesion'|'datos'>('sesion')
  const [sesionDetalle, setSesionDetalle] = useState<any>(null)
  const [sesionesPaciente, setSesionesPaciente] = useState<any[]>([])
  const [loadingSesion, setLoadingSesion] = useState(false)
  const [anotaciones, setAnotaciones] = useState<Record<string,string>>({})
  const [pesos, setPesos] = useState<Record<string,string>>({})
  const [guardandoAnot, setGuardandoAnot] = useState<string|null>(null)
  const [mostrarSesiones, setMostrarSesiones] = useState(false)
  const [nuevaCita, setNuevaCita] = useState({
    paciente_id:'', hora:'08:30', sala:'A', tipo:'clase', notas:'',
    repetir: false, dias_repetir: [] as string[], fecha_fin: '', periodo: '3meses'
  })

  const hoy = new Date().toISOString().split('T')[0]
  const fechaObj = new Date(fecha+'T12:00:00')
  const fechaDisplay = fechaObj.toLocaleDateString('es-ES',{weekday:'long',day:'numeric',month:'long',year:'numeric'})

  useEffect(() => { cargarPacientes() }, [])
  useEffect(() => { cargar() }, [fecha, vista])

  async function cargarPacientes() {
    const { data } = await supabase.from('pacientes').select('id,nombre,apellidos').eq('estado','activo').order('nombre')
    setPacientes(data||[])
  }

  async function cargar() {
    setLoading(true)
    let fechaInicio = fecha, fechaFin = fecha
    if (vista==='semana') {
      const d = new Date(fecha+'T12:00:00'), day = d.getDay()
      const diff = day===0?-6:1-day
      const lunes = new Date(d); lunes.setDate(d.getDate()+diff)
      const sabado = new Date(lunes); sabado.setDate(lunes.getDate()+5)
      fechaInicio = lunes.toISOString().split('T')[0]
      fechaFin = sabado.toISOString().split('T')[0]
    } else if (vista==='mes') {
      fechaInicio = fecha.slice(0,7)+'-01'
      const ultimoDia = new Date(parseInt(fecha.slice(0,4)),parseInt(fecha.slice(5,7)),0).getDate()
      fechaFin = fecha.slice(0,7)+'-'+String(ultimoDia).padStart(2,'0')
    }
    const { data: c } = await supabase.from('citas').select('*, pacientes(id,nombre,apellidos,telefono,email,tipo_clase), sesiones:sesion_id(id,nombre,partes,descripcion)').gte('fecha',fechaInicio).lte('fecha',fechaFin).neq('estado','cancelada').order('fecha').order('hora')
    setCitas(c||[])
    setLoading(false)
  }

  function getCitasSlot(h: string, sala: string, f?: string) {
    return citas.filter(c=>c.hora.startsWith(h) && c.sala===sala && c.fecha===(f||fecha))
  }

  function getFechasSemana() {
    const d = new Date(fecha+'T12:00:00'), day = d.getDay()
    const diff = day===0?-6:1-day
    const lunes = new Date(d); lunes.setDate(d.getDate()+diff)
    return Array.from({length:6},(_,i)=>{ const fd=new Date(lunes); fd.setDate(lunes.getDate()+i); return fd.toISOString().split('T')[0] })
  }

  function getDiasMes() {
    const anio=parseInt(fecha.slice(0,4)), mes=parseInt(fecha.slice(5,7))
    const primero=new Date(anio,mes-1,1), ultimo=new Date(anio,mes,0)
    const dias: (string|null)[] = []
    let diaSemana=primero.getDay()===0?7:primero.getDay()
    for(let i=1;i<diaSemana;i++) dias.push(null)
    for(let i=1;i<=ultimo.getDate();i++) dias.push(`${anio}-${String(mes).padStart(2,'0')}-${String(i).padStart(2,'0')}`)
    return dias
  }

  async function abrirPanel(c: any) {
    setPanelPac(c)
    setPanelTab('sesion')
    setSesionDetalle(null)
    setAnotaciones({})
    setPesos({})
    setLoadingSesion(true)

    // Cargar sesión asignada a la cita
    if (c.sesiones) {
      setSesionDetalle(c.sesiones)
      // Cargar anotaciones previas
      const { data: anots } = await supabase.from('anotaciones_ejercicios').select('*').eq('paciente_id',c.paciente_id).eq('cita_id',c.id)
      if (anots) {
        const anotMap: Record<string,string> = {}
        const pesoMap: Record<string,string> = {}
        anots.forEach((a:any) => { anotMap[a.ejercicio_id]=a.anotacion||''; pesoMap[a.ejercicio_id]=a.peso_real?.toString()||'' })
        setAnotaciones(anotMap); setPesos(pesoMap)
      }
    }

    // Cargar sesiones del paciente para asignar
    const { data: sesionesPac } = await supabase.from('sesiones').select('id,nombre,descripcion,partes').eq('paciente_id',c.paciente_id).order('created_at',{ascending:false})
    setSesionesPaciente(sesionesPac||[])
    setLoadingSesion(false)
  }

  async function asignarSesion(sesionId: string) {
    await supabase.from('citas').update({ sesion_id: sesionId }).eq('id', panelPac.id)
    setMostrarSesiones(false)
    cargar()
    // Reabrir panel con datos actualizados
    setTimeout(async()=>{
      const { data: c } = await supabase.from('citas').select('*, pacientes(id,nombre,apellidos,telefono,email,tipo_clase), sesiones:sesion_id(id,nombre,partes,descripcion)').eq('id',panelPac.id).single()
      if (c) abrirPanel(c)
    }, 500)
  }

  async function guardarAnotacion(ejercicioId: string) {
    if (!panelPac) return
    setGuardandoAnot(ejercicioId)
    const existing = await supabase.from('anotaciones_ejercicios').select('id').eq('paciente_id',panelPac.paciente_id).eq('ejercicio_id',ejercicioId).eq('cita_id',panelPac.id).maybeSingle()
    const datos = { paciente_id:panelPac.paciente_id, ejercicio_id:ejercicioId, cita_id:panelPac.id, anotacion:anotaciones[ejercicioId]||'', peso_real:pesos[ejercicioId]?parseFloat(pesos[ejercicioId]):null, fecha }
    if (existing.data) {
      await supabase.from('anotaciones_ejercicios').update(datos).eq('id',existing.data.id)
    } else {
      await supabase.from('anotaciones_ejercicios').insert(datos)
    }
    setGuardandoAnot(null)
  }

  async function crearCita() {
    if (guardando) return
    if (!nuevaCita.paciente_id) { alert('Selecciona un paciente'); return }
    setGuardando(true)
    if (!nuevaCita.repetir) {
      await supabase.from('citas').insert({ paciente_id:nuevaCita.paciente_id, hora:nuevaCita.hora+':00', sala:nuevaCita.sala, tipo:nuevaCita.tipo, notas:nuevaCita.notas, fecha, duracion_min:nuevaCita.tipo==='valoracion'?60:50, estado:'programada' })
    } else {
      if (nuevaCita.dias_repetir.length===0) { alert('Selecciona al menos un día'); setGuardando(false); return }
      let fechaFin = nuevaCita.fecha_fin
      if (!fechaFin) {
        const fd = new Date(fecha+'T12:00:00')
        if (nuevaCita.periodo==='1mes') fd.setMonth(fd.getMonth()+1)
        else if (nuevaCita.periodo==='3meses') fd.setMonth(fd.getMonth()+3)
        else if (nuevaCita.periodo==='6meses') fd.setMonth(fd.getMonth()+6)
        else if (nuevaCita.periodo==='1anio') fd.setFullYear(fd.getFullYear()+1)
        fechaFin = fd.toISOString().split('T')[0]
      }
      const diasMap: Record<string,number> = { Lun:1, Mar:2, Mié:3, Jue:4, Vie:5, Sáb:6 }
      const citasACrear = []
      const fechaActual = new Date(fecha+'T12:00:00')
      const fechaFinObj = new Date(fechaFin+'T12:00:00')
      while (fechaActual <= fechaFinObj) {
        const diaSemana = fechaActual.getDay()===0?7:fechaActual.getDay()
        const diaStr = Object.entries(diasMap).find(([,v])=>v===diaSemana)?.[0]
        if (diaStr && nuevaCita.dias_repetir.includes(diaStr)) {
          citasACrear.push({ paciente_id:nuevaCita.paciente_id, hora:nuevaCita.hora+':00', sala:nuevaCita.sala, tipo:nuevaCita.tipo, notas:nuevaCita.notas, fecha:fechaActual.toISOString().split('T')[0], duracion_min:nuevaCita.tipo==='valoracion'?60:50, estado:'programada' })
        }
        fechaActual.setDate(fechaActual.getDate()+1)
      }
      if (citasACrear.length>0) {
        for (let i=0;i<citasACrear.length;i+=50) await supabase.from('citas').insert(citasACrear.slice(i,i+50))
        alert(`✓ ${citasACrear.length} citas creadas`)
      }
    }
    setModal(false)
    setNuevaCita({ paciente_id:'', hora:'08:30', sala:'A', tipo:'clase', notas:'', repetir:false, dias_repetir:[], fecha_fin:'', periodo:'3meses' })
    setGuardando(false)
    cargar()
  }

  async function cambiarEstado(id: string, estado: string) {
    await supabase.from('citas').update({ estado }).eq('id',id); cargar()
  }

  const prevPeriodo = () => { const d=new Date(fecha+'T12:00:00'); if(vista==='dia')d.setDate(d.getDate()-1); else if(vista==='semana')d.setDate(d.getDate()-7); else d.setMonth(d.getMonth()-1); setFecha(d.toISOString().split('T')[0]) }
  const nextPeriodo = () => { const d=new Date(fecha+'T12:00:00'); if(vista==='dia')d.setDate(d.getDate()+1); else if(vista==='semana')d.setDate(d.getDate()+7); else d.setMonth(d.getMonth()+1); setFecha(d.toISOString().split('T')[0]) }

  const toggleDia = (dia: string) => setNuevaCita(p=>({...p,dias_repetir:p.dias_repetir.includes(dia)?p.dias_repetir.filter(d=>d!==dia):[...p.dias_repetir,dia]}))

  const totalPersonas = citas.filter(c=>c.fecha===fecha).length
  const clases = citas.filter(c=>c.fecha===fecha&&c.tipo==='clase').length

  return (
    <>
      {/* BARRA CONTROLES */}
      <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:10,background:'var(--w)',border:'1px solid var(--bd)',borderRadius:'var(--rl)',padding:'8px 12px',flexWrap:'wrap'}}>
        <div style={{display:'flex',gap:2,background:'var(--bl)',border:'1px solid var(--bd)',borderRadius:'var(--r)',padding:2}}>
          {(['dia','semana','mes'] as const).map(v=>(
            <button key={v} onClick={()=>setVista(v)} style={{fontSize:10,padding:'4px 10px',borderRadius:4,border:'none',cursor:'pointer',fontFamily:'system-ui',background:vista===v?'var(--w)':'transparent',color:vista===v?'var(--n)':'var(--grl)',fontWeight:vista===v?500:300,boxShadow:vista===v?'0 1px 3px rgba(0,0,0,.08)':'none'}}>
              {v==='dia'?'Día':v==='semana'?'Semana':'Mes'}
            </button>
          ))}
        </div>
        <button className="btn btn-s btn-sm" onClick={prevPeriodo}>‹</button>
        <input type="date" className="input" value={fecha} onChange={e=>setFecha(e.target.value)} style={{width:'auto',maxWidth:160,flexShrink:0}}/>
        <span style={{fontSize:11,fontWeight:400,color:'var(--n)',flex:1,whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis'}}>
          {vista==='dia'?fechaDisplay:vista==='semana'?'Semana del '+fechaDisplay:fechaObj.toLocaleDateString('es-ES',{month:'long',year:'numeric'})}
        </span>
        {fecha!==hoy && <button className="btn btn-t btn-sm" onClick={()=>setFecha(hoy)}>Hoy</button>}
        <button className="btn btn-s btn-sm" onClick={nextPeriodo}>›</button>
        <button className="btn btn-p btn-sm" onClick={()=>setModal(true)}>+ Nueva cita</button>
      </div>

      {loading ? <div className="loading">Cargando agenda...</div> : (
        <>
        {/* VISTA DÍA */}
        {vista==='dia' && (
          <div style={{display:'grid',gridTemplateColumns:'1fr 190px',border:'1px solid var(--bd)',borderRadius:'var(--rl)',overflow:'hidden',background:'var(--w)',height:'calc(100vh - 150px)'}}>
            <div style={{overflowY:'auto'}}>
              <div style={{display:'grid',gridTemplateColumns:'48px 1fr 1fr',background:'var(--bl)',borderBottom:'1px solid var(--bd)',position:'sticky',top:0,zIndex:2}}>
                <div/>
                {['Sala A','Sala B'].map(s=><div key={s} style={{fontSize:9,fontWeight:600,color:'var(--g)',padding:'7px 10px',textAlign:'center',letterSpacing:.5,borderLeft:'1px solid var(--bd)'}}>{s}</div>)}
              </div>
              {HORAS.map(h=>(
                <div key={h}>
                  {h==='15:30' && <div style={{padding:'4px 10px',background:'var(--bm)',borderBottom:'1px solid var(--bd)',fontSize:8,color:'var(--gr)'}}>— Pausa · 12:30–15:30</div>}
                  <div style={{display:'grid',gridTemplateColumns:'48px 1fr 1fr',borderBottom:'1px solid var(--bl)'}}>
                    <div style={{fontSize:9,color:'var(--grl)',padding:'6px 3px',borderRight:'1px solid var(--bl)',display:'flex',alignItems:'flex-start',justifyContent:'flex-end',fontWeight:300}}>{h}</div>
                    {(['A','B'] as const).map(sala=>{
                      const slotCitas = getCitasSlot(h,sala)
                      const tipo = slotCitas[0]?.tipo
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
                            <div style={{borderRadius:4,padding:'3px 5px',background:tipo==='valoracion'||tipo==='revaloracion'?'var(--ambl)':'var(--gl)',borderLeft:`2px solid ${tipo==='valoracion'||tipo==='revaloracion'?'var(--amb)':'var(--g)'}`}}>
                              <div style={{fontSize:7,color:'var(--gr)',marginBottom:2,display:'flex',justifyContent:'space-between'}}>
                                <span>{tipo==='valoracion'?'Valoración':tipo==='individual'?'Individual':tipo==='revaloracion'?'Revaloración':'Clase'}</span>
                                <span>{slotCitas.length}/6</span>
                              </div>
                              {slotCitas.map(c=>(
                                <div key={c.id} onClick={()=>abrirPanel(c)}
                                  style={{display:'flex',alignItems:'center',gap:3,padding:'2px 4px',borderRadius:3,cursor:'pointer',marginBottom:1,minHeight:28}}
                                  onMouseOver={e=>(e.currentTarget as HTMLElement).style.background='rgba(90,150,158,.15)'}
                                  onMouseOut={e=>(e.currentTarget as HTMLElement).style.background=''}>
                                  <div style={{width:14,height:14,borderRadius:'50%',background:'var(--g)',color:'#fff',fontSize:7,fontWeight:600,display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0}}>
                                    {c.pacientes?.nombre?.[0]||'?'}
                                  </div>
                                  <span style={{fontSize:10,color:'var(--n)',flex:1,fontWeight:300,whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis'}}>
                                    {c.pacientes?.nombre} {c.pacientes?.apellidos}
                                  </span>
                                  {c.sesiones && <span style={{fontSize:7,color:'var(--g)'}}>📋</span>}
                                  <div style={{width:6,height:6,borderRadius:'50%',background:c.estado==='realizada'?'var(--g)':c.estado==='falta'?'var(--red)':'var(--amb)',flexShrink:0}}/>
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
                {[['Personas',totalPersonas],['Clases',clases]].map(([l,v])=>(
                  <div key={String(l)} style={{background:'var(--bl)',borderRadius:4,padding:'5px 6px'}}>
                    <div style={{fontSize:16,fontWeight:300,color:'var(--n)'}}>{v}</div>
                    <div style={{fontSize:8,color:'var(--grl)'}}>{l}</div>
                  </div>
                ))}
              </div>
              <div style={{flex:1,overflowY:'auto',padding:'7px 9px'}}>
                <div style={{fontSize:8,fontWeight:600,color:'var(--grl)',letterSpacing:.5,textTransform:'uppercase',marginBottom:6}}>Notas del día</div>
                {citas.filter(c=>c.notas&&c.fecha===fecha).map(c=>(
                  <div key={c.id} style={{borderRadius:5,padding:'5px 8px',borderLeft:'2px solid var(--g)',background:'var(--gl)',marginBottom:4}}>
                    <div style={{fontSize:8,color:'var(--gd)',marginBottom:1}}>{c.pacientes?.nombre}</div>
                    <div style={{fontSize:10,color:'var(--n)',fontWeight:300,lineHeight:1.4}}>{c.notas}</div>
                  </div>
                ))}
              </div>
              <div style={{padding:'8px 10px',borderTop:'1px solid var(--bd)',fontSize:9,color:'var(--g)',cursor:'pointer'}} onClick={()=>setModal(true)}>+ Nueva cita</div>
            </div>
          </div>
        )}

        {/* VISTA SEMANA */}
        {vista==='semana' && (
          <div style={{border:'1px solid var(--bd)',borderRadius:'var(--rl)',overflow:'hidden',background:'var(--w)',height:'calc(100vh - 150px)',overflowY:'auto'}}>
            {(()=>{
              const fechasSemana = getFechasSemana()
              const diasNombres = ['Lun','Mar','Mié','Jue','Vie','Sáb']
              return (
                <>
                  <div style={{display:'grid',gridTemplateColumns:'48px repeat(6,1fr)',background:'var(--bl)',borderBottom:'1px solid var(--bd)',position:'sticky',top:0,zIndex:2}}>
                    <div/>
                    {fechasSemana.map((f,i)=>{
                      const isHoy=f===hoy, d=new Date(f+'T12:00:00')
                      return (
                        <div key={f} onClick={()=>{setFecha(f);setVista('dia')}} style={{padding:'6px 4px',textAlign:'center',borderLeft:'1px solid var(--bd)',cursor:'pointer',background:isHoy?'var(--gl)':'transparent'}}>
                          <div style={{fontSize:8,color:'var(--grl)',fontWeight:300}}>{diasNombres[i]}</div>
                          <div style={{fontSize:13,fontWeight:isHoy?600:300,color:isHoy?'var(--g)':'var(--n)'}}>{d.getDate()}</div>
                        </div>
                      )
                    })}
                  </div>
                  {HORAS.map(h=>(
                    <div key={h}>
                      {h==='15:30'&&<div style={{padding:'3px 10px',background:'var(--bm)',borderBottom:'1px solid var(--bd)',fontSize:8,color:'var(--gr)'}}>— Pausa 12:30–15:30</div>}
                      <div style={{display:'grid',gridTemplateColumns:'48px repeat(6,1fr)',borderBottom:'1px solid var(--bl)',minHeight:44}}>
                        <div style={{fontSize:9,color:'var(--grl)',padding:'5px 3px',borderRight:'1px solid var(--bl)',display:'flex',alignItems:'flex-start',justifyContent:'flex-end',fontWeight:300}}>{h}</div>
                        {fechasSemana.map(f=>{
                          const citasDia = citas.filter(c=>c.fecha===f&&c.hora.startsWith(h))
                          const isHoy = f===hoy
                          return (
                            <div key={f} style={{borderLeft:'1px solid var(--bl)',padding:2,background:isHoy?'rgba(90,150,158,.03)':'transparent',minHeight:44}}>
                              {citasDia.length===0 ? (
                                <div onClick={()=>{setFecha(f);setNuevaCita(p=>({...p,hora:h}));setModal(true)}}
                                  style={{height:'100%',minHeight:40,display:'flex',alignItems:'center',justifyContent:'center',fontSize:8,color:'transparent',cursor:'pointer',borderRadius:3}}
                                  onMouseOver={e=>{const el=e.currentTarget;el.style.background='var(--gl)';el.style.color='var(--g)';el.textContent='+'}}
                                  onMouseOut={e=>{const el=e.currentTarget;el.style.background='';el.style.color='transparent';el.textContent='+'}}>+</div>
                              ) : (
                                <div style={{borderRadius:3,padding:'2px 3px',background:'var(--gl)',borderLeft:'2px solid var(--g)'}}>
                                  {citasDia.slice(0,3).map(c=>(
                                    <div key={c.id} onClick={()=>abrirPanel(c)} style={{fontSize:8,color:'var(--n)',fontWeight:300,padding:'1px 2px',cursor:'pointer',whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis'}}>
                                      {c.pacientes?.nombre}
                                    </div>
                                  ))}
                                  {citasDia.length>3&&<div style={{fontSize:8,color:'var(--g)'}}>+{citasDia.length-3} más</div>}
                                </div>
                              )}
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  ))}
                </>
              )
            })()}
          </div>
        )}

        {/* VISTA MES */}
        {vista==='mes' && (
          <div style={{border:'1px solid var(--bd)',borderRadius:'var(--rl)',overflow:'hidden',background:'var(--w)'}}>
            <div style={{display:'grid',gridTemplateColumns:'repeat(7,1fr)',background:'var(--bl)',borderBottom:'1px solid var(--bd)'}}>
              {['Lun','Mar','Mié','Jue','Vie','Sáb','Dom'].map(d=>(
                <div key={d} style={{fontSize:9,fontWeight:600,color:'var(--grl)',padding:'7px',textAlign:'center',letterSpacing:.3}}>{d}</div>
              ))}
            </div>
            <div style={{display:'grid',gridTemplateColumns:'repeat(7,1fr)'}}>
              {getDiasMes().map((f,i)=>{
                if (!f) return <div key={i} style={{minHeight:80,borderRight:'1px solid var(--bl)',borderBottom:'1px solid var(--bl)',background:'var(--bl)'}}/>
                const citasDia = citas.filter(c=>c.fecha===f)
                const isHoy = f===hoy, d=new Date(f+'T12:00:00')
                return (
                  <div key={f} onClick={()=>{setFecha(f);setVista('dia')}} style={{minHeight:80,padding:'4px 5px',borderRight:'1px solid var(--bl)',borderBottom:'1px solid var(--bl)',cursor:'pointer',background:isHoy?'var(--gl)':'var(--w)',transition:'background .1s'}}
                    onMouseOver={e=>{if(!isHoy)(e.currentTarget as HTMLElement).style.background='rgba(90,150,158,.05)'}}
                    onMouseOut={e=>{if(!isHoy)(e.currentTarget as HTMLElement).style.background='var(--w)'}}>
                    <div style={{fontSize:11,fontWeight:isHoy?600:300,color:isHoy?'var(--g)':'var(--n)',marginBottom:3}}>{d.getDate()}</div>
                    {citasDia.slice(0,3).map(c=>(
                      <div key={c.id} style={{fontSize:8,padding:'1px 4px',borderRadius:2,background:'var(--g)',color:'#fff',marginBottom:1,whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis'}}>
                        {c.hora?.slice(0,5)} {c.pacientes?.nombre}
                      </div>
                    ))}
                    {citasDia.length>3&&<div style={{fontSize:8,color:'var(--g)',fontWeight:500}}>+{citasDia.length-3} más</div>}
                  </div>
                )
              })}
            </div>
          </div>
        )}
        </>
      )}

      {/* PANEL FLOTANTE PACIENTE */}
      {panelPac && (
        <>
          <div onClick={()=>{if(!mostrarSesiones)setPanelPac(null); else setMostrarSesiones(false)}} style={{position:'fixed',inset:0,background:'rgba(38,40,37,.12)',zIndex:98}}/>
          <div style={{position:'fixed',top:0,right:0,width:320,height:'100vh',background:'var(--w)',borderLeft:'1px solid var(--bd)',zIndex:99,display:'flex',flexDirection:'column',boxShadow:'-4px 0 20px rgba(38,40,37,.08)'}}>
            
            {/* CABECERA */}
            <div style={{padding:'10px 13px',borderBottom:'1px solid var(--bd)',background:'var(--bl)',display:'flex',alignItems:'center',gap:8}}>
              <div style={{width:32,height:32,borderRadius:'50%',background:'var(--gl)',border:'1.5px solid var(--gm)',display:'flex',alignItems:'center',justifyContent:'center',fontSize:11,fontWeight:500,color:'var(--gd)',flexShrink:0}}>
                {(panelPac.pacientes?.nombre?.[0]||'?')+(panelPac.pacientes?.apellidos?.[0]||'')}
              </div>
              <div style={{flex:1}}>
                <div style={{fontSize:12,fontWeight:400,color:'var(--n)'}}>{panelPac.pacientes?.nombre} {panelPac.pacientes?.apellidos}</div>
                <div style={{fontSize:9,color:'var(--grl)',fontWeight:300}}>{panelPac.hora?.slice(0,5)} · Sala {panelPac.sala} · {panelPac.fecha}</div>
              </div>
              <button onClick={()=>setPanelPac(null)} style={{width:22,height:22,borderRadius:'50%',border:'1px solid var(--bd)',background:'var(--w)',cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',fontSize:11,color:'var(--gr)'}}>✕</button>
            </div>

            {/* TABS */}
            <div style={{display:'flex',borderBottom:'1px solid var(--bd)'}}>
              {[['sesion','📋 Sesión'],['datos','👤 Datos']].map(([k,l])=>(
                <button key={k} onClick={()=>setPanelTab(k as any)} style={{flex:1,fontSize:10,padding:'7px',textAlign:'center',cursor:'pointer',color:panelTab===k?'var(--g)':'var(--grl)',borderBottom:panelTab===k?'2px solid var(--g)':'2px solid transparent',marginBottom:-1,background:'none',border:'none',borderBottom:panelTab===k?'2px solid var(--g)':'2px solid transparent',fontFamily:'system-ui',fontWeight:panelTab===k?500:300}}>{l}</button>
              ))}
            </div>

            {/* CONTENIDO */}
            <div style={{flex:1,overflowY:'auto'}}>
              
              {/* TAB SESIÓN */}
              {panelTab==='sesion' && (
                <div style={{padding:11}}>
                  {loadingSesion ? (
                    <div className="loading">Cargando sesión...</div>
                  ) : sesionDetalle ? (
                    <>
                      <div style={{display:'flex',alignItems:'center',gap:7,marginBottom:10}}>
                        <div style={{flex:1}}>
                          <div style={{fontSize:12,fontWeight:400,color:'var(--n)'}}>{sesionDetalle.nombre}</div>
                          {sesionDetalle.descripcion&&<div style={{fontSize:9,color:'var(--grl)',fontWeight:300,marginTop:1}}>{sesionDetalle.descripcion}</div>}
                        </div>
                        <button className="btn btn-t btn-sm" onClick={()=>setMostrarSesiones(s=>!s)}>{mostrarSesiones?'▲ Ocultar':'Cambiar'}</button>
                      </div>

                      {/* PARTES Y EJERCICIOS */}
                      {(sesionDetalle.partes||[]).map((parte:any,pi:number)=>(
                        <div key={pi} style={{marginBottom:10}}>
                          <div style={{fontSize:9,fontWeight:600,color:'var(--g)',letterSpacing:.5,textTransform:'uppercase',marginBottom:6,paddingBottom:4,borderBottom:'1px solid var(--bm)'}}>{parte.nombre}</div>
                          {(parte.ejercicios||[]).map((ej:any,ei:number)=>(
                            <div key={ei} style={{marginBottom:8,background:'var(--bl)',borderRadius:7,border:'1px solid var(--bd)',overflow:'hidden'}}>
                              {/* EJERCICIO CABECERA */}
                              <div style={{display:'flex',alignItems:'center',gap:7,padding:'7px 9px'}}>
                                {ej.imagen_url ? (
                                  <img src={ej.imagen_url} alt={ej.nombre} style={{width:40,height:40,objectFit:'cover',borderRadius:5,flexShrink:0}}/>
                                ) : (
                                  <div style={{width:40,height:40,background:'var(--bm)',borderRadius:5,display:'flex',alignItems:'center',justifyContent:'center',fontSize:18,flexShrink:0}}>💪</div>
                                )}
                                <div style={{flex:1,minWidth:0}}>
                                  <div style={{fontSize:11,fontWeight:400,color:'var(--n)',marginBottom:2}}>{ej.nombre}</div>
                                  <div style={{display:'flex',gap:3,flexWrap:'wrap'}}>
                                    {ej.variante&&<span style={{fontSize:8,padding:'1px 5px',borderRadius:99,background:'var(--gl)',color:'var(--gd)'}}>{ej.variante}</span>}
                                    {ej.capacidad&&<span style={{fontSize:8,padding:'1px 5px',borderRadius:99,background:'var(--ambl)',color:'#7A5800'}}>{ej.capacidad}</span>}
                                  </div>
                                </div>
                                {ej.video_url&&<a href={ej.video_url} target="_blank" rel="noopener noreferrer" style={{fontSize:14,flexShrink:0}} title="Ver vídeo">🎥</a>}
                              </div>

                              {/* PARÁMETROS EDITABLES */}
                              <div style={{padding:'5px 9px 7px',borderTop:'1px solid var(--bm)'}}>
                                <div style={{display:'flex',gap:5,alignItems:'center',marginBottom:6}}>
                                  <span style={{fontSize:9,color:'var(--grl)',width:42,flexShrink:0}}>Series</span>
                                  <div style={{fontSize:11,fontWeight:400,color:'var(--n)',padding:'2px 7px',background:'var(--w)',borderRadius:4,border:'1px solid var(--bd)',minWidth:32,textAlign:'center'}}>{ej.series||'—'}</div>
                                  <span style={{fontSize:9,color:'var(--grl)',marginLeft:4,width:32,flexShrink:0}}>Reps</span>
                                  <div style={{fontSize:11,fontWeight:400,color:'var(--n)',padding:'2px 7px',background:'var(--w)',borderRadius:4,border:'1px solid var(--bd)',minWidth:32,textAlign:'center'}}>{ej.reps||'—'}</div>
                                  <span style={{fontSize:9,color:'var(--grl)',marginLeft:4,width:24,flexShrink:0}}>Kg</span>
                                  <input type="number" value={pesos[ej.ejercicio_id]||ej.peso||''} onChange={e=>setPesos(p=>({...p,[ej.ejercicio_id]:e.target.value}))}
                                    onBlur={()=>guardarAnotacion(ej.ejercicio_id)}
                                    style={{width:48,fontSize:11,padding:'2px 5px',border:'1px solid var(--g)',borderRadius:4,background:'var(--gl)',color:'var(--gd)',textAlign:'center',fontFamily:'system-ui'}}
                                    placeholder={ej.peso||'0'}/>
                                </div>
                                {ej.tiempo&&<div style={{fontSize:9,color:'var(--grl)',marginBottom:5}}>⏱ {ej.tiempo} seg</div>}
                                <textarea value={anotaciones[ej.ejercicio_id]||''} onChange={e=>setAnotaciones(p=>({...p,[ej.ejercicio_id]:e.target.value}))}
                                  onBlur={()=>guardarAnotacion(ej.ejercicio_id)}
                                  style={{width:'100%',fontSize:10,padding:'5px 7px',border:'1px solid var(--bd)',borderRadius:4,background:'var(--w)',color:'var(--n)',resize:'none',height:44,fontFamily:'system-ui',lineHeight:1.4}}
                                  placeholder="📝 Anotación sobre este ejercicio..."/>
                                {guardandoAnot===ej.ejercicio_id&&<div style={{fontSize:8,color:'var(--g)',marginTop:2}}>Guardando...</div>}
                              </div>
                            </div>
                          ))}
                        </div>
                      ))}
                    </>
                  ) : (
                    <div style={{textAlign:'center',padding:'20px 10px'}}>
                      <div style={{fontSize:24,marginBottom:8}}>📋</div>
                      <div style={{fontSize:11,color:'var(--grl)',marginBottom:12,fontWeight:300}}>Sin sesión asignada para esta cita</div>
                      <button className="btn btn-p btn-sm" style={{width:'100%',justifyContent:'center'}} onClick={()=>setMostrarSesiones(true)}>
                        + Asignar sesión
                      </button>
                    </div>
                  )}
                </div>
              )}

              {/* TAB DATOS */}
              {panelTab==='datos' && (
                <div style={{padding:11}}>
                  {panelPac.pacientes?.telefono&&<div style={{fontSize:11,color:'var(--n)',fontWeight:300,marginBottom:6}}>📞 {panelPac.pacientes.telefono}</div>}
                  {panelPac.pacientes?.email&&<div style={{fontSize:11,color:'var(--n)',fontWeight:300,marginBottom:6}}>✉️ {panelPac.pacientes.email}</div>}
                  <div style={{fontSize:11,color:'var(--n)',fontWeight:300,marginBottom:10}}>🏷 {panelPac.pacientes?.tipo_clase||'—'}</div>
                  
                  <div style={{fontSize:9,fontWeight:600,color:'var(--grl)',letterSpacing:.5,textTransform:'uppercase',marginBottom:7}}>Estado de la cita</div>
                  <div style={{display:'flex',gap:5,flexWrap:'wrap',marginBottom:12}}>
                    {[['programada','Programada'],['realizada','✓ Realizada'],['falta','Falta'],['cancelada','Cancelar']].map(([est,lbl])=>(
                      <button key={est} onClick={()=>{cambiarEstado(panelPac.id,est);setPanelPac(null)}}
                        style={{fontSize:10,padding:'5px 10px',borderRadius:'var(--r)',border:`1px solid ${est==='realizada'?'var(--g)':est==='cancelada'||est==='falta'?'var(--red)':'var(--bd)'}`,background:panelPac.estado===est?(est==='realizada'?'var(--g)':est==='cancelada'||est==='falta'?'var(--red)':'var(--g)'):'var(--w)',color:panelPac.estado===est?'#fff':(est==='realizada'?'var(--g)':est==='cancelada'||est==='falta'?'var(--red)':'var(--n)'),cursor:'pointer',fontFamily:'system-ui'}}>
                        {lbl}
                      </button>
                    ))}
                  </div>
                  {panelPac.notas&&<div style={{padding:'7px 9px',background:'var(--ambl)',borderRadius:5,border:'1px solid var(--amb)',fontSize:10,color:'#7A5800'}}>{panelPac.notas}</div>}
                </div>
              )}
            </div>

            {/* PIE */}
            <div style={{padding:'9px 11px',borderTop:'1px solid var(--bd)',display:'flex',gap:6}}>
              <a href={`/pacientes/${panelPac.paciente_id}`} className="btn btn-p" style={{flex:1,justifyContent:'center',textDecoration:'none',fontSize:10}}>Ver ficha ↗</a>
              <button className="btn btn-s" onClick={()=>setPanelPac(null)} style={{fontSize:10}}>Cerrar</button>
            </div>
          </div>
        </>
      )}

      {/* Selector de sesion integrado en el panel lateral */}

      {/* MODAL NUEVA CITA */}
      {modal && (
        <div className="modal-bg" onClick={e=>{if(e.target===e.currentTarget&&!guardando)setModal(false)}}>
          <div className="modal" style={{width:460}}>
            <div className="modal-title">
              Nueva cita
              <button className="modal-close" onClick={()=>{if(!guardando)setModal(false)}}>✕</button>
            </div>
            <div style={{fontSize:10,color:'var(--grl)',marginBottom:12,fontWeight:300}}>{fechaDisplay}</div>
            <div className="field">
              <label>Paciente *</label>
              <select className="input" value={nuevaCita.paciente_id} onChange={e=>setNuevaCita(p=>({...p,paciente_id:e.target.value}))} disabled={guardando}>
                <option value="">Seleccionar paciente...</option>
                {pacientes.map(p=>(<option key={p.id} value={p.id}>{p.nombre} {p.apellidos}</option>))}
              </select>
            </div>
            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:8}}>
              <div className="field"><label>Hora</label>
                <select className="input" value={nuevaCita.hora} onChange={e=>setNuevaCita(p=>({...p,hora:e.target.value}))} disabled={guardando}>
                  {HORAS.map(h=><option key={h} value={h}>{h}</option>)}
                </select>
              </div>
              <div className="field"><label>Sala</label>
                <select className="input" value={nuevaCita.sala} onChange={e=>setNuevaCita(p=>({...p,sala:e.target.value}))} disabled={guardando}>
                  <option value="A">Sala A</option>
                  <option value="B">Sala B</option>
                </select>
              </div>
            </div>
            <div className="field"><label>Tipo</label>
              <select className="input" value={nuevaCita.tipo} onChange={e=>setNuevaCita(p=>({...p,tipo:e.target.value}))} disabled={guardando}>
                <option value="clase">Clase grupal</option>
                <option value="individual">Individual / Pareja</option>
                <option value="valoracion">Valoración inicial (60 min)</option>
                <option value="revaloracion">Revaloración (60 min)</option>
              </select>
            </div>
            <div style={{background:'var(--bl)',border:'1px solid var(--bd)',borderRadius:'var(--rl)',padding:'10px 12px',marginBottom:10}}>
              <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:nuevaCita.repetir?10:0}}>
                <div>
                  <div style={{fontSize:11,fontWeight:400,color:'var(--n)'}}>¿Repetir esta cita?</div>
                  <div style={{fontSize:9,color:'var(--grl)',fontWeight:300}}>Crear citas recurrentes automáticamente</div>
                </div>
                <button className="toggle" style={{background:nuevaCita.repetir?'var(--g)':'var(--bm)'}} onClick={()=>setNuevaCita(p=>({...p,repetir:!p.repetir}))}/>
              </div>
              {nuevaCita.repetir && (
                <>
                  <div className="field">
                    <label>Días de la semana</label>
                    <div style={{display:'flex',gap:4,flexWrap:'wrap',marginTop:4}}>
                      {DIAS_SEMANA.map(d=>(
                        <button key={d} onClick={()=>toggleDia(d)}
                          style={{fontSize:10,padding:'4px 9px',borderRadius:99,border:`1px solid ${nuevaCita.dias_repetir.includes(d)?'var(--g)':'var(--bd)'}`,background:nuevaCita.dias_repetir.includes(d)?'var(--g)':'var(--w)',color:nuevaCita.dias_repetir.includes(d)?'#fff':'var(--gr)',cursor:'pointer',fontFamily:'system-ui'}}>
                          {d}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="field"><label>Hasta cuándo</label>
                    <select className="input" value={nuevaCita.periodo} onChange={e=>setNuevaCita(p=>({...p,periodo:e.target.value,fecha_fin:''}))} disabled={guardando}>
                      <option value="1mes">1 mes</option>
                      <option value="3meses">3 meses</option>
                      <option value="6meses">6 meses</option>
                      <option value="1anio">1 año</option>
                      <option value="personalizado">Fecha personalizada</option>
                    </select>
                  </div>
                  {nuevaCita.periodo==='personalizado' && (
                    <div className="field"><label>Fecha fin</label>
                      <input type="date" className="input" value={nuevaCita.fecha_fin} onChange={e=>setNuevaCita(p=>({...p,fecha_fin:e.target.value}))} min={fecha} disabled={guardando}/>
                    </div>
                  )}
                  <div style={{background:'var(--gl)',borderRadius:5,padding:'6px 9px',fontSize:9,color:'var(--gd)'}}>✓ Se crearán todas las citas automáticamente</div>
                </>
              )}
            </div>
            <div className="field"><label>Notas (opcional)</label>
              <input className="input" value={nuevaCita.notas} onChange={e=>setNuevaCita(p=>({...p,notas:e.target.value}))} placeholder="ej. Molestia lumbar, precaución..." disabled={guardando}/>
            </div>
            <div style={{display:'flex',gap:8,marginTop:8}}>
              <button className="btn btn-d btn-sm" onClick={()=>{if(!guardando)setModal(false)}} disabled={guardando}>Cancelar</button>
              <div style={{flex:1}}/>
              <button className="btn btn-p" onClick={crearCita} disabled={guardando} style={{opacity:guardando?0.7:1}}>
                {guardando?'⏳ Creando...':'✓ Crear cita'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
