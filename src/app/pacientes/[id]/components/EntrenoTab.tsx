'use client'
import { finalizarSesion, diasActiva, avisoDias, AVISO_DIAS_DEFECTO, partesEnFecha } from '@/lib/sesionViva'
import { VeloFinalizar } from '@/components/SustituirSesion'
import { traerTodo } from '@/lib/paginar'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import ModalEditarCita from '@/app/agenda/components/ModalEditarCita'
import ModalEditarSesion from '@/app/entrenamiento/components/ModalEditarSesion'
import { usePuede } from '@/lib/permisos'
import EvaluacionEjecucion from './EvaluacionEjecucion'
import DetalleSesion from './DetalleSesion'
import MonedaObjetivo from '@/components/MonedaObjetivo'
import { Ic } from '@/lib/icons'
import BarraAsignacion from '@/components/BarraAsignacion'
import { encargoDeLaUrl, asignarSesionYVolver, rutaDeAsignacion, type Encargo } from '@/lib/asignarCita'
import { useRouter } from 'next/navigation'
import CalendarioCitasPaciente from '@/components/CalendarioCitasPaciente'
import { horasDeAgenda } from '@/lib/generarHoras'
import { TIPOS_CLASE_FALLBACK, parseTiposClase } from '@/lib/tipos'
import { duplicarSesion as duplicarSesionLib, registrarSesion, modoDeSesion } from '@/lib/sesiones'
import { agrupaPorLinaje, evolucionarPrograma, evolucionarDesde, marcarFija, esVigente, versionDe, linajeDe } from '@/lib/linaje'
import { hoyISO } from '@/lib/fechas'
import { estadoRecuperacion } from '@/lib/recuperaciones'
import { cambiarEstadoDeCita, moverCita, eliminarCitaDel } from '@/lib/gestionCita'
import HistorialAjustes from '@/app/entrenamiento/components/HistorialAjustes'
import SistemasPaciente from './SistemasPaciente'
import PiezaCitas, { type FilaPieza } from '@/components/PiezaCitas'
import { testsPorDia } from '@/lib/evaluaciones'
import { sistemasDePaciente, historialSistemas, logradosDe, escalonesDe, Asignacion, faseEn, principalDe, tinte, alfaDeFase, tramos, textoDuracion } from '@/lib/sistemas'
import { sinAjustes, resumenAjustes, aplicarAjustes } from '@/lib/ajustesCita'
import { useImagenes, imagenDe, idsDeSesiones } from '@/lib/imagenEjercicio'
import EntrenoHistorial from './EntrenoHistorial'
import EntrenoSistemas from './EntrenoSistemas'
import EntrenoSesiones from './EntrenoSesiones'
import EntrenoActivo from './EntrenoActivo'

