'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import Link from 'next/link'

export default function PacientesPage() {
  const [pacientes, setPacientes] = useState<any[]>([])
  const [bonos, setBonos] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [buscar, setBuscar] = useState('')
  const [filtroPago, setFiltroPago] = useState('todos')
  const [filtroTipo, setFiltroTipo] = useState('todos')
  const [filtroEstado, setFiltroEstado] = useState('activo')
  const [modal, setModal] = useState(false)
  const [nuevo, setNuevo] = useState({ nombre:'', apellidos:'', telefono:'', email:'', tipo_clase:'entrenamiento', dni:'', fecha_nacimiento:'', altura_cm:'', peso_kg:'' })
  
  const mesActual = new Date().getMonth()+1
  const anioActual = new Date().getFullYear()

  useEffect(() => { cargar() }, [])

  async function cargar() {
    setLoading(true)
    const [{ data: p }, { data: b }] = await Promise.all([
      supabase.from('pacientes').select('*').order('nombre'),
      supabase.from('bonos').select('*').eq('mes',mesActual).eq('anio',anioActual).eq('activo',true),
    ])
    setPacientes(p || [])
    setBonos(b || [])
    setLoading(false)
  }

  function getBonoActual(pacienteId: string) {
    return bonos.find(b=>b.paciente_id===pacienteId)
  }

  async function crearPaciente() {
    if (!nuevo.nombre || !nuevo.apellidos) { alert('Nombre y apellidos son obligatorios'); return }
    const { error } = await supabase.from('pacientes').insert({
      nombre: nuevo.nombre, apellidos: nuevo.apellidos, telefono: nuevo.telefono,
      email: nuevo.email, tipo_clase: nuevo.tipo_clase, dni: nuevo.dni,
      fecha_nacimiento: nuevo.fecha_nacimiento || null,
      altura_cm: nuevo.altura_cm ? parseInt(nuevo.altura_cm) : null,
      peso_kg: nuevo.peso_kg ? parseFloat(nuevo.peso_kg) : null,
      estado: 'activo',
    })
    if (error) { alert('Error: ' + error.message); return }
    setModal(false)
    setNuevo({ nombre:'', apellidos:'', telefono:'', email:'', tipo_clase:'entrenamiento', dni:'', fecha_nacimiento:'', altura_cm:'', peso_kg:'' })
    cargar()
  }

  const tipoLabel: Record<string,string> = { entrenamiento:'🏋 Entrenamiento', pilates:'🧘 Pilates', rehabilitacion:'🏥 Rehabilitación' }
  const pagoLabel: Record<string,string> = { pagado:'✓ Pagado', pendiente:'⏳ Pendiente', impago:'⚠ Impago' }
  const pagoBadge: Record<string,string> = { pagado:'badge-g', pendiente:'badge-pen', impago:'badge-imp' }
  const bonoLabel: Record<string,string> = { esencial:'Esencial', progreso:'Progreso', avanzado:'Avanzado', avanzado_mas1:'Avanzado +1' }

  const filtrados = pacientes.filter(p=>{
    const q = buscar.toLowerCase()
    const matchQ = !q || `${p.nombre} ${p.apellidos}`.toLowerCase().includes(q) || (p.telefono||'').includes(q)
    const bono = getBonoActual(p.id)
    const matchPago = filtroPago==='todos' || bono?.estado_pago===filtroPago || (!bono && filtroPago==='pendiente')
    const matchEstado = filtroEstado==='todos' || p.estado===filtroEstado
    const matchTipo = filtroTipo==='todos' || p.tipo_clase===filtroTipo
    return matchQ && matchPago && matchTipo && matchEstado
  })

  const totalPag = bonos.filter(b=>b.estado_pago==='pagado').length
  const totalPen = bonos.filter(b=>b.estado_pago==='pendiente').length
  const totalImp = bonos.filter(b=>b.estado_pago==='impago').length

  return (
    <>
      {/* FILTROS */}
      <div style={{display:'flex',alignItems:'center',gap:7,flexWrap:'wrap',marginBottom:8,background:'var(--w)',border:'1px solid var(--bd)',borderRadius:'var(--rl)',padding:'8px 12px'}}>
        <input className="input" placeholder="🔍 Buscar por nombre o teléfono..." value={buscar} onChange={e=>setBuscar(e.target.value)} style={{flex:1,minWidth:200}}/>
        <span style={{fontSize:9,color:'var(--grl)'}}>Pago:</span>
        {['todos','pagado','pendiente','impago'].map(f=>(
          <span key={f} className={`badge ${filtroPago===f?'badge-g':''}`} style={{cursor:'pointer',border:'1px solid var(--bd)',padding:'3px 9px',borderRadius:99}} onClick={()=>setFiltroPago(f)}>
            {f==='todos'?'Todos':pagoLabel[f]}
          </span>
        ))}
        <span style={{fontSize:9,color:'var(--grl)'}}>Tipo:</span>
        {['todos','entrenamiento','pilates','rehabilitacion'].map(f=>(
          <span key={f} className={`badge ${filtroTipo===f?'badge-g':''}`} style={{cursor:'pointer',border:'1px solid var(--bd)',padding:'3px 9px',borderRadius:99}} onClick={()=>setFiltroTipo(f)}>
            {f==='todos'?'Todos':tipoLabel[f]}
          </span>
        ))}
        <button className="btn btn-p btn-sm" onClick={()=>setModal(true)}>+ Nuevo paciente</button>
      </div>

      {/* RESUMEN */}
      <div style={{display:'flex',gap:6,marginBottom:8,flexWrap:'wrap'}}>
        {[[pacientes.length,'activos','var(--w)','var(--bd)','var(--n)'],[totalImp,'impagos','var(--redl)','#F5C8C8','var(--red)'],[totalPen,'pendientes','var(--ambl)','var(--amb)','#7A5800'],[totalPag,'pagados','var(--gl)','var(--gm)','var(--gd)']].map(([v,l,bg,br,c])=>(
          <div key={String(l)} style={{background:String(bg),border:`1px solid ${br}`,borderRadius:6,padding:'5px 12px',fontSize:10,fontWeight:300,color:String(c),display:'flex',alignItems:'center',gap:5}}>
            <span style={{fontSize:14,fontWeight:500}}>{v}</span> {l}
          </div>
        ))}
      </div>

      {/* TABLA */}
      {loading ? <div className="loading">Cargando pacientes...</div> : (
        <div style={{background:'var(--w)',border:'1px solid var(--bd)',borderRadius:'var(--rl)',overflow:'hidden'}}>
          <div style={{display:'grid',gridTemplateColumns:'36px 1fr 110px 130px 110px',background:'var(--bl)',borderBottom:'1px solid var(--bd)'}}>
            {['','Paciente','Bono','Tipo clase','Cuota actual'].map((h,i)=>(
              <div key={i} style={{fontSize:9,fontWeight:500,color:'var(--grl)',letterSpacing:.5,textTransform:'uppercase',padding:'7px 10px',borderLeft:i>0?'1px solid var(--bd)':'none'}}>{h}</div>
            ))}
          </div>
          {filtrados.length===0 && <div className="loading">Sin resultados</div>}
          {filtrados.map(p=>{
            const bono = getBonoActual(p.id)
            const pago = bono?.estado_pago || 'pendiente'
            const iniciales = `${p.nombre?.[0]||''}${p.apellidos?.[0]||''}`.toUpperCase()
            return (
              <Link key={p.id} href={`/pacientes/${p.id}`} style={{textDecoration:'none',display:'grid',gridTemplateColumns:'36px 1fr 110px 130px 110px',borderBottom:'1px solid var(--bl)',alignItems:'center',cursor:'pointer',background:pago==='impago'?'var(--redl)':'var(--w)',transition:'background .1s'}}
                onMouseOver={e=>(e.currentTarget as HTMLElement).style.background=pago==='impago'?'#fce8e8':'var(--gl)'}
                onMouseOut={e=>(e.currentTarget as HTMLElement).style.background=pago==='impago'?'var(--redl)':'var(--w)'}>
                <div style={{padding:'8px 4px',display:'flex',alignItems:'center',justifyContent:'center'}}>
                  <div style={{width:26,height:26,borderRadius:'50%',background:'var(--gl)',border:'1.5px solid var(--gm)',display:'flex',alignItems:'center',justifyContent:'center',fontSize:9,fontWeight:500,color:'var(--gd)'}}>{iniciales}</div>
                </div>
                <div style={{padding:'8px 10px',borderLeft:'1px solid var(--bl)'}}>
                  <div style={{fontSize:12,fontWeight:400,color:'var(--n)'}}>{p.nombre} {p.apellidos}</div>
                  <div style={{fontSize:9,color:'var(--grl)',marginTop:1}}>{p.email || p.telefono || '—'}</div>
                </div>
                <div style={{padding:'8px 10px',borderLeft:'1px solid var(--bl)'}}>
                  {bono ? <span className="badge badge-g">{bonoLabel[bono.tipo]||bono.tipo}</span> : <span style={{fontSize:10,color:'var(--grl)'}}>Sin bono</span>}
                </div>
                <div style={{padding:'8px 10px',borderLeft:'1px solid var(--bl)',fontSize:11,fontWeight:300}}>{tipoLabel[p.tipo_clase]||'—'}</div>
                <div style={{padding:'8px 10px',borderLeft:'1px solid var(--bl)'}}>
                  <span className={`badge ${pagoBadge[pago]||'badge-b'}`}>{pagoLabel[pago]||'—'}</span>
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
              <div className="field"><label>Teléfono</label><input className="input" value={nuevo.telefono} onChange={e=>setNuevo(p=>({...p,telefono:e.target.value}))} placeholder="+34 600 000 000"/></div>
              <div className="field"><label>Email</label><input className="input" type="email" value={nuevo.email} onChange={e=>setNuevo(p=>({...p,email:e.target.value}))} placeholder="correo@email.com"/></div>
              <div className="field"><label>DNI</label><input className="input" value={nuevo.dni} onChange={e=>setNuevo(p=>({...p,dni:e.target.value}))} placeholder="12345678A"/></div>
              <div className="field"><label>Fecha nacimiento</label><input className="input" type="date" value={nuevo.fecha_nacimiento} onChange={e=>setNuevo(p=>({...p,fecha_nacimiento:e.target.value}))}/></div>
              <div className="field"><label>Altura (cm)</label><input className="input" type="number" value={nuevo.altura_cm} onChange={e=>setNuevo(p=>({...p,altura_cm:e.target.value}))} placeholder="170"/></div>
              <div className="field"><label>Peso (kg)</label><input className="input" type="number" value={nuevo.peso_kg} onChange={e=>setNuevo(p=>({...p,peso_kg:e.target.value}))} placeholder="70"/></div>
            </div>
            <div className="field"><label>Tipo de clase</label>
              <select className="input" value={nuevo.tipo_clase} onChange={e=>setNuevo(p=>({...p,tipo_clase:e.target.value}))}>
                <option value="entrenamiento">🏋 Entrenamiento</option>
                <option value="pilates">🧘 Pilates</option>
                <option value="rehabilitacion">🏥 Rehabilitación</option>
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
    </>
  )
}
