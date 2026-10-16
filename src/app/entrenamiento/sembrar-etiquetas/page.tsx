'use client'
import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { traerTodo } from '@/lib/paginar'
import ImagenEjercicio from '@/components/ImagenEjercicio'

// ---------------------------------------------------------------------------
// ETIQUETAS PARA LOS EJERCICIOS QUE NO TENÍAN NINGUNA. Página de un solo uso.
//
// Propuesta hecha leyendo el nombre (y la descripción si la había) de cada ejercicio
// sin etiquetas. Es un PUNTO DE PARTIDA: aquí se ven todas con su figura y se pueden
// desmarcar las que no convenzan antes de aplicar. Solo se escriben en ejercicios que
// sigan sin etiquetas: si alguno ya se rellenó a mano, no se toca.
//
// Cada etiqueta va como "categoria:ruta" (la ruta como en el catálogo, "Raíz > Hija").
// ---------------------------------------------------------------------------

const P: [string, string, string[]][] = [
  ['c4ca0c56-009b-440c-af3a-5c9fa82ae30a', 'Estiramiento abductor con aro', ['posicion:Supino', 'material:Aro', 'articulacion:Cadera', 'movimiento:Adducción', 'musculo:Abductor - TFL']],
  ['e550aba8-75cf-490c-95cc-87c1c8fe135a', 'estiramiento de aductor', ['posicion:Sentado > En el suelo', 'articulacion:Cadera', 'movimiento:Abducción', 'musculo:Aductores']],
  ['e38ce61c-2936-4660-a3a6-d60725baaa04', 'Estiramiento de aductores en pared', ['posicion:Supino', 'material:Pared', 'articulacion:Cadera', 'movimiento:Abducción', 'musculo:Aductores']],
  ['4efabeee-5d09-4aeb-b1d3-b4ae9367d160', 'Estiramiento de bíceps', ['posicion:Bipedestación', 'articulacion:Codo', 'articulacion:Hombro', 'movimiento:Extensión', 'musculo:Bíceps']],
  ['00e318ff-db51-4502-a162-9eb2f71c353a', 'Estiramiento de cuádriceps', ['posicion:Bipedestación', 'apoyo:Unipodal', 'articulacion:Rodilla', 'movimiento:Flexión', 'musculo:Cuádriceps']],
  ['55c4a3e3-3d3b-42f3-a263-f858947d143f', 'Estiramiento de dorsal', ['posicion:Bipedestación', 'articulacion:Hombro', 'movimiento:Flexión', 'musculo:Espalda > Dorsal Ancho']],
  ['7d4804f8-1285-42fa-831a-35ce3a56feb5', 'Estiramiento de ELECOM', ['posicion:Sentado', 'articulacion:Columna > Cervical', 'movimiento:Flexión > Flexión lateral', 'musculo:Cervical > ECOM']],
  ['89709138-1910-414e-aed7-203c2bb7fff9', 'Estiramiento de gemelo en valla', ['posicion:Bipedestación', 'material:Valla', 'articulacion:Tobillo', 'movimiento:Flexión > Dorsiflexión', 'musculo:Tríceps Sural > Gastronécmio']],
  ['743e9383-a910-493e-80df-14c61cbde200', 'Estiramiento de hombro', ['posicion:Bipedestación', 'articulacion:Hombro', 'movimiento:Adducción', 'musculo:Hombro > Deltoides > Posterior']],
  ['bc516f73-12db-4789-9978-e11bd2eb2cbf', 'Estiramiento de hombros', ['posicion:Bipedestación', 'articulacion:Hombro', 'movimiento:Flexión', 'musculo:Hombro > Deltoides']],
  ['44dd84a1-3b41-479b-b071-eef3e8caf3e8', 'Estiramiento de isquio', ['posicion:Supino', 'articulacion:Cadera', 'movimiento:Flexión de cadera', 'musculo:Isquiotibial']],
  ['6f6b573b-8fda-48a7-81bb-289e892fa015', 'Estiramiento de isquiotibial con aro', ['posicion:Supino', 'material:Aro', 'articulacion:Cadera', 'movimiento:Flexión de cadera', 'musculo:Isquiotibial']],
  ['e9cd8723-72bc-4e77-8f66-fce29327a903', 'Estiramiento de pectoral', ['posicion:Bipedestación', 'material:Pared', 'articulacion:Hombro', 'movimiento:Abducción', 'musculo:Pectoral']],
  ['b14e69ca-1869-4ee0-84ff-c151ebfc2ca0', 'estiramiento de psoas', ['posicion:Caballero', 'articulacion:Cadera', 'movimiento:Extensión', 'musculo:Psoas']],
  ['73bf1161-842d-4920-a9cd-ca5e34762788', 'Estiramiento de tríceps', ['posicion:Bipedestación', 'articulacion:Codo', 'articulacion:Hombro', 'movimiento:Flexión', 'musculo:Tríceps']],
  ['77ac0097-91e5-48df-a2c8-97ccc72ee9a5', 'estiramiento en cuerdas', ['posicion:Bipedestación', 'material:Cinchas de suspensión', 'articulacion:Hombro', 'articulacion:Columna', 'musculo:Espalda > Dorsal Ancho']],
  ['ab709c79-5fe3-4aed-a120-4060e7b03672', 'estiramiento lateral sobre fitball', ['posicion:Decúbito lateral', 'material:Fitball', 'articulacion:Columna', 'movimiento:Flexión > Flexión lateral', 'musculo:Abdomen > Oblicuos', 'musculo:Espalda > Cuadrado lumbar']],
  ['f0415d12-9c08-4a87-b6f3-15a11a9cac9d', 'estiramiento lateral sobre pelota', ['posicion:Decúbito lateral', 'material:Pelota', 'articulacion:Columna', 'movimiento:Flexión > Flexión lateral', 'musculo:Abdomen > Oblicuos', 'musculo:Espalda > Cuadrado lumbar']],
  ['dc80dfee-54ae-4cd9-848a-c0ea3f5ade2d', 'Estiramiento mariposa', ['posicion:Sentado > En el suelo', 'articulacion:Cadera', 'movimiento:Abducción', 'movimiento:Rotación > Rotación externa', 'musculo:Aductores']],
  ['c4318d96-85a0-462e-a7d6-2467fc29c38b', 'Estiramiento psoas en cajón', ['posicion:Bipedestación', 'material:Cajón', 'articulacion:Cadera', 'movimiento:Extensión', 'musculo:Psoas']],
  ['b722f2e4-0156-4145-91ac-d5f63e432f99', 'extensión de brazo con stick', ['posicion:Bipedestación', 'material:Stick', 'articulacion:Hombro', 'movimiento:Flexión', 'musculo:Hombro > Deltoides', 'musculo:Espalda > Dorsal Ancho']],
  ['2720ab4c-7fa7-4afc-ab54-1641968cf29e', 'Extensión de cuádriceps con goma en popliteo', ['posicion:Sentado', 'material:Goma', 'apoyo:Cadena abierta', 'articulacion:Rodilla', 'movimiento:Extensión', 'musculo:Cuádriceps']],
  ['c900310c-7f57-4d3b-8a58-d7dd2b89a5de', 'extensión de cuádriceps sentado', ['posicion:Sentado', 'apoyo:Cadena abierta', 'articulacion:Rodilla', 'movimiento:Extensión', 'musculo:Cuádriceps']],
  ['47f8246d-c4af-4289-b889-0d1052559f17', 'extensión de rodilla con kettelbell', ['posicion:Sentado', 'material:Kettlebell', 'apoyo:Cadena abierta', 'articulacion:Rodilla', 'movimiento:Extensión', 'musculo:Cuádriceps']],
  ['886c1a28-09fa-42ab-bf82-cc2578933b17', 'extensión de torso tumbado', ['posicion:Prono', 'articulacion:Columna', 'movimiento:Extensión', 'musculo:Espalda > Erectores Espinales']],
  ['829df81d-cdbc-40bd-934f-d2847bd09b18', 'extensión dorsal con brazos sobre fitball', ['posicion:Arrodillado', 'material:Fitball', 'articulacion:Columna > Dorsal', 'articulacion:Hombro', 'movimiento:Flexión', 'musculo:Espalda > Dorsal Ancho']],
  ['9f1c26a1-8da6-4a70-aa0d-a30969cdc41f', 'Extensiones de glúteo', ['posicion:Cuadrupedia', 'articulacion:Cadera', 'movimiento:Extensión', 'musculo:Glúteo > Glúteo mayor']],
  ['cb78a565-1115-4c82-9977-a927d0f18fa4', 'Extensiones de glúteo en polea', ['posicion:Bipedestación', 'material:Polea', 'apoyo:Unipodal', 'articulacion:Cadera', 'movimiento:Extensión', 'musculo:Glúteo > Glúteo mayor']],
  ['dd4dfaec-4166-4bef-afe4-d0c441f35446', 'Face Pull en Polea', ['posicion:Bipedestación', 'material:Polea', 'agarre:Neutro', 'articulacion:Escapular', 'articulacion:Hombro', 'movimiento:Retracción', 'movimiento:Rotación > Rotación externa', 'musculo:Hombro > Deltoides > Posterior', 'musculo:Trapecio > Medio']],
  ['5ba67e6e-345c-47b0-8745-9cb375ea3368', 'Flexión activa-asistida de rodilla', ['posicion:Supino', 'articulacion:Rodilla', 'movimiento:Flexión', 'musculo:Isquiotibial']],
  ['3c0d9677-c3b4-41db-8de4-0bf31ade07af', 'flexión de cadera con pies en cajón', ['posicion:Supino', 'material:Cajón', 'articulacion:Cadera', 'movimiento:Flexión de cadera', 'musculo:Psoas']],
  ['1ec53bab-dd3a-4f32-9671-654740d0ccb8', 'Flexión de hombro con stick', ['posicion:Supino', 'material:Stick', 'articulacion:Hombro', 'movimiento:Flexión', 'musculo:Hombro > Deltoides > Anterior']],
  ['f555a682-8358-4863-ab69-9784162a9c3a', 'Flexión de rodilla en deslizador con ayuda de las manos', ['posicion:Supino', 'material:Deslizador', 'articulacion:Rodilla', 'movimiento:Flexión', 'musculo:Isquiotibial']],
  ['9a3ff1c4-baea-4e0f-a6dc-5407281684ed', 'flexión de rodilla sobre fitbal', ['posicion:Supino', 'material:Fitball', 'articulacion:Rodilla', 'movimiento:Flexión', 'musculo:Isquiotibial']],
  ['3f168a70-18e8-43d3-8cb0-92f7a81f2496', 'Flexión de rodillas con goma', ['posicion:Sentado', 'material:Goma', 'articulacion:Rodilla', 'movimiento:Flexión', 'musculo:Isquiotibial']],
  ['1d6f3888-5a6e-4796-950f-c87d44a2cbdf', 'flexión de tronco en bipedestación', ['posicion:Bipedestación', 'articulacion:Columna', 'articulacion:Cadera', 'movimiento:Flexión', 'musculo:Isquiotibial', 'musculo:Espalda > Erectores Espinales']],
  ['e72e9fbc-b7f2-4218-9903-d307136239a9', 'flexión lateral cervical con palma en la pared', ['posicion:Bipedestación', 'material:Pared', 'articulacion:Columna > Cervical', 'movimiento:Flexión > Flexión lateral', 'musculo:Cervical > Escalenos']],
  ['8f76e3c0-6404-4a5a-9df7-de78972f0b4f', 'Flexión lateral de cervical', ['posicion:Sentado', 'articulacion:Columna > Cervical', 'movimiento:Flexión > Flexión lateral', 'musculo:Cervical > Escalenos']],
  ['f0f3ae41-40fe-412d-8b32-e3714e83792e', 'flexo-extensión cervical', ['posicion:Sentado', 'articulacion:Columna > Cervical', 'movimiento:Flexión', 'movimiento:Extensión', 'musculo:Cervical']],
  ['d1307b04-932b-4ce1-bccb-875e867974d7', 'Flexo-extensión de rodilla con aro', ['posicion:Supino', 'material:Aro', 'articulacion:Rodilla', 'movimiento:Flexión', 'movimiento:Extensión', 'musculo:Cuádriceps', 'musculo:Isquiotibial']],
  ['374c55ab-fd89-4b8e-bba6-06d6f7715868', 'flexo-extensión de tobillo con goma', ['posicion:Sentado > En el suelo', 'material:Goma', 'articulacion:Tobillo', 'movimiento:Flexión > Dorsiflexión', 'movimiento:Flexión > Flexión plantar', 'musculo:Tibial > Tibial anterior', 'musculo:Tríceps Sural']],
  ['b1d822b1-c699-4dd5-b518-343bfcee956e', 'Fondos de pecho', ['apoyo:Mano', 'articulacion:Codo', 'articulacion:Hombro', 'movimiento:Extensión', 'movimiento:Patrón > Empuje vertical', 'musculo:Pectoral', 'musculo:Tríceps']],
  ['1feceea4-6c9a-45ca-b0dd-be78e74021b1', 'hacer y deshacer hueco', ['posicion:Supino', 'articulacion:Cadera > Lumbosacra', 'movimiento:Anteversión', 'movimiento:Retroversión', 'musculo:Abdomen > Transverso']],
  ['5ba51037-1e96-4c64-bd59-750517bf3afb', 'hacer y deshacer hueco arrodillado', ['posicion:Arrodillado', 'articulacion:Cadera > Lumbosacra', 'movimiento:Anteversión', 'movimiento:Retroversión', 'musculo:Abdomen > Transverso']],
  ['c0251992-fa39-404b-be90-3a6dd2135118', 'Hacer y deshacer hueco en bipedestación', ['posicion:Bipedestación', 'articulacion:Cadera > Lumbosacra', 'movimiento:Anteversión', 'movimiento:Retroversión', 'musculo:Abdomen > Transverso']],
  ['db45fd5f-f924-49c0-8a47-c5c06ce78092', 'hacer y deshacer hueco en fitball', ['posicion:Sentado', 'material:Fitball', 'articulacion:Cadera > Lumbosacra', 'movimiento:Anteversión', 'movimiento:Retroversión', 'musculo:Abdomen > Transverso']],
  ['84a563d5-ccc2-428b-97b4-1765e7c92829', 'Hacer y deshacer hueco en sentadilla', ['posicion:Bipedestación', 'movimiento:Patrón > Sentadilla', 'articulacion:Cadera > Lumbosacra', 'movimiento:Anteversión', 'movimiento:Retroversión', 'musculo:Abdomen > Transverso']],
  ['0f50b417-fca0-466f-adb0-26ef311a198a', 'Hombro posterior en polea', ['posicion:Bipedestación', 'material:Polea', 'articulacion:Hombro', 'movimiento:Abducción', 'musculo:Hombro > Deltoides > Posterior']],
  ['88777e48-8363-42d5-bd90-e982752c1302', 'Isométrico de aductor + Press de pecho', ['posicion:Supino', 'material:Pelota', 'material:Mancuerna', 'articulacion:Cadera', 'movimiento:Adducción', 'movimiento:Patrón > Empuje horizontal', 'musculo:Aductores', 'musculo:Pectoral']],
  ['c982349a-c553-4b44-b24c-56f1d23ba08e', 'Isométricos de cuádriceps con flexión de cadera', ['posicion:Supino', 'articulacion:Cadera', 'articulacion:Rodilla', 'movimiento:Flexión de cadera', 'musculo:Cuádriceps > Recto Femoral']],
  ['1486d586-1b72-4226-843a-12b4faec6a90', 'lanzar la pelota', ['posicion:Bipedestación', 'material:Pelota', 'articulacion:Hombro', 'movimiento:Flexión', 'musculo:Hombro > Deltoides', 'musculo:Pectoral']],
  ['acb3c8c7-1141-45c9-9bb6-2a0f7ceb7083', 'lumbar', ['posicion:Supino > Rodillas al pecho', 'articulacion:Columna > Lumbar', 'movimiento:Flexión', 'musculo:Espalda > Erectores Espinales']],
  ['1725e57a-9484-4fa7-81fb-badca8f28b60', 'Lunge de tobillo', ['posicion:Caballero', 'articulacion:Tobillo', 'movimiento:Flexión > Dorsiflexión', 'movimiento:Lunge', 'musculo:Tríceps Sural > Sóleo']],
  ['f77286ee-f7a2-47ab-a286-8906a6f2b754', 'Manipulación de rótula', ['posicion:Supino', 'articulacion:Rodilla', 'musculo:Cuádriceps', 'patologia:Condropatía rotuliana']],
  ['86ad9271-1b54-4642-8787-5eab004e4c79', 'masaje', ['material:Roller']],
  ['355f7846-d409-484f-a3d3-23df2ba6a543', 'Masaje abductor', ['posicion:Decúbito lateral', 'material:Roller', 'musculo:Abductor - TFL']],
  ['4b7cf091-21fc-4022-81a6-6dc34db5f26b', 'Masaje cervical', ['posicion:Supino', 'material:Pelota', 'musculo:Cervical']],
  ['549e8e05-aef2-4bea-a229-3adca2ca1ddd', 'masaje de cuádriceps', ['posicion:Prono', 'material:Roller', 'musculo:Cuádriceps']],
  ['5ad60f8f-4f42-451a-8767-7d913f5e890c', 'masaje dorsal', ['posicion:Decúbito lateral', 'material:Roller', 'musculo:Espalda > Dorsal Ancho']],
  ['d6fdafbc-4ea6-4da6-879a-5dc974e2928f', 'masaje glúteo', ['posicion:Sentado > En el suelo', 'material:Roller', 'musculo:Glúteo']],
  ['4bea1924-40de-47d5-9f5f-2950de99dac0', 'Masaje isquios', ['posicion:Sentado > En el suelo', 'material:Roller', 'musculo:Isquiotibial']],
  ['964aac5d-3476-44c7-882c-159b56fb219f', 'masaje lumbar', ['posicion:Supino > Rodillas flexionadas', 'material:Roller', 'musculo:Espalda > Erectores Espinales']],
  ['dfdae4dc-d8f6-4201-8be8-f3d809ac6c1e', 'Masaje pectoral', ['posicion:Bipedestación', 'material:Pelota', 'material:Pared', 'musculo:Pectoral']],
  ['14aff5a4-463f-4799-a62a-27d8f6d5ebca', 'Monster Walk', ['posicion:Bipedestación', 'material:Mini band', 'articulacion:Cadera', 'movimiento:Abducción', 'movimiento:Patrón > Marcha', 'musculo:Glúteo > Glúteo medio']],
  ['7f4f4c17-d0f7-4880-9cb1-e6c532a3bef4', 'movilidad completa de tobillo', ['posicion:Sentado', 'articulacion:Tobillo', 'movimiento:Circunducción', 'movimiento:Flexión > Dorsiflexión', 'movimiento:Flexión > Flexión plantar']],
  ['cd56711e-ec2c-4e03-ae0d-48f12fb8eda3', 'Movilidad de ciático', ['posicion:Sentado', 'articulacion:Cadera', 'articulacion:Rodilla', 'movimiento:Extensión', 'musculo:Isquiotibial', 'patologia:Ciático']],
  ['0e27cbd5-e451-4d31-8e48-f8c62790a249', 'Movilidad de rótula', ['posicion:Supino', 'articulacion:Rodilla', 'patologia:Condropatía rotuliana']],
  ['cb6707cc-edee-45a2-88f1-f16aa4b6e709', 'Movilidad dorsal apoyada en la pared', ['posicion:Bipedestación', 'material:Pared', 'articulacion:Columna > Dorsal', 'movimiento:Extensión', 'movimiento:Rotación', 'musculo:Espalda']],
  ['7442464a-0408-434d-a3d8-444b02ac14b3', 'movilidad dorsal en fitbal', ['posicion:Supino', 'material:Fitball', 'articulacion:Columna > Dorsal', 'movimiento:Extensión', 'musculo:Espalda']],
  ['4ffe3156-fab8-4381-9f8a-8e1c22e8aba7', 'Multisaltos con salto al cajón', ['posicion:Bipedestación', 'material:Cajón pliométrico', 'movimiento:Patrón > Salto', 'articulacion:Cadera', 'articulacion:Rodilla', 'articulacion:Tobillo', 'musculo:Cuádriceps', 'musculo:Glúteo', 'musculo:Tríceps Sural']],
  ['e48826e3-c02b-49e9-a3af-cd4ab44535a0', 'oblicuos', ['posicion:Supino', 'articulacion:Columna', 'movimiento:Rotación', 'movimiento:Flexión', 'musculo:Abdomen > Oblicuos']],
  ['b6e775ad-6f0a-46fb-b232-1a5911f6cb2a', 'Oblícuos en bipedestación', ['posicion:Bipedestación', 'articulacion:Columna', 'movimiento:Flexión > Flexión lateral', 'musculo:Abdomen > Oblicuos']],
  ['6a641b5d-5058-40d8-9e77-3701d8368d7e', 'Patada de glúteo', ['posicion:Cuadrupedia', 'articulacion:Cadera', 'movimiento:Extensión', 'musculo:Glúteo > Glúteo mayor']],
  ['4e03fef0-01fd-4dab-90a8-224cbcb5f738', 'pectoral con aro', ['posicion:Bipedestación', 'material:Aro', 'articulacion:Hombro', 'movimiento:Adducción', 'musculo:Pectoral']],
  ['8ec9f179-0fab-4e67-8db3-86071587f7f1', 'Plancha cuadrúpeda', ['posicion:Cuadrupedia > Rodillas elevadas', 'apoyo:Mano', 'movimiento:Antiextensión', 'musculo:Abdomen']],
  ['20946393-8f06-4c21-a7b5-56c8ef463df3', 'Plancha cuadrúpeda + Tocar hombro', ['posicion:Cuadrupedia > Rodillas elevadas', 'apoyo:Mano', 'movimiento:Antirotación', 'musculo:Abdomen', 'musculo:Abdomen > Oblicuos']],
  ['394782db-450e-44ed-a5c7-e86ac6bec2d6', 'Puente de Glúteo sobre talones', ['posicion:Supino > Puente', 'articulacion:Cadera', 'movimiento:Extensión', 'musculo:Glúteo', 'musculo:Isquiotibial']],
  ['9ec0671d-8ee9-434e-8c79-f414a38abc87', 'Puente de Glúteo sobre talones · Unilateral', ['posicion:Supino > Puente', 'apoyo:Unipodal', 'articulacion:Cadera', 'movimiento:Extensión', 'musculo:Glúteo', 'musculo:Isquiotibial']],
  ['e389265a-63d8-4b41-9c95-49d635914273', 'Remo en polea', ['posicion:Sentado', 'material:Polea', 'agarre:Neutro', 'articulacion:Escapular', 'movimiento:Retracción', 'movimiento:Patrón > Tracción horizontal', 'musculo:Espalda > Dorsal Ancho', 'musculo:Espalda > Romboides Mayor', 'musculo:Bíceps']],
  ['6b088c5f-2501-4c67-aa7d-4c8ce712e1f2', 'Respiración en sentadilla profunda con cuerdas', ['posicion:Bipedestación', 'material:Cinchas de suspensión', 'movimiento:Patrón > Sentadilla', 'movimiento:Expansión toráfica', 'musculo:Diafragma']],
  ['7ca3381b-3724-4dc2-bc91-dd791e42cd4d', 'respiración sedestación en fitball', ['posicion:Sentado', 'material:Fitball', 'movimiento:Expansión toráfica', 'musculo:Diafragma']],
  ['df618f2f-fda0-494f-9f75-75644074126d', 'Roll up', ['posicion:Supino', 'articulacion:Columna', 'movimiento:Flexión', 'musculo:Abdomen > Recto abdominal']],
  ['483968ad-2037-4912-b6dc-ad154fce8bae', 'Rotación cervical', ['posicion:Sentado', 'articulacion:Columna > Cervical', 'movimiento:Rotación', 'musculo:Cervical']],
  ['2d150d7a-d02c-4b85-ae2c-7b27cd2abb53', 'Rotación cervical con brazo estirado', ['posicion:Sentado', 'articulacion:Columna > Cervical', 'movimiento:Rotación', 'musculo:Cervical', 'musculo:Trapecio > Superior']],
  ['e7e94347-37e0-4509-91a1-c61e143b8c4a', 'rotación cervical estirando tricep', ['posicion:Sentado', 'articulacion:Columna > Cervical', 'movimiento:Rotación', 'musculo:Cervical', 'musculo:Tríceps']],
  ['92459518-357f-4234-98aa-67f0e8339b5f', 'Rotación de cadera con deslizador', ['posicion:Supino', 'material:Deslizador', 'articulacion:Cadera', 'movimiento:Rotación', 'musculo:Glúteo']],
  ['2ebf95ac-292b-4c21-af3e-a741f4d875e0', 'rotación de cadera de lado a lado', ['posicion:Supino > Rodillas flexionadas', 'articulacion:Cadera', 'articulacion:Columna > Lumbar', 'movimiento:Rotación', 'musculo:Abdomen > Oblicuos']],
  ['b8f4ee51-d166-4147-bcb8-9e9adef86d6f', 'Rotación de cadera pierna estirada', ['posicion:Supino', 'articulacion:Cadera', 'movimiento:Rotación', 'musculo:Glúteo - Piramidal']],
  ['33f58edb-3e08-4ad6-a309-9b3c4fc13d75', 'rotación de cadera pies en suelo', ['posicion:Supino > Rodillas flexionadas', 'articulacion:Cadera', 'movimiento:Rotación', 'musculo:Glúteo - Piramidal']],
  ['9d12f85b-a693-4079-b659-293c6af72fc1', 'Rotación de cadera sedestación', ['posicion:Sentado', 'articulacion:Cadera', 'movimiento:Rotación > Rotación interna', 'movimiento:Rotación > Rotación externa', 'musculo:Glúteo - Piramidal']],
  ['68cc7f91-834a-42c3-9b98-b9253a409df5', 'Rotación de hombro combinada', ['posicion:Bipedestación', 'articulacion:Hombro', 'movimiento:Rotación', 'musculo:Hombro > Manguito rotador']],
  ['6d2f263a-683a-4a2f-8af7-e514e108a503', 'Rotación de torso con stick', ['posicion:Sentado', 'material:Stick', 'articulacion:Columna > Dorsal', 'movimiento:Rotación', 'musculo:Abdomen > Oblicuos']],
  ['02b0d663-bdb5-4afc-85d2-9641a5cb30ef', 'Rotación externa de hombro', ['posicion:Bipedestación', 'material:Banda elástica', 'articulacion:Hombro', 'movimiento:Rotación > Rotación externa', 'musculo:Hombro > Manguito rotador > Infraespinoso']],
  ['c48fbc4c-0896-4c35-a68b-ccad0a0218bb', 'Rotación externa de hombro (repetido)', ['posicion:Bipedestación', 'material:Banda elástica', 'articulacion:Hombro', 'movimiento:Rotación > Rotación externa', 'musculo:Hombro > Manguito rotador > Infraespinoso']],
  ['e5d54bcb-0346-4098-908a-69f85733b256', 'rotación interna de hombro', ['posicion:Bipedestación', 'material:Banda elástica', 'articulacion:Hombro', 'movimiento:Rotación > Rotación interna', 'musculo:Hombro > Manguito rotador > Subescapular']],
  ['cdd25ea1-6b28-4c5a-832d-99cbe729bb7a', 'Rotaciones de cadera pies en el suelo', ['posicion:Supino > Rodillas flexionadas', 'articulacion:Cadera', 'movimiento:Rotación', 'musculo:Glúteo - Piramidal']],
  ['27689afb-2e7a-48ea-822f-9c1f5c49f5b9', 'rueda por la pared', ['posicion:Bipedestación', 'material:Rueda abdominal', 'material:Pared', 'articulacion:Hombro', 'movimiento:Flexión', 'musculo:Hombro > Deltoides']],
  ['3a804c1a-4610-4121-87a0-90e833856761', 'sacudir el saco', ['posicion:Bipedestación', 'material:Saco', 'articulacion:Hombro', 'musculo:Hombro', 'musculo:Abdomen']],
  ['48cc5f44-7023-431e-a8c5-5225201783ee', 'salto desde el cajón y salida lateral', ['posicion:Bipedestación', 'material:Cajón pliométrico', 'movimiento:Patrón > Salto', 'articulacion:Rodilla', 'articulacion:Tobillo', 'musculo:Cuádriceps', 'musculo:Glúteo']],
  ['8e5eb310-9597-4644-9bd0-883dbac267f9', 'saltos frontales con fitball', ['posicion:Bipedestación', 'material:Fitball', 'movimiento:Patrón > Salto', 'musculo:Cuádriceps', 'musculo:Glúteo']],
  ['f4f25429-596a-45ea-8c28-92888b9a0c14', 'sentadilla cara a la pared', ['posicion:Bipedestación', 'material:Pared', 'movimiento:Patrón > Sentadilla', 'articulacion:Cadera', 'articulacion:Rodilla', 'musculo:Cuádriceps', 'musculo:Glúteo']],
  ['bcdc0e1f-fe44-469a-9c79-bc9e6e23f4ba', 'sentadilla con press de hombro', ['posicion:Bipedestación', 'material:Mancuerna', 'movimiento:Patrón > Sentadilla', 'movimiento:Patrón > Empuje vertical', 'musculo:Cuádriceps', 'musculo:Glúteo', 'musculo:Hombro > Deltoides']],
  ['489ec6ad-6c28-4fdd-a128-f3dbe0a6c48d', 'Sentadilla profunda hacia la pared con fitball', ['posicion:Bipedestación', 'material:Fitball', 'material:Pared', 'movimiento:Patrón > Sentadilla', 'articulacion:Cadera', 'articulacion:Rodilla', 'musculo:Cuádriceps', 'musculo:Glúteo']],
  ['09d4e489-e35b-4678-8345-70376d480154', 'sentarse en talones', ['posicion:Arrodillado', 'articulacion:Rodilla', 'articulacion:Tobillo', 'movimiento:Flexión', 'musculo:Cuádriceps']],
  ['854281df-dc36-4a3a-aa52-c1ad9f7285db', 'Sierra', ['posicion:Sentado > En el suelo', 'articulacion:Columna', 'movimiento:Rotación', 'movimiento:Flexión', 'musculo:Abdomen > Oblicuos', 'musculo:Isquiotibial']],
  ['58c50291-9956-4996-b109-6b30ec247530', 'subir piernas a la pared', ['posicion:Supino', 'material:Pared', 'articulacion:Cadera', 'movimiento:Flexión de cadera', 'musculo:Isquiotibial']],
  ['f491164a-ebf6-4da2-9fad-5d87a2e0afe4', 'subir piernas separadas a la pared', ['posicion:Supino', 'material:Pared', 'articulacion:Cadera', 'movimiento:Abducción', 'musculo:Aductores']],
  ['fe53aed1-7bca-4bda-aa36-e477deb462b6', 'Subir y bajar del cajón', ['posicion:Bipedestación', 'material:Cajón', 'apoyo:Unipodal', 'articulacion:Cadera', 'articulacion:Rodilla', 'musculo:Cuádriceps', 'musculo:Glúteo']],
  ['84330145-2365-41d5-8cfc-f83916db3836', 'Trabajo postural bipedestación', ['posicion:Bipedestación', 'articulacion:Columna', 'musculo:Espalda > Erectores Espinales', 'musculo:Abdomen > Transverso']],
  ['3f058f87-b0ac-4c3d-a0f3-2dfb8954e704', 'Trabajo postural sedestación', ['posicion:Sentado', 'articulacion:Columna', 'musculo:Espalda > Erectores Espinales', 'musculo:Abdomen > Transverso']],
  ['7b51a053-3d75-48a6-a661-2a2c5019cd7d', 'Trabajo postural supino', ['posicion:Supino', 'articulacion:Columna', 'musculo:Espalda > Erectores Espinales', 'musculo:Abdomen > Transverso']],
]

