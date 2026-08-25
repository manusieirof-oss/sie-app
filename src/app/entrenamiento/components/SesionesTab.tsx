'use client'
import { useState, useEffect } from 'react'
import ModalEditarSesion from './ModalEditarSesion'
import ModalProgramarGrupo from './ModalProgramarGrupo'
import BuscadorPacientes from '@/components/BuscadorPacientes'
import { Ic } from '@/lib/icons'
import BarraAsignacion from '@/components/BarraAsignacion'
import { encargoDeLaUrl, asignarSesionYVolver, type Encargo } from '@/lib/asignarCita'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { textoDescanso } from '@/lib/capacidades'
import { esPlantilla, asignarPlantilla, duplicarSesion, usosDeSesion, eliminarSesion, modoParte, textoModo, descansoDeParte, modoDeSesion } from '@/lib/sesiones'

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

export default function SesionesTab({ sesiones, pacientes, ejercicios, etiquetas, objetivos, cargar, getNombre, pacienteIdInicial }: any) {
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
    if (!s?.paciente_id) return
    setOcupado(true)
    const r = await duplicarSesion(s, s.paciente_id)
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
    if (pacienteIdInicial) {
      setSesionEditando({ paciente_id: pacienteIdInicial, nombre:'', descripcion:'', partes:[{nombre:'Calentamiento',ejercicios:[]},{nombre:'Parte principal',ejercicios:[]},{nombre:'Vuelta a la calma',ejercicios:[]}] })
    }
  }, [pacienteIdInicial])

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
      {(objetivos||[]).length>0&&(
        <div style={{display:'flex',gap:5,flexWrap:'wrap',marginBottom:12,alignItems:'center'}}>
          <span style={{fontSize:9,fontWeight:600,color:'var(--grl)',letterSpacing:.4,textTransform:'uppercase',display:'inline-flex',alignItems:'center',gap:4}}><Ic name="objetivo" size={11}/> Objetivo:</span>
          {(objetivos||[]).map((o:any)=>{
            const sel = filtroObjetivos.includes(o.id)
            return (
              <span key={o.id} onClick={()=>setFiltroObjetivos(prev=>prev.includes(o.id)?prev.filter(x=>x!==o.id):[...prev,o.id])}
                style={{fontSize:9,padding:'2px 9px',borderRadius:99,cursor:'pointer',border:`1.5px solid ${sel?(o.color||'var(--g)'):'var(--bd)'}`,background:sel?(o.color||'var(--g)'):'var(--w)',color:sel?'#fff':'var(--gr)'}}>
                {sel?'✓ ':''}{o.nombre}
              </span>
            )
          })}
          {filtroObjetivos.length>0&&<button className="btn btn-t btn-sm" onClick={()=>setFiltroObjetivos([])}>✕ Limpiar</button>}
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
                {objsDeSesion(s).length>0&&(
                  <div style={{display:'flex',gap:4,flexWrap:'wrap'}}>
                    {objsDeSesion(s).map((o:any)=><span key={o.id} style={{fontSize:9,padding:'2px 8px',borderRadius:99,background:o.color||'var(--g)',color:'#fff',display:'inline-flex',alignItems:'center',gap:3}}><Ic name="objetivo" size={9}/> {o.nombre}</span>)}
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
      {sesionVista&&(
        <div className="modal-bg" onClick={e=>{if(e.target===e.currentTarget)setSesionVista(null)}}>
          <div style={{background:'var(--w)',borderRadius:'var(--rl)',width:'92vw',maxWidth:760,maxHeight:'90vh',display:'flex',flexDirection:'column',boxShadow:'0 4px 32px rgba(38,40,37,.15)',overflow:'hidden'}}>
            <div style={{padding:'12px 16px',borderBottom:'1px solid var(--bd)',background:'var(--bl)',display:'flex',alignItems:'center',gap:10}}>
              <div style={{flex:1}}>
                <div style={{fontSize:14,fontWeight:400,color:'var(--n)'}}>{sesionVista.nombre}</div>
                {sesionVista.descripcion&&<div style={{fontSize:10,color:'var(--gr)',fontWeight:300,marginTop:2}}>{sesionVista.descripcion}</div>}
                {objsDeSesion(sesionVista).length>0&&(
                  <div style={{display:'flex',gap:4,flexWrap:'wrap',marginTop:5}}>
                    {objsDeSesion(sesionVista).map((o:any)=><span key={o.id} style={{fontSize:9,padding:'2px 8px',borderRadius:99,background:o.color||'var(--g)',color:'#fff',display:'inline-flex',alignItems:'center',gap:3}}><Ic name="objetivo" size={9}/> {o.nombre}</span>)}
                  </div>
                )}
              </div>
              {/* Con un encargo, el paciente YA SE SABE: preguntarlo otra vez es hacer
                  elegir dos veces lo mismo, y encima deja elegir a otro distinto del de la
                  cita, que es un error silencioso esperando a pasar. */}
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
                ? <>
                    <button className="btn btn-p btn-sm" onClick={()=>setAsignando(sesionVista)} disabled={ocupado}><Ic name="usuario" size={12}/> Asignar a paciente</button>
                    {/* Programar a un grupo es lo mismo pero con la regla puesta en el
                        calendario en vez de en una sola cita. Va al lado y no dentro:
                        son dos decisiones distintas, no un modo de la misma. */}
                    <button className="btn btn-s btn-sm" onClick={()=>{const s=sesionVista;setSesionVista(null);setGrupo(s)}} disabled={ocupado}><Ic name="pacientes" size={12}/> Programar a un grupo</button>
                  </>
                : <button className="btn btn-s btn-sm" onClick={()=>duplicarPara(sesionVista)} disabled={ocupado}><Ic name="copiar" size={12}/> Duplicar</button>}
              <button className="btn btn-s btn-sm" onClick={()=>{const s=sesionVista;setSesionVista(null);setSesionEditando(s)}}><Ic name="editar" size={12}/> Editar</button>
              <button className="btn btn-d btn-sm" onClick={()=>borrar(sesionVista)} disabled={ocupado} title="Eliminar la sesión"><Ic name="papelera" size={12}/></button>
              <button onClick={()=>setSesionVista(null)} style={{width:26,height:26,borderRadius:'50%',border:'1px solid var(--bd)',background:'var(--w)',cursor:'pointer',fontSize:13,color:'var(--gr)'}}>✕</button>
            </div>
            <div style={{flex:1,overflowY:'auto',padding:16}}>
              {(sesionVista.partes||[]).map((parte:any,pi:number)=>(
                <div key={pi} style={{marginBottom:10,background:'var(--bl)',borderRadius:6,overflow:'hidden',border:'1px solid var(--bd)'}}>
                  {/* Cómo se recorre la parte y con qué descansos. Sin esto la vista
                      enseñaba los ejercicios pero no si iban en circuito, en superserie
                      o sueltos, que es lo que decide cómo se hace la sesión entera. */}
                  <div style={{padding:'6px 12px',borderBottom:'1px solid var(--bm)',display:'flex',alignItems:'baseline',gap:8,flexWrap:'wrap'}}>
                    <span style={{fontSize:11,fontWeight:500,color:'var(--n)'}}>{parte.nombre}</span>
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
                  </div>
                  {(parte.ejercicios||[]).map((ej:any,ei:number)=>{
                  // En superserie, cabecera al empezar cada grupo. Sin ella la lista
                  // era una fila de cuatro ejercicios seguidos y no se veía dónde
                  // acababa un par y empezaba el otro, que es lo único que hay que
                  // entender de este modo.
                  const ss = parte.modo==='superserie'
                  const g = ej.grupo||'A'
                  const abreGrupo = ss && (ei===0 || (parte.ejercicios[ei-1]?.grupo||'A')!==g)
                  const nGrupo = ss ? parte.ejercicios.filter((x:any)=>(x.grupo||'A')===g).length : 0
                  return (
                  <div key={ei}>
                  {abreGrupo&&(
                    <div style={{padding:'5px 12px',background:'var(--gl)',borderTop:ei>0?'1px solid var(--bm)':'none',display:'flex',alignItems:'baseline',gap:6,flexWrap:'wrap'}}>
                      <span style={{fontSize:10,fontWeight:600,color:'var(--gd)'}}>Grupo {g}</span>
                      {/* Solo vueltas y descanso. Lo de "sin descanso entre ellos" se
                          quita: si no hay descanso escrito, no hay descanso, y decirlo
                          en cada grupo era repetir una regla que ya vale para todo. */}
                      {ej.series&&<span style={{fontSize:10,color:'var(--gr)'}}>{ej.series} vueltas</span>}
                      {parte.descanso&&(
                        <span style={{fontSize:10,color:'var(--gr)',display:'inline-flex',alignItems:'center',gap:3}}
                          title="Una serie de cada ejercicio del grupo, seguidas, y aquí el descanso">
                          <Ic name="pausa" size={10}/> {textoDescanso(parte.descanso)} tras cada vuelta
                        </span>
                      )}
                    </div>
                  )}
                  <div style={{padding:'8px 12px',borderBottom:'1px solid var(--bl)',display:'flex',alignItems:'flex-start',gap:10}}>
                    {ss&&<span style={{flexShrink:0,fontSize:10,fontWeight:600,color:'var(--gd)',background:'var(--gl)',borderRadius:4,padding:'2px 5px',marginTop:2}}>{g}{parte.ejercicios.slice(0,ei+1).filter((x:any)=>(x.grupo||'A')===g).length}</span>}
                      {ej.imagen_url&&<img src={ej.imagen_url} alt={ej.nombre} style={{width:44,height:44,objectFit:'contain',background:'var(--bm)',borderRadius:4,flexShrink:0}}/>}
                      <div style={{flex:1}}>
                        <div style={{fontSize:11,fontWeight:400,color:'var(--n)',marginBottom:3}}>{ej.nombre||ej}</div>
                        <div style={{display:'flex',gap:4,flexWrap:'wrap'}}>
                          {ej.variante&&<span style={{fontSize:9,padding:'1px 7px',borderRadius:99,background:'var(--gl)',color:'var(--gd)'}}>{ej.variante}</span>}
                          {ej.capacidad&&<span style={{fontSize:9,padding:'1px 7px',borderRadius:99,background:'var(--ambl)',color:'#7A5800'}}>{ej.capacidad}</span>}
                          {parte.modo!=='circuito'&&parte.modo!=='superserie'&&ej.series&&<span style={{fontSize:9,padding:'1px 7px',borderRadius:99,background:'var(--bm)',color:'var(--gr)'}}>{ej.series} series</span>}
                          {ej.reps&&<span style={{fontSize:9,padding:'1px 7px',borderRadius:99,background:'var(--bm)',color:'var(--gr)'}}>{ej.reps} reps</span>}
                          {ej.peso&&<span style={{fontSize:9,padding:'1px 7px',borderRadius:99,background:'var(--bm)',color:'var(--gr)'}}>{ej.peso} kg</span>}
                          {ej.tiempo&&<span style={{fontSize:9,padding:'1px 7px',borderRadius:99,background:'var(--bm)',color:'var(--gr)'}}>{ej.tiempo} seg</span>}
                        </div>
                        {ej.nota&&<div style={{fontSize:9,color:'var(--amb)',marginTop:3,fontStyle:'italic',display:'flex',alignItems:'center',gap:4}}><Ic name="nota" size={10}/> {ej.nota}</div>}
                      </div>
                    </div>
                  </div>
                  )})}
                  {(parte.ejercicios||[]).length===0&&<div style={{padding:'6px 12px',fontSize:9,color:'var(--grl)'}}>Sin ejercicios</div>}
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
