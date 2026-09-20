// ---------------------------------------------------------------------------
// COMPARAR TEXTO COMO LO ESCRIBE LA GENTE
//
// Nadie teclea los acentos al buscar. Se escribe "muniz", "sueiro alves",
// "valinas", y la lista se quedaba vacia aunque la persona estuviera ahi: el
// nombre guardado lleva tilde y el `includes` compara caracter a caracter.
//
// Se normaliza LOS DOS LADOS. Normalizar solo lo tecleado no arregla nada.
//
// La enye se descompone tambien —"Muñiz" queda "muniz"—, y eso es lo que se
// quiere: quien busca "muniz" espera encontrarla.
// ---------------------------------------------------------------------------

/** Minusculas y sin tildes. Para comparar, nunca para guardar ni para mostrar. */
export const normalizar = (s: unknown) =>
  String(s ?? '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')

/** `aguja` dentro de `pajar`, sin que los acentos estorben. */
export const contiene = (pajar: unknown, aguja: unknown) =>
  normalizar(pajar).includes(normalizar(aguja))
