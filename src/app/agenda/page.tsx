'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { generarHoras } from '@/lib/generarHoras'
import VistaDia from './components/VistaDia'
import VistaSemana from './components/VistaSemana'
import VistaMes from './components/VistaMes'
import ModalNuevaCita from './components/ModalNuevaCita'
import ModalEditarCita from './components/ModalEditarCita'
import ModalDatosCita from './components/ModalDatosCita'
import ModalEntrenoCita from './components/ModalEntrenoCita'
import ModalAlertasCita from './components/ModalAlertasCita'
import ModalTareas from './components/ModalTareas'
import ModalNotaDia from './components/ModalNotaDia'

const HORAS = ['08:30','09:30','10:30','11:30','15:30','16:30','17:30','18:30','19:30','20:30','21:30']
const DIAS_SEMANA = ['Lun','Mar','Mié','Jue','Vie','Sáb']

export default function AgendaPage() {
  const [vista, setVista] = useState<'dia'|'semana'|'mes'>('dia')
  const [citas, setCitas] = useState<any[]>([])
  const [alertasPaciente, setAlertasPaciente] = useState<any[]>([])
  const [perfiles, setPerfiles] = useState<any[]>([])
  const [userId, setUserId] = useState<string|null>(null)
  const [tareas, setTareas] = useState<any[]>([])
  const [pacientes, setPacientes] = useState<any[]>([])
  const [fecha, setFecha] = useState(new Date().toISOString().split('T')[0])
  const [loading, setLoading] = useState(true)
  const [modal, setModal] = useState(false)
  const [modalTareas, setModalTareas] = useState(false)
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
  const [verDatosCita, setVerDatosCita] = useState<any>(null)
  const [verEntrenoCita, setVerEntrenoCita] = useState<any>(null)
  const [verAlertasCita, setVerAlertasCita] = useState<any>(null)
  const [notasDia, setNotasDia] = useState<any[]>([])
  const [buscarPac, setBuscarPac] = useState('')
  const [resultadosBusqueda, setResultadosBusqueda] = useState<any[]>([])
  const [modalNota, setModalNota] = useState(false)
  const [nuevaNota, setNuevaNota] = useState('')
  const [nuevaCita, setNuevaCita] = useState({
    paciente_id:'', fecha:'', hora:'08:30', sala:'A', tipo:'entrenamiento', notas:'',
    repetir:false, dias_repetir:[] as string[], fecha_fin:'', periodo:'3meses', sesion_id:'',
    es_recuperacion:false, recuperacion_id:''
  })
  const [recuperacionesPaciente, setRecuperacionesPaciente] = useState<any[]>([])
  const [proximasAlertas, setProximasAlertas] = useState<any[]>([])
  const [horas, setHoras] = useState<string[]>(['08:30','09:30','10:30','11:30','15:30','16:30','17:30','18:30','19:30','20:30','21:30'])
  const [tiposCita, setTiposCita] = useState<any[]>([{id:'clase',nombre:'Clase grupal',color:'#5A969E',duracion:50,cuenta_clase:true},{id:'individual',nombre:'Individual / Pareja',color:'#3E7179',duracion:50,cuenta_clase:false},{id:'valoracion',nombre:'Valoración inicial',color:'#C9A84C',duracion:60,cuenta_clase:false},{id:'revaloracion',nombre:'Revaloración',color:'#C9A84C',duracion:60,cuenta_clase:false}])
  const [tiposClase, setTiposClase] = useState<any[]>([{valor:'entrenamiento',icono:'🏋',nombre:'Entrenamiento',color:'#5A969E',duracion:50},{valor:'pilates',icono:'🧘',nombre:'Pilates',color:'#A8CDD1',duracion:50},{valor:'rehabilitacion',icono:'🏥',nombre:'Rehabilitación',color:'#C9A84C',duracion:50},{valor:'individual',icono:'👤',nombre:'Individual',color:'#3E7179',duracion:50},{valor:'embarazadas',icono:'🤰',nombre:'Embarazadas',color:'#B05A5A',duracion:50}])
  const [pausaInicio, setPausaInicio] = useState('12:30')
  const [pausaFin, setPausaFin] = useState('15:30')
  const [descanso, setDescanso] = useState(10)
  const [maxPersonas, setMaxPersonas] = useState(6)

  const hoy = new Date().toISOString().split('T')[0]
  const fechaObj = new Date(fecha+'T12:00:00')
  const fechaDisplay = fechaObj.toLocaleDateString('es-ES',{weekday:'long',day:'numeric',month:'long',year:'numeric'})

  useEffect(() => { cargarPacientes(); cargarAjustes() }, [])

  async function cargarAjustes() {
    const { data } = await supabase.from('ajustes').select('clave,valor')
    if (data) {
      const map: Record<string,string> = {}
      data.forEach((a:any) => { map[a.clave] = a.valor || '' })
      const inicio = map.agenda_inicio || '08:30'
      const fin = map.agenda_fin || '21:30'
      const pInicio = map.clinica_pausa_inicio || '12:30'
      const pFin = map.clinica_pausa_fin || '15:30'
      const duracion = parseInt(map.clinica_duracion_clase || '50')
      const descanso = parseInt(map.clinica_tiempo_cambio || '10')
      setPausaInicio(pInicio)
      setPausaFin(pFin)
      setDescanso(descanso)
      setMaxPersonas(parseInt(map.clinica_max_personas_sala || '6'))
      setHoras(generarHoras(inicio, fin, pInicio, pFin, duracion, descanso))
      if (map.tipos_cita) setTiposCita(JSON.parse(map.tipos_cita))
      if (map.tipos_clase) setTiposClase(JSON.parse(map.tipos_clase))
    }
  }
  useEffect(() => { cargar() }, [fecha, vista])

  async function cargarPacientes() {
    const { data } = await supabase.from('pacientes').select('id,nombre,apellidos,nombre_clinica').eq('estado','activo').order('nombre')
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
    const hoyStr = new Date().toISOString().split('T')[0]
    const { data: alertas } = await supabase.from('notas').select('*').eq('tipo','urgente').eq('visible_agenda',true).gte('fecha', hoyStr).order('fecha').limit(10)
    setProximasAlertas(alertas||[])
    setNotasDia(nd||[])
    const { data: c } = await supabase.from('citas').select('*, pacientes(id,nombre,apellidos,nombre_clinica,telefono,email,tipo_clase), sesiones:sesion_id(id,nombre,partes,descripcion)').gte('fecha',fechaInicio).lte('fecha',fechaFin).order('fecha').order('hora')
    setCitas(c||[])
    const { data: alPac } = await supabase.from('alertas_paciente').select('*').eq('activa',true)
    setAlertasPaciente(alPac||[])
    const { data: perf } = await supabase.from('perfiles').select('user_id,nombre,rol')
    setPerfiles(perf||[])
    const { data: { user } } = await supabase.auth.getUser()
    setUserId(user?.id||null)
    const { data: tar } = await supabase.from('tareas').select('*').order('fecha_limite',{ascending:true,nullsFirst:false})
    setTareas(tar||[])
    setLoading(false)
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

  async function abrirDatosCita(c:any) {
    const { data: bonoData } = await supabase.from('bonos').select('*').eq('paciente_id',c.paciente_id).eq('activo',true).maybeSingle()
    setVerDatosCita({...c, bono_info: bonoData||null})
  }

  async function abrirPanel(c:any) {
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

  async function abrirEntrenoCita(c:any) {
    setVerEntrenoCita(c)
    setSesionDetalle(null)
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
    setNuevaNota(''); setModalNota(false); cargar()
  }

  async function toggleNotaResuelta(id: string, resuelta: boolean) {
    await supabase.from('notas_dia').update({ resuelta: !resuelta }).eq('id', id); cargar()
  }

  async function eliminarNota(id: string) {
    await supabase.from('notas_dia').delete().eq('id', id); cargar()
  }

  async function asignarSesion(sesionId:string) {
    const citaActiva = verEntrenoCita || panelPac
    if (!citaActiva) return
    await supabase.from('citas').update({sesion_id:sesionId}).eq('id',citaActiva.id)
    setMostrarSesiones(false)
    setSesionDetalle(sesionesPaciente.find(s=>s.id===sesionId)||null)
    cargar()
  }

  async function guardarAnotacion(ejercicioId:string) {
    const citaActiva = verEntrenoCita || panelPac
    if (!citaActiva) return
    setGuardandoAnot(ejercicioId)
    const { data: ex } = await supabase.from('anotaciones_ejercicios').select('id').eq('paciente_id',citaActiva.paciente_id).eq('ejercicio_id',ejercicioId).eq('cita_id',citaActiva.id).maybeSingle()
    const datos = {paciente_id:citaActiva.paciente_id,ejercicio_id:ejercicioId,cita_id:citaActiva.id,anotacion:anotaciones[ejercicioId]||'',peso_real:pesos[ejercicioId]?parseFloat(pesos[ejercicioId]):null,fecha}
    if (ex) await supabase.from('anotaciones_ejercicios').update(datos).eq('id',ex.id)
    else await supabase.from('anotaciones_ejercicios').insert(datos)
    setGuardandoAnot(null)
  }

  async function guardarEdicionCita() {
    if (!editandoCita) return
    setGuardando(true)
    // Detectar la cita original para comparar fecha/hora
    const original = citas.find((c:any)=>c.id===editandoCita.id)
    const fechaNueva = editandoCita.fecha
    const horaNueva = editandoCita.hora
    await supabase.from('citas').update({fecha:editandoCita.fecha,hora:editandoCita.hora,sala:editandoCita.sala,tipo:editandoCita.tipo,notas:editandoCita.notas}).eq('id',editandoCita.id)
    // Registrar cambios de fecha y hora en el historial
    if (original) {
      const registros:any[]=[]
      if (fechaNueva && original.fecha && fechaNueva!==original.fecha) {
        registros.push({cita_id:editandoCita.id,paciente_id:editandoCita.paciente_id,campo_cambiado:'fecha',valor_anterior:original.fecha,valor_nuevo:fechaNueva})
      }
      const hAnt=(original.hora||'').slice(0,5), hNue=(horaNueva||'').slice(0,5)
      if (hNue && hAnt && hNue!==hAnt) {
        registros.push({cita_id:editandoCita.id,paciente_id:editandoCita.paciente_id,campo_cambiado:'hora',valor_anterior:hAnt,valor_nuevo:hNue})
      }
      if (registros.length>0) await supabase.from('cambios_cita').insert(registros)
    }
    setEditandoCita(null); setGuardando(false); cargar()
  }

  async function crearCita() {
    if (guardando) return
    if (!nuevaCita.paciente_id) { alert('Selecciona un paciente'); return }
    const fechaCita = nuevaCita.fecha || fecha
    if (!fechaCita) { alert('Selecciona el día de la cita'); return }
    if (!nuevaCita.hora) { alert('Selecciona la hora de la cita'); return }
    setGuardando(true)
    if (!nuevaCita.repetir) {
      const { data: citaCreada, error: errCita } = await supabase.from('citas').insert({paciente_id:nuevaCita.paciente_id,hora:nuevaCita.hora+':00',sala:nuevaCita.sala,tipo:nuevaCita.tipo,notas:nuevaCita.notas,fecha:fechaCita,duracion_min:(tiposClase.find((t:any)=>t.valor===nuevaCita.tipo)?.duracion)||50,estado:'programada',sesion_id:nuevaCita.sesion_id||null}).select().single()
      if (errCita) { alert('Error: '+errCita.message); setGuardando(false); return }
      if (nuevaCita.es_recuperacion && nuevaCita.recuperacion_id && citaCreada) {
        await supabase.from('recuperaciones').update({cita_recuperacion_id:citaCreada.id}).eq('id',nuevaCita.recuperacion_id)
      }
    } else {
      if (nuevaCita.dias_repetir.length===0) { alert('Selecciona al menos un día'); setGuardando(false); return }
      let fechaFin=nuevaCita.fecha_fin
      if (!fechaFin) {
        const fd=new Date(fechaCita+'T12:00:00')
        if (nuevaCita.periodo==='1mes') fd.setMonth(fd.getMonth()+1)
        else if (nuevaCita.periodo==='3meses') fd.setMonth(fd.getMonth()+3)
        else if (nuevaCita.periodo==='6meses') fd.setMonth(fd.getMonth()+6)
        else if (nuevaCita.periodo==='1anio') fd.setFullYear(fd.getFullYear()+1)
        fechaFin=fd.toISOString().split('T')[0]
      }
      const diasMap:Record<string,number>={Lun:1,Mar:2,Mié:3,Jue:4,Vie:5,Sáb:6}
      const citasACrear:any[]=[]
      const fa=new Date(fechaCita+'T12:00:00'),ff=new Date(fechaFin+'T12:00:00')
      while(fa<=ff) {
        const ds=fa.getDay()===0?7:fa.getDay()
        const dStr=Object.entries(diasMap).find(([,v])=>v===ds)?.[0]
        if (dStr&&nuevaCita.dias_repetir.includes(dStr)) citasACrear.push({paciente_id:nuevaCita.paciente_id,hora:nuevaCita.hora+':00',sala:nuevaCita.sala,tipo:nuevaCita.tipo,notas:nuevaCita.notas,fecha:fa.toISOString().split('T')[0],duracion_min:(tiposClase.find((t:any)=>t.valor===nuevaCita.tipo)?.duracion)||50,estado:'programada'})
        fa.setDate(fa.getDate()+1)
      }
      if (citasACrear.length>0) {
        for (let i=0;i<citasACrear.length;i+=50) await supabase.from('citas').insert(citasACrear.slice(i,i+50))
        alert(`✓ ${citasACrear.length} citas creadas`)
      }
    }
    setModal(false)
    setNuevaCita({paciente_id:'',fecha:'',hora:'08:30',sala:'A',tipo:'entrenamiento',notas:'',repetir:false,dias_repetir:[],fecha_fin:'',periodo:'3meses',sesion_id:'',es_recuperacion:false,recuperacion_id:''})
    setGuardando(false); cargar()
  }

  async function cambiarEstado(id:string,estado:string) {
    await supabase.from('citas').update({estado}).eq('id',id)
    if (estado==='cancelada') await supabase.from('recuperaciones').update({estado:'pendiente',cita_recuperacion_id:null}).eq('cita_recuperacion_id',id)
    if (estado==='falta' && panelPac) {
      const fechaFalta=new Date(panelPac.fecha+'T12:00:00')
      const fechaLimite=new Date(fechaFalta); fechaLimite.setDate(fechaLimite.getDate()+30)
      const { data: existing } = await supabase.from('recuperaciones').select('id').eq('cita_falta_id',id).maybeSingle()
      if (!existing) await supabase.from('recuperaciones').insert({paciente_id:panelPac.paciente_id,cita_falta_id:id,fecha_falta:panelPac.fecha,fecha_limite:fechaLimite.toISOString().split('T')[0],estado:'pendiente'})
    }
    if (estado==='realizada' && panelPac) await supabase.from('recuperaciones').delete().eq('cita_falta_id',id).eq('estado','pendiente')
    setPanelPac((prev:any)=>prev?{...prev,estado}:null)
    cargar()
  }

  async function cambiarEstadoCita(cita:any, estado:string) {
    await supabase.from('citas').update({estado}).eq('id',cita.id)
    // Cancelada (avisa) -> genera recuperacion
    if (estado==='cancelada') {
      const fechaFalta=new Date(cita.fecha+'T12:00:00')
      const fechaLimite=new Date(fechaFalta); fechaLimite.setDate(fechaLimite.getDate()+30)
      const { data: existing } = await supabase.from('recuperaciones').select('id').eq('cita_falta_id',cita.id).maybeSingle()
      if (!existing) await supabase.from('recuperaciones').insert({paciente_id:cita.paciente_id,cita_falta_id:cita.id,fecha_falta:cita.fecha,fecha_limite:fechaLimite.toISOString().split('T')[0],estado:'pendiente'})
    }
    // Falta (no avisa) -> NO recupera, y elimina recuperacion previa si la hubiera
    if (estado==='falta') await supabase.from('recuperaciones').delete().eq('cita_falta_id',cita.id).eq('estado','pendiente')
    // Volver a realizada/programada -> quitar recuperacion pendiente
    if (estado==='realizada'||estado==='programada') await supabase.from('recuperaciones').delete().eq('cita_falta_id',cita.id).eq('estado','pendiente')
    setEditandoCita(null); cargar()
  }

  async function eliminarCita(cita:any) {
    if (!confirm('⚠️ Al eliminar esta cita NO se guardará ningún dato (ni realizada, ni falta, ni recuperación). Úsalo solo para errores.\n\n¿Eliminar la cita?')) return
    await supabase.from('recuperaciones').delete().eq('cita_falta_id',cita.id)
    await supabase.from('citas').delete().eq('id',cita.id)
    setEditandoCita(null); cargar()
  }

  async function recargarTareas() {
    const { data: tar } = await supabase.from('tareas').select('*').order('fecha_limite',{ascending:true,nullsFirst:false})
    setTareas(tar||[])
  }

  async function crearTarea(titulo:string, asignadoA:string, fechaLimite:string, pacienteId:string) {
    await supabase.from('tareas').insert({titulo,asignado_a:asignadoA||null,fecha_limite:fechaLimite||null,paciente_id:pacienteId||null,creada_por:userId,completada:false})
    recargarTareas()
  }

  async function completarTarea(tareaId:string, completada:boolean) {
    await supabase.from('tareas').update({completada,fecha_completada:completada?new Date().toISOString():null,completada_por:completada?userId:null}).eq('id',tareaId)
    recargarTareas()
  }

  async function borrarTarea(tareaId:string) {
    await supabase.from('tareas').delete().eq('id',tareaId)
    recargarTareas()
  }

  async function crearAlerta(pacienteId:string, tipo:string, afectaSesion:boolean, descripcion:string) {
    await supabase.from('alertas_paciente').insert({paciente_id:pacienteId,tipo,afecta_sesion:afectaSesion,descripcion,activa:true})
    const { data: alPac } = await supabase.from('alertas_paciente').select('*').eq('activa',true)
    setAlertasPaciente(alPac||[])
  }

  async function cerrarAlerta(alertaId:string) {
    await supabase.from('alertas_paciente').update({activa:false,fecha_cierre:new Date().toISOString()}).eq('id',alertaId)
    const { data: alPac } = await supabase.from('alertas_paciente').select('*').eq('activa',true)
    setAlertasPaciente(alPac||[])
  }

  async function cargarRecuperaciones(pacienteId: string) {
    if (!pacienteId) { setRecuperacionesPaciente([]); return }
    const { data } = await supabase.from('recuperaciones').select('*').eq('paciente_id',pacienteId).eq('estado','pendiente').is('cita_recuperacion_id',null).order('fecha_limite')
    setRecuperacionesPaciente(data||[])
  }

  function SesionSelector({ pacienteId, sesionId, onChange }: { pacienteId: string, sesionId: string, onChange: (id: string) => void }) {
    const [sesiones, setSesiones] = useState<any[]>([])
    useEffect(() => {
      if (!pacienteId) return
      supabase.from('sesiones').select('id,nombre,descripcion,partes').eq('paciente_id',pacienteId).order('created_at',{ascending:false}).then(({data})=>setSesiones(data||[]))
    }, [pacienteId])
    if (sesiones.length===0) return <div style={{fontSize:10,color:'var(--grl)',padding:'6px 0'}}>Sin sesiones creadas aún</div>
    return (
      <select className="input" value={sesionId} onChange={e=>onChange(e.target.value)}>
        <option value="">— Sin sesión —</option>
        {sesiones.map(s=><option key={s.id} value={s.id}>{s.nombre} · {(s.partes||[]).reduce((acc:number,p:any)=>acc+(p.ejercicios||[]).length,0)} ejercicios</option>)}
      </select>
    )
  }

  const prevPeriodo=()=>{const d=new Date(fecha+'T12:00:00');if(vista==='dia')d.setDate(d.getDate()-1);else if(vista==='semana')d.setDate(d.getDate()-7);else d.setMonth(d.getMonth()-1);setFecha(d.toISOString().split('T')[0])}
  const nextPeriodo=()=>{const d=new Date(fecha+'T12:00:00');if(vista==='dia')d.setDate(d.getDate()+1);else if(vista==='semana')d.setDate(d.getDate()+7);else d.setMonth(d.getMonth()+1);setFecha(d.toISOString().split('T')[0])}
  const totalPersonas=citas.filter(c=>c.fecha===fecha).length
  const clases=citas.filter(c=>c.fecha===fecha&&c.tipo==='clase').length

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
          {vista==='semana'?'Semana del '+fechaDisplay:vista==='mes'?fechaObj.toLocaleDateString('es-ES',{month:'long',year:'numeric'}):''}
        </span>
        {fecha!==hoy&&<button className="btn btn-t btn-sm" onClick={()=>setFecha(hoy)}>Hoy</button>}
        <button className="btn btn-s btn-sm" onClick={nextPeriodo}>›</button>
        <div style={{position:'relative'}}>
          <input className="input" placeholder="🔍 Buscar paciente..." value={buscarPac} onChange={e=>buscarPacienteDirecto(e.target.value)} style={{width:180,fontSize:11}}/>
          {buscarPac && resultadosBusqueda.length>0 && (
            <div style={{position:'absolute',top:'100%',left:0,right:0,background:'var(--w)',border:'1px solid var(--bd)',borderRadius:'var(--rl)',boxShadow:'0 4px 12px rgba(0,0,0,.1)',zIndex:50,maxHeight:280,overflowY:'auto',marginTop:3}}>
              {resultadosBusqueda.map(c=>(
                <div key={c.id} onClick={()=>{setFecha(c.fecha);setBuscarPac('');setResultadosBusqueda([]);setVista('dia')}}
                  style={{padding:'8px 11px',cursor:'pointer',borderBottom:'1px solid var(--bl)'}}
                  onMouseOver={e=>(e.currentTarget as HTMLElement).style.background='var(--gl)'}
                  onMouseOut={e=>(e.currentTarget as HTMLElement).style.background=''}>
                  <div style={{fontSize:11,fontWeight:400,color:'var(--n)'}}>{c.pacientes?.nombre} {c.pacientes?.apellidos}</div>
                  <div style={{fontSize:9,color:'var(--grl)',marginTop:1}}>{new Date(c.fecha+'T12:00:00').toLocaleDateString('es-ES',{weekday:'short',day:'numeric',month:'short'})} · {c.hora?.slice(0,5)} · Sala {c.sala}</div>
                </div>
              ))}
            </div>
          )}
          {buscarPac && resultadosBusqueda.length===0 && buscarPac.length>1 && (
            <div style={{position:'absolute',top:'100%',left:0,right:0,background:'var(--w)',border:'1px solid var(--bd)',borderRadius:'var(--rl)',padding:'10px',fontSize:10,color:'var(--grl)',zIndex:50,marginTop:3}}>Sin citas futuras</div>
          )}
        </div>
        <button className="btn btn-s btn-sm" onClick={()=>setModalTareas(true)}>✓ Tareas{tareas.filter((t:any)=>!t.completada).length>0&&<span style={{marginLeft:5,background:'var(--g)',color:'#fff',borderRadius:8,padding:'0 6px',fontSize:9}}>{tareas.filter((t:any)=>!t.completada).length}</span>}</button>
        <button className="btn btn-p btn-sm" onClick={()=>{setNuevaCita((p:any)=>({...p,fecha:'',hora:''}));setModal(true)}}>+ Nueva cita</button>
      </div>

      {loading?<div className="loading">Cargando agenda...</div>:(
        <>
          {vista==='dia'&&<VistaDia fecha={fecha} hoy={hoy} fechaDisplay={fechaDisplay} citas={citas} notasDia={notasDia} totalPersonas={totalPersonas} clases={clases} abrirPanel={abrirPanel} setNuevaCita={setNuevaCita} setModal={setModal} toggleNotaResuelta={toggleNotaResuelta} eliminarNota={eliminarNota} setModalNota={setModalNota} proximasAlertas={proximasAlertas} horas={horas} pausaInicio={pausaInicio} pausaFin={pausaFin} descanso={descanso} maxPersonas={maxPersonas} tiposCita={tiposCita} tiposClase={tiposClase} setEditandoCita={setEditandoCita} abrirDatosCita={abrirDatosCita} abrirEntrenoCita={abrirEntrenoCita} setVerAlertasCita={setVerAlertasCita} alertasPaciente={alertasPaciente} tareas={tareas} completarTarea={completarTarea} setModalTareas={setModalTareas}/>}
          {vista==='semana'&&<VistaSemana fecha={fecha} hoy={hoy} citas={citas} getFechasSemana={getFechasSemana} setFecha={setFecha} setVista={setVista} setNuevaCita={setNuevaCita} setModal={setModal} abrirPanel={abrirPanel} horas={horas} pausaInicio={pausaInicio} pausaFin={pausaFin} tiposCita={tiposCita} tiposClase={tiposClase} maxPersonas={maxPersonas} setEditandoCita={setEditandoCita} alertasPaciente={alertasPaciente} setVerAlertasCita={setVerAlertasCita}/>}
          {vista==='mes'&&<VistaMes fecha={fecha} hoy={hoy} citas={citas} getDiasMes={getDiasMes} setFecha={setFecha} setVista={setVista}/>}
        </>
      )}


      {modalNota&&<ModalNotaDia fechaDisplay={fechaDisplay} nuevaNota={nuevaNota} setNuevaNota={setNuevaNota} onGuardar={crearNotaDia} onCerrar={()=>setModalNota(false)}/>}

      {modal&&<ModalNuevaCita fechaDisplay={fechaDisplay} pacientes={pacientes} nuevaCita={nuevaCita} setNuevaCita={setNuevaCita} guardando={guardando} recuperacionesPaciente={recuperacionesPaciente} cargarRecuperaciones={cargarRecuperaciones} crearCita={crearCita} onCerrar={()=>setModal(false)} SesionSelector={SesionSelector} horas={horas} tiposCita={tiposCita} tiposClase={tiposClase}/>}
      {editandoCita&&<ModalEditarCita editandoCita={editandoCita} setEditandoCita={setEditandoCita} guardando={guardando} guardarEdicionCita={guardarEdicionCita} onCerrar={()=>setEditandoCita(null)} horas={horas} tiposCita={tiposCita} tiposClase={tiposClase} cambiarEstadoCita={cambiarEstadoCita} eliminarCita={eliminarCita}/>}
      {verDatosCita&&<ModalDatosCita verDatosCita={verDatosCita} guardando={guardando} cambiarEstado={cambiarEstado} horas={horas} onCerrar={()=>setVerDatosCita(null)}/>}
      {verEntrenoCita&&<ModalEntrenoCita verEntrenoCita={verEntrenoCita} sesionDetalle={sesionDetalle} sesionesPaciente={sesionesPaciente} loadingSesion={loadingSesion} mostrarSesiones={mostrarSesiones} setMostrarSesiones={setMostrarSesiones} anotaciones={anotaciones} setAnotaciones={setAnotaciones} pesos={pesos} setPesos={setPesos} guardandoAnot={guardandoAnot} guardarAnotacion={guardarAnotacion} asignarSesion={asignarSesion} alertasPaciente={alertasPaciente} onCerrar={()=>setVerEntrenoCita(null)}/>}
      {verAlertasCita&&<ModalAlertasCita verAlertasCita={verAlertasCita} alertasPaciente={alertasPaciente} crearAlerta={crearAlerta} cerrarAlerta={cerrarAlerta} onCerrar={()=>setVerAlertasCita(null)}/>}
      {modalTareas&&<ModalTareas tareas={tareas} perfiles={perfiles} pacientes={pacientes} userId={userId} crearTarea={crearTarea} completarTarea={completarTarea} borrarTarea={borrarTarea} onCerrar={()=>setModalTareas(false)}/>}
    </>
  )
}
// restore
