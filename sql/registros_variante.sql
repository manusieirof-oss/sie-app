-- Variante ejecutada en cada registro del taller.
--
-- La variante (bilateral, unilateral, con banda…) vivía SOLO dentro de la sesión, no
-- en el registro de lo ejecutado. Consecuencia: la progresión de cargas se agrupa por
-- `ejercicio_id`, así que los pesos de la versión unilateral se mezclaban en la misma
-- gráfica con los de la bilateral. Se estaban comparando cargas que no son
-- comparables, y sin forma de separarlas después.
--
-- Guardándola aquí, la progresión puede dividir por variante sin llenar la biblioteca
-- de casi-duplicados. Para las variantes que ya tienen entidad propia —criterios de
-- ejecución u objetivos distintos— existe además "Convertir en ejercicio" en la ficha
-- del ejercicio, que es otra cosa: eso crea un ejercicio de verdad.
--
-- Los registros anteriores se quedan en NULL: se agrupan como "sin variante", que es
-- todo lo que se puede saber de ellos.

alter table registros_ejercicio
  add column if not exists variante text;
