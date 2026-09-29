-- Hoja libre: la sesion dibujada a mano.
--
-- Hasta ahora una sesion solo se podia escribir con el modal: partes, ejercicios de la
-- biblioteca, series y reps en sus casillas. Sirve para lo que se repite, pero obliga a
-- pensar la sesion con la forma del formulario. Con una tablet y un lapiz el entrenador
-- quiere dibujarla como en papel: flechas, circuitos, tachones, lo que le salga.
--
-- El dibujo no se puede leer como datos, asi que los datos NO salen del dibujo: salen de
-- las pegatinas que el entrenador pega encima donde quiere. Objetivo, ejercicio (enlazado
-- a la biblioteca o con nombre libre) y casilla de dato (kg, reps, s...). Lo que no lleva
-- pegatina se queda como dibujo y no registra nada.
--
-- Una columna jsonb y no tablas nuevas porque la hoja es un documento: se guarda y se lee
-- entera, nadie consulta "todos los trazos azules". Lo que si se consulta —lo hecho en el
-- taller y los objetivos— va a las tablas de siempre (`registros_ejercicio`,
-- `sesiones_objetivos`), y por eso la progresion lo cuenta sin saber que vino de una hoja.
--
-- Forma:
--   { trazos: [{ c: 'azul'|'rojo'|'negro'|'verde', w: number, pts: [[x, y, presion], ...] }],
--     pegs:   [{ id, tipo: 'obj'|'ej'|'cas', x, y, ...segun tipo }] }
--   x, y en unidades de la hoja (1000 x 1414, proporcion A4): asi se ve igual en
--   cualquier pantalla. Trazos como lineas y no como imagen: pesan poco, no se pixelan
--   y se pueden borrar con la goma despues.
--
-- NULL = sesion normal, la de siempre. Nada existente cambia.

alter table sesiones
  add column if not exists hoja jsonb;
