'use client'
import { COLOR_MOMENTO, textoMomento } from '@/lib/momento'
import BarraMomento from '@/components/BarraMomento'
import ChipPulso, { NombrePulso } from '@/components/ChipPulso'
import CaraPaciente from '@/components/CaraPaciente'
import MetodoParte from './MetodoParte'
import RoscoProgreso from './RoscoProgreso'
import { usePlegarAcabadas } from './plegarSolo'
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

// Trozo de pantalla sacado de ModoClase.tsx tal cual (misma logica, mismos datos):
// el archivo grande se queda con el estado y este solo pinta. Lo que necesita le llega
// por props desde alli.
export default function ClaseEnCurso(p: any) {
  const { abrirSustituir, abrirTest, act, addSerie, alternarNoHecho, alternarPlegada, aplicarMetodoParte, apuntarHoja, cambiaEj, cambiaSes, cambios, aceptarMedida, setMaterial, sugPorPaciente, cargarCatalogo, claveHechos, confirmar, confirmarSerie, desmarcarEj, ctxPorPaciente, desplegar, editaAgenda, editaPlan, enOtros, etiquetas, fecha, haceTests, hechosHoja, hojaAct, hojas, hora, leerNoHechos, listaTests, marcarTodosItems, metodos, moverEnParte, mutarSerie, nombrePac, objetivosLib, objsPorPaciente, ordenando, perdido, plegadas, quitarSerie, reordenarParte, repPorPaciente, sala, seleccion, setActivo, setAnadiendo, setAnadiendoPac, setCitaVelo, setComent, setLado, setAgarre, setListaTests, setOrdenando, setRegimen, setVista, setVolumen, sinTest, solo, sustituir, testsHoy, toggleItem, toggleObjetivo, trayendo, vista } = p
  // Al acabar una parte (todo hecho o «No lo hizo»), se recoge sola. Ver plegarSolo.
  usePlegarAcabadas(act ? [{ datos: act.datos || [], nh: act.sesionId ? leerNoHechos(act.paciente.id, act.sesionId) : [],
    clave: (ei: number, parte: string) => `${act.paciente.id}|${ei}|${parte}` }] : [], plegadas, alternarPlegada)
  return (<>{seleccion.length===0 ? (
        <div style={{textAlign:'center',padding:60,color:'var(--grl)',fontSize:11}}>
          {trayendo ? 'Cargando…' : <>Nadie {sala ? `en la sala ${sala} ` : ''}{hora ? `a las ${hora}` : 'este día'}. Cambia la hora o la sala arriba, o añade a quien venga sin cita.</>}
          {!trayendo && !solo && editaAgenda && <div style={{display:'flex',justifyContent:'center',marginTop:12}}><button onClick={()=>setAnadiendoPac(true)} title="Añadir a alguien a esta clase"
              style={{display:'flex',alignItems:'center',gap:4,padding:'5px 12px',borderRadius:99,cursor:'pointer',fontFamily:'inherit',
                border:'1.5px dashed var(--gm)',background:'transparent',color:'var(--gd)',fontSize:10.5,fontWeight:600}}>＋ Añadir</button></div>}
        </div>
      ) : vista==='todos' ? (
        <TodosTaller seleccion={seleccion} nombrePac={nombrePac} etiquetas={etiquetas} a={{
          confirmar: confirmarSerie, mutar: mutarSerie, addSerie, quitarSerie,
          regimen: setRegimen, lado: setLado, agarre: cambiaEj ? setAgarre : undefined, coment: setComent, item: toggleItem,
          volumen: cambiaEj ? setVolumen : undefined,
          noHecho: alternarNoHecho, noHechos: leerNoHechos,
          sustituir: abrirSustituir, puedeCambiar: cambiaEj,
          // ⤢ lleva a su vista de siempre, con todo (tests, hoja, cambio de sesion).
          abrir: (pid:string) => { setActivo(pid); setVista('uno') },
          todosItems: marcarTodosItems, objetivo: toggleObjetivo, cita: (pid:string) => setCitaVelo(pid),
          objetivosLib, objsPac: (pid:string) => objsPorPaciente[pid] || [],
        }}/>
      ) : !act ? (
        <div style={{textAlign:'center',padding:40,color:'var(--grl)',fontSize:11}}>Selecciona un paciente arriba para anotar su trabajo.</div>
      ) : (
        <div className="card" style={act.paciente?.momento ? { background: COLOR_MOMENTO.fondo, borderColor: COLOR_MOMENTO.borde } : undefined}>
          {/* SU MOMENTO, lo primero de la tarjeta: cambia lo que se le puede hacer hoy. */}
          {act.paciente?.momento && <div style={{ display:'flex', alignItems:'center', gap:6, fontSize:12.5, fontWeight:600, color:COLOR_MOMENTO.texto, marginBottom:8 }}>
            <Ic name="reloj" size={13}/> {textoMomento(act.paciente)}</div>}
          {act.paciente?.momento_hasta && <div style={{ marginBottom: 10 }}><BarraMomento p={act.paciente} ancho={320}/></div>}
          {/* Con la pantalla estrecha, lo de la derecha baja de línea en vez de salirse. */}
          <div style={{display:'flex',alignItems:'center',gap:10,marginBottom:10,flexWrap:'wrap'}}>
            <div style={{minWidth:0,flexShrink:0}}>
              <div style={{fontSize:13,fontWeight:400,color:'var(--n)',display:'flex',alignItems:'center',gap:10,flexWrap:'wrap'}}>
                {/* Solo sale si lleva banda: ver PulsoClase. */}
                <ChipPulso pid={act.paciente?.id} grande/>
                {act.estado === 'falta' && <span style={{ fontSize: 10.5, fontWeight: 700, color: '#fff', background: '#C0504D', borderRadius: 99, padding: '1px 8px' }}>Falta</span>}
                {act.finalizado&&<span style={{fontSize:9,color:'var(--g)',marginLeft:8}}>✓ finalizado</span>}
                {enOtros[act.paciente.id] && (
                  <span style={{fontSize:11,color:'#7A5800',background:'var(--ambl)',border:'1px solid var(--amb)',borderRadius:99,padding:'2px 9px',marginLeft:8}}>
                    También abierto en {enOtros[act.paciente.id].join(', ')} · si apuntáis los dos, se queda lo último
                  </span>
                )}
                {/* LO QUE ESTÁ HACIENDO NO ES LO QUE SE LE PLANIFICÓ. Va aquí arriba y no
                    escondido junto al botón: quien entra a mitad de clase tiene que verlo
                    sin preguntar, porque cambia lo que se espera de la sesión. */}
                {/* LO QUE HAY QUE MEDIRLE HOY. Va con el nombre, no escondido: es parte de
                    lo que toca en esta clase, igual que la sesion. */}
                {haceTests && ((testsHoy[act.paciente.id]||[]).length + (sinTest[act.paciente.id]||[]).length)>0 && (()=>{
                  const suyos = testsHoy[act.paciente.id]||[]
                  // Los que se confirman mirandolos cuentan igual: si no salieran
                  // aqui se quedarian escondidos en la ficha justo por no tener test.
                  const otros = sinTest[act.paciente.id]||[]
                  const faltan = suyos.filter((x:any)=>x.hecho===false).length + otros.length
                  return (
                    <span style={{position:'relative'}}>
                      <button className="btn btn-s btn-sm" style={{gap:5,
                        borderColor: faltan>0?'var(--amb)':'var(--gm)',
                        color: faltan>0?'#7A5800':'var(--gd)'}}
                        title={[...suyos.map((x:any)=>x.test.nombre), ...otros.map((o:any)=>o.nombre)].join(', ')}
                        onClick={()=>{ if (suyos.length===1 && otros.length===0 && faltan>0) abrirTest(suyos[0]); else setListaTests((v: any)=>v===false) }}>
                        <Ic name="informe" size={13}/>
                        {faltan>0 ? `${faltan} por comprobar` : 'comprobado'}
                      </button>
                      {/* Absoluto y no `menu-flot`, que es `position:fixed`: con top:100%
                          se iba al fondo de la pantalla y parecia que el boton no hacia nada. */}
                      {listaTests && (
                        <div style={{position:'absolute',top:'calc(100% + 5px)',left:0,zIndex:60,
                          minWidth:250,background:'var(--w)',border:'1px solid var(--bd)',
                          borderRadius:'var(--r)',boxShadow:'var(--sh-md)',padding:4}}>
                          {suyos.map((x:any)=>(
                            <button key={x.test.id} className="menu-it" style={{width:'100%',textAlign:'left'}}
                              onClick={()=>abrirTest(x)}>
                              <span style={{display:'flex',alignItems:'center',gap:7}}>
                                <span style={{color:x.hecho?'var(--gd)':'var(--grl)',width:11}}>{x.hecho?'✓':'·'}</span>
                                <span style={{flex:1,minWidth:0}}>
                                  <span style={{fontSize:12,color:'var(--n)',display:'block'}}>{x.test.nombre}</span>
                                  {/* Si el objetivo cuelga de un item suelto, solo se mide ese. */}
                                  {x.items.length>0 && (
                                    <span style={{fontSize:10.5,color:'var(--gd)',display:'block'}}>{x.items.join(' · ')}</span>
                                  )}
                                  {x.motivo==='mantenimiento' && (
                                    <span style={{fontSize:10,color:'#7A5800',display:'block'}}>
                                      se mantiene · {x.objetivos.join(' · ')}
                                    </span>
                                  )}
                                </span>
                              </span>
                            </button>
                          ))}
                          {otros.length>0 && suyos.length>0 && (
                            <div style={{height:1,background:'var(--bd)',margin:'4px 0'}}/>
                          )}
                          {otros.map((o:any)=>(
                            <div key={o.objetivo_id} style={{padding:'6px 8px'}}>
                              <div style={{fontSize:12,color:'var(--n)'}}>{o.nombre}</div>
                              <div style={{fontSize:10,color:'#7A5800',marginBottom:5}}>
                                se mantiene · sin test, se mira
                              </div>
                              <div style={{display:'flex',gap:6}}>
                                <button className="btn btn-s btn-sm"
                                  onClick={()=>confirmar(act.paciente.id, o)}>Sigue bien</button>
                                <button className="btn btn-s btn-sm"
                                  style={{borderColor:'var(--bd)',color:'var(--gr)'}}
                                  onClick={()=>perdido(act.paciente.id, o)}>Lo ha perdido</button>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </span>
                  )
                })()}
                {/* SIN NIVEL PARA TESTS, PERO QUE LO SEPA. El test no lo hace él (es de la
                    valoración), pero si hoy toca, tiene que verlo para avisar al encargado/a
                    y dejarle hueco en la clase. Solo aviso, sin botón. */}
                {!haceTests && (testsHoy[act.paciente.id]||[]).filter((x:any)=>!x.hecho).length>0 && (
                  <span title="Lo hace el encargado/a: avísale" style={{fontSize:11,padding:'3px 10px',borderRadius:99,whiteSpace:'nowrap',
                    background:'var(--ambl)',color:'#7A5800',display:'inline-flex',alignItems:'center',gap:5}}>
                    <Ic name="informe" size={12}/> Hoy toca test: {(testsHoy[act.paciente.id]||[]).filter((x:any)=>!x.hecho).map((x:any)=>x.test.nombre).join(', ')} · avisa al encargado/a
                  </span>
                )}
                {act.citaId && cambios[act.citaId] && (()=>{
                  const c = cambios[act.citaId]
                  return (
                    <span title={`Antes: «${c.sesion_antes_nombre || '—'}»${c.nota ? '\n\n' + c.nota : ''}`}
                      style={{fontSize:9,fontWeight:600,padding:'2px 9px',borderRadius:99,whiteSpace:'nowrap',
                        background:'#EFE7F7',color:'#5B3E86',border:'1px solid #D6C4E8',
                        display:'inline-flex',alignItems:'center',gap:4}}>
                      <Ic name="cambio" size={10}/> Cambiada · {nombreMotivo(c.motivo).toLowerCase()}
                    </span>
                  )
                })()}
              </div>
            </div>
            <div style={{flex:1,display:'flex',justifyContent:'center'}}>
              {/* Las patologias, molestias y alertas de este paciente, y los objetivos
                  de la sesion con su moneda. Ver `IconosContexto`. */}
              <IconosContexto que="contexto" ctx={ctxPorPaciente[act.paciente.id] || {}} sesionId={act.sesionId}/>
            </div>
            {/* CUÁNTO DE SU SESIÓN SUELE HACER: media hecha frente a lo previsto. Ver RoscoProgreso. */}
            {act.sesionId && (act.datos||[]).length > 0 && (
              <RoscoProgreso key={act.paciente.id + act.sesionId} pacienteId={act.paciente.id} sesionId={act.sesionId} datos={act.datos} fecha={fecha} noHechos={leerNoHechos(act.paciente.id, act.sesionId)}/>
            )}
            {/* UN SOLO GUARDADO: «✓ Finalizar» de arriba cierra a todos los de la clase
                (también las de hoja libre). Lo que se apunta ya se guarda solo al tocarlo. */}
          </div>

          {/* PREPARAR LA CLASE: antes de su hora, cambiar sí; apuntar no. */}
          {antesDeClase(act, fecha) && (
            <div style={{fontSize:12.5,color:'var(--gd)',background:'var(--gl)',border:'1px solid var(--gm)',borderRadius:10,padding:'8px 12px',marginBottom:10,lineHeight:1.5}}>
              <b>Preparando la clase{act.hora ? ` de las ${String(act.hora).slice(0,5)}` : ''}.</b> Puedes cambiar su sesión (ejercicios, método, series, descansos) y se guarda;
              lo que apuntes en las series no cuenta como hecho hasta que empiece la clase.
            </div>
          )}
          {act.sesionVieja && act.sesionId && (
            <div style={{fontSize:10,color:'var(--gd)',background:'var(--gl)',border:'1px solid var(--bd)',borderRadius:6,padding:'6px 9px',marginBottom:8}}>
              La sesión de esta cita es de una tanda anterior. Se ejecuta igual —es lo que se planificó para hoy—, pero si ya no toca, elige otra arriba.
            </div>
          )}

          {!act.sesionId ? (
            <div style={{textAlign:'center',padding:30,color:'var(--grl)',fontSize:10}}>{cambiaSes ? <>Sin sesión para hoy. Dale a <b style={{color:'var(--gr)'}}>Asignar sesión</b> arriba.</> : 'Sin sesión para hoy. Avisa al encargado/a para que se la ponga.'}</div>
          ) : hojaAct ? (
            /* La hoja tal cual se dibujo; solo sus casillas se pueden tocar. */
            <HojaLibre modo="taller" hoja={hojaAct} biblioteca={[]} objetivos={[]}
              hechos={hechosHoja[claveHechos(act.paciente.id, act.sesionId)] || {}}
              onHecho={(c, v)=>apuntarHoja(act.paciente.id, act.sesionId, c, v)}/>
          ) : !(act.sesionId in hojas) ? (
            <div style={{textAlign:'center',padding:30,color:'var(--grl)',fontSize:10}}>Cargando…</div>
          ) : act.datos.length===0 ? (
            <div style={{textAlign:'center',padding:30,color:'var(--grl)',fontSize:10}}>Esta sesión no tiene ejercicios.</div>
          ) : act.datos.map((ej:any,ei:number)=>{
            const partePrev = ei>0 ? (act.datos[ei-1].parte||'') : null
            const mostrarParte = ei===0 || (ej.parte||'') !== partePrev
            /* TODA LA PARTE DE UNA VEZ, de izquierda a derecha. Nacio para el
               circuito -que se anota cruzando- y se lee mejor tambien en lo
               demas: la parte entera de un vistazo, sin fondos ni recuadros, y
               las siguientes debajo. Ver `RejillaParte`. */
            const delaParte = act.datos.map((x:any,i:number)=>({ej:x, ei:i}))
              .filter((o:any)=>(o.ej.parte||'') === (ej.parte||''))
            if (!mostrarParte) return null
            const kPlegada = `${act.paciente.id}|${ei}|${ej.parte||''}`
            const plegada = plegadas.has(kPlegada)
            return (
            <div key={'w'+ei}>
            {(ej.parte||'') !== '' && (
              /* LA CABECERA DE LA PARTE, VISIBLE. En 9px y gris se perdia entre
                 las fotos, y es lo que dice como se trabaja ese bloque. */
              <div role="button" tabIndex={0} aria-expanded={!plegada}
                onClick={()=>alternarPlegada(kPlegada)}
                onKeyDown={e=>{ if (e.key==='Enter'||e.key===' ') { e.preventDefault(); alternarPlegada(kPlegada) } }}
                style={{margin:'20px 0 9px',display:'flex',alignItems:'center',gap:10,flexWrap:'wrap',
                background:'var(--bl)',borderRadius:10,
                padding:'7px 14px',cursor:'pointer',userSelect:'none'}}>
                <span style={{fontSize:14,fontWeight:600,color:'var(--n)'}}>{ej.parte}</span>
                {/* EL MÉTODO, SUS SERIES Y SUS DESCANSOS, sobre la franja y tocables (nivel 2+). */}
                {ej.parteObj && (ej.pos != null
                  ? <MetodoParte key={JSON.stringify([ej.parteObj.modo, ej.parteObj.vueltas, ej.parteObj.descanso, ej.parteObj.transicion, ej.parteObj.ejercicios?.[0]?.series])}
                      parte={ej.parteObj} puede={cambiaEj} soloHoy={!editaPlan} defectos={metodos}
                      onAplicar={(m, v, alc) => aplicarMetodoParte(act.paciente.id, Number(String(ej.pos).split('.')[0]), m, v, alc)}/>
                  : <span style={{fontSize:12.5,color:'var(--gd)',display:'inline-flex',alignItems:'center',gap:5}}>
                      <Ic name={modoParte(ej.parteObj.modo).icono} size={13}/> {textoModo(ej.parteObj)}
                    </span>)}
                {/* AÑADIR A SU SESION, en la cabecera del bloque: un cuadrado pequeño que
                    no ocupa sitio. Entra con las condiciones de este bloque. */}
                {ej.pos != null && (editaPlan || cambiaEj) && (
                  <button type="button" data-guia="taller-anadir" title="Añadir un ejercicio a este bloque de su sesión"
                    aria-label="Añadir un ejercicio a este bloque de su sesión"
                    onClick={e=>{ e.stopPropagation(); setAnadiendo({ pid: act.paciente.id, pi: Number(String(ej.pos).split('.')[0]) }); cargarCatalogo() }}
                    style={{width:30,height:30,borderRadius:'50%',border:0,background:'transparent',
                      color:'var(--gr)',cursor:'pointer',display:'inline-flex',alignItems:'center',justifyContent:'center',
                      fontFamily:'inherit',padding:0,flexShrink:0}}
                    onMouseOver={e=>(e.currentTarget as HTMLElement).style.background='#fff'}
                    onMouseOut={e=>(e.currentTarget as HTMLElement).style.background='transparent'}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M12 5v14M5 12h14"/></svg>
                  </button>
                )}
                {/* ORDENAR, junto a añadir: las flechas salen en cada ejercicio de la parte. */}
                {/* Desde el nivel 1: cambiar el orden en sala lo necesita cualquier entrenador. */}
                {ej.pos != null && delaParte.length > 1 && !plegada && (() => { const k = `${act.paciente.id}|${String(ej.pos).split('.')[0]}`; return (
                  <button type="button" title={ordenando === k ? 'Terminar de ordenar' : 'Ordenar: arrastra los ejercicios de esta parte'}
                    aria-label="Ordenar los ejercicios de esta parte"
                    onClick={e=>{ e.stopPropagation(); setOrdenando(ordenando === k ? null : k) }}
                    style={{width:30,height:30,borderRadius:'50%',border:0,background:ordenando === k ? 'var(--g)' : 'transparent',
                      color:ordenando === k ? '#fff' : 'var(--gr)',cursor:'pointer',display:'inline-flex',alignItems:'center',justifyContent:'center',padding:0,flexShrink:0}}>
                    {ordenando === k
                      ? <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12l5 5 9-10"/></svg>
                      : <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M7 4v16M3 8l4-4 4 4M17 20V4M13 16l4 4 4-4"/></svg>}
                  </button>) })()}
                {ej.parteObj && ej.pos == null && descansoDeParte(ej.parteObj) && (
                  <span style={{fontSize:12.5,color:'var(--gr)',display:'inline-flex',alignItems:'center',gap:5}}>
                    <Ic name="pausa" size={13}/> {descansoDeParte(ej.parteObj)!.texto} {descansoDeParte(ej.parteObj)!.cuando}
                  </span>
                )}
                {ej.parteObj && ej.pos == null && transicionDeParte(ej.parteObj) && (
                  <span style={{fontSize:12.5,color:'var(--gr)',display:'inline-flex',alignItems:'center',gap:5}}>
                    <Ic name="pausa" size={13}/> {transicionDeParte(ej.parteObj)!.texto} {transicionDeParte(ej.parteObj)!.cuando}
                  </span>
                )}
                {/* La flecha a la derecha: toda la cabecera pliega, la flecha solo lo dice. */}
                <span style={{marginLeft:'auto',display:'inline-flex',alignItems:'center',gap:8,fontSize:12,color:'var(--gr)'}}>
                  {plegada && <span>{delaParte.length} ejercicio{delaParte.length!==1?'s':''}</span>}
                  <Ic name="abajo" size={14} style={{transform:plegada?'rotate(-90deg)':'none',transition:'transform .15s'}}/>
                </span>
              </div>
            )}
            {plegada ? (
              /* Plegado se leen los nombres: sirve de recordatorio sin ocupar la pantalla. */
              <div style={{margin:'-3px 0 14px',paddingLeft:17,fontSize:11.5,color:'var(--grl)',lineHeight:1.6}}>
                {delaParte.map((o:any)=>o.ej.nombre).join(' · ')}
              </div>
            ) : <RejillaParte pacienteId={act.paciente.id} ejercicios={delaParte}
              superserie={ej.parteObj?.modo==='superserie'}
              mutarSerie={mutarSerie} desmarcarEj={desmarcarEj} setMaterial={cambiaEj ? setMaterial : undefined}
              onAceptarMedida={editaPlan ? (pos: string, t: string, n?: string) => aceptarMedida(act.paciente.id, pos, t, n) : undefined}
              setComent={setComent} toggleItem={toggleItem}
              marcarTodosItems={marcarTodosItems} itemMarcado={itemMarcado}
              addSerie={addSerie} quitarSerie={quitarSerie} setRegimen={cambiaEj ? setRegimen : undefined} setLado={cambiaEj ? setLado : undefined} setAgarre={cambiaEj ? setAgarre : undefined}
              setVolumen={cambiaEj ? setVolumen : undefined}
              molestias={(ctxPorPaciente[act.paciente.id]?.molestias)||[]}
              patologias={(ctxPorPaciente[act.paciente.id]?.patologias)||[]} etiquetas={etiquetas}
              objetivosLib={objetivosLib} objsPac={[...(objsPorPaciente[act.paciente.id]||[]), ...((sugPorPaciente||{})[act.paciente.id]||[]).map((id:string)=>({ objetivo_id: id, propuesta: true }))]}
              toggleObjetivo={cambiaEj ? toggleObjetivo : undefined}
              repetidos={repPorPaciente[act.paciente.id] || {}}
              paciente={{ id: act.paciente.id, nombre: act.paciente.nombre }}
              noHechos={leerNoHechos(act.paciente.id, act.sesionId)}
              onNoHecho={(i:number)=>alternarNoHecho(act.paciente.id, act.sesionId, i)}
              onSustituir={cambiaEj ? (i:number)=>abrirSustituir(act.paciente.id, i) : undefined}
              onCambiarA={cambiaEj ? (i:number, nuevo:any)=>sustituir(act.paciente.id, i, nuevo) : undefined}
              ordenando={ej.pos != null && ordenando === `${act.paciente.id}|${String(ej.pos).split('.')[0]}`}
              onMover={(pos:string, dir:-1|1)=>moverEnParte(act.paciente.id, pos, dir)}
              onMoverA={(pos:string, a:number)=>{ const [pi, pe] = String(pos).split('.').map(Number); return reordenarParte(act.paciente.id, pi, pe, a) }}
              desplegar={desplegar}/>}
            </div>
            )
          })}
        </div>
      )}</>)
}
