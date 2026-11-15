'use client'
import { useEffect, useMemo, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import { Ic } from '@/lib/icons'
import ModalCobro from '@/components/ModalCobro'
import BuscadorPacientes from '@/components/BuscadorPacientes'
import { indicePlanes, precioFinalPlan, precioConDescuento, esVentaPuntual, adelantarCuota, unaCuotaPorPacienteYMes,
         cobrosDesde, antesDeCobrarConLaApp, quitarBono } from '@/lib/bonos'
import { listadoGestoria } from '@/lib/cobros'
import { xlsx, descargarXlsx } from '@/lib/xlsx'
import { resumirMes, type EntradaMes } from '@/lib/grupoMes'
import { cargarTarifas } from '@/lib/tarifas'
import { abrirFactura } from '@/lib/factura'
import { rangoDeMes, hoyISO } from '@/lib/fechas'
import Link from 'next/link'
import { contiene } from '@/lib/texto'
import { MESES } from './meses'

// Trozo de pantalla sacado de page.tsx tal cual (misma logica, mismos datos):
// el archivo grande se queda con el estado y este solo pinta. Lo que necesita le llega
// por props desde alli.

export default function CuerpoCobros(p: any) {
  const { abrirCobro, adelantando, adelantar, cargando, dadasDe, faltanDeVerdad, filas, idx, marcarImpago, mes, mesPorLlegar, quitarCuota, sinCuota, sueltosMes, vista } = p
  return (<>{cargando ? (
        <div style={{fontSize:11,color:'var(--grl)',padding:20}}>Cargando...</div>
      ) : vista === 'sincuota' ? (
        sinCuota.length === 0 ? (
          <div style={{fontSize:11,color:'var(--grl)',padding:24,textAlign:'center'}}>
            Todos los clientes tienen bono de {MESES[mes-1].toLowerCase()}.
          </div>
        ) : (
          <>
            <div style={{fontSize:10,color:'#7A5800',background:'var(--ambl)',border:'1px solid var(--amb)',
                         borderRadius:8,padding:'10px 13px',marginBottom:10,lineHeight:1.6}}>
              {/* En un mes que no ha llegado esto no es un olvido: es que la
                  renovacion corre el dia 1. Decirles que "les falta el bono"
                  seria acusar a 136 personas de algo que no ha pasado. */}
              {mesPorLlegar ? <>
                <strong>{MESES[mes-1]} todavía no ha empezado.</strong> Las cuotas se crean solas el día 1,
                así que aquí está todo el que aún no la tiene. Si alguien viene a pagar por adelantado,
                adelántale la suya y pasa a Pendientes.
              </> : <>
                <strong>{faltanDeVerdad} clientes sin bono de {MESES[mes-1].toLowerCase()}.</strong> No aparecen
                en la lista de cobros porque no hay nada que cobrarles: hay que asignarles el bono desde su ficha.
                {' '}Los que están <strong>en pausa</strong> también cuentan — pausa es que está de vacaciones, y el mes se cobra igual.
              </>}
              {sinCuota.length > faltanDeVerdad && <>
                {' '}Los {sinCuota.length - faltanDeVerdad} de abajo del todo ya tienen bono para más adelante: esos están resueltos.
              </>}
            </div>
            {sinCuota.map((p: any) => (
              <Link key={p.id} href={`/pacientes/${p.id}`}
                style={{display:'flex',alignItems:'center',gap:10,padding:'9px 13px',borderRadius:8,
                        border:'1px solid var(--bd)',marginBottom:6,background:'var(--w)',textDecoration:'none'}}>
                <div style={{flex:1,minWidth:0}}>
                  <div style={{fontSize:12,fontWeight:500,color:'var(--n)'}}>{p.nombre} {p.apellidos}</div>
                  {!p.dni && <div style={{fontSize:9,color:'var(--grl)'}}>sin DNI</div>}
                </div>
                {p.estado==='pausa' && <span style={{fontSize:9,color:'#7A5800',fontWeight:600}}>en pausa</span>}
                {p.empiezaEn && (
                  <span style={{fontSize:9,color:'var(--gd)',fontWeight:600,whiteSpace:'nowrap'}}>
                    empieza en {MESES[Number(p.empiezaEn.split('-')[1])-1].toLowerCase()}
                  </span>
                )}
                {mesPorLlegar && !p.empiezaEn && (
                  <button className="btn btn-s btn-sm" disabled={adelantando===p.id}
                    onClick={e=>{e.preventDefault();e.stopPropagation();adelantar(p)}}
                    title={`Le crea ya la cuota de ${MESES[mes-1].toLowerCase()} para poder cobrarla`}>
                    {adelantando===p.id ? 'Creando…' : `Adelantar ${MESES[mes-1].toLowerCase()}`}
                  </button>
                )}
                {(dadasDe[p.id]||0) > 0 && (
                  <span style={{fontSize:9,color:'var(--red)',fontWeight:600}}>
                    {dadasDe[p.id]} {dadasDe[p.id]===1?'clase':'clases'} este mes
                  </span>
                )}
                {!p.empiezaEn && <span style={{fontSize:10,color:'var(--gd)'}}>Asignar bono →</span>}
              </Link>
            ))}
          </>
        )
      ) : filas.length === 0 ? (
        <div style={{fontSize:11,color:'var(--grl)',padding:24,textAlign:'center'}}>
          {vista==='pendientes' ? 'No queda nadie por cobrar este mes.'
           : vista==='impagos' ? 'No hay nadie marcado como impago este mes.'
           : vista==='vinieron' ? 'Nadie con cuota ha venido todavía este mes.'
           : 'Nadie tiene cuota asignada ni ha consumido nada este mes.'}
        </div>
      ) : filas.map(({ p, bono, pagado, impago, importe, cobrado, clases, dadas, mostrarClases }: any) => (
        <div key={bono?.id || p.id} style={{display:'flex',alignItems:'center',gap:10,padding:'10px 13px',borderRadius:8,
                                border:`1px solid ${impago?'var(--red)':'var(--bd)'}`,marginBottom:6,
                                background:pagado?'var(--gl)':impago?'var(--redl)':'var(--w)'}}>
          <div style={{flex:1,minWidth:0}}>
            <div style={{fontSize:12,fontWeight:500,color:'var(--n)'}}>
              {p.nombre} {p.apellidos}
              {p.estado==='pausa' && <span style={{fontSize:9,color:'#7A5800',marginLeft:6}}>en pausa</span>}
              {/* Se fue empezado el mes. La cuota se le cobra igual —mes empezado, mes
                  cobrado— pero hay que saber que ya no viene: es a quien hay que reclamar
                  por teléfono, no esperar a que aparezca por la puerta. */}
              {(p.estado==='baja' || p.estado==='puede_volver') && (
                <span style={{fontSize:9,color:'var(--red)',marginLeft:6,fontWeight:600}}>
                  {p.estado==='baja' ? 'de baja' : 'ya no viene'}
                </span>
              )}
              {impago && <span style={{fontSize:9,color:'var(--red)',marginLeft:6,fontWeight:600}}>impago</span>}
            </div>
            <div style={{fontSize:9,color:'var(--grl)'}}>
              {/* Sin bono, la fila la trae un cobro suelto: se dice QUÉ se le
                  cobró, que es lo único que explica por qué está aquí. */}
              {bono ? (idx[bono.tipo]?.nombre || bono.tipo)
                    : (sueltosMes[p.id]?.conceptos.join(' · ') || 'Cobro suelto')}
              {/* Sin esto, las dos filas de quien tiene cuota Y sesiones se leen
                  como una duplicada. */}
              {bono && esVentaPuntual(bono) && <span style={{color:'var(--gd)'}}>{' · '}{bono.sesiones_totales} sesiones</span>}
              {!p.dni && ' · sin DNI'}
              {/* Lo que ya ha entrenado sin haber pagado. Cuanto más alto, más urge.
                  Y lo que solo esta puesto en la agenda no es un argumento para
                  cobrar: en un mes que no ha empezado, "9 clases ya" era mentira. */}
              {!pagado && mostrarClases && dadas > 0 && (
                <span style={{color:dadas>=4?'var(--red)':'#7A5800',fontWeight:600}}>
                  {' · '}{dadas} {dadas===1?'clase':'clases'} ya
                </span>
              )}
              {!pagado && mostrarClases && dadas === 0 && clases > 0 && (
                <span style={{color:'var(--grl)'}}>
                  {' · '}{clases} {clases===1?'clase prevista':'clases previstas'}
                </span>
              )}
            </div>
          </div>
          <div style={{textAlign:'right'}}>
            {/* Cobrado: lo que entro. Pendiente: lo que toca cobrar. */}
            <div style={{fontSize:13,fontWeight:600,color:pagado?'#3E7179':'var(--n)'}}>
              {(pagado ? cobrado : importe).toFixed(2)} €
            </div>
            {pagado && bono && Math.abs(cobrado - importe) >= 0.01 && (
              <div style={{fontSize:9,color:'var(--grl)'}}>de {importe.toFixed(2)} €</div>
            )}
          </div>
          {pagado ? (
            <span style={{fontSize:10,color:'#3E7179',display:'inline-flex',alignItems:'center',gap:4,minWidth:130,justifyContent:'flex-end'}}>
              <Ic name="check" size={13}/> Cobrado
            </span>
          ) : (
            <div style={{display:'flex',gap:5,minWidth:130,justifyContent:'flex-end'}}>
              {bono && (
                <button className="btn btn-s btn-sm" title={impago?'Volver a pendiente':'Marcar como impago: vino y no ha pagado'}
                  onClick={()=>marcarImpago(bono, !impago)}
                  style={impago?{color:'var(--red)',borderColor:'var(--red)'}:undefined}>
                  {impago ? 'Pendiente' : 'Impago'}
                </button>
              )}
              {bono && (
                <button className="btn btn-s btn-sm" title="Quitar esta cuota: no vino y no se le cobra"
                  onClick={()=>quitarCuota(bono, (p?.nombre_clinica || `${p?.nombre||''} ${p?.apellidos||''}`).trim() || 'este paciente')}
                  style={{color:'var(--grl)'}}>
                  <Ic name="papelera" size={12}/>
                </button>
              )}
              <button className="btn btn-p btn-sm" onClick={()=>abrirCobro(p, bono)}>Cobrar</button>
            </div>
          )}
        </div>
      ))}</>)
}
