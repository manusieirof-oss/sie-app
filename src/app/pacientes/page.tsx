'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { cargarBonosTipos, BonoTipo, cambiarEstadoPago, cuotaVigenteDe, sesionesDe as sesionesDeBonos, bonosActivos } from '@/lib/bonos'
import Link from 'next/link'
import ModalCobro from '@/components/ModalCobro'
import { Ic } from '@/lib/icons'
import { TIPOS_CLASE_FALLBACK, cargarTiposClase, nombreTipoClase, iconTipoClase, colorTipoClase } from '@/lib/tipos'
import { rondaAbierta, respuestasDe, marcar, contar, ESTADOS_RONDA, type Ronda, type Respuesta, type EstadoRonda } from '@/lib/rondas'
import { resumenCitasFuturas, CITAS_POCAS, type ResumenCitas } from '@/lib/citas'
import { ESTADOS_PACIENTE, estadoDe as situacionDe, ultimaClaseDe, textoDesde,
         mesesDesde, MESES_HASTA_REVISAR, valoraronYNoEmpezaron,
         estadosPrevistos, textoCuando, esReciente, DIAS_RECIENTE, type EstadoPrevisto } from '@/lib/estadosPaciente'
import { cargarTarifas } from '@/lib/tarifas'

const MESES_CORTO = ['ene','feb','mar','abr','may','jun','jul','ago','sep','oct','nov','dic']

