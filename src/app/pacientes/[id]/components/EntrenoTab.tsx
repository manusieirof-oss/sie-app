'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import ModalEditarCita from '@/app/agenda/components/ModalEditarCita'
import ModalEditarSesion from '@/app/entrenamiento/components/ModalEditarSesion'
import EvaluacionEjecucion from './EvaluacionEjecucion'
import DetalleSesion from './DetalleSesion'
import { Ic } from '@/lib/icons'
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
  const [objetivosLib, setObjetivosLib] = useState<any[]>([])
  const [sesionDetalle, setSesionDetalle] = useState<any>(null)
  const [nEjecuciones, setNEjecuciones] = useState(0)

  useEffect(() => { cargarDatos() }, [])

  async function cargarDatos() {
    const hoy = new Date().toISOString().split('T')[0]
    const [{ data: c },{ data: s }] = await Promise.all([
      supabase.from('citas').select('*, sesiones:sesion_id(id,nombre,partes)').eq('paciente_id',pacienteId).gte('fecha',hoy).neq('estado','cancelada').order('fecha').order('hora'),
      supabase.from('sesiones').select('id,nombre,descripcion,partes,created_at, sesiones_objetivos(objetivo_id)').eq('paciente_id',pacienteId).order('created_at',{ascending:false}),
    ])
    setCitasFuturas(c||[]); setSesionesDisp(s||[])
    supabase.from('objetivos').select('id,nombre,color').eq('activo',true).order('nombre').then(({data})=>setObjetivosLib(data||[]))
    const { data: aj } = await supabase.from('ajustes').select('clave,valor')
    if (aj) { const map:Record<string,string>={}; aj.forEach((a:any)=>{map[a.clave]=a.valor||''}); setTiposClase(parseTiposClase(map.tipos_clase)); if(map.horas){try{setHoras(JSON.parse(map.horas))}catch{}} }
    const { data: hist } = await supabase.from('citas').select('*, sesiones:sesion_id(id,nombre,descripcion,partes)').eq('paciente_id',pacienteId).lt('fecha',hoy).order('fecha',{ascending:false}).limit(30)
    setSesionesHistorial(hist||[])

    // El contador de Ejecución era un 0 literal. Se cuentan los ejercicios
    // distintos que tienen alguna evaluación, que es lo que muestra la sección.
    const { data: regs } = await supabase.from('registros_ejercicio')
      .select('ejercicio_id,items_evaluados').eq('paciente_id',pacienteId)
    const conEval = new Set((regs||[])
      .filter((r:any)=>r.ejercicio_id && Object.keys(r.items_evaluados||{}).length>0)
      .map((r:any)=>r.ejercicio_id))
    setNEjecuciones(conEval.size)
  }

  async function asignarEnBloque() {
    if (!sesionAsignar||seleccionadas.length===0) { alert('Selecciona citas y una sesión'); return }
    setGuardando(true)
    for (const citaId of seleccionadas) await supabase.from('citas').update({sesion_id:sesionAsignar}).eq('id',citaId)
    // Un solo evento con el total: asignar en bloque a 12 citas no son 12 hitos.
    const nom = sesionesDisp.find((s:any)=>s.id===sesionAsignar)?.nombre || 'Sesión'
    await registrarSesion(pacienteId, `Sesión asignada a ${seleccionadas.length} cita${seleccionadas.length>1?'s':''}: ${nom}`)
    setSeleccionadas([]); setSesionAsignar(''); setGuardando(false); cargarDatos(); onRefresh()
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
      const { data } = await supabase.from('ejercicios').select('*').order('nombre')
      setEjerciciosBib(data||[])
    }
    setSesionEditando(sesion)
  }

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

        // Un atajo por cada día de la semana en que este paciente tiene citas,
        // en el orden en que aparecen. Más "sin sesión" si queda alguna.
        const porDia = new Map<number,{label:string, ids:string[]}>()
        citasFuturas.forEach((c:any)=>{
          const d = new Date(c.fecha+'T12:00:00')
          const dia = d.getDay()
          if (!porDia.has(dia)) {
            const l = d.toLocaleDateString('es-ES',{weekday:'short'}).replace('.','')
            porDia.set(dia, { label: l.charAt(0).toUpperCase()+l.slice(1), ids: [] })
          }
          porDia.get(dia)!.ids.push(c.id)
        })
        const atajos: {clave:string,label:string,ids:string[],activo:boolean}[] = []
        // Con un solo día, "Lun · 8" y "todas" son lo mismo: no aporta nada.
        if (porDia.size > 1) {
          porDia.forEach((v,k)=>atajos.push({ clave:'d'+k, label:v.label, ids:v.ids, activo:false }))
        }
        if (sinSesion.length>0) atajos.push({ clave:'sin', label:'Sin sesión', ids:sinSesion.map((c:any)=>c.id), activo:false })
        atajos.forEach(a=>{ a.activo = a.ids.length>0 && a.ids.every(id=>seleccionadas.includes(id)) })

        return (
        <div className="panel">
          <div className="sec">
            <div className="sec-h">
              <span className="sh-l">
                <span className="ct-l"><Ic name="calendario" size={13}/> Citas por delante</span>
                {/* Atajos de selección. Por día de la semana porque es como se
                    reparte el trabajo: si los lunes toca fuerza y los jueves
                    movilidad, se asigna cada grupo por separado. "Sin sesión" es
                    uno más, no el principal: solo sirve si todas llevan lo mismo. */}
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
              </span>
              {total>0 && <span className="sh-r">{conSes} de {total} con sesión · {pct}%</span>}
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
              {sesionesDisp.length>0 && <span className="sh-r">Pulsa una para ver el detalle</span>}
            </div>
            {sesionesDisp.length===0?<div className="muted">No hay sesiones creadas.</div>:(
              <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(250px,1fr))',gap:10}}>
                {sesionesDisp.map(s=>{
                  const citasAsignadas=citasFuturas.filter(c=>c.sesion_id===s.id); const asignada=citasAsignadas.length>0
                  const nEj=(s.partes||[]).reduce((a:number,p:any)=>a+(p.ejercicios||[]).length,0); const nP=(s.partes||[]).length
                  return (
                    <div key={s.id} onClick={()=>setSesionDetalle(s)} className="tarj-s">
                      <div style={{display:'flex',alignItems:'flex-start',gap:7}}>
                        <div style={{flex:1}}>
                          <div style={{fontSize:13,color:'var(--n)'}}>{s.nombre}</div>
                          {s.descripcion&&<div style={{fontSize:12,color:'var(--gr)',marginTop:2,lineHeight:1.4}}>{s.descripcion.slice(0,70)}{s.descripcion.length>70?'…':''}</div>}
                        </div>
                        <span className={`pill ${asignada?'pill-o on':'pill-soft'}`} style={{flexShrink:0}}>
                          {asignada?`${citasAsignadas.length} cita${citasAsignadas.length>1?'s':''}`:'Sin asignar'}
                        </span>
                      </div>
                      <div style={{display:'flex',gap:5,flexWrap:'wrap',marginTop:8}}>
                        <span className="pill pill-soft">{nP} {nP===1?'parte':'partes'}</span>
                        <span className="pill pill-soft">{nEj} {nEj===1?'ejercicio':'ejercicios'}</span>
                        {/* Calculado de las partes, nunca guardado en la sesión. */}
                        {nEj>0 && <span className="pill pill-o on">{modoDeSesion(s.partes).nombre}</span>}
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

      {seccion==='historial'&&(
        <div className="panel">
          <div className="sec">
            <div className="sec-h">
              <span className="sh-l"><span className="ct-l"><Ic name="carpeta" size={13}/> Citas pasadas</span></span>
              {/* El corte estaba puesto pero no se decía: parecía que faltaban citas. */}
              {sesionesHistorial.length>=30 && <span className="sh-r">Últimas 30</span>}
            </div>
            {sesionesHistorial.length===0&&<div className="muted">Sin historial aún</div>}
            {porMes(sesionesHistorial).map(g=>(
              <div key={g.mes}>
                <div className="sep-mes">{g.mes}</div>
                {g.citas.map((c:any)=>{
                  const est=c.estado==='realizada'?{cl:'pill-o on',txt:'Realizada',borde:'var(--g)'}
                    :c.estado==='cancelada'?{cl:'pill-soft',txt:'Cancelada',borde:'var(--bd)'}
                    :{cl:'pill-r',txt:'Falta',borde:'var(--red)'}
                  const tieneSes=!!c.sesiones
                  return (
                    <div key={c.id} className={`fila-p ${tieneSes?'test-clic':''}`} style={{borderLeftColor:est.borde}}
                      onClick={()=>tieneSes&&setVerSesion(c.sesiones)}>
                      <div style={{flex:1}}>
                        {tieneSes
                          ? <div style={{fontSize:13,color:'var(--n)',display:'flex',alignItems:'center',gap:5}}><Ic name="valoracion" size={12}/> {c.sesiones.nombre}</div>
                          : <div style={{fontSize:13,color:'var(--gr)'}}>Sin sesión</div>}
                        <div style={{fontSize:12,color:'var(--gr)',marginTop:1}}>
                          {new Date(c.fecha+'T12:00:00').toLocaleDateString('es-ES',{weekday:'short',day:'numeric',month:'short'})} · {c.hora?.slice(0,5)} · Sala {c.sala}
                        </div>
                      </div>
                      <span className={`pill ${est.cl}`} style={{flexShrink:0}}>{est.txt}</span>
                    </div>
                  )
                })}
              </div>
            ))}
          </div>
        </div>
      )}

      {sesionDetalle && (
        <DetalleSesion
          sesion={sesionDetalle}
          objetivos={objsDeSesion(sesionDetalle)}
          onCerrar={()=>setSesionDetalle(null)}
          onEditar={()=>{const x=sesionDetalle;setSesionDetalle(null);abrirEditor(x)}}
          onDuplicar={()=>{duplicar(sesionDetalle);setSesionDetalle(null)}}
          onEliminar={()=>{eliminarSesion(sesionDetalle.id);setSesionDetalle(null)}}
        />
      )}

      {/* Desde Historial se consulta el pasado: mismo detalle, sin acciones. */}
      {verSesion && (
        <DetalleSesion sesion={verSesion} onCerrar={()=>setVerSesion(null)}/>
      )}

      {seccion==='ejecucion'&&(
        <EvaluacionEjecucion pacienteId={pacienteId}/>
      )}

    {sesionEditando&&<ModalEditarSesion sesion={sesionEditando} ejercicios={ejerciciosBib} onGuardado={()=>{cargarDatos();onRefresh()}} onCerrar={()=>setSesionEditando(null)}/>}
    {editandoCita&&<ModalEditarCita editandoCita={editandoCita} setEditandoCita={setEditandoCita} guardando={guardando} guardarEdicionCita={guardarEdicionCita} onCerrar={()=>setEditandoCita(null)} horas={horas} tiposClase={tiposClase} cambiarEstadoCita={cambiarEstadoCita} eliminarCita={eliminarCita}/>}
    </div>
  )
}
