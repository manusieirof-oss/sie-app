'use client'
import ImagenEjercicio from '@/components/ImagenEjercicio'
import { Ic } from '@/lib/icons'
import ChapaEjecucion from './ChapaEjecucion'
import { ChapaComentario } from './ChapasEjercicio'
import Flotante from './Flotante'
import CasillaSeries from './CasillaSeries'
import { avisosDeCondiciones, tituloAviso } from '@/lib/avisosZona'
import { capacidadPorReps } from '@/lib/capacidades'
import PildoraRegimen, { LADOS } from './PildoraRegimen'
import MonedaObjetivo from '@/components/MonedaObjetivo'
import { useRef, useState } from 'react'
import { nombreMedida } from '@/lib/medida'
import ElegirMedida from '@/components/ElegirMedida'
import { createPortal } from 'react-dom'

// ---------------------------------------------------------------------------
// UNA PARTE ENTERA, DE IZQUIERDA A DERECHA
//
// Nacio para el circuito -que se anota cruzando- y resulto leerse mejor en
// todo lo demas: la parte completa de un vistazo, sin fondos ni recuadros, y
// las siguientes debajo.
//
// MANDA LA FOTO. En la sala el ejercicio se reconoce mirandolo, no leyendolo,
// asi que todo lo que antes ocupaba lineas bajo cada columna -ejecucion,
// feedbacks, comentario, serie a serie- vive ahora en chapas sobre la imagen o
// detras de la casilla. Lo unico que no se esconde es el aviso de molestia:
// eso hay que verlo sin pedirlo.
// ---------------------------------------------------------------------------

/** Mismo aspecto que las chapas de notas y feedback (ChapasEjercicio). */
const chapa = (pos: any): any => ({
  position: 'absolute', minWidth: 23, height: 23, borderRadius: 99,
  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 3,
  fontSize: 11, fontWeight: 600, fontFamily: 'inherit', padding: '0 6px',
  border: '2px solid var(--w)', cursor: 'pointer',
  boxShadow: '0 1px 5px rgba(38,40,37,.20)', ...pos,
})

