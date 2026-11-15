'use client'
import { apuntarHistorial, resumenCambios } from '@/lib/sesionViva'
import { useConfigTrabajo, nombresEjecucion, nombresCapacidad, sugerenciaCapacidad } from '@/lib/usarTrabajo'
import { ejecucionPorTiempo, segundosDeEjecucion } from '@/lib/trabajo'
import { useState, useEffect, useRef, useMemo } from 'react'
import { supabase } from '@/lib/supabase'
import { Ic } from '@/lib/icons'
import { capacidadPorReps, textoDescanso } from '@/lib/capacidades'
import { MODOS_PARTE, TIPOS_TIEMPO, modoParte, registrarSesion, LADOS, itemDeEjercicio, adaptarALaParte } from '@/lib/sesiones'
import ExploradorEjercicios from '@/components/ExploradorEjercicios'
import MonedaObjetivo from '@/components/MonedaObjetivo'
import { similaresA, crearEjercicioRapido } from '@/lib/ejercicios'
import { categoriaDe } from '@/lib/etiquetas'
import { contraindicacionesDe, motivoDe, type Contraindicacion } from '@/lib/contraindicaciones'
import { contiene } from '@/lib/texto'
import { aplicarAjustes, calcularAjustes, sinAjustes } from '@/lib/ajustesCita'
import SelectorObjetivos from './SelectorObjetivos'
import HojaLibre from '@/components/HojaLibre'
import { traerTodo } from '@/lib/paginar'
import { leerHoja, hojaVacia, objetivosDeHoja, type Hoja } from '@/lib/hoja'
import { objetivosDeEjercicio, cruceObjetivo } from '@/lib/ejercicioObjetivos'
import { camposSerie, ajustesMedida, COLOR_BANDA, partesMedida, idMedida } from '@/lib/medida'

// Trozo de pantalla sacado de ModalEditarSesion.tsx tal cual (misma logica, mismos datos):
// el archivo grande se queda con el estado y este solo pinta. Lo que necesita le llega
// por props desde alli.
export default function CapaBiblioteca(p: any) {
  const { abrirBib, addEjercicio, cambiarEj, catalogo, crearYAnadir, etiquetas, objsDeEj, objsSesion, parte, reemplazarEjercicio, selBib, setAbrirBib, setCambiarEj, setSelBib, similares, ultimo, ultimoCreado } = p
  return (<>{abrirBib && (
            <div className="capa-bib">
              <div className="capa-bib-h">
                <span style={{fontSize:14,color:'var(--n)',flex:1}}>
                  Biblioteca
                  <span style={{fontSize:13,color:'var(--gr)'}}>{cambiarEj!==null
                    ? <> · cambiar «{(parte?.ejercicios||[])[cambiarEj]?.nombre}» por…</>
                    : <> · añadir a {parte?.nombre || 'la parte'}</>}</span>
                </span>
                {cambiarEj===null && <button className="btn btn-p" disabled={selBib.length===0}
                  style={selBib.length===0?{opacity:.5,cursor:'default'}:undefined}
                  onClick={()=>{
                    // De golpe y en el orden en que se marcaron, no el del catálogo.
                    selBib.forEach((id: any)=>{
                      const e = catalogo.find((x:any)=>x.id===id)
                      if (e) addEjercicio(e)
                    })
                    setSelBib([]); setAbrirBib(false)
                  }}>
                  <Ic name="check" size={13}/> Añadir{selBib.length>0?` ${selBib.length}`:''}
                </button>}
                <button className="modal-close" aria-label="Cerrar biblioteca"
                  onClick={()=>{setSelBib([]);setAbrirBib(false);setCambiarEj(null)}}><Ic name="cerrar" size={16}/></button>
              </div>
              <div className="capa-bib-c">
                {/* El creado se añade solo a la parte, y la capa sigue abierta para
                    seguir eligiendo. Sin este aviso parecería que no ha pasado nada:
                    la tabla de la sesión está detrás y no se ve. */}
                {ultimoCreado && (
                  <div style={{marginBottom:10,padding:'7px 11px',borderRadius:'var(--r)',background:'var(--gl)',color:'var(--gd)',fontSize:12,display:'flex',alignItems:'center',gap:6}}>
                    <Ic name="ok" size={12}/>
                    &laquo;{ultimoCreado}&raquo; creado y a&ntilde;adido a {parte?.nombre || 'la parte'}.
                    Te falta rellenarlo en Biblioteca &rarr; Por completar.
                  </div>
                )}
                <ExploradorEjercicios
                  ejercicios={catalogo}
                  etiquetas={etiquetas}
                  seleccion={selBib}
                  onAlternar={(e:any)=>{
                    // Cambiando uno: se elige y se cambia, sin marcar varios.
                    if (cambiarEj!==null) { reemplazarEjercicio(cambiarEj, e); setCambiarEj(null); setAbrirBib(false); return }
                    setSelBib((prev: any)=>prev.includes(e.id)?prev.filter((x: any)=>x!==e.id):[...prev,e.id])
                  }}
                  sugeridos={cambiarEj!==null ? (()=>{
                    const actual = (parte?.ejercicios||[])[cambiarEj]
                    const base = catalogo.find((x:any)=>x.id===actual?.ejercicio_id)
                    if (!base) return undefined
                    /* «IGUALES»: los que hacen el MISMO MOVIMIENTO (sus etiquetas de
                       movimiento, p. ej. abducción de cadera), variantes de su familia
                       incluidas. Antes salían los parecidos por músculo, que eran muchos y
                       no siempre el mismo gesto. Si no tiene movimiento etiquetado, los parecidos. */
                    const movs = (base.etiquetas||[]).filter((id:string)=>{ const et=etiquetas.find((x:any)=>x.id===id); return et && categoriaDe(etiquetas, et)==='movimiento' })
                    const iguales = movs.length ? catalogo
                      .filter((x:any)=>x.id!==base.id && movs.every((m:string)=>(x.etiquetas||[]).includes(m)))
                      .map((x:any)=>({ x, n:(x.etiquetas||[]).filter((id:string)=>(base.etiquetas||[]).includes(id)).length }))
                      .sort((a:any,b:any)=>b.n-a.n).slice(0,24).map((o:any)=>o.x) : []
                    return iguales.length
                      ? { titulo:`Hacen el mismo movimiento que ${actual.nombre}`, items: iguales }
                      : { titulo:`Parecidos a ${actual.nombre}`, items: similaresA(catalogo, base, 10, etiquetas).filter((x:any)=>x.id!==base.id) }
                  })() : ultimo ? { titulo:`Parecidos a ${ultimo.nombre}`, items:similares } : undefined}
                  soloSugeridos={cambiarEj!==null}
                  objetivos={objsSesion}
                  idsObjetivosDe={objsSesion.length ? (e:any)=>objsDeEj({ ejercicio_id: e.id, nombre: e.nombre }) : undefined}
                  objetivosDe={objsSesion.length ? (e:any)=>objsDeEj({ ejercicio_id: e.id, nombre: e.nombre })
                    .map((id:string)=>(objsSesion.find((o:any)=>o.id===id) as any)?.nombre).filter(Boolean) : undefined}
                  onCrear={crearYAnadir}
                />
              </div>
            </div>
          )}</>)
}
