# Microservicio de Envíos — Sistema de Logística y Entregas

## Descripción del microservicio

El **Microservicio de Envíos** es una API REST responsable de gestionar el ciclo operativo de los envíos dentro del sistema de logística y entregas.

Está desarrollado con **Node.js + Express** y utiliza **MongoDB** como base de datos NoSQL mediante **Mongoose**. A diferencia de los microservicios de Clientes y Vehículos, que utilizan bases de datos relacionales, Envíos almacena cada envío como un documento que contiene información propia y snapshots de los datos necesarios para conservar el contexto histórico de la operación.

Durante la creación de un envío, el microservicio consume las APIs REST de otros servicios del sistema:

- **Clientes:** consulta las direcciones registradas del cliente y utiliza la dirección principal o, en su defecto, la primera disponible.
- **Vehículos:** consulta los vehículos disponibles y sus conductores para realizar una asignación automática.

La comunicación se realiza exclusivamente mediante los endpoints expuestos por cada API REST, sin acceder directamente a las bases de datos de otros microservicios.

La asignación de vehículo y conductor considera únicamente pares con vehículo disponible y conductor activo. Entre los candidatos se selecciona el par con menor carga de envíos abiertos, respetando además un límite diario configurable. Una vez creado el envío, la dirección, el vehículo y el conductor quedan almacenados como **snapshots**, preservando la información histórica aunque posteriormente cambien los datos originales.

---

## Modelo documental (MongoDB)

La información se almacena en la colección:

```text
envios
```

Cada documento representa un envío completo y contiene estructuras embebidas para la dirección de entrega, los productos, el vehículo asignado y el conductor asignado.

```mermaid
flowchart TB
    ENVIO["envios<br/><br/>_id<br/>codigoSeguimiento<br/>clienteId<br/>pedidoId<br/>estado<br/>fechaCreacion<br/>fechaActualizacion"]

    DIRECCION["direccionEntrega<br/><br/>calle<br/>distrito<br/>ciudad<br/>codigoPostal<br/>referencia"]

    ITEMS["items [ ]<br/><br/>sku<br/>descripcion<br/>cantidad<br/>pesoKg"]

    VEHICULO["vehiculoAsignado<br/><br/>idVehiculo<br/>placa<br/>tipo<br/>marca<br/>modelo"]

    CONDUCTOR["conductorAsignado<br/><br/>idConductor<br/>nombre<br/>apellido<br/>dni<br/>turno"]

    ENVIO --> DIRECCION
    ENVIO --> ITEMS
    ENVIO --> VEHICULO
    ENVIO --> CONDUCTOR
```

### Estructura general del documento

```json
{
  "_id": "ObjectId",
  "codigoSeguimiento": "LOG-A12BC34D",
  "clienteId": 15,
  "pedidoId": "PED-1001",
  "estado": "CREADO",
  "direccionEntrega": {
    "calle": "Av. Javier Prado 1234",
    "distrito": "San Isidro",
    "ciudad": "Lima",
    "codigoPostal": "15036",
    "referencia": "Frente al parque"
  },
  "items": [
    {
      "sku": "SKU-001",
      "descripcion": "Monitor 27 pulgadas",
      "cantidad": 1,
      "pesoKg": 5.5
    }
  ],
  "vehiculoAsignado": {
    "idVehiculo": 101,
    "placa": "ABC-123",
    "tipo": "FURGONETA",
    "marca": "Toyota",
    "modelo": "Hiace"
  },
  "conductorAsignado": {
    "idConductor": 55,
    "nombre": "Carlos",
    "apellido": "Pérez",
    "dni": "45678912",
    "turno": "TARDE"
  },
  "fechaCreacion": "2026-09-19T17:35:36.000Z",
  "fechaActualizacion": "2026-09-19T20:20:19.000Z"
}
```

`codigoSeguimiento` es único e indexado. También se indexan `clienteId` y `estado` para facilitar las consultas operativas.

La dirección de entrega, el vehículo y el conductor se almacenan como **copias históricas embebidas**, no como referencias vivas a otros microservicios.

---

## Principales endpoints

### Envíos

| Método | Endpoint | Descripción |
|---|---|---|
| `GET` | `/envios` | Lista los envíos de forma paginada. Permite filtrar por estado y cliente. |
| `GET` | `/envios/{id}` | Obtiene el detalle de un envío por su identificador interno. |
| `GET` | `/envios/tracking/{codigo}` | Obtiene un envío mediante su código de seguimiento. |
| `POST` | `/envios` | Registra un nuevo envío y realiza automáticamente la asignación de dirección, vehículo y conductor. |
| `PUT` | `/envios/{id}/estado` | Actualiza el estado de un envío. |
| `DELETE` | `/envios/{id}` | Elimina un envío. |

