'use client'
import { useEffect, useMemo, useRef, useState } from 'react'
import ElegirMedida from '@/components/ElegirMedida'
import { useRouter, useSearchParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { Ic } from '@/lib/icons'
import { traerTodo } from '@/lib/paginar'
import { normalizar, contiene } from '@/lib/texto'
import { CATEGORIAS_ETIQUETA, categoriaDe, nivelDe, nombreConRama } from '@/lib/etiquetas'
import { TIPOS_MEDIDA, subirImagenEjercicio, leerDeCola, moverAFamilia, sacarDeFamilia, crearVariante, hacerPortada, eliminarEjercicio, usosDeEjercicio, similaresA, leerCola, leerGrupo, ponerEnComun, guardarCola, faltasAmasar, FALTAS_AMASAR } from '@/lib/ejercicios'
import ImagenEjercicio, { fotoCambiada } from '@/components/ImagenEjercicio'
import IconoEtiqueta from '@/components/IconoEtiqueta'
import CuerpoEtiquetas, { enMuneco } from '@/components/CuerpoEtiquetas'
import FiltroCuerpo from '@/components/FiltroCuerpo'
import { CARGAS, VOLUMENES, partesMedida, idMedida, type Carga, type Volumen } from '@/lib/medida'
import { EditorLista } from '@/app/entrenamiento/components/BibliotecaTab'
import { EditorTrabajo, EditorAnatomia, useConfigTrabajo, trabajoDe, anatomiaDe, idsAnatomia, trabajoVacio, anatomiaVacia, type TrabajoEj, type AnatomiaEj } from '@/components/TrabajoEjercicio'
import { C, R0, R1, HUECO, polar, quesito } from './geometria'

// Trozo de pantalla sacado de page.tsx tal cual (misma logica, mismos datos):
// el archivo grande se queda con el estado y este solo pinta. Lo que necesita le llega
// por props desde alli.

export default function CuerpoAmasar(p: any) {
  const { QUESITOS, abierto, cargando, d, editor, encima, familiaAnillo, ficha, grupo, grupoEjs, nuevo, params, paso, preview, q, recien, resumen, resumenOn, rev, set, setAbierto, setD, setEncima, setFichaOn, setResumenOn, setRev, verFicha, volarA } = p
  return (<>{cargando ? <div className="muted" style={{ textAlign: 'center', padding: 60 }}>Preparando el barro…</div> : (
        <>
        {/* LA COLUMNA DE LA TANDA SE QUITÓ: junto al anillo de la familia no se sabía qué
            ejercicio era cuál. Para pasar de uno a otro están ‹ Siguiente › abajo, y arriba
            se dice en cuál vas («2 de 3»). */}
        <div className={`am-zona ${abierto || verFicha || (grupo && resumenOn) ? 'am-abierto' : ''}`}
>
          <div className="am-rosco">
            {/* SU FAMILIA DE FONDO, como la red de objetivos y tests: cada una con su foto,
                unida al centro con un hilo. Tocar una lleva a su rosco. Van por el lado
                izquierdo para no chocar con el panel, que se abre a la derecha. */}
            {!nuevo && !grupo && familiaAnillo.length > 1 && (() => {
              // El que se está mirando sale con lo que hay en pantalla (nombre y foto recién
              // cambiados): si no, el anillo enseñaba lo antiguo hasta recargar.
              // Sin tope: antes solo cabían 12 y, al meter uno, otro desaparecía del anillo.
              // El que se está mirando YA NO sale en el anillo: verlo dos veces (en el centro y
              // fuera) parecía un repetido y llevó a borrarlo sin querer. Solo sus hermanos.
              // TODOS EN SU SITIO, también el del centro: si se quitaba, al cambiar de
              // ejercicio los demás se recolocaban y uno se perdía. El del centro deja su
              // hueco transparente y punteado, para saber dónde está y por dónde se va.
              const fam = familiaAnillo
              /* EN VARIOS CÍRCULOS, SIN PISARSE. Se llena primero el de dentro y luego los de
                 fuera (antes se repartían a la vez y caían en los mismos ángulos, unos encima de
                 otros). Los de fuera son más anchos que altos para no subirse a la cabecera, y
                 van corridos medio hueco para quedar entre los de dentro. */
              // Medidas probadas para que no se pisen de 2 a 25 ejercicios.
              const CAP = [6, 7, 8, 9], ARCO = [170, 150, 140, 130], RX = [68, 104, 140, 176], RY = [60, 78, 94, 106]
              const cuantos: number[] = []
              for (let c = 0, falta = fam.length; falta > 0; c++) { const n = Math.min(falta, CAP[Math.min(c, CAP.length - 1)]); cuantos.push(n); falta -= n }
              const pos: { x: number, y: number }[] = []
              cuantos.forEach((n, c) => {
                const k = Math.min(c, CAP.length - 1)
                const paso = ARCO[k] / (CAP[k] - 1)
                const corre = c % 2 === 1 && n < CAP[k] ? paso / 2 : 0
                for (let i = 0; i < n; i++) {
                  const a = (180 + (i - (n - 1) / 2) * paso + corre) * Math.PI / 180
                  pos.push({ x: 50 + Math.cos(a) * RX[k], y: 50 + Math.sin(a) * RY[k] })
                }
              })
              return (<>
                <svg viewBox="0 0 100 100" preserveAspectRatio="none" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', overflow: 'visible', zIndex: 0, pointerEvents: 'none' }}>
                  {pos.map((p, i) => <line key={i} x1={50} y1={50} x2={p.x} y2={p.y} stroke="var(--gm)" strokeWidth={.25} strokeDasharray="1 1" opacity={.7}/>)}
                </svg>
                {fam.map((x: any, i: any) => (
                  <div key={x.id} className="am-fam" style={{ left: `${pos[i].x}%`, top: `${pos[i].y}%`, cursor: x.id === params.id ? 'default' : undefined,
                    ...(x.id === params.id ? { opacity: .35 } : {}) }}
                    onClick={ev => { if (x.id !== params.id) volarA(ev.currentTarget as HTMLElement, x.id) }} title={x.id === params.id ? `${x.nombre} · es este` : x.nombre}>
                    <div style={{ borderRadius: 12, overflow: 'hidden', boxShadow: '0 3px 10px rgba(38,40,37,.14)',
                      outline: x.id === params.id ? '2px dashed var(--n)' : !x.portada_id ? '2px solid var(--g)' : 'none', outlineOffset: x.id === params.id ? 2 : 0 }}>
                      <ImagenEjercicio src={x.imagen_url} etiquetasEj={x.etiquetas} ejercicioId={x.id} radio={0} fondo="var(--bl)" icono={16} insignias={false}/>
                    </div>
                    <div style={{ fontSize: 10.5, lineHeight: 1.2, color: x.id === params.id ? 'var(--n)' : 'var(--gd)', fontWeight: x.id === params.id ? 600 : 400, marginTop: 3, textAlign: 'center',
                      /* EL NOMBRE ENTERO: más ancho que la foto y sin cortar (antes, 3 líneas y «…»). */
                      width: 116, marginLeft: -20 }}>{x.id === params.id ? 'En el centro' : x.nombre}</div>
                  </div>
                ))}
              </>)
            })()}
            <svg viewBox="0 0 600 600" style={{ width: '100%', height: '100%', overflow: 'visible', position: 'relative', zIndex: 2 }}>
              {QUESITOS.map((x: any, i: any) => {
                const a0 = -90 + i * paso + HUECO, a1 = -90 + (i + 1) * paso - HUECO
                const mid = (a0 + a1) / 2 * Math.PI / 180
                const fuera = encima === x.k || abierto === x.k ? 10 : 0
                return (
                  <path key={x.k} className="am-q" d={quesito(a0, a1)}
                    style={{ animationDelay: `${i * 55}ms`, transform: `translate(${Math.cos(mid) * fuera}px, ${Math.sin(mid) * fuera}px)` }}
                    fill={abierto === x.k ? 'var(--g)' : x.rev ? '#FBF1D3' : x.lleno ? 'var(--gl)' : '#fff'} fillOpacity={x.opcional && !x.lleno && abierto !== x.k ? .6 : 1}
                    stroke={x.rev ? '#E3BF5C' : x.lleno ? 'var(--gm)' : 'var(--bd)'} strokeWidth={1.2}
                    onMouseEnter={() => setEncima(x.k)} onMouseLeave={() => setEncima(null)}
                    onClick={() => { setFichaOn(false); setResumenOn(false); setAbierto(abierto === x.k ? null : x.k) }}/>
                )
              })}
            </svg>
            {/* Las etiquetas de cada quesito, en HTML encima del SVG: se maquetan mejor. */}
            {QUESITOS.map((x: any, i: any) => {
              const mid = (-90 + (i + .5) * paso) * Math.PI / 180
              const r = (R0 + R1) / 2 / 600 * 100
              const on = abierto === x.k
              const fuera = encima === x.k || on ? 1.6 : 0
              return (
                <div key={x.k} className="am-et" style={{ left: `${50 + Math.cos(mid) * (r + fuera)}%`, top: `${50 + Math.sin(mid) * (r + fuera)}%`,
                  color: on ? '#fff' : x.rev ? '#8A6410' : x.lleno ? 'var(--gd)' : 'var(--gr)', animationDelay: `${300 + i * 55}ms` }}>
                  <Ic name={x.ic} size={18}/>
                  <div style={{ fontSize: 12, marginTop: 2, lineHeight: 1.15 }}>{x.t}</div>
                  <div style={{ fontSize: 9.5, opacity: .75, marginTop: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{x.sub}</div>
                </div>
              )
            })}
            {/* LA PELLA: su foto o la figura de sus músculos, que cambia con las etiquetas. */}
            <div className={`am-centro ${recien ? 'am-late' : ''}`}>
              {grupo ? (
                // Hasta cuatro de los elegidos en mosaico, y cuántos son.
                <div style={{ position: 'relative', width: '100%', height: '100%', display: 'grid', gridTemplateColumns: '1fr 1fr', gridTemplateRows: '1fr 1fr' }}>
                  {grupoEjs.slice(0, 4).map((e: any, i: any) => (
                    <div key={e.id} style={{ position: 'relative', overflow: 'hidden',
                      gridColumn: (grupoEjs.length === 3 && i === 2) || grupoEjs.length === 1 ? '1 / 3' : undefined,
                      gridRow: grupoEjs.length <= 2 ? '1 / 3' : undefined }}>
                      <ImagenEjercicio src={e.imagen_url} etiquetasEj={e.etiquetas} ejercicioId={e.id} relleno radio={0} fondo="var(--bl)" icono={26}/>
                    </div>
                  ))}
                  <div style={{ position: 'absolute', left: '50%', top: '50%', transform: 'translate(-50%,-50%)', background: '#fff', borderRadius: 99,
                    padding: '8px 16px', fontSize: 20, color: 'var(--gd)', boxShadow: '0 4px 16px rgba(38,40,37,.18)' }}>{grupoEjs.length}</div>
                </div>
              ) : <ImagenEjercicio src={preview || d.imagen_url} etiquetasEj={d.etiquetas} ejercicioId={nuevo || grupo ? null : params.id} relleno radio={0} fondo="#fff" icono={60}/>}
            </div>
          </div>

          {q && (
            <div key={q.k} className="am-panel" style={q.k === 'etiquetas' ? { width: 'min(720px, 56vw)' } : undefined}>
              {/* La cabecera con "Hecho" se queda pegada arriba: con muchas etiquetas el
                  panel hace scroll y había que volver a subir para cerrarlo. */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12, position: 'sticky', top: -18, zIndex: 3,
                background: '#fff', margin: '-18px -20px 12px', padding: '14px 20px 10px', borderRadius: '20px 20px 0 0',
                boxShadow: '0 6px 10px -8px rgba(38,40,37,.18)' }}>
                <span style={{ color: 'var(--g)', lineHeight: 0 }}><Ic name={q.ic} size={18}/></span>
                <span style={{ flex: 1, fontSize: 15 }}>{q.t}</span>
                <button className="btn btn-p btn-sm" onClick={() => setAbierto(null)}>Hecho</button>
              </div>
              {rev(q.k) && (
                <div style={{ background: '#FBF1D3', borderRadius: 14, padding: '10px 12px', marginBottom: 12, fontSize: 12.5, color: '#6E5010' }}>
                  {q.k === 'trabajo' && !d.portada_id ? 'Es una propuesta automática.' : 'Viene copiado del ejercicio del que salió.'} Cambia lo que no valga, o:
                  <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                    <button className="btn btn-p btn-sm" onClick={() => set('por_revisar', d.por_revisar.filter((x: any) => x !== q.k))}>Sí, vale todo</button>
                    <button className="btn btn-t btn-sm" onClick={() => q.k === 'trabajo'
                      ? setD((p: any) => ({ ...p, trabajo: trabajoVacio(), anatomia: anatomiaVacia(), por_revisar: p.por_revisar.filter((x: any) => x !== 'trabajo') }))
                      : setRev(q.k === 'ejecucion' ? 'items_ejecucion' : 'feedbacks', q.k, [])}>Empezar de cero</button>
                  </div>
                </div>
              )}
              {editor(q.k)}
            </div>
          )}
          {verFicha && ficha()}
          {grupo && resumenOn && !abierto && resumen()}
        </div>
        </>
      )}</>)
}
