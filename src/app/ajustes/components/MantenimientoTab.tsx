'use client'
import { Ic } from '@/lib/icons'

/**
 * Las páginas de montaje del catálogo, reunidas.
 *
 * Existían desde el principio pero sin ningún enlace: había que escribir la dirección
 * a mano cada vez, y con cuatro páginas eso ya era pedir que te acuerdes de cuatro
 * rutas. No son ajustes de la clínica, así que van en su propia pestaña y con el orden
 * a la vista: **etiquetas antes que ejercicios, y ejercicios antes que sesiones**, que
 * es lo único que hay que respetar.
 */

const PASOS = [
  {
    n: '1', href: '/entrenamiento/sembrar-etiquetas', icono: 'etiqueta',
    titulo: 'Ajustar etiquetas',
    texto: 'Mueve las que están en la categoría equivocada, renombra las que chocan, fusiona duplicados y crea las que faltan. Va primero porque los ejercicios se etiquetan con ellas.',
  },
  {
    n: '2', href: '/entrenamiento/sembrar', icono: 'fuerza',
    titulo: 'Sembrar ejercicios',
    texto: 'Da de alta el catálogo con sus descripciones, criterios, feedbacks, etiquetas y variantes. Hay que seleccionar las imágenes de la carpeta; los que ya existan se actualizan.',
  },
  {
    n: '3', href: '/entrenamiento/sembrar-sesiones', icono: 'lista',
    titulo: 'Sembrar sesiones genéricas',
    texto: 'Crea las plantillas de sesión, sin paciente. Necesita los ejercicios ya sembrados, porque los busca por nombre. Las sesiones ya asignadas a alguien no se tocan nunca.',
  },
  {
    n: '·', href: '/entrenamiento/limpiar', icono: 'papelera',
    titulo: 'Limpiar la biblioteca',
    texto: 'Borra los ejercicios que no están en la semilla. Los que tengan histórico de ejecución salen desmarcados: el catálogo se vuelve a sembrar, ese histórico no.',
    peligro: true,
  },
]

export default function MantenimientoTab() {
  return (
    <div className="panel">
      <div className="sec">
        <div className="sec-h">
          <span className="sh-l"><span className="ct-l"><Ic name="ajustes" size={13} /> Montaje del catálogo</span></span>
        </div>
        <p style={{ fontSize: 13, color: 'var(--gr)', lineHeight: 1.6, marginBottom: 14 }}>
          Estas páginas se usan al montar la app o al añadir un bloque nuevo, no en el día
          a día. Todas se pueden relanzar: lo que ya esté hecho lo saltan.
        </p>

        {PASOS.map(p => (
          <a key={p.href} href={p.href} className="fila-p"
            style={{
              display: 'flex', gap: 12, alignItems: 'flex-start', marginBottom: 6,
              textDecoration: 'none', borderLeftColor: p.peligro ? 'var(--red)' : 'var(--g)',
            }}>
            <span style={{
              flexShrink: 0, width: 22, height: 22, borderRadius: '50%',
              background: p.peligro ? 'var(--redl)' : 'var(--gl)',
              color: p.peligro ? 'var(--red)' : 'var(--gd)',
              display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12,
            }}>{p.n}</span>
            <span style={{ flex: 1 }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, color: 'var(--n)' }}>
                <Ic name={p.icono} size={13} /> {p.titulo}
              </span>
              <span style={{ display: 'block', fontSize: 12, color: 'var(--gr)', lineHeight: 1.6, marginTop: 2 }}>
                {p.texto}
              </span>
            </span>
          </a>
        ))}
      </div>
    </div>
  )
}
