'use client'
import { useState } from 'react'
import FiltroCuerpo from '@/components/FiltroCuerpo'
import { conDescendientes } from '@/lib/etiquetas'
import { Ic } from '@/lib/icons'
import ExploradorTests from '@/components/ExploradorTests'
import ModalRealizarTest, { ladoVacio } from '@/components/ModalRealizarTest'

/**
 * Paso 4: qué tests se le pasan y qué sale.
 *
 * Dos pantallas grandes en vez de una apretada. ELEGIR es un explorador a pantalla
 * completa —`ExploradorTests`, el mismo de la biblioteca— y PASAR el test es su ficha
 * de la biblioteca con los ítems convertidos en casillas —`ModalRealizarTest`—. Lo que
 * queda aquí es solo la lista de lo que llevas, que es lo único que hay que ver de un
 * vistazo mientras se trabaja.
 */
export default function PasoTests({ testsLib, etiquetasLib=[], testsValoracion, setTestsValoracion, testActivo, setTestActivo, paciente }: any) {
  const [abierto, setAbierto] = useState(false)
  const [seleccion, setSeleccion] = useState<string[]>([])

  const NOMBRE_LADO:Record<string,string> = {bilateral:'Bilateral',izquierdo:'Izquierdo',derecho:'Derecho'}

  /** La ficha vacía de un test recién añadido. */
  function nuevoTv(t:any){
    // Lateral entra SIN lado: elegirlo es parte de pasar el test, no algo que decida la
    // app. Igual que en la ficha del paciente, para que no haya dos comportamientos.
    const ladoIni = t.tipo_lado==='lateral' ? '' : 'bilateral'
    return { test_id:t.id, nombre:t.nombre, logica:t.logica, ladoActivo:ladoIni,
      frecuencia_meses:t.frecuencia_meses||3, lados: ladoIni ? { [ladoIni]: ladoVacio(t) } : {} }
  }

  function confirmarSeleccion(){
    const nuevos = seleccion.map((id:string)=>testsLib.find((t:any)=>t.id===id)).filter(Boolean).map(nuevoTv)
    if (nuevos.length) {
      const desde = testsValoracion.length
      setTestsValoracion((prev:any[])=>[...prev,...nuevos])
      // Se abre el primero de los añadidos: lo siguiente que vas a hacer es pasarlo.
      setTestActivo(desde)
    }
    setSeleccion([]); setAbierto(false)
  }

  /** Qué lados tienen resultado, para la fila. */
  function resumenLados(tv:any){
    const r:string[]=[]
    Object.keys(tv.lados||{}).forEach((k)=>{
      const d = tv.lados?.[k]
      if (d && d.resultado && d.resultado!=='sin_realizar') r.push(`${NOMBRE_LADO[k]||k}: ${d.resultado==='positivo'?'positivo':'negativo'}`)
    })
    return r
  }

  const yaAnadidos = testsValoracion.map((tv:any)=>tv.test_id)

  /* ELEGIR POR EL CUERPO, CON EL MUÑECO 3D de toda la app (FiltroCuerpo). Antes era un
     dibujo plano delante/detrás con zonas propias, distinto del resto. Se marcan zonas,
     músculos o lo que haga falta y salen sus tests, cada uno con su imagen: con solo el
     nombre no se sabía cuál era cuál. */
  const [filtroEt, setFiltroEt] = useState<string[]>([])
  const [verCuerpo, setVerCuerpo] = useState(false)
  const [porZona, setPorZona] = useState<string[]>([])
  const casaEt = (t:any) => filtroEt.every(id => { const rama = conDescendientes(etiquetasLib||[], id); return (t.etiquetas_relacionadas||[]).some((x:string)=>rama.includes(x)) })
  const deZonas = filtroEt.length===0 ? [] : (testsLib||[]).filter(casaEt)
    .sort((a:any,b:any)=>String(a.nombre).localeCompare(String(b.nombre)))
  const nombreEt = (id:string) => (etiquetasLib||[]).find((e:any)=>e.id===id)?.nombre || '?'
  function anadirDeZonas(){
    const nuevos = porZona.filter(id=>!yaAnadidos.includes(id)).map(id=>(testsLib||[]).find((t:any)=>t.id===id)).filter(Boolean).map(nuevoTv)
    if (nuevos.length) { const desde = testsValoracion.length; setTestsValoracion((prev:any[])=>[...prev,...nuevos]); setTestActivo(desde) }
    setPorZona([])
  }
  const tvActivo = testActivo!=null ? testsValoracion[testActivo] : null
  const testActivoLib = tvActivo ? testsLib.find((t:any)=>t.id===tvActivo.test_id) : null

  return (
    <div>
      <div className="card">
        <div style={{display:'flex',alignItems:'center',gap:12,flexWrap:'wrap',marginBottom:filtroEt.length?10:0}}>
          <div style={{flex:1,minWidth:200}}>
            <div className="card-title" style={{marginBottom:3}}>¿Qué vas a testear?</div>
            <div style={{fontSize:12.5,color:'var(--grl)',lineHeight:1.5}}>Marca en el cuerpo las zonas y salen sus tests.</div>
          </div>
          <button type="button" className={`chip-sel ${filtroEt.length ? 'on' : ''}`} onClick={()=>setVerCuerpo(true)}>
            Cuerpo 3D{filtroEt.length ? ` · ${filtroEt.length}` : ''}</button>
        </div>
        {filtroEt.length>0 && (
          <div style={{display:'flex',gap:5,flexWrap:'wrap',marginBottom:10}}>
            {filtroEt.map(id=><span key={id} className="chip-sel on" style={{fontSize:12}} onClick={()=>setFiltroEt(l=>l.filter(x=>x!==id))}>{nombreEt(id)} ✕</span>)}
          </div>
        )}
        {filtroEt.length===0 ? null : deZonas.length===0 ? (
          <div style={{fontSize:12.5,color:'var(--grl)'}}>No hay tests etiquetados con eso. Búscalos con «Añadir tests».</div>
        ) : (<>
          {/* CON SU IMAGEN: el test se reconoce por la foto, no por el nombre. */}
          <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(120px,1fr))',gap:8,maxHeight:420,overflowY:'auto'}}>
            {deZonas.map((t:any)=>{
              const ya = yaAnadidos.includes(t.id), on = porZona.includes(t.id)
              return (
                <button key={t.id} type="button" disabled={ya} title={t.descripcion || t.nombre}
                  onClick={()=>setPorZona(l=>on?l.filter(x=>x!==t.id):[...l,t.id])}
                  style={{position:'relative',textAlign:'center',fontFamily:'inherit',padding:0,borderRadius:12,overflow:'hidden',cursor:ya?'default':'pointer',
                    border:`${on?2:1}px solid ${on?'var(--g)':'var(--bd)'}`,background:'var(--w)',opacity:ya?.5:1}}>
                  <div style={{aspectRatio:'1 / 1',background:'var(--bl)',display:'flex',alignItems:'center',justifyContent:'center',color:'var(--grl)'}}>
                    {t.imagen_url
                      ? <img src={t.imagen_url} alt={t.nombre} style={{width:'100%',height:'100%',objectFit:'cover',display:'block'}}/>
                      : <Ic name="test" size={26}/>}
                  </div>
                  {(on||ya) && (
                    <span style={{position:'absolute',top:5,right:5,background:ya?'var(--gr)':'var(--g)',color:'#fff',borderRadius:99,fontSize:9,
                      padding:ya?'2px 7px':4,display:'inline-flex',alignItems:'center'}}>{ya?'Ya añadido':<Ic name="check" size={12}/>}</span>
                  )}
                  <div style={{fontSize:12,color:'var(--n)',padding:'6px 7px',lineHeight:1.3}}>{t.nombre}</div>
                </button>
              )
            })}
          </div>
          <button className="btn btn-p" style={{marginTop:10}} disabled={porZona.length===0} onClick={anadirDeZonas}>
            <Ic name="mas" size={13}/> Añadir {porZona.length||''} test{porZona.length===1?'':'s'}
          </button>
        </>)}
      </div>
      {verCuerpo && <FiltroCuerpo etiquetas={etiquetasLib||[]} valor={filtroEt} onChange={setFiltroEt} titulo="¿Qué vas a testear?"
        textoCerrar="Ver tests" nResultado={filtroEt.length ? deZonas.length : (testsLib||[]).length} unidad={['test','tests']} onCerrar={()=>setVerCuerpo(false)}/>}

      {testsValoracion.length===0 && (
        <div style={{background:'var(--bl)',border:'1.5px dashed var(--bm)',borderRadius:'var(--rl)',padding:'30px 20px',textAlign:'center',marginBottom:8}}>
          <div style={{color:'var(--grl)',marginBottom:10}}><Ic name="test" size={28}/></div>
          <div style={{fontSize:13,color:'var(--n)',marginBottom:4}}>Todavía no hay tests en esta valoración</div>
          <div style={{fontSize:12,color:'var(--grl)',marginBottom:14}}>Búscalos por zona o por el nombre de la maniobra.</div>
          <button className="btn btn-p" onClick={()=>setAbierto(true)}><Ic name="mas" size={13}/> Añadir tests</button>
        </div>
      )}

      {testsValoracion.map((tv:any,ti:number)=>{
        const testLib = testsLib.find((t:any)=>t.id===tv.test_id)
        const resumen = resumenLados(tv)
        const positivo = Object.values(tv.lados||{}).some((d:any)=>d?.resultado==='positivo')
        return (
          <div key={ti} style={{display:'flex',alignItems:'center',gap:12,background:'var(--w)',border:'1px solid var(--bd)',borderLeft:`3px solid ${resumen.length===0?'var(--bm)':positivo?'var(--red)':'var(--g)'}`,borderRadius:'var(--rl)',padding:'11px 14px',marginBottom:7}}>
            {testLib?.imagen_url
              ? <img src={testLib.imagen_url} alt={tv.nombre} style={{width:46,height:46,objectFit:'contain',background:'var(--bm)',borderRadius:6,flexShrink:0}}/>
              : <div style={{width:46,height:46,borderRadius:6,background:'var(--bl)',display:'flex',alignItems:'center',justifyContent:'center',color:'var(--grl)',flexShrink:0}}><Ic name="test" size={20}/></div>}
            <div style={{flex:1,minWidth:0}}>
              <div style={{fontSize:14,color:'var(--n)'}}>{tv.nombre}</div>
              {/* De dónde sale este test cuando no lo has añadido tú. El dato de entonces
                  se enseña, pero no se rellena: el resultado de hoy se marca hoy. */}
              {tv.previo && (
                <div style={{fontSize:11,color:'var(--red)',marginTop:2,display:'flex',alignItems:'center',gap:4}}>
                  <Ic name="alerta" size={11}/> Positivo el {new Date(tv.previo.fecha+'T12:00:00').toLocaleDateString('es-ES',{day:'numeric',month:'short',year:'numeric'})}{tv.previo.lado&&tv.previo.lado!=='bilateral'?' · '+tv.previo.lado:''} · sigue abierto
                </div>
              )}
              <div style={{fontSize:12,color:resumen.length?'var(--gr)':'var(--grl)',marginTop:2}}>
                {resumen.length>0 ? resumen.join(' · ') : 'Sin pasar todavía'}
              </div>
            </div>
            <button className="btn btn-s btn-sm" onClick={()=>setTestActivo(ti)}>
              <Ic name={resumen.length?'editar':'test'} size={12}/> {resumen.length?'Revisar':'Realizar'}
            </button>
            <button onClick={()=>setTestsValoracion((prev:any[])=>prev.filter((_:any,i:number)=>i!==ti))}
              title="Quitar de la valoración"
              style={{fontSize:13,color:'var(--red)',background:'none',border:'none',cursor:'pointer',padding:'2px 5px'}}>✕</button>
          </div>
        )
      })}

      {testsValoracion.length>0 && (
        <button className="btn btn-s" style={{width:'100%',justifyContent:'center',padding:'11px'}} onClick={()=>setAbierto(true)}>
          <Ic name="mas" size={13}/> Añadir más tests
        </button>
      )}

      {/* PASAR EL TEST */}
      {tvActivo && (
        <ModalRealizarTest
          test={testActivoLib || { nombre: tvActivo.nombre, logica: tvActivo.logica }}
          tv={tvActivo}
          paciente={paciente}
          onCambiar={(nuevo:any)=>setTestsValoracion((prev:any[])=>prev.map((x:any,i:number)=>i===testActivo?nuevo:x))}
          onCerrar={()=>setTestActivo(null)}/>
      )}

      {/* ELEGIR TESTS · a pantalla completa, que es donde caben */}
      {abierto && (
        <div style={{position:'fixed',inset:0,zIndex:200,background:'var(--w)',display:'flex',flexDirection:'column'}}>
          <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',padding:'12px 18px',borderBottom:'1px solid var(--bd)',flexShrink:0}}>
            <div style={{fontSize:15,fontWeight:500,color:'var(--n)'}}>Añadir tests a la valoración</div>
            <button className="modal-close" onClick={()=>{setSeleccion([]);setAbierto(false)}}><Ic name="cerrar" size={18}/></button>
          </div>
          <div style={{flex:1,minHeight:0,overflowY:'auto',padding:'14px 18px'}}>
            <ExploradorTests
              tests={testsLib} etiquetas={etiquetasLib} autoFocus
              seleccion={seleccion} yaAnadidos={yaAnadidos}
              onAlternar={(t:any)=>setSeleccion(prev=>prev.includes(t.id)?prev.filter(x=>x!==t.id):[...prev,t.id])}/>
          </div>
          <div style={{display:'flex',gap:10,justifyContent:'space-between',alignItems:'center',padding:'12px 18px',borderTop:'1px solid var(--bd)',flexShrink:0}}>
            <span style={{fontSize:12,color:'var(--grl)'}}>
              {seleccion.length===0 ? 'Pulsa los tests que vas a pasar' : `${seleccion.length} seleccionado${seleccion.length>1?'s':''}`}
            </span>
            <div style={{display:'flex',gap:10}}>
              <button className="btn btn-d" onClick={()=>{setSeleccion([]);setAbierto(false)}}>Cancelar</button>
              <button className="btn btn-p" onClick={confirmarSeleccion} disabled={seleccion.length===0}>
                Añadir {seleccion.length>0?seleccion.length:''}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
