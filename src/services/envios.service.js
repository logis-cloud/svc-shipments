const crypto=require("crypto");
const Envio=require("../models/envio.model");
const clientesClient=require("../clients/clientes.client");
const vehiculosClient=require("../clients/vehiculos.client");

function generarCodigoSeguimiento(){ return `LOG-${crypto.randomBytes(4).toString("hex").toUpperCase()}`; }

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

 // Asignación automática: primer vehículo DISPONIBLE con conductor activo.
 // No se recibe idVehiculo/idConductor en el body — lo decide ms-envios
 // consultando a ms-vehiculos en el momento de la creación.
 const asignacion=await vehiculosClient.asignarVehiculoDisponible();
 if(!asignacion){const e=new Error("No hay vehículos disponibles con conductor activo en este momento");e.status=409;throw e;}

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
