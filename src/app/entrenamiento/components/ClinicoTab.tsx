'use client'
import { useState } from 'react'
import PatologiasTab from './PatologiasTab'
import MolestiasBibTab from './MolestiasBibTab'
import CatalogoTab from './CatalogoTab'

export default function ClinicoTab({ patologiasBiblio, molestiasBiblio, medsBiblio, alergiasBiblio, intolBiblio, opsBiblioLib, cargar }: any) {
  const [sub, setSub] = useState('patologias')

  const SUBS = [
    ['patologias','🏥 Patologías'],
    ['molestias','🤕 Molestias'],
    ['medicamentos','💊 Medicamentos'],
    ['alergias','🌿 Alergias'],
    ['intolerancias','⚠️ Intolerancias'],
    ['operaciones','🔪 Operaciones'],
  ]

  return (
    <>
      <div style={{display:'flex',gap:4,marginBottom:14,background:'var(--bl)',border:'1px solid var(--bd)',borderRadius:'var(--rl)',padding:3,flexWrap:'wrap'}}>
        {SUBS.map(([k,l])=>(
          <button key={k} onClick={()=>setSub(k)}
            style={{fontSize:10,padding:'6px 12px',borderRadius:6,border:'none',cursor:'pointer',fontFamily:'system-ui',background:sub===k?'var(--w)':'transparent',color:sub===k?'var(--n)':'var(--grl)',fontWeight:sub===k?500:300,boxShadow:sub===k?'0 1px 3px rgba(0,0,0,.08)':'none'}}>
            {l}
          </button>
        ))}
      </div>

      {sub==='patologias'&&<PatologiasTab patologiasBiblio={patologiasBiblio}/>}
      {sub==='molestias'&&<MolestiasBibTab molestiasBiblio={molestiasBiblio}/>}
      {sub==='medicamentos'&&<CatalogoTab items={medsBiblio} tipo="medicamento" tabla="medicamentos_biblioteca" campoGrupo="categoria" tema="neutro" cargar={cargar}/>}
      {sub==='alergias'&&<CatalogoTab items={alergiasBiblio} tipo="alergia" tabla="alergias_biblioteca" campoGrupo="categoria" tema="rojo" cargar={cargar}/>}
      {sub==='intolerancias'&&<CatalogoTab items={intolBiblio} tipo="intolerancia" tabla="intolerancias_biblioteca" campoGrupo="categoria" tema="ambar" cargar={cargar}/>}
      {sub==='operaciones'&&<CatalogoTab items={opsBiblioLib} tipo="operación" tabla="operaciones_biblioteca" campoGrupo="zona" tema="neutro" cargar={cargar}/>}
    </>
  )
}
