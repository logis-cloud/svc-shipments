const crypto=require("crypto");
const Envio=require("../models/envio.model");
const clientesClient=require("../clients/clientes.client");
const vehiculosClient=require("../clients/vehiculos.client");

function generarCodigoSeguimiento(){ return `LOG-${crypto.randomBytes(4).toString("hex").toUpperCase()}`; }

// Tope diario por par conductor-vehículo. No vive en el documento de envío:
// se cuenta con fechaCreacion sobre la colección existente. Se puede estirar
// por env var sin tocar el JSON.
const TOPE_ENVIOS_POR_PAR_POR_DIA=Math.max(1, Number(process.env.TOPE_ENVIOS_POR_PAR_POR_DIA)||15);
const ESTADOS_CERRADOS=["ENTREGADO","CANCELADO"];
// Lima no usa DST; 00:00 local = 05:00 UTC.
const OFFSET_HORAS_DIA=Number(process.env.ASSIGNMENT_TZ_OFFSET_HOURS ?? -5);

function rangoDelDia(now=new Date()){
  const local=new Date(now.getTime()+OFFSET_HORAS_DIA*60*60*1000);
  const y=local.getUTCFullYear(), m=local.getUTCMonth(), d=local.getUTCDate();
  const inicioUtcMs=Date.UTC(y,m,d)-OFFSET_HORAS_DIA*60*60*1000;
  return {inicio:new Date(inicioUtcMs), fin:new Date(inicioUtcMs+24*60*60*1000)};
}

function clavePar(idVehiculo, idConductor){ return `${idVehiculo}:${idConductor}`; }

function mapaConteos(filas){
  const mapa=new Map();
  for(const fila of filas) mapa.set(clavePar(fila._id.v, fila._id.c), fila.total);
  return mapa;
}

async function conteosDePares(pares, inicio, fin){
  const orPares=pares.map((p)=>({
    "vehiculoAsignado.idVehiculo":p.vehiculoAsignado.idVehiculo,
    "conductorAsignado.idConductor":p.conductorAsignado.idConductor
  }));
  const agrupar={_id:{v:"$vehiculoAsignado.idVehiculo", c:"$conductorAsignado.idConductor"}, total:{$sum:1}};
  const [hoy, abiertos]=await Promise.all([
    Envio.aggregate([{$match:{fechaCreacion:{$gte:inicio,$lt:fin}, $or:orPares}}, {$group:agrupar}]),
    Envio.aggregate([{$match:{estado:{$nin:ESTADOS_CERRADOS}, $or:orPares}}, {$group:agrupar}])
  ]);
  return {hoy:mapaConteos(hoy), abiertos:mapaConteos(abiertos)};
}

function elegirParConMenosCarga(pares, conteos){
  let elegido=null, mejorHoy=Infinity, mejorAbiertos=Infinity;
  for(const par of pares){
    const clave=clavePar(par.vehiculoAsignado.idVehiculo, par.conductorAsignado.idConductor);
    const enviosHoy=conteos.hoy.get(clave)||0;
    if(enviosHoy>=TOPE_ENVIOS_POR_PAR_POR_DIA) continue;
    const enviosAbiertos=conteos.abiertos.get(clave)||0;
    if(enviosAbiertos<mejorAbiertos || (enviosAbiertos===mejorAbiertos && enviosHoy<mejorHoy)){
      elegido=par;
      mejorAbiertos=enviosAbiertos;
      mejorHoy=enviosHoy;
    }
  }
  return elegido;
}

async function asignarParDisponible(){
  const pares=await vehiculosClient.listarParesDisponibles();
  if(!pares.length){
    const e=new Error("No hay vehículos disponibles con conductor activo en este momento");
    e.status=409; throw e;
  }
  const {inicio, fin}=rangoDelDia();
  const conteos=await conteosDePares(pares, inicio, fin);
  const asignacion=elegirParConMenosCarga(pares, conteos);
  if(!asignacion){
    const e=new Error(`Se alcanzó el tope diario de ${TOPE_ENVIOS_POR_PAR_POR_DIA} envíos para todos los pares conductor-vehículo disponibles`);
    e.status=409; throw e;
  }
  return asignacion;
}

async function listar({page=0,size=50,estado,clienteId}){
 const safeSize=Math.min(Number(size)||50,200), safePage=Math.max(Number(page)||0,0), filtro={};
 if(estado) filtro.estado=estado; if(clienteId!==undefined&&clienteId!==null&&clienteId!=="") filtro.clienteId=Number(clienteId);
 const [content,totalElements]=await Promise.all([Envio.find(filtro).sort({fechaCreacion:-1}).skip(safePage*safeSize).limit(safeSize).lean(),Envio.countDocuments(filtro)]);
 return {content,page:safePage,size:safeSize,totalElements,totalPages:Math.ceil(totalElements/safeSize)};
}

async function obtenerPorId(id){ const envio=await Envio.findById(id).lean(); if(!envio){const e=new Error("Envío no encontrado");e.status=404;throw e;} return envio; }

async function obtenerPorTracking(codigo){ const envio=await Envio.findOne({codigoSeguimiento:codigo}).lean(); if(!envio){const e=new Error("Envío no encontrado");e.status=404;throw e;} return envio; }

async function crear(data){
 if(!data.clienteId||!data.pedidoId||!Array.isArray(data.items)||data.items.length===0){const e=new Error("clienteId, pedidoId e items son obligatorios");e.status=400;throw e;}

 const direcciones=await clientesClient.obtenerDirecciones(data.clienteId);
 if(!Array.isArray(direcciones)||direcciones.length===0){const e=new Error("El cliente no tiene una dirección registrada");e.status=404;throw e;}
 const principal=direcciones.find(d=>d.es_principal===true)||direcciones[0];

 // Asignación automática: entre vehículos DISPONIBLE con conductor activo,
 // el par con menos envíos abiertos que aún no llegó al tope del día
 // (contado con fechaCreacion; el documento de envío no cambia).
 const asignacion=await asignarParDisponible();

 const ahora=new Date();
 const envio=await Envio.create({
   codigoSeguimiento:generarCodigoSeguimiento(),
   clienteId:data.clienteId,
   pedidoId:data.pedidoId,
   estado:"CREADO",
   direccionEntrega:{calle:principal.calle,distrito:principal.distrito,ciudad:principal.ciudad,codigoPostal:principal.codigo_postal,referencia:principal.referencia},
   items:data.items,
   fechaCreacion:ahora,
   fechaActualizacion:ahora,
   vehiculoAsignado:asignacion.vehiculoAsignado,
   conductorAsignado:asignacion.conductorAsignado
 });
 return envio.toObject();
}

async function actualizarEstado(id,nuevoEstado){ if(!nuevoEstado){const e=new Error("El estado es obligatorio");e.status=400;throw e;} const envio=await Envio.findByIdAndUpdate(id,{estado:String(nuevoEstado).toUpperCase(),fechaActualizacion:new Date()},{new:true,runValidators:true}).lean(); if(!envio){const e=new Error("Envío no encontrado");e.status=404;throw e;} return envio; }

async function eliminar(id){ const envio=await Envio.findByIdAndDelete(id); if(!envio){const e=new Error("Envío no encontrado");e.status=404;throw e;} }

module.exports={listar,obtenerPorId,obtenerPorTracking,crear,actualizarEstado,eliminar};
