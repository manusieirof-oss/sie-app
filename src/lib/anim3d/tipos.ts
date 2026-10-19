/**
 * ANIMACIONES 3D DE LOS EJERCICIOS · tipos compartidos.
 *
 * Un ejercicio de la biblioteca guarda qué MOVIMIENTO hace y con qué PARÁMETROS
 * (`ejercicios.animacion = { mov, p }`). El movimiento sabe construir la animación
 * concreta: no es lo mismo una zancada atrás que una búlgara o una con deslizador
 * lateral, aunque compartan casi todo.
 *
 * Una animación son poses clave a lo largo de UNA repetición (t de 0 a 1). Entre
 * clave y clave el visor interpola. Los ángulos van en grados por hueso [x, y, z]:
 *   · x: dobla hacia delante/atrás. Muslo y brazo negativos = hacia delante;
 *     rodilla positiva = doblar; codo negativo = doblar.
 *   · z: abre hacia los lados. Lado D positivo, lado I negativo.
 * D es el lado +x del modelo (a la derecha de quien mira de frente).
 */

export type Angulos = [number, number, number]
export type Pose = Record<string, Angulos>          // incluye 'raiz' (la cadera, que mueve todo)

export interface Clave {
  t: number
  fase?: string                                      // lo que se lee en pantalla desde esta clave
  p: Pose
}

/** Lo que toca el suelo (o el banco) y no se mueve. Ver resuelve() en motor.ts. */
export interface Apoyo {
  a: string[]                                        // huesos clavados (se traslada el cuerpo)
  aY?: number                                        // a qué altura; si no, la de la primera pose
  b?: string[]                                       // segundo apoyo: se consigue inclinando el cuerpo
  bY?: number
  bEje?: 'x' | 'z'                                   // inclinarlo hacia delante (x, por defecto) o de lado (z)
}

export type TipoProp =
  | 'banco' | 'cajon' | 'silla' | 'pared' | 'esterilla'
  | 'mancuerna' | 'kettlebell' | 'disco' | 'barra' | 'deslizador' | 'cuna' | 'pelota' | 'banda'

/**
 * Material y mobiliario.
 *  · en: un hueso → va pegado a él (una mancuerna en la mano).
 *  · entre: dos huesos → se coloca entre ambos cada fotograma (barra cogida con las dos manos).
 *  · bajo: un hueso → se coloca una vez debajo de él en la clave indicada (el banco
 *    bajo el pie de atrás en la búlgara) y ya no se mueve.
 *  · pos: fijo en el mundo.
 */
export interface Prop {
  tipo: TipoProp
  en?: string
  entre?: [string, string]
  bajo?: string
  clave?: number
  pos?: [number, number, number]
  off?: [number, number, number]                     // desplazamiento (en el hueso o respecto al punto)
  rot?: [number, number, number]                     // grados
  hueco?: number                                     // para "bajo": cuánto queda entre el hueso y la superficie
  alto?: number                                      // altura del cajón/escalón (por defecto, la de un cajón)
  ancho?: number
}

export interface Animacion {
  dur: number                                        // segundos por repetición
  claves: Clave[]
  apoyo?: Apoyo
  suelo?: boolean                                    // ejercicio tumbado/a cuatro patas: cámara alta y esterilla
  cam?: { alto?: number, dist?: number, y?: number }
  props?: Prop[]
  ik?: { pierna: 'D' | 'I', pie?: number }[]          // piernas cuyo pie se queda clavado (pie = ángulo del pie en el mundo)
  musculos: [string, string][]                       // [id del músculo en el modelo, nombre]; los 2 primeros, principales
}

export interface Parametro {
  id: string
  nombre: string
  opciones: [string, string][]                       // [valor, etiqueta]
}

export interface Movimiento {
  id: string
  nombre: string
  params: Parametro[]
  crear: (p: Record<string, string>) => Animacion
}

/** Lo que se guarda en `ejercicios.animacion`. `mov: 'ninguno'` = sin animación a propósito. */
export interface AnimEjercicio {
  mov: string
  p?: Record<string, string>
}
