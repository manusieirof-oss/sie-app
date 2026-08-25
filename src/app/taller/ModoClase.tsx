'use client'
import { useState, useRef, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { alternarItem, itemMarcado } from '@/lib/ejecucion'
import { guardarVias, abrirObjetivo, resolverVia } from '@/lib/objetivos'
import { pacientesDelDia, horasDelDia, horaActual, asignarSesionACita } from '@/lib/taller'
import { rutaDeAsignacion } from '@/lib/asignarCita'
import { useRouter } from 'next/navigation'
import { Ic } from '@/lib/icons'

const hoy = () => new Date().toISOString().slice(0,10)

export default function ModoClase() {
  const [fecha, setFecha] = useState(hoy())
  const [seleccion, setSeleccion] = useState<any[]>([])
  const [activo, setActivo] = useState<string>('')
  const timers = useRef<Record<string, any>>({})
  const restaurado = useRef(false)
  // Un `ref` no vuelve a disparar los efectos al cambiar, así que la carga automática
  // necesita saberlo por estado: si no, al terminar la restauración no se enteraba nadie y
  // el taller se quedaba vacío hasta tocar el selector.
  const [listo, setListo] = useState(false)
  const SKEY = 'taller_clase'
  const [objetivosLib, setObjetivosLib] = useState<any[]>([])
  const [objsPorPaciente, setObjsPorPaciente] = useState<Record<string,any[]>>({})
  const [sala, setSala] = useState('')
  // A y B por defecto, igual que la agenda: si `clinica_salas` no está puesto en Ajustes,
  // antes se quedaba en lista vacía y el selector de sala no llegaba a pintarse nunca.
  const [salas, setSalas] = useState<string[]>(['A','B'])
  const [hora, setHora] = useState('')
  const [horas, setHoras] = useState<{hora:string,n:number}[]>([])
  // Si las franjas todavía no se han leído, `hora` vale '' y '' significa TODO EL DÍA. Sin
  // esta bandera el taller cargaba la clínica entera en cuanto abría y se corregía un
  // instante después, que es exactamente lo que se veía.
  const [horasListas, setHorasListas] = useState(false)
  const [trayendo, setTrayendo] = useState(false)
  const [avisoAgenda, setAvisoAgenda] = useState('')
  const [eligiendo, setEligiendo] = useState<any>(null)
  const router = useRouter()

  /**
   * Las franjas del día, y la de ahora puesta sola.
   *
   * SE TRABAJA POR FRANJA, NO POR DÍA. Por la clínica pueden pasar 110 personas en un día;
   * traerlas todas de golpe no sirve para nada. Al abrir el taller a las 10:05 lo que hace
   * falta es la gente de las 10:00, sin tocar nada.
   *
   * La hora elegida a mano se respeta mientras siga existiendo en el día: si estás mirando
   * la franja anterior a propósito, cambiar de sala no debe devolverte al presente.
   */
  useEffect(() => {
    let vigente = true
    setHorasListas(false)
    ;(async () => {
      const hs = await horasDelDia(fecha, sala || undefined)
      if (!vigente) return   // cambió de día o de sala mientras se leía: manda lo último
      setHoras(hs)
      setHora(prev => (prev && hs.some(h => h.hora === prev)) ? prev : horaActual(hs))
      setHorasListas(true)
    })()
    return () => { vigente = false }
  }, [fecha, sala])

  // Las salas se leen de Ajustes, igual que en la agenda: si mañana hay una tercera sala,
  // el taller se entera solo.
  useEffect(() => {
    (async () => {
      const { data } = await supabase.from('ajustes').select('clave,valor').eq('clave','clinica_salas').maybeSingle()
      try { const v = JSON.parse((data as any)?.valor || '[]'); if (Array.isArray(v) && v.length) setSalas(v) } catch {}
    })()
  }, [])

  /**
   * Traer de la agenda los que vienen en esa franja. Se llama sola.
   *
   * NO HAY BOTÓN. Al abrir el taller ya sabemos la fecha, la sala y la franja que está
   * corriendo: pedirle además que pulse "traer" era un paso sin decisión detrás.
   *
   * EN PANTALLA SOLO ESTÁ LA FRANJA ACTUAL. La primera versión acumulaba —cambiabas de
   * hora y los de la anterior seguían ahí— y con 110 personas al día la lista se hacía
   * inútil en dos cambios: solo cambiaba el número del selector.
   *
   * Lo ESCRITO de quien siga en la nueva franja se conserva: no se recarga su ficha, se
   * deja tal cual, porque recargarla borraría series a medio teclear. Y que alguien salga
   * de la lista no pierde nada: el autoguardado ya lo ha escrito.
   *
   * Se lee la selección por REFERENCIA y no del estado. Si `seleccion` fuera dependencia
   * del efecto que llama aquí, cada paciente añadido lo dispararía otra vez y la carga se
   * repetiría en bucle.
   */
  async function traerDeAgenda() {
    setTrayendo(true); setAvisoAgenda('')
    try {
      const delDia = await pacientesDelDia(fecha, sala || undefined, hora || undefined)
      const previos = seleccionRef.current
      const lista: any[] = []
      for (const d of delDia) {
        const ya = previos.find((s:any) => s.paciente.id === d.pacienteId)
        if (ya) { lista.push(ya); continue }        // lo suyo se queda como esté
        const datos = d.sesion ? await cargarDatosSesion(d.pacienteId, d.sesion) : []
        lista.push({
          paciente: d.paciente,
          sesionId: d.sesion?.id || '',
          sesiones: d.disponibles,
          datos, cargado: !!d.sesion, finalizado: false,
          citaId: d.citaId, estado: d.estado, hora: d.hora, sala: d.sala,
          origen: d.origen, sesionVieja: d.sesionVieja,
        })
        cargarObjsPaciente(d.pacienteId)
      }

      const final = lista
      setSeleccion(final)
      // Si el que estaba abierto ya no está en la franja, no se deja un panel colgado.
      setActivo(a => final.some((x:any) => x.paciente.id === a) ? a : (final[0]?.paciente.id || ''))

      // AQUÍ NO SE CUENTA NADA. El recuento de "a X les falta sesión" se calcula en el
      // render a partir de la lista viva. Antes se congelaba en este texto y, al ponerle
      // la sesión a alguien, seguía diciendo que le faltaba a uno: el aviso hablaba de un
      // momento que ya había pasado. Mismo motivo por el que la versión de una sesión sale
      // de la cadena y no de una columna.
      const donde = (hora ? 'a las ' + hora : 'todo el día') + (sala ? ' · sala ' + sala : '')
      setAvisoAgenda(delDia.length === 0 ? `Nadie citado ${donde}.` : '')
    } catch (e: any) {
      // Antes esto no existía y el fallo salía como "no hay citas", que es mentira y manda
      // a buscar el problema al sitio equivocado.
      setAvisoAgenda(e?.message || 'No se ha podido leer la agenda')
    } finally { setTrayendo(false) }
  }

  const seleccionRef = useRef<any[]>([])
  useEffect(() => { seleccionRef.current = seleccion }, [seleccion])

  // Cargar sola al abrir y cada vez que cambia el día, la sala o la franja.
  //
  // Se esperan las DOS cosas: los filtros recuperados y las franjas del día leídas. Con
  // solo la primera, `hora` seguía vacía y la primera carga se traía el día entero.
  useEffect(() => {
    if (!listo || !horasListas) return
    traerDeAgenda()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fecha, sala, hora, listo, horasListas])

  useEffect(() => {
    (async () => {
      const { data } = await supabase.from('objetivos').select('id,nombre,color').eq('activo',true).order('nombre')
      setObjetivosLib(data||[])
    })()
  }, [])

  async function cargarObjsPaciente(pid: string) {
    const { data } = await supabase.from('pacientes_objetivos').select('objetivo_id,origen,vias').eq('paciente_id', pid)
    setObjsPorPaciente(prev => ({ ...prev, [pid]: data||[] }))
  }

  async function toggleObjetivo(pid: string, objetivoId: string, ejercicioId?: string, ejercicioNombre?: string) {
    const actuales = objsPorPaciente[pid] || []
    const existe = actuales.find((o:any)=>o.objetivo_id===objetivoId)
    const ref = ejercicioId || ''
    const etiqueta = ejercicioNombre ? ('Ejercicio: ' + ejercicioNombre) : 'Ejecucion'
    if (existe) {
      const vias = Array.isArray(existe.vias) ? existe.vias : []
      const restantes = vias.filter((v:any)=>!(v.tipo==='ejecucion' && v.ref===ref))
      if (restantes.length===0) {
        const { error } = await supabase.from('pacientes_objetivos')
          .delete().eq('paciente_id', pid).eq('objetivo_id', objetivoId)
        if (error) { alert('Error: '+error.message); return }
      } else {
        const r = await guardarVias(pid, objetivoId, restantes, { logradoAntes: !!existe.logrado, contexto: 'la ejecución' })
        if (!r.ok) { alert('Error: '+r.error); return }
      }
    } else {
      const nuevaVia = { tipo:'ejecucion', ref, etiqueta, resuelto:false, fecha_resuelto:null }
      const r = await abrirObjetivo(pid, objetivoId, nuevaVia, 'ejecucion')
      if (!r.ok) { alert('Error: '+r.error); return }
    }
    await cargarObjsPaciente(pid)
  }

  async function resolverViaEjecucionClase(pid: string, objetivoIds: string[], ejercicioId: string, resuelto: boolean) {
    for (const oid of objetivoIds) {
      await resolverVia(pid, oid, 'ejecucion', ejercicioId, resuelto, 'la ejecución')
    }
    cargarObjsPaciente(pid)
  }


  // cargar ejercicios+borrador de una sesion sin depender del estado (para restaurar)
  async function cargarDatosSesion(pid: string, ses: any) {
    const ejs: any[] = []
    ;(ses.partes||[]).forEach((parte:any)=>{
      ;(parte.ejercicios||[]).forEach((ej:any)=>{
        const n = parseInt(ej.series)||4
        ejs.push({
          ejercicio_id: ej.ejercicio_id||null, nombre: ej.nombre,
          imagen_url: ej.imagen_url||'', variante: ej.variante||'',
          plan:{peso:ej.peso,reps:ej.reps},
          series: Array.from({length:n},()=>({peso:'',reps:''})),
          comentario:'', ultimo:null, guardado:false,
        })
      })
    })
    const ids = ejs.map(e=>e.ejercicio_id).filter(Boolean)
    if (ids.length) {
      const { data: tipos } = await supabase.from('ejercicios').select('id,tipo_medida,items_ejecucion,feedbacks').in('id', ids)
      const tipoMap:Record<string,any>={}
      ;(tipos||[]).forEach((t:any)=>{ tipoMap[t.id]=t })
      ejs.forEach(e=>{
        const t = e.ejercicio_id ? tipoMap[e.ejercicio_id] : null
        e.tipo_medida = t?.tipo_medida || 'peso_reps'
        e.items = t?.items_ejecucion || []
        e.feedbacks = t?.feedbacks || []
        if (!e.items_evaluados) e.items_evaluados = {}
      })
    } else {
      ejs.forEach(e=>{ e.tipo_medida = 'peso_reps'; e.items = []; e.feedbacks = []; if(!e.items_evaluados) e.items_evaluados = {} })
    }
    if (ids.length) {
      const { data: fin } = await supabase.from('registros_ejercicio')
        .select('ejercicio_id,series,fecha,created_at,comentario')
        .eq('paciente_id', pid).eq('finalizado', true).in('ejercicio_id', ids)
        .order('fecha',{ascending:false}).order('created_at',{ascending:false})
      const ultMap:Record<string,any>={}
      ;(fin||[]).forEach((r:any)=>{ if(!ultMap[r.ejercicio_id]) ultMap[r.ejercicio_id]=r })
      const { data: curso } = await supabase.from('registros_ejercicio')
        .select('ejercicio_id,series,comentario,items_evaluados')
        .eq('paciente_id', pid).eq('sesion_id', ses.id).eq('finalizado', false).in('ejercicio_id', ids)
      const cursoMap:Record<string,any>={}
      ;(curso||[]).forEach((r:any)=>{ cursoMap[r.ejercicio_id]=r })
      ejs.forEach(e=>{
        if (e.ejercicio_id){
          e.ultimo = ultMap[e.ejercicio_id]?.series || null
          e.ultimoComent = ultMap[e.ejercicio_id]?.comentario || ''
          const c = cursoMap[e.ejercicio_id]
          if (c && Array.isArray(c.series)) {
            // fusionar: mantener nº de series de la plantilla, rellenar con lo guardado
            const merged = e.series.map((orig:any, idx:number) => c.series[idx] || orig)
            // si el borrador tenia mas series que la plantilla, añadirlas
            for (let k=e.series.length; k<c.series.length; k++) merged.push(c.series[k])
            e.series = merged; e.comentario = c.comentario||''; e.guardado = true
          }
          if (c && c.items_evaluados && typeof c.items_evaluados==='object') e.items_evaluados = c.items_evaluados
        }
      })
    }
    return ejs
  }

  /**
   * Solo se recuerda la SALA. Ni el día ni la franja.
   *
   * La sala es una preferencia —trabajas en la tuya— y no cambia sola. El día y la hora
   * sí: al volver al taller lo que hace falta es lo que está pasando AHORA, no la franja
   * que estabas mirando hace un rato. Recordarlas hacía que entrases por la mañana y te
   * saliera la clase de ayer por la tarde.
   *
   * Antes se guardaba en `sessionStorage` la lista entera de pacientes con su sesión, y al
   * volver se rehacía uno por uno. Ya no hace falta y era una segunda copia de algo que ya
   * está en dos sitios mejores: quién viene lo dice la agenda, y lo tecleado lo devuelve
   * `cargarDatosSesion`, que lee el borrador de `registros_ejercicio`. Recargar la página
   * en mitad de una clase no pierde nada.
   */
  useEffect(() => {
    try {
      const raw = sessionStorage.getItem(SKEY)
      if (raw) {
        const g = JSON.parse(raw)
        if (g.sala) setSala(g.sala)
      }
    } catch {}
    restaurado.current = true
    setListo(true)
  }, [])

  // `listo` y no `restaurado.current`: el ref ya vale true en el mismo ciclo en que se
  // recupera, así que este efecto llegaba a correr con los valores por defecto todavía
  // puestos y machacaba en disco lo que se acababa de leer.
  useEffect(() => {
    if (!listo) return
    try { sessionStorage.setItem(SKEY, JSON.stringify({ sala })) } catch {}
  }, [listo, sala])

  const nombrePac = (p:any) => `${p.nombre} ${p.apellidos||''}`.trim()

  /**
   * NO SE AÑADE NI SE QUITA GENTE AQUÍ.
   *
   * Había un buscador de "añadir paciente", una ✕ en cada ficha y un "limpiar todo". Se
   * han quitado los tres: quién entrena lo decide la AGENDA. Con dos sitios donde apuntar
   * quién viene, el desajuste está garantizado —alguien acaba en el taller sin cita, o con
   * cita y fuera del taller— y no hay forma de saber cuál de los dos tiene razón.
   *
   * Si alguien se pasa sin avisar, se le pone la cita en la agenda y aparece aquí.
   */

  /**
   * Poner una sesión a alguien, desde el taller.
   *
   * SE GUARDA EN LA CITA. El taller, la agenda y Planificación mandan por igual sobre qué
   * sesión toca ese día: los tres escriben `citas.sesion_id`. Si lo cambias aquí, mañana
   * la agenda y la ficha dicen lo mismo, porque es el mismo dato y no tres copias.
   *
   * Los datos se rellenan con `cargarDatosSesion`, la misma que usa la carga de la franja.
   * Antes esto tenía su propia copia de esas sesenta líneas —tipos de medida, último
   * registro, borrador en curso— y bastaba tocar una para que las dos dejaran de coincidir.
   */
  async function elegirSesion(pid: string, ses: any) {
    const sesionId = ses?.id || ''
    const item = seleccionRef.current.find((s:any) => s.paciente.id === pid)
    if (item?.citaId) {
      const r = await asignarSesionACita(item.citaId, sesionId || null)
      if (!r.ok) { alert('No se ha podido guardar la sesión en la cita: ' + r.error); return }
    }
    if (!sesionId) {
      setSeleccion(prev => prev.map(s => s.paciente.id===pid ? {...s, sesionId:'', datos:[], cargado:false, finalizado:false} : s))
      return
    }
    const datos = await cargarDatosSesion(pid, ses)
    setSeleccion(prev => prev.map(s => {
      if (s.paciente.id !== pid) return s
      // La recién elegida entra en su lista aunque venga de la biblioteca, para que se
      // vea como puesta y se pueda volver a ella sin reabrir el buscador.
      const sesiones = s.sesiones.some((x:any) => x.id === sesionId) ? s.sesiones : [ses, ...s.sesiones]
      return { ...s, sesionId, sesiones, datos, cargado:true, finalizado:false }
    }))
  }

  function programarAutosave(pid:string, ei:number, ejData:any, sesionId:string){
    const key = `${pid}_${ei}`
    if (timers.current[key]) clearTimeout(timers.current[key])
    timers.current[key] = setTimeout(()=>{ autoguardar(pid, ei, ejData, sesionId) }, 700)
  }

  async function autoguardar(pid:string, ei:number, ej:any, sesionId:string){
    const seriesLlenas = ej.series.filter((x:any)=>x.peso!==''||x.reps!==''||(x.segundos!==''&&x.segundos!==undefined))
    const hayComent = (ej.comentario||'').trim()!==''
    const iv = ej.items_evaluados || {}
    const hayItems = Object.values(iv).some((v:any)=>v===true)
    if (seriesLlenas.length===0 && !hayComent && !hayItems) return
    const fila:any = {
      paciente_id: pid, ejercicio_id: ej.ejercicio_id, ejercicio_nombre: ej.nombre,
      sesion_id: sesionId, series: seriesLlenas, comentario: ej.comentario||null, items_evaluados: iv, finalizado:false,
      // Sin esto, la progresión de cargas mezclaba unilateral y bilateral.
      variante: ej.variante || null,
    }
    let error
    if (ej.ejercicio_id){
      const { data: existe } = await supabase.from('registros_ejercicio')
        .select('id').eq('paciente_id',pid).eq('ejercicio_id',ej.ejercicio_id)
        .eq('sesion_id',sesionId).eq('finalizado',false).maybeSingle()
      if (existe){
        ({ error } = await supabase.from('registros_ejercicio')
          .update({ series:seriesLlenas, comentario:ej.comentario||null, ejercicio_nombre:ej.nombre, items_evaluados:iv, variante:ej.variante||null })
          .eq('id', existe.id))
      } else {
        ({ error } = await supabase.from('registros_ejercicio').insert(fila))
      }
    } else {
      ({ error } = await supabase.from('registros_ejercicio').insert(fila))
    }
    if (error){ console.error('autoguardar clase', error.message); return }
    setSeleccion(prev => prev.map(s=>{
      if (s.paciente.id!==pid) return s
      const datos=[...s.datos]; if(datos[ei]) datos[ei]={...datos[ei],guardado:true}
      return {...s,datos}
    }))
  }

  function mutarSerie(pid:string, ei:number, si:number, campo:string, val:string){
    setSeleccion(prev => prev.map(s=>{
      if (s.paciente.id!==pid) return s
      const datos=[...s.datos]; const series=[...datos[ei].series]
      series[si]={...series[si],[campo]:val}
      datos[ei]={...datos[ei],series,guardado:false}
      programarAutosave(pid,ei,datos[ei],s.sesionId)
      return {...s,datos}
    }))
  }
  function addSerie(pid:string, ei:number){
    setSeleccion(prev => prev.map(s=>{
      if (s.paciente.id!==pid) return s
      const datos=[...s.datos]; datos[ei]={...datos[ei],series:[...datos[ei].series,{peso:'',reps:''}]}
      return {...s,datos}
    }))
  }
  function quitarSerie(pid:string, ei:number, si:number){
    setSeleccion(prev => prev.map(s=>{
      if (s.paciente.id!==pid) return s
      const datos=[...s.datos]; datos[ei]={...datos[ei],series:datos[ei].series.filter((_:any,i:number)=>i!==si),guardado:false}
      programarAutosave(pid,ei,datos[ei],s.sesionId)
      return {...s,datos}
    }))
  }
  function setComent(pid:string, ei:number, val:string){
    setSeleccion(prev => prev.map(s=>{
      if (s.paciente.id!==pid) return s
      const datos=[...s.datos]; datos[ei]={...datos[ei],comentario:val,guardado:false}
      programarAutosave(pid,ei,datos[ei],s.sesionId)
      return {...s,datos}
    }))
  }

  function toggleItem(pid:string, ei:number, ii:number){
    setSeleccion(prev => prev.map(s=>{
      if (s.paciente.id!==pid) return s
      const datos=[...s.datos]
      // Por TEXTO, no por posición: ver lib/ejecucion.ts.
      const itAct=(datos[ei].items||[])[ii]
      const texto=typeof itAct==='string'?itAct:itAct?.texto
      if(!texto) return prev
      const iv=alternarItem(datos[ei].items_evaluados, texto)
      datos[ei]={...datos[ei],items_evaluados:iv,guardado:false}
      programarAutosave(pid,ei,datos[ei],s.sesionId)
      const ej = datos[ei]
      const item = (ej.items||[])[ii]
      const cumplido = iv[texto]===true
      if (item && (item.objetivos||[]).length>0 && ej.ejercicio_id) {
        resolverViaEjecucionClase(pid, item.objetivos, ej.ejercicio_id, cumplido)
      }
      return {...s,datos}
    }))
  }

  async function finalizarPaciente(pid:string){
    const item = seleccion.find(s=>s.paciente.id===pid); if(!item) return
    // forzar guardado de todo lo lleno
    Object.keys(timers.current).forEach(k=>{ if(k.startsWith(pid+'_')){ clearTimeout(timers.current[k]); delete timers.current[k] } })
    for (let i=0;i<item.datos.length;i++){
      const ej=item.datos[i]
      const llenas=ej.series.filter((x:any)=>x.peso!==''||x.reps!==''||(x.segundos!==''&&x.segundos!==undefined))
      const hayComent=(ej.comentario||'').trim()!==''
      if (llenas.length>0 || hayComent) await autoguardar(pid,i,ej,item.sesionId)
    }
    // limpiar finalizados previos del dia y marcar
    const ids = item.datos.map((e:any)=>e.ejercicio_id).filter(Boolean)
    if (ids.length){
      await supabase.from('registros_ejercicio').delete()
        .eq('paciente_id',pid).eq('fecha',fecha).eq('finalizado',true).in('ejercicio_id',ids)
    }
    const { error } = await supabase.from('registros_ejercicio')
      .update({ finalizado:true })
      .eq('paciente_id',pid).eq('sesion_id',item.sesionId).eq('finalizado',false)
    if (error){ alert('Error al finalizar: '+error.message); return }
    setSeleccion(prev => prev.map(s=>s.paciente.id===pid?{...s,finalizado:true}:s))
  }

  const act = seleccion.find(s=>s.paciente.id===activo)
  // Derivado de la lista, no guardado: al poner una sesión, el número baja solo.
  const sinSesion = seleccion.filter(s=>!s.sesionId).length
  const progreso = (s:any)=> s.datos.length ? `${s.datos.filter((e:any)=>e.guardado).length}/${s.datos.length}` : ''

  return (
    <>
      {/* CABECERA CLASE */}
      <div style={{display:'flex',alignItems:'center',gap:10,marginBottom:12,background:'var(--w)',border:'1px solid var(--bd)',borderRadius:'var(--rl)',padding:'9px 13px',flexWrap:'wrap'}}>
        <span style={{fontSize:12,fontWeight:500,color:'var(--n)',display:'inline-flex',alignItems:'center',gap:6}}><Ic name="taller" size={14}/> Taller</span>
        <input type="date" className="input" value={fecha} onChange={e=>setFecha(e.target.value)} style={{maxWidth:150,fontSize:11}}/>
        {salas.length>1 && (
          <select className="input" value={sala} onChange={e=>setSala(e.target.value)} style={{maxWidth:110,fontSize:11}}>
            <option value="">Todas las salas</option>
            {salas.map(x=><option key={x} value={x}>Sala {x}</option>)}
          </select>
        )}
        <select className="input" value={hora} onChange={e=>setHora(e.target.value)} style={{maxWidth:150,fontSize:11}}>
          <option value="">Todo el día</option>
          {horas.map(h=><option key={h.hora} value={h.hora}>{h.hora} · {h.n}</option>)}
        </select>
        <span style={{fontSize:10,color:sinSesion>0?'var(--gd)':'var(--grl)'}}>
          {trayendo ? 'Cargando…' : avisoAgenda || (seleccion.length
            ? `${seleccion.length} ${hora ? 'a las '+hora : 'hoy'}${sala?' · sala '+sala:''}` +
              (sinSesion>0 ? ` · a ${sinSesion} le${sinSesion>1?'s':''} falta sesión` : '')
            : '')}
        </span>
        <div style={{flex:1}}/>
      </div>

      {/* CHIPS PACIENTES */}
      {seleccion.length>0 && (
        <div style={{display:'flex',gap:6,flexWrap:'wrap',marginBottom:12}}>
          {seleccion.map(s=>(
            <div key={s.paciente.id} onClick={()=>setActivo(s.paciente.id)}
              style={{display:'flex',alignItems:'center',gap:6,padding:'5px 10px',borderRadius:99,cursor:'pointer',
                border:`1.5px solid ${activo===s.paciente.id?'var(--g)':'var(--bd)'}`,
                background:activo===s.paciente.id?'var(--g)':'var(--w)',
                color:activo===s.paciente.id?'#fff':'var(--gr)'}}>
              {s.finalizado&&<span style={{fontSize:9}}>✓</span>}
              {s.hora&&<span style={{fontSize:8,opacity:.75}}>{s.hora}</span>}
              {!s.sesionId&&<span style={{fontSize:8,opacity:.9}} title="Sin sesión">◦</span>}
              <span style={{fontSize:10,textDecoration:s.estado==='falta'?'line-through':'none',opacity:s.estado==='falta'?.55:1}}>{nombrePac(s.paciente)}</span>
              {!s.finalizado&&progreso(s)&&<span style={{fontSize:8,opacity:.8}}>{progreso(s)}</span>}
            </div>
          ))}
        </div>
      )}

      {/* CUERPO */}
      {seleccion.length===0 ? (
        <div style={{textAlign:'center',padding:60,color:'var(--grl)',fontSize:11}}>
          No hay nadie citado en esa franja. Cambia la hora o la sala arriba. Si alguien se pasa sin avisar, ponle la cita en la agenda y aparecerá aquí.
        </div>
      ) : !act ? (
        <div style={{textAlign:'center',padding:40,color:'var(--grl)',fontSize:11}}>Selecciona un paciente arriba para anotar su trabajo.</div>
      ) : (
        <div className="card">
          <div style={{display:'flex',alignItems:'center',gap:10,marginBottom:10}}>
            <div style={{fontSize:13,fontWeight:400,color:'var(--n)',flex:1}}>
              {nombrePac(act.paciente)}
              {act.hora&&<span style={{fontSize:9,color:'var(--grl)',marginLeft:8}}>cita {act.hora}{act.sala?' · sala '+act.sala:''}</span>}
              {act.finalizado&&<span style={{fontSize:9,color:'var(--g)',marginLeft:8}}>✓ finalizado</span>}
            </div>
            {/* UN SOLO BOTÓN. Elegir de dónde, y el taller te lleva a la pantalla que ya
                existe para eso. Al asignar allí, vuelves aquí. */}
            <div style={{position:'relative'}}>
              <button className={act.sesionId ? 'btn btn-s btn-sm' : 'btn btn-p btn-sm'}
                onClick={()=>setEligiendo(eligiendo===act.paciente.id ? null : act.paciente.id)}
                style={{fontSize:11,maxWidth:300}}>
                <Ic name="fuerza" size={12}/> {act.sesionId
                  ? (act.sesiones.find((x:any)=>x.id===act.sesionId)?.nombre || 'Sesión')
                  : 'Asignar sesión'}
              </button>
              {eligiendo===act.paciente.id && (
                <div style={{position:'absolute',top:'100%',right:0,zIndex:30,marginTop:4,minWidth:190,
                  border:'1px solid var(--bd)',borderRadius:8,background:'var(--w)',boxShadow:'0 4px 16px rgba(0,0,0,.12)',overflow:'hidden'}}>
                  {([['ficha','Sus sesiones'],['biblioteca','Biblioteca']] as const).map(([d,l])=>(
                    <div key={d} onClick={()=>{
                      setEligiendo(null)
                      router.push(rutaDeAsignacion(d as any, {
                        citaId: act.citaId, pacienteId: act.paciente.id,
                        etiqueta: nombrePac(act.paciente) + (act.hora ? ' · ' + act.hora : ''),
                        volver: '/taller',
                      }))
                    }} style={{padding:'9px 12px',cursor:'pointer',fontSize:11,borderBottom:'1px solid var(--bl)'}}
                      onMouseOver={e=>(e.currentTarget as HTMLElement).style.background='var(--gl)'}
                      onMouseOut={e=>(e.currentTarget as HTMLElement).style.background=''}>{l}</div>
                  ))}
                </div>
              )}
            </div>
            {act.sesionId && act.datos.length>0 && (
              <button className="btn btn-p btn-sm" onClick={()=>finalizarPaciente(act.paciente.id)}>✓ Guardar y finalizar</button>
            )}
          </div>

          {act.sesionVieja && act.sesionId && (
            <div style={{fontSize:10,color:'var(--gd)',background:'var(--gl)',border:'1px solid var(--bd)',borderRadius:6,padding:'6px 9px',marginBottom:8}}>
              La sesión de esta cita es de una tanda anterior. Se ejecuta igual —es lo que se planificó para hoy—, pero si ya no toca, elige otra arriba.
            </div>
          )}

          {!act.sesionId ? (
            <div style={{textAlign:'center',padding:30,color:'var(--grl)',fontSize:10}}>Sin sesión para hoy. Dale a <b style={{color:'var(--gr)'}}>Asignar sesión</b> arriba.</div>
          ) : act.datos.length===0 ? (
            <div style={{textAlign:'center',padding:30,color:'var(--grl)',fontSize:10}}>Esta sesión no tiene ejercicios.</div>
          ) : act.datos.map((ej:any,ei:number)=>(
            <div key={ei} style={{background:'var(--bl)',borderRadius:8,border:`1px solid ${ej.guardado?'var(--g)':'var(--bd)'}`,marginBottom:8,padding:'9px 11px'}}>
              <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:7}}>
                {ej.imagen_url?<img src={ej.imagen_url} alt={ej.nombre} style={{width:30,height:30,objectFit:'cover',borderRadius:4}}/>:<div style={{width:30,height:30,background:'var(--bm)',borderRadius:4,display:'flex',alignItems:'center',justifyContent:'center',color:'var(--grl)'}}><Ic name="fuerza" size={14}/></div>}
                <div style={{flex:1}}>
                  <div style={{fontSize:11,fontWeight:400,color:'var(--n)'}}>{ej.nombre}{ej.variante&&<span style={{fontSize:8,padding:'1px 5px',borderRadius:99,background:'var(--gl)',color:'var(--gd)',marginLeft:6}}>{ej.variante}</span>}</div>
                  {!ej.ultimo&&<div style={{fontSize:9,color:'var(--grl)',marginTop:2}}>Sin registro previo{ej.plan?.peso?` · plan ${ej.plan.peso}kg`:''}</div>}
                  {ej.ultimoComent&&<div style={{fontSize:9,color:'var(--g)',marginTop:2,fontStyle:'italic',display:'flex',alignItems:'center',gap:4}}><Ic name="mensaje" size={10}/> última vez: {ej.ultimoComent}</div>}
                </div>
                {ej.guardado&&<span style={{fontSize:9,color:'var(--g)'}}>✓ guardado</span>}
              </div>
              {ej.series.map((ser:any,si:number)=>{
                const tm = ej.tipo_medida || 'peso_reps'
                const fmtPrev = (x:any) => {
                  if (!x) return null
                  if (tm==='tiempo') return x.segundos?`${x.segundos}s`:null
                  if (tm==='peso_tiempo') return (x.peso||x.segundos)?`${x.peso||'—'}kg·${x.segundos||'—'}s`:null
                  return (x.peso||x.reps)?`${x.peso||'—'}${x.reps?'×'+x.reps:''}`:null
                }
                const prev = ej.ultimo && ej.ultimo[si] ? fmtPrev(ej.ultimo[si]) : null
                return (
                  <div key={si} style={{display:'flex',alignItems:'center',gap:8,marginBottom:5}}>
                    <span style={{fontSize:10,color:'var(--grl)',width:16,textAlign:'center'}}>{si+1}</span>
                    {tm!=='tiempo' && <>
                      <input inputMode="decimal" value={ser.peso||''} onChange={e=>mutarSerie(act.paciente.id,ei,si,'peso',e.target.value)} placeholder="—" style={{width:56,fontSize:12,padding:'5px 6px',border:'1px solid var(--bd)',borderRadius:5,textAlign:'center'}}/>
                      <span style={{fontSize:9,color:'var(--grl)'}}>kg</span>
                    </>}
                    {tm==='peso_reps' && <>
                      <span style={{fontSize:11,color:'var(--bm)'}}>×</span>
                      <input inputMode="numeric" value={ser.reps||''} onChange={e=>mutarSerie(act.paciente.id,ei,si,'reps',e.target.value)} placeholder="—" style={{width:56,fontSize:12,padding:'5px 6px',border:'1px solid var(--bd)',borderRadius:5,textAlign:'center'}}/>
                      <span style={{fontSize:9,color:'var(--grl)'}}>reps</span>
                    </>}
                    {(tm==='tiempo'||tm==='peso_tiempo') && <>
                      {tm==='peso_tiempo' && <span style={{fontSize:11,color:'var(--bm)'}}>·</span>}
                      <input inputMode="numeric" value={ser.segundos||''} onChange={e=>mutarSerie(act.paciente.id,ei,si,'segundos',e.target.value)} placeholder="—" style={{width:56,fontSize:12,padding:'5px 6px',border:'1px solid var(--bd)',borderRadius:5,textAlign:'center'}}/>
                      <span style={{fontSize:9,color:'var(--grl)'}}>seg</span>
                    </>}
                    <div style={{flex:1}}/>
                    {prev&&<span style={{fontSize:10,color:'var(--g)',whiteSpace:'nowrap'}}>ant: {prev}</span>}
                    {ej.series.length>1&&<button onClick={()=>quitarSerie(act.paciente.id,ei,si)} style={{fontSize:11,color:'var(--red)',background:'none',border:'none',cursor:'pointer',padding:'2px 5px'}}>✕</button>}
                  </div>
                )
              })}
              <div style={{display:'flex',alignItems:'center',gap:8,marginTop:6}}>
                <button onClick={()=>addSerie(act.paciente.id,ei)} style={{fontSize:9,color:'var(--g)',background:'none',border:'none',cursor:'pointer'}}>+ serie</button>
                <input value={ej.comentario} onChange={e=>setComent(act.paciente.id,ei,e.target.value)} placeholder="Comentario..." style={{flex:1,fontSize:10,padding:'4px 7px',border:'1px solid var(--bd)',borderRadius:4}}/>
              </div>
              {(ej.items||[]).length>0 && (
                <div style={{marginTop:8,paddingTop:8,borderTop:'1px dashed var(--bm)'}}>
                  <div style={{fontSize:8,fontWeight:600,color:'var(--grl)',letterSpacing:.4,textTransform:'uppercase',marginBottom:5}}>Ejecución</div>
                  {(ej.items||[]).map((it:any,ii:number)=>{
                    const cumple = itemMarcado(ej.items_evaluados, typeof it==='string'?it:it?.texto, ii)
                    const objs = (it.objetivos||[]).map((oid:string)=>objetivosLib.find((o:any)=>o.id===oid)).filter(Boolean)
                    const objsPac = objsPorPaciente[act.paciente.id] || []
                    return (
                      <div key={ii} style={{padding:'3px 0'}}>
                        <div onClick={()=>toggleItem(act.paciente.id,ei,ii)} style={{display:'flex',alignItems:'center',gap:7,cursor:'pointer'}}>
                          <span style={{width:16,height:16,borderRadius:4,border:`1.5px solid ${cumple?'var(--g)':'var(--bd)'}`,background:cumple?'var(--g)':'transparent',color:'#fff',fontSize:11,display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0}}>{cumple?'✓':''}</span>
                          <span style={{fontSize:10,color:'var(--n)'}}>{it.texto}</span>
                        </div>
                        {!cumple && objs.length>0 && (
                          <div style={{display:'flex',flexWrap:'wrap',gap:4,marginLeft:23,marginTop:3}}>
                            {objs.map((o:any)=>{
                              const yaActivo = objsPac.some((po:any)=>po.objetivo_id===o.id)
                              return (
                                <span key={o.id} onClick={()=>toggleObjetivo(act.paciente.id,o.id,ej.ejercicio_id,ej.nombre)}
                                  title={yaActivo?'Quitar objetivo del paciente':'Activar este objetivo'}
                                  style={{fontSize:8,padding:'2px 7px',borderRadius:99,cursor:'pointer',border:`1px solid ${'var(--g)'}`,background:yaActivo?('var(--g)'):'var(--w)',color:yaActivo?'#fff':('var(--gd)')}}>
                                  {yaActivo?'✓ ':'+ '}{o.nombre}
                                </span>
                              )
                            })}
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              )}
              {(ej.feedbacks||[]).length>0 && (
                <div style={{marginTop:6,display:'flex',flexWrap:'wrap',gap:4}}>
                  {(ej.feedbacks||[]).map((fb:any,fi:number)=>(
                    <span key={fi} style={{fontSize:9,padding:'2px 7px',borderRadius:99,background:'var(--bl)',color:'var(--gr)',display:'inline-flex',alignItems:'center',gap:3}}><Ic name="mensaje" size={9}/> {fb.texto}</span>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </>
  )
}
