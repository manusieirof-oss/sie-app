-- SENIOR FITNESS TEST (Rikli & Jones) — test de tipo BAREMO.
--
-- Las 84 filas de baremo no van escritas a mano: se generan cruzando los siete tramos de
-- edad con una fila por prueba y sexo. Así los números se pueden leer y comprobar contra
-- la tabla publicada de un vistazo, en vez de buscarlos dentro de un JSON.
--
-- Percentil 25 en las cinco pruebas donde MÁS es mejor, y percentil 75 en levantarse y
-- andar, donde MENOS es mejor. Por eso cada fila dice si su número es un mínimo o un
-- máximo. Muestra original: 7.183 adultos de 60 a 94 años.
--
-- NO PISA NADA. Si ya existe un test con este nombre, no hace nada: tiene que responder
-- "INSERT 0 1". Si responde "INSERT 0 0", es que ya estaba.

with tramos(i, e1, e2) as (
  values (1,60,64),(2,65,69),(3,70,74),(4,75,79),(5,80,84),(6,85,89),(7,90,94)
),
-- Los siete valores de cada fila van en el orden de los tramos de arriba.
norma(item, sexo, corte, v) as (values
  -- Repeticiones en 30 s. Mínimo: por debajo es hallazgo.
  ('Sentarse y levantarse de la silla en 30 s','hombre','min','{14,12,12,11,10,8,7}'::numeric[]),
  ('Sentarse y levantarse de la silla en 30 s','mujer', 'min','{12,11,10,10,9,8,4}'::numeric[]),
  ('Flexion de codo con mancuerna en 30 s',    'hombre','min','{16,15,14,13,13,11,10}'::numeric[]),
  ('Flexion de codo con mancuerna en 30 s',    'mujer', 'min','{13,12,12,11,10,10,8}'::numeric[]),
  -- Metros en 6 minutos, convertidos desde las yardas del original (1 yd = 0,9144 m).
  ('Marcha de 6 minutos',                      'hombre','min','{560,514,497,431,406,349,278}'::numeric[]),
  ('Marcha de 6 minutos',                      'mujer', 'min','{500,457,441,396,351,311,250}'::numeric[]),
  -- Centímetros desde la punta del pie / entre los dedos, convertidos desde pulgadas.
  -- Negativo = no se llega. Por eso los mínimos son casi todos negativos.
  ('Flexibilidad de piernas sentado',          'hombre','min','{-6.5,-8,-8,-10.5,-13.5,-13,-16.5}'::numeric[]),
  ('Flexibilidad de piernas sentado',          'mujer', 'min','{-1.5,-1,-3,-3.5,-5,-6.5,-11}'::numeric[]),
  ('Juntar las manos tras la espalda',         'hombre','min','{-17,-19,-20,-23,-23.5,-24,-26.5}'::numeric[]),
  ('Juntar las manos tras la espalda',         'mujer', 'min','{-7.5,-9.5,-10.5,-12,-13.5,-17.5,-20.5}'::numeric[]),
  -- Segundos. Aquí menos es mejor, así que el número es un MÁXIMO.
  ('Levantarse y andar 2,44 m',                'hombre','max','{5.6,5.9,6.2,7.2,7.6,8.9,10}'::numeric[]),
  ('Levantarse y andar 2,44 m',                'mujer', 'max','{6,6.4,7.1,7.4,8.7,9.6,11.5}'::numeric[])
),
filas as (
  select jsonb_agg(
           jsonb_build_object('item', n.item, 'sexo', n.sexo,
                              'edad_min', t.e1, 'edad_max', t.e2, n.corte, n.v[t.i])
           order by n.item, n.sexo, t.e1
         ) as baremos
  from norma n cross join tramos t
)
insert into tests (nombre, descripcion, logica, tipo_lado, frecuencia_meses,
                   items, baremos, bandas, etiquetas_relacionadas, etiquetas_bloquea,
                   imagen_url, video_url)
select
  'Senior Fitness Test (Rikli & Jones)',
  'Bateria de seis pruebas para valorar la condicion funcional a partir de los 60 anos. Cada prueba se compara con la norma de su sexo y su tramo de edad, y lo que decide el test es cuantas quedan por debajo.

