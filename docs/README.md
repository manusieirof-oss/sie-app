# Documentación de SIE App

Dónde está cada cosa y cómo se trabaja. Escrito para que dentro de seis meses se pueda
retomar sin acordarse de nada.

## Qué hay en esta carpeta

| Carpeta | Qué guarda |
|---|---|
| `PENDIENTES.md` | Decisiones tomadas y lo que queda por hacer. **Es el documento vivo**: si dudas de por qué algo está hecho de una manera, mira aquí primero. |
| `propuestas/` | La lista razonada de cada bloque de ejercicios antes de crearlo: qué entra, qué se queda fuera y por qué. |
| `encargos/` | Los textos para pegar en Canva. Uno por bloque, con el estilo, los colores y los errores a evitar. |

Fuera de aquí:

| Sitio | Qué guarda |
|---|---|
| `datos/etiquetas-arbol.txt` | **Copia del árbol de etiquetas real**, volcado de Supabase. Se consulta antes de escribir un bloque nuevo, para no inventar nombres que no existen. |
| `sql/` | Migraciones y notas de esquema. |
| `Imagenes ejercicios/` | Ver más abajo. |

---

## El ciclo de un bloque de ejercicios

Cada grupo muscular se monta igual. Diez ejercicios por tanda: con más, el generador de
imágenes empieza a repetirse y a mezclar posturas.

**1. Propuesta.** Se escribe la lista en `docs/propuestas/`: ejercicio, patrón, alcance,
cómo se mide, material y variantes. Solo material que existe en la sala.

**2. Comprobar los nombres de las etiquetas** contra `datos/etiquetas-arbol.txt`. Este
paso se saltó dos veces y las dos costó caro: se crearon ejercicios de isquios sin la
etiqueta de isquios, y estuvo a punto de haber tres etiquetas duplicadas por escribir
"Antirrotación" donde el árbol dice "Antirotación".

**3. Semilla.** Los ejercicios se escriben en `src/lib/semillaEjercicios.ts` con su ficha
completa: descripción, criterios de ejecución, feedbacks, etiquetas y variantes. Las
etiquetas nuevas, si hacen falta, en `src/lib/semillaEtiquetas.ts`.

**4. Encargo de imágenes.** Se escribe el texto en `docs/encargos/` y se pega en Canva.

**5. Renombrar.** Llega **una imagen por ejercicio**, así que esa es la elegida: se
renombra con el nombre exacto del campo `archivo` de la semilla y se guarda en
`Imagenes ejercicios/elegidas/<bloque>/`.

Antes se guardaban las tres o cuatro versiones que devolvía Canva y se elegía después.
Se dejó de hacer: acumuló 15 MB de descartes en el repositorio, cuatro veces más que las
imágenes que se usan de verdad, y revisar tres versiones de cada ejercicio costaba más
tiempo del que ahorraba.

**6. Sembrar**, en este orden:

- `/entrenamiento/sembrar-etiquetas` — crea las etiquetas nuevas. Es repetible: lo que ya
  existe lo salta.
- `/entrenamiento/sembrar` — crea o actualiza los ejercicios. **Al abrir la página avisa
  arriba si falta alguna etiqueta**, antes de tocar nada.

Hay una tercera página, `/entrenamiento/limpiar`, que borra del catálogo lo que no está en
la semilla. Los ejercicios con histórico de ejecución salen desmarcados a propósito.

---

## Cómo se comporta el sembrador

Cosas que conviene saber para no llevarse sustos:

- **Empareja por nombre de ejercicio.** Si ya existe, lo actualiza en vez de duplicarlo,
  así que se puede relanzar tras corregir la semilla.
- **Las variantes solo se ponen al crear.** Si el ejercicio ya existe no se tocan, porque
  a esas alturas mandan las tuyas.
- **Se puede sembrar bloque a bloque.** Los ejercicios cuya imagen no esté en la selección
  conservan la que ya tuvieran; no se quedan sin foto.
- **Los nombres de etiqueta toleran singular y plural**, y cuando el mismo nombre existe
  en varias categorías gana por este orden: músculo, articulación, movimiento, material,
  posición, apoyo, agarre. Sin ese desempate, un remo con barra podía acabar etiquetado
  con una vértebra en vez de con el dorsal ancho.

---

## Imágenes

```
Imagenes ejercicios/
└── elegidas/       una imagen por ejercicio, renombrada. Esto es lo que se sube.
    ├── cuadriceps/       16
    ├── core-lumbar/      12
    ├── isquios-gluteo/   12
    ├── espalda/           2
    ├── hombro/            1
    └── pectoral/          1
```

`elegidas/` es la fuente de verdad: un archivo por ejercicio, con el nombre exacto que
espera la semilla. Nada más. Las versiones descartadas no se guardan.

**Las carpetas van por músculo, no por tanda.** Antes se llamaban `1-base`, `2-cuadriceps`
y así, por el orden en que se fueron montando, pero "base" no era un músculo: metía en el
mismo sitio un press de banca, un remo y dos planchas. Con el nombre del músculo se puede
abrir la carpeta y revisar de un vistazo lo que hay de cada zona, que es para lo que
sirve tenerlas guardadas.

Por eso `hombro`, `pectoral` y `espalda` están casi vacías: son las zonas que faltan por
montar. Es información útil, no un descuido.

Las reglas del estilo —fondo `#F5F3EF`, relleno plano sin sombreado, contorno `#3E7179`,
músculo principal en `#C9A84C`— están en cualquiera de los encargos. El más completo es
`encargos/ENCARGO-IMAGENES-CORE-LUMBAR.md`.

**Para qué son:** además de la ficha del ejercicio, la idea es mandar tablas de ejercicios
a casa del paciente. Eso sube el listón: la imagen la va a leer el paciente solo, sin
nadie al lado, así que el gesto pesa más que el material.