export default function PacientesPage() {
  const [pacientes, setPacientes] = useState<any[]>([])
  const [bonos, setBonos] = useState<any[]>([])
  const [bonosOpts, setBonosOpts] = useState<BonoTipo[]>([])
  const [loading, setLoading] = useState(true)
  const [buscar, setBuscar] = useState('')
  const [filtroPago, setFiltroPago] = useState('todos')
  const [filtroTipo, setFiltroTipo] = useState('todos')
  const [filtroEstado, setFiltroEstado] = useState('activo')
  // Aviso de los que se valoraron y nunca llegaron a dar una clase. Se pliega:
  // es información útil, no una alarma diaria.
  const [verSinEmpezar, setVerSinEmpezar] = useState(false)
  // Bajas y salidas ya firmadas, con su fecha. Saber esto por adelantado era
  // imposible: solo estaba en la cabeza de quien lo había hablado con el cliente.
  const [previstos, setPrevistos] = useState<EstadoPrevisto[]>([])
  const [tiposClase, setTiposClase] = useState<any[]>(TIPOS_CLASE_FALLBACK)
  const [modal, setModal] = useState(false)
  const [menuPago, setMenuPago] = useState<any>(null)
  // Cobro abierto desde el chip de la cuota. El modal es el mismo que usa el
  // pilar Cobros: un solo camino de escritura, varias puertas de entrada.
  const [cobrando, setCobrando] = useState<any>(null)
  const [planes, setPlanes] = useState<any[]>([])
  const [servicios, setServicios] = useState<any[]>([])
  const [descuentos, setDescuentos] = useState<any[]>([])
  const [pagoBono, setPagoBono] = useState<Record<string, boolean>>({})
  // Ronda de preguntas abierta, si la hay. Ver lib/rondas.ts.
  const [ronda, setRonda] = useState<Ronda|null>(null)
  const [respuestas, setRespuestas] = useState<Record<string,Respuesta>>({})
  const [soloFaltan, setSoloFaltan] = useState(false)
  const [editRonda, setEditRonda] = useState<any>(null)
  const [nuevo, setNuevo] = useState({ nombre:'', apellidos:'', nombre_clinica:'', telefono:'', email:'', tipo_clase:'entrenamiento', dni:'', fecha_nacimiento:'', altura_cm:'', peso_kg:'' })
  
  const [citasPac, setCitasPac] = useState<Record<string, ResumenCitas>>({})
  // Última clase DADA de cada uno. De aquí sale "cuánto hace que no viene", que
  // es el dato que convierte "puede volver" en algo accionable en vez de en un
  // cajón donde la gente se queda para siempre.
  const [ultimaClase, setUltimaClase] = useState<Map<string,string>>(new Map())

  const mesActual = new Date().getMonth()+1
  const anioActual = new Date().getFullYear()

  useEffect(() => { cargar(); cargarBonosTipos(false).then(setBonosOpts) }, [])

  async function cargar() {
    setLoading(true)
    const [{ data: p }, b] = await Promise.all([
      supabase.from('pacientes').select('*').order('nombre'),
      // TODOS los activos, sin filtrar por mes.
      //
      // Antes se pedían solo los del mes en curso en adelante, para que una cuota dejada
      // lista para septiembre no desapareciera. Pero eso dejó fuera lo contrario: un bono
      // activo de un mes pasado —o un bono de sesiones comprado en junio al que le quedan
      // sesiones— no llegaba, y el paciente salía con "Asignar" teniendo bono en su ficha.
      //
      // Qué bono es "el suyo" lo decide `cuotaVigenteDe`, no la consulta.
      bonosActivos(),
    ])
    setPacientes(p || [])
    setBonos(b || [])

    // Estado de pago DERIVADO: un bono está pagado si existe un cobro que lo
    // cubre. `bonos.estado_pago` solo se sigue leyendo para distinguir
    // "pendiente" de "impago", que es un juicio y no un hecho.
    const ids = (b || []).map((x:any)=>x.id)
    if (ids.length) {
      const { data: vp } = await supabase.from('v_bonos_pago').select('bono_id,pagado').in('bono_id', ids)
      setPagoBono(Object.fromEntries((vp || []).map((r:any)=>[r.bono_id, !!r.pagado])))
    } else setPagoBono({})

    // Catálogos para el modal de cobro.
    const { data: pl } = await supabase.from('planes').select('*').eq('activo', true)
    setPlanes(pl || [])
    const tar = await cargarTarifas()
    setServicios(tar.servicios); setDescuentos(tar.descuentos)
    // Una sola consulta para toda la lista: doscientos pacientes son doscientas
    // consultas si se pide uno a uno, y se nota al abrir.
    setCitasPac(await resumenCitasFuturas((p || []).filter((x:any)=>x.estado==='activo').map((x:any)=>x.id)))
    const uc = await ultimaClaseDe((p || []).map((x:any)=>x.id))
    setUltimaClase(uc.mapa)
    const prev = await estadosPrevistos()
    setPrevistos(prev.filas)
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

  /**
   * El bono que le toca a este paciente: el de ESTE mes si lo tiene, y si no el
   * más próximo de los que vengan.
   *
   * El orden importa. Alguien puede tener la cuota de agosto y además la de
   * septiembre ya dejada lista; en la lista manda la de agosto, que es la que se
   * está cobrando ahora. La de septiembre solo aparece cuando no hay otra.
   *
   * Las ventas puntuales (bonos de sesiones) se saltan: no son la cuota del
   * paciente y enseñarlas en esa columna haría creer que tiene cuota quien solo
   * compró ocho sesiones sueltas.
   */
  const getBonoActual = (pacienteId: string) => cuotaVigenteDe(bonos, pacienteId)

  /**
   * Sus bonos de SESIONES vigentes, que no son la cuota pero sí son "tener bono".
   *
   * La columna sigue siendo la de la cuota mensual —enseñar ahí "8 sesiones" haría creer
   * que tiene mensualidad quien solo compró un bono suelto— pero decir "Asignar" a quien
   * acaba de comprar cuatro sesiones es peor: parece que no tiene nada y se le asigna otro
   * encima. Es justo lo que ha pasado.
   */
  const sesionesDe = (pacienteId: string) => sesionesDeBonos(bonos, pacienteId)

  // Los que se valoraron y nunca dieron una clase. Derivado, no marcado.
  const sinEmpezar = valoraronYNoEmpezaron(pacientes, ultimaClase)

  /** true si ese bono todavía no ha empezado: es una cuota dejada preparada. */
  const esFuturo = (b: any) => !!b && (b.anio > anioActual || (b.anio === anioActual && b.mes > mesActual))

  /**
   * Lo que se enseña en la columna Cuota. "Pagado" NO sale de `estado_pago`:
   * sale de que exista un cobro. Si no lo hay, manda el juicio guardado
   * (impago) y si no, pendiente.
   */
  function estadoPagoDe(bono: any): string {
    if (!bono) return 'pendiente'
    if (pagoBono[bono.id]) return 'pagado'
    return bono.estado_pago === 'impago' ? 'impago' : 'pendiente'
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
  // Los colores y las etiquetas salen de `lib/estadosPaciente`, que es donde se
  // decide qué significa cada estado. Duplicarlos aquí fue lo que permitió que
  // "pausa" acabara queriendo decir dos cosas distintas según la pantalla.
  const estadoBadge: Record<string,{txt:string,bg:string,col:string}> =
    Object.fromEntries(ESTADOS_PACIENTE.map(e => [e.id, { txt: e.badge, bg: e.bg, col: e.col }]))
  const pagoLabel: Record<string,string> = { pagado:'Pagado', pendiente:'Pendiente', impago:'Impago' }
  const pagoDot: Record<string,string> = { pagado:'var(--g)', pendiente:'var(--amb)', impago:'var(--red)' }
  const bonoLabel: Record<string,string> = Object.fromEntries(bonosOpts.map(b=>[b.id,b.nombre]))

  const filtrados = pacientes.filter(p=>{
    const q = buscar.toLowerCase()
    const matchQ = !q || `${p.nombre} ${p.apellidos}`.toLowerCase().includes(q) || (p.nombre_clinica||'').toLowerCase().includes(q) || (p.telefono||'').includes(q)
    const bono = getBonoActual(p.id)
    const matchPago = filtroPago==='todos' || estadoPagoDe(bono)===filtroPago
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
      const matchPago = excluir==='pago' || filtroPago==='todos' || estadoPagoDe(bono)===filtroPago
      const matchEstado = excluir==='estado' || filtroEstado==='todos' || p.estado===filtroEstado
      const matchTipo = excluir==='tipo' || filtroTipo==='todos' || p.tipo_clase===filtroTipo
      return matchQ && matchPago && matchEstado && matchTipo
    })
  }
  function nPago(f: string) {
    const base = baseFiltrada('pago')
    if (f==='todos') return base.length
    return base.filter(p=>estadoPagoDe(getBonoActual(p.id))===f).length
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
          {[['activo','Activos'],['pausa','Pausas'],['puede_volver','Pueden volver'],['baja','Bajas'],['todos','Todos']].map(([f,l])=>(
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

      {/* LO QUE VIENE
          Bajas ya habladas con el cliente y con fecha puesta. Esto antes no
          existía en ningún sitio: quien lo hablaba se lo guardaba en la cabeza,
          y el resto se enteraba el día que la persona dejaba de aparecer. */}
      {!loading && previstos.length > 0 && (
        <div style={{background:'var(--ambl)',border:'1px solid var(--amb)',borderRadius:'var(--rl)',padding:'10px 13px',marginBottom:10}}>
          <div style={{fontSize:10,fontWeight:600,color:'#7A5800',display:'flex',alignItems:'center',gap:5,marginBottom:7}}>
            <Ic name="calendario" size={12}/>
            {previstos.length===1 ? '1 salida prevista' : `${previstos.length} salidas previstas`}
          </div>
          <div style={{display:'flex',flexWrap:'wrap',gap:6}}>
            {previstos.map(v=>(
              <Link key={v.paciente_id} href={`/pacientes/${v.paciente_id}`}
                style={{fontSize:10,padding:'4px 10px',borderRadius:99,background:'var(--w)',border:'1px solid #E5D3A8',
                        color:'var(--n)',textDecoration:'none',whiteSpace:'nowrap'}}>
                {v.nombre} {v.apellidos}
                <span style={{color:'#8A6410',marginLeft:5,fontWeight:600}}>{textoCuando(v.dias_para)}</span>
                {v.estado_programado==='puede_volver' && <span style={{color:'var(--grl)',marginLeft:4}}>· puede volver</span>}
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* SE VALORARON Y NO LLEGARON A EMPEZAR
          No es un estado que nadie marque: se deduce de que no tengan ninguna
          clase dada. Marcarlo a mano obligaría a acordarse de desmarcarlo el día
          que por fin vengan, y de eso no se acuerda nadie.
          Va plegado porque es para revisar de vez en cuando, no una alarma. */}
      {!loading && sinEmpezar.length > 0 && (
        <div style={{background:'var(--bl)',border:'1px solid var(--bd)',borderRadius:'var(--rl)',padding:'9px 13px',marginBottom:10}}>
          <div onClick={()=>setVerSinEmpezar(v=>!v)}
            style={{display:'flex',alignItems:'center',gap:6,cursor:'pointer',fontSize:10,color:'var(--gr)'}}>
            <Ic name="alerta" size={12}/>
            <span style={{flex:1}}>
              <strong>{sinEmpezar.length}</strong> {sinEmpezar.length===1?'persona se valoró':'personas se valoraron'} y nunca {sinEmpezar.length===1?'llegó':'llegaron'} a dar una clase
            </span>
            <span style={{fontSize:9,color:'var(--grl)'}}>{verSinEmpezar?'ocultar':'ver quiénes'}</span>
          </div>
          {verSinEmpezar && (
            <div style={{display:'flex',flexWrap:'wrap',gap:6,marginTop:9}}>
              {sinEmpezar.map(p=>(
                <Link key={p.id} href={`/pacientes/${p.id}`}
                  style={{fontSize:10,padding:'4px 10px',borderRadius:99,background:'var(--w)',border:'1px solid var(--bd)',
                          color:'var(--n)',textDecoration:'none',whiteSpace:'nowrap'}}>
                  {p.nombre} {p.apellidos}
                  <span style={{color:'var(--grl)',marginLeft:5}}>{situacionDe(p.estado).nombre.toLowerCase()}</span>
                </Link>
              ))}
            </div>
          )}
        </div>
      )}

      {/* TABLA */}
      {loading ? <div className="loading">Cargando pacientes...</div> : (
        <div style={{background:'var(--w)',border:'1px solid var(--bd)',borderRadius:'var(--rl)',overflow:'hidden'}}>
          <div style={{display:'grid',gridTemplateColumns:ronda?'1fr 95px 100px 120px 90px 105px 170px':'1fr 95px 100px 120px 90px 105px',background:'var(--bl)',borderBottom:'1px solid var(--bd)'}}>
            {['Paciente','Estado','Bono','Tipo clase','Citas',' Cuota actual'.trim(),...(ronda?[ronda.nombre]:[])].map((h,i)=>(
              <div key={i} style={{fontSize:9,fontWeight:500,color:'var(--grl)',letterSpacing:.5,textTransform:'uppercase',padding:'7px 10px',borderLeft:i>0?'1px solid var(--bd)':'none'}}>{h}</div>
            ))}
          </div>
          {filtrados.length===0 && <div className="loading">Sin resultados</div>}
          {filtrados.map(p=>{
            const bono = getBonoActual(p.id)
            const pago = estadoPagoDe(bono)
            return (
              <Link key={p.id} href={`/pacientes/${p.id}`} style={{textDecoration:'none',display:'grid',gridTemplateColumns:ronda?'1fr 95px 100px 120px 90px 105px 170px':'1fr 95px 100px 120px 90px 105px',borderBottom:'1px solid var(--bl)',alignItems:'center',cursor:'pointer',background:pago==='impago'?'var(--redl)':'var(--w)',transition:'background .1s'}}
                onMouseOver={e=>(e.currentTarget as HTMLElement).style.background=pago==='impago'?'#fce8e8':'var(--gl)'}
                onMouseOut={e=>(e.currentTarget as HTMLElement).style.background=pago==='impago'?'var(--redl)':'var(--w)'}>
                <div style={{padding:'8px 10px'}}>
                  <div style={{fontSize:12,fontWeight:400,color:'var(--n)',display:'flex',alignItems:'center',gap:6}}>{p.nombre} {p.apellidos}{p.pendiente_valoracion&&<span style={{fontSize:8,fontWeight:600,padding:'2px 7px',borderRadius:99,background:'var(--ambl)',color:'#8A6410',border:'1px solid var(--amb)',whiteSpace:'nowrap'}}>Pendiente valoración</span>}</div>
                  <div style={{fontSize:9,color:'var(--grl)',marginTop:1}}>{p.nombre_clinica ? `"${p.nombre_clinica}" · ` : ''}{p.email || p.telefono || '—'}</div>
                </div>
                <div style={{padding:'8px 10px',borderLeft:'1px solid var(--bl)'}}>
                  <span style={{fontSize:9,fontWeight:500,padding:'2px 8px',borderRadius:99,background:estadoBadge[p.estado]?.bg||'var(--bl)',color:estadoBadge[p.estado]?.col||'var(--gr)'}}>{estadoBadge[p.estado]?.txt||p.estado}</span>
                  {/* Cuánto hace que no viene, solo en los que pueden volver:
                      es el dato con el que se decide si toca llamarles o
                      cerrarles la ficha. En un activo no dice nada útil. */}
                  {p.estado==='puede_volver' && (() => {
                    const m = mesesDesde(ultimaClase.get(p.id))
                    const revisar = m == null || m >= MESES_HASTA_REVISAR
                    return (
                      <div style={{fontSize:8,marginTop:2,color:revisar?'var(--red)':'var(--grl)',fontWeight:revisar?600:400}}>
                        {textoDesde(ultimaClase.get(p.id))}
                      </div>
                    )
                  })()}
                  {/* SALIDA PROGRAMADA. Va debajo del estado, no en el panel de
                      arriba solamente: el panel se lee una vez y se ignora, pero
                      esta línea la ves cada vez que buscas a esa persona por
                      cualquier otro motivo. Alguien que se va el mes que viene
                      no se le renueva el bono ni se le cierra un trimestre. */}
                  {p.estado_programado && p.estado_programado_desde && (
                    <div style={{fontSize:8,marginTop:2,color:'#8A6410',fontWeight:600,whiteSpace:'nowrap'}}>
                      {p.estado_programado==='baja' ? 'baja el '
                       : p.estado_programado==='activo' ? 'vuelve el '
                       : 'lo deja el '}
                      {new Date(p.estado_programado_desde+'T12:00:00').toLocaleDateString('es-ES',{day:'numeric',month:'short'})}
                    </div>
                  )}
                  {/* RECIENTE. Quien acaba de cambiar de estado necesita que le
                      mires la ficha: si acaba de volver, ¿tiene bono?, ¿tiene
                      citas? Pasados diez días ya es uno más y la marca sobra. */}
                  {esReciente(p) && (
                    <div style={{fontSize:8,marginTop:2,color:'var(--gd)',fontWeight:600}}>reciente</div>
                  )}
                </div>
                <div style={{padding:'8px 10px',borderLeft:'1px solid var(--bl)'}}>
                  {bono ? (
                    <>
                      <span className="badge badge-g">{bonoLabel[bono.tipo]||bono.tipo}</span>
                      {/* Una cuota preparada para más adelante no es lo mismo que
                          una vigente: se ve que tiene bono, y desde cuándo. */}
                      {esFuturo(bono) && (
                        <div style={{fontSize:8,color:'var(--gd)',marginTop:2,whiteSpace:'nowrap'}}>
                          desde {MESES_CORTO[bono.mes-1]}
                        </div>
                      )}
                    </>
                  ) : (()=>{
                    const ses = sesionesDe(p.id)
                    const nSes = ses.reduce((n:number,b:any)=>n+(b.sesiones_totales||0),0)
                    return (
                      <>
                        {ses.length>0 && (
                          <div title={`${ses.length} bono${ses.length>1?'s':''} de sesiones`}
                            style={{fontSize:9,fontWeight:500,padding:'2px 8px',borderRadius:99,background:'var(--ambl)',color:'#7A5800',whiteSpace:'nowrap',display:'inline-block',marginBottom:3}}>
                            {nSes} sesiones
                          </div>
                        )}
                        {/* AQUÍ NO SE ASIGNA. Los bonos se ponen solo desde la ficha.
                            Había dos sitios para lo mismo y cada uno leía los bonos a su
                            manera, así que se asignaban bonos encima de otros que la lista
                            no estaba viendo. Un solo sitio y se acabó.
                            La columna sigue avisando de quién no tiene: para eso está. */}
                        {ses.length===0 && (
                          <span title="No tiene cuota. Se le asigna desde su ficha."
                            style={{fontSize:9,fontWeight:500,padding:'2px 8px',borderRadius:99,background:'var(--redl)',color:'var(--red)',border:'1px solid #F5C8C8',whiteSpace:'nowrap',display:'inline-block'}}>
                            Sin cuota
                          </span>
                        )}
                      </>
                    )
                  })()}
                </div>
                {/* TIPO DE CLASE. Era la única columna en texto pelado entre chips y
                    badges, y por eso cantaba. Va como distintivo, con el icono y el color
                    del propio tipo —los mismos que usa la agenda—, para que se reconozca
                    sin leerlo. No es pulsable: el tipo se cambia en su ficha, y un chip
                    con pinta de botón que no hace nada es peor que un texto. */}
                <div style={{padding:'8px 10px',borderLeft:'1px solid var(--bl)'}}>
                  {p.tipo_clase ? (() => {
                    const col = colorTipoClase(tiposClase, p.tipo_clase)
                    const t = tiposClase.find((x:any)=>x.valor===p.tipo_clase)
                    return (
                      <span title={labelTipo(p.tipo_clase)}
                        style={{display:'inline-flex',alignItems:'center',gap:5,fontSize:10,fontWeight:600,
                          padding:'3px 9px',borderRadius:99,whiteSpace:'nowrap',
                          background:col+'1A',color:col}}>
                        <Ic name={iconTipoClase(p.tipo_clase, t?.icono)} size={11}/>
                        {labelTipo(p.tipo_clase)}
                      </span>
                    )
                  })() : <span style={{fontSize:11,color:'var(--grl)'}}>—</span>}
                </div>
                {/* CITAS POR DELANTE / DE ESAS, CUÁNTAS LLEVAN SESIÓN.
                    Sale de las citas, no de un contador guardado: cambiar, cancelar o
                    anular una cita lo recalcula solo. En pausa y en baja no se avisa:
                    quien está en pausa no se ha quedado sin citas. */}
                <div style={{padding:'8px 10px',borderLeft:'1px solid var(--bl)'}}>
                  {(() => {
                    if (p.estado!=='activo') return <span style={{fontSize:11,color:'var(--bm)'}}>—</span>
                    const c = citasPac[p.id]
                    if (!c || c.citas===0) return <span title="No tiene ninguna cita por delante" style={{fontSize:9,fontWeight:600,padding:'2px 8px',borderRadius:99,background:'var(--redl)',color:'var(--red)',border:'1px solid #F5C8C8',whiteSpace:'nowrap'}}>Sin citas</span>
                    const pocas = c.citas<=CITAS_POCAS
                    return (
                      <span title={`${c.citas} citas por delante · ${c.conSesion} con sesión asignada`}
                        style={{fontSize:11,fontWeight:500,padding:'2px 8px',borderRadius:99,whiteSpace:'nowrap',
                          background:pocas?'var(--redl)':'var(--bl)',color:pocas?'var(--red)':'var(--gr)',
                          border:`1px solid ${pocas?'#F5C8C8':'var(--bd)'}`}}>
                        {c.citas}/{c.conSesion}
                      </span>
                    )
                  })()}
                </div>
                <div style={{padding:'8px 10px',borderLeft:'1px solid var(--bl)'}}>
                  {bono ? (
                    <button className={`chip-ed ${pago==='impago'?'chip-ed-r':pago==='pendiente'?'chip-ed-a':''}`} title="Cambiar el estado de pago"
                      onClick={e=>{e.preventDefault();e.stopPropagation();const r=(e.currentTarget as HTMLElement).getBoundingClientRect();setMenuPago({ bono, paciente:p, x:r.left, y:r.bottom+4 })}}>
                      {pagoLabel[pago]||'—'} <Ic name="abajo" size={12}/>
                    </button>
                  ) : (
                    <span style={{fontSize:11,color:'var(--grl)'}}>Sin cuota</span>
                  )}
                </div>
                {ronda && (()=>{
                  const r = respuestas[p.id]
                  // Cada estado, su propio relleno. Ver `.chip-rd-*` en globals.css.
                  const cls = r?.estado==='respondido' ? 'chip-rd-ok'
                    : r?.estado==='preguntado' ? 'chip-rd-esp'
                    : r?.estado==='no_procede' ? 'chip-rd-no'
                    : 'chip-ed-n'
                  return (
                    <div style={{padding:'6px 8px',borderLeft:'1px solid var(--bl)',minWidth:0}}>
                      <button className={`chip-ed chip-rd ${cls}`}
                        title={r?.respuesta || 'Marcar y anotar lo que diga'}
                        onClick={e=>{e.preventDefault();e.stopPropagation()
                          const b=(e.currentTarget as HTMLElement).getBoundingClientRect()
                          // Se guardan los DOS bordes del botón. El panel se pinta debajo si
                          // cabe y encima si no, y eso solo se puede decidir al pintarlo.
                          setEditRonda({ paciente:p, estado:r?.estado||null, texto:r?.respuesta||'', x:Math.min(b.left, window.innerWidth-300), y:b.bottom+4, yTop:b.top })}}>
                        {/* El icono dice el estado aunque el texto sea la respuesta
                            escrita: con una respuesta larga, "respondido" desaparecía. */}
                        <Ic name={r?.estado==='respondido' ? 'check'
                          : r?.estado==='preguntado' ? 'reloj'
                          : r?.estado==='no_procede' ? 'cerrar' : 'mas'} size={11}/>
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
      {editRonda && ronda && (()=>{
        /**
         * EL PANEL TIENE QUE CABER EN LA PANTALLA.
         *
         * Se pintaba en `position:fixed` con el borde inferior del botón como `top`, sin
         * ningún límite. En las últimas filas de la tabla eso lo dejaba por debajo del
         * borde de la ventana, y como es fijo no hay scroll que lo alcance: el panel
         * existía, tapaba el clic de fondo y no había forma de verlo ni de cerrarlo salvo
         * pulsando fuera a ciegas. La `x` sí estaba acotada desde el principio; la `y` no.
         *
         * Si no cabe debajo del botón, se pinta encima. Y en cualquier caso se le pone un
         * alto máximo con scroll propio, para que ni con una pantalla muy baja quede algo
         * fuera de alcance.
         */
        const alto = typeof window !== 'undefined' ? window.innerHeight : 800
        const ESTIMADO = 300
        const cabeDebajo = alto - editRonda.y >= ESTIMADO
        const arriba = !cabeDebajo && editRonda.yTop > alto - editRonda.y
        const top = arriba ? Math.max(8, editRonda.yTop - Math.min(ESTIMADO, editRonda.yTop - 12)) : editRonda.y
        const maxAlto = arriba ? editRonda.yTop - 12 : alto - editRonda.y - 12
        return (
        <>
          <div onClick={()=>setEditRonda(null)} style={{position:'fixed',inset:0,zIndex:60}}/>
          <div style={{position:'fixed',left:editRonda.x,top,zIndex:61,width:288,maxHeight:Math.max(160,maxAlto),overflowY:'auto',background:'var(--w)',border:'1px solid var(--bd)',borderRadius:'var(--rl)',boxShadow:'var(--sh-md)',padding:'11px 12px'}}>
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
        )
      })()}

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

      {/* MENU ESTADO DE PAGO
          "Pagado" ya no se escribe aquí: cobrar es emitir una factura, y eso
          solo puede pasar por un sitio. El menú abre el mismo modal de cobro que
          usa el pilar Cobros. Lo que sí se decide aquí es el juicio sobre lo que
          sigue sin pagarse: pendiente o impago. */}
      {menuPago && (
        <>
          <div style={{position:'fixed',inset:0,zIndex:59}} onClick={()=>setMenuPago(null)}/>
          <div className="menu-flot" style={{left:menuPago.x,top:menuPago.y}}>
            <button className="menu-it" onClick={()=>{
              const m = menuPago; setMenuPago(null)
              setCobrando({ paciente: m.paciente, bono: m.bono })
            }}>
              <span style={{width:7,height:7,borderRadius:'50%',background:pagoDot['pagado'],flexShrink:0}}/>
              Cobrar y facturar…
            </button>
            {['pendiente','impago'].map(v=>(
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

      {cobrando && (
        <ModalCobro
          paciente={cobrando.paciente}
          bono={cobrando.bono}
          planes={planes}
          servicios={servicios}
          descuentos={descuentos}
          onCerrar={()=>setCobrando(null)}
          onEmitida={r=>{ alert(`Factura ${r.serie}/${String(r.numero).padStart(4,'0')} emitida.`); cargar() }}
        />
      )}
    </>
  )
}
