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

// Trozo de pantalla sacado de SaludTab.tsx tal cual (misma logica, mismos datos):
// el archivo grande se queda con el estado y este solo pinta. Lo que necesita le llega
// por props desde alli.
export default function SaludRegistrosTest(p: any) {
  const { borrarResultado, cap, registrosDe, setRegistrosDe, tests } = p
  return (<>{registrosDe && (()=>{
        // Se filtran de `tests` en el momento: al borrar uno, la lista se rehace sola.
        const filas = (tests||[])
          .filter((x:any)=>x.test_id===registrosDe.id)
          .sort((a:any,b:any)=>`${b.fecha}T${b.created_at||''}`.localeCompare(`${a.fecha}T${a.created_at||''}`))
        return (
          <div className="modal-bg" onClick={e=>{if(e.target===e.currentTarget)setRegistrosDe(null)}}>
            <div className="modal" style={{width:'min(820px, 94vw)'}}>
              <div className="modal-title">
                {registrosDe.nombre}
                <button className="modal-close" onClick={()=>setRegistrosDe(null)}><Ic name="cerrar" size={15}/></button>
              </div>
              <div className="sec-sub">
                {filas.length} {filas.length===1?'registro':'registros'} · el más reciente de cada lado es el que manda en la ficha
              </div>

              {filas.length===0 && <div className="muted">Sin registros.</div>}

              {filas.map((r:any, i:number)=>{
                const pos = r.resultado==='positivo'
                // El vigente de cada lado: el primero que aparece de ese lado, porque
                // vienen ordenados de más nuevo a más viejo. Borrarlo cambia lo que se ve
                // en la ficha, y eso hay que decirlo antes y no después.
                const vigente = filas.findIndex((x:any)=>(x.lado||'bilateral')===(r.lado||'bilateral')) === i
                const marcados = (r.items_resultado||[]).filter((it:any)=>it.marcado)
                return (
                  <div key={r.id} style={{display:'flex',alignItems:'flex-start',gap:10,padding:'8px 0',borderTop:i?'1px solid var(--bd)':'none'}}>
                    <div style={{width:96,flexShrink:0,fontSize:12,color:'var(--n)'}}>
                      {new Date(r.fecha+'T12:00:00').toLocaleDateString('es-ES',{day:'numeric',month:'short',year:'numeric'})}
                    </div>
                    <div style={{width:86,flexShrink:0,fontSize:11,fontWeight:600,letterSpacing:.4,textTransform:'uppercase',color:'var(--gr)'}}>
                      {cap(r.lado||'bilateral')}
                    </div>
                    <div style={{width:74,flexShrink:0,fontSize:12,color:pos?'var(--red)':'var(--gd)'}}>
                      {pos?'Positivo':'Negativo'}
                    </div>
                    <div style={{flex:1,minWidth:0,fontSize:12,color:'var(--gr)'}}>
                      {marcados.length>0
                        ? marcados.map((it:any)=>it.nombre+(textoMedida(it)?' · '+textoMedida(it):'')).join(' · ')
                        : <span style={{color:'var(--grl)'}}>Nada marcado</span>}
                      {r.observaciones && <div style={{fontStyle:'italic',marginTop:2}}>{r.observaciones}</div>}
                      {vigente && <div style={{fontSize:11,color:'var(--gd)',marginTop:2}}>Es el que se ve en la ficha</div>}
                    </div>
                    <button className="et-b et-b-r" style={{flexShrink:0}} title="Borrar este registro"
                      onClick={()=>borrarResultado(r)}>
                      <Ic name="papelera" size={12}/>
                    </button>
                  </div>
                )
              })}

              <div style={{fontSize:12,color:'var(--gr)',marginTop:12,lineHeight:1.5}}>
                Borrar un registro no cierra ni reabre los objetivos que abrió: eso se decide
                en la ficha del paciente.
              </div>
            </div>
          </div>
        )
      })()}</>)
}
