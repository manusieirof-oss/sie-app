// ---------------------------------------------------------------------------
// LO QUE CAMBIA UN DÍA, SIN TOCAR EL PLAN
//
// Un paciente con dieciséis citas hace ocho sesiones con los mismos objetivos, y
// cada pocas semanas se le cambia un ejercicio o dos —por varianza, o porque así
// se estimula mejor lo que se busca. Eso no es una sesión nueva ni una corrección
// de la vieja: es una desviación de UN DÍA.
//
// Hasta ahora había dos salidas y las dos mentían. Editar la sesión hacía que las
// citas ya hechas dijeran que se hizo algo que no se hizo —la sesión es una fila
// compartida por todas sus citas—; y no tocar nada obligaba a acordarse de memoria.
//
// TRES CAPAS QUE NO SE PISAN:
//
//   sesión  → el plan. Una, y no se mueve.
//   cita    → lo previsto para ese día. Solo la diferencia.
//   registro→ lo que de verdad se hizo. Ya existía, en `registros_ejercicio`.
//
// LA CLAVE ES `parte.ejercicio` por posición y no el `ejercicio_id`, porque el
// mismo ejercicio puede salir dos veces en la misma sesión y habría que decidir
// a cuál de las dos se refiere el ajuste. Si la sesión cambia de estructura, el
// ajuste que apunte a un hueco que ya no existe se ignora: peor sería aplicarlo
// al ejercicio que haya caído en esa posición.
// ---------------------------------------------------------------------------

/** Lo que se puede desviar un día. Todo lo demás es plan y no se toca aquí. */
export const CAMPOS_AJUSTABLES = [
  { id: 'variante',  nombre: 'Variante' },
  { id: 'series',    nombre: 'Series' },
  { id: 'reps',      nombre: 'Reps' },
  { id: 'peso',      nombre: 'Peso' },
  { id: 'tiempo',    nombre: 'Tiempo' },
  { id: 'descanso',  nombre: 'Descanso' },
  { id: 'regimen',   nombre: 'Régimen' },
  { id: 'capacidad', nombre: 'Capacidad' },
  { id: 'nota',      nombre: 'Nota' },
] as const

export type CampoAjustable = typeof CAMPOS_AJUSTABLES[number]['id']
export type AjusteEj = Partial<Record<CampoAjustable, string>> & { nombre?: string }
export type AjustesCita = { v: 1, ejercicios: Record<string, AjusteEj> }

export const clave = (pi: number, ei: number) => `${pi}.${ei}`

const txt = (x: unknown) => String(x ?? '').trim()

/** true si no hay ninguna desviación guardada. */
export function sinAjustes(a?: AjustesCita | null): boolean {
  return !a || !a.ejercicios || Object.keys(a.ejercicios).length === 0
}

/**
 * La sesión tal como toca ESE día: el plan con las desviaciones puestas.
 *
 * Devuelve una copia. La sesión que llega no se toca nunca, ni siquiera por
 * dentro: es el objeto que otras pantallas están enseñando a la vez.
 */
export function aplicarAjustes(sesion: any, ajustes?: AjustesCita | null): any {
  if (!sesion || sinAjustes(ajustes)) return sesion
  const partes = (sesion.partes || []).map((p: any, pi: number) => ({
    ...p,
    ejercicios: (p.ejercicios || []).map((ej: any, ei: number) => {
      const a = ajustes!.ejercicios[clave(pi, ei)]
      if (!a) return ej
      const copia = { ...ej }
      CAMPOS_AJUSTABLES.forEach(c => {
        if (a[c.id] !== undefined) copia[c.id] = a[c.id]
      })
      return copia
    }),
  }))
  return { ...sesion, partes }
}

/**
 * Qué cambió entre el plan y lo que se acaba de guardar desde una cita.
 *
 * Solo campos, y solo de ejercicios que siguen en su sitio. Añadir o quitar un
 * ejercicio un día concreto NO es un ajuste: eso es otra sesión, y mezclarlo
 * aquí haría que un ajuste pudiera contradecir al plan en vez de matizarlo.
 */
export function calcularAjustes(base: any, editada: any): AjustesCita {
  const out: AjustesCita = { v: 1, ejercicios: {} }
  ;(base?.partes || []).forEach((p: any, pi: number) => {
    const pe = editada?.partes?.[pi]
    if (!pe) return
    ;(p.ejercicios || []).forEach((ej: any, ei: number) => {
      const ee = pe.ejercicios?.[ei]
      if (!ee) return
      // Si en esa posición hay otro ejercicio, no es un ajuste: es otra sesión.
      if (txt(ee.ejercicio_id) !== txt(ej.ejercicio_id)) return
      const dif: AjusteEj = {}
      CAMPOS_AJUSTABLES.forEach(c => {
        if (txt(ee[c.id]) !== txt(ej[c.id])) dif[c.id] = txt(ee[c.id])
      })
      if (Object.keys(dif).length > 0) {
        dif.nombre = ej.nombre || ''
        out.ejercicios[clave(pi, ei)] = dif
      }
    })
  })
  return out
}

/**
 * Los cambios en palabras, para el historial: "Press de banca · Bilateral → Unilateral".
 *
 * Se lee contra la sesión base para poder decir de qué a qué. Si el ajuste apunta
 * a un ejercicio que ya no está en esa posición, se usa el nombre que el propio
 * ajuste guardó el día que se hizo: enseñar el de ahora sería contar otra historia.
 */
export function resumenAjustes(base: any, ajustes?: AjustesCita | null) {
  if (sinAjustes(ajustes)) return []
  const nombreCampo = (id: string) => CAMPOS_AJUSTABLES.find(c => c.id === id)?.nombre || id
  return Object.entries(ajustes!.ejercicios).map(([k, a]) => {
    const [pi, ei] = k.split('.').map(Number)
    const ej = base?.partes?.[pi]?.ejercicios?.[ei]
    const mismo = ej && txt(ej.nombre) === txt(a.nombre)
    return {
      clave: k,
      nombre: (mismo ? ej.nombre : a.nombre) || 'Ejercicio',
      cambios: CAMPOS_AJUSTABLES
        .filter(c => a[c.id] !== undefined)
        .map(c => ({
          campo: nombreCampo(c.id),
          de: mismo ? txt(ej[c.id]) : '',
          a: txt(a[c.id]),
        })),
    }
  })
}
