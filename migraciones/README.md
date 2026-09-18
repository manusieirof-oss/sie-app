# Migraciones

Cambios de esquema que se han ejecutado a mano en el editor SQL de Supabase.

No hay herramienta de migraciones: esto es un registro, no un sistema que se
aplique solo. Existe por un motivo concreto — el día que haya que levantar la
base desde cero (un entorno de pruebas, una restauración, otro profesional
usando la app) el esquema no está en ninguna parte del repo y se reconstruiría a
ojo, mirando qué columnas usa el código.

**Los ficheros van numerados y en orden.** Todos son idempotentes: se pueden
volver a ejecutar sin romper nada, porque usan `if not exists` y
`on conflict do nothing`.

Al hacer un cambio de esquema, añade aquí el SQL que ejecutaste, con la fecha y
el porqué. El porqué es lo que no se puede deducir del SQL seis meses después.
