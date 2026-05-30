'use client'
import { useState } from 'react'
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

export default function TestsTab({ testsLib, etiquetas, setTestsLib, SelectorColumnas }: any) {
  const [modalTest, setModalTest] = useState(false)
  const [modalEditarTest, setModalEditarTest] = useState(false)
  const [testEditando, setTestEditando] = useState<any>(null)
  const [subiendoImgTest, setSubiendoImgTest] = useState(false)
  const [nuevoTest, setNuevoTest] = useState({ nombre:'', descripcion:'', frecuencia_meses:3, video_url:'', imagen_url:'', imagen_file:null as File|null, items:[] as {nombre:string,tiene_grados:boolean}[], logica:'cualquiera', etiquetas_relacionadas:[] as string[] })

  async function crearTest() {
    if (!nuevoTest.nombre) { alert('El nombre es obligatorio'); return }
    setSubiendoImgTest(true)
    const { data: t, error } = await supabase.from('tests').insert({ nombre:nuevoTest.nombre, descripcion:nuevoTest.descripcion, frecuencia_meses:nuevoTest.frecuencia_meses, video_url:nuevoTest.video_url, items:nuevoTest.items, logica:nuevoTest.logica, imagen_url:'' }).select().single()
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
    setNuevoTest({ nombre:'', descripcion:'', frecuencia_meses:3, video_url:'', imagen_url:'', imagen_file:null, items:[], logica:'cualquiera', etiquetas_relacionadas:[] })
    const { data: tl } = await supabase.from('tests').select('*').order('nombre')
    setTestsLib(tl||[])
  }

  async function guardarEditTest() {
    if (!testEditando) return
    await supabase.from('tests').update({ nombre:testEditando.nombre, descripcion:testEditando.descripcion, video_url:testEditando.video_url, frecuencia_meses:testEditando.frecuencia_meses, logica:testEditando.logica, items:testEditando.items||[], etiquetas_relacionadas:testEditando.etiquetas_relacionadas||[] }).eq('id', testEditando.id)
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

  return (
    <>
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:10}}>
        <div style={{fontSize:11,color:'var(--grl)',fontWeight:300}}>{testsLib.length} tests</div>
        <button className="btn btn-p btn-sm" onClick={()=>setModalTest(true)}>+ Nuevo test</button>
      </div>
      <div className="g3">
        {testsLib.length===0&&<div style={{gridColumn:'1/-1',padding:30,textAlign:'center',fontSize:11,color:'var(--grl)'}}>Sin tests.</div>}
        {testsLib.map((t:any)=>(
          <div key={t.id} style={{background:'var(--w)',border:'1px solid var(--bd)',borderRadius:'var(--rl)',overflow:'hidden'}}
            onMouseOver={e=>(e.currentTarget as HTMLElement).style.borderColor='var(--g)'}
            onMouseOut={e=>(e.currentTarget as HTMLElement).style.borderColor='var(--bd)'}>
            {t.imagen_url?<img src={t.imagen_url} alt={t.nombre} style={{width:'100%',height:120,objectFit:'cover',borderBottom:'1px solid var(--bd)',display:'block'}}/>:<div style={{height:120,background:'var(--bm)',display:'flex',alignItems:'center',justifyContent:'center',fontSize:28,borderBottom:'1px solid var(--bd)'}}>🔍</div>}
            <div style={{padding:'9px 11px'}}>
              <div style={{fontSize:11,fontWeight:400,color:'var(--n)',marginBottom:3}}>{t.nombre}</div>
              {t.descripcion&&<div style={{fontSize:9,color:'var(--grl)',fontWeight:300,lineHeight:1.4,marginBottom:5}}>{t.descripcion.slice(0,80)}{t.descripcion.length>80?'...':''}</div>}
              {(t.items||[]).length>0&&(
                <div style={{marginBottom:5}}>
                  <div style={{fontSize:8,fontWeight:600,color:'var(--grl)',letterSpacing:.4,textTransform:'uppercase',marginBottom:3}}>Ítems · {t.logica==='cualquiera'?'Cualquiera = +':'Todos = +'}</div>
                  {(t.items||[]).slice(0,3).map((item:any,i:number)=><div key={i} style={{fontSize:9,color:'var(--n)',fontWeight:300}}>☐ {item.nombre}{item.tiene_grados?' (°)':''}</div>)}
                  {(t.items||[]).length>3&&<div style={{fontSize:8,color:'var(--grl)'}}>+{(t.items||[]).length-3} más</div>}
                </div>
              )}
              <div style={{display:'flex',alignItems:'center',justifyContent:'space-between'}}>
                <div style={{fontSize:9,color:'var(--g)'}}>Revisión cada {t.frecuencia_meses} meses</div>
                <div style={{display:'flex',gap:4}}>
                  {t.video_url&&<a href={t.video_url} target="_blank" rel="noopener noreferrer" style={{fontSize:11}}>🎥</a>}
                  <button onClick={()=>{setTestEditando({...t});setModalEditarTest(true)}} style={{fontSize:10,color:'var(--g)',background:'none',border:'none',cursor:'pointer'}}>✏️</button>
                  <button onClick={()=>eliminarTest(t.id)} style={{fontSize:10,color:'var(--red)',background:'none',border:'none',cursor:'pointer'}}>✕</button>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {modalTest&&(
        <div className="modal-bg" onClick={e=>{if(e.target===e.currentTarget)setModalTest(false)}}>
          <div className="modal" style={{width:520,maxHeight:'90vh'}}>
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
              <label>Imagen</label>
              <div style={{display:'flex',alignItems:'center',gap:10,marginTop:4}}>
                {nuevoTest.imagen_url?<div style={{position:'relative'}}><img src={nuevoTest.imagen_url} alt="preview" style={{width:80,height:80,objectFit:'cover',borderRadius:6}}/><button onClick={()=>setNuevoTest(p=>({...p,imagen_url:'',imagen_file:null}))} style={{position:'absolute',top:-6,right:-6,width:18,height:18,borderRadius:'50%',background:'var(--red)',color:'#fff',border:'none',cursor:'pointer',fontSize:9}}>✕</button></div>:<div style={{width:80,height:80,background:'var(--bm)',borderRadius:6,border:'1.5px dashed var(--bd)',display:'flex',alignItems:'center',justifyContent:'center',fontSize:24}}>🔍</div>}
                <label style={{cursor:'pointer'}}><div className="btn btn-s btn-sm">📷 Subir</div><input type="file" accept="image/*" onChange={e=>{const f=e.target.files?.[0];if(f)setNuevoTest(p=>({...p,imagen_file:f,imagen_url:URL.createObjectURL(f)}))}} style={{display:'none'}}/></label>
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
              {nuevoTest.items.map((item,i)=>(
                <div key={i} style={{display:'flex',alignItems:'center',gap:7,marginBottom:5,background:'var(--bl)',borderRadius:5,padding:'6px 8px',border:'1px solid var(--bd)'}}>
                  <input className="input" value={item.nombre} onChange={e=>{const its=[...nuevoTest.items];its[i]={...its[i],nombre:e.target.value};setNuevoTest(p=>({...p,items:its}))}} placeholder="ej. La rodilla no llega a 90°" style={{flex:1,fontSize:11}}/>
                  <label style={{display:'flex',alignItems:'center',gap:4,cursor:'pointer',fontSize:9,color:'var(--grl)',flexShrink:0}}>
                    <input type="checkbox" checked={item.tiene_grados} onChange={e=>{const its=[...nuevoTest.items];its[i]={...its[i],tiene_grados:e.target.checked};setNuevoTest(p=>({...p,items:its}))}} style={{accentColor:'var(--g)'}}/>Mide °
                  </label>
                  <button onClick={()=>setNuevoTest(p=>({...p,items:p.items.filter((_,j)=>j!==i)}))} style={{fontSize:11,color:'var(--red)',background:'none',border:'none',cursor:'pointer'}}>✕</button>
                </div>
              ))}
              <button className="btn btn-t btn-sm" onClick={()=>setNuevoTest(p=>({...p,items:[...p.items,{nombre:'',tiene_grados:false}]}))}>+ Añadir ítem</button>
            </div>
            <div className="field">
              <label>Etiquetas relacionadas</label>
              <div style={{marginTop:5}}><SelectorColumnas seleccionadas={nuevoTest.etiquetas_relacionadas||[]} onChange={(ids:string[])=>setNuevoTest(p=>({...p,etiquetas_relacionadas:ids}))}/></div>
            </div>
            <div style={{display:'flex',gap:8,marginTop:8}}>
              <button className="btn btn-d btn-sm" onClick={()=>setModalTest(false)}>Cancelar</button>
              <div style={{flex:1}}/>
              <button className="btn btn-p" onClick={crearTest} disabled={subiendoImgTest}>{subiendoImgTest?'⏳':'💾 Guardar'}</button>
            </div>
          </div>
        </div>
      )}

      {modalEditarTest&&testEditando&&(
        <div className="modal-bg" onClick={e=>{if(e.target===e.currentTarget)setModalEditarTest(false)}}>
          <div className="modal" style={{width:520,maxHeight:'90vh'}}>
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
              <label>Etiquetas relacionadas</label>
              <div style={{marginTop:5}}><SelectorColumnas seleccionadas={testEditando.etiquetas_relacionadas||[]} onChange={(ids:string[])=>setTestEditando((p:any)=>({...p,etiquetas_relacionadas:ids}))}/></div>
            </div>
            <div style={{display:'flex',gap:8,marginTop:8}}>
              <button className="btn btn-d btn-sm" onClick={()=>setModalEditarTest(false)}>Cancelar</button>
              <div style={{flex:1}}/>
              <button className="btn btn-p" onClick={guardarEditTest}>💾 Guardar</button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
