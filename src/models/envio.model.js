const mongoose=require("mongoose");

const direccionEntregaSchema=new mongoose.Schema({calle:{type:String,required:true},distrito:{type:String,required:true},ciudad:{type:String,required:true},codigoPostal:String,referencia:String},{_id:false});

const paqueteItemSchema=new mongoose.Schema({sku:{type:String,required:true},descripcion:{type:String,required:true},cantidad:{type:Number,required:true,min:1},pesoKg:{type:Number,required:true,min:0}},{_id:false});

// Snapshot del vehículo asignado por ms-vehiculos al momento de crear el
// envío. Igual que direccionEntrega: es una copia congelada, no una
// referencia viva — si el vehículo cambia de estado después, el envío ya
// creado conserva el dato histórico de con qué se despachó.
const vehiculoAsignadoSchema=new mongoose.Schema({
  idVehiculo:{type:Number,required:true},
  placa:{type:String,required:true},
  tipo:String,
  marca:String,
  modelo:String
},{_id:false});

// Snapshot del conductor asignado, misma lógica que vehiculoAsignadoSchema.
const conductorAsignadoSchema=new mongoose.Schema({
  idConductor:{type:Number,required:true},
  nombre:{type:String,required:true},
  apellido:{type:String,required:true},
  dni:String,
  turno:String
},{_id:false});

const envioSchema=new mongoose.Schema({
 codigoSeguimiento:{type:String,required:true,unique:true,index:true},
 clienteId:{type:Number,required:true,index:true},
 pedidoId:{type:String,required:true},
 estado:{type:String,required:true,default:"CREADO",index:true},
 direccionEntrega:{type:direccionEntregaSchema,required:true},
 items:{type:[paqueteItemSchema],required:true},
 fechaCreacion:{type:Date,default:Date.now},
 fechaActualizacion:{type:Date,default:Date.now},
 vehiculoAsignado:{type:vehiculoAsignadoSchema,required:true},
 conductorAsignado:{type:conductorAsignadoSchema,required:true}
},{collection:"envios",versionKey:false});

module.exports=mongoose.model("Envio",envioSchema);