export default function RejillaParte({ pacienteId, ejercicios, mutarSerie, setComent,
  toggleItem, marcarTodosItems, itemMarcado, objetivosLib = [], objsPac = [], toggleObjetivo,
  addSerie, quitarSerie, setRegimen, setLado, molestias = [], patologias = [], etiquetas = [],
  superserie = false, noHechos = [], onNoHecho, onSustituir, arreglar = false, onMedida }: any) {

  /* NI UNA BARRA DE SCROLL POR FILA. Si no caben en el ancho, bajan de linea:
     la parte se sigue leyendo de izquierda a derecha y nadie tiene que
     arrastrar nada en mitad de una clase. */
  /* EN SUPERSERIE, UNA FILA POR GRUPO: A arriba, B debajo... Todos seguidos no se
     veia donde acababa un par y empezaba el otro. Por letra y no por orden, por si
     estan guardados intercalados. */
  const grupos: { g: string, items: any[] }[] = []
  ejercicios.forEach((o: any) => {
    const g = superserie ? (o.ej.grupo || 'A') : ''
    const ya = grupos.find(x => x.g === g)
    if (ya) ya.items.push(o); else grupos.push({ g, items: [o] })
  })
  grupos.sort((a, b) => a.g.localeCompare(b.g))

  return (
    <div style={{ marginBottom: 14, paddingLeft: 14 }}>
      {grupos.map(gr => (
      <div key={gr.g || '-'} style={{ marginBottom: superserie ? 14 : 0 }}>
      {superserie && (
        <div style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--gd)', marginBottom: 6 }}>Grupo {gr.g}</div>
      )}
      <div style={{ display: 'grid', gap: 9,
        gridTemplateColumns: 'repeat(auto-fill, minmax(170px, 1fr))' }}>

        {gr.items.map(({ ej, ei }: any) => {
          const avisos = avisosDeCondiciones({ molestias, patologias }, etiquetas, ej.etiquetas || [])
          /* LA CAPACIDAD, SEGUN LO QUE DE VERDAD HACE. Prescribiste
             fuerza-resistencia, pero si acaba haciendo 25 repeticiones esta
             estimulando otra cosa y la etiqueta tiene que decirlo. Lo
             planificado se guarda como punto de partida en la chapa. */
          const reps = (ej.series || []).map((x: any) => parseInt(String(x?.reps || '')))
            .filter((n: number) => Number.isFinite(n) && n > 0)
          const mediaReps = reps.length > 0
            ? Math.round(reps.reduce((a: number, b: number) => a + b, 0) / reps.length) : null
          const capReal = mediaReps != null ? capacidadPorReps(mediaReps) : ''
          const capPlan = ej.plan?.capacidad || ''
          const capacidad = capReal || capPlan
          const cambiada = capReal !== '' && capPlan !== '' && capReal !== capPlan
          const noLoHizo = noHechos.includes(ei)
          return (
            <div key={ei} style={{ textAlign: 'center' }}>
              {/* LA FOTO, SIN MARCO Y LLENANDO. Con `contain` y un borde quedaba
                  una imagen pequeña dentro de un rectangulo, que es justo lo que
                  no queremos: manda la imagen. */}
              {/* NO LO HIZO: la foto se apaga y el nombre se tacha. Lo normal es hacerlo
                  todo, asi que es lo unico que se marca y tiene que verse de lejos. */}
              <div style={{ position: 'relative', display: 'block' }}>
                {/* Se apaga solo la foto: la chapa de "no lo hizo" tiene que seguir viva
                    para poder deshacerlo. */}
                <div style={{ opacity: noLoHizo ? .35 : 1, transition: 'opacity .15s', borderRadius: 12,
                  overflow: 'hidden', boxShadow: '0 2px 10px rgba(38,40,37,.10)' }}>
                {/* Su foto, o la figura con sus músculos, o el icono. */}
                <ImagenEjercicio insignias={false} src={ej.imagen_url} ejercicioId={ej.ejercicio_id} etiquetasEj={ej.etiquetas?.length ? ej.etiquetas : undefined}
                  radio={12} icono={34} alt={ej.nombre}/>
                </div>
                {/* CAMBIAR Y NO LO HIZO, EN UNA CHAPA. Las dos son "hoy no va como estaba
                    previsto", asi que comparten boton: un menu con las dos. Si ya no lo hizo,
                    la chapa lo dice y deshace con un toque. */}
                <ChapaHoy noLoHizo={noLoHizo}
                  onSustituir={onSustituir && !ej.guardado ? () => onSustituir(ei) : undefined}
                  onNoHecho={onNoHecho ? () => onNoHecho(ei) : undefined}/>
                <ChapaEjecucion ej={ej} itemMarcado={itemMarcado}
                  onToggle={(ii: number) => toggleItem(pacienteId, ei, ii)}
                  onTodos={(v: boolean) => marcarTodosItems(pacienteId, ei, v)}
                  objetivosLib={objetivosLib} objsPac={objsPac}
                  onObjetivo={toggleObjetivo ? (oid: string) => toggleObjetivo(pacienteId, oid, ej.ejercicio_id, ej.nombre) : undefined}/>
                <ChapaComentario pacienteId={pacienteId} ej={ej} ei={ei} setComent={setComent}/>
                <CasillaSeries pacienteId={pacienteId} ej={ej} ei={ei}
                  mutarSerie={mutarSerie} addSerie={addSerie} quitarSerie={quitarSerie}/>
              </div>

              <div style={{ fontSize: 12, marginTop: 7, lineHeight: 1.3 }}>
                {/* La letra solo significa algo si la parte es superserie. */}
                {/* Sin letra puesta, es del grupo A (así se agrupan): se dice también. */}
                {superserie && (
                  <span style={{ fontSize: 10.5, fontWeight: 700, padding: '1px 6px', borderRadius: 5,
                    background: 'var(--gl)', color: 'var(--gd)', marginRight: 5 }}>{ej.grupo || 'A'}</span>
                )}
                <span style={{ textDecoration: noLoHizo ? 'line-through' : 'none', color: noLoHizo ? 'var(--grl)' : undefined }}>{ej.nombre}</span>
                {ej.guardado && !noLoHizo && <span style={{ color: 'var(--g)', marginLeft: 4 }}>✓</span>}
              </div>
              {ej.propuesta && <ChipPropuesta p={ej.propuesta}/>}
              {arreglar && ej.ejercicio_id && onMedida && <div><MedidaRapida tipo={ej.tipo_medida} nombre={ej.nombre} onCambio={(t: string) => onMedida(ej.ejercicio_id, t)}/></div>}
              {/* PARA QUÉ ES. Los objetivos que trabaja este ejercicio, como se dejó en la
                  sesión: que en sala se vea para qué sirve lo que se está haciendo. */}
              <ObjetivosEj ids={ej.objetivos || []} objetivosLib={objetivosLib}/>
              {/* CAMBIADO HOY. Se dice de que se cambio: el plan sigue diciendo el otro. */}
              {ej.sustituye && (
                <div style={{ fontSize: 10.5, color: '#8A6410', marginTop: 2 }}>en lugar de {ej.sustituye}</div>
              )}
              {/* LA VARIANTE SE LEE. En 8px y gris claro pasaba por una etiqueta
                  cualquiera, y es lo que distingue este ejercicio de otro: a una
                  pierna no es lo mismo que a dos. */}
              {ej.variante && (
                <div style={{ fontSize: 11.5, marginTop: 3, color: 'var(--gd)', fontWeight: 500,
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4 }}>
                  <Ic name="etiqueta" size={11}/> {ej.variante}
                </div>
              )}
              {/* COMO SE HACE Y PARA QUE. Regimen -concentrico, isometrico,
                  excentrico- y capacidad -fuerza, fuerza resistencia, maxima-.
                  Estaban en el plan y no llegaban a la sala, que es donde hay que
                  saberlos. Mismos colores que en el editor de la sesion. */}
              {(
                <div style={{ display: 'flex', justifyContent: 'center', gap: 4, flexWrap: 'wrap',
                  marginTop: 4 }}>
                  {/* EL REGIMEN SE PUEDE CAMBIAR EN LA SALA. No sale de ningun
                      numero: si hoy lo hace excentrico, solo lo sabes mirandolo.
                      Se guarda con el registro de hoy, no toca la sesion. */}
                  {(ej.regimen || ej.plan?.regimen) && (
                    <PildoraRegimen ej={ej} onCambio={setRegimen ? (v: string) => setRegimen(pacienteId, ei, v) : undefined}/>
                  )}
                  {/* LATERALIDAD, igual que el regimen: a la vista y se cambia solo para hoy. */}
                  <PildoraRegimen ej={ej} campo="lado" opciones={LADOS} defecto="Bilateral" titulo="Lateralidad hoy"
                    color="#7A5800" borde="var(--amb)" onCambio={setLado ? (v: string) => setLado(pacienteId, ei, v) : undefined}/>
                  {capacidad && (
                    <span title={cambiada
                      ? `Planificado: ${capPlan} · está haciendo ${mediaReps} repeticiones`
                      : 'Capacidad'}
                      style={{ fontSize: 10.5, padding: '2px 9px', borderRadius: 99,
                        border: '1px solid var(--amb)',
                        color: cambiada ? '#fff' : '#7A5800',
                        background: cambiada ? 'var(--amb)' : 'var(--w)' }}>
                      {capacidad}
                    </span>
                  )}
                </div>
              )}
              {/* Solo el texto, sin recuadro: el color ya dice de donde viene
                  -rojo la patologia, ambar la molestia- y el rectangulo pesaba
                  mas que el aviso. */}
              {avisos.map((a: any, k: number) => (
                <div key={k} style={{ fontSize: 10, lineHeight: 1.4, marginTop: 4, textAlign: 'left',
                  color: a.clase === 'patologia' ? 'var(--rj, #B4544F)' : '#7A5800' }}>
                  ⚠ <b style={{ fontWeight: 600 }}>{tituloAviso(a)}</b>{a.nota ? ' — ' + a.nota : ''}
                </div>
              ))}
            </div>
          )
        })}
      </div>
      </div>
      ))}
    </div>
  )
}


