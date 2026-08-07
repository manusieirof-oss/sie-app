-- BIBLIOTECA CLÍNICA: descripción y etiquetas en las seis listas.
--
-- Patologías, molestias, medicamentos, alergias, intolerancias y operaciones eran seis
-- tablas con nombre y poco más. Dos de ellas —patologías y molestias— ni siquiera se
-- podían ampliar desde la app: había que meter filas a mano en Supabase.
--
-- LAS ETIQUETAS SON LAS MISMAS QUE TODO LO DEMÁS. No una lista nueva: el árbol que ya usan
-- ejercicios, tests y objetivos. Con eso, una patología de hombro y un ejercicio de hombro
-- comparten vocabulario, y el día que quieras cruzarlos no hay nada que traducir.
--
-- La DESCRIPCIÓN es para que al pulsar una píldora se pueda decir qué es. Hoy solo las
-- patologías tenían texto; el resto eran nombres sueltos.

alter table patologias_biblioteca   add column if not exists etiquetas jsonb default '[]';
alter table molestias_biblioteca    add column if not exists etiquetas jsonb default '[]';
alter table medicamentos_biblioteca add column if not exists etiquetas jsonb default '[]';
alter table alergias_biblioteca     add column if not exists etiquetas jsonb default '[]';
alter table intolerancias_biblioteca add column if not exists etiquetas jsonb default '[]';
alter table operaciones_biblioteca  add column if not exists etiquetas jsonb default '[]';

alter table molestias_biblioteca    add column if not exists descripcion text;
alter table medicamentos_biblioteca add column if not exists descripcion text;
alter table alergias_biblioteca     add column if not exists descripcion text;
alter table intolerancias_biblioteca add column if not exists descripcion text;
alter table operaciones_biblioteca  add column if not exists descripcion text;

notify pgrst, 'reload schema';
