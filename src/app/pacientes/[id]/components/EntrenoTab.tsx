'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import ModalEditarCita from '@/app/agenda/components/ModalEditarCita'
import ModalEditarSesion from '@/app/entrenamiento/components/ModalEditarSesion'
import EvaluacionEjecucion from './EvaluacionEjecucion'
import DetalleSesion from './DetalleSesion'
import MonedaObjetivo from '@/components/MonedaObjetivo'
import ModalRepartir from './ModalRepartir'
import { Ic } from '@/lib/icons'
import BarraAsignacion from '@/components/BarraAsignacion'
import { encargoDeLaUrl, asignarSesionYVolver, rutaDeAsignacion, type Encargo } from '@/lib/asignarCita'
import { useRouter } from 'next/navigation'
import { horasDeAgenda } from '@/lib/generarHoras'
import { TIPOS_CLASE_FALLBACK, parseTiposClase } from '@/lib/tipos'
import { duplicarSesion as duplicarSesionLib, registrarSesion, modoDeSesion } from '@/lib/sesiones'
import { agrupaPorLinaje, evolucionarPrograma, evolucionarDesde, marcarFija, esVigente, versionDe, linajeDe } from '@/lib/linaje'

export default function EntrenoTab({ pacienteId, nombrePaciente, sesiones, onRefresh }: { pacienteId: string, nombrePaciente?: string, sesiones: any[], onRefresh: () => void }) {
  const [seccion, setSeccion] = useState<'activo'|'sesiones'|'historial'|'ejecucion'>('activo')
  const [citasFuturas, setCitasFuturas] = useState<any[]>([])
  const [sesionesDisp, setSesionesDisp] = useState<any[]>([])
  const [sesionesHistorial, setSesionesHistorial] = useState<any[]>([])
  const [seleccionadas, setSeleccionadas] = useState<string[]>([])
  const [sesionAsignar, setSesionAsignar] = useState('')
  const [guardando, setGuardando] = useState(false)
  const [verSesion, setVerSesion] = useState<any>(null)
  const [editandoCita, setEditandoCita] = useState<any>(null)
  const [tiposClase, setTiposClase] = useState<any[]>(TIPOS_CLASE_FALLBACK)
  const [horas, setHoras] = useState<string[]>([])
  const [sesionEditando, setSesionEditando] = useState<any>(null)
  const [ejerciciosBib, setEjerciciosBib] = useState<any[]>([])
  const [etiquetasBib, setEtiquetasBib] = useState<any[]>([])
  const [objetivosLib, setObjetivosLib] = useState<any[]>([])
  const [sesionDetalle, setSesionDetalle] = useState<any>(null)
  /** Sesión a la que se le están poniendo objetivos, y lo marcado dentro del modal. */
  const [objsDe, setObjsDe] = useState<any>(null)
  const [selObjs, setSelObjs] = useState<string[]>([])
  const [guardandoObjs, setGuardandoObjs] = useState(false)
  /**
   * Si se ha llegado desde el taller a poner la sesión de una cita, el encargo viene en la
   * dirección. En el uso normal esto es null y no cambia nada de la pantalla.
   */
  const [encargo, setEncargo] = useState<Encargo | null>(null)
  const routerAsig = useRouter()
  useEffect(() => {
    const e = encargoDeLaUrl()
    setEncargo(e)
    // Y a la sección de SESIONES. La pestaña abre en "Planificación" por defecto, así que
    // veníamos a elegir una sesión y aterrizábamos en otra pantalla.
    if (e) setSeccion('sesiones')
  }, [])

  async function asignarYVolver(ses: any) {
    if (!encargo) return
    const r = await asignarSesionYVolver(ses, encargo)
    if (!r.ok) { alert('No se ha podido asignar: ' + r.error); return }
    routerAsig.push(encargo.volver)
  }
  const [nEjecuciones, setNEjecuciones] = useState(0)
  const [objPaciente, setObjPaciente] = useState<any[]>([])
  const [soloActivas, setSoloActivas] = useState(false)
  const [asignando, setAsignando] = useState<any>(null)
  const [selAsig, setSelAsig] = useState<string[]>([])
  const [registros, setRegistros] = useState<any[]>([])
  const [filtroHist, setFiltroHist] = useState('')
  const [limHist, setLimHist] = useState(30)
  const [recuperaciones, setRecuperaciones] = useState<any[]>([])
  const [versionesAbiertas, setVersionesAbiertas] = useState<string[]>([])
  // El recibo de la última tanda. Recargar en silencio deja sin saber si reasignó las
  // citas o ninguna, que es justo lo que se quiere comprobar.
  const [reciboTanda, setReciboTanda] = useState<{texto:string, mal:boolean}|null>(null)
  const [repartiendo, setRepartiendo] = useState(false)

  useEffect(() => { cargarDatos() }, [limHist])

  async function cargarDatos() {
    const hoy = new Date().toISOString().split('T')[0]
    const [{ data: c },{ data: s }] = await Promise.all([
      supabase.from('citas').select('*, sesiones:sesion_id(id,nombre,partes)').eq('paciente_id',pacienteId).gte('fecha',hoy).neq('estado','cancelada').order('fecha').order('hora'),
      supabase.from('sesiones').select('id,nombre,descripcion,partes,created_at,evolucion_de,fija, sesiones_objetivos(objetivo_id)').eq('paciente_id',pacienteId).order('created_at',{ascending:false}),
    ])
    setCitasFuturas(c||[]); setSesionesDisp(s||[])
    supabase.from('objetivos').select('id,nombre,imagen_url').eq('activo',true).order('nombre').then(({data})=>setObjetivosLib(data||[]))
    // Estado de los objetivos DE ESTE PACIENTE, para saber qué sesión sigue haciendo
    // falta y cuál ya cumplió su función.
    supabase.from('pacientes_objetivos').select('objetivo_id,logrado').eq('paciente_id',pacienteId)
      .then(({data})=>setObjPaciente(data||[]))
    const { data: aj } = await supabase.from('ajustes').select('clave,valor')
    if (aj) { const map:Record<string,string>={}; aj.forEach((a:any)=>{map[a.clave]=a.valor||''}); setTiposClase(parseTiposClase(map.tipos_clase)); setHoras(horasDeAgenda(map)) }
    const { data: hist } = await supabase.from('citas').select('*, sesiones:sesion_id(id,nombre,descripcion,partes)').eq('paciente_id',pacienteId).lt('fecha',hoy).order('fecha',{ascending:false}).limit(limHist)
    setSesionesHistorial(hist||[])

    // Lo que de verdad se registró en el taller. Se cruza por fecha + sesión para
    // saber qué se hizo en cada cita pasada, no solo qué estaba prescrito.
    const { data: ejec } = await supabase.from('registros_ejercicio')
      .select('fecha,sesion_id,ejercicio_id,ejercicio_nombre,series,comentario')
      .eq('paciente_id',pacienteId)
    setRegistros(ejec||[])

    // Recuperaciones, para decir en cada fila si esa falta se recuperó y para marcar
    // las citas que son la recuperación de otra.
    const { data: recs } = await supabase.from('recuperaciones')
      .select('id,estado,fecha_falta,fecha_limite,cita_falta_id,cita_recuperacion_id')
      .eq('paciente_id',pacienteId)
    setRecuperaciones(recs||[])

    // El contador de Ejecución era un 0 literal. Se cuentan los ejercicios
    // distintos que tienen alguna evaluación, que es lo que muestra la sección.
    const { data: regs } = await supabase.from('registros_ejercicio')
      .select('ejercicio_id,items_evaluados').eq('paciente_id',pacienteId)
    const conEval = new Set((regs||[])
      .filter((r:any)=>r.ejercicio_id && Object.keys(r.items_evaluados||{}).length>0)
      .map((r:any)=>r.ejercicio_id))
    setNEjecuciones(conEval.size)
  }

  /**
   * Asigna una sesión a varias citas. La misma operación se lanza desde dos sitios,
   * porque son dos puntos de partida distintos: en Planificación eliges citas y luego
   * la sesión; desde una sesión eliges a qué citas va. Mismo verbo, distinto orden.
   */
  async function asignar(sesionId: string, ids: string[]) {
    if (!sesionId || ids.length===0) return
    setGuardando(true)
    for (const citaId of ids) await supabase.from('citas').update({sesion_id:sesionId}).eq('id',citaId)
    // Un solo evento con el total: asignar en bloque a 12 citas no son 12 hitos.
    const nom = sesionesDisp.find((s:any)=>s.id===sesionId)?.nombre || 'Sesión'
    await registrarSesion(pacienteId, `Sesión asignada a ${ids.length} cita${ids.length>1?'s':''}: ${nom}`)
    setGuardando(false); cargarDatos(); onRefresh()
  }

  /**
   * Siguiente tanda del programa: una versión nueva de cada sesión que esté en la
   * agenda futura, y esas citas pasan a las versiones nuevas.
   *
   * El aviso dice EXACTAMENTE qué va a pasar antes de que pase, con los nombres y el
   * número de citas. Toca varias sesiones y varias citas de golpe, así que un "¿seguro?"
   * genérico no le da a nadie la información para decir que no.
   */
  async function nuevaTanda() {
    const conSesion = citasFuturas.filter((c:any)=>c.sesion_id)
    const enAgenda = Array.from(new Set(conSesion.map((c:any)=>c.sesion_id)))
      .map((id:any)=>sesionesDisp.find((s:any)=>s.id===id)).filter(Boolean)
    if (enAgenda.length===0) {
      alert('No hay citas futuras con sesión asignada: no hay programa que evolucionar.')
      return
    }
    const versionar = enAgenda.filter((s:any)=>!s.fija)
    const fijas = enAgenda.filter((s:any)=>s.fija)
    if (versionar.length===0) {
      alert('Todas las sesiones del programa están marcadas como fijas: no hay nada que versionar.')
      return
    }
    const nCitas = conSesion.filter((c:any)=>versionar.some((s:any)=>s.id===c.sesion_id)).length

    const ok = confirm(
      `Se crea una tanda nueva de: ${versionar.map((s:any)=>s.nombre).join(', ')}.\n\n`+
      (fijas.length>0 ? `Se quedan como están, por estar marcadas como fijas: ${fijas.map((s:any)=>s.nombre).join(', ')}.\n\n` : '')+
      `Las ${nCitas} citas futuras que las llevan pasan a la tanda nueva, cada una en su mismo día y hora.\n\n`+
      `Las citas pasadas no se tocan: siguen apuntando a la sesión que se hizo ese día.`)
    if (!ok) return

    setGuardando(true)
    const r = await evolucionarPrograma(pacienteId)
    setGuardando(false)
    if (!r.ok) { setReciboTanda({texto:r.error, mal:true}); return }

    // Que reasigne cero citas no es un error de base de datos —nada falla— pero deja el
    // programa a medias: sesiones nuevas que nadie va a entrenar. Hay que decirlo.
    // Las fases son lo único que la tanda NO puede decidir sola: si el paciente ya puede
    // pasar a lo siguiente lo sabes tú, no un número. Se recuerda aquí porque es el
    // momento en que estás decidiendo el programa.
    // Tener fases es TENER FASES, no estar catalogado como "de fase". Esto filtraba por
    // `objetivos.tipo`, y desde que las familias no existen ningún objetivo nuevo lo lleva:
    // el recordatorio había dejado de salir para todos ellos sin que nada avisara.
    const { data: enFases } = await supabase.from('pacientes_objetivos')
      .select('objetivo_id,fase_actual,objetivos!inner(nombre,fases)')
      .eq('paciente_id', pacienteId).eq('logrado', false).gt('objetivos.fases', 0)
    const porAvanzar = (enFases||[]).filter((x:any)=>{
      const o = Array.isArray(x.objetivos) ? x.objetivos[0] : x.objetivos
      return o?.fases && (x.fase_actual||0) < o.fases
    })

    setReciboTanda({
      mal: r.nCitas===0,
      texto: r.nCitas===0
        ? `Se crearon ${r.nuevas.length} sesión${r.nuevas.length>1?'es':''} pero NINGUNA cita cambió a la tanda nueva. Las citas siguen con la anterior.`
        : `${r.nuevas.length} sesión${r.nuevas.length>1?'es':''} nueva${r.nuevas.length>1?'s':''} · ${r.nCitas} cita${r.nCitas>1?'s':''} reasignada${r.nCitas>1?'s':''}`
          + (r.fijas.length>0 ? ` · sin tocar por fijas: ${r.fijas.join(', ')}` : '')
          + (porAvanzar.length>0
              ? ` · Revisa si avanza de fase: ${porAvanzar.map((x:any)=>(Array.isArray(x.objetivos)?x.objetivos[0]:x.objetivos)?.nombre).join(', ')}`
              : ''),
    })
    cargarDatos(); onRefresh()
  }

  /**
   * Siguiente tanda partiendo de una versión concreta, que puede no ser la vigente.
   *
   * El caso: vas por la 6ª, los últimos cambios no cuajaron y quieres retomar desde la
   * 1ª. Sale la 7ª —la séptima que existe— y la 1ª se queda intacta, que es lo que
   * permite volver a hacerlo mañana desde otra.
   */
  async function partirDe(sesion:any) {
    const n = versionDe(sesionesDisp, sesion)
    const ok = confirm(
      `Se crea una tanda nueva de "${sesion.nombre}" con el contenido de la ${n}ª.\n\n`+
      `La ${n}ª no se toca. Las citas futuras que lleven cualquier tanda de esta sesión pasan a la nueva.`)
    if (!ok) return
    setGuardando(true)
    const r = await evolucionarDesde(sesion, pacienteId)
    setGuardando(false)
    if (!r.ok) { alert(r.error); return }
    setSesionDetalle(null); cargarDatos(); onRefresh()
  }

  async function alternarFija(sesion:any) {
    const r = await marcarFija(sesion.id, !sesion.fija)
    if (!r.ok) { alert(r.error); return }
    cargarDatos()
  }

  async function asignarEnBloque() {
    if (!sesionAsignar||seleccionadas.length===0) { alert('Selecciona citas y una sesión'); return }
    await asignar(sesionAsignar, seleccionadas)
    setSeleccionadas([]); setSesionAsignar('')
  }

  /**
   * Deja esta sesión exactamente en las citas marcadas: la pone en las nuevas y la
   * quita de las que se hayan desmarcado.
   *
   * El modal abre con las que ya la tienen premarcadas, así que desmarcar una tiene
   * que quitarla. Si solo añadiera, la casilla diría una cosa y pasaría otra.
   */
  async function sincronizarCitas(sesionId: string, ids: string[]) {
    const tenian = citasFuturas.filter((c:any)=>c.sesion_id===sesionId).map((c:any)=>c.id)
    const anadir = ids.filter(id=>!tenian.includes(id))
    const quitar = tenian.filter(id=>!ids.includes(id))
    if (anadir.length===0 && quitar.length===0) return

    setGuardando(true)
    for (const id of anadir) await supabase.from('citas').update({sesion_id:sesionId}).eq('id',id)
    for (const id of quitar) await supabase.from('citas').update({sesion_id:null}).eq('id',id)

    // Un solo evento con el saldo: retocar una asignación no son diez hitos clínicos.
    const nom = sesionesDisp.find((s:any)=>s.id===sesionId)?.nombre || 'Sesión'
    const partes = []
    if (anadir.length>0) partes.push(`asignada a ${anadir.length} cita${anadir.length>1?'s':''}`)
    if (quitar.length>0) partes.push(`quitada de ${quitar.length}`)
    await registrarSesion(pacienteId, `Sesión ${partes.join(' y ')}: ${nom}`)

    setGuardando(false); cargarDatos(); onRefresh()
  }

  /**
   * Atajos de selección por día de la semana, en el orden en que aparecen las citas.
   * Los usan la lista de Planificación y el modal de asignar: una sola definición
   * para que no acaben comportándose distinto.
   */
  function atajosDe(citas: any[], marcadas: string[]) {
    const porDia = new Map<number,{label:string, ids:string[]}>()
    citas.forEach((c:any)=>{
      const d = new Date(c.fecha+'T12:00:00')
      const dia = d.getDay()
      if (!porDia.has(dia)) {
        const l = d.toLocaleDateString('es-ES',{weekday:'short'}).replace('.','')
        porDia.set(dia, { label: l.charAt(0).toUpperCase()+l.slice(1), ids: [] })
      }
      porDia.get(dia)!.ids.push(c.id)
    })
    const sinSesion = citas.filter((c:any)=>!c.sesiones && !c.sesion_id)
    const lista: {clave:string,label:string,ids:string[],activo:boolean}[] = []
    // Con un solo día, "Lun · 8" y "todas" son lo mismo: no aporta nada.
    if (porDia.size > 1) porDia.forEach((v,k)=>lista.push({ clave:'d'+k, label:v.label, ids:v.ids, activo:false }))
    if (sinSesion.length>0 && sinSesion.length<citas.length) {
      lista.push({ clave:'sin', label:'Sin sesión', ids:sinSesion.map((c:any)=>c.id), activo:false })
    }
    lista.forEach(a=>{ a.activo = a.ids.length>0 && a.ids.every(id=>marcadas.includes(id)) })
    return lista
  }

  async function guardarEdicionCita() {
    if (!editandoCita) return
    setGuardando(true)
    const original = citasFuturas.find((c:any)=>c.id===editandoCita.id)
    await supabase.from('citas').update({fecha:editandoCita.fecha,hora:editandoCita.hora,sala:editandoCita.sala,tipo:editandoCita.tipo,notas:editandoCita.notas}).eq('id',editandoCita.id)
    if (original) {
      const registros:any[]=[]
      if (editandoCita.fecha && original.fecha && editandoCita.fecha!==original.fecha) registros.push({cita_id:editandoCita.id,paciente_id:pacienteId,campo_cambiado:'fecha',valor_anterior:original.fecha,valor_nuevo:editandoCita.fecha})
      const hAnt=(original.hora||'').slice(0,5), hNue=(editandoCita.hora||'').slice(0,5)
      if (hNue && hAnt && hNue!==hAnt) registros.push({cita_id:editandoCita.id,paciente_id:pacienteId,campo_cambiado:'hora',valor_anterior:hAnt,valor_nuevo:hNue})
      if (registros.length>0) await supabase.from('cambios_cita').insert(registros)
    }
    setEditandoCita(null); setGuardando(false); cargarDatos(); onRefresh()
  }

  async function cambiarEstadoCita(cita:any, estado:string) {
    await supabase.from('citas').update({estado}).eq('id',cita.id)
    if (estado==='cancelada') {
      const fechaFalta=new Date(cita.fecha+'T12:00:00')
      const fechaLimite=new Date(fechaFalta); fechaLimite.setDate(fechaLimite.getDate()+30)
      const { data: existing } = await supabase.from('recuperaciones').select('id').eq('cita_falta_id',cita.id).maybeSingle()
      if (!existing) await supabase.from('recuperaciones').insert({paciente_id:cita.paciente_id||pacienteId,cita_falta_id:cita.id,fecha_falta:cita.fecha,fecha_limite:fechaLimite.toISOString().split('T')[0],estado:'pendiente'})
    }
    if (estado==='falta') await supabase.from('recuperaciones').delete().eq('cita_falta_id',cita.id).eq('estado','pendiente')
    if (estado==='realizada'||estado==='programada') await supabase.from('recuperaciones').delete().eq('cita_falta_id',cita.id).eq('estado','pendiente')
    setEditandoCita(null); cargarDatos(); onRefresh()
  }

  async function eliminarCita(cita:any) {
    if (!confirm('Al eliminar esta cita NO se guardará ningún dato (ni realizada, ni falta, ni recuperación). Úsalo solo para errores.\n\n¿Eliminar la cita?')) return
    await supabase.from('recuperaciones').delete().eq('cita_falta_id',cita.id)
    await supabase.from('citas').delete().eq('id',cita.id)
    setEditandoCita(null); cargarDatos(); onRefresh()
  }

  function toggleCita(id: string) { setSeleccionadas(prev=>prev.includes(id)?prev.filter(x=>x!==id):[...prev,id]) }

  // Si el grupo entero ya está marcado, lo quita; si no, lo añade a lo que haya.
  // Sumar en vez de reemplazar permite marcar lunes y jueves a la vez cuando en
  // un tramo toca lo mismo.
  function alternarGrupo(ids: string[]) {
    setSeleccionadas(prev => {
      const todos = ids.every(id=>prev.includes(id))
      return todos ? prev.filter(id=>!ids.includes(id)) : Array.from(new Set([...prev, ...ids]))
    })
  }

  // Agrupa por mes conservando el orden de entrada, igual que el historial clínico.
  // Con dos meses por delante la lista plana no dice dónde acaba uno y empieza otro.
  function porMes(lista:any[]) {
    const grupos: {mes:string, citas:any[]}[] = []
    lista.forEach(c=>{
      const mes = new Date(c.fecha+'T12:00:00').toLocaleDateString('es-ES',{month:'long',year:'numeric'})
      const ult = grupos[grupos.length-1]
      if (ult && ult.mes===mes) ult.citas.push(c); else grupos.push({mes, citas:[c]})
    })
    return grupos
  }

  async function crearSesionNueva() {
    const fechaTxt = new Date().toLocaleDateString('es-ES',{day:'numeric',month:'short'})
    const nombreAuto = `Sesión ${nombrePaciente||''} · ${fechaTxt}`.replace('  ',' ').trim()
    const { data, error } = await supabase.from('sesiones').insert({ paciente_id:pacienteId, nombre:nombreAuto, descripcion:'', partes:[{nombre:'Parte 1',ejercicios:[]}], estado:'lista' }).select().single()
    if (error || !data) { alert('Error al crear la sesión'); return }
    await registrarSesion(pacienteId, `Sesión creada: ${data.nombre}`)
    await cargarDatos()
    abrirEditor(data)
  }

  async function duplicar(s: any) {
    const r = await duplicarSesionLib(s, pacienteId)
    if (!r.ok) alert(r.error)
    cargarDatos()
  }

  async function eliminarSesion(id: string) {
    if (!confirm('¿Eliminar esta sesión?')) return
    await supabase.from('sesiones').delete().eq('id',id); cargarDatos()
  }

  // La biblioteca de ejercicios solo la necesita el editor de sesión. Traerla en cada
  // montaje de la pestaña era descargarla entera para no usarla casi nunca.
  async function abrirEditor(sesion:any) {
    if (ejerciciosBib.length===0) {
      const [{ data: ejs },{ data: ets }] = await Promise.all([
        supabase.from('ejercicios').select('*').order('nombre'),
        supabase.from('etiquetas').select('*').order('categoria').order('nombre'),
      ])
      setEjerciciosBib(ejs||[]); setEtiquetasBib(ets||[])
    }
    setSesionEditando(sesion)
  }

  /**
   * Para qué sirve una sesión HOY, según los objetivos del paciente:
   *
   *   'activa'   sirve para algo que aún está abierto -> se resalta
   *   'cumplida' todos sus objetivos ya están logrados -> se apaga
   *   'neutra'   no tiene objetivos, o los que tiene no son de este paciente
   *
   * La tercera es la que evita el error fácil: una sesión sin objetivos no está
   * cumplida, simplemente no lo sabemos, y apagarla escondería trabajo válido. Lo
   * mismo con objetivos de la biblioteca que este paciente nunca abrió.
   */
  function estadoSesion(s:any): 'activa'|'cumplida'|'neutra' {
    const ids = (s.sesiones_objetivos||[]).map((r:any)=>r.objetivo_id)
    if (ids.length===0) return 'neutra'
    const suyos = ids.map((id:string)=>objPaciente.find((o:any)=>o.objetivo_id===id)).filter(Boolean)
    if (suyos.length===0) return 'neutra'
    return suyos.some((o:any)=>!o.logrado) ? 'activa' : 'cumplida'
  }

  // Los primeros ejercicios de la sesión, en orden, para la tira de miniaturas.
  function fotosDeSesion(s:any) {
    const todos = (s.partes||[]).flatMap((p:any)=>p.ejercicios||[])
    return todos.slice(0,5)
  }

  /**
   * Lo que se anotó en el taller para esa cita. Se cruza por fecha y sesión: el
   * registro no guarda a qué cita pertenece, pero un paciente no repite la misma
   * sesión dos veces el mismo día.
   */
  function registrosDe(cita:any) {
    if (!cita?.sesion_id || !cita?.fecha) return []
    return registros.filter((r:any)=>r.sesion_id===cita.sesion_id && r.fecha===cita.fecha)
  }

  /**
   * Qué papel juega esta cita en una recuperación, si es que juega alguno.
   * Una cita puede ser la que se perdió o la que sirve para recuperarla, y son dos
   * cosas distintas que hasta ahora no se veían en ningún sitio de esta lista.
   */
  function recuperacionDe(cita:any) {
    const perdida = recuperaciones.find((r:any)=>r.cita_falta_id===cita.id)
    if (perdida) {
      if (perdida.estado==='recuperada') return { txt:'Recuperada', clase:'pill-o on' }
      const vencida = perdida.fecha_limite && perdida.fecha_limite < new Date().toISOString().split('T')[0]
      return vencida
        ? { txt:'Sin recuperar · plazo vencido', clase:'pill-r' }
        : { txt:`Por recuperar antes del ${fmtCorto(perdida.fecha_limite)}`, clase:'pill-a' }
    }
    const recupera = recuperaciones.find((r:any)=>r.cita_recuperacion_id===cita.id)
    if (recupera) return { txt:`Recupera la del ${fmtCorto(recupera.fecha_falta)}`, clase:'pill-o on' }
    return null
  }

  const fmtCorto = (f:string) => f
    ? new Date(f+'T12:00:00').toLocaleDateString('es-ES',{day:'numeric',month:'short'})
    : ''

  function objsDeSesion(s:any) {
    const ids = (s.sesiones_objetivos||[]).map((r:any)=>r.objetivo_id)
    return (objetivosLib||[]).filter((o:any)=>ids.includes(o.id))
  }

  /**
   * Los objetivos que este paciente tiene abiertos, con su ficha de la biblioteca.
   *
   * SOLO LOS SUYOS, y solo los abiertos. La sesión se monta para trabajar lo que le sale
   * de sus tests: ofrecer el catálogo entero sería volver a elegir aquí lo que ya se
   * decidió al valorarlo, y encima dejaría sesiones apuntando a objetivos que este
   * paciente nunca abrió — que es justo lo que hace que `estadoSesion` no sepa decir si
   * una sesión sigue haciendo falta.
   */
  const objsDelPaciente = (objPaciente||[])
    .filter((r:any)=>!r.logrado)
    .map((r:any)=>(objetivosLib||[]).find((o:any)=>o.id===r.objetivo_id))
    .filter(Boolean)

  function abrirObjsDe(s:any) {
    setObjsDe(s)
    setSelObjs((s.sesiones_objetivos||[]).map((r:any)=>r.objetivo_id))
  }

  /** Escribe solo la diferencia: lo que se ha marcado y lo que se ha desmarcado. */
  async function guardarObjsSesion() {
    if (!objsDe) return
    setGuardandoObjs(true)
    const antes: string[] = (objsDe.sesiones_objetivos||[]).map((r:any)=>r.objetivo_id)
    const anadir = selObjs.filter(id=>!antes.includes(id))
    const quitar = antes.filter(id=>!selObjs.includes(id))

    if (anadir.length>0) {
      const { error } = await supabase.from('sesiones_objetivos')
        .insert(anadir.map(objetivo_id=>({ sesion_id: objsDe.id, objetivo_id })))
      if (error) { setGuardandoObjs(false); alert('No se han podido añadir: '+error.message); return }
    }
    if (quitar.length>0) {
      const { error } = await supabase.from('sesiones_objetivos')
        .delete().eq('sesion_id', objsDe.id).in('objetivo_id', quitar)
      if (error) { setGuardandoObjs(false); alert('No se han podido quitar: '+error.message); return }
    }
    setGuardandoObjs(false); setObjsDe(null); setSelObjs([])
    cargarDatos()
  }

  return (
    <div>
      {/* Mismo conmutador que en Salud (.vista-sw): era el cuarto estilo de pestañas
          de la app, hecho a mano y con tipografía de 11px. */}
      <div className="vista-sw">
        {([['activo','calendario','Planificación',citasFuturas.length],['sesiones','lista','Sesiones',sesionesDisp.length],['historial','carpeta','Historial',sesionesHistorial.length],['ejecucion','ok','Ejecución',nEjecuciones]] as const).map(([k,ic,l,n])=>(
          <button key={k} className={`vista-b ${seccion===k?'on':''}`} onClick={()=>setSeccion(k)}>
            <Ic name={ic} size={13}/> {l}
            <span className="cnt">{n}</span>
          </button>
        ))}
      </div>

      {seccion==='activo'&&(()=>{
        const total=citasFuturas.length
        const conSes=citasFuturas.filter(c=>c.sesiones).length
        const pct=total>0?Math.round((conSes/total)*100):0
        const sinSesion=citasFuturas.filter(c=>!c.sesiones)

        const atajos = atajosDe(citasFuturas, seleccionadas)

        return (
        <div className="panel">
          <div className="sec">
            <div className="sec-h">
              <span className="sh-l">
                <span className="ct-l"><Ic name="calendario" size={13}/> Citas por delante</span>
                {total>0 && <span className="sh-r">{conSes} de {total} con sesión · {pct}%</span>}
              </span>
              {/* Atajos de selección, a la derecha del todo: pegados al título quedaban
                  justo debajo del conmutador de secciones y las dos tiras de pastillas
                  se leían como una sola. Por día de la semana porque es como se reparte
                  el trabajo: si los lunes toca fuerza y los jueves movilidad, se asigna
                  cada grupo por separado. */}
              {atajos.length>0 && (
                <span style={{display:'inline-flex',gap:5,flexWrap:'wrap'}}>
                  {atajos.map(a=>(
                    <button key={a.clave} className={`chip-sel ${a.activo?'on':''}`}
                      title={a.activo?'Quitar estas citas de la selección':'Añadir estas citas a la selección'}
                      onClick={()=>alternarGrupo(a.ids)}>
                      {a.label} · {a.ids.length}
                    </button>
                  ))}
                </span>
              )}
            </div>
            {total>0 && (
              <div style={{height:6,background:'var(--bm)',borderRadius:99,overflow:'hidden',marginBottom:12}}>
                <div style={{height:'100%',background:'var(--g)',borderRadius:99,width:pct+'%',transition:'width .3s'}}/>
              </div>
            )}
            {seleccionadas.length>0&&(
              <div style={{background:'var(--gl)',border:'1px solid var(--gm)',borderRadius:'var(--r)',padding:'10px 13px',marginBottom:12,display:'flex',alignItems:'center',gap:10,flexWrap:'wrap'}}>
                <span style={{fontSize:13,color:'var(--n)'}}>{seleccionadas.length} cita{seleccionadas.length>1?'s':''} seleccionada{seleccionadas.length>1?'s':''}</span>
                <select className="input" style={{flex:1,minWidth:200}} value={sesionAsignar} onChange={e=>setSesionAsignar(e.target.value)}>
                  <option value="">Seleccionar sesión…</option>
                  {sesionesDisp.map(s=><option key={s.id} value={s.id}>{s.nombre}</option>)}
                </select>
                <button className="btn btn-p btn-sm" onClick={asignarEnBloque} disabled={guardando}>
                  {guardando?'Asignando…':'Asignar'}
                </button>
                <button className="btn btn-t btn-sm" onClick={()=>setSeleccionadas([])}>Quitar selección</button>
              </div>
            )}
            {total===0&&<div className="muted">Sin citas futuras programadas</div>}
            {porMes(citasFuturas).map(g=>(
              <div key={g.mes}>
                <div className="sep-mes">{g.mes}</div>
                {g.citas.map(c=>{
                  const sel=seleccionadas.includes(c.id); const tieneSesion=!!c.sesiones
                  const fecha=new Date(c.fecha+'T12:00:00').toLocaleDateString('es-ES',{weekday:'short',day:'numeric',month:'short'})
                  return (
                    <div key={c.id} onClick={()=>toggleCita(c.id)}
                      className={`fila-p fila-sel ${sel?'on':''}`}
                      style={{borderLeftColor:tieneSesion?'var(--g)':'var(--bd)'}}>
                      <span className={`chk ${sel?'on':''}`}>{sel&&<Ic name="check" size={12}/>}</span>
                      <div style={{flex:1}}>
                        <div style={{fontSize:13,color:'var(--n)'}}>{fecha} · {c.hora?.slice(0,5)} · Sala {c.sala}</div>
                        {tieneSesion?(
                          <div style={{display:'flex',alignItems:'center',gap:4,marginTop:1}}>
                            <span style={{fontSize:12,color:'var(--gd)',display:'inline-flex',alignItems:'center',gap:4}}><Ic name="valoracion" size={12}/> {c.sesiones.nombre}</span>
                            <button title="Quitar la sesión de esta cita" className="fila-x" style={{opacity:1}}
                              onClick={e=>{e.stopPropagation();supabase.from('citas').update({sesion_id:null}).eq('id',c.id).then(()=>cargarDatos())}}>
                              <Ic name="cerrar" size={12}/>
                            </button>
                          </div>
                        ):<div style={{fontSize:12,color:'var(--gr)',marginTop:1}}>Sin sesión asignada</div>}
                      </div>
                      <button title="Editar la cita" className="btn btn-t btn-sm" style={{flexShrink:0}}
                        onClick={e=>{e.stopPropagation();setEditandoCita({...c,paciente_id:pacienteId})}}>
                        <Ic name="editar" size={13}/>
                      </button>
                    </div>
                  )
                })}
              </div>
            ))}
          </div>
        </div>
        )
      })()}

      {seccion==='sesiones'&&(
        <div className="panel">
          <div className="sec">
            <div className="sec-h">
              <span className="sh-l">
                <span className="ct-l"><Ic name="lista" size={13}/> Sesiones del paciente</span>
                <button className="btn btn-s btn-sm" onClick={()=>routerAsig.push(rutaDeAsignacion('biblioteca', {
                  pacienteId, etiqueta: nombrePaciente || 'este paciente',
                  volver: `/pacientes/${pacienteId}?tab=entreno`,
                }))}>Traer de la biblioteca</button>
                <button className="btn btn-p btn-sm" onClick={crearSesionNueva}>+ Nueva sesión</button>
                {/* Solo tiene sentido si hay programa en marcha: sin citas futuras con
                    sesión, no hay nada de lo que hacer una versión siguiente. */}
                {citasFuturas.length>0 && sesionesDisp.length>0 && (
                  <button className="btn btn-sm" onClick={()=>setRepartiendo(true)} disabled={guardando}
                    title="Coloca las sesiones en las citas futuras siguiendo una rotación">
                    <Ic name="calendario" size={12}/> Repartir en las citas
                  </button>
                )}
                {citasFuturas.some((c:any)=>c.sesion_id) && (
                  <button className="btn btn-sm" onClick={nuevaTanda} disabled={guardando}
                    title="Crea una versión nueva de cada sesión de la agenda futura y reasigna esas citas">
                    <Ic name="cambio" size={12}/> Nueva tanda
                  </button>
                )}
              </span>
              {/* Las cumplidas se apagan pero siguen ahí, porque son el historial de lo
                  que funcionó. Este filtro es para cuando estorban. */}
              {sesionesDisp.some(s=>estadoSesion(s)==='cumplida') && (
                <button className={`chip-sel ${soloActivas?'on':''}`} onClick={()=>setSoloActivas(v=>!v)}>
                  Ocultar las de objetivos logrados
                </button>
              )}
            </div>
            {reciboTanda && (
              <div className="fila-p" style={{borderLeftColor:reciboTanda.mal?'var(--amb)':'var(--g)',marginBottom:12,display:'flex',alignItems:'flex-start',gap:8}}>
                <span style={{flex:1,fontSize:13,color:'var(--n)',lineHeight:1.5}}>{reciboTanda.texto}</span>
                <button onClick={()=>setReciboTanda(null)} aria-label="Cerrar"
                  style={{background:'none',border:'none',cursor:'pointer',color:'var(--gr)',flexShrink:0}}>
                  <Ic name="cerrar" size={13}/>
                </button>
              </div>
            )}
            {encargo && <BarraAsignacion encargo={encargo}/>}
            {sesionesDisp.length===0?<div className="muted">No hay sesiones creadas.</div>:(
              <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(250px,1fr))',gap:10}}>
                {/* Agrupadas por linaje: se ve la versión vigente de cada sesión y las
                    anteriores se despliegan desde ella. Sin esto, a los tres meses hay
                    ocho tarjetas llamadas "Empujes" y ninguna dice cuál manda. */}
                {agrupaPorLinaje(sesionesDisp)
                  .filter(l=>!soloActivas || estadoSesion(l.vigente)!=='cumplida')
                  .map(({vigente:s, anteriores, version})=>{
                  const citasAsignadas=citasFuturas.filter(c=>c.sesion_id===s.id); const asignada=citasAsignadas.length>0
                  const abierta=versionesAbiertas.includes(s.id)
                  const nEj=(s.partes||[]).reduce((a:number,p:any)=>a+(p.ejercicios||[]).length,0); const nP=(s.partes||[]).length
                  return (
                    <div key={s.id} onClick={()=>setSesionDetalle(s)}
                      className={`tarj-s est-${estadoSesion(s)}`}
                      title={estadoSesion(s)==='cumplida'
                        ? 'Sus objetivos ya están logrados'
                        : estadoSesion(s)==='activa' ? 'Trabaja objetivos aún abiertos' : undefined}>
                      {/* Las fotos son lo único que distingue una sesión de otra de un
                          vistazo: los nombres se autogeneran y "2 partes · 8 ejercicios"
                          es inventario, no contenido. */}
                      {fotosDeSesion(s).length>0 && (
                        <div className="tira-ej">
                          {fotosDeSesion(s).map((f:any,i:number)=>(
                            f.imagen_url
                              ? <img key={i} src={f.imagen_url} alt={f.nombre} title={f.nombre}/>
                              : <span key={i} className="sin" title={f.nombre}><Ic name="fuerza" size={16}/></span>
                          ))}
                          {nEj>fotosDeSesion(s).length && (
                            <span className="mas">+{nEj-fotosDeSesion(s).length}</span>
                          )}
                        </div>
                      )}
                      {encargo && (
                        <button className="btn btn-p btn-sm" style={{width:'100%',marginBottom:7,fontSize:11}}
                          onClick={e=>{e.stopPropagation();asignarYVolver(s)}}>
                          Traer esta y volver
                        </button>
                      )}
                      <div style={{display:'flex',alignItems:'flex-start',gap:7}}>
                        <div style={{flex:1,minWidth:0}}>
                          <div style={{fontSize:13,color:'var(--n)'}}>{s.nombre}</div>
                          {s.descripcion&&<div style={{fontSize:12,color:'var(--gr)',marginTop:2,lineHeight:1.4}}>{s.descripcion.slice(0,70)}{s.descripcion.length>70?'…':''}</div>}
                        </div>
                        <span className={`pill ${asignada?'pill-o on':'pill-soft'}`} style={{flexShrink:0}}>
                          {asignada?`${citasAsignadas.length} cita${citasAsignadas.length>1?'s':''}`:'Sin asignar'}
                        </span>
                      </div>
                      <div style={{display:'flex',gap:5,flexWrap:'wrap',marginTop:8,alignItems:'center'}}>
                        {/* Calculado de las partes, nunca guardado en la sesión. */}
                        {nEj>0 && <span className="pill pill-o on">{modoDeSesion(s.partes).nombre}</span>}
                        <span className="pill pill-soft">{nEj} {nEj===1?'ejercicio':'ejercicios'}</span>
                        {/* "Tanda" y no "versión": un número junto al nombre se lee como
                            un nivel, y que suba no dice que haya progresado, dice que le
                            montaste una programación nueva. Se cuenta del linaje. */}
                        {version>1 && (
                          <button className="pill pill-soft" onClick={e=>{e.stopPropagation();setVersionesAbiertas(v=>abierta?v.filter(x=>x!==s.id):[...v,s.id])}}
                            title={`${anteriores.length} tanda${anteriores.length>1?'s':''} anterior${anteriores.length>1?'es':''}`}
                            style={{border:'none',cursor:'pointer',display:'inline-flex',alignItems:'center',gap:3}}>
                            {version}ª tanda <Ic name={abierta?'arriba':'abajo'} size={10}/>
                          </button>
                        )}
                        {/* Fija = fuera de las tandas nuevas. Se marca la excepción, no
                            la norma: lo habitual es que todo evolucione. */}
                        <button className={`pill ${s.fija?'pill-o on':'pill-soft'}`}
                          onClick={e=>{e.stopPropagation();alternarFija(s)}}
                          title={s.fija
                            ? 'Fija: no entra en las tandas nuevas. Pulsa para que vuelva a evolucionar.'
                            : 'Pulsa para fijarla: se quedará fuera de las tandas nuevas.'}
                          style={{border:'none',cursor:'pointer',display:'inline-flex',alignItems:'center',gap:3,opacity:s.fija?1:.5}}>
                          <Ic name="pin" size={10}/> {s.fija?'Fija':''}
                        </button>
                        {/* Con diez sesiones acumuladas, cuál es la reciente importa más
                            que cuántas partes tiene. */}
                        {s.created_at && (
                          <span style={{fontSize:12,color:'var(--gr)',marginLeft:'auto'}}>
                            {new Date(s.created_at).toLocaleDateString('es-ES',{day:'numeric',month:'short'})}
                          </span>
                        )}
                      </div>
                      {/* QUÉ TRABAJA ESTA SESIÓN, y el botón para decirlo.
                          Es el eslabón que faltaba en la cadena: el test abre objetivos, la
                          sesión los trabaja, y al repetir el test se vuelve a valorar. Sin
                          poder engancharlos desde aquí había que entrar a editar la sesión
                          para algo que se decide mirando la ficha. */}
                      <div style={{display:'flex',gap:4,flexWrap:'wrap',marginTop:6,alignItems:'center'}}>
                        {objsDeSesion(s).map((o:any)=>(
                          <MonedaObjetivo key={o.id} objetivo={o} tam="mini"/>
                        ))}
                        <button className="btn btn-t btn-sm" style={{fontSize:11}}
                          onClick={e=>{e.stopPropagation();abrirObjsDe(s)}}
                          title="Elegir qué objetivos del paciente trabaja esta sesión">
                          <Ic name="mas" size={11}/> Objetivos
                        </button>
                      </div>
                      {/* Las tandas anteriores no se borran: son lo que se hizo, y las
                          citas pasadas siguen apuntando a ellas. Se consultan, y desde
                          cada una se puede arrancar la siguiente. */}
                      {abierta && anteriores.length>0 && (
                        <div style={{marginTop:8,paddingTop:8,borderTop:'1px solid var(--bl)',display:'grid',gap:3}}>
                          {anteriores.map((a:any,i:number)=>(
                            <button key={a.id} onClick={e=>{e.stopPropagation();setSesionDetalle(a)}}
                              style={{display:'flex',alignItems:'center',gap:6,background:'none',border:'none',padding:'2px 0',cursor:'pointer',textAlign:'left',fontSize:12,color:'var(--gr)'}}>
                              <span className="pill pill-soft" style={{flexShrink:0}}>{version-1-i}ª</span>
                              <span style={{flex:1,minWidth:0,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{a.nombre}</span>
                              {a.created_at && (
                                <span style={{flexShrink:0}}>{new Date(a.created_at).toLocaleDateString('es-ES',{day:'numeric',month:'short'})}</span>
                              )}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {seccion==='historial'&&(()=>{
        const nRe = sesionesHistorial.filter((c:any)=>c.estado==='realizada').length
        const nFa = sesionesHistorial.filter((c:any)=>c.estado==='falta').length
        const nCa = sesionesHistorial.filter((c:any)=>c.estado==='cancelada').length
        const filtros = [
          {k:'realizada', l:'Realizadas', n:nRe},
          {k:'falta', l:'Faltas', n:nFa},
          {k:'cancelada', l:'Canceladas', n:nCa},
        ].filter(f=>f.n>0)
        // Las canceladas quedan fuera por defecto: una cita anulada con antelación no
        // es historial de entrenamiento, no se entrenó nada. Se llega a ellas por su chip.
        const lista = filtroHist
          ? sesionesHistorial.filter((c:any)=>c.estado===filtroHist)
          : sesionesHistorial.filter((c:any)=>c.estado!=='cancelada')
        return (
        <div className="panel">
          <div className="sec">
            <div className="sec-h">
              <span className="sh-l">
                <span className="ct-l"><Ic name="carpeta" size={13}/> Citas pasadas</span>
                {/* Lo primero que se mira y había que contarlo a ojo. */}
                {sesionesHistorial.length>0 && (
                  <span className="sh-r">
                    {nRe} realizada{nRe===1?'':'s'}{nFa>0?` · ${nFa} falta${nFa===1?'':'s'}`:''}{nCa>0?` · ${nCa} cancelada${nCa===1?'':'s'}`:''}
                  </span>
                )}
              </span>
              {filtros.length>1 && (
                <span style={{display:'inline-flex',gap:5,flexWrap:'wrap'}}>
                  {filtros.map(f=>(
                    <button key={f.k} className={`chip-sel ${filtroHist===f.k?'on':''}`}
                      onClick={()=>setFiltroHist(filtroHist===f.k?'':f.k)}>
                      {f.l} · {f.n}
                    </button>
                  ))}
                </span>
              )}
            </div>
            {sesionesHistorial.length===0&&<div className="muted">Sin historial aún</div>}
            {sesionesHistorial.length>0 && lista.length===0 && (
              <div className="muted">
                {filtroHist ? 'Ninguna cita con ese estado.' : 'Solo hay citas canceladas. Están en su filtro.'}
              </div>
            )}
            {porMes(lista).map(g=>(
              <div key={g.mes}>
                <div className="sep-mes">{g.mes}</div>
                {g.citas.map((c:any)=>{
                  const est=c.estado==='realizada'?{cl:'pill-o on',txt:'Realizada',borde:'var(--g)'}
                    :c.estado==='cancelada'?{cl:'pill-soft',txt:'Cancelada',borde:'var(--bd)'}
                    :{cl:'pill-r',txt:'Falta',borde:'var(--red)'}
                  const tieneSes=!!c.sesiones
                  const reg=registrosDe(c)
                  return (
                    <div key={c.id} className={`fila-p ${tieneSes?'test-clic':''}`} style={{borderLeftColor:est.borde}}
                      onClick={()=>tieneSes&&setVerSesion({sesion:c.sesiones, ejecutado:reg})}>
                      <div style={{flex:1}}>
                        {tieneSes
                          ? <div style={{fontSize:13,color:'var(--n)',display:'flex',alignItems:'center',gap:5}}><Ic name="valoracion" size={12}/> {c.sesiones.nombre}</div>
                          : <div style={{fontSize:13,color:'var(--gr)'}}>Sin sesión</div>}
                        <div style={{fontSize:12,color:'var(--gr)',marginTop:1}}>
                          {new Date(c.fecha+'T12:00:00').toLocaleDateString('es-ES',{weekday:'short',day:'numeric',month:'short'})} · {c.hora?.slice(0,5)} · Sala {c.sala}
                        </div>
                      </div>
                      {/* El papel en una recuperación: si esta falta se recuperó o si
                          esta cita es la recuperación de otra. El dato ya estaba en la
                          base y no se veía donde se mira la falta. */}
                      {(() => {
                        const r = recuperacionDe(c)
                        return r ? <span className={`pill ${r.clase}`} style={{flexShrink:0}}>{r.txt}</span> : null
                      })()}
                      {/* Que se registró trabajo ese día es más informativo que el
                          estado de la cita: "realizada" solo dice que vino. */}
                      {reg.length>0 && (
                        <span className="pill pill-o on" style={{flexShrink:0,display:'inline-flex',alignItems:'center',gap:4}}
                          title="Series y pesos anotados desde el taller. Pulsa para verlos.">
                          <Ic name="check" size={10}/> {reg.length} ejercicio{reg.length>1?'s':''} anotado{reg.length>1?'s':''}
                        </span>
                      )}
                      <span className={`pill ${est.cl}`} style={{flexShrink:0}}>{est.txt}</span>
                    </div>
                  )
                })}
              </div>
            ))}

            {/* Antes cortaba a 30 y no había forma de ver más: con dos clases por
                semana eso son menos de cuatro meses de historial accesible. */}
            {sesionesHistorial.length>=limHist && (
              <button className="btn btn-s btn-sm" style={{marginTop:10}}
                onClick={()=>setLimHist(n=>n+60)}>Ver más citas</button>
            )}
          </div>
        </div>
        )
      })()}

      {/* Asignar una sesión a varias citas, partiendo de la sesión. Es el mismo verbo
          que en Planificación pero por el otro lado: allí eliges citas y luego sesión.
          Cada uno encaja con un punto de partida distinto. */}
      {asignando && (
        <div className="modal-bg" onClick={e=>{if(e.target===e.currentTarget)setAsignando(null)}}>
          <div className="modal" style={{width:520,maxHeight:'86vh',display:'flex',flexDirection:'column'}}>
            <div className="modal-title">
              Asignar a citas
              <button className="modal-close" onClick={()=>setAsignando(null)} aria-label="Cerrar"><Ic name="cerrar" size={14}/></button>
            </div>
            <div style={{fontSize:13,color:'var(--gr)',marginBottom:10}}>{asignando.nombre}</div>

            {citasFuturas.length===0 ? <div className="muted">Este paciente no tiene citas por delante.</div> : (<>
              {atajosDe(citasFuturas, selAsig).length>0 && (
                <div style={{display:'flex',gap:5,flexWrap:'wrap',marginBottom:10}}>
                  {atajosDe(citasFuturas, selAsig).map(a=>(
                    <button key={a.clave} className={`chip-sel ${a.activo?'on':''}`}
                      onClick={()=>setSelAsig(prev=>{
                        const todos = a.ids.every(id=>prev.includes(id))
                        return todos ? prev.filter(id=>!a.ids.includes(id)) : Array.from(new Set([...prev,...a.ids]))
                      })}>
                      {a.label} · {a.ids.length}
                    </button>
                  ))}
                </div>
              )}

              <div style={{flex:1,overflowY:'auto',marginBottom:12}}>
                {porMes(citasFuturas).map(g=>(
                  <div key={g.mes}>
                    <div className="sep-mes">{g.mes}</div>
                    {g.citas.map((c:any)=>{
                      const sel = selAsig.includes(c.id)
                      const yaEsta = c.sesion_id===asignando.id
                      const otra = c.sesiones && !yaEsta
                      return (
                        <div key={c.id} className={`fila-p fila-sel ${sel?'on':''}`}
                          style={{borderLeftColor:yaEsta?'var(--g)':'var(--bd)'}}
                          onClick={()=>setSelAsig(prev=>prev.includes(c.id)?prev.filter(x=>x!==c.id):[...prev,c.id])}>
                          <span className={`chk ${sel?'on':''}`}>{sel&&<Ic name="check" size={12}/>}</span>
                          <div style={{flex:1}}>
                            <div style={{fontSize:13,color:'var(--n)'}}>
                              {new Date(c.fecha+'T12:00:00').toLocaleDateString('es-ES',{weekday:'short',day:'numeric',month:'short'})} · {c.hora?.slice(0,5)} · Sala {c.sala}
                            </div>
                            {/* Avisar de lo que se va a pisar: una cita solo tiene una sesión. */}
                            <div style={{fontSize:12,color:otra?'#8A6410':'var(--gr)',marginTop:1}}>
                              {yaEsta ? 'Ya tiene esta sesión' : otra ? `Sustituye a ${c.sesiones.nombre}` : 'Sin sesión asignada'}
                            </div>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                ))}
              </div>

              <div style={{display:'flex',gap:7,alignItems:'center'}}>
                <span style={{fontSize:13,color:'var(--gr)',flex:1}}>
                  {selAsig.length===0 ? 'En ninguna cita' : `En ${selAsig.length} cita${selAsig.length>1?'s':''}`}
                </span>
                <button className="btn btn-t btn-sm" onClick={()=>setAsignando(null)}>Cancelar</button>
                <button className="btn btn-p" disabled={guardando}
                  onClick={async()=>{ await sincronizarCitas(asignando.id, selAsig); setSelAsig([]); setAsignando(null) }}>
                  {guardando?'Guardando…':'Guardar'}
                </button>
              </div>
            </>)}
          </div>
        </div>
      )}

      {/* Solo se edita la tanda vigente. Editar una vieja reescribiría lo que dicen las
          citas ya pasadas, y con ellas el resumen de trabajo por zonas: junio pasaría a
          contar series que nunca se hicieron. Para avanzar desde una antigua está
          "Partir de esta", que la deja intacta y crea la siguiente del linaje. */}
      {sesionDetalle && (
        <DetalleSesion
          sesion={sesionDetalle}
          objetivos={objsDeSesion(sesionDetalle)}
          nCitas={citasFuturas.filter((c:any)=>c.sesion_id===sesionDetalle.id).length}
          // Con un encargo, la cita YA SE SABE. Abrir el selector de citas obligaría a
          // buscarla otra vez en la lista, y deja marcar otra distinta de la que se venía
          // a resolver. Se asigna y se vuelve.
          onAsignar={encargo
            ? ()=>{ const x=sesionDetalle; setSesionDetalle(null); asignarYVolver(x) }
            : ()=>{
              // Vienen premarcadas las que ya la tienen: así se ve el estado actual y
              // desmarcar una la quita, en vez de tener que ir a Planificación.
              setSelAsig(citasFuturas.filter((c:any)=>c.sesion_id===sesionDetalle.id).map((c:any)=>c.id))
              setAsignando(sesionDetalle); setSesionDetalle(null)
            }}
          textoAsignar={encargo ? `Traer para ${encargo.etiqueta || 'el paciente'}` : undefined}
          onCerrar={()=>setSesionDetalle(null)}
          onEditar={esVigente(sesionesDisp, sesionDetalle)
            ? ()=>{const x=sesionDetalle;setSesionDetalle(null);abrirEditor(x)}
            : undefined}
          onPartir={()=>partirDe(sesionDetalle)}
          textoPartir={`Partir de esta · sale la ${linajeDe(sesionesDisp, sesionDetalle).length+1}ª`}
          onDuplicar={()=>{duplicar(sesionDetalle);setSesionDetalle(null)}}
          onEliminar={()=>{eliminarSesion(sesionDetalle.id);setSesionDetalle(null)}}
        />
      )}

      {/* Solo se ofrecen las vigentes: repartir una tanda antigua sería prescribir el
          programa viejo sin enterarse. */}
      {repartiendo && (
        <ModalRepartir
          pacienteId={pacienteId}
          sesiones={agrupaPorLinaje(sesionesDisp).map(l=>l.vigente)}
          citas={citasFuturas}
          onCerrar={()=>setRepartiendo(false)}
          onHecho={(n)=>{
            setRepartiendo(false)
            setReciboTanda({texto:`${n} cita${n===1?'':'s'} asignada${n===1?'':'s'}.`, mal:n===0})
            cargarDatos(); onRefresh()
          }}
        />
      )}

      {/* Desde Historial se consulta el pasado: mismo detalle, sin acciones, y con
          lo que de verdad se hizo ese día debajo de lo prescrito. */}
      {verSesion && (
        <DetalleSesion sesion={verSesion.sesion} ejecutado={verSesion.ejecutado}
          onCerrar={()=>setVerSesion(null)}/>
      )}

      {seccion==='ejecucion'&&(
        <EvaluacionEjecucion pacienteId={pacienteId}/>
      )}

    {/* OBJETIVOS DE LA SESIÓN.
        Se ven igual que en la ficha —la misma moneda, el mismo aro— porque son la misma
        cosa mirada desde otro sitio. Dos dibujos distintos para el mismo objetivo obligan
        a reconocerlo dos veces. */}
    {objsDe && (
      <div className="modal-bg" onClick={e=>{if(e.target===e.currentTarget && !guardandoObjs){setObjsDe(null);setSelObjs([])}}}>
        <div className="modal" style={{width:'min(680px, 94vw)'}}>
          <div className="modal-title">
            Qué trabaja «{objsDe.nombre}»
            <button className="modal-close" onClick={()=>{setObjsDe(null);setSelObjs([])}}><Ic name="cerrar" size={15}/></button>
          </div>

          <div style={{fontSize:12,color:'var(--gr)',marginBottom:10,lineHeight:1.5}}>
            Los objetivos que este paciente tiene abiertos. Marca los que trabaja esta sesión.
          </div>

          {objsDelPaciente.length===0 ? (
            <div className="muted">
              No tiene ningún objetivo abierto. Se los abren sus tests, o se los añades tú
              desde la pestaña de su perfil.
            </div>
          ) : (
            <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(132px,1fr))',gap:8,maxHeight:'52vh',overflowY:'auto'}}>
              {objsDelPaciente.map((o:any)=>{
                const sel = selObjs.includes(o.id)
                return (
                  <button key={o.id} type="button" className={`obj-mon-b${sel?' on':''}`}
                    title={o.nombre}
                    onClick={()=>setSelObjs(v=>sel?v.filter(x=>x!==o.id):[...v,o.id])}>
                    <MonedaObjetivo objetivo={o} tam="g"/>
                    <span className="obj-mon-g">{o.nombre}</span>
                    {sel && <span style={{fontSize:10,color:'var(--gd)'}}><Ic name="check" size={11}/> Elegido</span>}
                  </button>
                )
              })}
            </div>
          )}

          <div style={{display:'flex',gap:8,marginTop:12,justifyContent:'flex-end'}}>
            <button className="btn btn-t btn-sm" disabled={guardandoObjs}
              onClick={()=>{setObjsDe(null);setSelObjs([])}}>Cancelar</button>
            <button className="btn btn-p btn-sm" disabled={guardandoObjs} onClick={guardarObjsSesion}>
              {guardandoObjs?'Guardando…':'Guardar'}
            </button>
          </div>
        </div>
      </div>
    )}

    {sesionEditando&&<ModalEditarSesion sesion={sesionEditando} ejercicios={ejerciciosBib} etiquetas={etiquetasBib} onGuardado={()=>{cargarDatos();onRefresh()}} onCerrar={()=>setSesionEditando(null)}/>}
    {editandoCita&&<ModalEditarCita editandoCita={editandoCita} setEditandoCita={setEditandoCita} guardando={guardando} guardarEdicionCita={guardarEdicionCita} onCerrar={()=>setEditandoCita(null)} horas={horas} tiposClase={tiposClase} cambiarEstadoCita={cambiarEstadoCita} eliminarCita={eliminarCita}/>}
    </div>
  )
}
