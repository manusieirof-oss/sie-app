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

/* PALABRAS QUE NO CUENTAN AL BUSCAR. Se escribe "estiramiento espalda" y el ejercicio
   se llama "Estiramiento de espalda": sin esto no salía nada. */
const RELLENO = new Set(['de', 'del', 'con', 'en', 'el', 'la', 'los', 'las', 'a', 'al', 'y', 'e', 'o', 'u', 'por', 'para', 'sin', 'sobre', 'un', 'una'])

/** `aguja` dentro de `pajar`, sin que los acentos estorben. Si no está tal cual, vale
 *  también si están TODAS sus palabras (en cualquier orden y sin "de", "con"...):
 *  "estiramiento espalda" encuentra "Estiramiento de espalda". */
export const contiene = (pajar: unknown, aguja: unknown) => {
  const p = normalizar(pajar), a = normalizar(aguja).trim()
  if (p.includes(a)) return true
  const palabras = a.split(/[\s·,.;:/-]+/).filter(w => w && !RELLENO.has(w))
  return palabras.length > 0 && palabras.every(w => p.includes(w))
}
