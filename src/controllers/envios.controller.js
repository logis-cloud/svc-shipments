const service=require("../services/envios.service");
async function listar(req,res,next){try{res.json(await service.listar({page:req.query.page,size:req.query.size,estado:req.query.estado,clienteId:req.query.clienteId}));}catch(e){next(e)}}
async function obtener(req,res,next){try{res.json(await service.obtenerPorId(req.params.id));}catch(e){next(e)}}
async function obtenerPorTracking(req,res,next){try{res.json(await service.obtenerPorTracking(req.params.codigo));}catch(e){next(e)}}
async function crear(req,res,next){try{res.status(201).json(await service.crear(req.body));}catch(e){next(e)}}
async function actualizarEstado(req,res,next){try{res.json(await service.actualizarEstado(req.params.id,req.body.estado));}catch(e){next(e)}}
async function eliminar(req,res,next){try{await service.eliminar(req.params.id);res.json({detail:"Envío eliminado correctamente"});}catch(e){next(e)}}
module.exports={listar,obtener,obtenerPorTracking,crear,actualizarEstado,eliminar};
