'use client'
import { apuntarHistorial, resumenCambios } from '@/lib/sesionViva'
import { useConfigTrabajo, nombresEjecucion, nombresCapacidad, sugerenciaCapacidad, ejecucionesPara, ejecucionPorDefecto } from '@/lib/usarTrabajo'
import { ejecucionPorTiempo, segundosDeEjecucion } from '@/lib/trabajo'
import { useState, useEffect, useRef, useMemo } from 'react'
import { supabase } from '@/lib/supabase'
import { Ic } from '@/lib/icons'
import { capacidadPorReps, textoDescanso } from '@/lib/capacidades'
import { MODOS_PARTE, TIPOS_TIEMPO, modoParte, registrarSesion, LADOS, itemDeEjercicio, adaptarALaParte } from '@/lib/sesiones'
import ExploradorEjercicios from '@/components/ExploradorEjercicios'
import MonedaObjetivo from '@/components/MonedaObjetivo'
import { similaresA, crearEjercicioRapido } from '@/lib/ejercicios'
import { categoriaDe, agarresDe } from '@/lib/etiquetas'
import { contraindicacionesDe, motivoDe, type Contraindicacion } from '@/lib/contraindicaciones'
import { contiene } from '@/lib/texto'
import { aplicarAjustes, calcularAjustes, sinAjustes } from '@/lib/ajustesCita'
import SelectorObjetivos from './SelectorObjetivos'
import HojaLibre from '@/components/HojaLibre'
import { traerTodo } from '@/lib/paginar'
import { leerHoja, hojaVacia, objetivosDeHoja, type Hoja } from '@/lib/hoja'
import { objetivosDeEjercicio, cruceObjetivo } from '@/lib/ejercicioObjetivos'
import { camposSerie, ajustesMedida, COLOR_BANDA, partesMedida, idMedida } from '@/lib/medida'
import CapaBiblioteca from './CapaBiblioteca'
import { ChipMenu, SelectorVariante } from './ModalEditarSesion'

