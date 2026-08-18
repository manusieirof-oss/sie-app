'use client'
import { useState } from 'react'
import { supabase } from '@/lib/supabase'
import { Ic } from '@/lib/icons'
import { UNIDADES, unidadDe, mide, textoRegla } from '@/lib/tests'
import ExploradorTests from '@/components/ExploradorTests'
import SelectorEtiquetasCompacto from '@/components/SelectorEtiquetasCompacto'

const CATEGORIAS = [
  { key: 'musculo', label: 'Músculo' },
  { key: 'articulacion', label: 'Articulación' },
  { key: 'movimiento', label: 'Movimiento' },
  { key: 'posicion', label: 'Posición' },
  { key: 'material', label: 'Material' },
  { key: 'apoyo', label: 'Apoyo' },
  { key: 'agarre', label: 'Agarre' },
  { key: 'patologia', label: 'Patología' },
  { key: 'plano_eje', label: 'Plano y eje' },
]

/**
 * La BARRA de un ítem medido: de dónde a dónde va y qué valor es un hallazgo.
 *
 * Sin esto, un ítem con unidad se rellenaba marcando una casilla y escribiendo el número
 * al lado, o sea que el veredicto lo ponías tú cada vez. Con la regla puesta, el positivo
 * lo decide el propio valor y siempre igual.
 *
 * Va en un componente y no copiado en los dos formularios —crear y editar— porque son el
 * mismo formulario dos veces y ya se nota: el de editar arrastra diferencias del de crear.
 */
