# Microservicio de Envíos — Sistema de Logística y Entregas

API REST desarrollada con **Node.js + Express + MongoDB** para gestionar los envíos de un centro logístico.

Microservicios con base de datos propia:
- Clientes → Python + MySQL
- Vehículos → Java + PostgreSQL
- **Envíos → Node.js + MongoDB**

## Estructura JSON de MongoDB

Colección: `envios`

```json
{
  "_id": "ObjectId(...)",
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
  "items": [{
    "sku": "SKU-001",
    "descripcion": "Laptop Lenovo",
    "cantidad": 2,
    "pesoKg": 3.5
  }],
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
    "turno": "MANANA"
  },
  "fechaCreacion": "2026-09-09T10:00:00Z",
  "fechaActualizacion": "2026-09-09T10:00:00Z"
}
```

**Estructura:** 1 envío contiene 1 dirección de entrega embebida, una lista de N ítems, y el vehículo + conductor que lo transportan — los tres son *snapshots* (copias congeladas al momento de crear el envío), no referencias vivas: si el cliente cambia de dirección o el conductor deja de estar activo después, el envío ya creado conserva el dato histórico.

## Consumo de otros microservicios

Al crear un envío, `ms-envios` consulta a **dos** microservicios (así se cumple el requisito de integración entre servicios):

1. **Clientes** — `GET /clientes/{clienteId}/direcciones`, para tomar la dirección principal (o la primera, si no hay ninguna marcada como principal) y copiarla en `direccionEntrega`.
2. **Vehículos** — se asigna automáticamente un par **vehículo `DISPONIBLE` + conductor activo**, sin cambiar el JSON del envío:
   - `GET /vehiculos?estado=DISPONIBLE` (paginado, recorre páginas si hace falta).
   - Para cada vehículo candidato, `GET /vehiculos/{id}/conductores`, filtrando `activo: true` **del lado de `ms-envios`** — no en `ms-vehiculos`, porque su filtro de listado (`ConductorServiceImpl.listar`) solo aplica un criterio a la vez (`turno` **o** `idVehiculo` **o** `activo`, nunca combinados), así que no se puede pedir "los conductores activos de este vehículo" en una sola llamada filtrada por ambos.
   - Entre esos pares se elige el de **menos envíos abiertos** (estado distinto de `ENTREGADO` / `CANCELADO`). Además hay un **tope diario por par** (por defecto 15, `TOPE_ENVIOS_POR_PAR_POR_DIA`), contado con `fechaCreacion` del día local (`ASSIGNMENT_TZ_OFFSET_HOURS`, por defecto Lima UTC−5). Si un par ya llegó al tope, no recibe más envíos ese día.
   - El par elegido queda congelado en `vehiculoAsignado` / `conductorAsignado`.
   - El POST responde **409** si no hay ningún vehículo disponible con conductor activo, o si todos los pares ya alcanzaron el tope del día.

> El microservicio de **Tracking** (4to MS) no repite esta lógica: consulta a Envíos para el snapshot histórico y a Clientes/Vehículos para el estado *actual*, cruzando ambos — nunca crea ni asigna nada.

## Endpoints

| Método | Ruta | Descripción |
|---|---|---|
| GET | `/` | Health check |
| GET | `/envios` | Lista paginada de envíos |
| GET | `/envios/{id}` | Obtiene un envío por ID |
| GET | `/envios/tracking/{codigo}` | Consulta por tracking |
| POST | `/envios` | Crea un envío: toma dirección de MS Clientes y asigna vehículo/conductor de MS Vehículos automáticamente |
| PUT | `/envios/{id}/estado` | Actualiza el estado |
| DELETE | `/envios/{id}` | Elimina un envío |

Swagger: `http://localhost:8003/swagger-ui`

## Ejemplo POST

```json
{
  "clienteId": 1,
  "pedidoId": "PED-1001",
  "items": [{
    "sku": "SKU-001",
    "descripcion": "Monitor 27 pulgadas",
    "cantidad": 1,
    "pesoKg": 5.5
  }]
}
```

No se envía `vehiculoAsignado`/`conductorAsignado` ni nada relacionado: se asignan solos.

Respuestas de error relevantes:

| Código | Cuándo ocurre |
|---|---|
| 400 | Faltan `clienteId`, `pedidoId` o `items` |
| 404 | El cliente no existe, o no tiene ninguna dirección registrada en ms-clientes |
| 409 | No hay ningún vehículo `DISPONIBLE` con conductor activo en ms-vehiculos |
| 502 | ms-clientes o ms-vehiculos no respondieron (caído o inalcanzable) |

## Cómo correrlo en local

Este `docker-compose.yml` **solo levanta el microservicio**, no la base de datos —
mismo criterio que `svc-clientes` y `svc-vehiculos`: MongoDB vive en la VM de
bases de datos (VM3), no en el docker-compose de la API.

1. Copia `.env.example` a `.env` y ajusta `MONGODB_URI` para que apunte a un
   Mongo accesible (local, o la IP privada de la VM3 si ya está levantada).
2. Asegúrate de que `ms-clientes` (puerto 8001) y `ms-vehiculos` (puerto 8002)
   estén corriendo y accesibles en las URLs de tu `.env`.
3. Levanta el microservicio:
   ```bash
   docker compose up --build
   ```

API: `http://localhost:8003`

## Carga masiva (≥20,000 registros)

**No se hace desde este microservicio.** Igual que en Clientes y Vehículos,
la carga masiva de documentos de prueba corre desde la herramienta externa
`seed-tool/`, que se conecta directamente a MongoDB por su IP privada (VM de
bases de datos), sin pasar por la API de `ms-envios`.

Este microservicio se mantiene como una API estándar (rutas → controller →
service → modelo), sin scripts ni endpoints de generación de datos falsos
en su código fuente ni en su imagen Docker.

## Arquitectura interna
```text
Petición HTTP
     |
     v
routes
     |
     v
controller
     |
     v
service
   /   |   \
  v    v    v
MongoDB MS-Clientes MS-Vehiculos
  ^
  |
model
```

## Producción
- `ms-envios` se despliega junto a `ms-clientes` y `ms-vehiculos` en las
  2 VMs de producción, detrás del balanceador privado.
- MongoDB corre en la tercera VM (privada, no pública), junto con MySQL
  (Clientes) y PostgreSQL (Vehículos). MongoDB no debe exponerse a Internet.
- La API se publica solo a través de AWS API Gateway (HTTPS).
