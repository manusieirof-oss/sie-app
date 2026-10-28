import { supabase } from '@/lib/supabase'

// COMPROMISO DE CONFIDENCIALIDAD que firma cada trabajador antes de usar SIE.
//
// El texto vive aquí, en un solo sitio, para que lo que se acepta en pantalla y lo
// que se imprime para firmar a mano sean exactamente lo mismo. Los datos de la clínica
// salen de Ajustes → Clínica, así sirve igual para cualquier clínica que use SIE.
//
// VERSION: si se cambia el texto, se sube la versión y todos lo vuelven a aceptar al
// entrar. Lo firmado antes queda guardado con su versión.
export const VERSION_CONFIDENCIALIDAD = '2026-10'

export type Clinica = { nombre: string, nif: string, direccion: string }

export async function datosClinica(): Promise<Clinica> {
  const { data } = await supabase.from('ajustes').select('clave,valor')
    .in('clave', ['fiscal_nombre', 'clinica_nombre', 'fiscal_nif', 'fiscal_direccion', 'fiscal_cp', 'fiscal_localidad', 'fiscal_provincia'])
  const a: Record<string, string> = {}
  ;(data || []).forEach((x: any) => { a[x.clave] = (x.valor || '').trim() })
  const lugar = [a.fiscal_cp, a.fiscal_localidad].filter(Boolean).join(' ')
  return {
    nombre: a.fiscal_nombre || a.clinica_nombre || 'la clínica',
    nif: a.fiscal_nif || '',
    direccion: [a.fiscal_direccion, lugar, a.fiscal_provincia].filter(Boolean).join(', '),
  }
}

/** Cada apartado: título y párrafos. Se pinta igual en pantalla y en papel. */
export function textoConfidencialidad(c: Clinica): { titulo: string, parrafos: string[] }[] {
  const resp = `${c.nombre}${c.nif ? ` (NIF ${c.nif})` : ''}${c.direccion ? `, con domicilio en ${c.direccion}` : ''}`
  return [
    {
      titulo: '1. Objeto',
      parrafos: [
        `Para hacer su trabajo, la persona firmante tendrá acceso a SIE, la aplicación de gestión de ${resp}, que es la responsable del tratamiento de los datos que contiene.`,
        'En SIE hay datos personales de pacientes y clientes (identificación, contacto, pagos), datos de salud (anamnesis, lesiones, alertas, molestias, valoraciones, tests, frecuencia cardiaca), fotografías y vídeos, y datos de otros trabajadores. Los datos de salud son una categoría especial y tienen la máxima protección (art. 9 del Reglamento (UE) 2016/679, RGPD).',
      ],
    },
    {
      titulo: '2. Qué me comprometo a hacer',
      parrafos: [
        'Usar los datos solo para las tareas de mi puesto y consultar únicamente las fichas que necesito para atender a cada persona.',
        'No copiar, descargar, imprimir, fotografiar ni hacer capturas de pantalla de la información de SIE, ni sacarla de la aplicación por ningún medio (correo, mensajería, redes sociales, memorias USB, nubes personales), salvo que la clínica lo pida expresamente para una tarea concreta.',
        'No comentar con nadie, dentro o fuera del centro, la información de pacientes que conozca por mi trabajo, salvo con los compañeros que la necesiten para atenderles.',
        'Grabar o fotografiar a pacientes solo con las herramientas de SIE y para los fines para los que el paciente lo ha autorizado, y no guardar esas imágenes en mis dispositivos.',
        'Guardar en secreto mi usuario y contraseña, que son personales e intransferibles; no dejar que nadie entre con mi cuenta y no entrar con la de otro.',
        'Cerrar la sesión o bloquear la pantalla cuando deje el ordenador, la tableta o el móvil, y no dejar información de pacientes a la vista de terceros.',
        'Avisar de inmediato a dirección si pierdo un dispositivo con acceso a SIE, si creo que alguien conoce mi contraseña o si detecto cualquier acceso, pérdida o uso indebido de datos. La clínica tiene 72 horas para comunicar a la Agencia Española de Protección de Datos las brechas de seguridad, por eso el aviso tiene que ser inmediato.',
        'Si un paciente me pide acceder a sus datos, corregirlos o borrarlos, pasar la petición a dirección.',
      ],
    },
    {
      titulo: '3. Duración',
      parrafos: [
        'Este deber de confidencialidad se mantiene mientras trabaje en el centro y también después de terminar la relación laboral o profesional, sin límite de tiempo (art. 5 de la Ley Orgánica 3/2018, LOPDGDD). Al terminar devolveré o borraré cualquier información de la clínica que tenga y dejaré de usar mi acceso a SIE.',
      ],
    },
    {
      titulo: '4. Control e incumplimiento',
      parrafos: [
        'SIE guarda quién acepta este compromiso y cuándo. La clínica podrá revisar el uso que se hace de la aplicación para comprobar que se cumple, dentro de lo que permite la ley.',
        'No cumplir este compromiso puede suponer una falta laboral sancionable según el Estatuto de los Trabajadores y el convenio aplicable, además de las responsabilidades civiles, administrativas o penales que correspondan.',
      ],
    },
    {
      titulo: '5. Mis propios datos',
      parrafos: [
        `${c.nombre} trata mis datos (nombre, correo, accesos a SIE y esta aceptación) para gestionar mi acceso a la aplicación y poder demostrar que conozco estas obligaciones. Puedo ejercer mis derechos de acceso, rectificación, supresión, oposición, limitación y portabilidad dirigiéndome a dirección, y reclamar ante la Agencia Española de Protección de Datos (www.aepd.es).`,
      ],
    },
  ]
}

export type Firma = { id: string, user_id: string, nombre: string | null, version: string, aceptada: string }

/** ¿Ha aceptado ya la versión actual quien está dentro? */
export async function firmaVigente(userId: string): Promise<Firma | null> {
  const { data } = await supabase.from('confidencialidad_firmas').select('*')
    .eq('user_id', userId).eq('version', VERSION_CONFIDENCIALIDAD).order('aceptada', { ascending: false }).limit(1)
  return (data?.[0] as Firma) || null
}

export async function aceptar(nombre: string) {
  const { error } = await supabase.from('confidencialidad_firmas').insert({
    nombre, version: VERSION_CONFIDENCIALIDAD,
    // El navegador desde el que se acepta: ayuda a demostrar que lo hizo esa persona.
    dispositivo: typeof navigator !== 'undefined' ? navigator.userAgent.slice(0, 300) : null,
  })
  if (error) throw error
}
