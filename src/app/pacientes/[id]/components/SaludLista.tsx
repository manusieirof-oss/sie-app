'use client'
import { useState, useEffect, useRef } from 'react'
import CuerpoZonas, { type ColorZona } from '@/components/CuerpoZonas'
import { ZONAS_CUERPO, zonasDeTest } from '@/lib/zonasCuerpo'
import { supabase } from '@/lib/supabase'
import { Ic } from '@/lib/icons'
import Silueta, { MarcaCuerpo } from './Silueta'
import BuscadorBiblioteca from '@/components/BuscadorBiblioteca'
import Sparkline from './Sparkline'
import Documentos from './Documentos'
import { textoMedida } from '@/lib/tests'
import { anadirALista, quitarDeLista, type ListaClinica } from '@/lib/listasPaciente'
import EscalaSlider, { textoEscala } from '@/components/EscalaSlider'
import ModalItemClinico, { type ConfigItemClinico } from '@/components/ModalItemClinico'
import { hoyISO } from '@/lib/fechas'
import SaludRegistrosTest from './SaludRegistrosTest'
import SaludDetalle from './SaludDetalle'

// Trozo de pantalla sacado de SaludTab.tsx tal cual (misma logica, mismos datos):
// el archivo grande se queda con el estado y este solo pinta. Lo que necesita le llega
// por props desde alli.
export default function SaludLista(p: any) {
  const { LBL_EST_PAT, LBL_TIPO_MOL, abrirTest, addAlergia, addDeporte, addIntolerancia, alergias, algBiblio, borrarClinico, cambiarEstadoPatologia, cap, colorBienestar, colorEstres, delAlergia, delDeporte, delIntolerancia, delMedicamento, delOperacion, depBiblio, deportesPac, escalas, etiquetasLib, gruposTests, guardado, guardandoSalud, id, intolBiblio, intolerancias, medicamentos, medsBiblio, molActivas, molResueltas, molsBiblio, onNuevoTest, operaciones, opsBiblio, patActivas, patResueltas, patologias, patsBiblio, plantBiblio, plantDer, plantIzq, setAlgBiblio, setAltaClinica, setDetalle, setEscalaConfig, setIntolBiblio, setMedConfig, setMedsBiblio, setMolConfig, setMolsBiblio, setNDocs, setOpConfig, setOpsBiblio, setPatConfig, setPatsBiblio, setPlantDer, setPlantIzq, setRegistrosDe, setUsaPlantillas, setZonaTest, tests, testsLib, tocado, toggleMolestia, usaPlantillas, vista, zonaTest } = p
  return (<>{vista==='lista' && (
      <div className="panel">

        {/* 1. QUÉ LE PASA */}
        <div className="sec">
          <div className="sec-h"><span className="ct-l"><Ic name="patologia" size={13}/> Problemas</span></div>
          {/* Las operaciones van aquí y no en Contexto: una prótesis o un ligamento
              reconstruido condiciona la carga igual que una patología activa. */}
          <div className="g3">
            <div>
              <div className="sec-sub">Molestias y dolores</div>
              <BuscadorBiblioteca items={molsBiblio} placeholder="Buscar para añadir... ej. lumbar, rodilla"
                buscarEn={(m:any)=>[m.nombre,m.zona]} subtitulo={(m:any)=>m.zona} etiquetaNuevo="Añadir"
                onElegir={(m:any)=>setMolConfig({nombre:m.nombre,zona:m.zona||m.nombre,biblioteca_id:m.id,tipo:'molestia',eva:5,lado:'bilateral',cuando:'Al moverse',observaciones:''})}
                onNuevo={(t:string)=>setAltaClinica({config:{tabla:'molestias_biblioteca',tipo:'molestia',campoGrupo:'zona'},valor:{nombre:t},luego:(f:any)=>{setMolsBiblio((p: any)=>[...p,f]);setMolConfig({nombre:f.nombre,zona:f.zona||f.nombre,biblioteca_id:f.id,tipo:'molestia',eva:5,lado:'bilateral',cuando:'Al moverse',observaciones:''})}})}/>
              {molActivas.length===0 && <div className="muted">Sin molestias activas</div>}
              {molActivas.map((m:any)=>(
                <div key={m.id} className="fila-p" style={{borderLeftColor:'var(--red)'}}>
                  <div style={{flex:1,cursor:'pointer'}} onClick={()=>setDetalle({tipo:'molestia',datos:m})}>
                    <div style={{fontSize:13,color:'var(--n)'}}>{m.zona}</div>
                    <div style={{fontSize:12,color:'var(--gr)',marginTop:1}}>{m.eva==null?'Sin EVA':`EVA ${m.eva}/10`} · {LBL_TIPO_MOL[m.tipo]||m.tipo?.replace('_',' ')}</div>
                  </div>
                  <button className="btn btn-t btn-sm" onClick={()=>toggleMolestia(m.id,m.activa)}>Resolver</button>
                  <button className="fila-x" title="Se apuntó por error · borrar"
                    onClick={()=>borrarClinico('molestias', m, m.zona)}><Ic name="papelera" size={13}/></button>
                </div>
              ))}
              {molResueltas.length>0 && (
                <details style={{marginTop:8}}>
                  <summary className="det-sum">{molResueltas.length} resuelta{molResueltas.length>1?'s':''}</summary>
                  {molResueltas.map((m:any)=>(
                    <div key={m.id} className="fila-p" style={{borderLeftColor:'var(--gm)'}}>
                      <div style={{flex:1,cursor:'pointer'}} onClick={()=>setDetalle({tipo:'molestia',datos:m})}>
                        <div style={{fontSize:13,color:'var(--gr)'}}>{m.zona}</div>
                      </div>
                      <button className="btn btn-t btn-sm" onClick={()=>toggleMolestia(m.id,m.activa)}>Reactivar</button>
                      <button className="fila-x" title="Se apuntó por error · borrar"
                        onClick={()=>borrarClinico('molestias', m, m.zona)}><Ic name="papelera" size={13}/></button>
                    </div>
                  ))}
                </details>
              )}
            </div>

            <div>
              <div className="sec-sub">Patologías</div>
              <BuscadorBiblioteca items={patsBiblio} placeholder="Buscar para añadir... ej. tendinitis, hernia"
                buscarEn={(p:any)=>[p.nombre,p.zona,p.sistema]} subtitulo={(p:any)=>[p.zona,p.sistema].filter(Boolean).join(' · ')}
                onElegir={(p:any)=>setPatConfig({nombre:p.nombre,zona:p.zona||null,biblioteca_id:p.id,precauciones:p.precauciones||null,lado:'bilateral',estado:'activa',tiene_informe:false,observaciones:''})}
                onNuevo={(t:string)=>setAltaClinica({config:{tabla:'patologias_biblioteca',tipo:'patología',campoGrupo:'zona'},valor:{nombre:t},luego:(f:any)=>{setPatsBiblio((p: any)=>[...p,f]);setPatConfig({nombre:f.nombre,zona:f.zona||null,biblioteca_id:f.id,precauciones:f.precauciones||null,lado:'bilateral',estado:'activa',tiene_informe:false,observaciones:''})}})}/>
              {patActivas.length===0 && <div className="muted">Sin patologías activas</div>}
              {patActivas.map((p:any)=>(
                <div key={p.id} className="fila-p" style={{borderLeftColor:p.estado==='cronica'?'var(--amb)':'var(--red)'}}>
                  <div style={{flex:1,cursor:'pointer'}} onClick={()=>setDetalle({tipo:'patologia',datos:p})}>
                    <div style={{fontSize:13,color:'var(--n)'}}>{p.nombre}</div>
                    <div style={{fontSize:12,color:'var(--gr)',marginTop:1}}>{(p.lado&&p.lado!=='no_aplica')?cap(p.lado):LBL_EST_PAT[p.estado]}</div>
                  </div>
                  <select value={p.estado} onChange={e=>cambiarEstadoPatologia(p.id,p.nombre,e.target.value)}
                    style={{fontSize:12,padding:'3px 7px',borderRadius:5,border:'1px solid var(--bd)',background:'var(--w)',color:'var(--gr)',cursor:'pointer',fontFamily:'inherit'}}>
                    <option value="activa">Activa</option>
                    <option value="cronica">Crónica</option>
                    <option value="resuelta">Resuelta</option>
                  </select>
                  <button className="fila-x" title="Se apuntó por error · borrar"
                    onClick={()=>borrarClinico('patologias', p, p.nombre)}><Ic name="papelera" size={13}/></button>
                </div>
              ))}
              {patResueltas.length>0 && (
                <details style={{marginTop:8}}>
                  <summary className="det-sum">{patResueltas.length} resuelta{patResueltas.length>1?'s':''}</summary>
                  {patResueltas.map((p:any)=>(
                    <div key={p.id} className="fila-p" style={{borderLeftColor:'var(--gm)'}}>
                      <div style={{flex:1,cursor:'pointer'}} onClick={()=>setDetalle({tipo:'patologia',datos:p})}>
                        <div style={{fontSize:13,color:'var(--gr)'}}>{p.nombre}</div>
                      </div>
                      <button className="btn btn-t btn-sm" onClick={()=>cambiarEstadoPatologia(p.id,p.nombre,'activa')}>Reactivar</button>
                      <button className="fila-x" title="Se apuntó por error · borrar"
                        onClick={()=>borrarClinico('patologias', p, p.nombre)}><Ic name="papelera" size={13}/></button>
                    </div>
                  ))}
                </details>
              )}
            </div>

            <div>
              <div className="sec-sub">Operaciones</div>
              <BuscadorBiblioteca items={opsBiblio} placeholder="Buscar para añadir... ej. menisco, prótesis"
                buscarEn={(o:any)=>[o.nombre,o.zona]} subtitulo={(o:any)=>o.zona} etiquetaNuevo="Añadir"
                onElegir={(o:any)=>setOpConfig({nombre:o.nombre,biblioteca_id:o.id,anio:'',lado:'no_aplica',tiene_informe:false,observaciones:''})}
                onNuevo={(t:string)=>setAltaClinica({config:{tabla:'operaciones_biblioteca',tipo:'operación',campoGrupo:'zona'},valor:{nombre:t},luego:(f:any)=>{setOpsBiblio((p: any)=>[...p,f]);setOpConfig({nombre:f.nombre,biblioteca_id:f.id,anio:'',lado:'no_aplica',tiene_informe:false,observaciones:''})}})}/>
              {(operaciones||[]).length===0 && <div className="muted">Sin operaciones</div>}
              {(operaciones||[]).map((o:any)=>(
                <div key={o.id} className="fila-p" style={{borderLeftColor:'#6B6D6A'}}>
                  <div style={{flex:1}}>
                    <div style={{fontSize:13,color:'var(--n)'}}>{o.nombre}</div>
                    {(o.anio||o.lado||o.tiene_informe) && (
                      <div style={{fontSize:12,color:'var(--gr)',marginTop:1}}>
                        {[o.anio||null, o.lado?cap(o.lado):null, o.tiene_informe?'con informe':null].filter(Boolean).join(' · ')}
                      </div>
                    )}
                  </div>
                  <button className="fila-x" title="Quitar" onClick={()=>delOperacion(o.id,o.nombre)}><Ic name="cerrar" size={13}/></button>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* 2. TESTS — a ancho completo, es el bloque con más información */}
        <div className="sec">
          <div className="sec-h">
            <span className="sh-l">
              <span className="ct-l"><Ic name="buscar" size={13}/> Tests funcionales</span>
              <button className="btn btn-s btn-sm" onClick={()=>onNuevoTest?.()}>+ Registrar test</button>
            </span>
          </div>
          {tests.length===0 && <div className="muted">Sin tests registrados</div>}
          {tests.length>0 && (()=>{
            /**
             * UNA TARJETA POR TEST, con sus lados dentro.
             *
             * Antes cada lado era una tarjeta suelta, así que el lunge de un paciente salía
             * dos veces y podían acabar en columnas distintas —el derecho en positivos y el
             * izquierdo en negativos— sin nada que dijera que eran el mismo test. Lo que se
             * mira en un test lateral es precisamente la comparación entre lados, y estaban
             * lo más lejos posible el uno del otro.
             *
             * Los grupos por test+lado se conservan tal cual: los usan el mapa corporal y el
             * detalle. Aquí solo se juntan para pintar.
             */
            const ORDEN: Record<string,number> = { izquierdo:0, derecho:1, bilateral:2 }
            const porTest = (grupos:any[][]) => {
              const m: Record<string, any[][]> = {}
              grupos.forEach(g => { const k = g[0].test_id; (m[k] = m[k] || []).push(g) })
              return Object.values(m).map(lados =>
                lados.sort((a,b) => (ORDEN[a[0].lado] ?? 9) - (ORDEN[b[0].lado] ?? 9)))
            }

            // Basta con que UN lado siga positivo para que el test entero se quede en la
            // columna de positivos. Un positivo no puede esconderse en "resueltos" porque
            // el otro lado esté bien.
            // Zonas de cada test (por sus etiquetas, lib/zonasCuerpo).
            const zonasT = (testId:string) => zonasDeTest((testsLib||[]).find((x:any)=>x.id===testId) || { nombre: (tests||[]).find((x:any)=>x.test_id===testId)?.tests?.nombre }, etiquetasLib||[])
            const todosSin = porTest(gruposTests)
            /* EL CALOR: rojo si algun test de la zona sigue positivo, verde si todos dieron
               negativo, sin color si no se ha evaluado. */
            const colorZ = (z:string): ColorZona => {
              const deZ = todosSin.filter(t => zonasT(t[0][0].test_id).includes(z))
              if (!deZ.length) return null
              return deZ.some(t => t.some(l => l[0].resultado==='positivo')) ? 'rojo' : 'verde'
            }
            const todos = zonaTest ? todosSin.filter(t => zonasT(t[0][0].test_id).includes(zonaTest)) : todosSin
            const positivos = todos.filter(t => t.some(l => l[0].resultado === 'positivo'))
            const negativos = todos.filter(t => !t.some(l => l[0].resultado === 'positivo'))

            /** Un lado dentro de la tarjeta: su fecha, lo marcado y sus acciones. */
            const columnaLado = (grupo:any[], soloUno:boolean) => {
              const t = grupo[0]
              const anteriores = grupo.slice(1)
              const pos = t.resultado === 'positivo'
              return (
                <div key={t.lado||'bilateral'} style={{flex:'1 1 190px',minWidth:0,
                  borderLeft: soloUno ? 'none' : `2px solid ${pos?'#F5C8C8':'var(--gm)'}`,
                  paddingLeft: soloUno ? 0 : 9}}>
                  {!soloUno && (
                    <div style={{fontSize:11,fontWeight:600,letterSpacing:.4,textTransform:'uppercase',
                      color: pos?'var(--red)':'var(--gd)'}}>{cap(t.lado||'bilateral')}</div>
                  )}
                  <div style={{fontSize:12,color:'var(--gr)',marginTop:1}}>
                    {new Date(t.fecha+'T12:00:00').toLocaleDateString('es-ES',{day:'numeric',month:'short',year:'numeric'})}
                    {' · '}<span style={{color:pos?'var(--red)':'var(--gd)'}}>{pos?'Positivo':'Negativo'}</span>
                  </div>

                  {(t.items_resultado||[]).filter((i:any)=>i.marcado).map((item:any,ii:number)=>(
                    <div key={ii} style={{fontSize:12,color:'var(--red)',marginTop:4,display:'flex',alignItems:'flex-start',gap:5}}>
                      <Ic name="checkbox" size={12}/><span>{item.nombre}{textoMedida(item)?' · '+textoMedida(item):''}</span>
                    </div>
                  ))}
                  {t.observaciones && <div style={{fontSize:12,color:'var(--gr)',marginTop:5,fontStyle:'italic'}}>{t.observaciones}</div>}
                  {t.fecha_repeticion && (
                    <div style={{fontSize:12,color:'#8A6410',marginTop:4,display:'flex',alignItems:'center',gap:5}}>
                      <Ic name="alarma" size={12}/> Revisión: {new Date(t.fecha_repeticion+'T12:00:00').toLocaleDateString('es-ES',{day:'numeric',month:'short'})}
                    </div>
                  )}

                  {anteriores.length>0 && (
                    <details style={{marginTop:7}}>
                      <summary className="det-sum">Historial · {anteriores.length} anterior{anteriores.length>1?'es':''}</summary>
                      <div style={{marginTop:5,paddingLeft:9,borderLeft:`2px solid ${pos?'#F5C8C8':'var(--gm)'}`}}>
                        {anteriores.map((ant:any,ai:number)=>(
                          <div key={ai} style={{marginBottom:5}}>
                            <div style={{fontSize:12,color:'var(--n)'}}>
                              {new Date(ant.fecha+'T12:00:00').toLocaleDateString('es-ES',{day:'numeric',month:'short',year:'numeric'})} · <span style={{color:ant.resultado==='positivo'?'var(--red)':'var(--gd)'}}>{ant.resultado==='positivo'?'Positivo':'Negativo'}</span>
                            </div>
                            {ant.observaciones && <div style={{fontSize:12,color:'var(--gr)',fontStyle:'italic'}}>{ant.observaciones}</div>}
                          </div>
                        ))}
                      </div>
                    </details>
                  )}
                </div>
              )
            }

            const bloque = (lados:any[][], positivo:boolean) => {
              const t0 = lados[0][0]
              const soloUno = lados.length === 1 && (!t0.lado || t0.lado === 'bilateral')
              // Clave estable por TEST: al reevaluar cambia el id del registro, y si la
              // clave dependiera de él React remontaría la tarjeta y cerraría el historial.
              return (
                <div key={t0.test_id} style={{padding:'9px 11px',background:positivo?'var(--redl)':'var(--gl)',borderRadius:8,border:`1px solid ${positivo?'#F5C8C8':'var(--gm)'}`,marginBottom:7}}>
                  <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:6,flexWrap:'wrap'}}>
                    <div style={{flex:1,minWidth:120,fontSize:13,color:'var(--n)'}}>{t0.tests?.nombre||'Test'}</div>
                    {/*
                      DOS ICONOS, mismo peso. Antes uno era texto y otro icono, y se leían
                      como acciones de distinta categoría cuando son las dos del test.

                      Y NO HAY "pasar a negativo". Cambiar el resultado sin volver a mirar
                      al paciente es escribir en la historia clínica algo que nadie ha
                      comprobado, y encima un test lateral se quedaba resuelto en un lado y
                      no en el otro. Para cambiarlo se vuelve a pasar, que además obliga a
                      hacerlo en los dos lados.
                    */}
                    <button className="et-b" title="Volver a evaluar · se pasan los dos lados"
                      onClick={()=>abrirTest?.(t0.test_id, '')}>
                      <Ic name="recuperar" size={13}/>
                    </button>
                    <button className="et-b" title="Ver los registros de este test"
                      onClick={()=>setRegistrosDe({ id: t0.test_id, nombre: t0.tests?.nombre||'Test' })}>
                      <Ic name="historial" size={13}/>
                    </button>
                  </div>
                  {/* Izquierdo a la izquierda y derecho a la derecha, en la misma tarjeta.
                      Con `wrap` se apilan solos cuando la columna se queda estrecha. */}
                  <div style={{display:'flex',gap:12,flexWrap:'wrap'}}>
                    {lados.map(g => columnaLado(g, soloUno))}
                  </div>
                </div>
              )
            }

            return (
              <div style={{display:'flex',gap:18,alignItems:'flex-start',flexWrap:'wrap'}}>
              <div style={{textAlign:'center'}}>
                <CuerpoZonas ancho={150} color={colorZ} marcadas={zonaTest?[zonaTest]:[]}
                  onZona={z=>setZonaTest((v: any)=>v===z?null:z)}/>
                <div style={{fontSize:11.5,color:'var(--grl)',marginTop:6,lineHeight:1.5}}>
                  <span style={{color:'var(--red)'}}>● positivo</span> · <span style={{color:'var(--gd)'}}>● negativo</span><br/>sin color: sin evaluar
                </div>
                {zonaTest && <button className="btn btn-t btn-sm" style={{marginTop:4}} onClick={()=>setZonaTest(null)}>
                  {ZONAS_CUERPO.find(z=>z.id===zonaTest)?.nombre} ✕</button>}
              </div>
              <div className="g2" style={{flex:1,minWidth:280}}>
                <div>
                  <div className="sec-sub" style={{color:'var(--red)'}}>Positivos · {positivos.length}</div>
                  {positivos.length===0 && <div className="muted">Ninguno</div>}
                  {positivos.map(t=>bloque(t,true))}
                </div>
                <div>
                  <div className="sec-sub" style={{color:'var(--gd)'}}>Negativos · {negativos.length}</div>
                  {negativos.length===0 && <div className="muted">Ninguno</div>}
                  {negativos.map(t=>bloque(t,false))}
                </div>
              </div>
              </div>
            )
          })()}
        </div>

        {/* 3. LO QUE CONDICIONA EL TRATAMIENTO */}
        <div className="sec">
          <div className="sec-h"><span className="ct-l"><Ic name="alerta" size={13}/> Precauciones</span></div>
          <div className="g3">
            <div>
              <div className="sec-sub">Medicación</div>
              <BuscadorBiblioteca items={medsBiblio} placeholder="Buscar... ej. ibuprofeno"
                subtitulo={(m:any)=>m.categoria} etiquetaNuevo="Añadir"
                onElegir={(m:any)=>setMedConfig({nombre:m.nombre,frecuencia:'',observaciones:''})}
                onNuevo={(t:string)=>setAltaClinica({config:{tabla:'medicamentos_biblioteca',tipo:'medicamento',campoGrupo:'categoria'},valor:{nombre:t},luego:(f:any)=>{setMedsBiblio((p: any)=>[...p,f]);setMedConfig({nombre:f.nombre,frecuencia:'',observaciones:''})}})}/>
              {medicamentos.length===0 && <div className="muted">Sin medicación</div>}
              {medicamentos.map((m:any)=>(
                <div key={m.id} className="fila-p" style={{borderLeftColor:'#6B7FC4'}}>
                  <div style={{flex:1,cursor:'pointer'}} onClick={()=>setDetalle({tipo:'medicamento',datos:m})}>
                    <div style={{fontSize:13,color:'var(--n)'}}>{m.nombre}</div>
                    {m.frecuencia && <div style={{fontSize:12,color:'var(--gr)',marginTop:1}}>{m.frecuencia}</div>}
                  </div>
                  <button className="fila-x" title="Quitar" onClick={()=>delMedicamento(m.id,m.nombre)}><Ic name="cerrar" size={13}/></button>
                </div>
              ))}
            </div>
            <div>
              <div className="sec-sub">Alergias</div>
              <BuscadorBiblioteca items={algBiblio} placeholder="Buscar para añadir..." max={8}
                onElegir={(a:any)=>addAlergia(a.nombre)} onNuevo={(t:string)=>setAltaClinica({config:{tabla:'alergias_biblioteca',tipo:'alergia',campoGrupo:'categoria'},valor:{nombre:t},luego:(f:any)=>{setAlgBiblio((p: any)=>[...p,f]);addAlergia(f.nombre)}})}/>
              {(alergias||[]).length===0 && <div className="muted">Sin alergias</div>}
              {(alergias||[]).map((a:any)=>(
                <div key={a.id} className="fila-p" style={{borderLeftColor:'var(--red)'}}>
                  <div style={{flex:1,fontSize:13,color:'var(--n)'}}>{a.nombre}</div>
                  <button className="fila-x" title="Quitar" onClick={()=>delAlergia(a.id,a.nombre)}><Ic name="cerrar" size={13}/></button>
                </div>
              ))}
            </div>
            <div>
              <div className="sec-sub">Intolerancias</div>
              <BuscadorBiblioteca items={intolBiblio} placeholder="Buscar para añadir..." max={8}
                onElegir={(a:any)=>addIntolerancia(a.nombre)} onNuevo={(t:string)=>setAltaClinica({config:{tabla:'intolerancias_biblioteca',tipo:'intolerancia',campoGrupo:'categoria'},valor:{nombre:t},luego:(f:any)=>{setIntolBiblio((p: any)=>[...p,f]);addIntolerancia(f.nombre)}})}/>
              {(intolerancias||[]).length===0 && <div className="muted">Sin intolerancias</div>}
              {(intolerancias||[]).map((it:any)=>(
                <div key={it.id} className="fila-p" style={{borderLeftColor:'var(--amb)'}}>
                  <div style={{flex:1,fontSize:13,color:'var(--n)'}}>{it.nombre}</div>
                  <button className="fila-x" title="Quitar" onClick={()=>delIntolerancia(it.id,it.nombre)}><Ic name="cerrar" size={13}/></button>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* 4. CONTEXTO */}
        <div className="sec">
          <div className="sec-h"><span className="ct-l"><Ic name="deporte" size={13}/> Contexto</span></div>
          <div className="g2">
            <div>
              <div className="sec-sub">Deportes</div>
              <BuscadorBiblioteca items={depBiblio} placeholder="Buscar para añadir... ej. pádel, natación" max={8}
                onElegir={(d:any)=>addDeporte(d.nombre)} onNuevo={(t:string)=>addDeporte(t)}/>
              {(deportesPac||[]).length===0 && <div className="muted">Sin deportes registrados</div>}
              {(deportesPac||[]).map((d:any)=>(
                <div key={d.id} className="fila-p" style={{borderLeftColor:'var(--g)'}}>
                  <div style={{flex:1,fontSize:13,color:'var(--n)'}}>{d.nombre}</div>
                  <button className="fila-x" title="Quitar" onClick={()=>delDeporte(d.id,d.nombre)}><Ic name="cerrar" size={13}/></button>
                </div>
              ))}
            </div>
            <div>
              <div className="sec-sub" style={{display:'flex',alignItems:'center',gap:8}}>
                Plantillas
                {guardandoSalud && <span style={{fontSize:12,color:'var(--grl)'}}>guardando…</span>}
                {guardado && !guardandoSalud && <span style={{fontSize:12,color:'var(--gd)',display:'inline-flex',alignItems:'center',gap:3}}><Ic name="check" size={12}/> guardado</span>}
              </div>
              <div className="fila-p" style={{borderLeftColor:usaPlantillas?'var(--g)':'var(--bd)'}}>
                <div style={{flex:1,fontSize:13,color:'var(--n)'}}>Usa plantillas</div>
                <button className={`toggle ${usaPlantillas?'on':''}`} aria-label="Usa plantillas"
                  onClick={()=>{tocado.current=true;setUsaPlantillas(!usaPlantillas)}}/>
              </div>
              {usaPlantillas && (
                <div style={{marginTop:8}}>
                  {([['Izquierdo',plantIzq,setPlantIzq],['Derecho',plantDer,setPlantDer]] as const).map(([lbl,val,set]:any)=>(
                    <div key={lbl} style={{display:'flex',alignItems:'center',gap:10,marginBottom:6}}>
                      <span style={{fontSize:12,color:'var(--gr)',width:74,flexShrink:0}}>Pie {lbl.toLowerCase()}</span>
                      <select className="input" value={val} onChange={e=>{tocado.current=true;set(e.target.value)}} style={{flex:1}}>
                        <option value="">Sin especificar</option>
                        {plantBiblio.map((t:any)=><option key={t.id} value={t.nombre}>{t.nombre}</option>)}
                      </select>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* 5. SEGUIMIENTO */}
        <div className="sec">
          <div className="sec-h">
            <span className="sh-l">
              <span className="ct-l"><Ic name="progreso" size={13}/> Bienestar y estrés</span>
              <button className="btn btn-s btn-sm" onClick={()=>setEscalaConfig({borg:5,estres:5,fecha:hoyISO()})}>+ Registrar</button>
            </span>
          </div>
          {escalas.length===0 ? <div className="muted">Sin registros todavía</div> : (
            <>
              <div className="g2">
                {([
                  ['Bienestar', escalas[0].borg, colorBienestar(escalas[0].borg), escalas.map((e:any)=>e.borg)],
                  ['Estrés',    escalas[0].estres, colorEstres(escalas[0].estres), escalas.map((e:any)=>e.estres)],
                ] as const).map(([lbl,val,col,serie]:any)=>(
                  <div key={lbl} style={{display:'flex',alignItems:'center',gap:14}}>
                    <div>
                      <div className="sec-sub" style={{marginBottom:2}}>{lbl}</div>
                      <div style={{fontSize:26,fontWeight:300,color:col,lineHeight:1.1}}>{val}<span style={{fontSize:14,color:'var(--gr)'}}>/10</span></div>
                    </div>
                    <Sparkline valores={[...serie].reverse()} color={col}/>
                  </div>
                ))}
              </div>
              <div style={{fontSize:12,color:'var(--gr)',marginTop:10}}>
                Último registro el {new Date(escalas[0].fecha+'T12:00:00').toLocaleDateString('es-ES',{day:'numeric',month:'long',year:'numeric'})}
                {escalas.length>1 && <> · se muestran los {escalas.length} más recientes</>}
                <span style={{marginLeft:8}}>La evolución completa está en <b style={{fontWeight:500}}>Resultados</b>.</span>
              </div>
            </>
          )}
        </div>

        <Documentos pacienteId={id} patologias={patologias} onCambio={setNDocs}/>

      </div>
      )}</>)
}
