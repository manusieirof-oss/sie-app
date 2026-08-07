'use client'
import { useState } from 'react'
import BibliotecaClinica, { type ConfigClinica } from './BibliotecaClinica'
import { Ic } from '@/lib/icons'

/**
 * Las seis listas clínicas. Todas con el MISMO componente.
 *
 * Antes eran tres distintos: patologías y molestias por su cuenta y sin poder añadir nada
 * —había que meter filas a mano en Supabase—, y un catálogo genérico para las otras
 * cuatro. Lo único que de verdad cambia entre ellas es la tabla, cómo se agrupan y qué
 * campos propios tienen; eso va en la configuración de aquí abajo y no en tres ficheros.
 */

const SUBS: { k: string, icono: string, label: string, config: ConfigClinica }[] = [
  { k: 'patologias', icono: 'patologia', label: 'Patologías',
    config: { tabla: 'patologias_biblioteca', tipo: 'patología', campoGrupo: 'zona', tema: 'neutro',
      extras: [{ campo: 'sistema', etiqueta: 'Sistema' }, { campo: 'gravedad_tipica', etiqueta: 'Gravedad' }] } },
  { k: 'molestias', icono: 'molestia', label: 'Molestias',
    config: { tabla: 'molestias_biblioteca', tipo: 'molestia', campoGrupo: 'zona', tema: 'rojo' } },
  { k: 'medicamentos', icono: 'medicamento', label: 'Medicamentos',
    config: { tabla: 'medicamentos_biblioteca', tipo: 'medicamento', campoGrupo: 'categoria', tema: 'neutro' } },
  { k: 'alergias', icono: 'alergia', label: 'Alergias',
    config: { tabla: 'alergias_biblioteca', tipo: 'alergia', campoGrupo: 'categoria', tema: 'rojo' } },
  { k: 'intolerancias', icono: 'intolerancia', label: 'Intolerancias',
    config: { tabla: 'intolerancias_biblioteca', tipo: 'intolerancia', campoGrupo: 'categoria', tema: 'ambar' } },
  { k: 'operaciones', icono: 'cruz', label: 'Operaciones',
    config: { tabla: 'operaciones_biblioteca', tipo: 'operación', campoGrupo: 'zona', tema: 'neutro' } },
]

export default function ClinicoTab({ patologiasBiblio, molestiasBiblio, medsBiblio, alergiasBiblio, intolBiblio, opsBiblioLib, etiquetas = [], cargar }: any) {
  const [sub, setSub] = useState('patologias')

  const datos: Record<string, any[]> = {
    patologias: patologiasBiblio, molestias: molestiasBiblio, medicamentos: medsBiblio,
    alergias: alergiasBiblio, intolerancias: intolBiblio, operaciones: opsBiblioLib,
  }
  const activa = SUBS.find(s => s.k === sub) || SUBS[0]

  return (
    <div className="panel">
      <div style={{ display: 'flex', gap: 4, marginBottom: 14, background: 'var(--bl)', border: '1px solid var(--bd)', borderRadius: 'var(--rl)', padding: 3, flexWrap: 'wrap' }}>
        {SUBS.map(s => (
          <button key={s.k} onClick={() => setSub(s.k)}
            style={{ fontSize: 12, padding: '7px 12px', borderRadius: 6, border: 'none', cursor: 'pointer', fontFamily: 'system-ui', background: sub === s.k ? 'var(--w)' : 'transparent', color: sub === s.k ? 'var(--n)' : 'var(--grl)', fontWeight: sub === s.k ? 500 : 400, boxShadow: sub === s.k ? '0 1px 3px rgba(0,0,0,.08)' : 'none', display: 'flex', alignItems: 'center', gap: 5 }}>
            <Ic name={s.icono} size={13} /> {s.label}
            <span style={{ fontSize: 11, color: 'var(--grl)' }}>{(datos[s.k] || []).length}</span>
          </button>
        ))}
      </div>

      <BibliotecaClinica
        items={datos[sub] || []}
        config={activa.config}
        etiquetas={etiquetas}
        cargar={cargar}
      />
    </div>
  )
}
