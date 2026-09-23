'use client'
import { useMemo, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { Ic } from '@/lib/icons'
import { UNIDADES, unidadDe, mide, textoRegla, problemasDelTest, alcanceBorradoTest, borrarTest, archivarTest, planDeItems, alcanceItemsBorrados, aplicarCambioDeItems, esSuma, esBaremo, bandasDe, baremosDe, rangoTotal, textoNorma } from '@/lib/tests'
import ExploradorTests from '@/components/ExploradorTests'
import SelectorEtiquetasCompacto from '@/components/SelectorEtiquetasCompacto'
import { ordenAnatomico } from '@/lib/anatomia'
import { categoriaDe, raizDe, zonasDe, casaZona } from '@/lib/etiquetas'
import FiltroZonas from '@/components/FiltroZonas'
import { ConfigBarra, EditorBandas, SelectorZona, EditorBaremos } from './EditoresTest'
import ModalTest from './ModalTest'

export default function TestsTab({ testsLib, etiquetas, objetivos, setTestsLib, SelectorColumnas }: any) {
  const [modalTest, setModalTest] = useState(false)
  const [testDetalle, setTestDetalle] = useState<any>(null)
  const [modalEditarTest, setModalEditarTest] = useState(false)
  const [testEditando, setTestEditando] = useState<any>(null)
  const [subiendoImgTest, setSubiendoImgTest] = useState(false)
  const [verArchivados, setVerArchivados] = useState(false)

  /**
   * Todo lo de abajo miraba el resultado de Supabase de reojo o directamente no lo miraba:
   * se cerraba el modal, se recargaba la lista y parecía que había ido bien. Un test que
   * no se guarda tiene que decir que no se ha guardado, y el modal tiene que seguir
   * abierto con lo escrito dentro.
   */
  async function recargarTests() {
    const { data, error } = await supabase.from('tests').select('*').order('nombre')
    if (error) { alert('El test se ha guardado, pero la lista no se ha podido recargar: ' + error.message); return }
    setTestsLib(data || [])
  }

  /** Sube la imagen y devuelve su URL pública, o el motivo por el que no ha podido. */
  async function subirImagenTest(testId: string, file: File): Promise<{ url: string } | { error: string }> {
    const ext = file.name.split('.').pop()
    const path = `tests/${testId}/foto.${ext}`
    const { error } = await supabase.storage.from('fotos').upload(path, file, { upsert: true })
    if (error) return { error: error.message }
    const { data: { publicUrl } } = supabase.storage.from('fotos').getPublicUrl(path)
    return { url: publicUrl }
  }

  /** Las reglas están en `lib/tests.ts`; aquí solo se enseñan. true = no se guarda. */
  function bloqueadoPorProblemas(test: any): boolean {
    const p = problemasDelTest(test)
    if (p.length === 0) return false
    alert('El test no se ha guardado:\n\n' + p.map(x => '· ' + x).join('\n'))
    return true
  }
  async function guardarEditTest() {
    if (!testEditando) return
    if (bloqueadoPorProblemas(testEditando)) return

    /* QUÉ LE PASA A LO QUE CUELGA DE LOS ÍTEMS.
       Los ítems de antes se leen de la base y no de `testsLib`: el formulario
       trabaja sobre una copia superficial y el array de ítems puede ser el mismo
       objeto, con lo que "antes" y "después" saldrían idénticos. */
    const { data: previo } = await supabase.from('tests')
      .select('items,nombre').eq('id', testEditando.id).maybeSingle()
    const plan = planDeItems(previo?.items || [], testEditando.items || [])
    if (plan.borrados.length > 0) {
      const a = await alcanceItemsBorrados(testEditando.id, plan)
      if (a.objetivos.length > 0 || a.vias > 0) {
        const lineas = [
          `Quitas ${plan.borrados.length === 1 ? 'el ítem' : 'los ítems'} ${plan.borrados.map(b => `\u00ab${b.nombre}\u00bb`).join(', ')}.`, '',
        ]
        if (a.objetivos.length > 0) lineas.push(`\u00b7 Se comprobaban con \u00e9l: ${a.objetivos.join(', ')}. Se quedan sin esa medida.`)
        if (a.vias > 0) lineas.push(`\u00b7 ${a.vias} parte${a.vias === 1 ? '' : 's'} de objetivo abierta${a.vias === 1 ? '' : 's'} en ${a.pacientes} paciente${a.pacientes === 1 ? '' : 's'} depend${a.vias === 1 ? 'e' : 'en'} de \u00e9l. Se quitan, porque ya no hay forma de resolverlas.`)
        lineas.push('', '¿Seguir?')
        if (confirm(lineas.join('\n')) === false) return
      }
    }

    setSubiendoImgTest(true)
    let imagenUrl = testEditando.imagen_url || ''
    let avisoImagen = ''
    if (testEditando.imagen_file) {
      const r = await subirImagenTest(testEditando.id, testEditando.imagen_file)
      if ('error' in r) avisoImagen = r.error
      // El sufijo con la hora es para saltarse la caché del navegador: la ruta del fichero
      // es siempre la misma y sin esto se sigue viendo la imagen anterior.
      else imagenUrl = r.url + '?t=' + Date.now()
    }
    const { error } = await supabase.from('tests').update({ nombre:testEditando.nombre, descripcion:testEditando.descripcion, video_url:testEditando.video_url, frecuencia_meses:testEditando.frecuencia_meses, logica:testEditando.logica, items:testEditando.items||[], bandas:(esSuma(testEditando)||esBaremo(testEditando))?(testEditando.bandas||[]):[], baremos:esBaremo(testEditando)?(testEditando.baremos||[]):[], etiquetas_relacionadas:testEditando.etiquetas_relacionadas||[], etiquetas_bloquea:testEditando.etiquetas_bloquea||[], tipo_lado:testEditando.tipo_lado||'bilateral', imagen_url:imagenUrl }).eq('id', testEditando.id)
    if (error) { setSubiendoImgTest(false); alert('No se han guardado los cambios: ' + error.message); return }

    // Y ahora se arrastra el cambio a lo que apunta a los ítems: ver `planDeItems`.
    const rp = await aplicarCambioDeItems(testEditando.id, plan, testEditando.nombre || previo?.nombre || '')
    setSubiendoImgTest(false)
    if (rp.ok === false) alert('El test se ha guardado, pero los objetivos que cuelgan de sus ítems no se han podido ajustar: ' + rp.error)

    setModalEditarTest(false); setTestEditando(null)
    await recargarTests()
    if (avisoImagen) alert('Los cambios se han guardado, pero la imagen no se ha subido: ' + avisoImagen)
  }

  /**
   * El borrado vive en `lib/tests.ts`, que es quien sabe qué cuelga de un test. Aquí solo
   * se pregunta —diciendo exactamente qué se lleva por delante— y se enseña el resultado.
   */
  /**
   * ARCHIVAR, y borrar de verdad solo lo que no ha medido a nadie.
   *
   * Borrar un test que ya se ha pasado reescribe el pasado: se van sus
   * resultados y, al quitarle la vía al paciente, un objetivo que tenía LOGRADO
   * se le reabre. Ver `archivarTest`.
   */
  async function retirarTest(t: any) {
    const a = await alcanceBorradoTest(t.id)
    if (a.limpio) {
      if (!confirm(`Eliminar «${t.nombre}».\n\nNo se lo han pasado a nadie y no lo usa ningún objetivo, así que no se pierde nada.\n\nNo se puede deshacer.`)) return
      const r = await borrarTest(t.id)
      if (r.ok === false) { alert('No se ha eliminado: ' + r.error); return }
      setTestDetalle(null); await recargarTests(); return
    }
    const lineas = [`Archivar «${t.nombre}».`, '']
    if (a.resultados > 0) lineas.push(`\u00b7 ${a.resultados} resultado${a.resultados === 1 ? '' : 's'} de paciente.`)
    if (a.pacientes > 0) lineas.push(`\u00b7 ${a.pacientes} paciente${a.pacientes === 1 ? ' tiene' : 's tienen'} objetivos abiertos por él.`)
    if (a.evaluan.length > 0) lineas.push(`\u00b7 Se comprueban con él: ${a.evaluan.join(', ')}.`)
    if (a.objetivos.length > 0) lineas.push(`\u00b7 Abre: ${a.objetivos.join(', ')}.`)
    lineas.push('', 'Todo eso se queda como está. El test desaparece de la biblioteca y no se le podrá pasar a nadie más.')
    if (!confirm(lineas.join('\n'))) return
    const r = await archivarTest(t.id, true)
    if (r.ok === false) { alert('No se ha archivado: ' + r.error); return }
    setTestDetalle(null)
    await recargarTests()
  }

  async function desarchivarTest(t: any) {
    const r = await archivarTest(t.id, false)
    if (r.ok === false) { alert('No se ha podido: ' + r.error); return }
    setTestDetalle(null)
    await recargarTests()
  }

  // El buscador, el filtro por zona y la rejilla los pone `ExploradorTests`, que es el
  // mismo que usa la valoración. Estaban escritos aquí y la valoración tenía su propia
  // versión, peor; es el caso de `ExploradorEjercicios` otra vez.

  return (
    <>
      {/* Los archivados no estorban en la rejilla, pero siguen a un clic: se ven
          pidiendolos, igual que en la biblioteca de objetivos. */}
      <ExploradorTests
        tests={(testsLib||[]).filter((t:any)=>verArchivados ? t.archivado_el != null : t.archivado_el == null)}
        etiquetas={etiquetas} onAbrir={(t:any)=>setTestDetalle(t)}
        acciones={<>
          {(testsLib||[]).some((t:any)=>t.archivado_el != null) && (
            <button className={`pill ${verArchivados ? 'pill-o on' : 'pill-soft'}`}
              style={{ border:'none', cursor:'pointer' }}
              onClick={()=>setVerArchivados(v=>v===false)}>
              {(testsLib||[]).filter((t:any)=>t.archivado_el != null).length} archivados
            </button>
          )}
          <button className="btn btn-p btn-sm" onClick={()=>setModalTest(true)}>+ Nuevo test</button>
        </>}/>

      {testDetalle&&(
        <div className="modal-bg" onClick={e=>{if(e.target===e.currentTarget)setTestDetalle(null)}}>
          <div style={{background:'var(--w)',borderRadius:'var(--rl)',width:'94vw',maxWidth:820,maxHeight:'90vh',display:'flex',flexDirection:'column',boxShadow:'0 4px 32px rgba(38,40,37,.15)',overflow:'hidden'}}>
            <div style={{padding:'12px 16px',borderBottom:'1px solid var(--bd)',background:'var(--bl)',display:'flex',alignItems:'center',gap:10}}>
              <div style={{flex:1,fontSize:14,fontWeight:400,color:'var(--n)'}}>{testDetalle.nombre}</div>
              <button className="btn btn-s btn-sm" onClick={()=>{setTestEditando({...testDetalle});setModalEditarTest(true);setTestDetalle(null)}}><Ic name="editar" size={12}/> Editar</button>
              {/* La ficha NO se cierra al pulsar: se cerraba antes de que respondiera el
                  borrado, así que un borrado fallido se veía igual que uno correcto. */}
              {testDetalle.archivado_el
                ? <button className="btn btn-s btn-sm" onClick={()=>desarchivarTest(testDetalle)}><Ic name="recuperar" size={12}/> Recuperar</button>
                : <button className="btn btn-d btn-sm" title="Archivar o eliminar" onClick={()=>retirarTest(testDetalle)}><Ic name="papelera" size={12}/></button>}
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
                  {/* LO QUE HACE CADA ÍTEM, SIN ENTRAR A EDITAR.
                      Aquí solo salía el nombre del ítem, así que para saber con qué regla
                      decide o qué objetivo abre había que abrir el formulario de edición
                      —con el riesgo de tocar algo— y cerrarlo sin guardar. Revisar la
                      biblioteca es justo lo que se hace desde esta ficha. */}
                  {(testDetalle.items||[]).length>0&&(
                    <div>
                      <div style={{fontSize:9,fontWeight:600,color:'var(--grl)',letterSpacing:.4,textTransform:'uppercase',marginBottom:5}}>Ítems · {esSuma(testDetalle)?'Suma · manda el total':esBaremo(testDetalle)?'Baremo · cada ítem contra su norma':testDetalle.logica==='todos'?'Todos = positivo':'Cualquiera = positivo'}</div>
                      {(testDetalle.items||[]).map((item:any,i:number)=>{
                        const regla = textoRegla(item)
                        const objs = (item.objetivos||[]).map((id:string)=>(objetivos||[]).find((o:any)=>o.id===id)).filter(Boolean)
                        return (
                          <div key={i} style={{padding:'5px 0',borderTop:i===0?'none':'1px solid var(--bl)'}}>
                            <div style={{fontSize:11,color:'var(--n)',fontWeight:300}}>
                              {esSuma(testDetalle)||esBaremo(testDetalle)?'▤':regla?'▭':'☐'} {item.nombre}{unidadDe(item).simbolo?` · mide ${unidadDe(item).nombre.toLowerCase()}`:''}
                            </div>
                            {esBaremo(testDetalle)
                              ? (()=>{
                                  const suyas = baremosDe(testDetalle).filter((b:any)=>String(b.item||'').trim().toLowerCase()===String(item.nombre||'').trim().toLowerCase())
                                  return <div style={{fontSize:10,color:suyas.length?'var(--gd)':'var(--red)',marginTop:2}}>
                                    {suyas.length===0?'Sin baremo: este ítem no se puede interpretar':`${suyas.length} condicion${suyas.length===1?'':'es'} de baremo`}
                                  </div>
                                })()
                              : esSuma(testDetalle)
                              ? <div style={{fontSize:10,color:'var(--gd)',marginTop:2}}>Puntúa de {item.min ?? '?'} a {item.max ?? '?'}</div>
                              : regla&&(
                                <div style={{fontSize:10,color:'var(--gd)',marginTop:2}}>
                                  {regla} · barra {item.min ?? '?'} a {item.max ?? '?'}
                                </div>
                              )}
                            {/* En un test de puntuación los ítems no abren objetivos: lo
                                hace el test entero. Enseñar aquí un "Abre: ninguno" haría
                                pensar que falta engancharlos ítem a ítem. */}
                            {!esSuma(testDetalle) && !esBaremo(testDetalle) && (
                              <div style={{display:'flex',flexWrap:'wrap',gap:3,marginTop:3,alignItems:'center'}}>
                                <span style={{fontSize:9,color:'var(--grl)'}}>Abre:</span>
                                {objs.length===0
                                  ? <span style={{fontSize:9,color:'var(--grl)'}}>ningún objetivo</span>
                                  : objs.map((o:any)=>{
                                      const movId=(item.objetivos_mov||{})[o.id]
                                      const mov=movId?((etiquetas||[]).find((e:any)=>e.id===movId)?.nombre||''):''
                                      return (
                                        <span key={o.id} style={{fontSize:9,padding:'1px 8px',borderRadius:99,background:'var(--g)',color:'#fff'}}>
                                          {o.nombre}{mov?` · ${mov}`:''}
                                        </span>
                                      )
                                    })}
                              </div>
                            )}
                          </div>
                        )
                      })}
                    </div>
                  )}
                  {esBaremo(testDetalle)&&baremosDe(testDetalle).length>0&&(
                    <div style={{marginTop:12}}>
                      <div style={{fontSize:9,fontWeight:600,color:'var(--grl)',letterSpacing:.4,textTransform:'uppercase',marginBottom:5}}>
                        Baremos · {baremosDe(testDetalle).length} condiciones
                      </div>
                      <div style={{maxHeight:180,overflowY:'auto'}}>
                        {baremosDe(testDetalle).map((b:any,i:number)=>{
                          const item = (testDetalle.items||[]).find((it:any)=>String(it.nombre||'').trim().toLowerCase()===String(b.item||'').trim().toLowerCase())
                          const edad = b.edad_min!=null&&b.edad_max!=null ? `${b.edad_min}-${b.edad_max} años`
                            : b.edad_min!=null ? `${b.edad_min}+ años`
                            : b.edad_max!=null ? `hasta ${b.edad_max} años` : 'cualquier edad'
                          return (
                            <div key={i} style={{fontSize:10,color:'var(--n)',fontWeight:300,padding:'1px 0'}}>
                              {b.item} · {b.sexo||'cualquier sexo'} · {edad} · {textoNorma(b, item)||'sin norma'}
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  )}
                  {(esSuma(testDetalle)||esBaremo(testDetalle))&&(()=>{
                    const bandas = bandasDe(testDetalle)
                    const porRecuento = esBaremo(testDetalle)
                    const rango = porRecuento ? { min:0, max:(testDetalle.items||[]).length } : rangoTotal(testDetalle.items||[])
                    return (
                      <div style={{marginTop:12}}>
                        <div style={{fontSize:9,fontWeight:600,color:'var(--grl)',letterSpacing:.4,textTransform:'uppercase',marginBottom:5}}>
                          {porRecuento?'Bandas del recuento':'Bandas del total'}{rango?` · de ${rango.min} a ${rango.max}`:''}
                        </div>
                        {bandas.length===0
                          ? <div style={{fontSize:10,color:'var(--grl)'}}>Sin bandas: este test no puede dar resultado.</div>
                          : bandas.map((b,i)=>{
                              const desde = i===0 ? (rango?rango.min:'−∞') : bandas[i-1].hasta+1
                              /* Qué abre cada banda. En un test de puntuación es donde
                                 cuelga el trabajo, igual que el ítem en uno de casillas, y
                                 sin enseñarlo aquí había que entrar a editar para saberlo. */
                              const objs = (b.objetivos||[]).map((id:string)=>(objetivos||[]).find((o:any)=>o.id===id)).filter(Boolean)
                              return (
                                <div key={i} style={{padding:'2px 0'}}>
                                  <div style={{fontSize:11,color:'var(--n)',fontWeight:300,display:'flex',alignItems:'center',gap:6}}>
                                    <span style={{width:9,height:9,borderRadius:2,background:b.hallazgo?'var(--red)':'var(--g)',flexShrink:0}}/>
                                    <span style={{color:'var(--grl)',minWidth:64}}>{desde} a {b.hasta}</span>
                                    <span>{b.etiqueta||'sin nombre'}</span>
                                  </div>
                                  {b.hallazgo && (
                                    <div style={{display:'flex',flexWrap:'wrap',gap:3,margin:'2px 0 0 15px',alignItems:'center'}}>
                                      <span style={{fontSize:9,color:'var(--grl)'}}>Abre:</span>
                                      {objs.length===0
                                        ? <span style={{fontSize:9,color:'var(--red)'}}>ningún objetivo</span>
                                        : objs.map((o:any)=>{
                                            const movId=(b.objetivos_mov||{})[o.id]
                                            const mov=movId?((etiquetas||[]).find((e:any)=>e.id===movId)?.nombre||''):''
                                            return (
                                              <span key={o.id} style={{fontSize:9,padding:'1px 8px',borderRadius:99,background:'var(--g)',color:'#fff'}}>
                                                {o.nombre}{mov?` · ${mov}`:''}
                                              </span>
                                            )
                                          })}
                                    </div>
                                  )}
                                </div>
                              )
                            })}
                      </div>
                    )
                  })()}
                  {/* Los mismos problemas que impiden guardar, en los tests que ya están
                      guardados: la biblioteca se ha ido montando a mano y hay ítems de
                      antes de que existiera la validación. */}
                  {(()=>{
                    const probs = problemasDelTest(testDetalle)
                    if (probs.length===0) return null
                    return (
                      <div style={{marginTop:12,padding:'8px 10px',borderRadius:7,background:'var(--ambl)',border:'1px solid #E0C068'}}>
                        <div style={{fontSize:9,fontWeight:600,color:'#8A6410',letterSpacing:.4,textTransform:'uppercase',marginBottom:4,display:'flex',alignItems:'center',gap:5}}>
                          <Ic name="alerta" size={11}/> Este test está incompleto
                        </div>
                        {probs.map((p,i)=><div key={i} style={{fontSize:10,color:'var(--n)',fontWeight:300,lineHeight:1.5}}>· {p}</div>)}
                      </div>
                    )
                  })()}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* NUEVO TEST, en su propio archivo: el mismo formulario se abre desde aqui
          y desde el modal de un objetivo al que le falta con que medirse. */}
      {modalTest && (
        <ModalTest etiquetas={etiquetas} objetivos={objetivos}
          onCerrar={() => setModalTest(false)} onCreado={() => recargarTests()} />
      )}

      {modalEditarTest&&testEditando&&(
        <div className="modal-bg" onClick={e=>{if(e.target===e.currentTarget)setModalEditarTest(false)}}>
          <div className="modal" style={{width:'94vw',maxWidth:900,maxHeight:'90vh'}}>
            <div className="modal-title">Editar test<button className="modal-close" onClick={()=>setModalEditarTest(false)}>✕</button></div>
            {/* Misma cabecera que el de crear: imagen grande, nombre y descripción al
                lado, lados debajo. Ver el porqué en el modal de arriba. */}
            <div style={{display:'grid',gridTemplateColumns:'240px 1fr',gap:14,marginBottom:14,alignItems:'start'}}>
              <div>
                <div style={{position:'relative',width:'100%',aspectRatio:1,background:'var(--bm)',borderRadius:8,border:'1px solid var(--bd)',overflow:'hidden',display:'flex',alignItems:'center',justifyContent:'center'}}>
                  {testEditando.imagen_url
                    ? <img src={testEditando.imagen_url} alt="" style={{width:'100%',height:'100%',objectFit:'cover',display:'block'}}/>
                    : <span style={{color:'var(--grl)'}}><Ic name="test" size={40}/></span>}
                  {testEditando.imagen_url&&(
                    <button onClick={()=>setTestEditando((p:any)=>({...p,imagen_url:'',imagen_file:null}))}
                      style={{position:'absolute',top:6,right:6,width:22,height:22,borderRadius:'50%',background:'var(--red)',color:'#fff',border:'none',cursor:'pointer',fontSize:11}}>✕</button>
                  )}
                </div>
                <label style={{cursor:'pointer',display:'block',marginTop:6}}>
                  <div className="btn btn-s btn-sm" style={{width:'100%',justifyContent:'center'}}><Ic name="camara" size={12}/> Cambiar imagen</div>
                  <input type="file" accept="image/*" style={{display:'none'}}
                    onChange={e=>{const f=e.target.files?.[0];if(f)setTestEditando((p:any)=>({...p,imagen_file:f,imagen_url:URL.createObjectURL(f)}))}}/>
                </label>
                <div style={{marginTop:10}}>
                  <label style={{fontSize:10,fontWeight:600,color:'var(--grl)',letterSpacing:.4,textTransform:'uppercase'}}>¿Tiene lados?</label>
                  <div style={{display:'flex',flexDirection:'column',gap:5,marginTop:5}}>
                    {([['bilateral','Bilateral / único'],['lateral','Izquierdo / Derecho']] as const).map(([v,l])=>{
                      const act=(testEditando.tipo_lado||'bilateral')===v
                      return (
                        <div key={v} onClick={()=>setTestEditando((p:any)=>({...p,tipo_lado:v}))}
                          style={{padding:'8px',borderRadius:6,border:`1.5px solid ${act?'var(--g)':'var(--bd)'}`,background:act?'var(--gl)':'var(--w)',cursor:'pointer',textAlign:'center',fontSize:11,fontWeight:act?500:300,color:act?'var(--gd)':'var(--grl)'}}>{l}</div>
                      )
                    })}
                  </div>
                </div>
              </div>
              <div>
                <div className="field"><label>Nombre *</label><input className="input" value={testEditando.nombre||''} onChange={e=>setTestEditando((p:any)=>({...p,nombre:e.target.value}))}/></div>
                <div className="field"><label>Descripción</label><textarea className="input" value={testEditando.descripcion||''} onChange={e=>setTestEditando((p:any)=>({...p,descripcion:e.target.value}))} style={{minHeight:200,lineHeight:1.6}}/></div>
              </div>
            </div>
            <div className="field"><label>Enlace vídeo</label><input className="input" value={testEditando.video_url||''} onChange={e=>setTestEditando((p:any)=>({...p,video_url:e.target.value}))}/></div>
            <div className="g2">
              <div className="field"><label>Revisión (meses)</label><input className="input" type="number" value={testEditando.frecuencia_meses||3} onChange={e=>setTestEditando((p:any)=>({...p,frecuencia_meses:parseInt(e.target.value)||3}))}/></div>
              <div className="field"><label>Se resuelve por</label>
                <select className="input" value={testEditando.logica||'cualquiera'} onChange={e=>setTestEditando((p:any)=>({...p,logica:e.target.value}))}>
                  <option value="cualquiera">Positivo si algún ítem está marcado</option>
                  <option value="todos">Positivo si todos los ítems están marcados</option>
                  <option value="suma">Puntuación · manda el total</option>
                  <option value="baremo">Baremo · cada ítem contra su norma</option>
                </select>
              </div>
            </div>
            <div className="field">
              <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:6}}>
                <label style={{margin:0}}>Ítems</label>
              </div>
              {esSuma(testEditando) && (
                <div style={{fontSize:11,color:'var(--gr)',marginBottom:7,lineHeight:1.5}}>
                  Cada ítem aporta su puntuación y el total cae en una banda. Los objetivos no
                  cuelgan de los ítems —un ítem suelto no significa nada— sino del test entero:
                  se enganchan desde la biblioteca de objetivos.
                </div>
              )}
              {esBaremo(testEditando) && (
                <div style={{fontSize:11,color:'var(--gr)',marginBottom:7,lineHeight:1.5}}>
                  Cada ítem se compara con su norma según el sexo y la edad del paciente, que ya
                  están en su ficha. Lo que cae en una banda es CUÁNTOS ítems quedan por debajo,
                  no la suma.
                </div>
              )}
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
                  {!esBaremo(testEditando) && <ConfigBarra item={item} soloRango={esSuma(testEditando)} onCambia={(campos:any)=>{
                    const its=[...(testEditando.items||[])] as any[]; its[i]={...its[i],...campos}
                    setTestEditando((p:any)=>({...p,items:its}))
                  }}/>}
                  {/* AQUI SE COLGABAN OBJETIVOS DE CADA ITEM. Se ha quitado: el
                      enlace entre test y objetivo se decide desde el objetivo, en
                      Biblioteca -> Objetivos, y dos sitios para la misma decision
                      acaban contradiciendose. Lo ya guardado en `objetivos` y
                      `objetivos_mov` de cada item sigue ahi y lo sigue usando el
                      motor: solo deja de editarse aqui. */}
                </div>
              ))}
              <button className="btn btn-t btn-sm" onClick={()=>setTestEditando((p:any)=>({...p,items:[...(p.items||[]),{nombre:'',unidad:esSuma(p)?'puntos':''}]}))}>+ Añadir ítem</button>
            </div>
            {esBaremo(testEditando) && (
              <EditorBaremos baremos={testEditando.baremos} items={testEditando.items||[]}
                onCambia={(b:any[])=>setTestEditando((p:any)=>({...p,baremos:b}))}/>
            )}
            {(esSuma(testEditando)||esBaremo(testEditando)) && (
              <EditorBandas bandas={testEditando.bandas} items={testEditando.items||[]} porRecuento={esBaremo(testEditando)}
                objetivos={objetivos} etiquetas={etiquetas}
                onCambia={(b:any[])=>setTestEditando((p:any)=>({...p,bandas:b}))}/>
            )}
            <div className="field">
              <label>Zona <span className="subt">· por dónde se encuentra en la biblioteca</span></label>
              <div style={{marginTop:5}}><SelectorZona etiquetas={etiquetas} seleccionadas={testEditando.etiquetas_relacionadas||[]} onChange={(ids:string[])=>setTestEditando((p:any)=>({...p,etiquetas_relacionadas:ids}))}/></div>
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
