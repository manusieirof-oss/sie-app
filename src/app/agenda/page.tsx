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
  const [mostrarSesiones, setMostrarSesiones] = useState(false)
  const [anotaciones, setAnotaciones] = useState<Record<string,string>>({})
  const [pesos, setPesos] = useState<Record<string,string>>({})
  const [guardandoAnot, setGuardandoAnot] = useState<string|null>(null)
  const [editandoCita, setEditandoCita] = useState<any>(null)
  const [notasDia, setNotasDia] = useState<any[]>([])
  const [buscarPac, setBuscarPac] = useState('')
  const [resultadosBusqueda, setResultadosBusqueda] = useState<any[]>([])
  const [buscando, setBuscando] = useState(false)
  const [modalNota, setModalNota] = useState(false)
  const [nuevaNota, setNuevaNota] = useState('')
  const [nuevaCita, setNuevaCita] = useState({
    paciente_id:'', hora:'08:30', sala:'A', tipo:'clase', notas:'',
    repetir:false, dias_repetir:[] as string[], fecha_fin:'', periodo:'3meses', sesion_id:'',
    es_recuperacion:false, recuperacion_id:''
  })
  const [recuperacionesPaciente, setRecuperacionesPaciente] = useState<any[]>([])

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
      const d=new Date(fecha+'T12:00:00'), day=d.getDay()
      const diff=day===0?-6:1-day
      const lunes=new Date(d); lunes.setDate(d.getDate()+diff)
      const sabado=new Date(lunes); sabado.setDate(lunes.getDate()+5)
      fechaInicio=lunes.toISOString().split('T')[0]; fechaFin=sabado.toISOString().split('T')[0]
    } else if (vista==='mes') {
      fechaInicio=fecha.slice(0,7)+'-01'
      const ult=new Date(parseInt(fecha.slice(0,4)),parseInt(fecha.slice(5,7)),0).getDate()
      fechaFin=fecha.slice(0,7)+'-'+String(ult).padStart(2,'0')
    }
    const { data: nd } = await supabase.from('notas_dia').select('*').eq('fecha', fecha).order('created_at')
    setNotasDia(nd||[])
    const { data: c } = await supabase.from('citas').select('*, pacientes(id,nombre,apellidos,telefono,email,tipo_clase), sesiones:sesion_id(id,nombre,partes,descripcion)').gte('fecha',fechaInicio).lte('fecha',fechaFin).neq('estado','cancelada').order('fecha').order('hora')
    setCitas(c||[])
    setLoading(false)
  }

  function getCitasSlot(h:string,sala:string,f?:string) {
    return citas.filter(c=>c.hora.startsWith(h)&&c.sala===sala&&c.fecha===(f||fecha))
  }

  function getFechasSemana() {
    const d=new Date(fecha+'T12:00:00'),day=d.getDay(),diff=day===0?-6:1-day
    const lunes=new Date(d); lunes.setDate(d.getDate()+diff)
    return Array.from({length:6},(_,i)=>{const fd=new Date(lunes);fd.setDate(lunes.getDate()+i);return fd.toISOString().split('T')[0]})
  }

  function getDiasMes() {
    const anio=parseInt(fecha.slice(0,4)),mes=parseInt(fecha.slice(5,7))
    const primero=new Date(anio,mes-1,1),ultimo=new Date(anio,mes,0)
    const dias:(string|null)[]=[]
    let ds=primero.getDay()===0?7:primero.getDay()
    for(let i=1;i<ds;i++) dias.push(null)
    for(let i=1;i<=ultimo.getDate();i++) dias.push(`${anio}-${String(mes).padStart(2,'0')}-${String(i).padStart(2,'0')}`)
    return dias
  }

  async function abrirPanel(c:any) {
    // Cargar bono del paciente
    const { data: bonoData } = await supabase.from('bonos').select('*').eq('paciente_id',c.paciente_id).eq('activo',true).maybeSingle()
    setPanelPac({...c, bono_info: bonoData||null})
    setPanelTab('sesion'); setSesionDetalle(null)
    setAnotaciones({}); setPesos({}); setMostrarSesiones(false); setLoadingSesion(true)
    if (c.sesiones) {
      setSesionDetalle(c.sesiones)
      const { data: anots } = await supabase.from('anotaciones_ejercicios').select('*').eq('paciente_id',c.paciente_id).eq('cita_id',c.id)
      if (anots) {
        const am:Record<string,string>={}, pm:Record<string,string>={}
        anots.forEach((a:any)=>{am[a.ejercicio_id]=a.anotacion||'';pm[a.ejercicio_id]=a.peso_real?.toString()||''})
        setAnotaciones(am); setPesos(pm)
      }
    }
    const { data: sp } = await supabase.from('sesiones').select('id,nombre,descripcion,partes').eq('paciente_id',c.paciente_id).order('created_at',{ascending:false})
    setSesionesPaciente(sp||[])
    setLoadingSesion(false)
  }

  async function buscarPaciente(q: string) {
    setBuscarPac(q)
    if (!q.trim()) { setResultadosBusqueda([]); return }
    setBuscando(true)
    const { data } = await supabase.from('citas').select('*, pacientes(id,nombre,apellidos)').eq('paciente_id', (await supabase.from('pacientes').select('id').ilike('nombre', `%${q}%`).limit(1).maybeSingle()).data?.id||'00000000-0000-0000-0000-000000000000').gte('fecha', new Date().toISOString().split('T')[0]).order('fecha').limit(10)
    setResultadosBusqueda(data||[])
    setBuscando(false)
  }

  async function buscarPacienteDirecto(q: string) {
    setBuscarPac(q)
    if (!q.trim()) { setResultadosBusqueda([]); return }
    const matchingPacs = pacientes.filter(p => `${p.nombre} ${p.apellidos}`.toLowerCase().includes(q.toLowerCase()))
    if (matchingPacs.length === 0) { setResultadosBusqueda([]); return }
    const ids = matchingPacs.map(p => p.id)
    const { data } = await supabase.from('citas').select('*, pacientes(id,nombre,apellidos)').in('paciente_id', ids).gte('fecha', new Date().toISOString().split('T')[0]).neq('estado','cancelada').order('fecha').limit(15)
    setResultadosBusqueda(data||[])
  }

  async function crearNotaDia() {
    if (!nuevaNota.trim()) return
    await supabase.from('notas_dia').insert({ fecha, texto: nuevaNota.trim() })
    setNuevaNota('')
    setModalNota(false)
    cargar()
  }

  async function toggleNotaResuelta(id: string, resuelta: boolean) {
    await supabase.from('notas_dia').update({ resuelta: !resuelta }).eq('id', id)
    cargar()
  }

  async function eliminarNota(id: string) {
    await supabase.from('notas_dia').delete().eq('id', id)
    cargar()
  }

  async function asignarSesion(sesionId:string) {
    await supabase.from('citas').update({sesion_id:sesionId}).eq('id',panelPac.id)
    setMostrarSesiones(false)
    const sesion = sesionesPaciente.find(s=>s.id===sesionId)
    setSesionDetalle(sesion||null)
    cargar()
  }

  async function guardarAnotacion(ejercicioId:string) {
    if (!panelPac) return
    setGuardandoAnot(ejercicioId)
    const { data: ex } = await supabase.from('anotaciones_ejercicios').select('id').eq('paciente_id',panelPac.paciente_id).eq('ejercicio_id',ejercicioId).eq('cita_id',panelPac.id).maybeSingle()
    const datos = {paciente_id:panelPac.paciente_id,ejercicio_id:ejercicioId,cita_id:panelPac.id,anotacion:anotaciones[ejercicioId]||'',peso_real:pesos[ejercicioId]?parseFloat(pesos[ejercicioId]):null,fecha}
    if (ex) await supabase.from('anotaciones_ejercicios').update(datos).eq('id',ex.id)
    else await supabase.from('anotaciones_ejercicios').insert(datos)
    setGuardandoAnot(null)
  }

  async function guardarEdicionCita() {
    if (!editandoCita) return
    setGuardando(true)
    await supabase.from('citas').update({
      hora: editandoCita.hora,
      sala: editandoCita.sala,
      tipo: editandoCita.tipo,
      notas: editandoCita.notas,
    }).eq('id', editandoCita.id)
    setEditandoCita(null)
    setGuardando(false)
    cargar()
  }

  async function crearCita() {
    if (guardando) return
    if (!nuevaCita.paciente_id) { alert('Selecciona un paciente'); return }
    setGuardando(true)
    if (!nuevaCita.repetir) {
      const { data: citaCreada } = await supabase.from('citas').insert({paciente_id:nuevaCita.paciente_id,hora:nuevaCita.hora+':00',sala:nuevaCita.sala,tipo:nuevaCita.tipo,notas:nuevaCita.notas,fecha,duracion_min:nuevaCita.tipo==='valoracion'?60:50,estado:'programada',sesion_id:nuevaCita.sesion_id||null,cita_recuperacion_de:nuevaCita.recuperacion_id||null}).select().single()
      if (nuevaCita.es_recuperacion && nuevaCita.recuperacion_id && citaCreada) {
        await supabase.from('recuperaciones').update({estado:'recuperada',cita_recuperacion_id:citaCreada.id}).eq('id',nuevaCita.recuperacion_id)
      }
    } else {
      if (nuevaCita.dias_repetir.length===0) { alert('Selecciona al menos un día'); setGuardando(false); return }
      let fechaFin=nuevaCita.fecha_fin
      if (!fechaFin) {
        const fd=new Date(fecha+'T12:00:00')
        if (nuevaCita.periodo==='1mes') fd.setMonth(fd.getMonth()+1)
        else if (nuevaCita.periodo==='3meses') fd.setMonth(fd.getMonth()+3)
        else if (nuevaCita.periodo==='6meses') fd.setMonth(fd.getMonth()+6)
        else if (nuevaCita.periodo==='1anio') fd.setFullYear(fd.getFullYear()+1)
        fechaFin=fd.toISOString().split('T')[0]
      }
      const diasMap:Record<string,number>={Lun:1,Mar:2,Mié:3,Jue:4,Vie:5,Sáb:6}
      const citasACrear:any[]=[]
      const fa=new Date(fecha+'T12:00:00'),ff=new Date(fechaFin+'T12:00:00')
      while(fa<=ff) {
        const ds=fa.getDay()===0?7:fa.getDay()
        const dStr=Object.entries(diasMap).find(([,v])=>v===ds)?.[0]
        if (dStr&&nuevaCita.dias_repetir.includes(dStr)) citasACrear.push({paciente_id:nuevaCita.paciente_id,hora:nuevaCita.hora+':00',sala:nuevaCita.sala,tipo:nuevaCita.tipo,notas:nuevaCita.notas,fecha:fa.toISOString().split('T')[0],duracion_min:nuevaCita.tipo==='valoracion'?60:50,estado:'programada'})
        fa.setDate(fa.getDate()+1)
      }
      if (citasACrear.length>0) {
        for (let i=0;i<citasACrear.length;i+=50) await supabase.from('citas').insert(citasACrear.slice(i,i+50))
        alert(`✓ ${citasACrear.length} citas creadas`)
      }
    }
    setModal(false)
    setNuevaCita({paciente_id:'',hora:'08:30',sala:'A',tipo:'clase',notas:'',repetir:false,dias_repetir:[],fecha_fin:'',periodo:'3meses',sesion_id:''})
    setGuardando(false); cargar()
  }

  async function cambiarEstado(id:string,estado:string) {
    await supabase.from('citas').update({estado}).eq('id',id)
    // Si se cancela una cita de recuperación, liberar la recuperación asociada
    if (estado==='cancelada') {
      await supabase.from('recuperaciones').update({estado:'pendiente',cita_recuperacion_id:null}).eq('cita_recuperacion_id',id)
    }
    
    // Si marca falta → crear registro de recuperación
    if (estado==='falta' && panelPac) {
      const fechaFalta = new Date(panelPac.fecha+'T12:00:00')
      const fechaLimite = new Date(fechaFalta)
      fechaLimite.setDate(fechaLimite.getDate()+30)
      // Verificar que no existe ya una recuperación para esta cita
      const { data: existing } = await supabase.from('recuperaciones').select('id').eq('cita_falta_id',id).maybeSingle()
      if (!existing) {
        await supabase.from('recuperaciones').insert({
          paciente_id: panelPac.paciente_id,
          cita_falta_id: id,
          fecha_falta: panelPac.fecha,
          fecha_limite: fechaLimite.toISOString().split('T')[0],
          estado: 'pendiente'
        })
      }
    }
    
    // Si deshace falta → eliminar recuperación pendiente
    if (estado==='realizada' && panelPac) {
      await supabase.from('recuperaciones').delete().eq('cita_falta_id',id).eq('estado','pendiente')
    }
    
    // Actualizar panel sin cerrarlo
    setPanelPac((prev:any)=>prev?{...prev,estado}:null)
    cargar()
  }

  const prevPeriodo=()=>{const d=new Date(fecha+'T12:00:00');if(vista==='dia')d.setDate(d.getDate()-1);else if(vista==='semana')d.setDate(d.getDate()-7);else d.setMonth(d.getMonth()-1);setFecha(d.toISOString().split('T')[0])}
  const nextPeriodo=()=>{const d=new Date(fecha+'T12:00:00');if(vista==='dia')d.setDate(d.getDate()+1);else if(vista==='semana')d.setDate(d.getDate()+7);else d.setMonth(d.getMonth()+1);setFecha(d.toISOString().split('T')[0])}
  const toggleDia=(dia:string)=>setNuevaCita(p=>({...p,dias_repetir:p.dias_repetir.includes(dia)?p.dias_repetir.filter(d=>d!==dia):[...p.dias_repetir,dia]}))

  const totalPersonas=citas.filter(c=>c.fecha===fecha).length
  const clases=citas.filter(c=>c.fecha===fecha&&c.tipo==='clase').length

  async function cargarRecuperaciones(pacienteId: string) {
    if (!pacienteId) { setRecuperacionesPaciente([]); return }
    const { data } = await supabase.from('recuperaciones').select('*').eq('paciente_id', pacienteId).eq('estado','pendiente').order('fecha_limite')
    setRecuperacionesPaciente(data||[])
  }

  function SesionSelector({ pacienteId, sesionId, onChange }: { pacienteId: string, sesionId: string, onChange: (id: string) => void }) {
    const [sesiones, setSesiones] = useState<any[]>([])
    useEffect(() => {
      if (!pacienteId) return
      supabase.from('sesiones').select('id,nombre,descripcion,partes').eq('paciente_id', pacienteId).order('created_at', {ascending:false}).then(({data}) => setSesiones(data||[]))
    }, [pacienteId])
    if (sesiones.length === 0) return <div style={{fontSize:10,color:'var(--grl)',padding:'6px 0'}}>Este paciente no tiene sesiones creadas aún</div>
    return (
      <div>
        <select className="input" value={sesionId} onChange={e=>onChange(e.target.value)}>
          <option value="">— Sin sesión asignada —</option>
          {sesiones.map(s=>(
            <option key={s.id} value={s.id}>{s.nombre} · {(s.partes||[]).reduce((acc:number,p:any)=>acc+(p.ejercicios||[]).length,0)} ejercicios</option>
          ))}
        </select>
      </div>
    )
  }

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
        {fecha!==hoy&&<button className="btn btn-t btn-sm" onClick={()=>setFecha(hoy)}>Hoy</button>}
        <button className="btn btn-s btn-sm" onClick={nextPeriodo}>›</button>
        <div style={{position:'relative'}}>
          <input className="input" placeholder="🔍 Buscar paciente..." value={buscarPac} onChange={e=>buscarPacienteDirecto(e.target.value)} style={{width:180,fontSize:11}}/>
          {buscarPac && resultadosBusqueda.length>0 && (
            <div style={{position:'absolute',top:'100%',left:0,right:0,background:'var(--w)',border:'1px solid var(--bd)',borderRadius:'var(--rl)',boxShadow:'0 4px 12px rgba(0,0,0,.1)',zIndex:50,maxHeight:280,overflowY:'auto',marginTop:3}}>
              {resultadosBusqueda.map(c=>(
                <div key={c.id} onClick={()=>{setFecha(c.fecha);setBuscarPac('');setResultadosBusqueda([]);setVista('dia')}}
                  style={{padding:'8px 11px',cursor:'pointer',borderBottom:'1px solid var(--bl)',transition:'background .1s'}}
                  onMouseOver={e=>(e.currentTarget as HTMLElement).style.background='var(--gl)'}
                  onMouseOut={e=>(e.currentTarget as HTMLElement).style.background=''}>
                  <div style={{fontSize:11,fontWeight:400,color:'var(--n)'}}>{c.pacientes?.nombre} {c.pacientes?.apellidos}</div>
                  <div style={{fontSize:9,color:'var(--grl)',marginTop:1}}>
                    {new Date(c.fecha+'T12:00:00').toLocaleDateString('es-ES',{weekday:'short',day:'numeric',month:'short'})} · {c.hora?.slice(0,5)} · Sala {c.sala}
                  </div>
                </div>
              ))}
            </div>
          )}
          {buscarPac && resultadosBusqueda.length===0 && buscarPac.length>1 && (
            <div style={{position:'absolute',top:'100%',left:0,right:0,background:'var(--w)',border:'1px solid var(--bd)',borderRadius:'var(--rl)',padding:'10px',fontSize:10,color:'var(--grl)',zIndex:50,marginTop:3}}>Sin citas futuras para ese paciente</div>
          )}
        </div>
        <button className="btn btn-p btn-sm" onClick={()=>setModal(true)}>+ Nueva cita</button>
      </div>

      {loading?<div className="loading">Cargando agenda...</div>:(
        <>
        {/* VISTA DÍA */}
        {vista==='dia'&&(
          <div style={{display:'grid',gridTemplateColumns:'1fr 190px',border:'1px solid var(--bd)',borderRadius:'var(--rl)',overflow:'hidden',background:'var(--w)',height:'calc(100vh - 150px)'}}>
            <div style={{overflowY:'auto'}}>
              <div style={{display:'grid',gridTemplateColumns:'48px 1fr 1fr',background:'var(--bl)',borderBottom:'1px solid var(--bd)',position:'sticky',top:0,zIndex:2}}>
                <div/>
                {['Sala A','Sala B'].map(s=><div key={s} style={{fontSize:9,fontWeight:600,color:'var(--g)',padding:'7px 10px',textAlign:'center',letterSpacing:.5,borderLeft:'1px solid var(--bd)'}}>{s}</div>)}
              </div>
              {HORAS.map(h=>(
                <div key={h}>
                  {h==='15:30'&&<div style={{padding:'4px 10px',background:'var(--bm)',borderBottom:'1px solid var(--bd)',fontSize:8,color:'var(--gr)'}}>— Pausa · 12:30–15:30</div>}
                  <div style={{display:'grid',gridTemplateColumns:'48px 1fr 1fr',borderBottom:'1px solid var(--bl)'}}>
                    <div style={{fontSize:9,color:'var(--grl)',padding:'6px 3px',borderRight:'1px solid var(--bl)',display:'flex',alignItems:'flex-start',justifyContent:'flex-end',fontWeight:300}}>{h}</div>
                    {(['A','B'] as const).map(sala=>{
                      const sc=getCitasSlot(h,sala),tipo=sc[0]?.tipo
                      return (
                        <div key={sala} style={{borderLeft:'1px solid var(--bl)',padding:3,minHeight:52}}>
                          {sc.length===0?(
                            <div onClick={()=>{setNuevaCita(p=>({...p,hora:h,sala}));setModal(true)}}
                              style={{border:'1.5px dashed var(--bm)',borderRadius:4,minHeight:44,display:'flex',alignItems:'center',justifyContent:'center',fontSize:9,color:'var(--grl)',cursor:'pointer',transition:'all .12s'}}
                              onMouseOver={e=>{const el=e.currentTarget;el.style.borderColor='var(--g)';el.style.color='var(--g)';el.style.background='var(--gl)'}}
                              onMouseOut={e=>{const el=e.currentTarget;el.style.borderColor='var(--bm)';el.style.color='var(--grl)';el.style.background=''}}>
                              + libre
                            </div>
                          ):(
                            <div style={{borderRadius:4,padding:'3px 5px',background:tipo==='valoracion'||tipo==='revaloracion'?'var(--ambl)':'var(--gl)',borderLeft:`2px solid ${tipo==='valoracion'||tipo==='revaloracion'?'var(--amb)':'var(--g)'}`}}>
                              <div style={{fontSize:7,color:'var(--gr)',marginBottom:2,display:'flex',justifyContent:'space-between'}}>
                                <span>{tipo==='valoracion'?'Valoración':tipo==='individual'?'Individual':tipo==='revaloracion'?'Revaloración':'Clase'}</span>
                                <span>{sc.length}/6</span>
                              </div>
                              {sc.length<6 && sc.length>0 && (
                                <div onClick={(e)=>{e.stopPropagation();setNuevaCita(p=>({...p,hora:h,sala}));setModal(true)}}
                                  style={{display:'flex',alignItems:'center',justifyContent:'center',width:18,height:18,borderRadius:'50%',background:'var(--g)',color:'#fff',fontSize:12,cursor:'pointer',marginLeft:'auto',marginBottom:3,flexShrink:0}}
                                  title="Añadir paciente a este grupo">+</div>
                              )}
                              {sc.map(c=>(
                                <div key={c.id} onClick={()=>abrirPanel(c)}
                                  style={{display:'flex',alignItems:'center',gap:3,padding:'2px 4px',borderRadius:3,cursor:'pointer',marginBottom:1,minHeight:28}}
                                  onMouseOver={e=>(e.currentTarget as HTMLElement).style.background='rgba(90,150,158,.15)'}
                                  onMouseOut={e=>(e.currentTarget as HTMLElement).style.background=''}>
                                  <div style={{width:14,height:14,borderRadius:'50%',background:'var(--g)',color:'#fff',fontSize:7,fontWeight:600,display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0}}>{c.pacientes?.nombre?.[0]||'?'}</div>
                                  <span style={{fontSize:10,color:'var(--n)',flex:1,fontWeight:300,whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis'}}>{c.pacientes?.nombre} {c.pacientes?.apellidos}</span>
                                  {c.sesiones&&<span style={{fontSize:8,color:'var(--g)'}}>📋</span>}
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
                {/* NOTAS DE PACIENTES */}
                {citas.filter(c=>c.notas&&c.fecha===fecha).length>0&&(
                  <>
                    <div style={{fontSize:8,fontWeight:600,color:'var(--grl)',letterSpacing:.5,textTransform:'uppercase',marginBottom:5}}>Alertas pacientes</div>
                    {citas.filter(c=>c.notas&&c.fecha===fecha).map(c=>(
                      <div key={c.id} style={{borderRadius:5,padding:'5px 8px',borderLeft:'2px solid var(--g)',background:'var(--gl)',marginBottom:4}}>
                        <div style={{fontSize:8,color:'var(--gd)',marginBottom:1}}>{c.pacientes?.nombre}</div>
                        <div style={{fontSize:10,color:'var(--n)',fontWeight:300,lineHeight:1.4}}>{c.notas}</div>
                      </div>
                    ))}
                  </>
                )}
                {/* NOTAS DEL DÍA */}
                <div style={{fontSize:8,fontWeight:600,color:'var(--grl)',letterSpacing:.5,textTransform:'uppercase',marginBottom:5,marginTop:8}}>Notas del día</div>
                {notasDia.length===0&&<div style={{fontSize:9,color:'var(--grl)',fontWeight:300}}>Sin notas para hoy</div>}
                {notasDia.map(n=>(
                  <div key={n.id} style={{borderRadius:5,padding:'6px 8px',borderLeft:'2px solid var(--amb)',background:n.resuelta?'var(--bl)':'var(--ambl)',marginBottom:4,opacity:n.resuelta?0.6:1}}>
                    <div style={{fontSize:10,color:'var(--n)',fontWeight:300,lineHeight:1.4,textDecoration:n.resuelta?'line-through':'none'}}>{n.texto}</div>
                    <div style={{display:'flex',gap:5,marginTop:4}}>
                      <button onClick={()=>toggleNotaResuelta(n.id,n.resuelta)} style={{fontSize:8,padding:'1px 6px',borderRadius:3,border:'1px solid var(--amb)',background:'transparent',color:'var(--amb)',cursor:'pointer',fontFamily:'system-ui'}}>
                        {n.resuelta?'↩ Reabrir':'✓ Hecho'}
                      </button>
                      <button onClick={()=>eliminarNota(n.id)} style={{fontSize:8,padding:'1px 6px',borderRadius:3,border:'1px solid var(--red)',background:'transparent',color:'var(--red)',cursor:'pointer',fontFamily:'system-ui'}}>✕</button>
                    </div>
                  </div>
                ))}
              </div>
              <div style={{padding:'7px 9px',borderTop:'1px solid var(--bd)',fontSize:9,color:'var(--amb)',cursor:'pointer',fontWeight:500,display:'flex',alignItems:'center',gap:5}} onClick={()=>setModalNota(true)}>
                <span>📝</span> + Nota del día
              </div>
            </div>
          </div>
        )}

        {/* VISTA SEMANA */}
        {vista==='semana'&&(
          <div style={{border:'1px solid var(--bd)',borderRadius:'var(--rl)',overflow:'hidden',background:'var(--w)',height:'calc(100vh - 150px)',overflowY:'auto'}}>
            {(()=>{
              const fs=getFechasSemana(),dn=['Lun','Mar','Mié','Jue','Vie','Sáb']
              function getNombreCorto(c:any) {
                return c.pacientes?.nombre_clinica || c.pacientes?.nombre || '?'
              }
              return (
                <>
                  {/* CABECERA DÍAS */}
                  <div style={{display:'grid',gridTemplateColumns:'44px repeat(6,1fr)',background:'var(--bl)',borderBottom:'1px solid var(--bd)',position:'sticky',top:0,zIndex:2}}>
                    <div/>
                    {fs.map((f,i)=>{const isH=f===hoy,d=new Date(f+'T12:00:00');return(
                      <div key={f} onClick={()=>{setFecha(f);setVista('dia')}} style={{padding:'5px 4px',textAlign:'center',borderLeft:'1px solid var(--bd)',cursor:'pointer',background:isH?'var(--gl)':'transparent'}}>
                        <div style={{fontSize:8,color:'var(--grl)',fontWeight:300}}>{dn[i]}</div>
                        <div style={{fontSize:12,fontWeight:isH?600:300,color:isH?'var(--g)':'var(--n)'}}>{d.getDate()}</div>
                      </div>
                    )})}
                  </div>
                  {HORAS.map(h=>(
                    <div key={h}>
                      {h==='15:30'&&<div style={{padding:'3px 10px',background:'var(--bm)',borderBottom:'1px solid var(--bd)',fontSize:8,color:'var(--gr)'}}>— Pausa 12:30–15:30</div>}
                      <div style={{display:'grid',gridTemplateColumns:'44px repeat(6,1fr)',borderBottom:'1px solid var(--bl)'}}>
                        <div style={{fontSize:8,color:'var(--grl)',padding:'4px 2px',borderRight:'1px solid var(--bl)',display:'flex',alignItems:'flex-start',justifyContent:'flex-end',fontWeight:300}}>{h}</div>
                        {fs.map(f=>{
                          const cdA=citas.filter(c=>c.fecha===f&&c.hora.startsWith(h)&&c.sala==='A')
                          const cdB=citas.filter(c=>c.fecha===f&&c.hora.startsWith(h)&&c.sala==='B')
                          const isH=f===hoy
                          const tieneGente=cdA.length>0||cdB.length>0
                          return (
                            <div key={f} style={{borderLeft:'1px solid var(--bl)',background:isH?'rgba(90,150,158,.03)':'transparent',minHeight:52}}>
                              {!tieneGente ? (
                                <div onClick={()=>{setFecha(f);setNuevaCita(p=>({...p,hora:h}));setModal(true)}}
                                  style={{height:'100%',minHeight:50,display:'flex',alignItems:'center',justifyContent:'center',fontSize:8,color:'transparent',cursor:'pointer'}}
                                  onMouseOver={e=>{const el=e.currentTarget;el.style.background='var(--gl)';el.style.color='var(--g)';el.textContent='+'}}
                                  onMouseOut={e=>{const el=e.currentTarget;el.style.background='';el.style.color='transparent';el.textContent='+'}}>+</div>
                              ) : (
                                <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',height:'100%',gap:1,padding:1}}>
                                  {/* SALA A */}
                                  <div style={{background:cdA.length>0?'var(--gl)':'transparent',borderRadius:3,padding:'2px 3px',borderLeft:cdA.length>0?'2px solid var(--g)':'none',minHeight:48}}>
                                    {cdA.length>0&&<div style={{fontSize:7,color:'var(--g)',fontWeight:600,marginBottom:1,letterSpacing:.3}}>A {cdA.length}/6</div>}
                                    {cdA.map(c=>(
                                      <div key={c.id} onClick={()=>abrirPanel(c)} style={{fontSize:8,color:'var(--n)',fontWeight:300,padding:'1px 1px',cursor:'pointer',whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis',lineHeight:1.3}}
                                        onMouseOver={e=>(e.currentTarget as HTMLElement).style.color='var(--g)'}
                                        onMouseOut={e=>(e.currentTarget as HTMLElement).style.color='var(--n)'}>
                                        {getNombreCorto(c)}
                                      </div>
                                    ))}
                                    {cdA.length===0&&cdB.length>0&&<div style={{fontSize:7,color:'var(--grl)',padding:'1px',fontStyle:'italic'}}>libre</div>}
                                  </div>
                                  {/* SALA B */}
                                  <div style={{background:cdB.length>0?'rgba(90,150,158,.06)':'transparent',borderRadius:3,padding:'2px 3px',borderLeft:cdB.length>0?'2px solid var(--gm)':'none',minHeight:48}}>
                                    {cdB.length>0&&<div style={{fontSize:7,color:'var(--gm)',fontWeight:600,marginBottom:1,letterSpacing:.3}}>B {cdB.length}/6</div>}
                                    {cdB.map(c=>(
                                      <div key={c.id} onClick={()=>abrirPanel(c)} style={{fontSize:8,color:'var(--n)',fontWeight:300,padding:'1px 1px',cursor:'pointer',whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis',lineHeight:1.3}}
                                        onMouseOver={e=>(e.currentTarget as HTMLElement).style.color='var(--g)'}
                                        onMouseOut={e=>(e.currentTarget as HTMLElement).style.color='var(--n)'}>
                                        {getNombreCorto(c)}
                                      </div>
                                    ))}
                                    {cdB.length===0&&cdA.length>0&&<div style={{fontSize:7,color:'var(--grl)',padding:'1px',fontStyle:'italic'}}>libre</div>}
                                  </div>
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
        {vista==='mes'&&(
          <div style={{border:'1px solid var(--bd)',borderRadius:'var(--rl)',overflow:'hidden',background:'var(--w)'}}>
            <div style={{display:'grid',gridTemplateColumns:'repeat(7,1fr)',background:'var(--bl)',borderBottom:'1px solid var(--bd)'}}>
              {['Lun','Mar','Mié','Jue','Vie','Sáb','Dom'].map(d=>(
                <div key={d} style={{fontSize:9,fontWeight:600,color:'var(--grl)',padding:'7px',textAlign:'center',letterSpacing:.3}}>{d}</div>
              ))}
            </div>
            <div style={{display:'grid',gridTemplateColumns:'repeat(7,1fr)'}}>
              {getDiasMes().map((f,i)=>{
                if (!f) return <div key={i} style={{minHeight:80,borderRight:'1px solid var(--bl)',borderBottom:'1px solid var(--bl)',background:'var(--bl)'}}/>
                const cd=citas.filter(c=>c.fecha===f),isH=f===hoy,d=new Date(f+'T12:00:00')
                return (
                  <div key={f} onClick={()=>{setFecha(f);setVista('dia')}} style={{minHeight:80,padding:'4px 5px',borderRight:'1px solid var(--bl)',borderBottom:'1px solid var(--bl)',cursor:'pointer',background:isH?'var(--gl)':'var(--w)',transition:'background .1s'}}
                    onMouseOver={e=>{if(!isH)(e.currentTarget as HTMLElement).style.background='rgba(90,150,158,.05)'}}
                    onMouseOut={e=>{if(!isH)(e.currentTarget as HTMLElement).style.background='var(--w)'}}>
                    <div style={{fontSize:11,fontWeight:isH?600:300,color:isH?'var(--g)':'var(--n)',marginBottom:3}}>{d.getDate()}</div>
                    {cd.slice(0,3).map(c=>(
                      <div key={c.id} style={{fontSize:8,padding:'1px 4px',borderRadius:2,background:'var(--g)',color:'#fff',marginBottom:1,whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis'}}>
                        {c.hora?.slice(0,5)} {c.pacientes?.nombre}
                      </div>
                    ))}
                    {cd.length>3&&<div style={{fontSize:8,color:'var(--g)',fontWeight:500}}>+{cd.length-3} más</div>}
                  </div>
                )
              })}
            </div>
          </div>
        )}
        </>
      )}

      {/* PANEL FLOTANTE */}
      {panelPac&&(
        <>
          <div onClick={()=>setPanelPac(null)} style={{position:'fixed',inset:0,background:'rgba(38,40,37,.12)',zIndex:98}}/>
          <div onClick={e=>e.stopPropagation()} style={{position:'fixed',top:0,right:0,width:320,height:'100vh',background:'var(--w)',borderLeft:'1px solid var(--bd)',zIndex:99,display:'flex',flexDirection:'column',boxShadow:'-4px 0 20px rgba(38,40,37,.08)'}}>
            
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
                <button key={k} onClick={()=>{setPanelTab(k as any);setMostrarSesiones(false)}}
                  style={{flex:1,fontSize:10,padding:'7px',textAlign:'center',cursor:'pointer',color:panelTab===k?'var(--g)':'var(--grl)',borderBottom:panelTab===k?'2px solid var(--g)':'2px solid transparent',marginBottom:-1,background:'none',border:'none',borderBottom:panelTab===k?'2px solid var(--g)':'2px solid transparent',fontFamily:'system-ui',fontWeight:panelTab===k?500:300}}>{l}</button>
              ))}
            </div>

            {/* CONTENIDO */}
            <div style={{flex:1,overflowY:'auto'}}>
              
              {/* TAB SESIÓN */}
              {panelTab==='sesion'&&(
                <div style={{padding:11}}>
                  {loadingSesion?(
                    <div className="loading">Cargando...</div>
                  ):mostrarSesiones?(
                    /* SELECTOR DE SESIONES */
                    <div>
                      <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:10}}>
                        <div style={{fontSize:11,fontWeight:400,color:'var(--n)'}}>Seleccionar sesión</div>
                        <button className="btn btn-s btn-sm" onClick={()=>setMostrarSesiones(false)}>← Volver</button>
                      </div>
                      {sesionesPaciente.length===0?(
                        <div style={{textAlign:'center',padding:16,color:'var(--grl)',fontSize:10}}>
                          Sin sesiones para este paciente.<br/>
                          <a href={`/entrenamiento?nueva_sesion=1&paciente_id=${panelPac?.paciente_id}&paciente_nombre=${encodeURIComponent((panelPac?.pacientes?.nombre_clinica||panelPac?.pacientes?.nombre||'')+' '+(panelPac?.pacientes?.apellidos||''))}`} style={{color:'var(--g)',fontSize:10,fontWeight:500}}>+ Crear sesión para este paciente →</a>
                        </div>
                      ):sesionesPaciente.map((s:any)=>(
                        <button key={s.id} onClick={()=>asignarSesion(s.id)}
                          style={{width:'100%',textAlign:'left',padding:'10px 12px',background:sesionDetalle?.id===s.id?'var(--gl)':'var(--bl)',borderRadius:7,border:`1.5px solid ${sesionDetalle?.id===s.id?'var(--g)':'var(--bd)'}`,marginBottom:6,cursor:'pointer',fontFamily:'system-ui',display:'block',transition:'all .15s'}}>
                          <div style={{fontSize:11,fontWeight:400,color:'var(--n)',marginBottom:2}}>{s.nombre}</div>
                          {s.descripcion&&<div style={{fontSize:9,color:'var(--grl)',fontWeight:300}}>{s.descripcion}</div>}
                          <div style={{fontSize:9,color:'var(--grl)',marginTop:2}}>{(s.partes||[]).reduce((acc:number,p:any)=>acc+(p.ejercicios||[]).length,0)} ejercicios</div>
                          {sesionDetalle?.id===s.id&&<div style={{fontSize:9,color:'var(--g)',fontWeight:600,marginTop:3}}>✓ Asignada actualmente</div>}
                        </button>
                      ))}
                    </div>
                  ):sesionDetalle?(
                    /* SESIÓN ASIGNADA */
                    <>
                      <div style={{display:'flex',alignItems:'center',gap:7,marginBottom:10}}>
                        <div style={{flex:1}}>
                          <div style={{fontSize:12,fontWeight:400,color:'var(--n)'}}>{sesionDetalle.nombre}</div>
                          {sesionDetalle.descripcion&&<div style={{fontSize:9,color:'var(--grl)',fontWeight:300,marginTop:1}}>{sesionDetalle.descripcion}</div>}
                        </div>
                        <button className="btn btn-t btn-sm" onClick={()=>setMostrarSesiones(true)}>Cambiar</button>
                      </div>
                      {(sesionDetalle.partes||[]).map((parte:any,pi:number)=>(
                        <div key={pi} style={{marginBottom:10}}>
                          <div style={{fontSize:9,fontWeight:600,color:'var(--g)',letterSpacing:.5,textTransform:'uppercase',marginBottom:6,paddingBottom:4,borderBottom:'1px solid var(--bm)'}}>{parte.nombre}</div>
                          {(parte.ejercicios||[]).map((ej:any,ei:number)=>(
                            <div key={ei} style={{marginBottom:8,background:'var(--bl)',borderRadius:7,border:'1px solid var(--bd)',overflow:'hidden'}}>
                              <div style={{display:'flex',alignItems:'center',gap:7,padding:'7px 9px'}}>
                                {ej.imagen_url?(
                                  <img src={ej.imagen_url} alt={ej.nombre} style={{width:40,height:40,objectFit:'cover',borderRadius:5,flexShrink:0}}/>
                                ):(
                                  <div style={{width:40,height:40,background:'var(--bm)',borderRadius:5,display:'flex',alignItems:'center',justifyContent:'center',fontSize:18,flexShrink:0}}>💪</div>
                                )}
                                <div style={{flex:1,minWidth:0}}>
                                  <div style={{fontSize:11,fontWeight:400,color:'var(--n)',marginBottom:2}}>{ej.nombre}</div>
                                  <div style={{display:'flex',gap:3,flexWrap:'wrap'}}>
                                    {ej.variante&&<span style={{fontSize:8,padding:'1px 5px',borderRadius:99,background:'var(--gl)',color:'var(--gd)'}}>{ej.variante}</span>}
                                    {ej.capacidad&&<span style={{fontSize:8,padding:'1px 5px',borderRadius:99,background:'var(--ambl)',color:'#7A5800'}}>{ej.capacidad}</span>}
                                  </div>
                                </div>
                                {ej.video_url&&<a href={ej.video_url} target="_blank" rel="noopener noreferrer" style={{fontSize:14,flexShrink:0}}>🎥</a>}
                              </div>
                              <div style={{padding:'5px 9px 7px',borderTop:'1px solid var(--bm)'}}>
                                <div style={{display:'flex',gap:5,alignItems:'center',marginBottom:6}}>
                                  <span style={{fontSize:9,color:'var(--grl)',width:42,flexShrink:0}}>Series</span>
                                  <div style={{fontSize:11,padding:'2px 7px',background:'var(--w)',borderRadius:4,border:'1px solid var(--bd)',minWidth:32,textAlign:'center'}}>{ej.series||'—'}</div>
                                  <span style={{fontSize:9,color:'var(--grl)',marginLeft:4,width:32,flexShrink:0}}>Reps</span>
                                  <div style={{fontSize:11,padding:'2px 7px',background:'var(--w)',borderRadius:4,border:'1px solid var(--bd)',minWidth:32,textAlign:'center'}}>{ej.reps||'—'}</div>
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
                                  placeholder="📝 Anotación..."/>
                                {guardandoAnot===ej.ejercicio_id&&<div style={{fontSize:8,color:'var(--g)',marginTop:2}}>Guardando...</div>}
                              </div>
                            </div>
                          ))}
                        </div>
                      ))}
                    </>
                  ):(
                    /* SIN SESIÓN */
                    <div style={{padding:'30px 11px 11px'}}>
                      <div style={{textAlign:'center',marginBottom:16}}>
                        <div style={{fontSize:28,marginBottom:8}}>📋</div>
                        <div style={{fontSize:11,color:'var(--grl)',fontWeight:300,marginBottom:14}}>Sin sesión asignada para esta cita</div>
                        <button className="btn btn-p" style={{width:'100%',justifyContent:'center'}} onClick={()=>setMostrarSesiones(true)}>
                          + Asignar sesión
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* TAB DATOS */}
              {panelTab==='datos'&&(
                <div style={{padding:11}}>
                  {panelPac.pacientes?.telefono&&<div style={{fontSize:11,color:'var(--n)',fontWeight:300,marginBottom:6}}>📞 {panelPac.pacientes.telefono}</div>}
                  {panelPac.pacientes?.email&&<div style={{fontSize:11,color:'var(--n)',fontWeight:300,marginBottom:6}}>✉️ {panelPac.pacientes.email}</div>}
                  <div style={{fontSize:11,color:'var(--n)',fontWeight:300,marginBottom:12}}>🏷 {panelPac.pacientes?.tipo_clase||'—'}</div>
                  
                  {/* BONO */}
                  {(()=>{
                    const bono = panelPac.pacientes?.bono
                    const bonoLabel:Record<string,string> = {esencial:'Esencial · 2d/sem',progreso:'Progreso · 3d/sem',avanzado:'Avanzado · 4d/sem',avanzado_mas1:'Avanzado+1 · 5d/sem'}
                    const pagoColor:Record<string,string> = {pagado:'var(--g)',pendiente:'var(--red)',parcial:'var(--amb)'}
                    return panelPac.bono_info ? (
                      <div style={{background:'var(--bl)',borderRadius:6,padding:'8px 10px',marginBottom:12,border:'1px solid var(--bd)'}}>
                        <div style={{fontSize:9,fontWeight:600,color:'var(--grl)',letterSpacing:.4,textTransform:'uppercase',marginBottom:4}}>Bono</div>
                        <div style={{fontSize:11,fontWeight:400,color:'var(--n)'}}>{bonoLabel[panelPac.bono_info.tipo]||panelPac.bono_info.tipo}</div>
                        <div style={{fontSize:10,fontWeight:500,color:pagoColor[panelPac.bono_info.estado_pago]||'var(--grl)',marginTop:2}}>
                          {panelPac.bono_info.estado_pago==='pagado'?'✓ Pagado':panelPac.bono_info.estado_pago==='pendiente'?'⚠ Pendiente de pago':'◑ Pago parcial'}
                        </div>
                      </div>
                    ) : null
                  })()}

                  {/* EDITOR DE CITA */}
                  <div style={{fontSize:9,fontWeight:600,color:'var(--grl)',letterSpacing:.5,textTransform:'uppercase',marginBottom:7,display:'flex',justifyContent:'space-between',alignItems:'center'}}>
                    Datos de la cita
                    <button className="btn btn-t btn-sm" onClick={()=>setEditandoCita(editandoCita?null:{...panelPac})}>
                      {editandoCita?'Cancelar':'✎ Editar'}
                    </button>
                  </div>

                  {editandoCita ? (
                    <div style={{marginBottom:12}}>
                      <div className="field"><label>Hora</label>
                        <select className="input" value={editandoCita.hora?.slice(0,5)||''} onChange={e=>setEditandoCita((p:any)=>({...p,hora:e.target.value+':00'}))}>
                          {['08:30','09:30','10:30','11:30','15:30','16:30','17:30','18:30','19:30','20:30','21:30'].map(h=><option key={h} value={h}>{h}</option>)}
                        </select>
                      </div>
                      <div className="field"><label>Sala</label>
                        <select className="input" value={editandoCita.sala||''} onChange={e=>setEditandoCita((p:any)=>({...p,sala:e.target.value}))}>
                          <option value="A">Sala A</option>
                          <option value="B">Sala B</option>
                        </select>
                      </div>
                      <div className="field"><label>Tipo</label>
                        <select className="input" value={editandoCita.tipo||''} onChange={e=>setEditandoCita((p:any)=>({...p,tipo:e.target.value}))}>
                          <option value="clase">Clase grupal</option>
                          <option value="individual">Individual</option>
                          <option value="valoracion">Valoración</option>
                          <option value="revaloracion">Revaloración</option>
                        </select>
                      </div>
                      <div className="field"><label>Notas</label>
                        <input className="input" value={editandoCita.notas||''} onChange={e=>setEditandoCita((p:any)=>({...p,notas:e.target.value}))} placeholder="Notas sobre esta cita..."/>
                      </div>
                      <button className="btn btn-p" style={{width:'100%',justifyContent:'center'}} onClick={guardarEdicionCita} disabled={guardando}>
                        {guardando?'⏳ Guardando...':'💾 Guardar cambios'}
                      </button>
                    </div>
                  ) : (
                    <div style={{background:'var(--bl)',borderRadius:6,padding:'8px 10px',marginBottom:12,fontSize:10,color:'var(--n)',fontWeight:300}}>
                      <div>{panelPac.hora?.slice(0,5)} · Sala {panelPac.sala} · {panelPac.tipo}</div>
                      {panelPac.notas&&<div style={{marginTop:4,color:'var(--gr)'}}>{panelPac.notas}</div>}
                    </div>
                  )}

                  <div style={{fontSize:9,fontWeight:600,color:'var(--grl)',letterSpacing:.5,textTransform:'uppercase',marginBottom:7}}>Estado de la cita</div>
                  {(()=>{
                    const esPasada = panelPac.fecha <= new Date().toISOString().split('T')[0]
                    const estado = panelPac.estado
                    return (
                      <div style={{marginBottom:12}}>
                        {/* ESTADO ACTUAL */}
                        <div style={{padding:'6px 10px',borderRadius:5,marginBottom:8,background:estado==='realizada'?'var(--gl)':estado==='falta'?'var(--redl)':estado==='cancelada'?'var(--bm)':'var(--ambl)',border:`1px solid ${estado==='realizada'?'var(--gm)':estado==='falta'?'#F5C8C8':estado==='cancelada'?'var(--bd)':'var(--amb)'}`,fontSize:10,fontWeight:500,color:estado==='realizada'?'var(--gd)':estado==='falta'?'var(--red)':estado==='cancelada'?'var(--gr)':'#7A5800'}}>
                          {estado==='realizada'?'✓ Realizada':estado==='falta'?'✗ Falta':estado==='cancelada'?'Cancelada':'⏳ Programada'}
                        </div>
                        {/* BOTONES SEGÚN CONTEXTO */}
                        <div style={{display:'flex',gap:5,flexWrap:'wrap'}}>
                          {esPasada && estado!=='falta' && estado!=='cancelada' && (
                            <button onClick={()=>cambiarEstado(panelPac.id,'falta')}
                              style={{fontSize:10,padding:'5px 12px',borderRadius:'var(--r)',border:'1px solid var(--red)',background:'var(--redl)',color:'var(--red)',cursor:'pointer',fontFamily:'system-ui',fontWeight:500}}>
                              ✗ Marcar falta
                            </button>
                          )}
                          {estado==='falta' && (
                            <button onClick={()=>cambiarEstado(panelPac.id,'realizada')}
                              style={{fontSize:10,padding:'5px 12px',borderRadius:'var(--r)',border:'1px solid var(--g)',background:'var(--gl)',color:'var(--gd)',cursor:'pointer',fontFamily:'system-ui',fontWeight:500}}>
                              ↩ Deshacer falta
                            </button>
                          )}
                          {estado!=='cancelada' && (
                            <button onClick={()=>cambiarEstado(panelPac.id,'cancelada')}
                              style={{fontSize:10,padding:'5px 12px',borderRadius:'var(--r)',border:'1px solid var(--bd)',background:'var(--w)',color:'var(--gr)',cursor:'pointer',fontFamily:'system-ui'}}>
                              Cancelar cita
                            </button>
                          )}
                          {estado==='cancelada' && (
                            <button onClick={()=>cambiarEstado(panelPac.id,'programada')}
                              style={{fontSize:10,padding:'5px 12px',borderRadius:'var(--r)',border:'1px solid var(--g)',background:'var(--gl)',color:'var(--gd)',cursor:'pointer',fontFamily:'system-ui'}}>
                              ↩ Reactivar cita
                            </button>
                          )}
                        </div>
                      </div>
                    )
                  })()}

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

      {/* MODAL NOTA DEL DÍA */}
      {modalNota&&(
        <div className="modal-bg" onClick={e=>{if(e.target===e.currentTarget)setModalNota(false)}}>
          <div className="modal" style={{width:380}}>
            <div className="modal-title">
              📝 Nueva nota del día
              <button className="modal-close" onClick={()=>setModalNota(false)}>✕</button>
            </div>
            <div style={{fontSize:10,color:'var(--grl)',marginBottom:12,fontWeight:300}}>{fechaDisplay}</div>
            <div className="field">
              <label>Nota</label>
              <textarea className="input" value={nuevaNota} onChange={e=>setNuevaNota(e.target.value)}
                placeholder="ej. Traer bandas elásticas azules, llamar a Carmen para confirmar..." 
                style={{minHeight:80}} autoFocus/>
            </div>
            <div style={{display:'flex',gap:8,marginTop:8}}>
              <button className="btn btn-d btn-sm" onClick={()=>setModalNota(false)}>Cancelar</button>
              <div style={{flex:1}}/>
              <button className="btn btn-p" onClick={crearNotaDia} disabled={!nuevaNota.trim()}>💾 Guardar nota</button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL NUEVA CITA */}
      {modal&&(
        <div className="modal-bg" onClick={e=>{if(e.target===e.currentTarget&&!guardando)setModal(false)}}>
          <div className="modal" style={{width:460}}>
            <div className="modal-title">
              Nueva cita
              <button className="modal-close" onClick={()=>{if(!guardando)setModal(false)}}>✕</button>
            </div>
            <div style={{fontSize:10,color:'var(--grl)',marginBottom:12,fontWeight:300}}>{fechaDisplay}</div>
            <div className="field"><label>Paciente *</label>
              <select className="input" value={nuevaCita.paciente_id} onChange={e=>{setNuevaCita(p=>({...p,paciente_id:e.target.value,es_recuperacion:false,recuperacion_id:''}));cargarRecuperaciones(e.target.value)}} disabled={guardando}>
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
              {nuevaCita.repetir&&(
                <>
                  <div className="field"><label>Días de la semana</label>
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
                  {nuevaCita.periodo==='personalizado'&&(
                    <div className="field"><label>Fecha fin</label>
                      <input type="date" className="input" value={nuevaCita.fecha_fin} onChange={e=>setNuevaCita(p=>({...p,fecha_fin:e.target.value}))} min={fecha} disabled={guardando}/>
                    </div>
                  )}
                  <div style={{background:'var(--gl)',borderRadius:5,padding:'6px 9px',fontSize:9,color:'var(--gd)'}}>✓ Se crearán todas las citas automáticamente</div>
                </>
              )}
            </div>
            {nuevaCita.paciente_id && recuperacionesPaciente.length>0 && (
              <div style={{background:'var(--ambl)',border:'1px solid var(--amb)',borderRadius:'var(--rl)',padding:'10px 12px',marginBottom:8}}>
                <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:nuevaCita.es_recuperacion?8:0}}>
                  <div>
                    <div style={{fontSize:11,fontWeight:400,color:'var(--n)'}}>¿Es clase de recuperación?</div>
                    <div style={{fontSize:9,color:'#7A5800',fontWeight:300}}>{recuperacionesPaciente.length} falta{recuperacionesPaciente.length>1?'s':''} pendiente{recuperacionesPaciente.length>1?'s':''}</div>
                  </div>
                  <button className="toggle" style={{background:nuevaCita.es_recuperacion?'var(--g)':'var(--bm)'}} onClick={()=>setNuevaCita(p=>({...p,es_recuperacion:!p.es_recuperacion,recuperacion_id:''}))}/>
                </div>
                {nuevaCita.es_recuperacion && (
                  <select className="input" value={nuevaCita.recuperacion_id} onChange={e=>setNuevaCita(p=>({...p,recuperacion_id:e.target.value}))}>
                    <option value="">Seleccionar falta a recuperar...</option>
                    {recuperacionesPaciente.map(r=>(
                      <option key={r.id} value={r.id}>
                        Falta del {new Date(r.fecha_falta+'T12:00:00').toLocaleDateString('es-ES',{day:'numeric',month:'short'})} · vence {new Date(r.fecha_limite+'T12:00:00').toLocaleDateString('es-ES',{day:'numeric',month:'short'})}
                      </option>
                    ))}
                  </select>
                )}
              </div>
            )}
            <div className="field"><label>Notas (opcional)</label>
              <input className="input" value={nuevaCita.notas} onChange={e=>setNuevaCita(p=>({...p,notas:e.target.value}))} placeholder="ej. Molestia lumbar, precaución..." disabled={guardando}/>
            </div>
            {nuevaCita.paciente_id && (
              <div className="field">
                <label>Sesión de entrenamiento (opcional)</label>
                <SesionSelector pacienteId={nuevaCita.paciente_id} sesionId={nuevaCita.sesion_id} onChange={id=>setNuevaCita(p=>({...p,sesion_id:id}))}/>
              </div>
            )}
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
