'use client'
import { COLOR_MOMENTO, textoMomento } from '@/lib/momento'
import BarraMomento from '@/components/BarraMomento'
import ChipPulso, { NombrePulso } from '@/components/ChipPulso'
import CaraPaciente from '@/components/CaraPaciente'
import MetodoParte from './MetodoParte'
import { cargarMetodos, aplicarMetodo, METODOS_DEFECTO, type ValoresMetodo } from '@/lib/metodos'
import { pulsoActivo, hayPulso } from '@/lib/pulsoVivo'
import { apuntarHistorial } from '@/lib/sesionViva'
import { avisosDeCondiciones } from '@/lib/avisosZona'
import { cargarReglas } from '@/lib/reglasClinicas'
import { planDeCarga, admitePropuesta, proponerSeries } from '@/lib/propuestaCarga'
import { useState, useRef, useEffect } from 'react'
import TodosTaller from './TodosTaller'
import { VeloCita, VeloAnadir } from './GestionCita'
import { usePuede } from '@/lib/permisos'
import { supabase } from '@/lib/supabase'
import { modoParte, textoModo, descansoDeParte, transicionDeParte, descansoEfectivo, duplicarSesion, itemDeEjercicio } from '@/lib/sesiones'
import { textoDescanso } from '@/lib/capacidades'
import { repetidosSemana, type Repetido, diasDeFalta } from '@/lib/repetidosSemana'
import { enModoPractica } from '@/lib/practica'
import { partesMedida } from '@/lib/medida'
import { normalizar } from '@/lib/texto'
import { alternarItem, itemMarcado } from '@/lib/ejecucion'
import { guardarVias, abrirObjetivo, resolverVia } from '@/lib/objetivos'
import { pacientesDelDia, horasDelDia, horaActual } from '@/lib/taller'
import { rutaDeAsignacion } from '@/lib/asignarCita'
import { MOTIVOS_CAMBIO, nombreMotivo, cambiosDeCitas, registrarCambio, type CambioSesion } from '@/lib/cambioSesion'
import { useRouter } from 'next/navigation'
import { Ic } from '@/lib/icons'
import { hoyISO } from '@/lib/fechas'
import { aplicarAjustes, sinAjustes } from '@/lib/ajustesCita'
import { avisarGuia } from '@/lib/guiaEventos'
import { testsPorDia } from '@/lib/evaluaciones'
import { testsPorConfirmar, confirmarAMano } from '@/lib/mantenimiento'
import { registrarResultadoTest, ladoOpuesto } from '@/lib/tests'
import { sugerirObjetivos } from '@/lib/ejercicioObjetivos'
import PulsoClase from './PulsoClase'
import ModalRealizarTest, { ladoVacio } from '@/components/ModalRealizarTest'
import RejillaParte from './RejillaParte'
import ExploradorEjercicios from '@/components/ExploradorEjercicios'
import { igualesA } from '@/lib/ejercicios'
import { traerTodo } from '@/lib/paginar'
import IconosContexto from './IconosContexto'
import HojaLibre from '@/components/HojaLibre'
import { leerHoja, registrosDeHoja, type Hoja } from '@/lib/hoja'
import { CAMPOS_MEDIDA, CAMPOS_SERIE, serieLlena, antesDeClase, sinEjerciciosBorrados, cerrarBorrador, guardarBorradorEjercicio, clavePendiente, apuntarPendiente, quitarPendiente, cuantosPendientes, leerPendientes, enviarPendientes } from './guardarTaller'
import ClaseEnCurso from './ClaseEnCurso'

// Ver lib/fechas: por UTC esto daba ayer entre las 00:00 y las 02:00.
const hoy = hoyISO