/**
 * LOS OBJETIVOS DE UN EJERCICIO, PLEGADOS. Con tres o cuatro por ejercicio la tarjeta
 * se alargaba el doble y la rejilla dejaba de leerse. Sale el primero con su nombre y
 * un "+N"; pulsando se ven todos.
 */
function ObjetivosEj({ ids, objetivosLib }: { ids: string[], objetivosLib: any[] }) {
  const [abierto, setAbierto] = useState(false)
  const objs = ids.map(id => (objetivosLib || []).find((x: any) => x.id === id)).filter(Boolean)
  if (objs.length === 0) return null
  const vistos = abierto ? objs : objs.slice(0, 1)
  const resto = objs.length - 1
  const pastilla = (o: any) => (
    <span key={o.id} title={o.nombre}
      style={{ display: 'inline-flex', alignItems: 'center', gap: 4, maxWidth: '100%',
        padding: '1px 7px 1px 1px', borderRadius: 99, background: 'var(--gl)',
        border: '1px solid var(--gm)', fontSize: 10, color: 'var(--gd)' }}>
      <span style={{ lineHeight: 0, flexShrink: 0, transform: 'scale(.75)', margin: '-3px -3px' }}>
        <MonedaObjetivo objetivo={o} tam="mini" titulo="" />
      </span>
      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{o.nombre}</span>
    </span>
  )
  return (
    <div style={{ display: 'flex', gap: 3, flexWrap: 'wrap', justifyContent: 'center', marginTop: 4 }}>
      {vistos.map(pastilla)}
      {resto > 0 && (
        <button type="button" onClick={e => { e.stopPropagation(); setAbierto(v => !v) }}
          title={abierto ? 'Ver menos' : objs.slice(1).map((o: any) => o.nombre).join(' · ')}
          style={{ fontFamily: 'inherit', fontSize: 10, padding: '1px 8px', borderRadius: 99, cursor: 'pointer',
            border: '1px solid var(--gm)', background: 'var(--w)', color: 'var(--gd)', fontWeight: 600 }}>
          {abierto ? 'menos' : `+${resto}`}
        </button>
      )}
    </div>
  )
}


