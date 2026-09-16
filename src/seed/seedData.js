require("dotenv").config();
const mongoose=require("mongoose"); const Envio=require("../models/envio.model");
const TOTAL=Number(process.env.SEED_TOTAL||25000), BATCH_SIZE=1000;
const randomFrom=a=>a[Math.floor(Math.random()*a.length)];

// El seed genera volumen de prueba sin llamar a ms-vehiculos (igual que ya
// hacía con clienteId: usa un id "plausible" dentro del rango que carga
// fake_postgres.py, sin garantizar que ese id exista realmente). Sirve para
// cumplir el mínimo de documentos de la rúbrica, no para probar la
// integración real — eso ya lo cubre el flujo normal de POST /envios.
function crearEnvioFalso(n){
  return {
    codigoSeguimiento:`SEED-${String(n).padStart(8,"0")}`,
    clienteId:1+Math.floor(Math.random()*25000),
    pedidoId:`PED-${100000+n}`,
    estado:randomFrom(["CREADO","EN_TRANSITO","ENTREGADO","INCIDENCIA"]),
    direccionEntrega:{calle:`Av. Logística ${n}`,distrito:randomFrom(["Ate","Callao","San Miguel","Surco"]),ciudad:"Lima",codigoPostal:"15000",referencia:`Referencia ficticia ${n}`},
    items:[{sku:`SKU-${1000+Math.floor(Math.random()*9000)}`,descripcion:"Producto de prueba",cantidad:1+Math.floor(Math.random()*5),pesoKg:Number((0.5+Math.random()*20).toFixed(2))}],
    fechaCreacion:new Date(),
    fechaActualizacion:new Date(),
    vehiculoAsignado:{
      idVehiculo:1+Math.floor(Math.random()*20000),
      placa:`ABC-${100+Math.floor(Math.random()*900)}`,
      tipo:randomFrom(["MOTO","FURGONETA","CAMION"]),
      marca:randomFrom(["Toyota","Hyundai","Volvo","Scania","Mercedes-Benz","Isuzu","Nissan"]),
      modelo:"Modelo"
    },
    conductorAsignado:{
      idConductor:1+Math.floor(Math.random()*20000),
      nombre:randomFrom(["Carlos","Luis","María","Ana","Jorge","Rosa"]),
      apellido:randomFrom(["Pérez","García","Rodríguez","López","Flores"]),
      dni:String(10000000+n),
      turno:randomFrom(["MANANA","TARDE","NOCHE"])
    }
  };
}

async function main(){const uri=process.env.MONGODB_URI||"mongodb://root:root123@localhost:27017/envios_db?authSource=admin"; await mongoose.connect(uri); const existentes=await Envio.countDocuments(); if(existentes>=TOTAL){console.log(`Seed omitido: ya existen ${existentes} documentos.`);await mongoose.disconnect();return;} let insertados=0; while(insertados<TOTAL){const cantidad=Math.min(BATCH_SIZE,TOTAL-insertados),lote=[];for(let i=0;i<cantidad;i++)lote.push(crearEnvioFalso(insertados+i+1));await Envio.insertMany(lote,{ordered:false});insertados+=cantidad;console.log(`Envíos insertados: ${insertados}/${TOTAL}`);} console.log("Carga masiva finalizada correctamente.");await mongoose.disconnect();}
main().catch(async e=>{console.error(e);await mongoose.disconnect();process.exit(1);});
