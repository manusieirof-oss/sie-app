'use client'
import { useState } from 'react'
import { supabase } from '@/lib/supabase'
import { Ic } from '@/lib/icons'
import { UNIDADES, unidadDe, mide, textoRegla, problemasDelTest, esSuma, esBaremo, bandasDe, baremosDe, rangoTotal, textoNorma } from '@/lib/tests'
import SelectorEtiquetasCompacto from '@/components/SelectorEtiquetasCompacto'
import { ConfigBarra, EditorBandas, SelectorZona, EditorBaremos } from './EditoresTest'

// ---------------------------------------------------------------------------
// NUEVO TEST
//
// Estaba dentro de TestsTab y solo se podia abrir desde la biblioteca. Al
// exigir que todo objetivo tenga con que medirse, hacia falta poder crear el
// test que falta sin salir del objetivo a medio escribir —y dos formularios
// para lo mismo acabarian diciendo cosas distintas—.
//
// No crea la fila y ya esta: devuelve el test creado, para que quien lo haya
// pedido lo enganche donde lo necesitaba.
// ---------------------------------------------------------------------------

export default function ModalTest({ etiquetas = [], objetivos = [], z, onCerrar, onCreado }: {
  etiquetas?: any[]
  objetivos?: any[]
  /** Por encima de otro modal: abierto desde dentro de uno, si no se pinta debajo. */
  z?: number
  onCerrar: () => void
  /** El test recien creado, entero. */
  onCreado: (test: any) => void
}) {
  const [nuevoTest, setNuevoTest] = useState({ nombre:'', descripcion:'', frecuencia_meses:3, video_url:'', imagen_url:'', imagen_file:null as File|null, items:[] as any[], logica:'cualquiera', bandas:[] as any[], baremos:[] as any[], etiquetas_relacionadas:[] as string[], etiquetas_bloquea:[] as string[], tipo_lado:'bilateral' })
  const [subiendoImgTest, setSubiendoImgTest] = useState(false)

  /** Sube la imagen y devuelve su URL publica, o el motivo por el que no ha podido. */
  async function subirImagenTest(testId: string, file: File): Promise<{ url: string } | { error: string }> {
    const ext = file.name.split('.').pop()
    const path = `tests/${testId}/foto.${ext}`
    const { error } = await supabase.storage.from('fotos').upload(path, file, { upsert: true })
    if (error) return { error: error.message }
    const { data: { publicUrl } } = supabase.storage.from('fotos').getPublicUrl(path)
    return { url: publicUrl }
  }

  /** Las reglas estan en `lib/tests.ts`; aqui solo se ensenan. true = no se guarda. */
  function bloqueadoPorProblemas(test: any): boolean {
    const p = problemasDelTest(test)
    if (p.length === 0) return false
    alert('El test no se ha guardado:\n\n' + p.map(x => '\u00b7 ' + x).join('\n'))
    return true
  }

  async function crearTest() {
    if (bloqueadoPorProblemas(nuevoTest)) return
    setSubiendoImgTest(true)
    const { data: t, error } = await supabase.from('tests').insert({ nombre:nuevoTest.nombre, descripcion:nuevoTest.descripcion, frecuencia_meses:nuevoTest.frecuencia_meses, video_url:nuevoTest.video_url, items:nuevoTest.items, logica:nuevoTest.logica, bandas:(esSuma(nuevoTest)||esBaremo(nuevoTest))?(nuevoTest.bandas||[]):[], baremos:esBaremo(nuevoTest)?(nuevoTest.baremos||[]):[], etiquetas_relacionadas:nuevoTest.etiquetas_relacionadas||[], etiquetas_bloquea:nuevoTest.etiquetas_bloquea||[], tipo_lado:nuevoTest.tipo_lado, imagen_url:'' }).select().single()
    if (error || t == null) {
      setSubiendoImgTest(false)
      alert('No se ha podido crear el test: ' + (error?.message || 'la base de datos no ha devuelto la fila creada.'))
      return
    }
    // La imagen falla aparte y no invalida el test: se avisa, pero despues de
    // cerrar, para que no parezca que no se ha guardado nada.
    let avisoImagen = ''
    let imagenUrl = ''
    if (nuevoTest.imagen_file) {
      const r = await subirImagenTest(t.id, nuevoTest.imagen_file)
      if ('error' in r) avisoImagen = r.error
      else {
        imagenUrl = r.url
        const { error: errUrl } = await supabase.from('tests').update({ imagen_url: r.url }).eq('id', t.id)
        if (errUrl) avisoImagen = errUrl.message
      }
    }
    setSubiendoImgTest(false)
    onCreado({ ...t, imagen_url: imagenUrl || t.imagen_url })
    onCerrar()
    if (avisoImagen) alert('El test se ha creado, pero la imagen no se ha subido: ' + avisoImagen + '\n\nVuelve a subirla desde Editar.')
  }

  return (
        <div className="modal-bg" style={z ? { zIndex: z } : undefined} onClick={e=>{if(e.target===e.currentTarget)onCerrar()}}>
          <div className="modal" style={{width:'94vw',maxWidth:900,maxHeight:'90vh'}}>
            <div className="modal-title">Nuevo test<button className="modal-close" onClick={()=>onCerrar()}>✕</button></div>
            {/* CABECERA: LA IMAGEN MANDA.
                Un test se reconoce por la foto de la posición, no por su nombre: "Lunge de
                tobillo · con alza bajo el talón" no dice cómo se coloca al paciente. Antes
                la imagen era un cuadrado de 80 px perdido a mitad del formulario, debajo de
                cuatro campos de texto. Ahora abre el modal, y los LADOS van justo debajo
                porque son parte del montaje: dónde se pone el paciente y de qué lado. */}
            <div style={{display:'grid',gridTemplateColumns:'240px 1fr',gap:14,marginBottom:14,alignItems:'start'}}>
              <div>
                <div style={{position:'relative',width:'100%',aspectRatio:1,background:'var(--bm)',borderRadius:8,border:'1px solid var(--bd)',overflow:'hidden',display:'flex',alignItems:'center',justifyContent:'center'}}>
                  {nuevoTest.imagen_url
                    ? <img src={nuevoTest.imagen_url} alt="" style={{width:'100%',height:'100%',objectFit:'cover',display:'block'}}/>
                    : <span style={{color:'var(--grl)'}}><Ic name="test" size={40}/></span>}
                  {nuevoTest.imagen_url&&(
                    <button onClick={()=>setNuevoTest(p=>({...p,imagen_url:'',imagen_file:null}))}
                      style={{position:'absolute',top:6,right:6,width:22,height:22,borderRadius:'50%',background:'var(--red)',color:'#fff',border:'none',cursor:'pointer',fontSize:11}}>✕</button>
                  )}
                </div>
                <label style={{cursor:'pointer',display:'block',marginTop:6}}>
                  <div className="btn btn-s btn-sm" style={{width:'100%',justifyContent:'center'}}><Ic name="camara" size={12}/> Subir imagen</div>
                  <input type="file" accept="image/*" style={{display:'none'}}
                    onChange={e=>{const f=e.target.files?.[0];if(f)setNuevoTest(p=>({...p,imagen_file:f,imagen_url:URL.createObjectURL(f)}))}}/>
                </label>
                <div style={{marginTop:10}}>
                  <label style={{fontSize:10,fontWeight:600,color:'var(--grl)',letterSpacing:.4,textTransform:'uppercase'}}>¿Tiene lados?</label>
                  <div style={{display:'flex',flexDirection:'column',gap:5,marginTop:5}}>
                    {([['bilateral','Bilateral / único'],['lateral','Izquierdo / Derecho']] as const).map(([v,l])=>(
                      <div key={v} onClick={()=>setNuevoTest(p=>({...p,tipo_lado:v}))}
                        style={{padding:'8px',borderRadius:6,border:`1.5px solid ${nuevoTest.tipo_lado===v?'var(--g)':'var(--bd)'}`,background:nuevoTest.tipo_lado===v?'var(--gl)':'var(--w)',cursor:'pointer',textAlign:'center',fontSize:11,fontWeight:nuevoTest.tipo_lado===v?500:300,color:nuevoTest.tipo_lado===v?'var(--gd)':'var(--grl)'}}>{l}</div>
                    ))}
                  </div>
                </div>
              </div>
              <div>
                <div className="field"><label>Nombre *</label><input className="input" value={nuevoTest.nombre} onChange={e=>setNuevoTest(p=>({...p,nombre:e.target.value}))} autoFocus/></div>
                <div className="field"><label>Descripción</label><textarea className="input" value={nuevoTest.descripcion} onChange={e=>setNuevoTest(p=>({...p,descripcion:e.target.value}))} style={{minHeight:200,lineHeight:1.6}}/></div>
              </div>
            </div>
            <div className="g2">
              <div className="field"><label>Enlace vídeo</label><input className="input" value={nuevoTest.video_url} onChange={e=>setNuevoTest(p=>({...p,video_url:e.target.value}))}/></div>
              <div className="field"><label>Frecuencia revisión</label>
                <select className="input" value={nuevoTest.frecuencia_meses} onChange={e=>setNuevoTest(p=>({...p,frecuencia_meses:parseInt(e.target.value)}))}>
                  {[1,2,3,6,12].map(m=><option key={m} value={m}>{m} {m===1?'mes':'meses'}</option>)}
                </select>
              </div>
            </div>
            <div className="field">
              <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:6}}>
                <label style={{margin:0}}>Ítems</label>
                {/* CÓMO SE RESUELVE EL TEST. 'suma' no es una lógica más: es otro tipo de
                    test —el veredicto sale del total y no de los ítems— y por eso cambia
                    lo que se pide debajo. La regla está en `lib/tests.ts`. */}
                <select style={{fontSize:9,padding:'2px 6px',border:'1px solid var(--bd)',borderRadius:3,background:'var(--bl)',fontFamily:'system-ui'}} value={nuevoTest.logica} onChange={e=>setNuevoTest(p=>({...p,logica:e.target.value}))}>
                  <option value="cualquiera">Cualquier ítem = positivo</option>
                  <option value="todos">Todos los ítems = positivo</option>
                  <option value="suma">Puntuación · manda el total</option>
                  <option value="baremo">Baremo · cada ítem contra su norma</option>
                </select>
              </div>
              {esSuma(nuevoTest) && (
                <div style={{fontSize:11,color:'var(--gr)',marginBottom:7,lineHeight:1.5}}>
                  Cada ítem aporta su puntuación y el total cae en una banda. Los objetivos no
                  cuelgan de los ítems —un ítem suelto no significa nada— sino del test entero:
                  se enganchan desde la biblioteca de objetivos.
                </div>
              )}
              {esBaremo(nuevoTest) && (
                <div style={{fontSize:11,color:'var(--gr)',marginBottom:7,lineHeight:1.5}}>
                  Cada ítem se compara con su norma según el sexo y la edad del paciente, que ya
                  están en su ficha. Lo que cae en una banda es CUÁNTOS ítems quedan por debajo,
                  no la suma: sumar segundos con repeticiones no daría un número con sentido.
                </div>
              )}
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
                  {/* En baremo el ítem no lleva ni regla ni rango propios: el umbral lo
                      pone la tabla de normas, que depende del paciente. */}
                  {!esBaremo(nuevoTest) && <ConfigBarra item={item} soloRango={esSuma(nuevoTest)} onCambia={(campos:any)=>{
                    const its=[...nuevoTest.items] as any[]; its[i]={...its[i],...campos}
                    setNuevoTest(p=>({...p,items:its}))
                  }}/>}
                  {/* AQUI SE COLGABAN OBJETIVOS DE CADA ITEM. Se ha quitado: el
                      enlace entre test y objetivo se decide desde el objetivo, en
                      Biblioteca -> Objetivos, y dos sitios para la misma decision
                      acaban contradiciendose. Lo ya guardado en `objetivos` y
                      `objetivos_mov` de cada item sigue ahi y lo sigue usando el
                      motor: solo deja de editarse aqui. */}
                </div>
              ))}
              {/* Un ítem de test de puntuación nace ya midiendo puntos: es lo único que
                  puede ser, y dejarlo en "sin medida" solo daba un aviso de validación. */}
              <button className="btn btn-t btn-sm" onClick={()=>setNuevoTest(p=>({...p,items:[...p.items,{nombre:'',unidad:esSuma(p)?'puntos':''}]}))}>+ Añadir ítem</button>
            </div>
            {esBaremo(nuevoTest) && (
              <EditorBaremos baremos={nuevoTest.baremos} items={nuevoTest.items}
                onCambia={(b:any[])=>setNuevoTest(p=>({...p,baremos:b}))}/>
            )}
            {(esSuma(nuevoTest)||esBaremo(nuevoTest)) && (
              <EditorBandas bandas={nuevoTest.bandas} items={nuevoTest.items} porRecuento={esBaremo(nuevoTest)}
                objetivos={objetivos} etiquetas={etiquetas}
                onCambia={(b:any[])=>setNuevoTest(p=>({...p,bandas:b}))}/>
            )}
            <div className="field">
              <label>Zona <span className="subt">· por dónde se encuentra en la biblioteca</span></label>
              <div style={{marginTop:5}}><SelectorZona etiquetas={etiquetas} seleccionadas={nuevoTest.etiquetas_relacionadas||[]} onChange={(ids:string[])=>setNuevoTest(p=>({...p,etiquetas_relacionadas:ids}))}/></div>
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
              <button className="btn btn-d btn-sm" onClick={()=>onCerrar()}>Cancelar</button>
              <div style={{flex:1}}/>
              <button className="btn btn-p" onClick={crearTest} disabled={subiendoImgTest}>{subiendoImgTest?'…':<><Ic name="guardar" size={13}/> Guardar</>}</button>
            </div>
          </div>
        </div>
  )
}
