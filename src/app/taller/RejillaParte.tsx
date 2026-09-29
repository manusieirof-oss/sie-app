'use client'
import { Ic } from '@/lib/icons'
import ChapaEjecucion from './ChapaEjecucion'
import { ChapaFeedback, ChapaComentario } from './ChapasEjercicio'
import CasillaSeries from './CasillaSeries'
import { avisosDeEjercicio, tituloAviso } from '@/lib/avisosZona'

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
  addSerie, quitarSerie, molestias = [], etiquetas = [], superserie = false }: any) {

  /* NI UNA BARRA DE SCROLL POR FILA. Si no caben en el ancho, bajan de linea:
     la parte se sigue leyendo de izquierda a derecha y nadie tiene que
     arrastrar nada en mitad de una clase. */
  return (
    <div style={{ marginBottom: 14, paddingLeft: 14 }}>
      <div style={{ display: 'grid', gap: 9,
        gridTemplateColumns: 'repeat(auto-fill, minmax(170px, 1fr))' }}>

        {ejercicios.map(({ ej, ei }: any) => {
          const avisos = avisosDeEjercicio(molestias, etiquetas, ej.etiquetas || [])
          return (
            <div key={ei} style={{ textAlign: 'center' }}>
              {/* LA FOTO, SIN MARCO Y LLENANDO. Con `contain` y un borde quedaba
                  una imagen pequeña dentro de un rectangulo, que es justo lo que
                  no queremos: manda la imagen. */}
              <div style={{ position: 'relative', display: 'block' }}>
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
                {ej.nombre}
                {ej.guardado && <span style={{ color: 'var(--g)', marginLeft: 4 }}>✓</span>}
              </div>
              {ej.variante && (
                <div style={{ fontSize: 8, marginTop: 2 }}>
                  <span style={{ padding: '1px 5px', borderRadius: 99, background: 'var(--gl)', color: 'var(--gd)' }}>{ej.variante}</span>
                </div>
              )}
              {ej.plan?.nota && (
                <div style={{ fontSize: 9.5, color: '#7A5800', background: 'var(--ambl)',
                  border: '1px solid var(--amb)', borderRadius: 6, padding: '4px 7px', marginTop: 5,
                  lineHeight: 1.45, fontStyle: 'italic', textAlign: 'left' }}>{ej.plan.nota}</div>
              )}
              {avisos.map((a: any, k: number) => (
                <div key={k} style={{ fontSize: 9, lineHeight: 1.4, marginTop: 4, textAlign: 'left',
                  background: 'var(--ambl)', color: '#7A5800', border: '1px solid var(--amb)',
                  borderRadius: 5, padding: '3px 6px' }}>
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