/**
 * "HOY NO VA COMO ESTABA": cambiar el ejercicio solo hoy o marcar que no lo hizo.
 * Arriba a la derecha, donde antes iba la chapa de feedbacks (que ahora va con la
 * de ejecucion). Si no lo hizo, la chapa lo dice y un toque lo deshace.
 */
function ChapaHoy({ noLoHizo, onSustituir, onNoHecho }: { noLoHizo: boolean, onSustituir?: () => void, onNoHecho?: () => void }) {
  const [abierto, setAbierto] = useState(false)
  const ancla = useRef<HTMLButtonElement>(null)
  if (!onSustituir && !onNoHecho) return null
  if (noLoHizo) return (
    <button type="button" onClick={e => { e.stopPropagation(); onNoHecho?.() }} aria-pressed
      title="No lo hizo · pulsa para deshacer"
      style={chapa({ right: 5, top: 5, background: 'var(--gr)', color: '#fff' })}>No lo hizo ↺</button>
  )
  const opcion = (icono: string, texto: string, fn?: () => void) => fn && (
    <button type="button" onClick={() => { setAbierto(false); fn() }}
      style={{ display: 'flex', alignItems: 'center', gap: 9, width: '100%', padding: '8px 6px', border: 'none',
        background: 'none', cursor: 'pointer', fontFamily: 'inherit', fontSize: 12.5, color: 'var(--n)',
        borderRadius: 8, textAlign: 'left' }}
      onMouseOver={e => (e.currentTarget.style.background = 'var(--bl)')}
      onMouseOut={e => (e.currentTarget.style.background = 'none')}>
      <span style={{ width: 22, textAlign: 'center', color: 'var(--gd)' }}>{icono}</span>{texto}
    </button>
  )
  return (
    <>
      <button ref={ancla} type="button" data-guia="taller-nolohizo" onClick={e => { e.stopPropagation(); setAbierto(v => !v) }}
        title="Cambiar solo hoy o marcar que no lo hizo"
        style={chapa({ right: 5, top: 5, background: abierto ? 'var(--g)' : 'var(--w)', color: abierto ? '#fff' : 'var(--gd)' })}>⇄</button>
      <Flotante abierto={abierto} ancla={ancla} onCerrar={() => setAbierto(false)} ancho={210}>
        {opcion('⇄', 'Cambiar solo hoy', onSustituir)}
        {opcion('⊘', 'No lo hizo', onNoHecho)}
      </Flotante>
    </>
  )
}

