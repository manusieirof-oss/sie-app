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
  addSerie, quitarSerie, setRegimen, molestias = [], patologias = [], etiquetas = [],
  superserie = false, noHechos = [], onNoHecho, onSustituir, onAnadir }: any) {

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
                <div style={{ opacity: noLoHizo ? .35 : 1, transition: 'opacity .15s' }}>
                {ej.imagen_url
                  ? <img src={ej.imagen_url} alt={ej.nombre}
                      style={{ width: '100%', aspectRatio: '1 / 1', objectFit: 'cover',
                        borderRadius: 10, display: 'block' }}/>
                  : <div style={{ width: '100%', aspectRatio: '1 / 1', background: 'var(--bm)', borderRadius: 10,
                      display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--grl)' }}>
                      <Ic name="fuerza" size={34}/>
                    </div>}
                </div>
                {/* CAMBIAR Y NO LO HIZO, COMO CHAPAS EN LA FOTO, igual que notas y series.
                    Eran botones de texto bajo el nombre y alargaban cada tarjeta. */}
                {onSustituir && !ej.guardado && !noLoHizo && (
                  <button type="button" onClick={e => { e.stopPropagation(); onSustituir(ei) }}
                    title="Cambiar este ejercicio solo hoy" aria-label="Cambiar este ejercicio solo hoy"
                    style={chapa({ left: 5, top: 33, background: 'var(--w)', color: 'var(--gd)' })}>⇄</button>
                )}
                {onNoHecho && (
                  <button type="button" onClick={e => { e.stopPropagation(); onNoHecho(ei) }} aria-pressed={noLoHizo}
                    title={noLoHizo ? 'No lo hizo · pulsa para deshacer' : 'Marcar que no lo hizo'}
                    style={chapa({ right: 5, top: 33,
                      background: noLoHizo ? 'var(--gr)' : 'var(--w)', color: noLoHizo ? '#fff' : 'var(--grl)' })}>
                    {noLoHizo ? 'No lo hizo ↺' : '⊘'}
                  </button>
                )}
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
      ))}
      {/* AÑADIR A SU SESION, al final del bloque: entra con sus condiciones. */}
      {onAnadir && ejercicios[0]?.ej?.pos != null && (
        <button type="button" onClick={() => onAnadir(Number(String(ejercicios[0].ej.pos).split('.')[0]))}
          style={{ marginTop: 8, fontFamily: 'inherit', fontSize: 11.5, cursor: 'pointer', borderRadius: 99, padding: '3px 11px',
            border: '1px dashed var(--gm)', background: 'transparent', color: 'var(--gd)' }}>
          + Añadir ejercicio a su sesión
        </button>
      )}
    </div>
  )
}