1. Sentarse y levantarse: silla de 43 cm sin brazos contra la pared, brazos cruzados sobre el pecho. Repeticiones completas en 30 s.
2. Flexion de codo: sentado, mancuerna de 2,3 kg en mujeres y 3,6 kg en hombres, brazo dominante. Repeticiones completas en 30 s.
3. Marcha de 6 minutos: metros recorridos en un circuito de 45,7 m marcado cada 5 m. Se puede parar a descansar.
4. Flexibilidad de piernas: sentado al borde de la silla, una pierna extendida y el talon apoyado. Se mide la distancia de los dedos de la mano a la punta del pie. Negativo si no se llega, positivo si se pasa. Se anota la mejor pierna.
5. Manos tras la espalda: una mano por encima del hombro y la otra por debajo. Se mide la distancia entre los dedos corazon. Negativo si no se tocan. Se anota el mejor lado.
6. Levantarse y andar: desde sentado, rodear un cono situado a 2,44 m y volver a sentarse. Se anota el mejor de dos intentos.

Baremos: percentil 25 de la muestra original (7.183 adultos de 60 a 94 anos) en las cinco pruebas donde mas es mejor, y percentil 75 en levantarse y andar, donde menos es mejor. Marcha en metros y flexibilidades en centimetros, convertidas desde las yardas y pulgadas del original. Fuera del tramo de 60 a 94 anos no hay baremo publicado, y el test lo dira en vez de inventarselo.',
  'baremo', 'bilateral', 6,
  '[{"nombre":"Sentarse y levantarse de la silla en 30 s","unidad":"repeticiones"},
    {"nombre":"Flexion de codo con mancuerna en 30 s","unidad":"repeticiones"},
    {"nombre":"Marcha de 6 minutos","unidad":"metros"},
    {"nombre":"Flexibilidad de piernas sentado","unidad":"cm"},
    {"nombre":"Juntar las manos tras la espalda","unidad":"cm"},
    {"nombre":"Levantarse y andar 2,44 m","unidad":"segundos"}]'::jsonb,
  filas.baremos,
  '[{"hasta":0,"etiqueta":"Dentro de la norma","hallazgo":false},
    {"hasta":1,"etiqueta":"Una prueba por debajo","hallazgo":true},
    {"hasta":3,"etiqueta":"Varias pruebas por debajo","hallazgo":true},
    {"hasta":6,"etiqueta":"Riesgo funcional alto","hallazgo":true}]'::jsonb,
  '[]'::jsonb, '[]'::jsonb, '', ''
from filas
where not exists (select 1 from tests where nombre = 'Senior Fitness Test (Rikli & Jones)');


-- ─────────────────────────────────────────────────────────────────────────────
-- FPI-6 (Foot Posture Index) — test de tipo PUNTUACIÓN.
--
-- Seis observaciones de -2 a +2 y el total, de -12 a +12, cae en una banda. Es LATERAL:
-- se registra por separado en cada pie, porque un pie pronado y otro neutro son dos
-- historias distintas.
--
-- Mismo candado que arriba: no pisa un test que ya exista con este nombre.
insert into tests (nombre, descripcion, logica, tipo_lado, frecuencia_meses,
                   items, bandas, baremos, etiquetas_relacionadas, etiquetas_bloquea,
                   imagen_url, video_url)
select
  'FPI-6 · Indice de postura del pie',
  'Valoracion de la postura del pie en apoyo bipodal relajado. Seis observaciones, cada una de -2 a +2, donde el negativo es supinacion y el positivo pronacion. El total dice como se comporta ese pie.

Se explora con el paciente de pie, mirando al frente, con el peso repartido y sin mover los pies. Se observa cada item por separado y se puntua antes de pasar al siguiente.

Un pie a la vez: el resultado se registra por lado.',
  'suma', 'lateral', 6,
  '[{"nombre":"Palpacion de la cabeza del astragalo","unidad":"puntos","min":-2,"max":2},
    {"nombre":"Curvatura supra e inframaleolar lateral","unidad":"puntos","min":-2,"max":2},
    {"nombre":"Posicion del calcaneo en el plano frontal","unidad":"puntos","min":-2,"max":2},
    {"nombre":"Prominencia en la region talonavicular","unidad":"puntos","min":-2,"max":2},
    {"nombre":"Congruencia del arco longitudinal medial","unidad":"puntos","min":-2,"max":2},
    {"nombre":"Abduccion y aduccion del antepie","unidad":"puntos","min":-2,"max":2}]'::jsonb,
  '[{"hasta":-5,"etiqueta":"Muy supinado","hallazgo":true},
    {"hasta":-1,"etiqueta":"Supinado","hallazgo":true},
    {"hasta":5,"etiqueta":"Normal","hallazgo":false},
    {"hasta":9,"etiqueta":"Pronado","hallazgo":true},
    {"hasta":12,"etiqueta":"Muy pronado","hallazgo":true}]'::jsonb,
  '[]'::jsonb, '[]'::jsonb, '[]'::jsonb, '', ''
where not exists (select 1 from tests where nombre = 'FPI-6 · Indice de postura del pie');
