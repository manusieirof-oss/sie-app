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
        background: objetivo?.imagen_url ? 'var(--bl)' : 'var(--gl)',
        // Gris y apagada si ya está logrado: se sigue viendo que la sesión lo trabajaba,
        // pero no compite con lo que queda abierto.
        borderColor: objetivo?.logrado ? 'var(--gm)' : 'var(--g)',
        opacity: objetivo?.logrado ? .55 : 1,
      }}>
      {objetivo?.imagen_url
        ? <img src={objetivo.imagen_url} alt="" />
        : <b style={{ color: 'var(--g)' }}>{String(objetivo?.nombre || '?').trim().charAt(0).toUpperCase()}</b>}
    </span>
  )
}
