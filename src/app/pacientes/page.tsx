'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { cargarBonosTipos, BonoTipo, cambiarEstadoPago } from '@/lib/bonos'
import Link from 'next/link'
import ModalBono from './components/ModalBono'

export default function PacientesPage() {
  const [pacientes, setPacientes] = useState<any[]>([])
  const [bonos, setBonos] = useState<any[]>([])
  const [bonosOpts, setBonosOpts] = useState<BonoTipo[]>([])
  const [loading, setLoading] = useState(true)
  const [buscar, setBuscar] = useState('')
  const [filtroPago, setFiltroPago] = useState('todos')
  const [filtroTipo, setFiltroTipo] = useState('todos')
  const [filtroEstado, setFiltroEstado] = useState('activo')
  const [tiposClase, setTiposClase] = useState<any[]>([{valor:'entrenamiento',icono:'',nombre:'Entrenamiento'},{valor:'pilates',icono:'',nombre:'Pilates'},{valor:'rehabilitacion',icono:'',nombre:'Rehabilitación'},{valor:'individual',icono:'',nombre:'Individual'},{valor:'embarazadas',icono:'',nombre:'Embarazadas'}])
  const [modal, setModal] = useState(false)
  const [modalBonoPac, setModalBonoPac] = useState<any>(null)
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
    const { data: aj } = await supabase.from('ajustes').select('clave,valor').eq('clave','tipos_clase').maybeSingle()
    if (aj?.valor) { try { setTiposClase(JSON.parse(aj.valor)) } catch {} }
    setLoading(false)
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

  const tipoLabel: Record<string,string> = { entrenamiento:'Entrenamiento', pilates:'Pilates', rehabilitacion:'Rehabilitación' }
  const labelTipo = (v:string) => { const t = tiposClase.find((x:any)=>x.valor===v); return t ? t.nombre : (tipoLabel[v]||'—') }
  const estadoBadge: Record<string,{txt:string,bg:string,col:string}> = { activo:{txt:'● Activo',bg:'var(--gl)',col:'var(--gd)'}, baja:{txt:'○ Baja',bg:'var(--redl)',col:'var(--red)'}, pausa:{txt:'Pausa',bg:'var(--ambl)',col:'#8A6410'} }
  const pagoLabel: Record<string,string> = { pagado:'✓ Pagado', pendiente:'Pendiente', impago:'Impago' }
  const pagoBadge: Record<string,string> = { pagado:'badge-g', pendiente:'badge-pen', impago:'badge-imp' }
  const bonoLabel: Record<string,string> = Object.fromEntries(bonosOpts.map(b=>[b.id,b.nombre]))

  const filtrados = pacientes.filter(p=>{
    const q = buscar.toLowerCase()
    const matchQ = !q || `${p.nombre} ${p.apellidos}`.toLowerCase().includes(q) || (p.nombre_clinica||'').toLowerCase().includes(q) || (p.telefono||'').includes(q)
    const bono = getBonoActual(p.id)
    const matchPago = filtroPago==='todos' || bono?.estado_pago===filtroPago || (!bono && filtroPago==='pendiente')
    const matchEstado = filtroEstado==='todos' || p.estado===filtroEstado
    const matchTipo = filtroTipo==='todos' || p.tipo_clase===filtroTipo
    return matchQ && matchPago && matchTipo && matchEstado
  })

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

      {/* TABLA */}
      {loading ? <div className="loading">Cargando pacientes...</div> : (
        <div style={{background:'var(--w)',border:'1px solid var(--bd)',borderRadius:'var(--rl)',overflow:'hidden'}}>
          <div style={{display:'grid',gridTemplateColumns:'36px 1fr 95px 100px 120px 105px',background:'var(--bl)',borderBottom:'1px solid var(--bd)'}}>
            {['','Paciente','Estado','Bono','Tipo clase','Cuota actual'].map((h,i)=>(
              <div key={i} style={{fontSize:9,fontWeight:500,color:'var(--grl)',letterSpacing:.5,textTransform:'uppercase',padding:'7px 10px',borderLeft:i>0?'1px solid var(--bd)':'none'}}>{h}</div>
            ))}
          </div>
          {filtrados.length===0 && <div className="loading">Sin resultados</div>}
          {filtrados.map(p=>{
            const bono = getBonoActual(p.id)
            const pago = bono?.estado_pago || 'pendiente'
            const iniciales = `${p.nombre?.[0]||''}${p.apellidos?.[0]||''}`.toUpperCase()
            return (
              <Link key={p.id} href={`/pacientes/${p.id}`} style={{textDecoration:'none',display:'grid',gridTemplateColumns:'36px 1fr 95px 100px 120px 105px',borderBottom:'1px solid var(--bl)',alignItems:'center',cursor:'pointer',background:pago==='impago'?'var(--redl)':'var(--w)',transition:'background .1s'}}
                onMouseOver={e=>(e.currentTarget as HTMLElement).style.background=pago==='impago'?'#fce8e8':'var(--gl)'}
                onMouseOut={e=>(e.currentTarget as HTMLElement).style.background=pago==='impago'?'var(--redl)':'var(--w)'}>
                <div style={{padding:'8px 4px',display:'flex',alignItems:'center',justifyContent:'center'}}>
                  <div style={{width:26,height:26,borderRadius:'50%',background:'var(--gl)',border:'1.5px solid var(--gm)',display:'flex',alignItems:'center',justifyContent:'center',fontSize:9,fontWeight:500,color:'var(--gd)'}}>{iniciales}</div>
                </div>
                <div style={{padding:'8px 10px',borderLeft:'1px solid var(--bl)'}}>
                  <div style={{fontSize:12,fontWeight:400,color:'var(--n)'}}>{p.nombre} {p.apellidos}</div>
                  <div style={{fontSize:9,color:'var(--grl)',marginTop:1}}>{p.nombre_clinica ? `"${p.nombre_clinica}" · ` : ''}{p.email || p.telefono || '—'}</div>
                </div>
                <div style={{padding:'8px 10px',borderLeft:'1px solid var(--bl)'}}>
                  <span style={{fontSize:9,fontWeight:500,padding:'2px 8px',borderRadius:99,background:estadoBadge[p.estado]?.bg||'var(--bl)',color:estadoBadge[p.estado]?.col||'var(--gr)'}}>{estadoBadge[p.estado]?.txt||p.estado}</span>
                </div>
                <div style={{padding:'8px 10px',borderLeft:'1px solid var(--bl)'}}>
                  <span onClick={e=>{e.preventDefault();e.stopPropagation();setModalBonoPac({ paciente_id:p.id, bono })}} style={{cursor:'pointer'}} title="Clic para gestionar el bono">
                    {bono ? <span className="badge badge-g">{bonoLabel[bono.tipo]||bono.tipo}</span> : <span style={{fontSize:10,color:'var(--g)',textDecoration:'underline'}}>+ Asignar</span>}
                  </span>
                </div>
                <div style={{padding:'8px 10px',borderLeft:'1px solid var(--bl)',fontSize:11,fontWeight:300}}>{labelTipo(p.tipo_clase)}</div>
                <div style={{padding:'8px 10px',borderLeft:'1px solid var(--bl)'}}>
                  {bono ? (
                    <span className={`badge ${pagoBadge[pago]||'badge-b'}`}>{pagoLabel[pago]||'—'}</span>
                  ) : (
                    <span style={{fontSize:10,color:'var(--grl)'}}>Sin cuota</span>
                  )}
                </div>
              </Link>
            )
          })}
        </div>
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
