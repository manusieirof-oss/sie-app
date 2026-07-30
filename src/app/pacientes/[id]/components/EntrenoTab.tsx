'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import ModalEditarCita from '@/app/agenda/components/ModalEditarCita'
import ModalEditarSesion from '@/app/entrenamiento/components/ModalEditarSesion'
import EvaluacionEjecucion from './EvaluacionEjecucion'
import DetalleSesion from './DetalleSesion'
import { Ic } from '@/lib/icons'
import { horasDeAgenda } from '@/lib/generarHoras'
import { TIPOS_CLASE_FALLBACK, parseTiposClase } from '@/lib/tipos'
import { duplicarSesion as duplicarSesionLib, registrarSesion, modoDeSesion } from '@/lib/sesiones'

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
  const [nEjecuciones, setNEjecuciones] = useState(0)
  const [objPaciente, setObjPaciente] = useState<any[]>([])
  const [soloActivas, setSoloActivas] = useState(false)
  const [asignando, setAsignando] = useState<any>(null)
  const [selAsig, setSelAsig] = useState<string[]>([])
  const [registros, setRegistros] = useState<any[]>([])
  const [filtroHist, setFiltroHist] = useState('')
  const [limHist, setLimHist] = useState(30)
  const [recuperaciones, setRecuperaciones] = useState<any[]>([])

  useEffect(() => { cargarDatos() }, [limHist])

  async function cargarDatos() {
    const hoy = new Date().toISOString().split('T')[0]
    const [{ data: c },{ data: s }] = await Promise.all([
      supabase.from('citas').select('*, sesiones:sesion_id(id,nombre,partes)').eq('paciente_id',pacienteId).gte('fecha',hoy).neq('estado','cancelada').order('fecha').order('hora'),
      supabase.from('sesiones').select('id,nombre,descripcion,partes,created_at, sesiones_objetivos(objetivo_id)').eq('paciente_id',pacienteId).order('created_at',{ascending:false}),
    ])
    setCitasFuturas(c||[]); setSesionesDisp(s||[])
    supabase.from('objetivos').select('id,nombre,color').eq('activo',true).order('nombre').then(({data})=>setObjetivosLib(data||[]))
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
                <button className="btn btn-p btn-sm" onClick={crearSesionNueva}>+ Nueva sesión</button>
              </span>
              {/* Las cumplidas se apagan pero siguen ahí, porque son el historial de lo
                  que funcionó. Este filtro es para cuando estorban. */}
              {sesionesDisp.some(s=>estadoSesion(s)==='cumplida') && (
                <button className={`chip-sel ${soloActivas?'on':''}`} onClick={()=>setSoloActivas(v=>!v)}>
                  Ocultar las de objetivos logrados
                </button>
              )}
            </div>
            {sesionesDisp.length===0?<div className="muted">No hay sesiones creadas.</div>:(
              <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(250px,1fr))',gap:10}}>
                {sesionesDisp.filter(s=>!soloActivas || estadoSesion(s)!=='cumplida').map(s=>{
                  const citasAsignadas=citasFuturas.filter(c=>c.sesion_id===s.id); const asignada=citasAsignadas.length>0
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
                        {/* Con diez sesiones acumuladas, cuál es la reciente importa más
                            que cuántas partes tiene. */}
                        {s.created_at && (
                          <span style={{fontSize:12,color:'var(--gr)',marginLeft:'auto'}}>
                            {new Date(s.created_at).toLocaleDateString('es-ES',{day:'numeric',month:'short'})}
                          </span>
                        )}
                      </div>
                      {objsDeSesion(s).length>0&&(
                        <div style={{display:'flex',gap:4,flexWrap:'wrap',marginTop:6}}>
                          {objsDeSesion(s).map((o:any)=>(
                            <span key={o.id} className="pill" style={{background:o.color||'var(--g)',color:'#fff',display:'inline-flex',alignItems:'center',gap:4}}>
                              <Ic name="objetivo" size={10}/> {o.nombre}
                            </span>
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

      {sesionDetalle && (
        <DetalleSesion
          sesion={sesionDetalle}
          objetivos={objsDeSesion(sesionDetalle)}
          nCitas={citasFuturas.filter((c:any)=>c.sesion_id===sesionDetalle.id).length}
          onAsignar={()=>{
            // Vienen premarcadas las que ya la tienen: así se ve el estado actual y
            // desmarcar una la quita, en vez de tener que ir a Planificación.
            setSelAsig(citasFuturas.filter((c:any)=>c.sesion_id===sesionDetalle.id).map((c:any)=>c.id))
            setAsignando(sesionDetalle); setSesionDetalle(null)
          }}
          onCerrar={()=>setSesionDetalle(null)}
          onEditar={()=>{const x=sesionDetalle;setSesionDetalle(null);abrirEditor(x)}}
          onDuplicar={()=>{duplicar(sesionDetalle);setSesionDetalle(null)}}
          onEliminar={()=>{eliminarSesion(sesionDetalle.id);setSesionDetalle(null)}}
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

    {sesionEditando&&<ModalEditarSesion sesion={sesionEditando} ejercicios={ejerciciosBib} etiquetas={etiquetasBib} onGuardado={()=>{cargarDatos();onRefresh()}} onCerrar={()=>setSesionEditando(null)}/>}
    {editandoCita&&<ModalEditarCita editandoCita={editandoCita} setEditandoCita={setEditandoCita} guardando={guardando} guardarEdicionCita={guardarEdicionCita} onCerrar={()=>setEditandoCita(null)} horas={horas} tiposClase={tiposClase} cambiarEstadoCita={cambiarEstadoCita} eliminarCita={eliminarCita}/>}
    </div>
  )
}