export default function EntrenoTab({ pacienteId, nombrePaciente, sesiones, onRefresh, datos, seccionInicial }: { pacienteId: string, nombrePaciente?: string, sesiones: any[], onRefresh: () => void, datos?: React.ReactNode, seccionInicial?: string }) {
  // Nivel 2: ve sus sesiones y ajusta el día de una cita; crear, editar, versionar o
  // borrar sesiones (cambios para siempre) es del 3 en adelante.
  const editaPlan = usePuede()('editar_plan')
  const [seccion, setSeccion] = useState<'activo'|'sistemas'|'sesiones'|'historial'|'datos'>((seccionInicial as any) || 'activo')
  /* HISTORIAL CON DOS VISTAS: las citas pasadas o la ejecución (cómo ha ido cada
     ejercicio). Antes la ejecución era una pestaña aparte; las dos miran el pasado. */
  const [verHist, setVerHist] = useState<'sesiones'|'ejecucion'>('sesiones')
  const [citasFuturas, setCitasFuturas] = useState<any[]>([])
  const [citasPasadas, setCitasPasadas] = useState<any[]>([])
  const [regsPasados, setRegsPasados] = useState<any[]>([])
  // Planificación en lista (la de siempre) o como la presentación final del torno.
  const [vistaPlan, setVistaPlan] = useState<'calendario'|'interactiva'>('calendario')
  /**
   * La cita cuya sesión se está ajustando. Distinto de editar la sesión: aquí lo
   * que se guarde va a ESA cita, no al plan que comparten todas.
   */
  const [ajustandoCita, setAjustandoCita] = useState<any>(null)
  /** La sesión cuyo historial de cambios por día se está mirando. Solo lectura. */
  const [historialDe, setHistorialDe] = useState<any>(null)
  const [sistemasPac, setSistemasPac] = useState<Asignacion[]>([])
  const [logrados, setLogrados] = useState<Record<string,string|null>>({})
  const [escalones, setEscalones] = useState<Record<string,string|null>>({})
  const [todosSistemas, setTodosSistemas] = useState<Asignacion[]>([])
  const [eligiendoSesion, setEligiendoSesion] = useState(false)
  const [sesionesDisp, setSesionesDisp] = useState<any[]>([])
  const [sesionesHistorial, setSesionesHistorial] = useState<any[]>([])
  // Las miniaturas con la imagen de la biblioteca de hoy, no la copiada al montar la sesión.
  const imgs = useImagenes(idsDeSesiones([...(sesiones || []), ...sesionesDisp]))
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

  /**
   * PONER SESIONES EN CITAS: UNA SOLA PANTALLA.
   *
   * Había cuatro formas desde aquí (seleccionar citas y asignar, "asignar a citas"
   * desde la sesión, repartir en rotación y la X de cada cita), y cada una trataba
   * el candado a su manera: asignar desde la sesión se cargaba las de fuerza. Ahora
   * todas abren el calendario de citas, que es el que sabe de candados, de fases y
   * de repartir, y no guarda nada hasta Confirmar. Con `pincel`, esa sesión ya sale
   * elegida.
   */
  const abrirCalendario = (pincel?: string) =>
    routerAsig.push(`/torno/${pacienteId}/citas${pincel ? `?pincel=${pincel}` : ''}`)

  async function asignarYVolver(ses: any) {
    if (!encargo) return
    const r = await asignarSesionYVolver(ses, encargo)
    if (!r.ok) { alert('No se ha podido asignar: ' + r.error); return }
    // Con cita, la pone el calendario (r.ir); sin cita, ya está traída y se vuelve.
    routerAsig.push(r.ir || encargo.volver)
  }
  const [nEjecuciones, setNEjecuciones] = useState(0)
  const [objPaciente, setObjPaciente] = useState<any[]>([])
  const [evaluaciones, setEvaluaciones] = useState<any[]>([])
  const [testsDia, setTestsDia] = useState<Record<string, any[]>>({})
  const [soloActivas, setSoloActivas] = useState(false)
  const [asignando, setAsignando] = useState<any>(null)
  const [selAsig, setSelAsig] = useState<string[]>([])
  const [registros, setRegistros] = useState<any[]>([])
  const [filtroHist, setFiltroHist] = useState('')
  const [limHist, setLimHist] = useState(30)
  const [recuperaciones, setRecuperaciones] = useState<any[]>([])
  const [verFinalizadas, setVerFinalizadas] = useState(false)
  // Sesion viva: aviso de dias activa (Ajustes), finalizar, y lo ultimo hecho de cada ejercicio.
  const [avisoN, setAvisoN] = useState(AVISO_DIAS_DEFECTO)
  useEffect(() => { avisoDias().then(setAvisoN) }, [])
  const [finalizando, setFinalizando] = useState<{ sesion: any, modo: 'continuar'|'cerrar', nota: string } | null>(null)
  const [ultimoHecho, setUltimoHecho] = useState<any[] | null>(null)
  async function abrirDetalle(s: any) {
    setUltimoHecho(null); setSesionDetalle(s)
    const ids = Array.from(new Set((s.partes||[]).flatMap((p:any)=>(p.ejercicios||[]).map((e:any)=>e.ejercicio_id)).filter(Boolean)))
    if (!ids.length) return
    const { data } = await supabase.from('registros_ejercicio').select('ejercicio_id,series,comentario,variante,fecha')
      .eq('paciente_id', pacienteId).eq('finalizado', true).in('ejercicio_id', ids as string[]).order('fecha', { ascending: false }).limit(400)
    const visto = new Set<string>(); const ult: any[] = []
    ;(data||[]).forEach((r:any)=>{ if (!visto.has(r.ejercicio_id) && Array.isArray(r.series) && r.series.length) { visto.add(r.ejercicio_id); ult.push({ ...r, comentario: [r.comentario, 'última vez ' + new Date(r.fecha+'T12:00:00').toLocaleDateString('es-ES',{day:'numeric',month:'short'})].filter(Boolean).join(' · ') }) } })
    setUltimoHecho(ult)
  }
  async function confirmarFinalizar() {
    if (!finalizando) return
    setGuardando(true)
    const r = await finalizarSesion(finalizando.sesion, pacienteId, finalizando.modo, finalizando.nota.trim() || undefined)
    setGuardando(false)
    if (!r.ok) { alert(r.error); return }
    setFinalizando(null)
    setReciboTanda({ mal: false, texto: `«${finalizando.sesion.nombre}» finalizada` + (r.nueva ? ` · sigue con una nueva desde ella (${r.nCitas} cita${r.nCitas===1?'':'s'})` : ` · ${r.nCitas} cita${r.nCitas===1?'':'s'} sin sesión: ponles otra`) })
    cargarDatos(); onRefresh()
  }
  // El recibo de la última tanda. Recargar en silencio deja sin saber si reasignó las
  // citas o ninguna, que es justo lo que se quiere comprobar.
  const [reciboTanda, setReciboTanda] = useState<{texto:string, mal:boolean}|null>(null)
  const [repartiendo, setRepartiendo] = useState(false)

  useEffect(() => { cargarDatos() }, [limHist])

  async function cargarDatos() {
    const hoy = hoyISO()
    const [{ data: c },{ data: s }] = await Promise.all([
      supabase.from('citas').select('*, sesiones:sesion_id(*)').eq('paciente_id',pacienteId).gte('fecha',hoy).neq('estado','cancelada').order('fecha').order('hora'),
      supabase.from('sesiones').select('*, sesiones_objetivos(objetivo_id)').eq('paciente_id',pacienteId).order('created_at',{ascending:false}),
    ])
    setCitasFuturas(c||[]); setSesionesDisp(s||[])
    /* LO DE ANTES, PARA CAMBIAR CON CRITERIO: sus últimas citas ya pasadas (vino o no
       vino) y lo que se le apuntó en ellas. Se ven encima en la vista interactiva. */
    const { data: pas } = await supabase.from('citas').select('id,fecha,hora,estado,sesion_id,sesiones:sesion_id(nombre,partes)')
      .eq('paciente_id',pacienteId).lt('fecha',hoy).in('estado',['realizada','falta']).order('fecha',{ascending:false}).order('hora',{ascending:false}).limit(8)
    const pasOrd = (pas||[]).slice().reverse()
    const { data: regsPas } = pasOrd.length ? await supabase.from('registros_ejercicio').select('fecha,ejercicio_id,ejercicio_nombre,series,variante')
      .eq('paciente_id',pacienteId).gte('fecha',pasOrd[0].fecha).lt('fecha',hoy).order('id') : { data: [] as any[] }
    setCitasPasadas(pasOrd); setRegsPasados(regsPas||[])
    supabase.from('objetivos').select('id,nombre,imagen_url').eq('activo',true).order('nombre').then(({data})=>setObjetivosLib(data||[]))
    // Estado de los objetivos DE ESTE PACIENTE, para saber qué sesión sigue haciendo
    // falta y cuál ya cumplió su función.
    supabase.from('pacientes_objetivos').select('objetivo_id,logrado').eq('paciente_id',pacienteId)
      .then(({data})=>setObjPaciente(data||[]))
    // Las evaluaciones que tenga puestas, para marcarlas en la planificacion: poner
    // la fecha en la tarjeta del sistema y que no se viera en las citas obligaba a
    // recordar de memoria que dia tocaba.
    supabase.from('evaluaciones').select('id,fecha,cita_id,fase_id,asignacion_id,momento').eq('paciente_id',pacienteId)
      .then(({data})=>setEvaluaciones(data||[]))
    // Y que test toca cada dia, para los que se han repartido a mano.
    testsPorDia(pacienteId).then(setTestsDia)
    const { data: aj } = await supabase.from('ajustes').select('clave,valor')
    if (aj) { const map:Record<string,string>={}; aj.forEach((a:any)=>{map[a.clave]=a.valor||''}); setTiposClase(parseTiposClase(map.tipos_clase)); setHoras(horasDeAgenda(map)) }
    const { data: hist } = await supabase.from('citas').select('*, sesiones:sesion_id(*)').eq('paciente_id',pacienteId).lt('fecha',hoy).order('fecha',{ascending:false}).limit(limHist)
    setSesionesHistorial(hist||[])

    // Lo que de verdad se registró en el taller. Se cruza por fecha + sesión para
    // saber qué se hizo en cada cita pasada, no solo qué estaba prescrito.
    // Con todo lo que se apunta en la sala: ejecucion y lado reales, tecnica, y los que
    // no hizo (no_hechos). Antes solo se leian las series y un ejercicio hecho "tal cual"
    // (sin cifras) no salia en el historial.
    const { data: ejec } = await supabase.from('registros_ejercicio')
      .select('*').eq('paciente_id',pacienteId)
    const { data: noh } = await supabase.from('no_hechos').select('fecha,sesion_id,ejercicio_id').eq('paciente_id',pacienteId)
    setRegistros([...(ejec||[]), ...(noh||[]).map((n:any)=>({ ...n, noHecho:true }))])

    // Recuperaciones, para decir en cada fila si esa falta se recuperó y para marcar
    // las citas que son la recuperación de otra.
    const { data: recs } = await supabase.from('recuperaciones')
      .select('id,estado,fecha_falta,fecha_limite,cita_falta_id,cita_recuperacion_id')
      .eq('paciente_id',pacienteId)
    setRecuperaciones(recs||[])

    // Los sistemas que lleva hoy. Pintan las citas y dicen que sesiones tocan.
    sistemasDePaciente(pacienteId).then(setSistemasPac)
    logradosDe(pacienteId).then(setLogrados)
    // Los escalones: el número de cada fase. Manda sobre el logrado del objetivo.
    escalonesDe(pacienteId).then(setEscalones)
    historialSistemas(pacienteId).then(setTodosSistemas)

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
    // Aquí se recordaba revisar si algún objetivo avanzaba de fase. Los objetivos ya no
    // tienen fases, así que el recordatorio se ha ido con ellas.

    setReciboTanda({
      mal: r.nCitas===0,
      texto: r.nCitas===0
        ? `Se crearon ${r.nuevas.length} sesión${r.nuevas.length>1?'es':''} pero NINGUNA cita cambió a la tanda nueva. Las citas siguen con la anterior.`
        : `${r.nuevas.length} sesión${r.nuevas.length>1?'es':''} nueva${r.nuevas.length>1?'s':''} · ${r.nCitas} cita${r.nCitas>1?'s':''} reasignada${r.nCitas>1?'s':''}`
          + (r.fijas.length>0 ? ` · sin tocar por fijas: ${r.fijas.join(', ')}` : '')
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

  // Lo mismo que hace la agenda, por el mismo sitio (lib/gestionCita).
  async function guardarEdicionCita() {
    if (!editandoCita) return
    setGuardando(true)
    const original = citasFuturas.find((c:any)=>c.id===editandoCita.id)
    const r = await moverCita({ ...editandoCita, paciente_id: editandoCita.paciente_id || pacienteId }, original)
    setGuardando(false)
    if (!r.ok) { alert(r.error); return }
    setEditandoCita(null); cargarDatos(); onRefresh()
  }

  async function cambiarEstadoCita(cita:any, estado:string) {
    const r = await cambiarEstadoDeCita(cita.id, estado)
    if (!r.ok) { alert(r.error); cargarDatos(); return }
    if (r.aviso) alert(r.aviso)
    setEditandoCita(null); cargarDatos(); onRefresh()
  }

  async function eliminarCita(cita:any) {
    if (!confirm('Al eliminar esta cita NO se guardará ningún dato (ni realizada, ni falta, ni recuperación). Úsalo solo para errores.\n\n¿Eliminar la cita?')) return
    const r = await eliminarCitaDel(cita)
    if (!r.ok) { alert(r.error); cargarDatos(); return }
    setEditandoCita(null); cargarDatos(); onRefresh()
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
    /* NO SE GUARDA HASTA PULSAR GUARDAR. Antes se creaba vacia en la base y luego se
       abria el editor: si cancelabas, quedaba una "Sesion Nombre · fecha" vacia. El
       editor ya la crea al guardar (y apunta el evento). */
    abrirEditor({ paciente_id:pacienteId, nombre:nombreAuto, descripcion:'', partes:[{nombre:'Parte 1',ejercicios:[]}] })
  }

  async function duplicar(s: any) {
    const r = await duplicarSesionLib(s, pacienteId)
    if (!r.ok) alert(r.error)
    cargarDatos()
  }

  async function eliminarSesion(id: string) {
    if (!confirm('¿Eliminar esta sesión?')) return
    // Una sesion con citas o registros no se deja borrar: antes no pasaba nada y no se decia.
    const { data: borradas, error } = await supabase.from('sesiones').delete().eq('id',id).select('id')
    if (error) alert('No se ha podido eliminar la sesión: ' + error.message)
    else if (!borradas || borradas.length === 0) alert('La sesión no se ha eliminado: ya no existe o no tienes permiso para hacerlo.')
    cargarDatos()
  }

  // La biblioteca de ejercicios solo la necesita el editor de sesión. Traerla en cada
  // montaje de la pestaña era descargarla entera para no usarla casi nunca.
  /**
   * Ajustar la sesión SOLO para un día.
   *
   * Abre el mismo editor de siempre, pero atado a la cita: lo que guardes se anota
   * como desviación de ese día y el plan no se entera. Es lo que permite cambiar un
   * ejercicio cada pocas semanas sin que las sesiones ya hechas cambien con él.
   */
  async function abrirAjuste(cita:any) {
    if (!cita?.sesiones?.id) return
    await cargarBiblioteca()
    setAjustandoCita(cita)
  }

  async function cargarBiblioteca() {
    if (ejerciciosBib.length>0) return
    const [{ data: ejs },{ data: ets }] = await Promise.all([
      traerTodo((d, h) => supabase.from('ejercicios').select('*').order('nombre').order('id').range(d, h)).then(r => ({ data: r.filas })),
      supabase.from('etiquetas').select('*').order('categoria').order('nombre'),
    ])
    setEjerciciosBib(ejs||[]); setEtiquetasBib(ets||[])
  }

  async function abrirEditor(sesion:any) {
    if (ejerciciosBib.length===0) {
      const [{ data: ejs },{ data: ets }] = await Promise.all([
        traerTodo((d, h) => supabase.from('ejercicios').select('*').order('nombre').order('id').range(d, h)).then(r => ({ data: r.filas })),
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
  /**
   * De que fase de que sistema salio cada sesion. Se reconoce por `plantilla_id`:
   * al traerla se guarda de que molde se saco, y el molde es de una fase. Si luego
   * quitas el sistema la sesion sigue siendo suya, solo deja de ir coloreada.
   */
  // Quien pinta y como. Vive fuera de las secciones porque lo usan dos.
  const pintaMarco = principalDe(sistemasPac)
  const pinta = (fecha:string) => {
    if (!pintaMarco?.sistema) return null
    const t = faseEn(pintaMarco.sistema, pintaMarco, fecha, logrados, escalones)
    if (!t) return null
    const fases = pintaMarco.sistema.fases||[]
    const i = fases.findIndex(f=>f.id===t.fase.id)
    return { color: pintaMarco.sistema.color, fase: t.fase,
             fondo: tinte(pintaMarco.sistema.color, alfaDeFase(Math.max(0,i), fases.length)) }
  }

  function deSistema(ses:any) {
    // La fase puede apuntar a la plantilla de la que salio la sesion O A LA PROPIA
    // SESION: al editar una sesion desde el ciclo del paciente se hace una copia suya
    // y la fase pasa a apuntar a la copia. Mirando solo la plantilla, esas copias
    // salian sin el color del ciclo aunque estuvieran dentro.
    const ids = [ses?.id, ses?.plantilla_id].filter(Boolean)
    if (ids.length === 0) return null
    for (const a of sistemasPac) {
      for (const f of (a.sistema?.fases||[])) {
        if ((f.sesiones||[]).some((x:string)=>ids.includes(x)))
          return { color: a.sistema!.color, sistema: a.sistema!.nombre, fase: f.nombre }
      }
    }
    return null
  }

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
      const est = estadoRecuperacion(perdida)
      if (est==='recuperada') return { txt:'Recuperada', clase:'pill-o on' }
      // Ya tiene su cita de recuperación: antes seguía diciendo "Por recuperar".
      if (est==='agendada') return { txt:'Recuperación agendada', clase:'pill-o on' }
      return est==='caducada'
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
        {/* DATOS DE ENTRENAMIENTO: cuota, tipo de clase, horario, sala y preferencias
            (antes la pestaña «Por ubicar» de la ficha). Sin contador: no son una lista. */}
        {([['activo','calendario','Planificación',citasFuturas.length],['sesiones','lista','Sesiones y sistemas',sesionesDisp.length],['historial','carpeta','Historial',sesionesHistorial.length],...(datos ? [['datos','reloj','Datos de entrenamiento',null]] : [])] as [string,string,string,number|null][]).map(([k,ic,l,n])=>(
          <button key={k} className={`vista-b ${seccion===k?'on':''}`} onClick={()=>setSeccion(k as any)}>
            <Ic name={ic} size={13}/> {l}
            {n !== null && <span className="cnt">{n}</span>}
          </button>
        ))}
      </div>

      <EntrenoActivo {...{ abrirCalendario, citasFuturas, citasPasadas, editaPlan, escalones, evaluaciones, logrados, pacienteId, pinta, pintaMarco, regsPasados, seccion, setVistaPlan, sistemasPac, testsDia, vistaPlan }} />

      <EntrenoSesiones {...{ abrirCalendario, abrirDetalle, abrirObjsDe, alternarFija, asignarYVolver, avisoN, citasFuturas, crearSesionNueva, deSistema, editaPlan, encargo, estadoSesion, fotosDeSesion, guardando, imgs, nombrePaciente, objsDeSesion, pacienteId, reciboTanda, routerAsig, seccion, sesionesDisp, setHistorialDe, setReciboTanda, setSoloActivas, setVerFinalizadas, soloActivas, verFinalizadas }} />

      {/* LOS SISTEMAS, debajo de sus sesiones: no cuajaron como pestaña propia. */}
      <EntrenoSistemas {...{ cargarDatos, escalones, logrados, pacienteId, seccion, setSistemasPac, setTodosSistemas, sistemasPac, todosSistemas }} />

      {/* El conmutador del historial, discreto arriba a la derecha como en Planificación. */}
      {seccion==='historial' && (
        <div style={{display:'flex',justifyContent:'flex-end',marginBottom:10}}>
          <button type="button" className="btn-vista" onClick={()=>setVerHist(v=>v==='sesiones'?'ejecucion':'sesiones')} title="Pasar de las citas a la ejecución">
            <Ic name={verHist==='sesiones'?'carpeta':'ok'} size={14}/> {verHist==='sesiones' ? 'Citas pasadas' : `Ejecución · ${nEjecuciones}`}
            <span style={{display:'inline-flex',gap:2,marginLeft:2}}>{[0,1].map(k=><i key={k} style={{width:4,height:4,borderRadius:'50%',background:'currentColor',opacity:(verHist==='sesiones'?0:1)===k?1:.3}}/>)}</span>
          </button>
        </div>
      )}

      <EntrenoHistorial {...{ filtroHist, limHist, pinta, porMes, recuperacionDe, registrosDe, seccion, sesionesHistorial, setFiltroHist, setLimHist, setVerSesion, verHist }} />

      {/* Solo se edita la tanda vigente. Editar una vieja reescribiría lo que dicen las
          citas ya pasadas, y con ellas el resumen de trabajo por zonas: junio pasaría a
          contar series que nunca se hicieron. Para avanzar desde una antigua está
          "Partir de esta", que la deja intacta y crea la siguiente del linaje. */}
      {sesionDetalle && (
        <DetalleSesion pacienteId={pacienteId}
          sesion={sesionDetalle}
          objetivos={objsDeSesion(sesionDetalle)}
          nCitas={citasFuturas.filter((c:any)=>c.sesion_id===sesionDetalle.id).length}
          // Con un encargo, la cita YA SE SABE. Abrir el selector de citas obligaría a
          // buscarla otra vez en la lista, y deja marcar otra distinta de la que se venía
          // a resolver. Se asigna y se vuelve.
          onAsignar={!editaPlan ? undefined : encargo
            ? ()=>{ const x=sesionDetalle; setSesionDetalle(null); asignarYVolver(x) }
            // Sin encargo, al calendario con esta sesión ya elegida como pincel.
            : ()=>{ const x=sesionDetalle; setSesionDetalle(null); abrirCalendario(x.id) }}
          textoAsignar={encargo ? `Traer para ${encargo.etiqueta || 'el paciente'}` : undefined}
          onCerrar={()=>setSesionDetalle(null)}
          onEditar={editaPlan && esVigente(sesionesDisp, sesionDetalle) && !sesionDetalle.finalizada_en
            ? ()=>{const x=sesionDetalle;setSesionDetalle(null);abrirEditor(x)}
            : undefined}
          // AHORA: debajo de cada ejercicio, lo ultimo que hizo (cualquier dia).
          ejecutado={ultimoHecho || undefined}
          onHistorial={()=>setHistorialDe(sesionDetalle)}
          onPartir={editaPlan && esVigente(sesionesDisp, sesionDetalle) && !sesionDetalle.finalizada_en ? ()=>{ setFinalizando({ sesion: sesionDetalle, modo: 'continuar', nota: '' }); setSesionDetalle(null) } : undefined}
          textoPartir="Finalizar sesión"
          onDuplicar={editaPlan ? ()=>{duplicar(sesionDetalle);setSesionDetalle(null)} : undefined}
          onEliminar={editaPlan ? ()=>{eliminarSesion(sesionDetalle.id);setSesionDetalle(null)} : undefined}
        />
      )}


      {/* Desde Historial se consulta el pasado: mismo detalle, sin acciones, y con
          lo que de verdad se hizo ese día debajo de lo prescrito. */}
      {/* FINALIZAR: "¿Que viene despues?" — una copia, otra de la biblioteca, otra suya o
          ninguna. La nueva ocupa el hueco exacto de esta (components/SustituirSesion). */}
      {finalizando && (
        <VeloFinalizar sesion={finalizando.sesion} pacienteId={pacienteId} nombrePaciente={nombrePaciente}
          onCerrar={()=>setFinalizando(null)}
          onHecho={texto=>{ setFinalizando(null); setReciboTanda({ mal:false, texto }); cargarDatos(); onRefresh() }}/>
      )}

      {verSesion && (
        <DetalleSesion pacienteId={pacienteId} sesion={verSesion.sesion} ejecutado={verSesion.ejecutado}
          onCerrar={()=>setVerSesion(null)}/>
      )}

      {seccion==='historial'&&verHist==='ejecucion'&&(
        <EvaluacionEjecucion pacienteId={pacienteId}/>
      )}

      {seccion==='datos' && datos}

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
    {/* Mismo editor, atado a la cita: lo que se guarde va a ese día, no al plan. */}
    {/* Lo que se cree desde aqui es del paciente, igual que con "Nueva sesion". */}
    {historialDe&&<HistorialAjustes sesion={historialDe} onCerrar={()=>setHistorialDe(null)}/>}
    {ajustandoCita&&<ModalEditarSesion
      sesion={ajustandoCita.sesiones}
      cita={{ id: ajustandoCita.id, fecha: ajustandoCita.fecha, ajustes: ajustandoCita.ajustes }}
      ejercicios={ejerciciosBib} etiquetas={etiquetasBib}
      onGuardado={()=>{cargarDatos();onRefresh()}}
      onCerrar={()=>setAjustandoCita(null)}/>}
    {editandoCita&&<ModalEditarCita editandoCita={editandoCita} setEditandoCita={setEditandoCita} guardando={guardando} guardarEdicionCita={guardarEdicionCita} onCerrar={()=>setEditandoCita(null)} horas={horas} tiposClase={tiposClase} cambiarEstadoCita={cambiarEstadoCita} eliminarCita={eliminarCita}/>}
    </div>
  )
}
