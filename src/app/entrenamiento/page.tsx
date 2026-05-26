'use client'
import { useEffect, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'

const CATEGORIAS = [
  { key: 'musculo', label: '💪 Músculo' },
  { key: 'articulacion', label: '🦴 Articulación' },
  { key: 'movimiento', label: '🔄 Movimiento' },
  { key: 'posicion', label: '📍 Posición' },
  { key: 'material', label: '🏋 Material' },
  { key: 'apoyo', label: '🦶 Apoyo' },
  { key: 'agarre', label: '✋ Agarre' },
  { key: 'patologia', label: '🏥 Patología' },
]

const VARIANTES = ['Bilateral','Unilateral','Alterno','Unipodal','Supino','Prono','Decúbito lateral']
const CAPACIDADES = ['Fuerza','Fuerza máxima','Movilidad','Estiramiento','Resistencia','Propiocepción','Coordinación']

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

export default function EntrenamientoPage() {
  const searchParams = useSearchParams()
  const [tab, setTab] = useState('biblioteca')
  const [ejercicios, setEjercicios] = useState<any[]>([])
  const [pacientes, setPacientes] = useState<any[]>([])
  const [sesiones, setSesiones] = useState<any[]>([])
  const [etiquetas, setEtiquetas] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [buscar, setBuscar] = useState('')
  const [filtroEtiquetas, setFiltroEtiquetas] = useState<string[]>([])
  const [modalFiltro, setModalFiltro] = useState(false)
  const [modalEj, setModalEj] = useState(false)
  const [modalSes, setModalSes] = useState(false)
  const [modalEtiqueta, setModalEtiqueta] = useState(false)
  const [testsLib, setTestsLib] = useState<any[]>([])
  const [modalTest, setModalTest] = useState(false)
  const [modalEditarTest, setModalEditarTest] = useState(false)
  const [testEditando, setTestEditando] = useState<any>(null)
  const [nuevoTest, setNuevoTest] = useState({ nombre:'', descripcion:'', frecuencia_meses:3, video_url:'', imagen_url:'', imagen_file:null as File|null, items:[] as {nombre:string, tiene_grados:boolean}[], logica:'cualquiera', etiquetas_relacionadas:[] as string[] })
  const [subiendoImgTest, setSubiendoImgTest] = useState(false)
  const [modalSelEt, setModalSelEt] = useState(false)
  const [modalBiblioteca, setModalBiblioteca] = useState<{parteIdx:number}|null>(null)
  const [guardando, setGuardando] = useState(false)
  const [ejSeleccionado, setEjSeleccionado] = useState<any>(null)
  const [subiendoImg, setSubiendoImg] = useState(false)
  const [subsubAbiertas, setSubsubAbiertas] = useState<string[]>([])
  const [buscarBiblio, setBuscarBiblio] = useState('')
  const [filtroEtBiblio, setFiltroEtBiblio] = useState<string[]>([])
  const [modalFiltrosBiblio, setModalFiltrosBiblio] = useState(false)
  const [nuevoEj, setNuevoEj] = useState({ nombre:'', descripcion:'', video_url:'', imagen_url:'', etiquetas_ids:[] as string[], imagen_file: null as File|null })
  const [nuevaEtiqueta, setNuevaEtiqueta] = useState({ categoria:'musculo', nombre:'', padre_id:'' })
  const [nuevaSes, setNuevaSes] = useState<{ paciente_id:string, nombre:string, descripcion:string, partes:Parte[] }>({
    paciente_id:'', nombre:'', descripcion:'',
    partes:[
      { nombre:'Calentamiento', ejercicios:[] },
      { nombre:'Parte principal', ejercicios:[] },
      { nombre:'Vuelta a la calma', ejercicios:[] },
    ]
  })
  const [ejEnConfig, setEjEnConfig] = useState<{parteIdx:number, ej:any}|null>(null)
  const [configEj, setConfigEj] = useState<EjercicioSesion>({ ejercicio_id:'', nombre:'', variante:'Bilateral', capacidad:'Fuerza', series:'3', reps:'10', peso:'', tiempo:'', nota:'' })

  useEffect(() => { cargar() }, [])

  useEffect(() => {
    const nuevaSesion = searchParams.get('nueva_sesion')
    const pacienteId = searchParams.get('paciente_id')
    const pacienteNombre = searchParams.get('paciente_nombre')
    if (nuevaSesion && pacienteId) {
      setTab('sesiones')
      setModalSes(true)
      setNuevaSes(p=>({...p, paciente_id: pacienteId}))
    }
  }, [searchParams])

  async function cargar() {
    setLoading(true)
    const [{ data: e },{ data: p },{ data: s },{ data: et }] = await Promise.all([
      supabase.from('ejercicios').select('*').order('nombre'),
      supabase.from('pacientes').select('id,nombre,apellidos').eq('estado','activo').order('nombre'),
      supabase.from('sesiones').select('*, pacientes(nombre,apellidos)').order('created_at',{ascending:false}).limit(20),
      supabase.from('etiquetas').select('*').order('categoria').order('nombre'),
      supabase.from('tests').select('*').order('nombre'),
    ])
    setEjercicios(e||[]); setPacientes(p||[]); setSesiones(s||[]); setEtiquetas(et||[])
    const { data: tl } = await supabase.from('tests').select('*').order('nombre')
    setTestsLib(tl||[])
    setLoading(false)
  }

  function getNivel1(cat: string) { return etiquetas.filter(e=>e.categoria===cat && !e.padre_id) }
  function getSubs(padreId: string) { return etiquetas.filter(e=>e.padre_id===padreId) }
  function getNombre(id: string) {
    const et = etiquetas.find(e=>e.id===id)
    if (!et) return ''
    if (et.padre_id) {
      const padre = etiquetas.find(e=>e.id===et.padre_id)
      if (padre?.padre_id) {
        const abuelo = etiquetas.find(e=>e.id===padre.padre_id)
        return `${abuelo?.nombre} › ${padre?.nombre} › ${et.nombre}`
      }
      return `${padre?.nombre} › ${et.nombre}`
    }
    return et.nombre
  }

  function toggle(id: string, lista: string[], setLista: (v:string[])=>void) {
    setLista(lista.includes(id) ? lista.filter(x=>x!==id) : [...lista, id])
  }
  function toggleSubsub(id: string) {
    setSubsubAbiertas(prev=>prev.includes(id)?prev.filter(x=>x!==id):[...prev,id])
  }

  async function handleImagenEjercicio(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setNuevoEj(p=>({...p, imagen_file: file, imagen_url: URL.createObjectURL(file)}))
  }

  async function subirImagenYGuardar(ejercicioId: string, file: File): Promise<string|null> {
    const ext = file.name.split('.').pop()
    const path = `ejercicios/${ejercicioId}/foto.${ext}`
    const { error } = await supabase.storage.from('fotos').upload(path, file, { upsert: true })
    if (error) { alert('Error al subir imagen: ' + error.message); return null }
    const { data: { publicUrl } } = supabase.storage.from('fotos').getPublicUrl(path)
    return publicUrl
  }

  function SelectorColumnas({ seleccionadas, onChange }: { seleccionadas: string[], onChange: (v:string[])=>void }) {
    return (
      <div style={{overflowX:'auto',overflowY:'auto',maxHeight:'65vh'}}>
        <div style={{display:'grid',gridTemplateColumns:'repeat(8,minmax(140px,1fr))',gap:1,background:'var(--bm)',minWidth:1100}}>
          {CATEGORIAS.map(cat=>{
            const nivel1 = getNivel1(cat.key)
            const selCount = etiquetas.filter(e=>e.categoria===cat.key && seleccionadas.includes(e.id)).length
            return (
              <div key={cat.key} style={{background:'var(--w)',display:'flex',flexDirection:'column'}}>
                <div style={{padding:'8px 10px',background:'var(--n)',position:'sticky',top:0}}>
                  <div style={{fontSize:10,fontWeight:500,color:'#fff'}}>{cat.label}</div>
                  {selCount>0 && <div style={{fontSize:8,color:'var(--gm)',marginTop:1}}>{selCount} selec.</div>}
                </div>
                <div style={{padding:'6px 6px',flex:1}}>
                  {nivel1.map(et=>{
                    const subs = getSubs(et.id)
                    const sel = seleccionadas.includes(et.id)
                    return (
                      <div key={et.id} style={{marginBottom:4}}>
                        <div onClick={(e)=>{e.preventDefault();toggle(et.id,seleccionadas,onChange)}}
                          style={{display:'flex',alignItems:'center',gap:5,padding:'4px 6px',borderRadius:4,cursor:'pointer',background:sel?'var(--g)':'transparent',color:sel?'#fff':'var(--n)',transition:'all .1s',marginBottom:1}}
                          onMouseOver={e=>{if(!sel)(e.currentTarget as HTMLElement).style.background='var(--gl)'}}
                          onMouseOut={e=>{if(!sel)(e.currentTarget as HTMLElement).style.background='transparent'}}>
                          <div style={{width:12,height:12,borderRadius:2,border:`1.5px solid ${sel?'rgba(255,255,255,.6)':'var(--bd)'}`,display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0}}>
                            {sel && <span style={{fontSize:8,color:'var(--g)',fontWeight:700,background:'#fff',width:'100%',height:'100%',display:'flex',alignItems:'center',justifyContent:'center',borderRadius:1}}>✓</span>}
                          </div>
                          <span style={{fontSize:10,fontWeight:sel?500:400}}>{et.nombre}</span>
                        </div>
                        {subs.length>0 && (
                          <div style={{marginLeft:8,borderLeft:'1.5px solid var(--bm)',paddingLeft:6}}>
                            {subs.map(sub=>{
                              const subsubs = getSubs(sub.id)
                              const selSub = seleccionadas.includes(sub.id)
                              const subsubAbierta = subsubAbiertas.includes(sub.id)
                              return (
                                <div key={sub.id} style={{marginBottom:2}}>
                                  <div style={{display:'flex',alignItems:'center',gap:3}}>
                                    <div onClick={(e)=>{e.preventDefault();toggle(sub.id,seleccionadas,onChange)}}
                                      style={{display:'flex',alignItems:'center',gap:4,padding:'3px 5px',borderRadius:3,cursor:'pointer',flex:1,background:selSub?'var(--g)':'transparent',color:selSub?'#fff':'var(--gr)',transition:'all .1s'}}
                                      onMouseOver={e=>{if(!selSub)(e.currentTarget as HTMLElement).style.background='var(--gl)'}}
                                      onMouseOut={e=>{if(!selSub)(e.currentTarget as HTMLElement).style.background='transparent'}}>
                                      <div style={{width:10,height:10,borderRadius:2,border:`1px solid ${selSub?'rgba(255,255,255,.6)':'var(--bd)'}`,display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0}}>
                                        {selSub && <span style={{fontSize:7,color:'var(--g)',fontWeight:700,background:'#fff',width:'100%',height:'100%',display:'flex',alignItems:'center',justifyContent:'center',borderRadius:1}}>✓</span>}
                                      </div>
                                      <span style={{fontSize:9,fontWeight:300}}>{sub.nombre}</span>
                                    </div>
                                    {subsubs.length>0 && <div onClick={()=>toggleSubsub(sub.id)} style={{fontSize:8,color:'var(--grl)',cursor:'pointer',padding:'2px 3px',transform:subsubAbierta?'rotate(90deg)':'',transition:'transform .15s'}}>›</div>}
                                  </div>
                                  {subsubs.length>0 && subsubAbierta && (
                                    <div style={{marginLeft:10,borderLeft:'1.5px solid var(--bm)',paddingLeft:5}}>
                                      {subsubs.map(ss=>{
                                        const selSS = seleccionadas.includes(ss.id)
                                        return (
                                          <div key={ss.id} onClick={(e)=>{e.preventDefault();toggle(ss.id,seleccionadas,onChange)}}
                                            style={{display:'flex',alignItems:'center',gap:4,padding:'2px 4px',borderRadius:3,cursor:'pointer',background:selSS?'var(--g)':'transparent',color:selSS?'#fff':'var(--grl)',transition:'all .1s',marginBottom:1}}
                                            onMouseOver={e=>{if(!selSS)(e.currentTarget as HTMLElement).style.background='var(--gl)'}}
                                            onMouseOut={e=>{if(!selSS)(e.currentTarget as HTMLElement).style.background='transparent'}}>
                                            <div style={{width:8,height:8,borderRadius:1,border:`1px solid ${selSS?'rgba(255,255,255,.6)':'var(--bd)'}`,display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0}}>
                                              {selSS && <span style={{fontSize:6,color:'var(--g)',fontWeight:700,background:'#fff',width:'100%',height:'100%',display:'flex',alignItems:'center',justifyContent:'center',borderRadius:1}}>✓</span>}
                                            </div>
                                            <span style={{fontSize:8,fontWeight:300}}>{ss.nombre}</span>
                                          </div>
                                        )
                                      })}
                                    </div>
                                  )}
                                </div>
                              )
                            })}
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              </div>
            )
          })}
        </div>
      </div>
    )
  }

  const ejerciciosFiltradosBiblio = ejercicios.filter(e=>{
    const matchQ = !buscarBiblio || e.nombre.toLowerCase().includes(buscarBiblio.toLowerCase())
    const matchEt = filtroEtBiblio.length===0 || filtroEtBiblio.every(fid=>(e.etiquetas||[]).includes(fid))
    return matchQ && matchEt
  })

  function abrirConfigEj(ej: any, parteIdx: number) {
    setEjEnConfig({ parteIdx, ej })
    setConfigEj({ ejercicio_id:ej.id, nombre:ej.nombre, variante:'Bilateral', capacidad:'Fuerza', series:'3', reps:'10', peso:'', tiempo:'', nota:'', imagen_url:ej.imagen_url||'' })
    setModalBiblioteca(null)
  }

  function confirmarEjercicio() {
    if (!ejEnConfig) return
    setNuevaSes(prev=>{
      const partes = [...prev.partes]
      partes[ejEnConfig.parteIdx] = { ...partes[ejEnConfig.parteIdx], ejercicios: [...partes[ejEnConfig.parteIdx].ejercicios, {...configEj}] }
      return { ...prev, partes }
    })
    setEjEnConfig(null)
  }

  function eliminarEjDeParte(parteIdx: number, ejIdx: number) {
    setNuevaSes(prev=>{
      const partes = [...prev.partes]
      partes[parteIdx] = { ...partes[parteIdx], ejercicios: partes[parteIdx].ejercicios.filter((_,i)=>i!==ejIdx) }
      return { ...prev, partes }
    })
  }

  function añadirParte() {
    setNuevaSes(prev=>({ ...prev, partes:[...prev.partes, { nombre:'Nueva parte', ejercicios:[] }] }))
  }

  function renombrarParte(idx: number, nombre: string) {
    setNuevaSes(prev=>{ const partes=[...prev.partes]; partes[idx]={...partes[idx],nombre}; return {...prev,partes} })
  }

  function eliminarParte(idx: number) {
    setNuevaSes(prev=>({ ...prev, partes:prev.partes.filter((_,i)=>i!==idx) }))
  }

  async function crearEjercicio() {
    if (guardando) return
    if (!nuevoEj.nombre) { alert('El nombre es obligatorio'); return }
    setGuardando(true)
    setSubiendoImg(true)
    const { data: ejData, error } = await supabase.from('ejercicios').insert({
      nombre: nuevoEj.nombre,
      descripcion: nuevoEj.descripcion,
      video_url: nuevoEj.video_url,
      etiquetas: nuevoEj.etiquetas_ids,
      imagen_url: '',
    }).select().single()

    if (error || !ejData) { alert('Error al crear ejercicio'); setGuardando(false); setSubiendoImg(false); return }

    let imagenUrl = ''
    if (nuevoEj.imagen_file) {
      const url = await subirImagenYGuardar(ejData.id, nuevoEj.imagen_file)
      if (url) {
        imagenUrl = url
        await supabase.from('ejercicios').update({ imagen_url: url }).eq('id', ejData.id)
      }
    }

    setSubiendoImg(false)
    setModalEj(false)
    setNuevoEj({ nombre:'', descripcion:'', video_url:'', imagen_url:'', etiquetas_ids:[], imagen_file:null })
    setGuardando(false)
    cargar()
  }

  async function crearSesion() {
    if (!nuevaSes.paciente_id || !nuevaSes.nombre) { alert('Selecciona paciente y pon un nombre'); return }
    setGuardando(true)
    await supabase.from('sesiones').insert({
      paciente_id: nuevaSes.paciente_id,
      nombre: nuevaSes.nombre,
      descripcion: nuevaSes.descripcion,
      partes: nuevaSes.partes,
      estado: 'lista'
    })
    setModalSes(false)
    setNuevaSes({ paciente_id:'', nombre:'', descripcion:'', partes:[{nombre:'Calentamiento',ejercicios:[]},{nombre:'Parte principal',ejercicios:[]},{nombre:'Vuelta a la calma',ejercicios:[]}] })
    setGuardando(false)
    cargar()
  }

  async function crearTest() {
    if (!nuevoTest.nombre) { alert('El nombre es obligatorio'); return }
    setSubiendoImgTest(true)
    const { data: t, error } = await supabase.from('tests').insert({
      nombre: nuevoTest.nombre,
      descripcion: nuevoTest.descripcion,
      frecuencia_meses: nuevoTest.frecuencia_meses,
      video_url: nuevoTest.video_url,
      items: nuevoTest.items,
      logica: nuevoTest.logica,
      imagen_url: '',
    }).select().single()
    if (!error && t && nuevoTest.imagen_file) {
      const ext = nuevoTest.imagen_file.name.split('.').pop()
      const path = `tests/${t.id}/foto.${ext}`
      const { error: upErr } = await supabase.storage.from('fotos').upload(path, nuevoTest.imagen_file, { upsert: true })
      if (!upErr) {
        const { data: { publicUrl } } = supabase.storage.from('fotos').getPublicUrl(path)
        await supabase.from('tests').update({ imagen_url: publicUrl }).eq('id', t.id)
      }
    }
    setSubiendoImgTest(false)
    setModalTest(false)
    setNuevoTest({ nombre:'', descripcion:'', frecuencia_meses:3, video_url:'', imagen_url:'', imagen_file:null, items:[], logica:'cualquiera' })
    const { data: tl } = await supabase.from('tests').select('*').order('nombre')
    setTestsLib(tl||[])
  }

  async function guardarEditTest() {
    if (!testEditando) return
    await supabase.from('tests').update({
      nombre: testEditando.nombre,
      descripcion: testEditando.descripcion,
      video_url: testEditando.video_url,
      frecuencia_meses: testEditando.frecuencia_meses,
      logica: testEditando.logica,
      items: testEditando.items||[],
      etiquetas_relacionadas: testEditando.etiquetas_relacionadas||[]
    }).eq('id', testEditando.id)
    setModalEditarTest(false); setTestEditando(null); cargar()
  }

  async function guardarEditTest() {
    if (!testEditando) return
    await supabase.from('tests').update({
      nombre: testEditando.nombre,
      descripcion: testEditando.descripcion,
      video_url: testEditando.video_url,
      frecuencia_meses: testEditando.frecuencia_meses,
      logica: testEditando.logica,
      items: testEditando.items||[],
      etiquetas_relacionadas: testEditando.etiquetas_relacionadas||[]
    }).eq('id', testEditando.id)
    setModalEditarTest(false); setTestEditando(null); cargar()
  }

  async function eliminarTest(id: string) {
    if (!confirm('¿Eliminar este test? Se eliminarán también todos sus resultados asociados.')) return
    await supabase.from('resultados_tests').delete().eq('test_id', id)
    await supabase.from('tests').delete().eq('id', id)
    const { data: tl } = await supabase.from('tests').select('*').order('nombre')
    setTestsLib(tl||[])
  }

  async function crearEtiqueta() {
    if (!nuevaEtiqueta.nombre) { alert('Escribe el nombre'); return }
    await supabase.from('etiquetas').insert({ categoria:nuevaEtiqueta.categoria, nombre:nuevaEtiqueta.nombre, padre_id:nuevaEtiqueta.padre_id||null })
    setModalEtiqueta(false); setNuevaEtiqueta({ categoria:'musculo', nombre:'', padre_id:'' }); cargar()
  }

  async function cambiarEstado(id: string, estado: string) {
    await supabase.from('sesiones').update({ estado }).eq('id',id); cargar()
  }

  const filtrados = ejercicios.filter(e=>{
    const matchQ = !buscar || e.nombre.toLowerCase().includes(buscar.toLowerCase()) || (e.descripcion||'').toLowerCase().includes(buscar.toLowerCase())
    const matchEt = filtroEtiquetas.length===0 || filtroEtiquetas.every(fid=>(e.etiquetas||[]).includes(fid))
    return matchQ && matchEt
  })

  return (
    <>
      <div className="tabs">
        {[['biblioteca','📚 Biblioteca'],['tests','🔍 Tests'],['etiquetas','🏷 Etiquetas']].map(([k,l])=>(
          <button key={k} className={`tab ${tab===k?'active':''}`} onClick={()=>setTab(k)}>{l}</button>
        ))}
      </div>

      {/* BIBLIOTECA */}
      {tab==='biblioteca' && (
        <>
          <div style={{display:'flex',gap:8,marginBottom:8,alignItems:'center',flexWrap:'wrap'}}>
            <input className="input" placeholder="🔍 Buscar ejercicio..." value={buscar} onChange={e=>setBuscar(e.target.value)} style={{flex:1,minWidth:200}}/>
            <button className="btn btn-s" onClick={()=>setModalFiltro(true)} style={{position:'relative'}}>
              🏷 Filtrar por etiquetas
              {filtroEtiquetas.length>0 && <span style={{position:'absolute',top:-6,right:-6,width:18,height:18,borderRadius:'50%',background:'var(--g)',color:'#fff',fontSize:9,fontWeight:600,display:'flex',alignItems:'center',justifyContent:'center'}}>{filtroEtiquetas.length}</span>}
            </button>
            {filtroEtiquetas.length>0 && <button className="btn btn-t btn-sm" onClick={()=>setFiltroEtiquetas([])}>✕ Limpiar</button>}
            <span style={{fontSize:10,color:'var(--grl)'}}>{filtrados.length} ejercicios</span>
            <button className="btn btn-p btn-sm" onClick={()=>setModalEj(true)}>+ Nuevo ejercicio</button>
          </div>
          {filtroEtiquetas.length>0 && (
            <div style={{display:'flex',flexWrap:'wrap',gap:4,marginBottom:8}}>
              {filtroEtiquetas.map(id=>(
                <span key={id} onClick={()=>setFiltroEtiquetas(f=>f.filter(x=>x!==id))} style={{fontSize:9,padding:'3px 9px',borderRadius:99,background:'var(--g)',color:'#fff',cursor:'pointer',display:'flex',alignItems:'center',gap:4}}>
                  {getNombre(id)} <span style={{opacity:.7}}>✕</span>
                </span>
              ))}
            </div>
          )}
          {loading?<div className="loading">Cargando...</div>:filtrados.length===0?(
            <div style={{textAlign:'center',padding:40,color:'var(--grl)',fontSize:11}}>
              {ejercicios.length===0?'No hay ejercicios. Crea el primero con + Nuevo ejercicio.':'Sin resultados.'}
            </div>
          ):(
            <div className="g3">
              {filtrados.map(e=>{
                const etsDelEj = (e.etiquetas||[]).map((id:string)=>etiquetas.find(et=>et.id===id)).filter(Boolean)
                return (
                  <div key={e.id} style={{background:'var(--w)',border:'1px solid var(--bd)',borderRadius:'var(--rl)',overflow:'hidden',cursor:'pointer',transition:'border-color .15s'}}
                    onMouseOver={el=>(el.currentTarget as HTMLElement).style.borderColor='var(--g)'}
                    onMouseOut={el=>(el.currentTarget as HTMLElement).style.borderColor='var(--bd)'}>
                    {/* IMAGEN O PLACEHOLDER */}
                    {e.imagen_url ? (
                      <img src={e.imagen_url} alt={e.nombre} onClick={()=>setEjSeleccionado(e)} style={{width:'100%',height:120,objectFit:'cover',borderBottom:'1px solid var(--bd)',display:'block',cursor:'pointer'}}/>
                    ) : (
                      <div onClick={()=>setEjSeleccionado(e)} style={{height:120,background:'var(--bm)',display:'flex',alignItems:'center',justifyContent:'center',fontSize:28,borderBottom:'1px solid var(--bd)',cursor:'pointer'}}>💪</div>
                    )}
                    <div style={{padding:'8px 10px'}}>
                      <div style={{fontSize:11,fontWeight:400,color:'var(--n)',marginBottom:4}}>{e.nombre}</div>
                      {e.descripcion&&<div style={{fontSize:9,color:'var(--grl)',marginBottom:5,fontWeight:300,lineHeight:1.4}}>{e.descripcion.slice(0,80)}{e.descripcion.length>80?'...':''}</div>}
                      <div style={{display:'flex',gap:3,flexWrap:'wrap'}}>
                        {etsDelEj.slice(0,4).map((et:any)=>(
                          <span key={et.id} style={{fontSize:8,padding:'1px 6px',borderRadius:99,background:'var(--gl)',color:'var(--gd)'}}>{et.nombre}</span>
                        ))}
                        {etsDelEj.length>4&&<span style={{fontSize:8,color:'var(--grl)'}}>+{etsDelEj.length-4}</span>}
                      </div>
                      {e.video_url&&<a href={e.video_url} target="_blank" rel="noopener noreferrer" style={{fontSize:9,color:'var(--g)',display:'block',marginTop:5}}>🎥 Ver vídeo ↗</a>}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </>
      )}

      {/* SESIONES */}
      {tab==='sesiones' && (
        <>
          <div style={{display:'flex',justifyContent:'flex-end',marginBottom:10}}>
            <button className="btn btn-p btn-sm" onClick={()=>setModalSes(true)}>+ Nueva sesión</button>
          </div>
          {loading?<div className="loading">Cargando...</div>:sesiones.length===0?(
            <div style={{textAlign:'center',padding:40,color:'var(--grl)',fontSize:11}}>Sin sesiones. Crea la primera con + Nueva sesión.</div>
          ):sesiones.map(s=>(
            <div key={s.id} className="card">
              <div style={{display:'flex',alignItems:'center',gap:10,marginBottom:8}}>
                <div style={{flex:1}}>
                  <div style={{fontSize:12,fontWeight:400,color:'var(--n)',marginBottom:2}}>{s.nombre}</div>
                  <div style={{fontSize:10,color:'var(--grl)',fontWeight:300}}>{s.pacientes?.nombre} {s.pacientes?.apellidos} · {new Date(s.created_at).toLocaleDateString('es-ES')}</div>
                  {s.descripcion&&<div style={{fontSize:10,color:'var(--gr)',marginTop:2}}>{s.descripcion}</div>}
                </div>
                <div style={{display:'flex',gap:5,alignItems:'center'}}>
                  <span className={`badge ${s.estado==='realizada'?'badge-g':s.estado==='lista'?'badge-pen':'badge-b'}`}>{s.estado}</span>
                  {s.estado!=='realizada'&&<button className="btn btn-t btn-sm" onClick={()=>cambiarEstado(s.id,'realizada')}>✓ Realizada</button>}
                </div>
              </div>
              {(s.partes||[]).map((parte:any,pi:number)=>(
                <div key={pi} style={{marginBottom:6,background:'var(--bl)',borderRadius:6,overflow:'hidden',border:'1px solid var(--bd)'}}>
                  <div style={{padding:'5px 10px',background:'var(--bl)',borderBottom:'1px solid var(--bm)',fontSize:10,fontWeight:500,color:'var(--n)'}}>{parte.nombre}</div>
                  {(parte.ejercicios||[]).map((ej:any,ei:number)=>(
                    <div key={ei} style={{padding:'6px 10px',borderBottom:'1px solid var(--bl)',display:'flex',alignItems:'flex-start',gap:8}}>
                      {ej.imagen_url && <img src={ej.imagen_url} alt={ej.nombre} style={{width:40,height:40,objectFit:'cover',borderRadius:4,flexShrink:0}}/>}
                      <div style={{flex:1}}>
                        <div style={{fontSize:11,fontWeight:400,color:'var(--n)'}}>{ej.nombre||ej}</div>
                        {ej.variante&&<div style={{fontSize:9,color:'var(--grl)',marginTop:2}}>
                          {[ej.variante,ej.capacidad,ej.series&&`${ej.series} series`,ej.reps&&`${ej.reps} reps`,ej.peso&&`${ej.peso}kg`,ej.tiempo&&`${ej.tiempo}seg`].filter(Boolean).join(' · ')}
                        </div>}
                        {ej.nota&&<div style={{fontSize:9,color:'var(--amb)',marginTop:2,fontStyle:'italic'}}>📝 {ej.nota}</div>}
                      </div>
                    </div>
                  ))}
                  {(parte.ejercicios||[]).length===0&&<div style={{padding:'5px 10px',fontSize:9,color:'var(--grl)'}}>Sin ejercicios</div>}
                </div>
              ))}
            </div>
          ))}
        </>
      )}

      {/* TESTS */}
      {/* PANEL LATERAL EJERCICIO */}
      {ejSeleccionado && (
        <>
          <div onClick={()=>setEjSeleccionado(null)} style={{position:'fixed',inset:0,background:'rgba(38,40,37,.16)',zIndex:48}}/>
          <div style={{position:'fixed',top:0,right:0,width:360,height:'100vh',background:'var(--w)',borderLeft:'1px solid var(--bd)',zIndex:49,display:'flex',flexDirection:'column',boxShadow:'-4px 0 20px rgba(38,40,37,.08)'}}>
            <div style={{padding:'12px 14px',borderBottom:'1px solid var(--bd)',display:'flex',alignItems:'center',gap:8}}>
              <div style={{flex:1,fontSize:13,fontWeight:400,color:'var(--n)'}}>{ejSeleccionado.nombre}</div>
              <button onClick={()=>setEjSeleccionado(null)} style={{width:24,height:24,borderRadius:'50%',border:'1px solid var(--bd)',background:'var(--w)',cursor:'pointer',fontSize:12,color:'var(--gr)'}}>✕</button>
            </div>
            <div style={{flex:1,overflowY:'auto'}}>
              {ejSeleccionado.imagen_url ? (
                <img src={ejSeleccionado.imagen_url} alt={ejSeleccionado.nombre} style={{width:'100%',height:200,objectFit:'cover'}}/>
              ) : (
                <div style={{height:160,background:'var(--bm)',display:'flex',alignItems:'center',justifyContent:'center',fontSize:48}}>💪</div>
              )}
              <div style={{padding:14}}>
                {ejSeleccionado.descripcion && (
                  <div style={{marginBottom:12}}>
                    <div style={{fontSize:9,fontWeight:600,color:'var(--grl)',letterSpacing:.4,textTransform:'uppercase',marginBottom:5}}>Descripción</div>
                    <div style={{fontSize:11,color:'var(--n)',fontWeight:300,lineHeight:1.6}}>{ejSeleccionado.descripcion}</div>
                  </div>
                )}
                {ejSeleccionado.video_url && (
                  <a href={ejSeleccionado.video_url} target="_blank" rel="noopener noreferrer" className="btn btn-s btn-sm" style={{marginBottom:12,display:'inline-flex'}}>🎥 Ver vídeo</a>
                )}
                <div style={{marginBottom:12}}>
                  <div style={{fontSize:9,fontWeight:600,color:'var(--grl)',letterSpacing:.4,textTransform:'uppercase',marginBottom:5}}>Etiquetas</div>
                  <div style={{display:'flex',gap:4,flexWrap:'wrap'}}>
                    {(ejSeleccionado.etiquetas||[]).map((id:string)=>{
                      const et = etiquetas.find((e:any)=>e.id===id)
                      return et?<span key={id} style={{fontSize:9,padding:'2px 8px',borderRadius:99,background:'var(--gl)',color:'var(--gd)'}}>{et.nombre}</span>:null
                    })}
                    {!(ejSeleccionado.etiquetas||[]).length&&<span style={{fontSize:10,color:'var(--grl)'}}>Sin etiquetas</span>}
                  </div>
                </div>
                {(()=>{
                  const variantes = ejercicios.filter(e=>e.id!==ejSeleccionado.id&&(e.etiquetas||[]).some((et:string)=>(ejSeleccionado.etiquetas||[]).includes(et))).slice(0,5)
                  return variantes.length>0?(
                    <div>
                      <div style={{fontSize:9,fontWeight:600,color:'var(--grl)',letterSpacing:.4,textTransform:'uppercase',marginBottom:8}}>Variantes y ejercicios similares</div>
                      {variantes.map((v:any)=>(
                        <div key={v.id} onClick={()=>setEjSeleccionado(v)}
                          style={{display:'flex',alignItems:'center',gap:8,padding:'6px 8px',borderRadius:6,border:'1px solid var(--bd)',marginBottom:4,cursor:'pointer',background:'var(--bl)'}}
                          onMouseOver={e=>(e.currentTarget as HTMLElement).style.borderColor='var(--g)'}
                          onMouseOut={e=>(e.currentTarget as HTMLElement).style.borderColor='var(--bd)'}>
                          <div style={{width:36,height:36,background:'var(--bm)',borderRadius:4,display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0,overflow:'hidden'}}>
                            {v.imagen_url?<img src={v.imagen_url} alt={v.nombre} style={{width:'100%',height:'100%',objectFit:'cover'}}/>:<span>💪</span>}
                          </div>
                          <span style={{fontSize:11,color:'var(--n)',flex:1,fontWeight:300}}>{v.nombre}</span>
                          <span style={{fontSize:12,color:'var(--grl)'}}>›</span>
                        </div>
                      ))}
                    </div>
                  ):null
                })()}
              </div>
            </div>
          </div>
        </>
      )}

      {tab==='tests' && (
        <>
          <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:10}}>
            <div style={{fontSize:11,color:'var(--grl)',fontWeight:300}}>{testsLib.length} tests en la biblioteca</div>
            <button className="btn btn-p btn-sm" onClick={()=>setModalTest(true)}>+ Nuevo test</button>
          </div>
          <div className="g3">
            {testsLib.length===0 && <div style={{gridColumn:'1/-1',padding:30,textAlign:'center',fontSize:11,color:'var(--grl)'}}>Sin tests. Crea el primero con + Nuevo test.</div>}
            {testsLib.map(t=>(
              <div key={t.id} style={{background:'var(--w)',border:'1px solid var(--bd)',borderRadius:'var(--rl)',overflow:'hidden',transition:'border-color .15s'}}
                onMouseOver={e=>(e.currentTarget as HTMLElement).style.borderColor='var(--g)'}
                onMouseOut={e=>(e.currentTarget as HTMLElement).style.borderColor='var(--bd)'}>
                {t.imagen_url ? (
                  <img src={t.imagen_url} alt={t.nombre} style={{width:'100%',height:120,objectFit:'cover',borderBottom:'1px solid var(--bd)',display:'block'}}/>
                ) : (
                  <div style={{height:120,background:'var(--bm)',display:'flex',alignItems:'center',justifyContent:'center',fontSize:28,borderBottom:'1px solid var(--bd)'}}>🔍</div>
                )}
                <div style={{padding:'9px 11px'}}>
                  <div style={{fontSize:11,fontWeight:400,color:'var(--n)',marginBottom:3}}>{t.nombre}</div>
                  {t.descripcion&&<div style={{fontSize:9,color:'var(--grl)',fontWeight:300,lineHeight:1.4,marginBottom:5}}>{t.descripcion.slice(0,80)}{t.descripcion.length>80?'...':''}</div>}
                  {(t.items||[]).length>0&&(
                    <div style={{marginBottom:5}}>
                      <div style={{fontSize:8,fontWeight:600,color:'var(--grl)',letterSpacing:.4,textTransform:'uppercase',marginBottom:3}}>Ítems · {t.logica==='cualquiera'?'Cualquiera = +':'Todos = +'}</div>
                      {(t.items||[]).slice(0,3).map((item:any,i:number)=>(
                        <div key={i} style={{fontSize:9,color:'var(--n)',fontWeight:300,padding:'1px 0'}}>
                          ☐ {item.nombre}{item.tiene_grados?' (°)':''}
                        </div>
                      ))}
                      {(t.items||[]).length>3&&<div style={{fontSize:8,color:'var(--grl)'}}>+{(t.items||[]).length-3} más</div>}
                    </div>
                  )}
                  <div style={{display:'flex',alignItems:'center',justifyContent:'space-between'}}>
                    <div style={{fontSize:9,color:'var(--g)'}}>Revisión cada {t.frecuencia_meses} meses</div>
                    <div style={{display:'flex',gap:4}}>
                      {t.video_url&&<a href={t.video_url} target="_blank" rel="noopener noreferrer" style={{fontSize:11}}>🎥</a>}
                      <button onClick={()=>{setTestEditando({...t});setModalEditarTest(true)}} style={{fontSize:10,color:'var(--g)',background:'none',border:'none',cursor:'pointer',padding:'2px 5px'}}>✏️</button>
                      <button onClick={()=>eliminarTest(t.id)} style={{fontSize:10,color:'var(--red)',background:'none',border:'none',cursor:'pointer',padding:'2px 5px'}}>✕</button>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {/* ETIQUETAS */}
      {tab==='etiquetas' && (
        <>
          <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:10}}>
            <div style={{fontSize:11,color:'var(--grl)',fontWeight:300}}>{etiquetas.length} etiquetas en total</div>
            <button className="btn btn-p btn-sm" onClick={()=>setModalEtiqueta(true)}>+ Nueva etiqueta</button>
          </div>
          <div style={{overflowX:'auto'}}>
            <div style={{display:'grid',gridTemplateColumns:'repeat(8,minmax(160px,1fr))',gap:8,minWidth:1100}}>
              {CATEGORIAS.map(cat=>{
                const nivel1 = getNivel1(cat.key)
                return (
                  <div key={cat.key} className="card" style={{padding:0,overflow:'hidden'}}>
                    <div style={{padding:'8px 11px',background:'var(--n)',borderBottom:'1px solid var(--bd)'}}>
                      <div style={{fontSize:10,fontWeight:500,color:'#fff'}}>{cat.label}</div>
                      <div style={{fontSize:8,color:'var(--gm)',marginTop:1}}>{nivel1.length} etiquetas</div>
                    </div>
                    <div style={{padding:'8px 10px'}}>
                      {nivel1.map(et=>{
                        const subs = getSubs(et.id)
                        return (
                          <div key={et.id} style={{marginBottom:6}}>
                            <div style={{fontSize:10,fontWeight:400,color:'var(--n)'}}>{et.nombre}</div>
                            {subs.length>0&&(
                              <div style={{marginLeft:8,borderLeft:'1.5px solid var(--bm)',paddingLeft:6,marginTop:2}}>
                                {subs.map(sub=>{
                                  const subsubs = getSubs(sub.id)
                                  return (
                                    <div key={sub.id} style={{marginBottom:2}}>
                                      <div style={{fontSize:9,fontWeight:300,color:'var(--gr)'}}>{sub.nombre}</div>
                                      {subsubs.length>0&&(
                                        <div style={{marginLeft:7,borderLeft:'1px solid var(--bm)',paddingLeft:5}}>
                                          {subsubs.map(ss=>(
                                            <div key={ss.id} style={{fontSize:8,fontWeight:300,color:'var(--grl)'}}>{ss.nombre}</div>
                                          ))}
                                        </div>
                                      )}
                                    </div>
                                  )
                                })}
                              </div>
                            )}
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </>
      )}

      {/* MODAL FILTRO ETIQUETAS */}
      {modalFiltro && (
        <div className="modal-bg" onClick={e=>{if(e.target===e.currentTarget)setModalFiltro(false)}}>
          <div style={{background:'var(--w)',borderRadius:'var(--rl)',width:'96vw',maxWidth:1200,maxHeight:'88vh',display:'flex',flexDirection:'column',boxShadow:'0 4px 32px rgba(38,40,37,.15)',overflow:'hidden'}}>
            <div style={{padding:'12px 16px',borderBottom:'1px solid var(--bd)',display:'flex',alignItems:'center',gap:10,background:'var(--bl)'}}>
              <div style={{flex:1}}><div style={{fontSize:13,fontWeight:400,color:'var(--n)'}}>Filtrar por etiquetas</div></div>
              {filtroEtiquetas.length>0&&<button className="btn btn-t btn-sm" onClick={()=>setFiltroEtiquetas([])}>✕ Limpiar</button>}
              <button onClick={()=>setModalFiltro(false)} style={{background:'var(--g)',color:'#fff',border:'none',borderRadius:'var(--r)',padding:'6px 16px',fontSize:11,cursor:'pointer',fontFamily:'system-ui'}}>
                Aplicar{filtroEtiquetas.length>0?` (${filtroEtiquetas.length})`:''}
              </button>
            </div>
            <div style={{flex:1,overflow:'hidden',padding:1}}><SelectorColumnas seleccionadas={filtroEtiquetas} onChange={setFiltroEtiquetas}/></div>
          </div>
        </div>
      )}

      {/* MODAL NUEVA SESIÓN */}
      {modalSes && (
        <div className="modal-bg" onClick={e=>{if(e.target===e.currentTarget&&!guardando)setModalSes(false)}}>
          <div style={{background:'var(--w)',borderRadius:'var(--rl)',width:'92vw',maxWidth:900,maxHeight:'92vh',display:'flex',flexDirection:'column',boxShadow:'0 4px 32px rgba(38,40,37,.15)',overflow:'hidden'}}>
            <div style={{padding:'12px 16px',borderBottom:'1px solid var(--bd)',background:'var(--bl)',display:'flex',alignItems:'center',gap:10}}>
              <div style={{fontSize:14,fontWeight:400,color:'var(--n)',flex:1}}>Nueva sesión de entrenamiento</div>
              <button onClick={()=>setModalSes(false)} style={{background:'none',border:'none',fontSize:18,color:'var(--gr)',cursor:'pointer'}}>✕</button>
            </div>
            <div style={{flex:1,overflowY:'auto',padding:16}}>
              <div className="g2" style={{marginBottom:12}}>
                <div className="field"><label>Paciente *</label>
                  <select className="input" value={nuevaSes.paciente_id} onChange={e=>setNuevaSes(p=>({...p,paciente_id:e.target.value}))}>
                    <option value="">Seleccionar paciente...</option>
                    {pacientes.map(p=><option key={p.id} value={p.id}>{p.nombre} {p.apellidos}</option>)}
                  </select>
                </div>
                <div className="field"><label>Nombre de la sesión *</label>
                  <input className="input" value={nuevaSes.nombre} onChange={e=>setNuevaSes(p=>({...p,nombre:e.target.value}))} placeholder="ej. Fuerza cuádriceps · Fase 1"/>
                </div>
                <div className="field" style={{gridColumn:'1/-1'}}><label>Objetivo / descripción</label>
                  <input className="input" value={nuevaSes.descripcion} onChange={e=>setNuevaSes(p=>({...p,descripcion:e.target.value}))} placeholder="ej. Trabajar fuerza extensora sin impacto"/>
                </div>
              </div>
              {nuevaSes.partes.map((parte,pi)=>(
                <div key={pi} style={{border:'1px solid var(--bd)',borderRadius:'var(--rl)',overflow:'hidden',marginBottom:10}}>
                  <div style={{display:'flex',alignItems:'center',gap:8,padding:'8px 12px',background:'var(--bl)',borderBottom:'1px solid var(--bd)'}}>
                    <input value={parte.nombre} onChange={e=>renombrarParte(pi,e.target.value)}
                      style={{flex:1,fontSize:12,fontWeight:500,color:'var(--n)',border:'none',background:'transparent',fontFamily:'system-ui',padding:'2px 0'}}/>
                    <button className="btn btn-t btn-sm" onClick={()=>setModalBiblioteca({parteIdx:pi})}>+ Añadir ejercicio</button>
                    {nuevaSes.partes.length>1 && <button onClick={()=>eliminarParte(pi)} style={{fontSize:11,color:'var(--red)',background:'none',border:'none',cursor:'pointer',padding:'2px 6px'}}>✕</button>}
                  </div>
                  <div style={{padding:8}}>
                    {parte.ejercicios.length===0 && (
                      <div onClick={()=>setModalBiblioteca({parteIdx:pi})} style={{border:'1.5px dashed var(--bm)',borderRadius:5,padding:'10px',textAlign:'center',fontSize:10,color:'var(--grl)',cursor:'pointer'}}
                        onMouseOver={e=>{const el=e.currentTarget;el.style.borderColor='var(--g)';el.style.color='var(--g)'}}
                        onMouseOut={e=>{const el=e.currentTarget;el.style.borderColor='var(--bm)';el.style.color='var(--grl)'}}>
                        + Añadir ejercicio de la biblioteca
                      </div>
                    )}
                    {parte.ejercicios.map((ej,ei)=>(
                      <div key={ei} style={{display:'flex',alignItems:'flex-start',gap:8,padding:'7px 10px',background:'var(--bl)',borderRadius:6,border:'1px solid var(--bd)',marginBottom:4}}>
                        {ej.imagen_url && <img src={ej.imagen_url} alt={ej.nombre} style={{width:36,height:36,objectFit:'cover',borderRadius:4,flexShrink:0}}/>}
                        <div style={{flex:1}}>
                          <div style={{fontSize:11,fontWeight:400,color:'var(--n)',marginBottom:3}}>{ej.nombre}</div>
                          <div style={{display:'flex',gap:4,flexWrap:'wrap'}}>
                            {ej.variante && <span style={{fontSize:9,padding:'1px 7px',borderRadius:99,background:'var(--gl)',color:'var(--gd)'}}>{ej.variante}</span>}
                            {ej.capacidad && <span style={{fontSize:9,padding:'1px 7px',borderRadius:99,background:'var(--ambl)',color:'#7A5800'}}>{ej.capacidad}</span>}
                            {ej.series && <span style={{fontSize:9,padding:'1px 7px',borderRadius:99,background:'var(--bm)',color:'var(--gr)'}}>{ej.series} series</span>}
                            {ej.reps && <span style={{fontSize:9,padding:'1px 7px',borderRadius:99,background:'var(--bm)',color:'var(--gr)'}}>{ej.reps} reps</span>}
                            {ej.peso && <span style={{fontSize:9,padding:'1px 7px',borderRadius:99,background:'var(--bm)',color:'var(--gr)'}}>{ej.peso} kg</span>}
                            {ej.tiempo && <span style={{fontSize:9,padding:'1px 7px',borderRadius:99,background:'var(--bm)',color:'var(--gr)'}}>{ej.tiempo} seg</span>}
                          </div>
                          {ej.nota && <div style={{fontSize:9,color:'var(--amb)',marginTop:3,fontStyle:'italic'}}>📝 {ej.nota}</div>}
                        </div>
                        <button onClick={()=>eliminarEjDeParte(pi,ei)} style={{fontSize:11,color:'var(--red)',background:'none',border:'none',cursor:'pointer',padding:'2px 5px',flexShrink:0}}>✕</button>
                      </div>
                    ))}
                    {parte.ejercicios.length>0 && (
                      <button className="btn btn-t btn-sm" style={{marginTop:4}} onClick={()=>setModalBiblioteca({parteIdx:pi})}>+ Añadir otro ejercicio</button>
                    )}
                  </div>
                </div>
              ))}
              <button className="btn btn-s btn-sm" onClick={añadirParte}>+ Añadir parte</button>
            </div>
            <div style={{padding:'10px 16px',borderTop:'1px solid var(--bd)',display:'flex',gap:8}}>
              <button className="btn btn-d btn-sm" onClick={()=>setModalSes(false)} disabled={guardando}>Cancelar</button>
              <div style={{flex:1}}/>
              <button className="btn btn-p" onClick={crearSesion} disabled={guardando}>{guardando?'⏳ Guardando...':'💾 Guardar sesión'}</button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL BIBLIOTECA PARA SESIÓN */}
      {modalBiblioteca && !ejEnConfig && (
        <div className="modal-bg" onClick={e=>{if(e.target===e.currentTarget)setModalBiblioteca(null)}}>
          <div style={{background:'var(--w)',borderRadius:'var(--rl)',width:'80vw',maxWidth:900,maxHeight:'88vh',display:'flex',flexDirection:'column',boxShadow:'0 4px 32px rgba(38,40,37,.15)',overflow:'hidden'}}>
            <div style={{padding:'12px 16px',borderBottom:'1px solid var(--bd)',background:'var(--bl)',display:'flex',alignItems:'center',gap:10}}>
              <div style={{fontSize:13,fontWeight:400,color:'var(--n)',flex:1}}>Seleccionar ejercicio · {nuevaSes.partes[modalBiblioteca.parteIdx]?.nombre}</div>
              <button onClick={()=>setModalBiblioteca(null)} style={{background:'none',border:'none',fontSize:18,color:'var(--gr)',cursor:'pointer'}}>✕</button>
            </div>
            <div style={{padding:'10px 14px',borderBottom:'1px solid var(--bd)',display:'flex',gap:8,alignItems:'center'}}>
              <input className="input" placeholder="🔍 Buscar ejercicio..." value={buscarBiblio} onChange={e=>setBuscarBiblio(e.target.value)} style={{flex:1}}/>
              <button className="btn btn-s btn-sm" onClick={()=>setModalFiltrosBiblio(true)} style={{position:'relative'}}>
                🏷 Filtrar
                {filtroEtBiblio.length>0&&<span style={{position:'absolute',top:-5,right:-5,width:16,height:16,borderRadius:'50%',background:'var(--g)',color:'#fff',fontSize:8,fontWeight:600,display:'flex',alignItems:'center',justifyContent:'center'}}>{filtroEtBiblio.length}</span>}
              </button>
              {filtroEtBiblio.length>0&&<button className="btn btn-t btn-sm" onClick={()=>setFiltroEtBiblio([])}>✕</button>}
            </div>
            <div style={{flex:1,overflowY:'auto',padding:12}}>
              {ejerciciosFiltradosBiblio.length===0 ? (
                <div style={{textAlign:'center',padding:30,color:'var(--grl)',fontSize:11}}>Sin resultados</div>
              ) : (
                <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:8}}>
                  {ejerciciosFiltradosBiblio.map(e=>{
                    const etsDelEj = (e.etiquetas||[]).map((id:string)=>etiquetas.find(et=>et.id===id)).filter(Boolean)
                    return (
                      <div key={e.id} onClick={()=>abrirConfigEj(e,modalBiblioteca.parteIdx)}
                        style={{background:'var(--bl)',border:'1px solid var(--bd)',borderRadius:'var(--rl)',overflow:'hidden',cursor:'pointer',transition:'all .15s'}}
                        onMouseOver={el=>{const c=el.currentTarget;c.style.borderColor='var(--g)'}}
                        onMouseOut={el=>{const c=el.currentTarget;c.style.borderColor='var(--bd)'}}>
                        {e.imagen_url ? (
                          <img src={e.imagen_url} alt={e.nombre} style={{width:'100%',height:70,objectFit:'cover',borderBottom:'1px solid var(--bd)',display:'block'}}/>
                        ) : (
                          <div style={{height:70,background:'var(--bm)',display:'flex',alignItems:'center',justifyContent:'center',fontSize:24,borderBottom:'1px solid var(--bd)'}}>💪</div>
                        )}
                        <div style={{padding:'8px 10px'}}>
                          <div style={{fontSize:11,fontWeight:400,color:'var(--n)',marginBottom:4}}>{e.nombre}</div>
                          <div style={{display:'flex',gap:3,flexWrap:'wrap'}}>
                            {etsDelEj.slice(0,3).map((et:any)=>(
                              <span key={et.id} style={{fontSize:8,padding:'1px 5px',borderRadius:99,background:'var(--g)',color:'#fff'}}>{et.nombre}</span>
                            ))}
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* MODAL FILTROS BIBLIOTECA SESIÓN */}
      {modalFiltrosBiblio && (
        <div className="modal-bg" onClick={e=>{if(e.target===e.currentTarget)setModalFiltrosBiblio(false)}}>
          <div style={{background:'var(--w)',borderRadius:'var(--rl)',width:'96vw',maxWidth:1200,maxHeight:'88vh',display:'flex',flexDirection:'column',boxShadow:'0 4px 32px rgba(38,40,37,.15)',overflow:'hidden'}}>
            <div style={{padding:'12px 16px',borderBottom:'1px solid var(--bd)',display:'flex',alignItems:'center',gap:10,background:'var(--bl)'}}>
              <div style={{flex:1}}><div style={{fontSize:13,fontWeight:400,color:'var(--n)'}}>Filtrar ejercicios</div></div>
              {filtroEtBiblio.length>0&&<button className="btn btn-t btn-sm" onClick={()=>setFiltroEtBiblio([])}>✕ Limpiar</button>}
              <button onClick={()=>setModalFiltrosBiblio(false)} style={{background:'var(--g)',color:'#fff',border:'none',borderRadius:'var(--r)',padding:'6px 16px',fontSize:11,cursor:'pointer',fontFamily:'system-ui'}}>
                Aplicar{filtroEtBiblio.length>0?` (${filtroEtBiblio.length})`:''}
              </button>
            </div>
            <div style={{flex:1,overflow:'hidden',padding:1}}><SelectorColumnas seleccionadas={filtroEtBiblio} onChange={setFiltroEtBiblio}/></div>
          </div>
        </div>
      )}

      {/* MODAL CONFIGURAR EJERCICIO */}
      {ejEnConfig && (
        <div className="modal-bg">
          <div className="modal" style={{width:480}}>
            <div className="modal-title">
              Configurar ejercicio
              <button className="modal-close" onClick={()=>setEjEnConfig(null)}>✕</button>
            </div>
            <div style={{background:'var(--gl)',border:'1px solid var(--gm)',borderRadius:6,padding:'8px 11px',marginBottom:12,display:'flex',alignItems:'center',gap:10}}>
              {ejEnConfig.ej.imagen_url && <img src={ejEnConfig.ej.imagen_url} alt={ejEnConfig.ej.nombre} style={{width:48,height:48,objectFit:'cover',borderRadius:5,flexShrink:0}}/>}
              <div>
                <div style={{fontSize:12,fontWeight:400,color:'var(--n)'}}>{ejEnConfig.ej.nombre}</div>
                {ejEnConfig.ej.descripcion&&<div style={{fontSize:9,color:'var(--grl)',marginTop:2,fontWeight:300}}>{ejEnConfig.ej.descripcion}</div>}
              </div>
            </div>
            <div className="g2">
              <div className="field"><label>Variante de ejecución</label>
                <select className="input" value={configEj.variante} onChange={e=>setConfigEj(p=>({...p,variante:e.target.value}))}>
                  {VARIANTES.map(v=><option key={v} value={v}>{v}</option>)}
                </select>
              </div>
              <div className="field"><label>Capacidad</label>
                <select className="input" value={configEj.capacidad} onChange={e=>setConfigEj(p=>({...p,capacidad:e.target.value}))}>
                  {CAPACIDADES.map(c=><option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div className="field"><label>Series</label>
                <input className="input" type="number" value={configEj.series} onChange={e=>setConfigEj(p=>({...p,series:e.target.value}))} placeholder="ej. 3"/>
              </div>
              <div className="field"><label>Repeticiones</label>
                <input className="input" type="number" value={configEj.reps} onChange={e=>setConfigEj(p=>({...p,reps:e.target.value}))} placeholder="ej. 10"/>
              </div>
              <div className="field"><label>Peso (kg)</label>
                <input className="input" type="number" value={configEj.peso} onChange={e=>setConfigEj(p=>({...p,peso:e.target.value}))} placeholder="ej. 20"/>
              </div>
              <div className="field"><label>Tiempo (segundos)</label>
                <input className="input" type="number" value={configEj.tiempo} onChange={e=>setConfigEj(p=>({...p,tiempo:e.target.value}))} placeholder="ej. 30"/>
              </div>
            </div>
            <div className="field"><label>Nota para este paciente</label>
              <textarea className="input" value={configEj.nota} onChange={e=>setConfigEj(p=>({...p,nota:e.target.value}))} placeholder="ej. Precaución rodilla derecha..." style={{minHeight:56}}/>
            </div>
            <div style={{display:'flex',gap:8,marginTop:8}}>
              <button className="btn btn-s btn-sm" onClick={()=>{setEjEnConfig(null);setModalBiblioteca({parteIdx:ejEnConfig.parteIdx})}}>← Volver</button>
              <div style={{flex:1}}/>
              <button className="btn btn-p" onClick={confirmarEjercicio}>✓ Añadir a la sesión</button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL NUEVO EJERCICIO */}
      {modalEj && (
        <div className="modal-bg" onClick={e=>{if(e.target===e.currentTarget&&!guardando)setModalEj(false)}}>
          <div className="modal" style={{width:480}}>
            <div className="modal-title">Nuevo ejercicio<button className="modal-close" onClick={()=>setModalEj(false)}>✕</button></div>
            <div className="field"><label>Nombre *</label><input className="input" value={nuevoEj.nombre} onChange={e=>setNuevoEj(p=>({...p,nombre:e.target.value}))} placeholder="ej. Curl de bíceps" autoFocus disabled={guardando}/></div>
            <div className="field"><label>Descripción motriz</label><textarea className="input" value={nuevoEj.descripcion} onChange={e=>setNuevoEj(p=>({...p,descripcion:e.target.value}))} placeholder="Descripción del movimiento, puntos clave..." disabled={guardando}/></div>
            <div className="field"><label>Enlace vídeo</label><input className="input" value={nuevoEj.video_url} onChange={e=>setNuevoEj(p=>({...p,video_url:e.target.value}))} placeholder="https://youtube.com/..." disabled={guardando}/></div>
            <div className="field">
              <label>Imagen del ejercicio</label>
              <div style={{display:'flex',alignItems:'center',gap:10,marginTop:4}}>
                {nuevoEj.imagen_url ? (
                  <div style={{position:'relative'}}>
                    <img src={nuevoEj.imagen_url} alt="preview" style={{width:80,height:80,objectFit:'cover',borderRadius:6,border:'1px solid var(--bd)'}}/>
                    <button onClick={()=>setNuevoEj(p=>({...p,imagen_url:'',imagen_file:null}))}
                      style={{position:'absolute',top:-6,right:-6,width:18,height:18,borderRadius:'50%',background:'var(--red)',color:'#fff',border:'none',cursor:'pointer',fontSize:9,display:'flex',alignItems:'center',justifyContent:'center'}}>✕</button>
                  </div>
                ) : (
                  <div style={{width:80,height:80,background:'var(--bm)',borderRadius:6,border:'1.5px dashed var(--bd)',display:'flex',alignItems:'center',justifyContent:'center',fontSize:24}}>💪</div>
                )}
                <label style={{cursor:'pointer'}}>
                  <div className="btn btn-s btn-sm">{nuevoEj.imagen_url?'📷 Cambiar imagen':'📷 Subir imagen'}</div>
                  <input type="file" accept="image/*" onChange={handleImagenEjercicio} style={{display:'none'}} disabled={guardando}/>
                </label>
              </div>
            </div>
            <div className="field">
              <label>Etiquetas</label>
              {nuevoEj.etiquetas_ids.length>0&&(
                <div style={{display:'flex',flexWrap:'wrap',gap:3,marginBottom:6}}>
                  {nuevoEj.etiquetas_ids.map(id=>(
                    <span key={id} onClick={()=>setNuevoEj(p=>({...p,etiquetas_ids:p.etiquetas_ids.filter(x=>x!==id)}))} style={{fontSize:9,padding:'2px 8px',borderRadius:99,background:'var(--g)',color:'#fff',cursor:'pointer',display:'flex',alignItems:'center',gap:4}}>
                      {getNombre(id)} <span style={{opacity:.7}}>✕</span>
                    </span>
                  ))}
                </div>
              )}
              <button className="btn btn-s btn-sm" onClick={()=>setModalSelEt(true)} style={{width:'100%',justifyContent:'center'}}>
                🏷 {nuevoEj.etiquetas_ids.length>0?`${nuevoEj.etiquetas_ids.length} etiquetas · Cambiar`:'Seleccionar etiquetas'}
              </button>
            </div>
            <div style={{display:'flex',gap:8,marginTop:8}}>
              <button className="btn btn-d btn-sm" onClick={()=>setModalEj(false)} disabled={guardando}>Cancelar</button>
              <div style={{flex:1}}/>
              <button className="btn btn-p" onClick={crearEjercicio} disabled={guardando}>
                {guardando?(subiendoImg?'⏳ Subiendo imagen...':'⏳ Guardando...'):'💾 Guardar ejercicio'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL SELECTOR ETIQUETAS EJERCICIO */}
      {modalSelEt && (
        <div className="modal-bg" onClick={e=>{if(e.target===e.currentTarget)setModalSelEt(false)}}>
          <div style={{background:'var(--w)',borderRadius:'var(--rl)',width:'96vw',maxWidth:1200,maxHeight:'88vh',display:'flex',flexDirection:'column',boxShadow:'0 4px 32px rgba(38,40,37,.15)',overflow:'hidden'}}>
            <div style={{padding:'12px 16px',borderBottom:'1px solid var(--bd)',display:'flex',alignItems:'center',gap:10,background:'var(--bl)'}}>
              <div style={{flex:1}}><div style={{fontSize:13,fontWeight:400,color:'var(--n)'}}>Etiquetas del ejercicio</div><div style={{fontSize:10,color:'var(--grl)',fontWeight:300}}>{nuevoEj.etiquetas_ids.length} seleccionadas</div></div>
              {nuevoEj.etiquetas_ids.length>0&&<button className="btn btn-t btn-sm" onClick={()=>setNuevoEj(p=>({...p,etiquetas_ids:[]}))}>✕ Limpiar</button>}
              <button onClick={()=>setModalSelEt(false)} style={{background:'var(--g)',color:'#fff',border:'none',borderRadius:'var(--r)',padding:'6px 16px',fontSize:11,cursor:'pointer',fontFamily:'system-ui'}}>
                Confirmar{nuevoEj.etiquetas_ids.length>0?` (${nuevoEj.etiquetas_ids.length})`:''}
              </button>
            </div>
            <div style={{flex:1,overflow:'hidden',padding:1}}><SelectorColumnas seleccionadas={nuevoEj.etiquetas_ids} onChange={ids=>setNuevoEj(p=>({...p,etiquetas_ids:ids}))}/></div>
          </div>
        </div>
      )}

      {/* MODAL NUEVO TEST */}
      {modalTest && (
        <div className="modal-bg" onClick={e=>{if(e.target===e.currentTarget)setModalTest(false)}}>
          <div className="modal" style={{width:520,maxHeight:'90vh'}}>
            <div className="modal-title">Nuevo test<button className="modal-close" onClick={()=>setModalTest(false)}>✕</button></div>
            
            <div className="field"><label>Nombre *</label>
              <input className="input" value={nuevoTest.nombre} onChange={e=>setNuevoTest(p=>({...p,nombre:e.target.value}))} placeholder="ej. Test de Thomas" autoFocus/>
            </div>
            <div className="field"><label>Descripción · qué evalúa</label>
              <textarea className="input" value={nuevoTest.descripcion} onChange={e=>setNuevoTest(p=>({...p,descripcion:e.target.value}))} placeholder="ej. Evalúa el acortamiento del psoas ilíaco y recto femoral..."/>
            </div>
            <div className="g2">
              <div className="field"><label>Enlace vídeo</label>
                <input className="input" value={nuevoTest.video_url} onChange={e=>setNuevoTest(p=>({...p,video_url:e.target.value}))} placeholder="https://youtube.com/..."/>
              </div>
              <div className="field"><label>Frecuencia revisión</label>
                <select className="input" value={nuevoTest.frecuencia_meses} onChange={e=>setNuevoTest(p=>({...p,frecuencia_meses:parseInt(e.target.value)}))}>
                  <option value={1}>1 mes</option>
                  <option value={2}>2 meses</option>
                  <option value={3}>3 meses</option>
                  <option value={6}>6 meses</option>
                  <option value={12}>12 meses</option>
                </select>
              </div>
            </div>

            {/* IMAGEN */}
            <div className="field">
              <label>Imagen del test</label>
              <div style={{display:'flex',alignItems:'center',gap:10,marginTop:4}}>
                {nuevoTest.imagen_url ? (
                  <div style={{position:'relative'}}>
                    <img src={nuevoTest.imagen_url} alt="preview" style={{width:80,height:80,objectFit:'cover',borderRadius:6,border:'1px solid var(--bd)'}}/>
                    <button onClick={()=>setNuevoTest(p=>({...p,imagen_url:'',imagen_file:null}))}
                      style={{position:'absolute',top:-6,right:-6,width:18,height:18,borderRadius:'50%',background:'var(--red)',color:'#fff',border:'none',cursor:'pointer',fontSize:9,display:'flex',alignItems:'center',justifyContent:'center'}}>✕</button>
                  </div>
                ) : (
                  <div style={{width:80,height:80,background:'var(--bm)',borderRadius:6,border:'1.5px dashed var(--bd)',display:'flex',alignItems:'center',justifyContent:'center',fontSize:24}}>🔍</div>
                )}
                <label style={{cursor:'pointer'}}>
                  <div className="btn btn-s btn-sm">{nuevoTest.imagen_url?'📷 Cambiar':'📷 Subir imagen'}</div>
                  <input type="file" accept="image/*" onChange={e=>{const f=e.target.files?.[0];if(f)setNuevoTest(p=>({...p,imagen_file:f,imagen_url:URL.createObjectURL(f)}))}} style={{display:'none'}}/>
                </label>
              </div>
            </div>

            {/* ÍTEMS */}
            <div className="field">
              <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:6}}>
                <label style={{margin:0}}>Ítems de evaluación</label>
                <div style={{display:'flex',gap:5,alignItems:'center'}}>
                  <span style={{fontSize:9,color:'var(--grl)'}}>Resultado positivo si:</span>
                  <select style={{fontSize:9,padding:'2px 6px',border:'1px solid var(--bd)',borderRadius:3,background:'var(--bl)',color:'var(--n)',fontFamily:'system-ui'}} value={nuevoTest.logica} onChange={e=>setNuevoTest(p=>({...p,logica:e.target.value}))}>
                    <option value="cualquiera">Cualquier ítem marcado</option>
                    <option value="todos">Todos los ítems marcados</option>
                  </select>
                </div>
              </div>
              {nuevoTest.items.map((item,i)=>(
                <div key={i} style={{display:'flex',alignItems:'center',gap:7,marginBottom:5,background:'var(--bl)',borderRadius:5,padding:'6px 8px',border:'1px solid var(--bd)'}}>
                  <input className="input" value={item.nombre} onChange={e=>{const its=[...nuevoTest.items];its[i]={...its[i],nombre:e.target.value};setNuevoTest(p=>({...p,items:its}))}}
                    placeholder={`ej. La rodilla no llega a 90°`} style={{flex:1,fontSize:11}}/>
                  <label style={{display:'flex',alignItems:'center',gap:4,cursor:'pointer',fontSize:9,color:'var(--grl)',flexShrink:0,whiteSpace:'nowrap'}}>
                    <input type="checkbox" checked={item.tiene_grados} onChange={e=>{const its=[...nuevoTest.items];its[i]={...its[i],tiene_grados:e.target.checked};setNuevoTest(p=>({...p,items:its}))}} style={{accentColor:'var(--g)'}}/>
                    Mide grados °
                  </label>
                  <button onClick={()=>setNuevoTest(p=>({...p,items:p.items.filter((_,j)=>j!==i)}))} style={{fontSize:11,color:'var(--red)',background:'none',border:'none',cursor:'pointer',padding:'2px 4px',flexShrink:0}}>✕</button>
                </div>
              ))}
              <button className="btn btn-t btn-sm" onClick={()=>setNuevoTest(p=>({...p,items:[...p.items,{nombre:'',tiene_grados:false}]}))}>+ Añadir ítem</button>
              {nuevoTest.items.length===0&&<div style={{fontSize:9,color:'var(--grl)',marginTop:5,fontWeight:300}}>Sin ítems — el test se registrará solo como positivo/negativo</div>}
            </div>

            <div className="field">
              <label>Etiquetas relacionadas · ejercicios recomendados cuando positivo</label>
              <div style={{marginTop:5}}>
                <SelectorColumnas seleccionadas={nuevoTest.etiquetas_relacionadas||[]} onChange={ids=>setNuevoTest(p=>({...p,etiquetas_relacionadas:ids}))}/>
              </div>
              {(nuevoTest.etiquetas_relacionadas||[]).length>0&&(
                <div style={{marginTop:6,display:'flex',flexWrap:'wrap',gap:3}}>
                  {(nuevoTest.etiquetas_relacionadas||[]).map((id:string)=>{
                    const et = etiquetas.find((e:any)=>e.id===id)
                    return et?<span key={id} style={{fontSize:9,padding:'2px 8px',borderRadius:99,background:'var(--ambl)',color:'#7A5800'}}>{et.nombre}</span>:null
                  })}
                </div>
              )}
            </div>
            <div style={{display:'flex',gap:8,marginTop:8}}>
              <button className="btn btn-d btn-sm" onClick={()=>setModalTest(false)}>Cancelar</button>
              <div style={{flex:1}}/>
              <button className="btn btn-p" onClick={crearTest} disabled={subiendoImgTest}>
                {subiendoImgTest?'⏳ Guardando...':'💾 Guardar test'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL NUEVA ETIQUETA */}
      {modalEtiqueta && (
        <div className="modal-bg" onClick={e=>{if(e.target===e.currentTarget)setModalEtiqueta(false)}}>
          <div className="modal">
            <div className="modal-title">Nueva etiqueta<button className="modal-close" onClick={()=>setModalEtiqueta(false)}>✕</button></div>
            <div className="field"><label>Categoría</label>
              <select className="input" value={nuevaEtiqueta.categoria} onChange={e=>setNuevaEtiqueta(p=>({...p,categoria:e.target.value,padre_id:''}))}>
                {CATEGORIAS.map(c=><option key={c.key} value={c.key}>{c.label}</option>)}
              </select>
            </div>
            <div className="field"><label>Etiqueta padre (si es subetiqueta)</label>
              <select className="input" value={nuevaEtiqueta.padre_id} onChange={e=>setNuevaEtiqueta(p=>({...p,padre_id:e.target.value}))}>
                <option value="">— Es etiqueta principal —</option>
                {etiquetas.filter(e=>e.categoria===nuevaEtiqueta.categoria).map(e=>{
                  const prefijo = e.padre_id?(etiquetas.find(p=>p.id===e.padre_id)?.nombre||'')+' › ':''
                  return <option key={e.id} value={e.id}>{prefijo}{e.nombre}</option>
                })}
              </select>
            </div>
            <div className="field"><label>Nombre *</label><input className="input" value={nuevaEtiqueta.nombre} onChange={e=>setNuevaEtiqueta(p=>({...p,nombre:e.target.value}))} placeholder="ej. Bíceps Femoral" autoFocus/></div>
            <div style={{display:'flex',gap:8,marginTop:8}}>
              <button className="btn btn-d btn-sm" onClick={()=>setModalEtiqueta(false)}>Cancelar</button>
              <div style={{flex:1}}/>
              <button className="btn btn-p" onClick={crearEtiqueta}>💾 Guardar etiqueta</button>
            </div>
          </div>
        </div>
      )}
      {/* MODAL EDITAR TEST */}
      {modalEditarTest&&testEditando&&(
        <div className="modal-bg" onClick={e=>{if(e.target===e.currentTarget)setModalEditarTest(false)}}>
          <div className="modal" style={{width:520,maxHeight:'90vh'}}>
            <div className="modal-title">Editar test<button className="modal-close" onClick={()=>setModalEditarTest(false)}>✕</button></div>
            <div className="field"><label>Nombre *</label><input className="input" value={testEditando.nombre||''} onChange={e=>setTestEditando((p:any)=>({...p,nombre:e.target.value}))}/></div>
            <div className="field"><label>Descripción</label><textarea className="input" value={testEditando.descripcion||''} onChange={e=>setTestEditando((p:any)=>({...p,descripcion:e.target.value}))}/></div>
            <div className="field"><label>Enlace vídeo</label><input className="input" value={testEditando.video_url||''} onChange={e=>setTestEditando((p:any)=>({...p,video_url:e.target.value}))}/></div>
            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:8}}>
              <div className="field"><label>Revisión cada (meses)</label><input className="input" type="number" value={testEditando.frecuencia_meses||3} onChange={e=>setTestEditando((p:any)=>({...p,frecuencia_meses:parseInt(e.target.value)||3}))}/></div>
              <div className="field"><label>Positivo si</label>
                <select className="input" value={testEditando.logica||'cualquiera'} onChange={e=>setTestEditando((p:any)=>({...p,logica:e.target.value}))}>
                  <option value="cualquiera">Algún ítem marcado</option>
                  <option value="todos">Todos los ítems marcados</option>
                </select>
              </div>
            </div>
            <div className="field">
              <label>Etiquetas relacionadas (ejercicios recomendados cuando positivo)</label>
              <div style={{marginTop:5}}>
                <SelectorColumnas seleccionadas={testEditando.etiquetas_relacionadas||[]} onChange={ids=>setTestEditando((p:any)=>({...p,etiquetas_relacionadas:ids}))}/>
              </div>
              {(testEditando.etiquetas_relacionadas||[]).length>0&&(
                <div style={{marginTop:6,display:'flex',flexWrap:'wrap',gap:3}}>
                  {testEditando.etiquetas_relacionadas.map((id:string)=>{
                    const et = etiquetas.find((e:any)=>e.id===id)
                    return et?<span key={id} style={{fontSize:9,padding:'2px 8px',borderRadius:99,background:'var(--ambl)',color:'#7A5800'}}>{et.nombre}</span>:null
                  })}
                </div>
              )}
            </div>
            <div style={{display:'flex',gap:8,marginTop:8}}>
              <button className="btn btn-d btn-sm" onClick={()=>setModalEditarTest(false)}>Cancelar</button>
              <div style={{flex:1}}/>
              <button className="btn btn-p" onClick={guardarEditTest}>💾 Guardar cambios</button>
            </div>
          </div>
        </div>
      )}
      {/* MODAL EDITAR TEST */}
      {modalEditarTest&&testEditando&&(
        <div className="modal-bg" onClick={e=>{if(e.target===e.currentTarget)setModalEditarTest(false)}}>
          <div className="modal" style={{width:520,maxHeight:'90vh'}}>
            <div className="modal-title">Editar test<button className="modal-close" onClick={()=>setModalEditarTest(false)}>✕</button></div>
            <div className="field"><label>Nombre *</label><input className="input" value={testEditando.nombre||''} onChange={e=>setTestEditando((p:any)=>({...p,nombre:e.target.value}))}/></div>
            <div className="field"><label>Descripción</label><textarea className="input" value={testEditando.descripcion||''} onChange={e=>setTestEditando((p:any)=>({...p,descripcion:e.target.value}))}/></div>
            <div className="field"><label>Enlace vídeo</label><input className="input" value={testEditando.video_url||''} onChange={e=>setTestEditando((p:any)=>({...p,video_url:e.target.value}))}/></div>
            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:8}}>
              <div className="field"><label>Revisión cada (meses)</label><input className="input" type="number" value={testEditando.frecuencia_meses||3} onChange={e=>setTestEditando((p:any)=>({...p,frecuencia_meses:parseInt(e.target.value)||3}))}/></div>
              <div className="field"><label>Positivo si</label>
                <select className="input" value={testEditando.logica||'cualquiera'} onChange={e=>setTestEditando((p:any)=>({...p,logica:e.target.value}))}>
                  <option value="cualquiera">Algún ítem marcado</option>
                  <option value="todos">Todos los ítems marcados</option>
                </select>
              </div>
            </div>
            <div className="field">
              <label>Etiquetas relacionadas (ejercicios recomendados cuando positivo)</label>
              <div style={{marginTop:5}}>
                <SelectorColumnas seleccionadas={testEditando.etiquetas_relacionadas||[]} onChange={ids=>setTestEditando((p:any)=>({...p,etiquetas_relacionadas:ids}))}/>
              </div>
              {(testEditando.etiquetas_relacionadas||[]).length>0&&(
                <div style={{marginTop:6,display:'flex',flexWrap:'wrap',gap:3}}>
                  {testEditando.etiquetas_relacionadas.map((id:string)=>{
                    const et = etiquetas.find((e:any)=>e.id===id)
                    return et?<span key={id} style={{fontSize:9,padding:'2px 8px',borderRadius:99,background:'var(--ambl)',color:'#7A5800'}}>{et.nombre}</span>:null
                  })}
                </div>
              )}
            </div>
            <div style={{display:'flex',gap:8,marginTop:8}}>
              <button className="btn btn-d btn-sm" onClick={()=>setModalEditarTest(false)}>Cancelar</button>
              <div style={{flex:1}}/>
              <button className="btn btn-p" onClick={guardarEditTest}>💾 Guardar cambios</button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
