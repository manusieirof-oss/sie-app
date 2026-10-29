'use client'
import { useEffect, useRef, useState } from 'react'
import CaraPaciente from '@/components/CaraPaciente'
import { Ic } from '@/lib/icons'
import { iconTipoClase } from '@/lib/tipos'
import { hoyISO } from '@/lib/fechas'
import ResponsableFranja from './ResponsableFranja'
import { responsableDe } from '@/lib/turnos'

export default function VistaDia({ fecha, hoy, fechaDisplay, citas, totalPersonas, clases, abrirPanel, setNuevaCita, setModal, horas, pausaInicio, pausaFin, descanso, maxPersonas, tiposCita=[], tiposClase=[], setEditandoCita, abrirDatosCita, abrirEntrenoCita, setVerAlertasCita, alertasPaciente=[], tareas=[], completarTarea, setModalTareas, salaFiltro='ambas', tiposFiltro=[], salas=['A','B'], turnos=[], perfiles=[], onTurnos, consulta=false, tocaTurnos=true, miUserId }: {
  /** Quien está dentro: sus clases salen resaltadas. */
  miUserId?: string | null
  /** Nivel 1: solo se consulta; de cada persona, solo el botón de su sesión (el taller). */
  consulta?: boolean
  /** Si puede cambiar quién lleva cada sala (lib/permisos: turnos). */
  tocaTurnos?: boolean
  fecha: string
  turnos?: any[]
  perfiles?: any[]
  onTurnos?: () => void
  hoy: string
  fechaDisplay: string
  citas: any[]
  totalPersonas: number
  clases: number
  abrirPanel: (c: any) => void
  setEditandoCita?: (c: any) => void
  abrirDatosCita?: (c: any) => void
  abrirEntrenoCita?: (c: any) => void
  setVerAlertasCita?: (c: any) => void
  alertasPaciente?: any[]
  tareas?: any[]
  completarTarea?: (id:string,v:boolean)=>void
  setModalTareas?: (v:boolean)=>void
  setNuevaCita: (fn: (p: any) => any) => void
  setModal: (v: boolean) => void
  horas?: string[]
  pausaInicio?: string
  pausaFin?: string
  descanso?: number
  maxPersonas?: number
  tiposCita?: any[]
  tiposClase?: any[]
  salaFiltro?: string
  tiposFiltro?: string[]
  salas?: string[]
}) {
  const DESCANSO = descanso || 10
  const MAX = maxPersonas || 6
  const HORAS = horas && horas.length > 0 ? horas : ['08:30','09:30','10:30','11:30','15:30','16:30','17:30','18:30','19:30','20:30','21:30']
  const PAUSA_INICIO = pausaInicio || '12:30'
  const PAUSA_FIN = pausaFin || '15:30'
  const SALAS = salaFiltro==='ambas' ? salas : [salaFiltro]
  // minmax(0,1fr) y no 1fr: con 1fr el mínimo es el contenido, así que una sala con
  // nombres largos (o los selects en tablet) le robaba ancho a la otra y las columnas
  // dejaban de medir lo mismo.
  const GT = '58px '+SALAS.map(()=>'minmax(0,1fr)').join(' ')
  const filtrando = (tiposFiltro?.length||0) > 0

  /**
   * Al abrir el día de hoy, la agenda arranca en la hora que es.
   *
   * Empezar siempre a las 8:30 obligaba a bajar a mano cada vez que se entraba, y a media
   * tarde eso es media pantalla de horas ya pasadas. Se coloca la franja en curso arriba
   * del todo (la última que ya ha empezado), justo debajo de la cabecera de salas.
   *
   * Solo se hace UNA VEZ por día y por horario: si se recarga la agenda después de crear
   * o cambiar una cita, no se vuelve a mover, porque estarías mirando otra hora y el salto
   * sería justo lo que se quería evitar.
   */
  const scrollRef = useRef<HTMLDivElement|null>(null)
  const yaColocado = useRef('')
  const horasClave = HORAS.join(',')
  useEffect(() => {
    if (fecha !== hoy) return
    const cont = scrollRef.current
    if (!cont) return
    const clave = fecha + '|' + horasClave
    if (yaColocado.current === clave) return
    const ahora = new Date()
    const minAhora = ahora.getHours()*60 + ahora.getMinutes()
    const aMinutos = (h:string) => { const [a,b] = h.split(':').map(Number); return (a||0)*60 + (b||0) }
    // La franja en curso es la última que ya ha empezado. Antes de abrir, la primera.
    let destino = HORAS[0]
    for (const h of HORAS) if (aMinutos(h) <= minAhora) destino = h
    const fila = cont.querySelector(`[data-hora="${destino}"]`) as HTMLElement|null
    if (!fila) return
    const ALTO_CABECERA = 40
    const y = fila.getBoundingClientRect().top - cont.getBoundingClientRect().top + cont.scrollTop
    cont.scrollTop = Math.max(0, y - ALTO_CABECERA)
    yaColocado.current = clave
  }, [fecha, hoy, horasClave])

  const colorTipo = (t:string) => (tiposClase.find((x:any)=>x.valor===t)?.color) || '#5A969E'
  const nombreTipo = (t:string) => (tiposClase.find((x:any)=>x.valor===t)?.nombre) || (t ? t.charAt(0).toUpperCase()+t.slice(1) : 'Clase')
  const iconTipo = (t:string) => iconTipoClase(t, tiposClase.find((x:any)=>x.valor===t)?.icono)
  const tint = (hex:string, a:number) => {
    const h=(hex||'#5A969E').replace('#','')
    const n=h.length===3?h.split('').map(x=>x+x).join(''):h
    const r=parseInt(n.slice(0,2),16)||90, g=parseInt(n.slice(2,4),16)||150, b=parseInt(n.slice(4,6),16)||158
    return `rgba(${r},${g},${b},${a})`
  }

  function getCitasSlot(h: string, sala: string) {
    return citas.filter(c=>c.hora.startsWith(h)&&c.sala===sala&&c.fecha===fecha)
  }

  /** La franja acaba donde empieza la siguiente; la ultima, una hora despues. */
  const finDe = (h:string) => {
    const i = HORAS.indexOf(h)
    if (i >= 0 && i < HORAS.length - 1) return HORAS[i + 1]
    const [hh, mm] = h.split(':').map(Number)
    return String((hh + 1) % 24).padStart(2, '0') + ':' + String(mm || 0).padStart(2, '0')
  }

  function abrirNueva(h:string, sala:string) {
    setNuevaCita((p:any)=>({...p,fecha,hora:h,sala})); setModal(true)
  }

  // Iniciales para el circulito: nombre y primer apellido.
  const iniciales = (c:any) => (((c.pacientes?.nombre||'').trim()[0]||'') + ((c.pacientes?.apellidos||'').trim()[0]||'')).toUpperCase() || '·'

  function FilaPaciente({ c }: { c:any }) {
    const falta = c.estado==='falta'
    const tieneAlerta = alertasPaciente.some((a:any)=>a.paciente_id===c.paciente_id)
    // El tipo de clase ya no lleva icono ni filtro a la vista: queda como un punto de
    // color al final, que se distingue de un vistazo sin ocupar sitio.
    const col = colorTipo(c.tipo)
    const accion = (titulo:string, icono:string, fn?:()=>void) => (
      <button title={titulo} data-guia={'agenda-' + icono} onClick={e=>{e.stopPropagation();fn&&fn()}}><Ic name={icono} size={15}/></button>
    )
    return (
      <div className={`ag-pac ${falta?'falta':''}`} onClick={()=>setVerAlertasCita&&setVerAlertasCita(c)} title={nombreTipo(c.tipo)}>
        <span className="ag-av"><CaraPaciente p={c.pacientes}/></span>
        <span className="ag-nom">{c.pacientes?.nombre} {c.pacientes?.apellidos}</span>
        {falta&&<span className="ag-tag" style={{background:'var(--redl)',color:'var(--red)'}}>falta</span>}
        {tieneAlerta&&<span className="ag-tag" style={{background:'var(--redl)',color:'var(--red)'}} title="Tiene alertas activas">alerta</span>}
        {c._ultimaBono&&<span className="ag-tag" style={{background:'var(--ambl)',color:'#8A6410'}} title="Gasta la última sesión de su bono: toca renovar">última</span>}
        {/* Solo al pasar el ratón (en tablet, siempre: ver .ag-acc en globals.css). */}
        <span className="ag-acc">
          {accion('Entrenamiento','entreno',()=>abrirEntrenoCita&&abrirEntrenoCita(c))}
          {!consulta && accion('Ver datos','usuario',()=>abrirDatosCita&&abrirDatosCita(c))}
          {!consulta && accion('Editar cita','editar',()=>setEditandoCita&&setEditandoCita({...c}))}
        </span>
        {!falta&&<span className="ag-punto" style={{background:col}}/>}
      </div>
    )
  }

  // Línea de "ahora": solo en el día de hoy, y se mueve sola cada minuto.
  const [, setTic] = useState(0)
  useEffect(() => {
    if (fecha !== hoy) return
    const t = setInterval(() => setTic(x => x + 1), 60000)
    return () => clearInterval(t)
  }, [fecha, hoy])
  const ahora = new Date()
  const minAhora = ahora.getHours()*60 + ahora.getMinutes()
  const aMin = (h:string) => { const [a,b] = h.split(':').map(Number); return (a||0)*60 + (b||0) }
  const horaAhora = String(ahora.getHours()).padStart(2,'0') + ':' + String(ahora.getMinutes()).padStart(2,'0')
  // Va justo encima de la primera franja que aún no ha empezado.
  const lineaAntesDe = fecha === hoy && minAhora >= aMin(HORAS[0])
    ? HORAS.find(h => aMin(h) > minAhora) || null
    : null

  return (
    <div className="ag-dia" data-guia="agenda-dia">
      <div ref={scrollRef} style={{overflowY:'auto',height:'100%'}}>
        <div className="ag-fila ag-salas" style={{gridTemplateColumns:GT}}>
          <div/>
          {SALAS.map(s=><div key={s}>Sala {s}</div>)}
        </div>
        {HORAS.map(h=>{
          // Hora sin nadie en ninguna sala: se encoge para no comerse la pantalla.
          const horaVacia = SALAS.every(s=>getCitasSlot(h,s).length===0)
          return (
          <div key={h} data-hora={h}>
            {h===PAUSA_FIN&&<div className="ag-pausa">Pausa · {PAUSA_INICIO} – {PAUSA_FIN}</div>}
            {h===lineaAntesDe&&<div className="ag-ahora"><span>{horaAhora}</span></div>}
            <div className={`ag-fila ag-sep ${horaVacia?'ag-compacta':''}`} style={{gridTemplateColumns:GT}}>
              <div className="ag-hora">{h}{!horaVacia&&<small>{finDe(h)===PAUSA_FIN?PAUSA_INICIO:finDe(h)}</small>}</div>
              {SALAS.map(sala=>{
                const scAll=getCitasSlot(h,sala)
                const scActivas=scAll.filter((c:any)=>c.estado!=='cancelada').sort((a:any,b:any)=>(a.estado==='falta'?1:0)-(b.estado==='falta'?1:0))
                const scCancAll=scAll.filter((c:any)=>c.estado==='cancelada')
                const sc = filtrando ? scActivas.filter((c:any)=>tiposFiltro.includes(c.tipo)) : scActivas
                const scCanceladas = filtrando ? scCancAll.filter((c:any)=>tiposFiltro.includes(c.tipo)) : scCancAll
                const sobre=!filtrando && scActivas.length>MAX
                const libres=filtrando?0:Math.max(0,MAX-scActivas.length)
                if (sc.length===0 && scCanceladas.length===0) {
                  return (
                    <div key={sala} className="ag-franja">
                      {filtrando || consulta
                        ? <div className="ag-vacia quieta">·</div>
                        : <div className="ag-vacia" onClick={()=>abrirNueva(h,sala)}>+ libre</div>}
                    </div>
                  )
                }
                const pct = Math.min(100, Math.round(scActivas.length / MAX * 100))
                return (
                  <div key={sala} className="ag-franja">
                    {/* SU CLASE, RESALTADA: con dos salas a la vez, que se vea cuál lleva. */}
                    <div className={`ag-clase ${sobre?'sobre':scActivas.length>=MAX?'llena':''}`}
                      style={(()=>{ const yo=(perfiles||[]).find((p:any)=>p.user_id===miUserId)?.id
                        return yo && responsableDe(turnos, fecha, h, sala).lista.some(t=>t.perfil_id===yo) ? { boxShadow:'0 0 0 2px var(--g)', borderRadius:10 } : undefined })()}>
                      <div className="ag-clase-cab">
                        {/* QUIEN SE HACE CARGO. Ver `lib/turnos`. */}
                        <ResponsableFranja turnos={turnos} perfiles={perfiles} fecha={fecha}
                          hora={h} horaFin={finDe(h)} sala={sala} onCambio={onTurnos||(()=>{})} soloVer={!tocaTurnos}/>
                        <span className="ag-aforo" title={sobre?'Grupo por encima del aforo':'Plazas ocupadas'}>
                          {!filtrando&&<span className="ag-barra"><i style={{width:pct+'%'}}/></span>}
                          {filtrando?sc.length:`${scActivas.length}/${MAX}`}
                        </span>
                      </div>
                      {sc.map((c:any)=><FilaPaciente key={c.id} c={c}/>)}
                      {/* Las plazas libres en UNA línea: antes era una caja punteada por plaza. */}
                      {!filtrando&&!consulta&&(
                        <div className="ag-libre" onClick={()=>abrirNueva(h,sala)}>
                          <Ic name="mas" size={13}/>
                          {libres>0 ? `${libres} ${libres===1?'plaza libre':'plazas libres'}` : sobre ? 'Por encima del aforo · añadir' : 'Completa · añadir'}
                        </div>
                      )}
                      {scCanceladas.length>0&&(
                        <div className="ag-bajas" title="Bajas: liberan plaza. Pulsa para editar o deshacer.">
                          {scCanceladas.length===1?'Baja':'Bajas'} · {scCanceladas.map((c:any,i:number)=>(
                            <span key={c.id}>
                              {i>0&&<>, </>}
                              <span onClick={()=>{ if (!consulta) setEditandoCita&&setEditandoCita({...c}) }}>{c.pacientes?.nombre} {c.pacientes?.apellidos}</span>
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
          )
        })}
        <div style={{height:14}}/>
      </div>
    </div>
  )
}