// Trozo de pantalla sacado de ModoClase.tsx tal cual (misma logica, mismos datos):
// el archivo grande se queda con el estado y este solo pinta. Lo que necesita le llega
// por props desde alli.
export default function CabeceraTaller(p: any) {
  const { avisoAgenda, cerrandoClase, desplegar, fecha, finalizarClase, hora, horas, menuFin, otrosPorSala, pendientes, porCerrar, pulsoAbierto, sala, salas, seleccion, setDesplegar, setFecha, setHora, setMenuFin, setPulsoAbierto, setSala, setVista, sinGuardar, solo, trayendo, ultimoGuardado, vista } = p
  return (<>{(() => {
        const dF = new Date(fecha + 'T12:00:00')
        const mover = (n:number) => { const d = new Date(fecha + 'T12:00:00'); d.setDate(d.getDate() + n); setFecha(d.toISOString().slice(0, 10)) }
        const fechaCorta = dF.toLocaleDateString('es-ES', { weekday: 'short', day: 'numeric', month: 'short' }).replace(/\./g, '').replace(',', '')
        const pill = (on:boolean): React.CSSProperties => ({ border: 0, background: on ? '#fff' : 'transparent', color: on ? 'var(--n)' : 'var(--gr)',
          padding: '6px 10px', borderRadius: 99, fontSize: 12.5, cursor: 'pointer', fontFamily: 'inherit', boxShadow: on ? '0 1px 4px rgba(0,0,0,.08)' : 'none', whiteSpace: 'nowrap' })
        const grupo: React.CSSProperties = { display: 'inline-flex', background: '#E8E7E1', borderRadius: 99, padding: 3, flexShrink: 0 }
        const redondo = (on:boolean): React.CSSProperties => ({ width: 34, height: 34, borderRadius: '50%', border: 0, flexShrink: 0, cursor: 'pointer',
          display: 'grid', placeItems: 'center', background: on ? '#fff' : '#E8E7E1', color: on ? 'var(--n)' : 'var(--gr)', boxShadow: on ? '0 1px 4px rgba(0,0,0,.08)' : 'none', position: 'relative' })
        const icoVista = (on:boolean): React.CSSProperties => ({ ...pill(on), width: 34, height: 30, padding: 0, display: 'grid', placeItems: 'center' })
        const nCerrar = porCerrar(seleccion).length
        const conPulso = pulsoActivo()
        // Cuántos de esta clase llevan pulsómetro según su sesión.
        const piden = seleccion.filter((x:any) => x.pulsometro && x.estado !== 'falta').length
        return (
          <div className="tl-cab" style={{ marginBottom: 10 }}>
            <style>{`
              .tl-cab{container-type:inline-size}
              .tl-banda{display:flex;align-items:center;gap:8px;min-width:0}
              .tl-horas{flex:1;min-width:0;overflow-x:auto;scrollbar-width:none}
              .tl-horas::-webkit-scrollbar{display:none}
              .tl-horas-sel{display:none}
              @container (max-width: 860px){ .tl-horas{display:none} .tl-horas-sel{display:inline-flex} .tl-hueco{display:block!important} }
            `}</style>
            <div className="tl-banda" data-guia="taller-banda">
              <div style={{ display: 'flex', alignItems: 'center', flexShrink: 0 }}>
                {!solo && <button onClick={() => mover(-1)} title="Día anterior" style={{ width: 26, height: 30, border: 0, background: 'transparent', color: 'var(--gr)', fontSize: 16, borderRadius: 8, cursor: 'pointer' }}>‹</button>}
                <b style={{ fontSize: 16, fontWeight: 600, whiteSpace: 'nowrap' }}>{fechaCorta.charAt(0).toUpperCase() + fechaCorta.slice(1)}</b>
                {!solo && <button onClick={() => mover(1)} title="Día siguiente" style={{ width: 26, height: 30, border: 0, background: 'transparent', color: 'var(--gr)', fontSize: 16, borderRadius: 8, cursor: 'pointer' }}>›</button>}
                {!solo && fecha !== hoy() && <button onClick={() => setFecha(hoy())} style={{ border: 0, background: 'transparent', color: 'var(--gd)', fontSize: 12.5, cursor: 'pointer', fontFamily: 'inherit' }}>Hoy</button>}
                {solo && hora && <span style={{ fontSize: 14, color: 'var(--gr)', marginLeft: 6 }}>· {hora}</span>}
              </div>
              {!solo && <>
                <div className="tl-horas"><div style={grupo}>
                  <button style={pill(hora === '')} onClick={() => setHora('')}>Día</button>
                  {horas.map((h: any) => <button key={h.hora} style={pill(hora === h.hora)} onClick={() => setHora(h.hora)}>
                    {h.hora}<small style={{ fontSize: 10.5, color: 'var(--grl)', marginLeft: 4 }}>{h.n}</small></button>)}
                </div></div>
                {/* Pantalla estrecha: las horas en un desplegable. */}
                <select className="tl-horas-sel" value={hora} onChange={e => setHora(e.target.value)}
                  style={{ border: 0, background: '#fff', borderRadius: 99, padding: '7px 12px', fontSize: 13, fontWeight: 600, fontFamily: 'inherit', color: 'var(--n)', boxShadow: '0 1px 4px rgba(0,0,0,.08)', flexShrink: 0 }}>
                  <option value="">Todo el día</option>
                  {horas.map((h: any) => <option key={h.hora} value={h.hora}>{h.hora} · {h.n}</option>)}
                </select>
                <span className="tl-hueco" style={{ flex: 1, display: 'none' }}/>
              </>}
              {solo && <span style={{ flex: 1 }}/>}
              {trayendo && <span style={{ fontSize: 11.5, color: 'var(--grl)', flexShrink: 0 }}>Cargando…</span>}
              {!trayendo && avisoAgenda && <span style={{ fontSize: 11.5, color: 'var(--red)', flexShrink: 1, minWidth: 0 }}>{avisoAgenda}</span>}
              {!solo && salas.length > 1 && (
                <div style={grupo}>
                  <button style={pill(sala === '')} onClick={() => setSala('')}>Todas</button>
                  {/* "●": otro dispositivo trabajando en esa sala ahora mismo. */}
                  {salas.map((x: any) => <button key={x} style={pill(sala === x)} onClick={() => setSala(x)}
                    title={otrosPorSala[x] ? `${otrosPorSala[x]} dispositivo(s) más en esta sala` : undefined}>
                    {x}{otrosPorSala[x] ? <span style={{ color: '#D4A24E', marginLeft: 3 }}>●</span> : null}</button>)}
                </div>
              )}
              {/* Una cabeza: Uno a uno. Varias: Todos. */}
              <div style={grupo}>
                <button style={icoVista(vista === 'uno')} onClick={() => setVista('uno')} title="Uno a uno"><Ic name="usuario" size={17}/></button>
                <button style={icoVista(vista === 'todos')} onClick={() => setVista('todos')} title="Todos"><Ic name="pacientes" size={17}/></button>
              </div>
              {/* Series desplegadas a la izquierda de cada ejercicio, o en la chapa. */}
              <button style={{ ...redondo(desplegar), color: desplegar ? 'var(--n)' : 'var(--gr)' }}
                onClick={() => setDesplegar(!desplegar)} title={desplegar ? 'Series en la chapa' : 'Desplegar las series junto a cada ejercicio'}
                aria-label="Desplegar las series">
                <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M4 6h3M4 12h3M4 18h3M11 6h9M11 12h9M11 18h9"/></svg>
              </button>
              {/* Pulsómetros: antes una fila propia. Rojo si hay bandas emitiendo. */}
              <button style={{ ...redondo(pulsoAbierto), color: conPulso ? '#B05A5A' : (pulsoAbierto ? 'var(--n)' : 'var(--gr)') }}
                onClick={() => setPulsoAbierto((v: any) => !v)} title={pulsoAbierto ? 'Ocultar pulsómetros' : piden ? `Pulsómetros · ${piden} lo llevan hoy según su sesión` : 'Pulsómetros'}>
                <Ic name="corazon" size={17}/>
                {piden > 0 && <span style={{ position: 'absolute', top: -3, right: -3, minWidth: 17, height: 17, borderRadius: 99, background: '#B05A5A', color: '#fff',
                  fontSize: 10, fontWeight: 700, display: 'grid', placeItems: 'center', padding: '0 4px', border: '2px solid var(--bl)' }}>{piden}</span>}
              </button>
              {sinGuardar > 0 ? (
                <button onClick={() => alert(`Hay ${sinGuardar} ${sinGuardar === 1 ? 'ejercicio' : 'ejercicios'} sin guardar.\n\nSe reintenta solo cada pocos segundos. Queda apuntado en este equipo: si se cierra la pantalla, se manda al volver a abrir el taller con conexión.\n\nMotivo: ${Object.values(leerPendientes())[0]?.motivo || 'sin conexión'}`)}
                  style={{ height: 24, padding: '0 9px', borderRadius: 99, border: 'none', background: '#C25B5B', color: '#fff', fontSize: 12, fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: 5, flexShrink: 0, cursor: 'pointer' }}>
                  <Ic name="alerta" size={12}/> Sin guardar
                </button>
              ) : pendientes > 0 ? (
                <span title="Guardando…" style={{ width: 22, height: 22, borderRadius: '50%', background: 'var(--ambl)', color: '#7A5800', display: 'grid', placeItems: 'center', flexShrink: 0 }}><Ic name="reloj" size={11}/></span>
              ) : ultimoGuardado ? (
                <span title={`Guardado ${ultimoGuardado.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}`}
                  style={{ width: 22, height: 22, borderRadius: '50%', background: 'var(--gl)', color: 'var(--gd)', display: 'grid', placeItems: 'center', flexShrink: 0 }}><Ic name="check" size={11}/></span>
              ) : null}
              {nCerrar > 0 && (() => {
                /* UNA CLASE ES UNA HORA EN UNA SALA. Con «Todas» las salas (o «Día»), en
                   pantalla hay varias clases: finalizar no puede cerrar la de la otra sala,
                   que quizá sigue en marcha. Entonces el botón pregunta cuál. */
                const grupos: Record<string, any[]> = {}
                porCerrar(seleccion).forEach((x:any) => { (grupos[`${x.hora || ''}|${x.sala || ''}`] ||= []).push(x) })
                const claves = Object.keys(grupos).sort()
                const estilo: React.CSSProperties = { background: 'var(--n)', color: '#fff', border: 0, borderRadius: 99, padding: '9px 16px', fontSize: 14, fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit', whiteSpace: 'nowrap', flexShrink: 0 }
                if (claves.length <= 1) return (
                  <button data-guia="taller-finalizar" disabled={cerrandoClase} onClick={() => finalizarClase(seleccion)} title="Guarda y finaliza a todos los de esta clase" style={estilo}>
                    {cerrandoClase ? 'Guardando…' : solo ? '✓ Finalizar' : `✓ Finalizar · ${nCerrar}`}
                  </button>
                )
                return (
                  <span style={{ position: 'relative', flexShrink: 0 }}>
                    <button data-guia="taller-finalizar" disabled={cerrandoClase} onClick={() => setMenuFin((v: any) => !v)} style={estilo}>
                      {cerrandoClase ? 'Guardando…' : `✓ Finalizar ▾`}
                    </button>
                    {menuFin && <>
                      <div style={{ position: 'fixed', inset: 0, zIndex: 40 }} onClick={() => setMenuFin(false)}/>
                      <div style={{ position: 'absolute', right: 0, top: 'calc(100% + 6px)', zIndex: 41, minWidth: 210, background: '#fff', borderRadius: 12,
                        boxShadow: '0 8px 24px rgba(0,0,0,.14)', padding: 6 }}>
                        <div style={{ fontSize: 10.5, color: 'var(--grl)', padding: '4px 10px 6px' }}>¿Qué clase se ha terminado?</div>
                        {claves.map(k => { const [h, sa] = k.split('|'); return (
                          <button key={k} className="menu-it" style={{ width: '100%', textAlign: 'left', fontSize: 13 }}
                            onClick={() => { setMenuFin(false); finalizarClase(grupos[k]) }}>
                            {h || 'Sin hora'}{sa ? ` · sala ${sa}` : ''} <span style={{ color: 'var(--grl)' }}>· {grupos[k].length}</span>
                          </button>) })}
                        <button className="menu-it" style={{ width: '100%', textAlign: 'left', fontSize: 13, borderTop: '1px solid var(--bl)' }}
                          onClick={() => { setMenuFin(false); finalizarClase(seleccion) }}>Todas <span style={{ color: 'var(--grl)' }}>· {nCerrar}</span></button>
                      </div>
                    </>}
                  </span>
                )
              })()}
              {solo?.onCerrar && <button onClick={solo.onCerrar} title="Volver a la agenda"
                style={{ width: 36, height: 36, borderRadius: '50%', border: '1px solid var(--bd)', background: '#fff', cursor: 'pointer', fontSize: 15, flexShrink: 0 }}>✕</button>}
            </div>
          </div>
        )
      })()}</>)
}