function ConfigBarra({ item, onCambia }: { item: any, onCambia: (campos: any) => void }) {
  if (!mide(item)) return null
  const u = unidadDe(item).simbolo.trim()
  const dosUmbrales = item.regla === 'entre' || item.regla === 'fuera'
  const num = (v: string) => v === '' ? undefined : Number(v)

  return (
    <div style={{ marginTop: 6, paddingTop: 6, borderTop: '1px dashed var(--bd)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
        <span style={{ fontSize: 10, color: 'var(--grl)' }}>Positivo si es</span>
        <select className="input" style={{ width: 128, fontSize: 11 }} value={item.regla || ''}
          onChange={e => onCambia({ regla: e.target.value || undefined })}>
          <option value="">— sin barra —</option>
          <option value="menor">menor que</option>
          <option value="mayor">mayor que</option>
          <option value="entre">está entre</option>
          <option value="fuera">está fuera de</option>
        </select>
        {item.regla && (
          <>
            <input className="input" type="number" style={{ width: 74, fontSize: 11 }} value={item.umbral ?? ''}
              onChange={e => onCambia({ umbral: num(e.target.value) })} placeholder="valor" />
            {dosUmbrales && (
              <>
                <span style={{ fontSize: 10, color: 'var(--grl)' }}>y</span>
                <input className="input" type="number" style={{ width: 74, fontSize: 11 }} value={item.umbral2 ?? ''}
                  onChange={e => onCambia({ umbral2: num(e.target.value) })} placeholder="valor" />
              </>
            )}
            <span style={{ fontSize: 10, color: 'var(--grl)' }}>{u}</span>
            <span style={{ fontSize: 10, color: 'var(--grl)', marginLeft: 8 }}>Barra de</span>
            {/* El mínimo admite negativos: hay medidas que los tienen. */}
            <input className="input" type="number" style={{ width: 66, fontSize: 11 }} value={item.min ?? ''}
              onChange={e => onCambia({ min: num(e.target.value) })} placeholder="mín" />
            <span style={{ fontSize: 10, color: 'var(--grl)' }}>a</span>
            <input className="input" type="number" style={{ width: 66, fontSize: 11 }} value={item.max ?? ''}
              onChange={e => onCambia({ max: num(e.target.value) })} placeholder="máx" />
          </>
        )}
      </div>
      {item.regla && (
        <div style={{ fontSize: 10, color: 'var(--gd)', marginTop: 4 }}>
          {textoRegla(item) || 'Rellena el valor para ver la regla'}
        </div>
      )}
    </div>
  )
}

/**
 * Los objetivos que abre un ítem.
 *
 * Antes se pintaban LOS 22 en píldoras de 8 px debajo de cada ítem: con cuatro ítems eran
 * ochenta y ocho píldoras minúsculas en un modal, y para saber cuáles estaban puestas
 * había que leerlas todas buscando las de color.
 *
 * Ahora se ven solo los puestos, y los demás se abren con el botón. Mismo criterio que las
 * etiquetas: primero lo que hay, lo demás se busca.
 */
function PildorasObjetivos({ seleccionados, objetivos, onToggle }: any) {
  const [abierto, setAbierto] = useState(false)
  const [busca, setBusca] = useState('')
  if (!objetivos || objetivos.length===0) return null

  const sel = seleccionados || []
  const puestos = objetivos.filter((o:any)=>sel.includes(o.id))
  const t = busca.toLowerCase().trim()
  const resto = objetivos.filter((o:any)=>!sel.includes(o.id) && (!t || (o.nombre||'').toLowerCase().includes(t)))

  return (
    <div style={{marginTop:5,marginLeft:2}}>
      <div style={{display:'flex',flexWrap:'wrap',gap:4,alignItems:'center'}}>
        <span style={{fontSize:9,color:'var(--grl)'}}>Abre:</span>
        {puestos.length===0 && <span style={{fontSize:9,color:'var(--grl)'}}>ningún objetivo</span>}
        {puestos.map((o:any)=>(
          <span key={o.id} onClick={()=>onToggle(o.id)} title="Quitar"
            style={{fontSize:9,padding:'2px 8px',borderRadius:99,cursor:'pointer',background:o.color||'var(--g)',color:'#fff',display:'inline-flex',alignItems:'center',gap:4}}>
            {o.nombre} <span style={{opacity:.7}}>✕</span>
          </span>
        ))}
        <button onClick={()=>setAbierto(v=>!v)}
          style={{fontSize:9,padding:'2px 8px',borderRadius:99,cursor:'pointer',border:'1px dashed var(--bd)',background:'var(--w)',color:'var(--g)',fontFamily:'inherit'}}>
          {abierto ? 'Cerrar' : '+ Objetivo'}
        </button>
      </div>

      {abierto && (
        <div style={{marginTop:5,border:'1px solid var(--bd)',borderRadius:6,padding:6}}>
          <input className="input" value={busca} onChange={e=>setBusca(e.target.value)}
            placeholder="Buscar objetivo..." style={{fontSize:11,marginBottom:5}}/>
          <div style={{display:'flex',flexWrap:'wrap',gap:4,maxHeight:130,overflowY:'auto'}}>
            {resto.length===0
              ? <span style={{fontSize:10,color:'var(--grl)'}}>Nada que coincida.</span>
              : resto.map((o:any)=>(
                <span key={o.id} onClick={()=>onToggle(o.id)}
                  style={{fontSize:9,padding:'2px 8px',borderRadius:99,cursor:'pointer',border:'1px solid var(--bd)',background:'var(--w)',color:'var(--gr)'}}>
                  {o.nombre}
                </span>
              ))}
          </div>
        </div>
      )}
    </div>
  )
}

export default function TestsTab({ testsLib, etiquetas, objetivos, setTestsLib, SelectorColumnas }: any) {
  const [modalTest, setModalTest] = useState(false)
  const [testDetalle, setTestDetalle] = useState<any>(null)
  const [modalEditarTest, setModalEditarTest] = useState(false)
  const [testEditando, setTestEditando] = useState<any>(null)
  const [subiendoImgTest, setSubiendoImgTest] = useState(false)
  const [nuevoTest, setNuevoTest] = useState({ nombre:'', descripcion:'', frecuencia_meses:3, video_url:'', imagen_url:'', imagen_file:null as File|null, items:[] as any[], logica:'cualquiera', etiquetas_relacionadas:[] as string[], etiquetas_bloquea:[] as string[], tipo_lado:'bilateral' })

  async function crearTest() {
    if (!nuevoTest.nombre) { alert('El nombre es obligatorio'); return }
    setSubiendoImgTest(true)
    const { data: t, error } = await supabase.from('tests').insert({ nombre:nuevoTest.nombre, descripcion:nuevoTest.descripcion, frecuencia_meses:nuevoTest.frecuencia_meses, video_url:nuevoTest.video_url, items:nuevoTest.items, logica:nuevoTest.logica, etiquetas_relacionadas:nuevoTest.etiquetas_relacionadas||[], etiquetas_bloquea:nuevoTest.etiquetas_bloquea||[], tipo_lado:nuevoTest.tipo_lado, imagen_url:'' }).select().single()
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
    setNuevoTest({ nombre:'', descripcion:'', frecuencia_meses:3, video_url:'', imagen_url:'', imagen_file:null, items:[], logica:'cualquiera', etiquetas_relacionadas:[], etiquetas_bloquea:[], tipo_lado:'bilateral' })
    const { data: tl } = await supabase.from('tests').select('*').order('nombre')
    setTestsLib(tl||[])
  }

  async function guardarEditTest() {
    if (!testEditando) return
    setSubiendoImgTest(true)
    let imagenUrl = testEditando.imagen_url || ''
    if (testEditando.imagen_file) {
      const ext = testEditando.imagen_file.name.split('.').pop()
      const path = `tests/${testEditando.id}/foto.${ext}`
      const { error: upErr } = await supabase.storage.from('fotos').upload(path, testEditando.imagen_file, { upsert: true })
      if (!upErr) {
        const { data: { publicUrl } } = supabase.storage.from('fotos').getPublicUrl(path)
        imagenUrl = publicUrl + '?t=' + Date.now()
      }
    }
    await supabase.from('tests').update({ nombre:testEditando.nombre, descripcion:testEditando.descripcion, video_url:testEditando.video_url, frecuencia_meses:testEditando.frecuencia_meses, logica:testEditando.logica, items:testEditando.items||[], etiquetas_relacionadas:testEditando.etiquetas_relacionadas||[], etiquetas_bloquea:testEditando.etiquetas_bloquea||[], tipo_lado:testEditando.tipo_lado||'bilateral', imagen_url:imagenUrl }).eq('id', testEditando.id)
    setSubiendoImgTest(false)
    setModalEditarTest(false); setTestEditando(null)
    const { data: tl } = await supabase.from('tests').select('*').order('nombre')
    setTestsLib(tl||[])
  }

  async function eliminarTest(id: string) {
    if (!confirm('¿Eliminar este test?')) return
    await supabase.from('resultados_tests').delete().eq('test_id', id)
    await supabase.from('tests').delete().eq('id', id)
    const { data: tl } = await supabase.from('tests').select('*').order('nombre')
    setTestsLib(tl||[])
  }

  // El buscador, el filtro por zona y la rejilla los pone `ExploradorTests`, que es el
  // mismo que usa la valoración. Estaban escritos aquí y la valoración tenía su propia
  // versión, peor; es el caso de `ExploradorEjercicios` otra vez.

  return (
    <>
      <ExploradorTests
        tests={testsLib} etiquetas={etiquetas} onAbrir={(t:any)=>setTestDetalle(t)}
        acciones={<button className="btn btn-p btn-sm" onClick={()=>setModalTest(true)}>+ Nuevo test</button>}/>

      {testDetalle&&(
        <div className="modal-bg" onClick={e=>{if(e.target===e.currentTarget)setTestDetalle(null)}}>
          <div style={{background:'var(--w)',borderRadius:'var(--rl)',width:'94vw',maxWidth:820,maxHeight:'90vh',display:'flex',flexDirection:'column',boxShadow:'0 4px 32px rgba(38,40,37,.15)',overflow:'hidden'}}>
            <div style={{padding:'12px 16px',borderBottom:'1px solid var(--bd)',background:'var(--bl)',display:'flex',alignItems:'center',gap:10}}>
              <div style={{flex:1,fontSize:14,fontWeight:400,color:'var(--n)'}}>{testDetalle.nombre}</div>
              <button className="btn btn-s btn-sm" onClick={()=>{setTestEditando({...testDetalle});setModalEditarTest(true);setTestDetalle(null)}}><Ic name="editar" size={12}/> Editar</button>
              <button className="btn btn-d btn-sm" onClick={()=>{eliminarTest(testDetalle.id);setTestDetalle(null)}}><Ic name="papelera" size={12}/></button>
              <button onClick={()=>setTestDetalle(null)} style={{width:26,height:26,borderRadius:'50%',border:'1px solid var(--bd)',background:'var(--w)',cursor:'pointer',fontSize:13,color:'var(--gr)'}}>✕</button>
            </div>
            <div style={{flex:1,overflowY:'auto',padding:16}}>
              <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:18}}>
                <div>
                  {testDetalle.imagen_url?<img src={testDetalle.imagen_url} alt={testDetalle.nombre} style={{width:'100%',height:240,objectFit:'contain',background:'var(--bm)',borderRadius:8,border:'1px solid var(--bd)'}}/>:<div style={{width:'100%',height:240,background:'var(--bm)',borderRadius:8,display:'flex',alignItems:'center',justifyContent:'center',color:'var(--grl)'}}><Ic name="test" size={48}/></div>}
                </div>
                <div>
                  {testDetalle.descripcion&&<div style={{marginBottom:12}}><div style={{fontSize:9,fontWeight:600,color:'var(--grl)',letterSpacing:.4,textTransform:'uppercase',marginBottom:5}}>Descripción</div><div style={{fontSize:11,color:'var(--n)',fontWeight:300,lineHeight:1.6}}>{testDetalle.descripcion}</div></div>}
                  <div style={{display:'flex',gap:5,flexWrap:'wrap',marginBottom:12}}>
                    <span style={{fontSize:9,padding:'2px 8px',borderRadius:99,background:'var(--bm)',color:'var(--gr)'}}>Revisión cada {testDetalle.frecuencia_meses} meses</span>
                    <span style={{fontSize:9,padding:'2px 8px',borderRadius:99,background:'var(--bm)',color:'var(--gr)'}}>{testDetalle.tipo_lado==='lateral'?'Izq / Der':'Bilateral'}</span>
                    {testDetalle.video_url&&<a href={testDetalle.video_url} target="_blank" rel="noopener noreferrer" style={{fontSize:9,padding:'2px 8px',borderRadius:99,background:'var(--gl)',color:'var(--gd)',textDecoration:'none',display:'inline-flex',alignItems:'center',gap:3}}><Ic name="play" size={10}/> Vídeo</a>}
                  </div>
                  {(testDetalle.items||[]).length>0&&(
                    <div>
                      <div style={{fontSize:9,fontWeight:600,color:'var(--grl)',letterSpacing:.4,textTransform:'uppercase',marginBottom:5}}>Ítems · {testDetalle.logica==='cualquiera'?'Cualquiera = positivo':'Todos = positivo'}</div>
                      {(testDetalle.items||[]).map((item:any,i:number)=><div key={i} style={{fontSize:11,color:'var(--n)',fontWeight:300,padding:'2px 0'}}>☐ {item.nombre}{unidadDe(item).simbolo?` · mide ${unidadDe(item).nombre.toLowerCase()}`:''}</div>)}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {modalTest&&(
        <div className="modal-bg" onClick={e=>{if(e.target===e.currentTarget)setModalTest(false)}}>
          <div className="modal" style={{width:'94vw',maxWidth:900,maxHeight:'90vh'}}>
            <div className="modal-title">Nuevo test<button className="modal-close" onClick={()=>setModalTest(false)}>✕</button></div>
            <div className="field"><label>Nombre *</label><input className="input" value={nuevoTest.nombre} onChange={e=>setNuevoTest(p=>({...p,nombre:e.target.value}))} autoFocus/></div>
            <div className="field"><label>Descripción</label><textarea className="input" value={nuevoTest.descripcion} onChange={e=>setNuevoTest(p=>({...p,descripcion:e.target.value}))}/></div>
            <div className="g2">
              <div className="field"><label>Enlace vídeo</label><input className="input" value={nuevoTest.video_url} onChange={e=>setNuevoTest(p=>({...p,video_url:e.target.value}))}/></div>
              <div className="field"><label>Frecuencia revisión</label>
                <select className="input" value={nuevoTest.frecuencia_meses} onChange={e=>setNuevoTest(p=>({...p,frecuencia_meses:parseInt(e.target.value)}))}>
                  {[1,2,3,6,12].map(m=><option key={m} value={m}>{m} {m===1?'mes':'meses'}</option>)}
                </select>
              </div>
            </div>
            <div className="field">
              <label>¿Tiene lados?</label>
              <div style={{display:'flex',gap:6,marginTop:4}}>
                {([['bilateral','Bilateral / único'],['lateral','Izquierdo / Derecho']] as const).map(([v,l])=>(
                  <div key={v} onClick={()=>setNuevoTest(p=>({...p,tipo_lado:v}))} style={{flex:1,padding:'8px',borderRadius:6,border:`1.5px solid ${nuevoTest.tipo_lado===v?'var(--g)':'var(--bd)'}`,background:nuevoTest.tipo_lado===v?'var(--gl)':'var(--w)',cursor:'pointer',textAlign:'center',fontSize:10,fontWeight:nuevoTest.tipo_lado===v?500:300,color:nuevoTest.tipo_lado===v?'var(--gd)':'var(--grl)'}}>{l}</div>
                ))}
              </div>
            </div>
            <div className="field">
              <label>Imagen</label>
              <div style={{display:'flex',alignItems:'center',gap:10,marginTop:4}}>
                {nuevoTest.imagen_url?<div style={{position:'relative'}}><img src={nuevoTest.imagen_url} alt="preview" style={{width:80,height:80,objectFit:'cover',borderRadius:6}}/><button onClick={()=>setNuevoTest(p=>({...p,imagen_url:'',imagen_file:null}))} style={{position:'absolute',top:-6,right:-6,width:18,height:18,borderRadius:'50%',background:'var(--red)',color:'#fff',border:'none',cursor:'pointer',fontSize:9}}>✕</button></div>:<div style={{width:80,height:80,background:'var(--bm)',borderRadius:6,border:'1.5px dashed var(--bd)',display:'flex',alignItems:'center',justifyContent:'center',color:'var(--grl)'}}><Ic name="test" size={24}/></div>}
                <label style={{cursor:'pointer'}}><div className="btn btn-s btn-sm"><Ic name="camara" size={12}/> Subir</div><input type="file" accept="image/*" onChange={e=>{const f=e.target.files?.[0];if(f)setNuevoTest(p=>({...p,imagen_file:f,imagen_url:URL.createObjectURL(f)}))}} style={{display:'none'}}/></label>
              </div>
            </div>
            <div className="field">
              <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:6}}>
                <label style={{margin:0}}>Ítems</label>
                <select style={{fontSize:9,padding:'2px 6px',border:'1px solid var(--bd)',borderRadius:3,background:'var(--bl)',fontFamily:'system-ui'}} value={nuevoTest.logica} onChange={e=>setNuevoTest(p=>({...p,logica:e.target.value}))}>
                  <option value="cualquiera">Cualquier ítem = positivo</option>
                  <option value="todos">Todos los ítems = positivo</option>
                </select>
              </div>
              {nuevoTest.items.map((item:any,i:number)=>(
                <div key={i} style={{marginBottom:5,background:'var(--bl)',borderRadius:5,padding:'6px 8px',border:'1px solid var(--bd)'}}>
                  <div style={{display:'flex',alignItems:'center',gap:7}}>
                    <input className="input" value={item.nombre} onChange={e=>{const its=[...nuevoTest.items];its[i]={...its[i],nombre:e.target.value};setNuevoTest(p=>({...p,items:its}))}} placeholder="ej. La rodilla no llega a 90°" style={{flex:1,fontSize:11}}/>
                    {/* La unidad va por ítem: un mismo test tiene ítems cualitativos y
                        medidos, y partirlo en dos por eso sería partir lo que en la
                        camilla es un solo test. */}
                    <select className="input" value={unidadDe(item).id} style={{width:118,fontSize:11,flexShrink:0}}
                      onChange={e=>{const its=[...nuevoTest.items] as any[];its[i]={...its[i],unidad:e.target.value};setNuevoTest(p=>({...p,items:its}))}}>
                      {UNIDADES.map(u=><option key={u.id} value={u.id}>{u.nombre}</option>)}
                    </select>
                    <button onClick={()=>setNuevoTest(p=>({...p,items:p.items.filter((_,j)=>j!==i)}))} style={{fontSize:11,color:'var(--red)',background:'none',border:'none',cursor:'pointer'}}>✕</button>
                  </div>
                  <ConfigBarra item={item} onCambia={(campos:any)=>{
                    const its=[...nuevoTest.items] as any[]; its[i]={...its[i],...campos}
                    setNuevoTest(p=>({...p,items:its}))
                  }}/>
                  <PildorasObjetivos seleccionados={item.objetivos||[]} objetivos={objetivos} onToggle={(oid:string)=>{
                    const its=[...nuevoTest.items] as any[]
                    const act = its[i].objetivos||[]
                    its[i]={...its[i], objetivos: act.includes(oid)?act.filter((x:string)=>x!==oid):[...act,oid]}
                    setNuevoTest(p=>({...p,items:its}))
                  }}/>
                </div>
              ))}
              <button className="btn btn-t btn-sm" onClick={()=>setNuevoTest(p=>({...p,items:[...p.items,{nombre:'',unidad:''}]}))}>+ Añadir ítem</button>
            </div>
            <div className="field">
              <label>Etiquetas relacionadas</label>
              <div style={{marginTop:5}}><SelectorEtiquetasCompacto etiquetas={etiquetas} seleccionadas={nuevoTest.etiquetas_relacionadas||[]} onChange={(ids:string[])=>setNuevoTest(p=>({...p,etiquetas_relacionadas:ids}))}/></div>
            </div>
            {/* Lo que este test DESACONSEJA si sale positivo. Avisa al montar la sesión;
                no impide nada, porque hay motivos para prescribirlo igual —carga baja,
                rango parcial— y un bloqueo duro se acaba esquivando fuera de la app.
                Un negativo posterior lo levanta solo. */}
            <div className="field">
              <label>Si sale positivo, desaconseja</label>
              <div style={{marginTop:5}}><SelectorEtiquetasCompacto etiquetas={etiquetas} seleccionadas={nuevoTest.etiquetas_bloquea||[]} onChange={(ids:string[])=>setNuevoTest(p=>({...p,etiquetas_bloquea:ids}))}/></div>
              <div style={{fontSize:12,color:'var(--gr)',marginTop:4}}>
                Los ejercicios con estas etiquetas saldrán avisados en el editor de sesión de
                quien dé positivo. Alcanza también a sus subetiquetas.
              </div>
            </div>
            <div style={{display:'flex',gap:8,marginTop:8}}>
              <button className="btn btn-d btn-sm" onClick={()=>setModalTest(false)}>Cancelar</button>
              <div style={{flex:1}}/>
              <button className="btn btn-p" onClick={crearTest} disabled={subiendoImgTest}>{subiendoImgTest?'…':<><Ic name="guardar" size={13}/> Guardar</>}</button>
            </div>
          </div>
        </div>
      )}

      {modalEditarTest&&testEditando&&(
        <div className="modal-bg" onClick={e=>{if(e.target===e.currentTarget)setModalEditarTest(false)}}>
          <div className="modal" style={{width:'94vw',maxWidth:900,maxHeight:'90vh'}}>
            <div className="modal-title">Editar test<button className="modal-close" onClick={()=>setModalEditarTest(false)}>✕</button></div>
            <div className="field"><label>Nombre *</label><input className="input" value={testEditando.nombre||''} onChange={e=>setTestEditando((p:any)=>({...p,nombre:e.target.value}))}/></div>
            <div className="field"><label>Descripción</label><textarea className="input" value={testEditando.descripcion||''} onChange={e=>setTestEditando((p:any)=>({...p,descripcion:e.target.value}))}/></div>
            <div className="field"><label>Enlace vídeo</label><input className="input" value={testEditando.video_url||''} onChange={e=>setTestEditando((p:any)=>({...p,video_url:e.target.value}))}/></div>
            <div className="g2">
              <div className="field"><label>Revisión (meses)</label><input className="input" type="number" value={testEditando.frecuencia_meses||3} onChange={e=>setTestEditando((p:any)=>({...p,frecuencia_meses:parseInt(e.target.value)||3}))}/></div>
              <div className="field"><label>Positivo si</label>
                <select className="input" value={testEditando.logica||'cualquiera'} onChange={e=>setTestEditando((p:any)=>({...p,logica:e.target.value}))}>
                  <option value="cualquiera">Algún ítem marcado</option>
                  <option value="todos">Todos los ítems marcados</option>
                </select>
              </div>
            </div>
            <div className="field">
              <label>¿Tiene lados?</label>
              <div style={{display:'flex',gap:6,marginTop:4}}>
                {([['bilateral','Bilateral / único'],['lateral','Izquierdo / Derecho']] as const).map(([v,l])=>(
                  <div key={v} onClick={()=>setTestEditando((p:any)=>({...p,tipo_lado:v}))} style={{flex:1,padding:'8px',borderRadius:6,border:`1.5px solid ${(testEditando.tipo_lado||'bilateral')===v?'var(--g)':'var(--bd)'}`,background:(testEditando.tipo_lado||'bilateral')===v?'var(--gl)':'var(--w)',cursor:'pointer',textAlign:'center',fontSize:10,fontWeight:(testEditando.tipo_lado||'bilateral')===v?500:300,color:(testEditando.tipo_lado||'bilateral')===v?'var(--gd)':'var(--grl)'}}>{l}</div>
                ))}
              </div>
            </div>
            <div className="field">
              <label>Imagen</label>
              <div style={{display:'flex',alignItems:'center',gap:10,marginTop:4}}>
                {testEditando.imagen_url?<div style={{position:'relative'}}><img src={testEditando.imagen_url} alt="preview" style={{width:80,height:80,objectFit:'cover',borderRadius:6}}/><button onClick={()=>setTestEditando((p:any)=>({...p,imagen_url:'',imagen_file:null}))} style={{position:'absolute',top:-6,right:-6,width:18,height:18,borderRadius:'50%',background:'var(--red)',color:'#fff',border:'none',cursor:'pointer',fontSize:9}}>✕</button></div>:<div style={{width:80,height:80,background:'var(--bm)',borderRadius:6,border:'1.5px dashed var(--bd)',display:'flex',alignItems:'center',justifyContent:'center',color:'var(--grl)'}}><Ic name="test" size={24}/></div>}
                <label style={{cursor:'pointer'}}><div className="btn btn-s btn-sm"><Ic name="camara" size={12}/> Cambiar</div><input type="file" accept="image/*" onChange={e=>{const f=e.target.files?.[0];if(f)setTestEditando((p:any)=>({...p,imagen_file:f,imagen_url:URL.createObjectURL(f)}))}} style={{display:'none'}}/></label>
              </div>
            </div>
            <div className="field">
              <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:6}}>
                <label style={{margin:0}}>Ítems</label>
              </div>
              {(testEditando.items||[]).map((item:any,i:number)=>(
                <div key={i} style={{marginBottom:5,background:'var(--bl)',borderRadius:5,padding:'6px 8px',border:'1px solid var(--bd)'}}>
                  <div style={{display:'flex',alignItems:'center',gap:7}}>
                    <input className="input" value={item.nombre} onChange={e=>{const its=[...(testEditando.items||[])];its[i]={...its[i],nombre:e.target.value};setTestEditando((p:any)=>({...p,items:its}))}} placeholder="ej. La rodilla no llega a 90°" style={{flex:1,fontSize:11}}/>
                    <select className="input" value={unidadDe(item).id} style={{width:118,fontSize:11,flexShrink:0}}
                      onChange={e=>{const its=[...(testEditando.items||[])] as any[];its[i]={...its[i],unidad:e.target.value};setTestEditando((p:any)=>({...p,items:its}))}}>
                      {UNIDADES.map(u=><option key={u.id} value={u.id}>{u.nombre}</option>)}
                    </select>
                    <button onClick={()=>setTestEditando((p:any)=>({...p,items:(p.items||[]).filter((_:any,j:number)=>j!==i)}))} style={{fontSize:11,color:'var(--red)',background:'none',border:'none',cursor:'pointer'}}>✕</button>
                  </div>
                  <ConfigBarra item={item} onCambia={(campos:any)=>{
                    const its=[...(testEditando.items||[])] as any[]; its[i]={...its[i],...campos}
                    setTestEditando((p:any)=>({...p,items:its}))
                  }}/>
                  <PildorasObjetivos seleccionados={item.objetivos||[]} objetivos={objetivos} onToggle={(oid:string)=>{
                    const its=[...(testEditando.items||[])] as any[]
                    const act = its[i].objetivos||[]
                    its[i]={...its[i], objetivos: act.includes(oid)?act.filter((x:string)=>x!==oid):[...act,oid]}
                    setTestEditando((p:any)=>({...p,items:its}))
                  }}/>
                </div>
              ))}
              <button className="btn btn-t btn-sm" onClick={()=>setTestEditando((p:any)=>({...p,items:[...(p.items||[]),{nombre:'',unidad:''}]}))}>+ Añadir ítem</button>
            </div>
            <div className="field">
              <label>Etiquetas relacionadas</label>
              <div style={{marginTop:5}}><SelectorEtiquetasCompacto etiquetas={etiquetas} seleccionadas={testEditando.etiquetas_relacionadas||[]} onChange={(ids:string[])=>setTestEditando((p:any)=>({...p,etiquetas_relacionadas:ids}))}/></div>
            </div>
            {/* Lo que este test DESACONSEJA si sale positivo. Avisa al montar la sesión;
                no impide nada, porque hay motivos para prescribirlo igual —carga baja,
                rango parcial— y un bloqueo duro se acaba esquivando fuera de la app.
                Un negativo posterior lo levanta solo. */}
            <div className="field">
              <label>Si sale positivo, desaconseja</label>
              <div style={{marginTop:5}}><SelectorEtiquetasCompacto etiquetas={etiquetas} seleccionadas={testEditando.etiquetas_bloquea||[]} onChange={(ids:string[])=>setTestEditando((p:any)=>({...p,etiquetas_bloquea:ids}))}/></div>
              <div style={{fontSize:12,color:'var(--gr)',marginTop:4}}>
                Los ejercicios con estas etiquetas saldrán avisados en el editor de sesión de
                quien dé positivo. Alcanza también a sus subetiquetas.
              </div>
            </div>
            <div style={{display:'flex',gap:8,marginTop:8}}>
              <button className="btn btn-d btn-sm" onClick={()=>setModalEditarTest(false)}>Cancelar</button>
              <div style={{flex:1}}/>
              <button className="btn btn-p" onClick={guardarEditTest} disabled={subiendoImgTest}>{subiendoImgTest?'…':<><Ic name="guardar" size={13}/> Guardar</>}</button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
