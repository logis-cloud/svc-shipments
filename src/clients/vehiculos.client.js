const axios=require("axios");
const VEHICULOS_SERVICE_URL=process.env.VEHICULOS_SERVICE_URL||"http://localhost:8003";

// Tamaño de página al pedir vehículos DISPONIBLES y tope de páginas a
// recorrer como salvaguarda (evita loops largos si la flota es enorme y
// no hay ningún conductor activo disponible).
const TAMANO_PAGINA=100;
const MAX_PAGINAS=20;

function errorDesdeRespuesta(error, mensajePorDefecto){
  if(error.response){
    // ms-vehiculos respondió pero con error (404, 409, etc). Clientes y
    // Vehículos devuelven el mensaje en una clave distinta
    // (Clientes: {detail}, Vehículos: {message}) — se soportan ambas acá.
    const data=error.response.data||{};
    const err=new Error(data.detail||data.message||mensajePorDefecto);
    err.status=error.response.status;
    return err;
  }
  const err=new Error(mensajePorDefecto);
  err.status=502;
  return err;
}

async function obtenerVehiculosDisponibles(page){
  try {
    const r=await axios.get(`${VEHICULOS_SERVICE_URL}/vehiculos`,{
      params:{estado:"DISPONIBLE",page,size:TAMANO_PAGINA},
      timeout:5000
    });
    return r.data; // PageResponseDTO: {content, page, size, totalElements, totalPages}
  } catch(error){
    throw errorDesdeRespuesta(error,"No se pudo consultar el microservicio de Vehículos");
  }
}

async function obtenerConductoresDeVehiculo(idVehiculo){
  try {
    const r=await axios.get(`${VEHICULOS_SERVICE_URL}/vehiculos/${idVehiculo}/conductores`,{timeout:5000});
    return r.data; // List<ConductorResponseDTO>
  } catch(error){
    throw errorDesdeRespuesta(error,"No se pudo consultar el microservicio de Vehículos");
  }
}

/**
 * Recorre los vehículos en estado DISPONIBLE (paginados, ordenados por id)
 * y para cada uno pide sus conductores asignados, devolviendo el primer par
 * (vehículo, conductor activo) que encuentra.
 *
 * El filtro por "activo" se hace acá, del lado de Node, a propósito:
 * ConductorServiceImpl.listar() en ms-vehiculos resuelve sus filtros
 * (turno / idVehiculo / activo) en una cadena if/else if, así que solo
 * aplica UNO a la vez — GET /conductores?idVehiculo=X&activo=true no
 * filtraría por ambos a la vez. Por eso se usa GET /vehiculos/{id}/conductores
 * (sin filtro, trae todos los conductores de ese vehículo) y se filtra
 * "activo" acá mismo.
 *
 * Devuelve null si no hay ningún vehículo disponible con conductor activo.
 */
async function asignarVehiculoDisponible(){
  let page=0;
  let totalPages=1;

  while(page<totalPages && page<MAX_PAGINAS){
    const resultado=await obtenerVehiculosDisponibles(page);
    const vehiculos=resultado.content||[];
    totalPages=resultado.totalPages||1;

    for(const vehiculo of vehiculos){
      const conductores=await obtenerConductoresDeVehiculo(vehiculo.id);
      const conductorActivo=(conductores||[]).find(c=>c.activo===true);
      if(conductorActivo){
        return {
          vehiculoAsignado:{
            idVehiculo:vehiculo.id,
            placa:vehiculo.placa,
            tipo:vehiculo.tipo,
            marca:vehiculo.marca,
            modelo:vehiculo.modelo
          },
          conductorAsignado:{
            idConductor:conductorActivo.id,
            nombre:conductorActivo.nombre,
            apellido:conductorActivo.apellido,
            dni:conductorActivo.dni,
            turno:conductorActivo.turno
          }
        };
      }
    }
    page++;
  }
  return null;
}

module.exports={asignarVehiculoDisponible};
