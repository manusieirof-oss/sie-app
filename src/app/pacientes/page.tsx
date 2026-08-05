'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { cargarBonosTipos, BonoTipo, cambiarEstadoPago } from '@/lib/bonos'
import Link from 'next/link'
import ModalBono from './components/ModalBono'
import { Ic } from '@/lib/icons'
import { TIPOS_CLASE_FALLBACK, cargarTiposClase, nombreTipoClase } from '@/lib/tipos'
import { rondaAbierta, respuestasDe, marcar, contar, ESTADOS_RONDA, type Ronda, type Respuesta, type EstadoRonda } from '@/lib/rondas'

export default function PacientesPage() {
  const [pacientes, setPacientes] = useState<any[]>([])
  const [bonos, setBonos] = useState<any[]>([])
  const [bonosOpts, setBonosOpts] = useState<BonoTipo[]>([])
  const [loading, setLoading] = useState(true)
  const [buscar, setBuscar] = useState('')
  const [filtroPago, setFiltroPago] = useState('todos')
  const [filtroTipo, setFiltroTipo] = useState('todos')
  const [filtroEstado, setFiltroEstado] = useState('activo')
  const [tiposClase, setTiposClase] = useState<any[]>(TIPOS_CLASE_FALLBACK)
  const [modal, setModal] = useState(false)
  const [modalBonoPac, setModalBonoPac] = useState<any>(null)
  const [menuPago, setMenuPago] = useState<any>(null)
  // Ronda de preguntas abierta, si la hay. Ver lib/rondas.ts.
  const [ronda, setRonda] = useState<Ronda|null>(null)
  const [respuestas, setRespuestas] = useState<Record<string,Respuesta>>({})
  const [soloFaltan, setSoloFaltan] = useState(false)
  const [editRonda, setEditRonda] = useState<any>(null)
  const [nuevo, setNuevo] = useState({ nombre:'', apellidos:'', nombre_clinica:'', telefono:'', email:'', tipo_clase:'entrenamiento', dni:'', fecha_nacimiento:'', altura_cm:'', peso_kg:'' })
  
  const mesActual = new Date().getMonth()+1
  const anioActual = new Date().getFullYear()

  useEffect(() => { cargar(); cargarBonosTipos(false).then(setBonosOpts) }, [])

  async function cargar() {
    setLoading(true)
    const [{ data: p }, { data: b }] = await Promise.all([
      supabase.from('pacientes').select('*').order('nombre'),
      supabase.from('bonos').select('*').eq('mes',mesActual).eq('anio',anioActual).eq('activo',true),
    ])
    setPacientes(p || [])
    setBonos(b || [])
    setTiposClase(await cargarTiposClase())

    const r = await rondaAbierta()
    setRonda(r)
    setRespuestas(r ? await respuestasDe(r.id) : {})
    setLoading(false)
  }

  /**
   * Marca a un paciente en la ronda y refresca solo su casilla.
   *
   * Sin recargar la lista entera: se marcan cien seguidos y esperar a que vuelva la
   * consulta en cada clic convierte la tarea en algo que nadie termina.
   */
  async function marcarEnRonda(pacienteId: string, estado: EstadoRonda|null, respuesta?: string) {
    if (!ronda) return
    setRespuestas(prev => {
      const s = { ...prev }
      if (!estado) delete s[pacienteId]
      else s[pacienteId] = { paciente_id: pacienteId, estado, respuesta: respuesta ?? s[pacienteId]?.respuesta ?? '' }
      return s
    })
    const r = await marcar(ronda.id, pacienteId, estado, respuesta)
    if (!r.ok) { alert('No se pudo guardar: ' + r.error); cargar() }
  }

  function getBonoActual(pacienteId: string) {
    return bonos.find(b=>b.paciente_id===pacienteId)
  }


  async function crearPaciente() {
    if (!nuevo.nombre || !nuevo.apellidos) { alert('Nombre y apellidos son obligatorios'); return }
    const { error } = await supabase.from('pacientes').insert({
      nombre: nuevo.nombre, apellidos: nuevo.apellidos, nombre_clinica: nuevo.nombre_clinica||null, telefono: nuevo.telefono,
      email: nuevo.email, tipo_clase: nuevo.tipo_clase, dni: nuevo.dni,
      fecha_nacimiento: nuevo.fecha_nacimiento || null,
      altura_cm: nuevo.altura_cm ? parseInt(nuevo.altura_cm) : null,
      peso_kg: nuevo.peso_kg ? parseFloat(nuevo.peso_kg) : null,
      estado: 'activo',
    })
    if (error) { alert('Error: ' + error.message); return }
    setModal(false)
    setNuevo({ nombre:'', apellidos:'', nombre_clinica:'', telefono:'', email:'', tipo_clase:'entrenamiento', dni:'', fecha_nacimiento:'', altura_cm:'', peso_kg:'' })
    cargar()
  }

  const labelTipo = (v:string) => v ? nombreTipoClase(tiposClase, v) : '—'
  const estadoBadge: Record<string,{txt:string,bg:string,col:string}> = { activo:{txt:'● Activo',bg:'var(--gl)',col:'var(--gd)'}, baja:{txt:'○ Baja',bg:'var(--redl)',col:'var(--red)'}, pausa:{txt:'Pausa',bg:'var(--ambl)',col:'#8A6410'} }
  const pagoLabel: Record<string,string> = { pagado:'Pagado', pendiente:'Pendiente', impago:'Impago' }
  const pagoDot: Record<string,string> = { pagado:'var(--g)', pendiente:'var(--amb)', impago:'var(--red)' }
  const bonoLabel: Record<string,string> = Object.fromEntries(bonosOpts.map(b=>[b.id,b.nombre]))

  const filtrados = pacientes.filter(p=>{
    const q = buscar.toLowerCase()
    const matchQ = !q || `${p.nombre} ${p.apellidos}`.toLowerCase().includes(q) || (p.nombre_clinica||'').toLowerCase().includes(q) || (p.telefono||'').includes(q)
    const bono = getBonoActual(p.id)
    const matchPago = filtroPago==='todos' || bono?.estado_pago===filtroPago || (!bono && filtroPago==='pendiente')
    const matchEstado = filtroEstado==='todos' || p.estado===filtroEstado
    const matchTipo = filtroTipo==='todos' || p.tipo_clase===filtroTipo
    // "Los que faltan" es lo que hace que la ronda se termine: recorrer cien filas con la
    // vista buscando huecos es la hoja de Excel otra vez.
    const matchRonda = !soloFaltan || !ronda || !respuestas[p.id]
    return matchQ && matchPago && matchTipo && matchEstado && matchRonda
  })

  // El denominador son los ACTIVOS, no todos: preguntarle el horario de septiembre a
  // alguien de baja no es una tarea pendiente, y metido en la cuenta haría que la ronda
  // no llegara nunca al final.
  const cuenta = contar(pacientes.filter(p=>p.estado==='activo'), respuestas)

  // Conteo por categoria, respetando buscador y los OTROS filtros
  function baseFiltrada(excluir: string) {
    const q = buscar.toLowerCase()
    return pacientes.filter(p=>{
      const matchQ = !q || `${p.nombre} ${p.apellidos}`.toLowerCase().includes(q) || (p.nombre_clinica||'').toLowerCase().includes(q) || (p.telefono||'').includes(q)
      const bono = getBonoActual(p.id)
      const matchPago = excluir==='pago' || filtroPago==='todos' || bono?.estado_pago===filtroPago || (!bono && filtroPago==='pendiente')
      const matchEstado = excluir==='estado' || filtroEstado==='todos' || p.estado===filtroEstado
      const matchTipo = excluir==='tipo' || filtroTipo==='todos' || p.tipo_clase===filtroTipo
      return matchQ && matchPago && matchEstado && matchTipo
    })
  }
  function nPago(f: string) {
    const base = baseFiltrada('pago')
    if (f==='todos') return base.length
    return base.filter(p=>{ const b=getBonoActual(p.id); return b?.estado_pago===f || (!b && f==='pendiente') }).length
  }
  function nEstado(f: string) {
    const base = baseFiltrada('estado')
    if (f==='todos') return base.length
    return base.filter(p=>p.estado===f).length
  }
  function nTipo(f: string) {
    const base = baseFiltrada('tipo')
    if (f==='todos') return base.length
    return base.filter(p=>p.tipo_clase===f).length
  }

  return (
    <>
      {/* FILTROS */}
      <div style={{display:'flex',alignItems:'center',gap:7,flexWrap:'wrap',marginBottom:8,background:'var(--w)',border:'1px solid var(--bd)',borderRadius:'var(--rl)',padding:'8px 12px'}}>
        <input className="input" placeholder="Buscar por nombre, clínica o teléfono..." value={buscar} onChange={e=>setBuscar(e.target.value)} style={{flex:1,minWidth:200}}/>
        <button className="btn btn-p btn-sm" onClick={()=>setModal(true)}>+ Nuevo paciente</button>
      </div>

      {/* FILTROS CON CONTADORES */}
      <div style={{display:'flex',alignItems:'center',gap:10,flexWrap:'wrap',marginBottom:8,background:'var(--w)',border:'1px solid var(--bd)',borderRadius:'var(--rl)',padding:'8px 12px'}}>
        <div style={{display:'flex',alignItems:'center',gap:5,flexWrap:'wrap'}}>
          <span style={{fontSize:9,color:'var(--grl)',marginRight:2}}>Pago</span>
          {[['todos','Todos'],['pagado','✓ Pagado'],['pendiente','Pendiente'],['impago','Impago']].map(([f,l])=>(
            <span key={f} onClick={()=>setFiltroPago(f)} style={{fontSize:9,padding:'3px 9px',borderRadius:99,border:'1px solid var(--bd)',cursor:'pointer',background:filtroPago===f?'var(--g)':'var(--w)',color:filtroPago===f?'#fff':'var(--gr)',display:'flex',alignItems:'center',gap:4}}>
              {l} <b style={{fontWeight:600}}>{nPago(f)}</b>
            </span>
          ))}
        </div>
        <div style={{width:1,height:18,background:'var(--bd)'}}/>
        <div style={{display:'flex',alignItems:'center',gap:5,flexWrap:'wrap'}}>
          <span style={{fontSize:9,color:'var(--grl)',marginRight:2}}>Estado</span>
          {[['activo','Activos'],['baja','Bajas'],['pausa','Pausas'],['todos','Todos']].map(([f,l])=>(
            <span key={f} onClick={()=>setFiltroEstado(f)} style={{fontSize:9,padding:'3px 9px',borderRadius:99,border:'1px solid var(--bd)',cursor:'pointer',background:filtroEstado===f?'var(--g)':'var(--w)',color:filtroEstado===f?'#fff':'var(--gr)',display:'flex',alignItems:'center',gap:4}}>
              {l} <b style={{fontWeight:600}}>{nEstado(f)}</b>
            </span>
          ))}
        </div>
        <div style={{width:1,height:18,background:'var(--bd)'}}/>
        <div style={{display:'flex',alignItems:'center',gap:5,flexWrap:'wrap'}}>
          <span style={{fontSize:9,color:'var(--grl)',marginRight:2}}>Tipo</span>
          <span onClick={()=>setFiltroTipo('todos')} style={{fontSize:9,padding:'3px 9px',borderRadius:99,border:'1px solid var(--bd)',cursor:'pointer',background:filtroTipo==='todos'?'var(--g)':'var(--w)',color:filtroTipo==='todos'?'#fff':'var(--gr)',display:'flex',alignItems:'center',gap:4}}>
            Todos <b style={{fontWeight:600}}>{nTipo('todos')}</b>
          </span>
          {tiposClase.map((t:any)=>(
            <span key={t.valor} onClick={()=>setFiltroTipo(t.valor)} style={{fontSize:9,padding:'3px 9px',borderRadius:99,border:'1px solid var(--bd)',cursor:'pointer',background:filtroTipo===t.valor?'var(--g)':'var(--w)',color:filtroTipo===t.valor?'#fff':'var(--gr)',display:'flex',alignItems:'center',gap:4}}>
              {t.nombre} <b style={{fontWeight:600}}>{nTipo(t.valor)}</b>
            </span>
          ))}
        </div>
      </div>

      {/* RONDA ABIERTA · el contador es lo que hace que la tarea se acabe */}
      {ronda && (
        <div className="fila-p" style={{borderLeftColor:cuenta.pendientes===0?'var(--g)':'var(--amb)',marginBottom:10,display:'flex',alignItems:'center',gap:10,flexWrap:'wrap'}}>
          <span style={{fontSize:13,color:'var(--n)'}}>
            <b style={{fontWeight:500}}>{ronda.nombre}</b>
            {ronda.descripcion && <span style={{color:'var(--gr)'}}> · {ronda.descripcion}</span>}
          </span>
          <span style={{fontSize:13,color:'var(--gr)'}}>
            {cuenta.pendientes===0
              ? `Preguntados los ${cuenta.total}`
              : `Faltan ${cuenta.pendientes} de ${cuenta.total}`}
            {cuenta.preguntados>0 && <> · {cuenta.preguntados} sin contestar</>}
          </span>
          <button className={`chip-sel ${soloFaltan?'on':''}`} style={{marginLeft:'auto'}}
            onClick={()=>setSoloFaltan(v=>!v)}>
            Solo los que faltan
          </button>
        </div>
      )}

      {/* TABLA */}
      {loading ? <div className="loading">Cargando pacientes...</div> : (
        <div style={{background:'var(--w)',border:'1px solid var(--bd)',borderRadius:'var(--rl)',overflow:'hidden'}}>
          <div style={{display:'grid',gridTemplateColumns:ronda?'1fr 95px 100px 120px 105px 170px':'1fr 95px 100px 120px 105px',background:'var(--bl)',borderBottom:'1px solid var(--bd)'}}>
            {['Paciente','Estado','Bono','Tipo clase','Cuota actual',...(ronda?[ronda.nombre]:[])].map((h,i)=>(
              <div key={i} style={{fontSize:9,fontWeight:500,color:'var(--grl)',letterSpacing:.5,textTransform:'uppercase',padding:'7px 10px',borderLeft:i>0?'1px solid var(--bd)':'none'}}>{h}</div>
            ))}
          </div>
          {filtrados.length===0 && <div className="loading">Sin resultados</div>}
          {filtrados.map(p=>{
            const bono = getBonoActual(p.id)
            const pago = bono?.estado_pago || 'pendiente'
            return (
              <Link key={p.id} href={`/pacientes/${p.id}`} style={{textDecoration:'none',display:'grid',gridTemplateColumns:ronda?'1fr 95px 100px 120px 105px 170px':'1fr 95px 100px 120px 105px',borderBottom:'1px solid var(--bl)',alignItems:'center',cursor:'pointer',background:pago==='impago'?'var(--redl)':'var(--w)',transition:'background .1s'}}
                onMouseOver={e=>(e.currentTarget as HTMLElement).style.background=pago==='impago'?'#fce8e8':'var(--gl)'}
                onMouseOut={e=>(e.currentTarget as HTMLElement).style.background=pago==='impago'?'var(--redl)':'var(--w)'}>
                <div style={{padding:'8px 10px'}}>
                  <div style={{fontSize:12,fontWeight:400,color:'var(--n)',display:'flex',alignItems:'center',gap:6}}>{p.nombre} {p.apellidos}{p.pendiente_valoracion&&<span style={{fontSize:8,fontWeight:600,padding:'2px 7px',borderRadius:99,background:'var(--ambl)',color:'#8A6410',border:'1px solid var(--amb)',whiteSpace:'nowrap'}}>Pendiente valoración</span>}</div>
                  <div style={{fontSize:9,color:'var(--grl)',marginTop:1}}>{p.nombre_clinica ? `"${p.nombre_clinica}" · ` : ''}{p.email || p.telefono || '—'}</div>
                </div>
                <div style={{padding:'8px 10px',borderLeft:'1px solid var(--bl)'}}>
                  <span style={{fontSize:9,fontWeight:500,padding:'2px 8px',borderRadius:99,background:estadoBadge[p.estado]?.bg||'var(--bl)',color:estadoBadge[p.estado]?.col||'var(--gr)'}}>{estadoBadge[p.estado]?.txt||p.estado}</span>
                </div>
                <div style={{padding:'8px 10px',borderLeft:'1px solid var(--bl)'}}>
                  {bono ? (
                    <span className="badge badge-g">{bonoLabel[bono.tipo]||bono.tipo}</span>
                  ) : (
                    <button className="chip-ed chip-ed-n" title="Asignar un bono"
                      onClick={e=>{e.preventDefault();e.stopPropagation();setModalBonoPac({ paciente_id:p.id, bono:null })}}>
                      <Ic name="mas" size={12}/> Asignar
                    </button>
                  )}
                </div>
                <div style={{padding:'8px 10px',borderLeft:'1px solid var(--bl)',fontSize:11,fontWeight:300}}>{labelTipo(p.tipo_clase)}</div>
                <div style={{padding:'8px 10px',borderLeft:'1px solid var(--bl)'}}>
                  {bono ? (
                    <button className={`chip-ed ${pago==='impago'?'chip-ed-r':pago==='pendiente'?'chip-ed-a':''}`} title="Cambiar el estado de pago"
                      onClick={e=>{e.preventDefault();e.stopPropagation();const r=(e.currentTarget as HTMLElement).getBoundingClientRect();setMenuPago({ bono, x:r.left, y:r.bottom+4 })}}>
                      {pagoLabel[pago]||'—'} <Ic name="abajo" size={12}/>
                    </button>
                  ) : (
                    <span style={{fontSize:11,color:'var(--grl)'}}>Sin cuota</span>
                  )}
                </div>
                {ronda && (()=>{
                  const r = respuestas[p.id]
                  const col = r?.estado==='respondido' ? 'var(--g)'
                    : r?.estado==='preguntado' ? 'var(--amb)'
                    : r?.estado==='no_procede' ? 'var(--grl)' : ''
                  return (
                    <div style={{padding:'6px 8px',borderLeft:'1px solid var(--bl)',minWidth:0}}>
                      <button className={`chip-ed ${r?.estado==='preguntado'?'chip-ed-a':r?'':'chip-ed-n'}`}
                        title={r?.respuesta || 'Marcar y anotar lo que diga'}
                        style={{width:'100%',justifyContent:'flex-start',color:col||undefined}}
                        onClick={e=>{e.preventDefault();e.stopPropagation()
                          const b=(e.currentTarget as HTMLElement).getBoundingClientRect()
                          setEditRonda({ paciente:p, estado:r?.estado||null, texto:r?.respuesta||'', x:Math.min(b.left, window.innerWidth-300), y:b.bottom+4 })}}>
                        <span style={{overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>
                          {r?.respuesta ? r.respuesta
                            : r?.estado==='respondido' ? 'Respondido'
                            : r?.estado==='preguntado' ? 'Sin contestar'
                            : r?.estado==='no_procede' ? 'No procede'
                            : 'Pendiente'}
                        </span>
                      </button>
                    </div>
                  )
                })()}
              </Link>
            )
          })}
        </div>
      )}

      {/* MARCAR EN LA RONDA · junto a la fila, no en un modal a pantalla completa:
          se marcan cien seguidos y abrir y cerrar un modal cada vez cansa a los diez. */}
      {editRonda && ronda && (
        <>
          <div onClick={()=>setEditRonda(null)} style={{position:'fixed',inset:0,zIndex:60}}/>
          <div style={{position:'fixed',left:editRonda.x,top:editRonda.y,zIndex:61,width:288,background:'var(--w)',border:'1px solid var(--bd)',borderRadius:'var(--rl)',boxShadow:'var(--sh-md)',padding:'11px 12px'}}>
            <div style={{fontSize:13,color:'var(--n)',marginBottom:8}}>
              {editRonda.paciente.nombre} {editRonda.paciente.apellidos}
            </div>
            <div style={{display:'flex',gap:4,flexWrap:'wrap',marginBottom:8}}>
              {ESTADOS_RONDA.map(e=>(
                <button key={e.id} className={`chip-sel ${editRonda.estado===e.id?'on':''}`} title={e.ayuda}
                  onClick={()=>setEditRonda((p:any)=>({...p,estado:p.estado===e.id?null:e.id}))}>
                  {e.nombre}
                </button>
              ))}
            </div>
            <textarea className="input" value={editRonda.texto} autoFocus
              onChange={e=>setEditRonda((p:any)=>({...p,texto:e.target.value}))}
              placeholder="Lo que te dijo. Ej: martes y jueves a las 19"
              style={{minHeight:52,fontSize:13}}/>
            <div style={{display:'flex',gap:6,alignItems:'center',marginTop:8}}>
              {editRonda.estado && (
                <button className="btn btn-t btn-sm" title="Vuelve a pendiente"
                  onClick={async()=>{await marcarEnRonda(editRonda.paciente.id,null);setEditRonda(null)}}>
                  Quitar
                </button>
              )}
              <button className="btn btn-t btn-sm" style={{marginLeft:'auto'}} onClick={()=>setEditRonda(null)}>Cancelar</button>
              <button className="btn btn-p btn-sm" onClick={async()=>{
                // Escribir la respuesta ya significa que contestó: obligar a marcar
                // además el estado sería pedir dos clics para decir una sola cosa.
                const estado = editRonda.texto.trim() ? 'respondido' : (editRonda.estado || 'preguntado')
                await marcarEnRonda(editRonda.paciente.id, estado, editRonda.texto.trim())
                setEditRonda(null)
              }}>Guardar</button>
            </div>
          </div>
        </>
      )}

      {/* MODAL NUEVO PACIENTE */}
      {modal && (
        <div className="modal-bg" onClick={e=>{if(e.target===e.currentTarget)setModal(false)}}>
          <div className="modal">
            <div className="modal-title">Nuevo paciente<button className="modal-close" onClick={()=>setModal(false)}>✕</button></div>
            <div style={{fontSize:10,color:'var(--grl)',marginBottom:14,fontWeight:300}}>Los campos marcados son obligatorios</div>
            <div className="g2">
              <div className="field"><label>Nombre *</label><input className="input" value={nuevo.nombre} onChange={e=>setNuevo(p=>({...p,nombre:e.target.value}))} placeholder="Nombre"/></div>
              <div className="field"><label>Apellidos *</label><input className="input" value={nuevo.apellidos} onChange={e=>setNuevo(p=>({...p,apellidos:e.target.value}))} placeholder="Apellidos"/></div>
              <div className="field"><label>Nombre en clínica</label><input className="input" value={nuevo.nombre_clinica||''} onChange={e=>setNuevo(p=>({...p,nombre_clinica:e.target.value}))} placeholder="ej. Manu (nombre corto)"/></div>
              <div className="field"><label>Teléfono</label><input className="input" value={nuevo.telefono} onChange={e=>setNuevo(p=>({...p,telefono:e.target.value}))} placeholder="+34 600 000 000"/></div>
              <div className="field"><label>Email</label><input className="input" type="email" value={nuevo.email} onChange={e=>setNuevo(p=>({...p,email:e.target.value}))} placeholder="correo@email.com"/></div>
              <div className="field"><label>DNI</label><input className="input" value={nuevo.dni} onChange={e=>setNuevo(p=>({...p,dni:e.target.value}))} placeholder="12345678A"/></div>
              <div className="field"><label>Fecha nacimiento</label><input className="input" type="date" value={nuevo.fecha_nacimiento} onChange={e=>setNuevo(p=>({...p,fecha_nacimiento:e.target.value}))}/></div>
              <div className="field"><label>Altura (cm)</label><input className="input" type="number" value={nuevo.altura_cm} onChange={e=>setNuevo(p=>({...p,altura_cm:e.target.value}))} placeholder="170"/></div>
              <div className="field"><label>Peso (kg)</label><input className="input" type="number" value={nuevo.peso_kg} onChange={e=>setNuevo(p=>({...p,peso_kg:e.target.value}))} placeholder="70"/></div>
            </div>
            <div className="field"><label>Tipo de clase</label>
              <select className="input" value={nuevo.tipo_clase} onChange={e=>setNuevo(p=>({...p,tipo_clase:e.target.value}))}>
                {tiposClase.map((t:any)=><option key={t.valor} value={t.valor}>{t.nombre}</option>)}
              </select>
            </div>
            <div style={{display:'flex',gap:8,marginTop:8}}>
              <button className="btn btn-d btn-sm" onClick={()=>setModal(false)}>Cancelar</button>
              <div style={{flex:1}}/>
              <button className="btn btn-p" onClick={crearPaciente}>✓ Crear paciente</button>
            </div>
          </div>
        </div>
      )}

      {/* MENU ESTADO DE PAGO */}
      {menuPago && (
        <>
          <div style={{position:'fixed',inset:0,zIndex:59}} onClick={()=>setMenuPago(null)}/>
          <div className="menu-flot" style={{left:menuPago.x,top:menuPago.y}}>
            {['pagado','pendiente','impago'].map(v=>(
              <button key={v} className="menu-it" onClick={async()=>{
                const b = menuPago.bono; setMenuPago(null)
                const r = await cambiarEstadoPago(b, v)
                if (!r.ok) { alert('Error: ' + r.error); return }
                cargar()
              }}>
                <span style={{width:7,height:7,borderRadius:'50%',background:pagoDot[v],flexShrink:0}}/>
                {pagoLabel[v]}
                {menuPago.bono?.estado_pago===v && <span style={{marginLeft:'auto',color:'var(--g)',display:'inline-flex'}}><Ic name="check" size={13}/></span>}
              </button>
            ))}
          </div>
        </>
      )}

      {modalBonoPac && (
        <ModalBono
          pacienteId={modalBonoPac.paciente_id}
          bonoActual={modalBonoPac.bono}
          bonosOpts={bonosOpts}
          onCerrar={()=>setModalBonoPac(null)}
          onGuardado={cargar}
        />
      )}
    </>
  )
}
