'use client'
import { useState } from 'react'
import PatologiasTab from './PatologiasTab'
import MolestiasBibTab from './MolestiasBibTab'
import CatalogoTab from './CatalogoTab'
import { Ic } from '@/lib/icons'

export default function ClinicoTab({ patologiasBiblio, molestiasBiblio, medsBiblio, alergiasBiblio, intolBiblio, opsBiblioLib, cargar }: any) {
  const [sub, setSub] = useState('patologias')

  const SUBS = [
    ['patologias','patologia','Patologías'],
    ['molestias','molestia','Molestias'],
    ['medicamentos','medicamento','Medicamentos'],
    ['alergias','alergia','Alergias'],
    ['intolerancias','intolerancia','Intolerancias'],
    ['operaciones','cruz','Operaciones'],
  ]

  return (
    <>
      <div style={{display:'flex',gap:4,marginBottom:14,background:'var(--bl)',border:'1px solid var(--bd)',borderRadius:'var(--rl)',padding:3,flexWrap:'wrap'}}>
        {SUBS.map(([k,ic,l])=>(
          <button key={k} onClick={()=>setSub(k)}
            style={{fontSize:11,padding:'7px 12px',borderRadius:6,border:'none',cursor:'pointer',fontFamily:'system-ui',background:sub===k?'var(--w)':'transparent',color:sub===k?'var(--n)':'var(--grl)',fontWeight:sub===k?500:400,boxShadow:sub===k?'0 1px 3px rgba(0,0,0,.08)':'none',display:'flex',alignItems:'center',gap:5}}>
            <Ic name={ic} size={13}/> {l}
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