/**
 * COMO SE MIDE, desde la sala ("Arreglar ejercicios"): una pastilla con lo que hay
 * ahora y, al tocarla, el mismo panel que en el torno. Cambia la base del ejercicio.
 */
export function MedidaRapida({ tipo, nombre, onCambio }: { tipo?: string, nombre?: string, onCambio: (t: string) => void }) {
  const [abierto, setAbierto] = useState(false)
  return (<>
    <button type="button" onClick={() => setAbierto(true)} title="Cambiar cómo se mide (en la biblioteca)"
      style={{ marginTop: 6, fontFamily: 'inherit', fontSize: 11.5, padding: '4px 10px', borderRadius: 99, cursor: 'pointer',
        border: '1.5px dashed var(--amb)', background: 'var(--ambl)', color: '#7A5800', display: 'inline-flex', alignItems: 'center', gap: 5 }}>
      <Ic name="regla" size={12}/> {nombreMedida(tipo)}
    </button>
    {abierto && createPortal(
      <div className="modal-bg" style={{ zIndex: 160 }} onClick={e => { if (e.target === e.currentTarget) setAbierto(false) }}>
        <div style={{ width: 'min(520px, 94vw)', background: '#fff', borderRadius: 22, boxShadow: '0 18px 50px rgba(38,40,37,.22)', overflow: 'hidden', textAlign: 'left' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '16px 20px', boxShadow: '0 6px 10px -8px rgba(38,40,37,.18)' }}>
            <span style={{ color: 'var(--g)', lineHeight: 0 }}><Ic name="regla" size={20}/></span>
            <span style={{ flex: 1, minWidth: 0 }}>
              <span style={{ fontSize: 17, display: 'block' }}>Cómo se mide</span>
              {nombre && <span style={{ fontSize: 12, color: 'var(--grl)', display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{nombre} · se cambia en la biblioteca</span>}
            </span>
            <button className="btn btn-p btn-sm" onClick={() => setAbierto(false)}>Hecho</button>
          </div>
          <div style={{ padding: '16px 20px 20px', background: 'var(--bl)' }}>
            <ElegirMedida tipo={tipo || 'peso_reps'} onCambio={onCambio}/>
          </div>
        </div>
      </div>, document.body)}
  </>)
}

/** "▲ +3 % · creciente" bajo el ejercicio: la carga de partida viene del plan, no solo de la ultima vez. */
export function ChipPropuesta({ p }: { p: any }) {
  const sube = p.tipo === 'sube' && !/no sube/.test(p.motivo)
  return (
    <div title={`Propuesta de hoy: ${p.motivo}. Cámbiala si no te vale.`}
      style={{ fontSize: 11.5, marginTop: 3, color: sube ? '#3F6E2E' : '#8A6410', fontWeight: 600 }}>
      {/no sube/.test(p.motivo) ? '■' : sube ? '▲' : '▼'} {/no sube/.test(p.motivo) ? '' : `${p.pct > 0 ? '+' : ''}${String(p.pct).replace('.', ',')} % · `}{p.motivo}
    </div>
  )
}
