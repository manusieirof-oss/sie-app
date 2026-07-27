# Propuesta de árbol de etiquetas · Biblioteca de ejercicios

Punto de partida para acordarlo. **Revísalo y dime qué sobra, qué falta y qué llamarías
de otra forma** — lo que importa es que los nombres sean los que tú usas al hablar, no
los del libro.

Las nueve categorías ya están fijadas en el código (`lib/etiquetas.ts`). Lo que se
decide aquí son las etiquetas de dentro.

## Cómo las usa la app

No todas pesan igual:

- **Músculo, Articulación, Movimiento y Patología** deciden qué ejercicios son
  *parecidos*. Son las que de verdad describen el gesto.
- **Material, Posición, Apoyo, Agarre y Plano** sirven para **filtrar**, pero no para
  emparejar: dos ejercicios no se parecen por usar la misma barra. Ese era el fallo que
  hacía salir el press de banca como similar al remo.

Por eso conviene ser generoso en las cuatro primeras y práctico en el resto.

Las etiquetas con sangría son subetiquetas: filtrar por la madre trae también a las
hijas, así que "Cuádriceps" encuentra lo etiquetado solo como "Recto femoral".

---

## Músculo

- **Cuádriceps** → Recto femoral · Vastos
- **Isquiotibiales** → Bíceps femoral · Semitendinoso · Semimembranoso
- **Glúteo** → Glúteo mayor · Glúteo medio · Glúteo menor
- **Aductores**
- **Tríceps sural** → Gemelos · Sóleo
- **Tibial anterior**
- **Pectoral** → Pectoral mayor · Pectoral menor
- **Dorsal ancho**
- **Trapecio** → Trapecio superior · Trapecio medio · Trapecio inferior
- **Romboides**
- **Serrato anterior**
- **Deltoides** → Deltoides anterior · Deltoides medio · Deltoides posterior
- **Manguito rotador** → Supraespinoso · Infraespinoso · Redondo menor · Subescapular
- **Bíceps braquial**
- **Tríceps braquial**
- **Antebrazo** → Flexores de muñeca · Extensores de muñeca
- **Abdomen** → Recto abdominal · Oblicuos · Transverso
- **Erectores espinales** → Multífidos
- **Flexores de cadera** → Psoas ilíaco

## Articulación

Tobillo · Rodilla · Cadera · Columna lumbar · Columna dorsal · Columna cervical ·
Escápula · Hombro · Codo · Muñeca

## Movimiento

El patrón, que es como de verdad se monta una sesión: eliges un empuje, no eliges
un pectoral.

Sentadilla · Bisagra de cadera · Zancada · Empuje horizontal · Empuje vertical ·
Tracción horizontal · Tracción vertical · Antiextensión · Antirrotación ·
Antiflexión lateral · Rotación · Acarreo · Salto · Movilidad · Estiramiento

## Posición

De pie · Sentado · Supino · Prono · Decúbito lateral · Cuadrupedia · De rodillas ·
Semiarrodillado · Suspendido · Inclinado

## Material

Peso corporal · Barra · Mancuernas · Kettlebell · Disco · Banda elástica · Polea ·
Máquina · Banco · Esterilla · TRX · Balón medicinal · Fitball · Cajón · Bosu ·
Foam roller · Camilla

## Apoyo

Bipodal · Unipodal · Apoyo de manos · Apoyo de antebrazos · Apoyo de espalda ·
Sin apoyo · Superficie inestable

## Agarre

Prono · Supino · Neutro · Mixto · Cerrado · Ancho · Sin agarre

## Patología

Para marcar qué ejercicios se usan —o se evitan— en cada cuadro.

Lumbalgia · Hernia discal · Cervicalgia · Hombro doloroso · Manguito rotador ·
Epicondilitis · Condropatía rotuliana · Rotura de LCA · Menisco ·
Esguince de tobillo · Tendinopatía aquílea · Fascitis plantar · Escoliosis ·
Prótesis de cadera · Prótesis de rodilla · Suelo pélvico

## Plano y eje

Sagital · Frontal · Transversal · Multiplanar

---

## Cómo lo montamos después

Cuando esté acordado, un sembrador crea las que falten y respeta las que ya tengas.

Para los ejercicios, mi propuesta es ir **por patrón de movimiento**, no por músculo:
sentadilla, bisagra, zancada, empuje horizontal, empuje vertical, tracción horizontal,
tracción vertical y core. Así el mismo ejercicio no aparece tres veces por trabajar tres
músculos, y es el orden en que se piensa una sesión.

Regla para decidir si algo es ejercicio nuevo o variante:

- **Cambia la técnica → ejercicio nuevo.** Sentadilla con barra y sentadilla goblet: la
  posición de la espalda es otra, los fallos son otros, los criterios son otros.
- **Solo cambia el material o el apoyo → variante.** Bilateral y unilateral, con banda o
  con polea. La variante ya se guarda en el registro, así que tiene progresión propia
  sin duplicar el catálogo.
