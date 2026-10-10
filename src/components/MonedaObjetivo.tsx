'use client'

/**
 * La moneda de un objetivo. UNA SOLA, para todos los sitios donde aparece.
 *
 * Un objetivo se reconoce por su foto, no por su nombre: en la ficha del paciente son
 * monedas, y en las sesiones eran píldoras de color con el nombre escrito. La misma cosa
 * dibujada de dos formas obliga a reconocerla dos veces, y en una lista de ocho sesiones
 * eso es leer ocho renglones para saber qué trabaja cada una.
 *
 * Tres tamaños y ninguna decisión más: `mini` para meterla en una fila junto a otras
 * pastillas, el normal para una lista, `g` para la rejilla donde se eligen.
 */
export default function MonedaObjetivo({ objetivo, tam = 'normal', titulo }: {
  objetivo: any
  tam?: 'mini' | 'normal' | 'g'
  /** Texto del tooltip. Por defecto, el nombre — que es lo que la moneda no dice. */
  titulo?: string
}) {
  const clase = tam === 'normal' ? 'obj-moneda' : `obj-moneda ${tam}`
  return (
    <span className={clase} title={titulo ?? objetivo?.nombre}
      style={{
        // ESFERA, como en la ficha: todo objetivo se pinta como una bola, no como un aro.
        background: objetivo?.imagen_url ? 'var(--bl)'
          : 'radial-gradient(circle at 33% 28%, #fff 0%, var(--gm) 22%, var(--g) 60%, var(--gd) 100%)',
        borderWidth: 0,
        boxShadow: 'inset -2px -4px 7px rgba(0,0,0,.18), 0 2px 5px rgba(38,40,37,.22)',
        // Apagada si ya está logrado: se sigue viendo que la sesión lo trabajaba,
        // pero no compite con lo que queda abierto.
        opacity: objetivo?.logrado ? .55 : 1,
      }}>
      {objetivo?.imagen_url
        ? <img src={objetivo.imagen_url} alt="" />
        : <b style={{ color: '#fff', textShadow: '0 1px 2px rgba(0,0,0,.3)' }}>{String(objetivo?.nombre || '?').trim().charAt(0).toUpperCase()}</b>}
    </span>
  )
}