### Estado del servicio

| Método | Endpoint | Descripción |
|---|---|---|
| `GET` | `/` | Verifica que el microservicio se encuentre operativo. |
| `GET` | `/health` | Health check utilizado para verificar la disponibilidad del servicio. |

### Documentación de la API

La documentación interactiva se encuentra disponible en:

```text
/swagger-ui
```

y también en:

```text
/docs
```

### Integración utilizada al crear un envío

El `POST /envios` utiliza las APIs REST de Clientes y Vehículos:

```text
GET /clientes/{clienteId}/direcciones
GET /vehiculos?estado=DISPONIBLE
GET /vehiculos/{id}/conductores
```

El microservicio no consulta directamente MySQL ni PostgreSQL. La información externa se obtiene a través de los endpoints publicados por los microservicios propietarios de esos datos.

---

## Tecnologías

| Tecnología | Uso |
|---|---|
| **Node.js** | Entorno de ejecución del microservicio. |
| **Express** | Implementación de la API REST y definición de rutas. |
| **MongoDB** | Base de datos NoSQL utilizada para persistir los envíos. |
| **Mongoose** | Modelado, validación y acceso a los documentos almacenados en MongoDB. |
| **Axios** | Consumo HTTP de los microservicios de Clientes y Vehículos. |
| **Swagger / OpenAPI** | Documentación interactiva de la API. |
| **CORS** | Control de los orígenes autorizados para consumir la API. |
| **Docker** | Empaquetado y ejecución del microservicio en contenedores. |

---

## Documentación Docker

El microservicio se encuentra preparado para ejecutarse dentro de un contenedor Docker utilizando una imagen basada en **Node.js Alpine**.

### 1. Variables de entorno

Crear un archivo `.env` a partir de `.env.example` y configurar los valores de acuerdo con el entorno de ejecución:

```env
PORT=8080

MONGODB_URI=mongodb://usuario:password@HOST_MONGODB:27017/shipments_db?authSource=admin

CLIENTES_SERVICE_URL=http://HOST_CLIENTES:8001
VEHICULOS_SERVICE_URL=http://HOST_VEHICULOS:8002

TOPE_ENVIOS_POR_PAR_POR_DIA=15
ASSIGNMENT_TZ_OFFSET_HOURS=-5

CORS_ALLOWED_ORIGINS=*
```

### Variables principales

| Variable | Descripción |
|---|---|
| `PORT` | Puerto interno en el que escucha la API. |
| `MONGODB_URI` | Cadena de conexión a MongoDB. |
| `CLIENTES_SERVICE_URL` | URL base del microservicio de Clientes. |
| `VEHICULOS_SERVICE_URL` | URL base del microservicio de Vehículos. |
| `TOPE_ENVIOS_POR_PAR_POR_DIA` | Límite diario de envíos asignables a cada par vehículo-conductor. |
| `ASSIGNMENT_TZ_OFFSET_HOURS` | Desfase horario utilizado para calcular el día operativo de la asignación. |
| `CORS_ALLOWED_ORIGINS` | Orígenes autorizados para consumir la API. |

> Las URLs de los microservicios y de MongoDB deben configurarse de acuerdo con la red del entorno. En producción deben utilizarse las direcciones internas correspondientes y no conexiones directas desde Internet hacia las bases de datos.

### 2. Construir la imagen

Desde la raíz del repositorio:

```bash
docker build -t svc-shipments .
```

### 3. Ejecutar el contenedor

Con la configuración de ejemplo donde la API escucha en el puerto interno `8080`:

```bash
docker run -d \
  --name ms-envios \
  --env-file .env \
  -p 8003:8080 \
  svc-shipments
```

El puerto `8003` corresponde al acceso desde el host y `8080` al puerto configurado para la aplicación dentro del contenedor.

### 4. Verificar el servicio

API:

```text
http://localhost:8003/
```

Health check:

```text
http://localhost:8003/health
```

Swagger UI:

```text
http://localhost:8003/swagger-ui
```

Documentación alternativa:

```text
http://localhost:8003/docs
```

### 5. Comandos útiles

Verificar el contenedor:

```bash
docker ps
```

Revisar logs:

```bash
docker logs ms-envios
```

Detener el contenedor:

```bash
docker stop ms-envios
```

Eliminar el contenedor:

```bash
docker rm ms-envios
```