const norm = (s: string) => (s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/\s*>\s*/g, '>').trim()

export default function SembrarEtiquetas() {
  const router = useRouter()
  const [ets, setEts] = useState<any[]>([])
  const [actuales, setActuales] = useState<Record<string, any>>({})
  const [fuera, setFuera] = useState<Set<string>>(new Set())
  const [cargando, setCargando] = useState(true)
  const [log, setLog] = useState('')
  const [haciendo, setHaciendo] = useState(false)

  async function cargar() {
    const [a, b] = await Promise.all([
      traerTodo((d, h) => supabase.from('etiquetas').select('id,nombre,padre_id,categoria').order('id').range(d, h)),
      supabase.from('ejercicios').select('id,nombre,etiquetas').in('id', P.map(p => p[0])),
    ])
    setEts(a.filas)
    setActuales(Object.fromEntries((b.data || []).map((e: any) => [e.id, e])))
    setCargando(false)
  }
  useEffect(() => { cargar() }, [])

  /** "categoria:Raíz > Hija" → etiqueta. La ruta es raíz y hoja, como en el catálogo. */
  const indice = useMemo(() => {
    const ruta = (e: any): any[] => { const r = [e]; let x = e; const v = new Set(); while (x?.padre_id && !v.has(x.id)) { v.add(x.id); x = ets.find(y => y.id === x.padre_id); if (x) r.unshift(x) } return r }
    const m: Record<string, any> = {}
    ets.forEach(e => {
      const r = ruta(e); const cat = r[0]?.categoria || e.categoria
      m[`${cat}:${norm(r.map(x => x.nombre).join('>'))}`] = e
    })
    return m
  }, [ets])
  const resolver = (t: string) => { const i = t.indexOf(':'); return indice[`${t.slice(0, i)}:${norm(t.slice(i + 1))}`] }

  const filas = P.map(([id, nombre, tags]) => {
    const ej = actuales[id]
    const ids = tags.map(resolver).filter(Boolean).map((e: any) => e.id)
    const sinResolver = tags.filter(t => !resolver(t))
    const yaTiene = ej && (ej.etiquetas || []).length > 0
    return { id, nombre: ej?.nombre || nombre, tags, ids, sinResolver, existe: !!ej, yaTiene }
  })
  const aplicables = filas.filter(f => f.existe && !f.yaTiene && f.ids.length && !fuera.has(f.id))

  async function aplicar() {
    setHaciendo(true)
    let ok = 0, mal = 0
    for (const f of aplicables) {
      const { error } = await supabase.from('ejercicios').update({ etiquetas: f.ids }).eq('id', f.id)
      if (error) mal++; else ok++
    }
    await cargar()
    setHaciendo(false)
    setLog(`✓ ${ok} ejercicios con etiquetas` + (mal ? ` · ${mal} con error` : ''))
  }

  if (cargando) return <div className="muted" style={{ padding: 40, textAlign: 'center' }}>Cargando…</div>
  const nombreEt = (t: string) => t.slice(t.indexOf(':') + 1).split('>').pop()!.trim()

  return (
    <div style={{ maxWidth: 1100, margin: '0 auto', padding: '10px 4px 90px' }}>
      <div style={{ fontSize: 20, marginBottom: 4 }}>Etiquetas para los ejercicios sin ninguna</div>
      <div style={{ fontSize: 12.5, color: 'var(--gr)', marginBottom: 18 }}>
        Propuesta por el nombre de cada ejercicio. Toca una tarjeta para dejarla fuera. Solo se aplica a los que siguen sin etiquetas.
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(200px,1fr))', gap: 12 }}>
        {filas.map(f => {
          const off = fuera.has(f.id) || f.yaTiene || !f.existe
          return (
            <div key={f.id} onClick={() => !f.yaTiene && f.existe && setFuera(s => { const n = new Set(s); n.has(f.id) ? n.delete(f.id) : n.add(f.id); return n })}
              style={{ background: '#fff', borderRadius: 14, overflow: 'hidden', boxShadow: '0 3px 12px rgba(38,40,37,.08)', cursor: 'pointer',
                opacity: off ? .45 : 1, outline: off ? 'none' : '2px solid var(--gl)' }}>
              <div style={{ width: '62%', margin: '8px auto 0' }}><ImagenEjercicio etiquetasEj={f.ids} radio={10} fondo="var(--bl)" icono={20}/></div>
              <div style={{ padding: '6px 10px 10px' }}>
                <div style={{ fontSize: 12.5, marginBottom: 4 }}>{f.nombre}</div>
                {f.yaTiene && <div style={{ fontSize: 11, color: 'var(--gd)' }}>✓ ya tiene etiquetas</div>}
                {!f.existe && <div style={{ fontSize: 11, color: 'var(--grl)' }}>ya no existe</div>}
                {!f.yaTiene && f.existe && (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 3 }}>
                    {f.tags.map(t => <span key={t} style={{ fontSize: 10.5, padding: '1px 7px', borderRadius: 99, background: resolver(t) ? 'var(--gl)' : '#FBE3DF', color: resolver(t) ? 'var(--gd)' : 'var(--red)' }}>{nombreEt(t)}</span>)}
                  </div>
                )}
              </div>
            </div>
          )
        })}
      </div>
      <div style={{ position: 'fixed', left: 0, right: 0, bottom: 22, display: 'flex', justifyContent: 'center', zIndex: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, background: '#fff', borderRadius: 99, padding: '8px 10px 8px 18px', boxShadow: '0 12px 30px rgba(38,40,37,.18)' }}>
          <span style={{ fontSize: 12.5, color: 'var(--gd)' }}>{log || `${aplicables.length} listos para aplicar`}</span>
          <button className="btn btn-p" disabled={haciendo || !aplicables.length} onClick={aplicar}>{haciendo ? 'Aplicando…' : 'Aplicar'}</button>
          {log && <button className="btn btn-t btn-sm" onClick={() => router.push('/torno?que=ejercicios')}>Ir al torno</button>}
        </div>
      </div>
    </div>
  )
}
