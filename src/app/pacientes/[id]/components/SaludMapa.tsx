'use client'
import { useState, useEffect, useRef } from 'react'
import CuerpoZonas, { type ColorZona } from '@/components/CuerpoZonas'
import { ZONAS_CUERPO, zonasDeTest } from '@/lib/zonasCuerpo'
import { supabase } from '@/lib/supabase'
import { Ic } from '@/lib/icons'
import Silueta, { MarcaCuerpo } from './Silueta'
import BuscadorBiblioteca from '@/components/BuscadorBiblioteca'
import Sparkline from './Sparkline'
import Documentos from './Documentos'
import { textoMedida } from '@/lib/tests'
import { anadirALista, quitarDeLista, type ListaClinica } from '@/lib/listasPaciente'
import EscalaSlider, { textoEscala } from '@/components/EscalaSlider'
import ModalItemClinico, { type ConfigItemClinico } from '@/components/ModalItemClinico'
import { hoyISO } from '@/lib/fechas'
import SaludRegistrosTest from './SaludRegistrosTest'
import SaludDetalle from './SaludDetalle'
import SaludLista from './SaludLista'

// Trozo de pantalla sacado de SaludTab.tsx tal cual (misma logica, mismos datos):
// el archivo grande se queda con el estado y este solo pinta. Lo que necesita le llega
// por props desde alli.
export default function SaludMapa(p: any) {
  const { alergias, deportesPac, escalas, id, intolerancias, marcasCuerpo, medicamentos, molestias, nDocs, nombreTest, operaciones, pac, patologias, setDetalle, testsNegativos, testsPositivos, vista } = p
  return (<>{vista==='mapa' && (
        <div className="panel">
          <Silueta
            marcas={marcasCuerpo}
            altura={pac?.altura_cm}
            peso={pac?.peso_kg}
            flancoIzq={
              <div>
                <div className="sec-sub" style={{color:'var(--red)'}}>Tests sin resolver · {testsPositivos.length}</div>
                {testsPositivos.length===0 && <div className="muted">Ninguno</div>}
                {testsPositivos.map((g: any)=>(
                  <div key={g[0].id} className="fila-p test-clic" style={{borderLeftColor:'var(--red)'}} onClick={()=>setDetalle({tipo:'test',datos:g})}>
                    <div style={{flex:1,fontSize:13,color:'var(--n)'}}>{nombreTest(g[0])}</div>
                    <Ic name="abajo" size={13}/>
                  </div>
                ))}
              </div>
            }
            flancoDer={
              <div>
                <div className="sec-sub" style={{color:'var(--gd)'}}>Tests resueltos · {testsNegativos.length}</div>
                {testsNegativos.length===0 && <div className="muted">Ninguno</div>}
                {testsNegativos.map((g: any)=>(
                  <div key={g[0].id} className="fila-p test-clic" style={{borderLeftColor:'var(--gm)'}} onClick={()=>setDetalle({tipo:'test',datos:g})}>
                    <div style={{flex:1,fontSize:13,color:'var(--gr)'}}>{nombreTest(g[0])}</div>
                    <Ic name="abajo" size={13}/>
                  </div>
                ))}
              </div>
            }
            izquierda={[
              { clave:'med',   icono:'medicamento',  label:'Medicación',    color:'#6B7FC4', vacio:'Sin medicación',
                items:(medicamentos||[]).map((m:any)=>m.nombre+(m.frecuencia?` · ${m.frecuencia}`:'')) },
              { clave:'alg',   icono:'alergia',      label:'Alergias',      color:'var(--red)', vacio:'Sin alergias',
                items:(alergias||[]).map((a:any)=>a.nombre) },
              { clave:'intol', icono:'intolerancia', label:'Intolerancias', color:'var(--amb)', vacio:'Sin intolerancias',
                items:(intolerancias||[]).map((i:any)=>i.nombre) },
            ]}
            derecha={[
              { clave:'plant', icono:'plantillas', label:'Plantillas', color:'var(--g)', vacio:'No usa plantillas',
                items: pac?.usa_plantillas
                  ? [pac.plantilla_izq?`Izquierdo: ${pac.plantilla_izq}`:'Izquierdo: sin especificar',
                     pac.plantilla_der?`Derecho: ${pac.plantilla_der}`:'Derecho: sin especificar']
                  : [] },
              { clave:'dep',   icono:'deporte',  label:'Deportes', color:'#6E9457', vacio:'Sin deportes',
                items:(deportesPac||[]).map((d:any)=>d.nombre) },
              { clave:'oper',  icono:'cruz',     label:'Operaciones', color:'#6B6D6A', vacio:'Sin operaciones',
                items:(operaciones||[]).map((o:any)=>o.nombre+(o.anio?` · ${o.anio}`:'')) },
              { clave:'doc',   icono:'carpeta',  label:'Documentos', color:'#6B6D6A', items:[], n:nDocs,
                contenido:<Documentos pacienteId={id} patologias={patologias} compacto/> },
              { clave:'esc',   icono:'progreso', label:'Escalas',  color:'#C4703F', vacio:'Sin registros',
                items: escalas.length>0
                  ? [`Bienestar ${textoEscala(escalas[0].borg)}`, `Estrés ${textoEscala(escalas[0].estres)}`,
                     `el ${new Date(escalas[0].fecha+'T12:00:00').toLocaleDateString('es-ES',{day:'numeric',month:'long'})}`]
                  : [] },
            ]}
            onAbrir={(ms)=>{
              const m = ms[0]
              if (m.origen==='molestia') {
                const dato = (molestias||[]).find((x:any)=>('mol_'+x.id)===m.id)
                if (dato) setDetalle({tipo:'molestia',datos:dato})
              } else {
                const dato = (patologias||[]).find((x:any)=>('pat_'+x.id)===m.id)
                if (dato) setDetalle({tipo:'patologia',datos:dato})
              }
            }}
          />

        </div>
      )}</>)
}
