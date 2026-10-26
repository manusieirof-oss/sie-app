'use client'
import { useState, useEffect } from 'react'
import ImagenEjercicio from '@/components/ImagenEjercicio'
import ResumenSesion from '@/components/ResumenSesion'
import { VeloSustituirTodos } from '@/components/SustituirSesion'
import ModalEditarSesion from './ModalEditarSesion'
import ModalProgramarGrupo from './ModalProgramarGrupo'
import MonedaObjetivo from '@/components/MonedaObjetivo'
import FiltroObjetivos from '@/components/FiltroObjetivos'
import BuscadorPacientes from '@/components/BuscadorPacientes'
import { Ic } from '@/lib/icons'
import BarraAsignacion from '@/components/BarraAsignacion'
import { encargoDeLaUrl, asignarSesionYVolver, type Encargo } from '@/lib/asignarCita'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { textoDescanso } from '@/lib/capacidades'
import { esPlantilla, asignarPlantilla, duplicarSesion, duplicarPlantilla, usosDeSesion, eliminarSesion, modoParte, textoModo, descansoDeParte, transicionDeParte, modoDeSesion } from '@/lib/sesiones'
import HistorialAjustes from './HistorialAjustes'

type EjercicioSesion = {
  ejercicio_id: string
  nombre: string
  variante: string
  capacidad: string
  series: string
  reps: string
  peso: string
  tiempo: string
  nota: string
  imagen_url?: string
}

type Parte = {
  nombre: string
  ejercicios: EjercicioSesion[]
}

const VARIANTES = ['Bilateral','Unilateral','Alterno','Unipodal','Supino','Prono','Decúbito lateral']
const CAPACIDADES = ['Fuerza','Fuerza máxima','Movilidad','Estiramiento','Resistencia','Propiocepción','Coordinación']

