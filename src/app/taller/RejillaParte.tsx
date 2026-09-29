'use client'
import { Ic } from '@/lib/icons'
import ChapaEjecucion from './ChapaEjecucion'
import { ChapaFeedback, ChapaComentario } from './ChapasEjercicio'
import CasillaSeries from './CasillaSeries'
import { avisosDeCondiciones, tituloAviso } from '@/lib/avisosZona'
import { capacidadPorReps } from '@/lib/capacidades'
import PildoraRegimen from './PildoraRegimen'

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

export default function RejillaParte({ pacienteId, ejercicios, mutarSerie, setComent,
  toggleItem, marcarTodosItems, itemMarcado, objetivosLib = [], objsPac = [], toggleObjetivo,
  addSerie, quitarSerie, setRegimen, molestias = [], patologias = [], etiquetas = [],
  superserie = false, noHechos = [], onNoHecho }: any) {

  /* NI UNA BARRA DE SCROLL POR FILA. Si no caben en el ancho, bajan de linea:
     la parte se sigue leyendo de izquierda a derecha y nadie tiene que
     arrastrar nada en mitad de una clase. */
  return (
    <div style={{ marginBottom: 14, paddingLeft: 14 }}>
      <div style={{ display: 'grid', gap: 9,
        gridTemplateColumns: 'repeat(auto-fill, minmax(170px, 1fr))' }}>

        {ejercicios.map(({ ej, ei }: any) => {
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
              <div style={{ position: 'relative', display: 'block', opacity: noLoHizo ? .35 : 1, transition: 'opacity .15s' }}>
                {ej.imagen_url
                  ? <img src={ej.imagen_url} alt={ej.nombre}
                      style={{ width: '100%', aspectRatio: '1 / 1', objectFit: 'cover',
                        borderRadius: 10, display: 'block' }}/>
                  : <div style={{ width: '100%', aspectRatio: '1 / 1', background: 'var(--bm)', borderRadius: 10,
                      display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--grl)' }}>
                      <Ic name="fuerza" size={34}/>
                    </div>}
                <ChapaEjecucion ej={ej} itemMarcado={itemMarcado}
                  onToggle={(ii: number) => toggleItem(pacienteId, ei, ii)}
                  onTodos={(v: boolean) => marcarTodosItems(pacienteId, ei, v)}
                  objetivosLib={objetivosLib} objsPac={objsPac}
                  onObjetivo={(oid: string) => toggleObjetivo(pacienteId, oid, ej.ejercicio_id, ej.nombre)}/>
                <ChapaFeedback ej={ej}/>
                <ChapaComentario pacienteId={pacienteId} ej={ej} ei={ei} setComent={setComent}/>
                <CasillaSeries pacienteId={pacienteId} ej={ej} ei={ei}
                  mutarSerie={mutarSerie} addSerie={addSerie} quitarSerie={quitarSerie}/>
              </div>

              <div style={{ fontSize: 12, marginTop: 7, lineHeight: 1.3 }}>
                {/* La letra solo significa algo si la parte es superserie. */}
                {superserie && ej.grupo && (
                  <span style={{ fontSize: 8, fontWeight: 600, padding: '1px 5px', borderRadius: 4,
                    background: 'var(--gl)', color: 'var(--gd)', marginRight: 5 }}>{ej.grupo}</span>
                )}
                <span style={{ textDecoration: noLoHizo ? 'line-through' : 'none', color: noLoHizo ? 'var(--grl)' : undefined }}>{ej.nombre}</span>
                {ej.guardado && !noLoHizo && <span style={{ color: 'var(--g)', marginLeft: 4 }}>✓</span>}
              </div>
              {onNoHecho && (
                <button type="button" onClick={() => onNoHecho(ei)} aria-pressed={noLoHizo}
                  style={{ marginTop: 4, fontFamily: 'inherit', fontSize: 10.5, cursor: 'pointer', borderRadius: 99, padding: '2px 9px',
                    border: `1px solid ${noLoHizo ? 'var(--gr)' : 'var(--bd)'}`,
                    background: noLoHizo ? 'var(--gr)' : 'transparent', color: noLoHizo ? '#fff' : 'var(--grl)' }}>
                  {noLoHizo ? 'No lo hizo · deshacer' : 'No lo hizo'}
                </button>
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
              {(ej.plan?.regimen || capacidad) && (
                <div style={{ display: 'flex', justifyContent: 'center', gap: 4, flexWrap: 'wrap',
                  marginTop: 4 }}>
                  {/* EL REGIMEN SE PUEDE CAMBIAR EN LA SALA. No sale de ningun
                      numero: si hoy lo hace excentrico, solo lo sabes mirandolo.
                      Se guarda con el registro de hoy, no toca la sesion. */}
                  {(ej.regimen || ej.plan?.regimen) && (
                    <PildoraRegimen ej={ej} onCambio={(v: string) => setRegimen?.(pacienteId, ei, v)}/>
                  )}
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
  )
}
