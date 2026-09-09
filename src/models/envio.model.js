const mongoose=require("mongoose");
const direccionEntregaSchema=new mongoose.Schema({calle:{type:String,required:true},distrito:{type:String,required:true},ciudad:{type:String,required:true},codigoPostal:String,referencia:String},{_id:false});
const paqueteItemSchema=new mongoose.Schema({sku:{type:String,required:true},descripcion:{type:String,required:true},cantidad:{type:Number,required:true,min:1},pesoKg:{type:Number,required:true,min:0}},{_id:false});
const envioSchema=new mongoose.Schema({
 codigoSeguimiento:{type:String,required:true,unique:true,index:true},
 clienteId:{type:Number,required:true,index:true},
 pedidoId:{type:String,required:true},
 estado:{type:String,required:true,default:"CREADO",index:true},
 direccionEntrega:{type:direccionEntregaSchema,required:true},
 items:{type:[paqueteItemSchema],required:true},
 fechaCreacion:{type:Date,default:Date.now},
 fechaActualizacion:{type:Date,default:Date.now},
 transportista:String,
 placaVehiculo:String
},{collection:"envios",versionKey:false});
module.exports=mongoose.model("Envio",envioSchema);
