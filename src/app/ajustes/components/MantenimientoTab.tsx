'use client'
import { Ic } from '@/lib/icons'

/**
 * Las páginas de montaje del catálogo, reunidas.
 *
 * Existían desde el principio pero sin ningún enlace: había que escribir la dirección
 * a mano cada vez. No son ajustes de la clínica, así que van en su propia pestaña y con
 * el orden a la vista, que es lo único que hay que respetar:
 *
 *   ejercicios → sesiones → tests
 *
 * Cada paso se apoya en el anterior y ninguno avisa si se hace al revés más allá de su
 * propia comprobación previa: los tests buscan sus sesiones por nombre igual que las
 * sesiones buscan los ejercicios.
 *
 * EL SEMBRADOR DE ETIQUETAS SE RETIRÓ. Llevaba listas de MOVER, RENOMBRAR y FUSIONAR
 * escritas para arreglar el árbol a mano en su día. Desde que las etiquetas se editan en
 * Biblioteca → Etiquetas, ejecutarlo volvería a aplicar aquellas instrucciones y
 * desharía los cambios hechos desde la app, sin avisar. Un botón que puede deshacer tu
 * trabajo callando es peor que no tenerlo.
 */

const PASOS = [
  {
    n: '1', href: '/entrenamiento/sembrar', icono: 'fuerza',
    titulo: 'Sembrar ejercicios',
    texto: 'Da de alta el catálogo con sus descripciones, criterios, feedbacks, etiquetas y variantes. Hay que seleccionar las imágenes de la carpeta; los que ya existan se actualizan.',
  },
  {
    n: '2', href: '/entrenamiento/sembrar-sesiones', icono: 'lista',
    titulo: 'Sembrar sesiones genéricas',
    texto: 'Crea las plantillas de sesión, sin paciente. Necesita los ejercicios ya sembrados, porque los busca por nombre. Las sesiones ya asignadas a alguien no se tocan nunca.',
  },
  {
    n: '3', href: '/entrenamiento/sembrar-tests', icono: 'test',
    titulo: 'Sembrar tests y objetivos',
    texto: 'Crea los tests de valoración, los objetivos que abren al dar positivo y el enlace de cada objetivo con las sesiones que lo trabajan. Va detrás de las sesiones: si no existen, el objetivo se queda sin nada con que entrenarse.',
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
