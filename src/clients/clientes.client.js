const axios=require("axios");
const CLIENTES_SERVICE_URL=process.env.CLIENTES_SERVICE_URL||"http://localhost:8001";

async function obtenerDirecciones(clienteId){
 try {
   const r=await axios.get(`${CLIENTES_SERVICE_URL}/clientes/${clienteId}/direcciones`,{timeout:5000});
   return r.data;
 } catch(error){
   if(error.response){
     // ms-clientes respondió (ej. 404 si el cliente no existe): se
     // propaga el status real en vez de aplanar todo a 502.
     const err=new Error(error.response.data?.detail||"Error consultando el microservicio de Clientes");
     err.status=error.response.status;
     throw err;
   }
   const err=new Error("No se pudo consultar el microservicio de Clientes");
   err.status=502;
   throw err;
 }
}
module.exports={obtenerDirecciones};