export default function SesionesTab({ sesiones, pacientes, ejercicios, etiquetas, objetivos, cargar, getNombre, pacienteIdInicial, objetivoInicial }: any) {
  const [buscarSes, setBuscarSes] = useState('')
  /**
   * De quién es la sesión. Por defecto, PLANTILLAS.
   *
   * Aquí salían mezcladas las plantillas y las sesiones ya prescritas a pacientes, con el
   * mismo aspecto salvo una píldora, y solo las plantillas se pueden asignar. Así que la
   * mitad de la lista "se veía distinta y no dejaba asignar" sin que hubiera forma de
   * saber por qué. Son dos cosas distintas y ahora se eligen.
   */
  const [origen, setOrigen] = useState<'plantillas'|'pacientes'|'todas'>('plantillas')
  const [filtroObjetivos, setFiltroObjetivos] = useState<string[]>([])
  const [sesionVista, setSesionVista] = useState<any>(null)
  const [sustituyendo, setSustituyendo] = useState<any>(null)
  const [menuMas, setMenuMas] = useState(false)
  const [hechoSust, setHechoSust] = useState('')
  /** La sesión cuyo historial de cambios por día se está mirando. Solo lectura. */
  const [historialDe, setHistorialDe] = useState<any>(null)
  const [buscarBiblio, setBuscarBiblio] = useState('')
  const [filtroEtBiblio, setFiltroEtBiblio] = useState<string[]>([])
  const [sesionEditando, setSesionEditando] = useState<any>(null)
  /** Plantilla que se está asignando: abre el selector de paciente. */
  const [asignando, setAsignando] = useState<any>(null)
  /** Plantilla que se está programando a un grupo. Ver ModalProgramarGrupo. */
  const [grupo, setGrupo] = useState<any>(null)
  /**
   * Encargo del taller: se ha llegado aquí a poner la sesión de una cita concreta. En el
   * uso normal es null y la pantalla se comporta igual que siempre.
   */
  const [encargo, setEncargo] = useState<Encargo | null>(null)
  const routerAsig = useRouter()
  useEffect(() => { setEncargo(encargoDeLaUrl()) }, [])

  async function asignarYVolver(ses: any) {
    if (!encargo) return
    const r = await asignarSesionYVolver(ses, encargo)
    if (!r.ok) { alert('No se ha podido traer: ' + r.error); return }
    // La sesión SÍ está puesta; lo que ha fallado es dejar constancia del cambio. Se
    // dice, porque si no el motivo se pierde y nadie se entera.
    if (r.avisoRegistro) alert('La sesión está puesta, pero no se ha podido registrar el motivo del cambio:\n\n' + r.avisoRegistro)
    routerAsig.push(encargo.volver)
  }

  /**
   * Varias de una vez, solo cuando NO hay cita detrás.
   *
   * Montar el programa de alguien son tres o cuatro sesiones —empujes, tirones, tren
   * inferior— y traerlas de una en una obliga a rehacer el viaje entero cada vez. Con una
   * cita, en cambio, la multiselección no tiene sentido: una cita es una sesión, y dejar
   * marcar tres solo serviría para que ganase la última sin decir cuál.
   */
  const multiple = !!encargo && !encargo.citaId
  const [marcadas, setMarcadas] = useState<string[]>([])
  const marcar = (id: string) => setMarcadas(p => p.includes(id) ? p.filter(x => x !== id) : [...p, id])

  async function traerMarcadas() {
    if (!encargo || marcadas.length === 0) return
    setOcupado(true)
    const fallos: string[] = []
    for (const id of marcadas) {
      const ses = sesiones.find((x: any) => x.id === id)
      if (!ses) continue
      const r = await asignarSesionYVolver(ses, encargo)
      if (!r.ok) fallos.push(`${ses.nombre}: ${r.error}`)
    }
    setOcupado(false)
    // Si alguna falla se dice cuál y NO se vuelve: volver dejaría creer que entraron todas.
    if (fallos.length) { alert('No se han podido traer:\n\n' + fallos.join('\n')); return }
    routerAsig.push(encargo.volver)
  }
  const [ocupado, setOcupado] = useState(false)

  /**
   * Asignar una plantilla CREA UNA COPIA para el paciente. No se mueve la plantilla
   * ni se enlaza: a partir de ahí son dos sesiones independientes, y lo que se toque
   * en la del paciente no cambia el molde de los demás.
   */
  async function asignarA(pid: string) {
    if (!pid || !asignando) return
    setOcupado(true)
    const r = await asignarPlantilla(asignando, pid)
    setOcupado(false)
    if (!r.ok) { alert('No se pudo asignar: ' + r.error); return }
    setAsignando(null); setSesionVista(null); cargar()
  }

  async function duplicarPara(s: any) {
    setOcupado(true)
    // Una plantilla de la biblioteca se duplica como otra plantilla. Antes el boton
    // solo existia para las sesiones de paciente: en la biblioteca no habia forma de
    // partir de una sesion para hacer otra parecida.
    const r: any = s?.paciente_id
      ? await duplicarSesion(s, s.paciente_id)
      : await duplicarPlantilla(s, `${s.nombre} (copia)`)
    setOcupado(false)
    if (!r.ok) { alert('No se pudo duplicar: ' + r.error); return }
    setSesionVista(null); cargar()
  }

  /**
   * Borrado con aviso de lo que se lleva por delante. Las citas guardan `sesion_id`:
   * al borrar la sesión esas citas dejan de saber qué se hizo ese día, y eso no se
   * recupera. Por eso el aviso dice cuántas son antes de preguntar.
   */
  async function borrar(s: any) {
    setOcupado(true)
    const n = await usosDeSesion(s.id)
    setOcupado(false)
    const aviso = n > 0
      ? `"${s.nombre}" está asignada a ${n} cita${n === 1 ? '' : 's'}.\n\nEsas citas se quedarán sin sesión y el historial dejará de contar qué se hizo ese día.\n\n¿Eliminarla igualmente?`
      : `¿Eliminar "${s.nombre}"?\n\nNo está en ninguna cita, así que no se pierde ningún registro.`
    if (!confirm(aviso)) return
    setOcupado(true)
    const r = await eliminarSesion(s.id)
    setOcupado(false)
    if (!r.ok) { alert('No se pudo eliminar: ' + r.error); return }
    setSesionVista(null); cargar()
  }

  useEffect(() => {
    // Llega con un objetivo puesto desde la ficha de un paciente: se filtra solo.
    if (objetivoInicial) setFiltroObjetivos([objetivoInicial])
    if (pacienteIdInicial) {
      setSesionEditando({ paciente_id: pacienteIdInicial, nombre:'', descripcion:'', partes:[{nombre:'Calentamiento',ejercicios:[]},{nombre:'Parte principal',ejercicios:[]},{nombre:'Vuelta a la calma',ejercicios:[]}] })
    }
  }, [pacienteIdInicial, objetivoInicial])

  const ejerciciosFiltrados = ejercicios.filter((e:any) => {
    const matchQ = !buscarBiblio || e.nombre.toLowerCase().includes(buscarBiblio.toLowerCase())
    const matchEt = filtroEtBiblio.length===0 || filtroEtBiblio.every((fid:string)=>(e.etiquetas||[]).includes(fid))
    return matchQ && matchEt
  })

  function objsDeSesion(s:any) {
    const ids = (s.sesiones_objetivos||[]).map((r:any)=>r.objetivo_id)
    return (objetivos||[]).filter((o:any)=>ids.includes(o.id))
  }
  const sesionesFiltradas = sesiones.filter((s:any)=>{
    if (origen==='plantillas' && !esPlantilla(s)) return false
    if (origen==='pacientes' && esPlantilla(s)) return false
    const q = buscarSes.toLowerCase()
    const matchQ = !buscarSes || (s.nombre||'').toLowerCase().includes(q) || (s.descripcion||'').toLowerCase().includes(q)
    const idsObj = (s.sesiones_objetivos||[]).map((r:any)=>r.objetivo_id)
    const matchObj = filtroObjetivos.length===0 || filtroObjetivos.some(fid=>idsObj.includes(fid))
    return matchQ && matchObj
  })

  return (
    <>
      {encargo && <BarraAsignacion encargo={encargo}/>}
      {sustituyendo && <VeloSustituirTodos plantilla={sustituyendo} onCerrar={()=>setSustituyendo(null)}
        onHecho={t=>{ setSustituyendo(null); setSesionVista(null); setHechoSust(t); cargar() }}/>}
      {hechoSust && (
        <div style={{display:'flex',alignItems:'center',gap:10,background:'var(--gl)',color:'var(--gd)',borderRadius:12,padding:'10px 14px',marginBottom:10,fontSize:13}}>
          <span style={{flex:1}}>✓ {hechoSust}</span>
          <button className="btn btn-t btn-sm" onClick={()=>setHechoSust('')}>✕</button>
        </div>
      )}
      {multiple && marcadas.length>0 && (
        <div style={{position:'sticky',top:0,zIndex:25,display:'flex',alignItems:'center',gap:10,marginBottom:10,
          padding:'9px 13px',borderRadius:'var(--rl)',background:'var(--g)',color:'#fff',fontSize:11,boxShadow:'var(--sh-md)'}}>
          <span>{marcadas.length} {marcadas.length===1?'sesión marcada':'sesiones marcadas'}</span>
          <div style={{flex:1}}/>
          <button className="btn btn-t btn-sm" onClick={()=>setMarcadas([])} disabled={ocupado} style={{fontSize:10}}>Quitar marcas</button>
          <button className="btn btn-s btn-sm" onClick={traerMarcadas} disabled={ocupado} style={{fontSize:10}}>
            {ocupado ? 'Trayendo…' : `Traer ${marcadas.length} y volver`}
          </button>
        </div>
      )}
      {/* CABECERA: buscador + nueva */}
      <div style={{display:'flex',gap:8,marginBottom:12,alignItems:'center',flexWrap:'wrap'}}>
        <input className="input" placeholder="Buscar por nombre u objetivo..." value={buscarSes} onChange={e=>setBuscarSes(e.target.value)} style={{flex:1,minWidth:200}}/>
        <div style={{display:'flex',gap:5}}>
          {([['plantillas','Plantillas'],['pacientes','De pacientes'],['todas','Todas']] as const).map(([k,l])=>{
            const n = k==='todas' ? sesiones.length
              : sesiones.filter((s:any)=>k==='plantillas' ? esPlantilla(s) : !esPlantilla(s)).length
            return (
              <span key={k} onClick={()=>setOrigen(k as any)}
                style={{fontSize:9,padding:'3px 10px',borderRadius:99,cursor:'pointer',
                  border:`1.5px solid ${origen===k?'var(--g)':'var(--bd)'}`,
                  background:origen===k?'var(--g)':'var(--w)',color:origen===k?'#fff':'var(--gr)'}}>
                {l} {n}
              </span>
            )
          })}
        </div>
        <span style={{fontSize:10,color:'var(--grl)'}}>{sesionesFiltradas.length} en pantalla</span>
        <button className="btn btn-p btn-sm" onClick={()=>setSesionEditando({ paciente_id: pacienteIdInicial||'', nombre:'', descripcion:'', partes:[{nombre:'Calentamiento',ejercicios:[]},{nombre:'Parte principal',ejercicios:[]},{nombre:'Vuelta a la calma',ejercicios:[]}] })}>+ Nueva sesión</button>
      </div>
      {/* Filtro por objetivo: el mismo velo de bolas que en Ciclos. */}
      {(objetivos||[]).length>0&&(
        <div style={{display:'flex',gap:6,flexWrap:'wrap',marginBottom:12,alignItems:'center'}}>
          <FiltroObjetivos objetivos={objetivos||[]} valor={filtroObjetivos} onChange={setFiltroObjetivos} nResultado={sesionesFiltradas.length} nombre="sesiones"/>
        </div>
      )}

      {sesionesFiltradas.length===0?(
        <div style={{textAlign:'center',padding:40,color:'var(--grl)',fontSize:11}}>
          {sesiones.length===0 ? 'Sin sesiones. Crea la primera con + Nueva sesión.'
            : origen==='plantillas' ? 'No hay plantillas que coincidan. Las sesiones ya prescritas están en "De pacientes".'
            : 'Sin resultados.'}
        </div>
      ):(
        <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(240px,1fr))',gap:10}}>
          {sesionesFiltradas.map((s:any)=>{
            const nEj = (s.partes||[]).reduce((acc:number,p:any)=>acc+(p.ejercicios||[]).length,0)
            const nPartes = (s.partes||[]).length
            return (
              <div key={s.id} onClick={()=>setSesionVista(s)} className="card" style={{cursor:'pointer',display:'flex',flexDirection:'column',gap:8,margin:0}}
                onMouseOver={el=>(el.currentTarget as HTMLElement).style.borderColor='var(--g)'}
                onMouseOut={el=>(el.currentTarget as HTMLElement).style.borderColor='var(--bd)'}>
                <div>
                  <div style={{fontSize:13,fontWeight:500,color:'var(--n)',marginBottom:3}}>{s.nombre}</div>
                  {s.descripcion&&<div style={{fontSize:10,color:'var(--gr)',fontWeight:300,lineHeight:1.4}}>{s.descripcion.slice(0,90)}{s.descripcion.length>90?'...':''}</div>}
                </div>
                <div style={{display:'flex',gap:6,flexWrap:'wrap',marginTop:'auto'}}>
                  {/* De quién es. Sin esto, en la lista no se distingue un molde de una
                      sesión ya prescrita, que es la diferencia que más importa aquí. */}
                  {esPlantilla(s)
                    ? <span style={{fontSize:9,padding:'2px 8px',borderRadius:99,background:'var(--g)',color:'#fff'}}>Plantilla</span>
                    : <span title="Ya es de un paciente: no se asigna, se duplica" style={{fontSize:9,padding:'2px 8px',borderRadius:99,background:'var(--ambl)',color:'#7A5800'}}>De {s.pacientes?.nombre || 'un paciente'}</span>}
                  <span style={{fontSize:9,padding:'2px 8px',borderRadius:99,background:'var(--gl)',color:'var(--gd)'}}>{nPartes} {nPartes===1?'parte':'partes'}</span>
                  <span style={{fontSize:9,padding:'2px 8px',borderRadius:99,background:'var(--bl)',color:'var(--gd)',border:'1px solid var(--bd)'}}>{modoDeSesion(s.partes||[]).nombre}</span>
                  <span style={{fontSize:9,padding:'2px 8px',borderRadius:99,background:'var(--bm)',color:'var(--gr)'}}>{nEj} {nEj===1?'ejercicio':'ejercicios'}</span>
                </div>
                {/* En monedas mini, igual que en las sesiones del paciente. El nombre va en
                    el tooltip: en una tarjeta pequeña, tres nombres seguidos ocupaban más
                    que el resto de la tarjeta. */}
                {objsDeSesion(s).length>0&&(
                  <div style={{display:'flex',gap:4,flexWrap:'wrap'}}>
                    {objsDeSesion(s).map((o:any)=><MonedaObjetivo key={o.id} objetivo={o} tam="mini"/>)}
                  </div>
                )}
                {encargo && (multiple
                  ? <button className={marcadas.includes(s.id) ? 'btn btn-p btn-sm' : 'btn btn-s btn-sm'}
                      style={{width:'100%',fontSize:11}} onClick={e=>{e.stopPropagation();marcar(s.id)}}>
                      {marcadas.includes(s.id) ? '✓ Marcada' : 'Marcar'}
                    </button>
                  : <button className="btn btn-p btn-sm" style={{width:'100%',fontSize:11}}
                      onClick={e=>{e.stopPropagation();asignarYVolver(s)}}>
                      Traer esta y volver
                    </button>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* MODAL VISTA SESIÓN (solo lectura) */}
      {historialDe&&<HistorialAjustes sesion={historialDe} onCerrar={()=>setHistorialDe(null)}/>}

      {sesionVista&&(
        <div className="modal-bg" onClick={e=>{if(e.target===e.currentTarget)setSesionVista(null)}}>
          {/* EN BLANCO Y A LO ANCHO, como el taller. Antes el fondo era el gris de la app
              con cada parte en otra caja gris, y el titulo y los botones compartian fila:
              el nombre se partia en cuatro lineas y los ejercicios iban uno por fila. */}
          <div style={{background:'var(--w)',borderRadius:'var(--rl)',width:'96vw',maxWidth:1180,maxHeight:'92vh',display:'flex',flexDirection:'column',boxShadow:'0 4px 32px rgba(38,40,37,.15)',overflow:'hidden'}}>
            <div style={{padding:'14px 18px',borderBottom:'1px solid var(--bd)',background:'var(--w)',display:'flex',alignItems:'flex-start',gap:10,flexWrap:'wrap'}}>
              <div style={{flex:'1 1 320px',minWidth:0}}>
                <div style={{fontSize:17,fontWeight:400,color:'var(--n)'}}>{sesionVista.nombre}</div>
                {sesionVista.descripcion&&<div style={{fontSize:12,color:'var(--gr)',fontWeight:300,marginTop:3,lineHeight:1.45}}>{sesionVista.descripcion}</div>}
                {/* Abierta sí caben con su nombre, como en la ficha del paciente. */}
                {objsDeSesion(sesionVista).length>0&&(
                  <div style={{display:'flex',gap:10,flexWrap:'wrap',marginTop:7}}>
                    {objsDeSesion(sesionVista).map((o:any)=>(
                      <span key={o.id} style={{display:'inline-flex',flexDirection:'column',alignItems:'center',gap:3,width:76}}>
                        <MonedaObjetivo objetivo={o}/>
                        <span className="obj-mon-g">{o.nombre}</span>
                      </span>
                    ))}
                  </div>
                )}
              </div>
              {/* Con un encargo, el paciente YA SE SABE: preguntarlo otra vez es hacer
                  elegir dos veces lo mismo, y encima deja elegir a otro distinto del de la
                  cita, que es un error silencioso esperando a pasar. */}
              {/* CABECERA LIMPIA: a la vista lo de siempre (asignar o traer, y editar); el resto
                  en ⋯. Antes eran seis botones en fila y el titulo quedaba apretado. */}
              <div style={{display:'flex',gap:8,alignItems:'center',position:'relative',flexShrink:0}}>
              {encargo
                ? (multiple
                  ? <button className={marcadas.includes(sesionVista.id) ? 'btn btn-p btn-sm' : 'btn btn-s btn-sm'}
                      onClick={()=>marcar(sesionVista.id)} disabled={ocupado}>
                      {marcadas.includes(sesionVista.id) ? '✓ Marcada' : 'Marcar para traer'}
                    </button>
                  : <button className="btn btn-p btn-sm" onClick={()=>asignarYVolver(sesionVista)} disabled={ocupado}>
                      Traer para {encargo.etiqueta || 'el paciente'}
                    </button>)
                : esPlantilla(sesionVista)
                ? <button className="btn btn-p btn-sm" onClick={()=>setAsignando(sesionVista)} disabled={ocupado}><Ic name="usuario" size={12}/> Asignar a paciente</button>
                : null}
              <button className="btn btn-s btn-sm" onClick={()=>{const s=sesionVista;setSesionVista(null);setSesionEditando(s)}}><Ic name="editar" size={12}/> Editar</button>
              <button onClick={()=>setMenuMas(v=>!v)} title="Más acciones"
                style={{width:32,height:32,borderRadius:'50%',border:'1px solid var(--bd)',background:menuMas?'var(--bl)':'var(--w)',cursor:'pointer',fontSize:16,color:'var(--gr)',lineHeight:1}}>⋯</button>
              <button onClick={()=>setSesionVista(null)} style={{width:32,height:32,borderRadius:'50%',border:'1px solid var(--bd)',background:'var(--w)',cursor:'pointer',fontSize:13,color:'var(--gr)'}}>✕</button>
              {menuMas && (
                <div onMouseLeave={()=>setMenuMas(false)} style={{position:'absolute',top:40,right:40,zIndex:5,background:'var(--w)',borderRadius:14,boxShadow:'0 10px 30px rgba(38,40,37,.18)',padding:6,width:240}}>
                  {([
                    ...(esPlantilla(sesionVista) && !encargo ? [
                      ['pacientes','Programar a un grupo',()=>{const s=sesionVista;setSesionVista(null);setGrupo(s)}],
                      ['recuperar','Sustituir en sus pacientes',()=>setSustituyendo(sesionVista)],
                    ] : []),
                    ['copiar','Duplicar',()=>duplicarPara(sesionVista)],
                    ['carpeta','Historial',()=>setHistorialDe(sesionVista)],
                  ] as [string,string,()=>void][]).map(([ic,t,fn])=>(
                    <button key={t} disabled={ocupado} onClick={()=>{setMenuMas(false);fn()}}
                      style={{display:'flex',alignItems:'center',gap:8,width:'100%',textAlign:'left',padding:'9px 12px',borderRadius:9,border:0,background:'none',cursor:'pointer',fontFamily:'inherit',fontSize:13.5,color:'var(--n)'}}
                      onMouseOver={e=>(e.currentTarget as HTMLElement).style.background='var(--bl)'} onMouseOut={e=>(e.currentTarget as HTMLElement).style.background='none'}>
                      <Ic name={ic} size={14}/> {t}
                    </button>
                  ))}
                  <button disabled={ocupado} onClick={()=>{setMenuMas(false);borrar(sesionVista)}}
                    style={{display:'flex',alignItems:'center',gap:8,width:'100%',textAlign:'left',padding:'11px 12px 9px',borderRadius:9,border:0,borderTop:'1px solid var(--bd2)',marginTop:4,background:'none',cursor:'pointer',fontFamily:'inherit',fontSize:13.5,color:'var(--red)'}}>
                    <Ic name="papelera" size={14}/> Eliminar
                  </button>
                </div>
              )}
              </div>
            </div>
            <ResumenSesion partes={sesionVista.partes||[]} ejercicios={ejercicios||[]} etiquetas={etiquetas||[]}/>
            <div style={{flex:1,overflowY:'auto',padding:'14px 18px',background:'var(--w)'}}>
              {(sesionVista.partes||[]).map((parte:any,pi:number)=>(
                <div key={pi} style={{marginBottom:16}}>
                  {/* Cómo se recorre la parte y con qué descansos. Sin esto la vista
                      enseñaba los ejercicios pero no si iban en circuito, en superserie
                      o sueltos, que es lo que decide cómo se hace la sesión entera. */}
                  <div style={{padding:'8px 12px',background:'var(--bl)',borderLeft:'3px solid var(--g)',borderRadius:'0 8px 8px 0',display:'flex',alignItems:'baseline',gap:10,flexWrap:'wrap',marginBottom:10}}>
                    <span style={{fontSize:14,fontWeight:600,color:'var(--n)'}}>{parte.nombre}</span>
                    {(parte.ejercicios||[]).length>0&&(
                      <span style={{fontSize:10,color:'var(--gd)',display:'inline-flex',alignItems:'center',gap:4}}>
                        <Ic name={modoParte(parte.modo).icono} size={10}/> {textoModo(parte)}
                      </span>
                    )}
                    {descansoDeParte(parte)&&(
                      <span style={{fontSize:10,color:'var(--gr)',display:'inline-flex',alignItems:'center',gap:4}}
                        title={`Descanso ${descansoDeParte(parte)!.cuando}`}>
                        <Ic name="pausa" size={10}/> {descansoDeParte(parte)!.texto} {descansoDeParte(parte)!.cuando}
                      </span>
                    )}
                    {transicionDeParte(parte)&&(
                      <span style={{fontSize:10,color:'var(--gr)',display:'inline-flex',alignItems:'center',gap:4}}
                        title="Descanso al cambiar de ejercicio dentro de la vuelta">
                        <Ic name="pausa" size={10}/> {transicionDeParte(parte)!.texto} {transicionDeParte(parte)!.cuando}
                      </span>
                    )}
                  </div>
                  {/* Rejilla de fotos como en el taller. En superserie, un bloque por grupo
                      para que se vea donde acaba un par y empieza el otro. */}
                  {(() => {
                    const ss = parte.modo==='superserie'
                    const ejs = (parte.ejercicios||[]).map((ej:any,ei:number)=>({ej,ei}))
                    // Por LETRA y no por orden: si los ejercicios estaban guardados
                    // intercalados (A, B, A...) salia "Grupo A" dos veces.
                    const grupos: {g:string, items:any[]}[] = []
                    ejs.forEach((x:any)=>{
                      const g = ss ? (x.ej.grupo||'A') : ''
                      const ya = grupos.find(y=>y.g===g)
                      if (ya) ya.items.push(x); else grupos.push({g, items:[x]})
                    })
                    const chip = (t:string, fondo='var(--bl)', color='var(--gr)') =>
                      <span style={{fontSize:10.5,padding:'1px 8px',borderRadius:99,background:fondo,color}}>{t}</span>
                    // Los grupos van uno AL LADO del otro y las fotos a tamano fijo: con
                    // la rejilla a todo el ancho cada grupo ocupaba una fila y sobraba
                    // media pantalla a la derecha.
                    return <div style={{display:'flex',flexWrap:'wrap',gap:'14px 30px',paddingLeft:14}}>{grupos.map((gr,gi)=>(
                      <div key={gi}>
                        {ss&&(
                          <div style={{display:'flex',alignItems:'baseline',gap:8,marginBottom:6}}>
                            <span style={{fontSize:12,fontWeight:600,color:'var(--gd)'}}>Grupo {gr.g}</span>
                            {gr.items[0]?.ej.series&&<span style={{fontSize:11,color:'var(--gr)'}}>{gr.items[0].ej.series} vueltas</span>}
                            {parte.descanso&&<span style={{fontSize:11,color:'var(--gr)',display:'inline-flex',alignItems:'center',gap:3}}><Ic name="pausa" size={10}/> {textoDescanso(parte.descanso)} tras cada vuelta</span>}
                          </div>
                        )}
                        <div style={{display:'flex',flexWrap:'wrap',gap:10}}>
                          {gr.items.map(({ej,ei}:any)=>{
                            /* LA DOSIS EN UNA PASTILLA: "3 × 12 · Unilateral", "180 s". Es lo que hace
                               falta para leer la sesion sin abrirla. En circuito y superserie las
                               series son las vueltas de la parte o del grupo: no se repiten aqui. */
                            const cuanto = ej.tiempo ? `${ej.tiempo} s` : ej.reps ? `${ej.reps}` : ''
                            const series = parte.modo!=='circuito'&&parte.modo!=='superserie'&&ej.series&&cuanto ? `${ej.series} × ` : ''
                            const dosis = [series+cuanto, ej.peso?`${ej.peso} kg`:'', ej.lado&&ej.lado!=='Bilateral'?ej.lado:''].filter(Boolean).join(' · ')
                            // Sin foto ni musculos que pintar: tarjeta pequeña, que no pese como las que si.
                            const lib = (ejercicios||[]).find((x:any)=>x.id===ej.ejercicio_id)
                            const vacia = !ej.imagen_url && !(lib?.imagen_url) && !((lib?.etiquetas||[]).length)
                            const etiq = ss ? `${gr.g}${gr.items.findIndex((x:any)=>x.ei===ei)+1}` : ''
                            return (
                            <div key={ei} style={{textAlign:'center',width:vacia?112:140,position:'relative'}}>
                              {etiq&&<span style={{position:'absolute',top:6,left:6,zIndex:2,fontSize:10.5,fontWeight:600,color:'var(--gd)',background:'var(--w)',borderRadius:99,padding:'1px 7px',boxShadow:'0 1px 3px rgba(0,0,0,.12)'}}>{etiq}</span>}
                              {vacia
                                ? <div title="Sin foto ni músculos: complétalo en el torno" style={{height:60,borderRadius:10,border:'1.5px dashed var(--bd)',display:'flex',alignItems:'center',justifyContent:'center',fontSize:11,color:'var(--grl)'}}>sin foto</div>
                                : <ImagenEjercicio src={ej.imagen_url||lib?.imagen_url} ejercicioId={ej.ejercicio_id} etiquetasEj={lib?.etiquetas} radio={10} fondo="var(--bl)" icono={30} alt={ej.nombre} insignias={false}/>}
                              <div style={{fontSize:12.5,color:'var(--n)',marginTop:6,lineHeight:1.3}}>{ej.nombre||ej}</div>
                              {dosis&&<div style={{display:'inline-block',fontSize:12,fontWeight:600,color:'var(--n)',background:'var(--gl)',borderRadius:99,padding:'2px 9px',marginTop:4}}>{dosis}</div>}
                              {ej.variante&&<div style={{marginTop:3}}>{chip(ej.variante,'var(--gl)','var(--gd)')}</div>}
                              {ej.capacidad&&<div style={{fontSize:11,color:'var(--grl)',marginTop:2}}>{ej.capacidad}</div>}
                              {ej.nota&&<div style={{fontSize:10.5,color:'#7A5800',marginTop:4,fontStyle:'italic'}}>{ej.nota}</div>}
                            </div>
                          )})}
                        </div>
                      </div>
                    ))}</div>
                  })()}
                  {(parte.ejercicios||[]).length===0&&<div style={{paddingLeft:14,fontSize:11,color:'var(--grl)'}}>Sin ejercicios</div>}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* SELECTOR DE PACIENTE para asignar una plantilla */}
      {asignando&&(
        <div className="modal-bg" onClick={e=>{if(e.target===e.currentTarget&&!ocupado)setAsignando(null)}}>
          <div style={{background:'var(--w)',borderRadius:'var(--rl)',width:'92vw',maxWidth:420,maxHeight:'80vh',display:'flex',flexDirection:'column',overflow:'hidden',boxShadow:'0 4px 32px rgba(38,40,37,.15)'}}>
            <div style={{padding:'12px 16px',borderBottom:'1px solid var(--bd)',background:'var(--bl)'}}>
              <div style={{fontSize:14,color:'var(--n)'}}>Asignar &laquo;{asignando.nombre}&raquo;</div>
              <div style={{fontSize:12,color:'var(--gr)',marginTop:3,lineHeight:1.5}}>
                Se crea una copia para el paciente. La plantilla no cambia, y lo que edites
                en su sesión no afecta a nadie m&aacute;s.
              </div>
            </div>
            {/* El mismo buscador de la agenda: por nombre, apellidos, apodo de clínica
                o teléfono. Antes era la lista entera de pacientes en un desplegable, que
                con más de veinte deja de servir. */}
            <div style={{flex:1,overflowY:'auto',padding:12}}>
              <BuscadorPacientes
                pacientes={pacientes||[]}
                valor=""
                onElegir={(pa:any)=>asignarA(pa.id)}
                onLimpiar={()=>{}}
                placeholder="Buscar por nombre, apodo o teléfono…"
                autoFocus
                disabled={ocupado}/>
              {(pacientes||[]).length===0&&<div style={{padding:12,fontSize:13,color:'var(--gr)'}}>No hay pacientes.</div>}
            </div>
            <div style={{padding:'10px 16px',borderTop:'1px solid var(--bd)',textAlign:'right'}}>
              <button className="btn btn-t btn-sm" onClick={()=>setAsignando(null)} disabled={ocupado}>Cancelar</button>
            </div>
          </div>
        </div>
      )}

      {grupo&&(
        <ModalProgramarGrupo
          plantilla={grupo}
          pacientes={pacientes||[]}
          onCerrar={()=>setGrupo(null)}
          onHecho={cargar}
        />
      )}

      {sesionEditando&&(
        <ModalEditarSesion
          sesion={sesionEditando}
          ejercicios={ejercicios}
          etiquetas={etiquetas}
          pacientes={pacientes}
          onGuardado={cargar}
          onCerrar={()=>setSesionEditando(null)}
        />
      )}

    </>
  )
}