// Trozo de pantalla sacado de ModalEditarSesion.tsx tal cual (misma logica, mismos datos):
// el archivo grande se queda con el estado y este solo pinta. Lo que necesita le llega
// por props desde alli.
export default function ParteEjercicios(p: any) {
  const { arrEj, bandas, catPorId, catalogo, cfgTrabajo, conLetras, contra, editarEjercicio, editarParte, ejsHover, etiquetas, formSesion, fotoDe, medida, modoCita, moverEjercicio, notasAbiertas, objHover, objsAbiertos, objsDeEj, objsSesion, parte, parteActiva, quitarEjercicio, setAbrirBib, setArrEj, setCambiarEj, setFormSesion, setNotasAbiertas, setObjsAbiertos, setParteActiva, setSelBib, setSobreEj, sobreEj, sugeridoDe, variantesDe } = p
  return (<>{(formSesion.partes[parteActiva]?.ejercicios||[]).length===0?(
              <div style={{textAlign:'center',padding:30,color:'var(--gr)',fontSize:13,border:'1.5px dashed var(--bm)',borderRadius:'var(--rl)'}}>
                Sin ejercicios todavía
              </div>
            ):(
              <div className="tabla-ej">
                <div className="ej-cab">
                  <span>Ejercicio</span>
                  <span>Cómo se hace</span>
                  <span className="c">Series</span>
                  <span className="c" title="Repeticiones, segundos o metros: la unidad se elige al lado del número">Cantidad</span>
                  <span className="c">Peso</span>
                  <span className="c">Descanso</span>
                  <span/>
                </div>

                {/* PARA TODOS, ALINEADO CON LAS COLUMNAS. Una fila más, encima de los
                    ejercicios: lo que se pone aquí se pone en todos, cada casilla encima de
                    la suya. Sin rótulos: ya los dice la cabecera. Si no coinciden, «varias». */}
                {(parte?.ejercicios||[]).length>0 && (()=>{
                  const ejs = parte?.ejercicios || []
                  const comun = (f:(x:any)=>string) => { const v = Array.from(new Set<string>(ejs.map(f))); return v.length===1 ? v[0] : null }
                  const todos = (cambio:(x:any)=>any) => setFormSesion((prev: any)=>{
                    const partes=[...prev.partes]; const pa=partes[parteActiva]
                    partes[parteActiva]={ ...pa, ejercicios:(pa.ejercicios||[]).map((x:any)=>({ ...x, ...cambio(x) })) }
                    return { ...prev, partes }
                  })
                  const unidad = (x:any) => { const m = medida(x); return m.includes('segundos') ? 'segundos' : m.includes('metros') ? 'metros' : 'reps' }
                  const uComun = comun(unidad)
                  const campoDe = (u:string) => u==='segundos' ? 'tiempo' : u==='metros' ? 'metros' : 'reps'
                  const cant = uComun ? comun((x:any)=>String(x[campoDe(uComun)]||'')) : null
                  const seriesC = comun((x:any)=>String(x.series||''))
                  const pesoC = comun((x:any)=>String(x.peso||''))
                  const descC = comun((x:any)=>String(x.descanso||''))
                  const recorrido = parte?.modo==='circuito' || parte?.modo==='superserie'
                  return (
                    <div className="ej-row" style={{background:'var(--w)',borderBottom:'1px dashed var(--gm)',padding:'8px',margin:'0 0 4px'}}
                      title="Para todos los ejercicios de la parte">
                      {/* EL MÉTODO DE LA PARTE, en la columna del ejercicio. Lo propio de cada
                          modo (grupos de la superserie, minutos del «por tiempo») al lado. */}
                      <div className="ej-nom" style={{paddingLeft:10,display:'flex',alignItems:'center',gap:8,flexWrap:'wrap'}}>
                        <ChipMenu valor={modoParte(parte?.modo).nombre} opciones={MODOS_PARTE.map(m=>m.nombre)} titulo={modoParte(parte?.modo).ayuda}
                          onElegir={n=>{ const m = MODOS_PARTE.find(x=>x.nombre===n); if (m) editarParte({modo:m.id}) }}/>
                        {parte?.modo==='superserie' && (
                          <span style={{display:'inline-flex',alignItems:'center',gap:3}} title="Cuántos ejercicios forman cada grupo; con un número, las letras van solas">
                            {([2,3,4,0] as const).map(n=>{
                              const on = n===0 ? !parte?.tam_grupo : Number(parte?.tam_grupo)===n
                              return <button key={n} type="button" onClick={()=>{
                                setFormSesion((prev: any)=>{
                                  const partes=[...prev.partes]; const pa={ ...partes[parteActiva], tam_grupo: n||null }
                                  partes[parteActiva]={ ...pa, ejercicios: conLetras(pa, pa.ejercicios||[]) }
                                  return { ...prev, partes }
                                })
                              }} style={{border:`1px solid ${on?'var(--gd)':'var(--bd)'}`,background:on?'var(--gl)':'var(--w)',color:on?'var(--gd)':'var(--gr)',
                                borderRadius:99,padding:'1px 8px',fontSize:11.5,cursor:'pointer',fontFamily:'inherit',fontWeight:on?600:400}}>{n===0?'a mano':`de ${n}`}</button>
                            })}
                          </span>
                        )}
                        {parte?.modo==='tiempo' && <>
                          <ChipMenu valor={(TIPOS_TIEMPO.find(t=>t.id===(parte?.tipo_tiempo||'emom'))||TIPOS_TIEMPO[0]).nombre}
                            opciones={TIPOS_TIEMPO.map(t=>t.nombre)} clase="chip-ed-a" titulo="Qué manda el reloj"
                            onElegir={n=>{ const t = TIPOS_TIEMPO.find(x=>x.nombre===n); if (t) editarParte({tipo_tiempo:t.id}) }}/>
                          <label className="par-in" title="Duración total del bloque"><input type="number" min={1} value={parte?.minutos||''} placeholder="—"
                            onChange={e=>editarParte({minutos:e.target.value})}/><span>min</span></label>
                          {parte?.tipo_tiempo==='intervalos' && <label className="par-in" title="Trabajo/descanso en segundos, p. ej. 40/20">
                            <input value={parte?.intervalo||''} placeholder="40/20" style={{width:52}} onChange={e=>editarParte({intervalo:e.target.value})}/></label>}
                        </>}
                      </div>
                      <div className="celda apilada">
                        <ChipMenu valor={comun((x:any)=>x.regimen||'Concéntrico') ?? 'varias'} opciones={nombresEjecucion(cfgTrabajo)}
                          titulo="Cómo se hace, para todos"
                          onElegir={v=>todos((x:any)=>{
                            const seg = ejecucionPorTiempo(cfgTrabajo, v) && !x.tiempo ? segundosDeEjecucion(cfgTrabajo, v) : ''
                            return { regimen:v, ...(seg ? { tiempo: seg } : {}) }
                          })}/>
                        <ChipMenu valor={comun((x:any)=>x.lado||'Bilateral') ?? 'varias'} opciones={[...LADOS]} clase="chip-ed-l"
                          titulo="Lado, para todos" onElegir={v=>todos(()=>({ lado:v }))}/>
                        <ChipMenu valor={comun((x:any)=>x.capacidad||'') || undefined} opciones={nombresCapacidad(cfgTrabajo)}
                          clase="chip-ed-a" vacio={comun((x:any)=>x.capacidad||'')===null ? 'varias' : 'Capacidad'} titulo="Capacidad, para todos"
                          onElegir={cap=>todos((x:any)=>{
                            const sug=sugerenciaCapacidad(cfgTrabajo, cap, medida(x).includes('segundos'))
                            return { capacidad:cap, ...(sug.reps?{reps:sug.reps}:{}), ...(sug.tiempo?{tiempo:sug.tiempo}:{}) }
                          })}/>
                      </div>
                      <div className="celda">
                        {/* En circuito las series SON las vueltas: se ponen aquí, una vez. */}
                        {parte?.modo==='circuito'
                          ? <input type="number" className="c" min={1} value={parte?.vueltas||''} placeholder="—" title="Vueltas del circuito"
                              onChange={e=>editarParte({vueltas:e.target.value})}/>
                          : <input type="number" className="c" min={1} value={seriesC ?? ''} placeholder={seriesC===null?'var.':'—'} title="Series, para todos"
                              onChange={e=>{ const v=e.target.value; todos(()=>({ series:v })) }}/>}
                      </div>
                      <div className="celda cant">
                        <input type="number" className="c" min={0} value={cant ?? ''} placeholder={uComun ? (cant===null?'var.':'—') : '—'} disabled={!uComun}
                          title="Cantidad, para todos" onChange={e=>{ const v=e.target.value; const c=campoDe(uComun!); todos(()=>({ [c]:v })) }}/>
                        <select value={uComun || ''} title="Unidad, para todos"
                          onChange={e=>{ const v=e.target.value as any; if (!v) return
                            todos((x:any)=>{ const bib=catalogo.find((c:any)=>c.id===x.ejercicio_id); return { tipo_medida: idMedida(partesMedida(bib?.tipo_medida||x.tipo_medida||'peso_reps').carga, v) } }) }}>
                          {!uComun && <option value="">var.</option>}
                          <option value="reps">reps</option><option value="segundos">seg</option><option value="metros">m</option>
                        </select>
                      </div>
                      <div className="celda">
                        <input type="number" className="c" min={0} value={pesoC ?? ''} placeholder={pesoC===null?'var.':'kg'} title="Peso, para todos (los que van con kilos)"
                          onChange={e=>{ const v=e.target.value; todos((x:any)=>medida(x).includes('peso') ? { peso:v } : {}) }}/>
                      </div>
                      <div className="celda">
                        {/* LAS PAUSAS DE LA PARTE, en la columna del descanso. En circuito y
                            superserie, dos: entre ejercicios y al acabar la vuelta. Ejercicio a
                            ejercicio, una: entre series (la general, que hereda cada uno). */}
                        {recorrido ? (
                          <div style={{display:'flex',flexDirection:'column',gap:2,alignItems:'center'}}>
                            <span style={{fontSize:9,color:'var(--grl)',lineHeight:1}}>entre ejerc.</span>
                            <input type="number" className="c" min={0} step={5} value={parte?.transicion||''} placeholder="0" title="Pausa entre ejercicios (s)"
                              onChange={e=>editarParte({transicion:e.target.value})}/>
                            <span style={{fontSize:9,color:'var(--grl)',lineHeight:1,marginTop:2}}>{parte?.modo==='circuito' ? 'entre vueltas' : 'fin de vuelta'}</span>
                            <input type="number" className="c" min={0} step={5} value={parte?.descanso||''} placeholder="0"
                              title={parte?.modo==='circuito' ? 'Descanso entre vueltas (s)' : 'Descanso al acabar cada vuelta del grupo (s)'}
                              onChange={e=>editarParte({descanso:e.target.value})}/>
                          </div>
                        ) : parte?.modo==='tiempo' ? <span className="c" style={{color:'var(--grl)'}}>—</span> : (
                          <input type="number" className="c" min={0} step={5} value={parte?.descanso||''} placeholder="s" title="Descanso entre series, para todos (cada ejercicio puede llevar el suyo)"
                            onChange={e=>editarParte({descanso:e.target.value})}/>
                        )}
                      </div>
                      <div className="acc">
                        {formSesion.partes.length>1 && (
                          <button title="Eliminar esta parte" className="ic-acc peligro"
                            onClick={()=>{setFormSesion((prev: any)=>({...prev,partes:prev.partes.filter((_:any,i:number)=>i!==parteActiva)}));setParteActiva(Math.max(0,parteActiva-1))}}>
                            <Ic name="papelera" size={15}/>
                          </button>
                        )}
                      </div>
                    </div>
                  )
                })()}

                {(formSesion.partes[parteActiva]?.ejercicios||[]).map((ej:any,ei:number)=>{
                  const med = medida(ej)
                  const destinoEj = sobreEj===ei && arrEj!==null && arrEj!==ei
                  return (
                  <div key={ei} className="ej-row"
                    onDragOver={e=>{ if(arrEj===null) return; e.preventDefault(); if(sobreEj!==ei) setSobreEj(ei) }}
                    onDragLeave={()=>{ if(sobreEj===ei) setSobreEj(null) }}
                    onDrop={e=>{ if(arrEj===null) return; e.preventDefault(); moverEjercicio(arrEj,ei); setArrEj(null); setSobreEj(null) }}
                    style={{opacity: arrEj===ei ? .4 : 1,
                            boxShadow: destinoEj ? 'inset 3px 0 0 var(--gd)' : undefined,
                            // Con el ratón sobre un objetivo, se iluminan los que lo trabajan.
                            background: objHover && ejsHover.some((x: any)=>x.pi===parteActiva && x.ei===ei) ? 'var(--gl)' : undefined}}>
                    <div className="ej-nom">
                      {/* La manilla es lo único arrastrable: con la fila entera
                          `draggable`, seleccionar un número en un input se vuelve
                          un arrastre y no se puede ni corregir un peso. */}
                      <span draggable title="Arrastra para cambiar el orden"
                        onDragStart={()=>setArrEj(ei)}
                        onDragEnd={()=>{setArrEj(null);setSobreEj(null)}}
                        onMouseOver={e=>(e.currentTarget as HTMLElement).style.color='var(--g)'}
                        onMouseOut={e=>(e.currentTarget as HTMLElement).style.color='var(--grl)'}
                        style={{cursor:arrEj!==null?'grabbing':'grab',color:'var(--grl)',fontSize:17,
                                lineHeight:1,flexShrink:0,userSelect:'none',padding:'2px 3px'}}>⠿</span>
                      {parte?.modo==='superserie' && (
                        <select value={ej.grupo||'A'} disabled={!!parte?.tam_grupo} onChange={e=>editarEjercicio(ei,{grupo:e.target.value})}
                          style={{width:44,textAlign:'center',fontWeight:600,color:'var(--gd)',flexShrink:0}}
                          title="Los ejercicios del mismo grupo se hacen seguidos">
                          {['A','B','C','D','E'].map(g=><option key={g} value={g}>{g}</option>)}
                        </select>
                      )}
                      {fotoDe(ej)
                        ? <img src={fotoDe(ej)} alt={ej.nombre} className="ej-img"/>
                        : <div className="ej-img ej-img-no"><Ic name="fuerza" size={26}/></div>}
                      {/* Nombre y variante centrados contra la foto, y el nombre parte
                          en varias líneas antes que estrujar la columna de datos. */}
                      <div style={{minWidth:0}}>
                        <div className="ej-txt">{ej.nombre}</div>
                        {/* AVISA, NO IMPIDE. Hay motivos para prescribirlo igual —carga
                            baja, rango parcial— y un bloqueo duro se esquiva fuera de la
                            app, que es peor porque entonces no queda registrado. */}
                        {(() => {
                          const bib = catalogo.find((e:any)=>e.id===ej.ejercicio_id)
                          const m = bib ? motivoDe(bib, contra, etiquetas) : null
                          if (!m) return null
                          return (
                            <div className="ej-sub">
                              <span style={{fontSize:12,color:'#8A6410',background:'var(--ambl)',borderRadius:99,padding:'1px 8px',display:'inline-flex',alignItems:'center',gap:4}}
                                title={`Desaconsejado por ${m.test}, positivo el ${m.fecha}${m.otros>0?`. Y por ${m.otros} etiqueta${m.otros>1?'s':''} más`:''}`}>
                                <Ic name="alerta" size={10}/> Desaconsejado · {m.texto}
                              </span>
                            </div>
                          )
                        })()}
                        {/* La variante SÍ la decide la sesión. El ejercicio a secas es su
                            forma estándar y la biblioteca solo dice qué variantes existen;
                            cuál toca hoy —unilateral, alterno, unipodal— es prescripción, y
                            se elige aquí. Por eso es `.chip-ed` y no `.badge`, que en este
                            sistema significa "esto no se toca".

                            Si el ejercicio no tiene ninguna variante en la biblioteca no se
                            pinta nada: un desplegable con una sola opción vacía no informa,
                            solo ocupa. La única excepción es que la sesión ya tenga escrita
                            una variante que la biblioteca ya no ofrece —se quitó después de
                            montar la sesión—: entonces se enseña igual, y se puede quitar.
                            Esconderla la dejaría guardándose sin que nadie la vea. */}
                        {/* LOS OBJETIVOS DE ESTE EJERCICIO. Todos los de la sesión en
                            pequeño: en color los que trabaja, apagados los que no. Pulsar
                            cambia. Sale sugerido por etiquetas; tocarlo lo deja a mano. */}
                        {/* COMPACTO: solo los que trabaja, en pequeno, y "editar" abre la lista
                            entera. Antes salian todos los de la sesion en cada fila, grandes, y
                            cada ejercicio ocupaba tres lineas solo de objetivos. */}
                        {objsSesion.length > 0 && objsAbiertos !== ei && (() => {
                          const suyos = objsSesion.filter((o:any)=>objsDeEj(ej).includes(o.id))
                          return (
                            <div className="ej-sub" style={{display:'flex',gap:4,flexWrap:'wrap',alignItems:'center'}}>
                              {suyos.map((o:any)=>(
                                <span key={o.id} title={o.nombre} className="obj-mini">
                                  <MonedaObjetivo objetivo={o} tam="mini" titulo=""/>
                                  <span>{o.nombre}</span>
                                </span>
                              ))}
                              {suyos.length===0 && <span style={{fontSize:11,color:'var(--grl)'}}>Sin objetivo</span>}
                              {/* Los que cumplen solo una comprobacion: se avisan, no se enganchan solos. */}
                              {!modoCita && (()=>{ const n = objsSesion.filter((o:any)=>!suyos.includes(o.id) && sugeridoDe(ej,o)).length
                                return n>0 ? <button type="button" className="obj-ed" style={{color:'#7A5800'}} onClick={()=>setObjsAbiertos(ei)} title="Cumplen solo una de las dos comprobaciones: confírmalos">+{n} sugerido{n>1?'s':''}</button> : null })()}
                              {!modoCita && <button type="button" className="obj-ed" onClick={()=>setObjsAbiertos(ei)} title="Elegir qué objetivos trabaja">editar</button>}
                            </div>
                          )
                        })()}
                        {objsSesion.length > 0 && objsAbiertos === ei && (() => {
                          const suyos = objsDeEj(ej)
                          return (
                            <div className="ej-sub" style={{display:'flex',gap:4,flexWrap:'wrap',alignItems:'center'}}>
                              {objsSesion.map((o:any)=>{
                                const on = suyos.includes(o.id)
                                const sug = !on && sugeridoDe(ej, o)
                                return (
                                  <button key={o.id} type="button" disabled={modoCita}
                                    title={`${o.nombre} · ${on ? 'lo trabaja' : sug ? 'sugerido: cumple solo una de las dos comprobaciones (qué mueve / para qué sirve)' : 'no lo trabaja'}${modoCita ? '' : ' · pulsa para cambiar'}${on && !ej.objetivos_manual ? ' (por anatomía y lo que admite)' : ''}`}
                                    onClick={()=>editarEjercicio(ei,{ objetivos_manual:true,
                                      objetivos: on ? suyos.filter((x:string)=>x!==o.id) : [...suyos, o.id] })}
                                    // CON NOMBRE: solo la esfera no decía cuál era —sin foto todas son
                                    // la misma bola verde con una inicial—. Encendido = lo trabaja.
                                    style={{display:'inline-flex',alignItems:'center',gap:5,maxWidth:190,
                                      padding:'2px 9px 2px 2px',borderRadius:99,fontFamily:'inherit',fontSize:11,
                                      cursor:modoCita?'default':'pointer',transition:'all .12s',
                                      border:on?'1px solid var(--gm)':sug?'1px dashed var(--amb)':'1px dashed var(--bd)',
                                      background:on?'var(--gl)':sug?'var(--ambl)':'transparent',
                                      color:on?'var(--gd)':sug?'#7A5800':'var(--grl)'}}>
                                    <span style={{lineHeight:0,opacity:on?1:.3,filter:on?'none':'grayscale(1)',flexShrink:0}}>
                                      <MonedaObjetivo objetivo={o} tam="mini" titulo=""/>
                                    </span>
                                    <span style={{overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{o.nombre}</span>
                                  </button>
                                )
                              })}
                              <button type="button" className="obj-ed" onClick={()=>setObjsAbiertos(null)}>listo</button>
                            </div>
                          )
                        })()}
                        {(() => {
                          const vars = variantesDe(ej)
                          if (vars.length === 0 && !ej.variante) return null
                          return (
                            <div className="ej-sub">
                              <SelectorVariante variantes={vars} valor={ej.variante||''}
                                imagenBase={catPorId.get(ej.ejercicio_id)?.imagen_url || ej.imagen_url}
                                onElegir={v=>editarEjercicio(ei,{variante:v})}/>
                            </div>
                          )
                        })()}
                      </div>
                    </div>

                    {/* Régimen y capacidad juntos: los dos dicen cómo se trabaja,
                        no cuánto. Van antes de los números por eso mismo. */}
                    <div className="celda apilada" data-l="Cómo se hace">
                      {/* Un estiramiento ofrece y enseña las ejecuciones de estirar, no las de fuerza. */}
                      <ChipMenu valor={ej.regimen||ejecucionPorDefecto(cfgTrabajo, catalogo.find((c:any)=>c.id===ej.ejercicio_id)?.trabajo)}
                        opciones={ejecucionesPara(cfgTrabajo, catalogo.find((c:any)=>c.id===ej.ejercicio_id)?.trabajo)}
                        titulo="Cómo trabaja el músculo: concéntrico al acortarse, excéntrico al frenar, isométrico sin moverse"
                        onElegir={v=>{
                          // Pasar a una ejecución por tiempo (estiramiento, isométrico) pone
                          // los segundos de partida si no había (estiramientos, 60 s).
                          const seg = ejecucionPorTiempo(cfgTrabajo, v) && !ej.tiempo ? segundosDeEjecucion(cfgTrabajo, v) : ''
                          editarEjercicio(ei,{regimen:v, ...(seg ? { tiempo: seg } : {})})
                        }}/>
                      {/* LATERALIDAD, como la ejecucion: se prescribe aqui y el taller la ensena.
                          No iba en el editor y solo se podia poner desde el mapa de calor. */}
                      <ChipMenu valor={ej.lado||'Bilateral'} opciones={[...LADOS]} clase="chip-ed-l"
                        titulo="Bilateral, a un lado (unilateral) o alternando lados"
                        onElegir={v=>editarEjercicio(ei,{lado:v})}/>
                      {/* EL AGARRE, solo si el ejercicio admite alguno (sus etiquetas de agarre).
                          Así no hace falta un ejercicio por agarre: se elige aquí y el taller lo enseña. */}
                      {(() => {
                        const bibAg = catalogo.find((x:any)=>x.id===ej.ejercicio_id)
                        const ags = agarresDe(etiquetas, bibAg?.etiquetas || [])
                        // Con un solo agarre no hay nada que elegir: no sale.
                        return ags.length > 1 ? <ChipMenu valor={ej.agarre||''} opciones={ags} clase="chip-ed-l" vacio="Agarre"
                          titulo="Con qué agarre se hace" onElegir={v=>editarEjercicio(ei,{agarre:v})}/> : null
                      })()}
                      <ChipMenu valor={ej.capacidad} opciones={nombresCapacidad(cfgTrabajo)}
                        clase="chip-ed-a" vacio="Capacidad" titulo="Capacidad que se entrena"
                        onElegir={cap=>{
                          // Lo sugerido sale de Ajustes › Entrenador, como en el mapa de calor.
                          const sug=sugerenciaCapacidad(cfgTrabajo, cap, med.includes('segundos'))
                          const rep=sug.reps, desc=sug.descanso
                          // El descanso sugerido se recalcula mientras no lo hayas
                          // tocado tú. Antes solo miraba si estaba vacío, así que en
                          // cuanto se autocompletaba una vez ya no volvía a cambiar.
                          //
                          // Y NO se autocompleta si la parte tiene descanso general:
                          // rellenar aquí un número dejaba el general sin efecto para
                          // siempre y sin que se notara, que es justo lo que pasaba.
                          const ponDesc = desc && !ej.descanso_manual && !parte?.descanso
                          editarEjercicio(ei,{capacidad:cap,...(rep?{reps:rep}:{}),...(sug.tiempo?{tiempo:sug.tiempo}:{}),...(ponDesc?{descanso:desc}:{})})
                        }}/>
                    </div>

                    {/* En CIRCUITO no hay series por ejercicio: las vueltas de la parte
                        son las series de todos. Tenerlo editable invitaba a poner un 3
                        aquí y un 1 allá dentro del mismo circuito, que no significa
                        nada: o das la vuelta entera o no la das. */}
                    {parte?.modo === 'circuito' ? (
                      <div className="celda" data-l="Series">
                        <span className="c" style={{color:'var(--gr)',fontSize:12}} title="En circuito manda el número de vueltas de la parte">
                          {parte?.vueltas || '—'}
                        </span>
                      </div>
                    ) : (
                      <div className="celda" data-l="Series">
                        <input type="number" className="c" value={ej.series||''} placeholder="3"
                          title={parte?.modo==='superserie'
                            ? 'Series del grupo: cambiarlas aquí las cambia en todo el grupo'
                            : 'Cuántas veces se repite el ejercicio'}
                          onChange={e=>editarEjercicio(ei,{series:e.target.value})}/>
                      </div>
                    )}

                    {/* Una sola columna: repeticiones o duración, según cómo se mida
                        el ejercicio en la biblioteca. Nunca las dos. */}
                    <div className="celda cant" data-l={med.includes('segundos')?'Duración · s':med.includes('metros')?'Distancia · m':'Repeticiones'}>
                      {med.includes('segundos')
                        ? <input type="number" className="c" value={ej.tiempo||''} placeholder="seg"
                            title="Lo que dura cada serie, en segundos"
                            onChange={e=>editarEjercicio(ei,{tiempo:e.target.value})}/>
                        : med.includes('metros')
                        ? <input type="number" className="c" value={ej.metros||''} placeholder="m"
                            title="Metros en cada serie"
                            onChange={e=>editarEjercicio(ei,{metros:e.target.value})}/>
                        : <input type="number" className="c" value={ej.reps||''} placeholder="10"
                            title="Repeticiones en cada serie"
                            onChange={e=>{
                              const val=e.target.value
                              const cap=capacidadPorReps(val)
                              editarEjercicio(ei,{reps:val,...(cap?{capacidad:cap}:{})})
                            }}/>}
                      {/* LA UNIDAD, pegada al número y cambiable: reps, seg o m. */}
                      {(()=>{
                        const bib = catalogo.find((x:any)=>x.id===ej.ejercicio_id)
                        // La carga es del ejercicio (biblioteca); aquí solo se elige reps, seg o m.
                        const { carga } = partesMedida(bib?.tipo_medida || ej.tipo_medida || 'peso_reps')
                        const actual = med.includes('segundos') ? 'segundos' : med.includes('metros') ? 'metros' : 'reps'
                        return (
                          <select value={actual} title="Por repeticiones, por tiempo o por distancia"
                            onChange={e=>editarEjercicio(ei,{tipo_medida: idMedida(carga, e.target.value as any)})}>
                            <option value="reps">reps</option><option value="segundos">seg</option><option value="metros">m</option>
                          </select>
                        )
                      })()}
                    </div>

                    <div className="celda" data-l={med.includes('banda')?'Banda':'Peso · kg'}>
                      {med.includes('peso')
                        ? <input type="number" className="c" value={ej.peso||''} placeholder="kg"
                            title="Carga en kilos"
                            onChange={e=>editarEjercicio(ei,{peso:e.target.value})}/>
                        : med.includes('banda')
                        ? <select className="c" value={ej.banda||''} title="Con qué banda"
                            style={{borderLeft:`4px solid ${COLOR_BANDA[ej.banda]||'var(--bd)'}`}}
                            onChange={e=>editarEjercicio(ei,{banda:e.target.value})}>
                            <option value="">—</option>
                            {bandas.map((b: any)=><option key={b} value={b}>{b}</option>)}
                          </select>
                        : <span className="vacio" title="Peso corporal: no lleva carga">—</span>}
                    </div>

                    {/* El descanso propio del ejercicio solo manda cuando los ejercicios
                        van sueltos. En circuito y en superserie el que cuenta es el de
                        la parte —entre vueltas o tras cada vuelta del grupo—, y tener
                        aquí otro número editable era invitar a escribir dos descansos
                        que se contradicen. */}
                    {(parte?.modo==='circuito'||parte?.modo==='superserie') ? (
                      <div className="celda" data-l="Descanso · s">
                        <span className="c" style={{color:'var(--gr)',fontSize:12}}
                          title={parte?.modo==='circuito' ? 'En circuito manda el descanso entre vueltas de la parte' : 'En superserie manda el descanso tras cada vuelta del grupo'}>
                          {parte?.descanso || '—'}
                        </span>
                      </div>
                    ) : (
                      <div className="celda" data-l="Descanso · s">
                        {/* Vacío = hereda el general de la parte, que se ve como
                            marca de agua. Escribir aquí lo pisa solo para este
                            ejercicio: el peso muerto puede pedir tres minutos donde
                            el resto lleva minuto y medio. */}
                        <input type="number" step={5} className="c" value={ej.descanso||''}
                          placeholder={parte?.descanso ? String(parte.descanso) : '+'}
                          style={!ej.descanso&&parte?.descanso ? {color:'var(--grl)'} : undefined}
                          title={parte?.descanso
                            ? `Vacío hereda el general de la parte: ${parte.descanso} s. Escribe aquí solo si este ejercicio necesita otro, y bórralo para volver al general.`
                            : 'Descanso entre series, en segundos'}
                          onChange={e=>editarEjercicio(ei,{descanso:e.target.value,descanso_manual:true})}/>
                        {/* Marca de que ese número es suyo y no el heredado: sin ella
                            no se distingue un 90 propio de un 90 que viene de la parte. */}
                        {ej.descanso&&parte?.descanso&&String(ej.descanso)!==String(parte.descanso)&&(
                          <span title="Descanso propio de este ejercicio" style={{fontSize:9,color:'var(--g)',marginLeft:2}}>•</span>
                        )}
                      </div>
                    )}

                    {/* CAMBIAR POR UNO PARECIDO: abre la biblioteca con los que trabajan lo mismo
                        (músculo y patrón): un ejercicio de abducción propone otros de abducción. */}
                    {/* Las dos acciones en UNA celda: sueltas, la segunda caía a otra fila. */}
                    <div className="acc">
                      <button title="Cambiar por uno parecido" className="ic-acc"
                        onClick={()=>{ setSelBib([]); setCambiarEj(ei); setAbrirBib(true) }}><Ic name="cambio" size={15}/></button>
                      <button title="Quitar el ejercicio" className="ic-acc peligro"
                        onClick={()=>quitarEjercicio(parteActiva,ei)}><Ic name="papelera" size={15}/></button>
                    </div>

                    {/* La nota, entera y debajo de todo. Metida entre los campos se
                        quedaba en un hueco estrecho donde no cabía nada. */}
                    {/* PLEGADA SI ESTA VACIA. Una linea de nota vacia en cada ejercicio doblaba
                        la altura de la lista. Con texto se ve siempre. */}
                    {(ej.nota || notasAbiertas.has(ei)) ? (
                      <div className="ej-nota">
                        <span>Nota</span>
                        <input value={ej.nota||''} autoFocus={!ej.nota} onChange={e=>editarEjercicio(ei,{nota:e.target.value})}
                          placeholder="Lo que haya que recordar de este ejercicio"/>
                      </div>
                    ) : (
                      <div className="ej-nota">
                        <button type="button" className="obj-ed" onClick={()=>setNotasAbiertas((p: any)=>new Set(p).add(ei))}>+ Nota</button>
                      </div>
                    )}
                  </div>
                  )
                })}
              </div>
            )}</>)
}
