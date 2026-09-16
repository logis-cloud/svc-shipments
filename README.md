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
2. **Vehículos** — se asigna automáticamente el **primer vehículo en estado `DISPONIBLE` que tenga al menos un conductor activo**:
   - `GET /vehiculos?estado=DISPONIBLE` (paginado, recorre páginas si hace falta).
   - Para cada vehículo candidato, `GET /vehiculos/{id}/conductores`, filtrando `activo: true` **del lado de `ms-envios`** — no en `ms-vehiculos`, porque su filtro de listado (`ConductorServiceImpl.listar`) solo aplica un criterio a la vez (`turno` **o** `idVehiculo` **o** `activo`, nunca combinados), así que no se puede pedir "los conductores activos de este vehículo" en una sola llamada filtrada por ambos.
   - El primer par (vehículo, conductor activo) encontrado se asigna y queda congelado en `vehiculoAsignado` / `conductorAsignado`.
   - Si no hay ningún vehículo disponible con conductor activo, el POST responde **409**.

No hay lógica adicional de selección (ni por capacidad de carga, ni por turno específico): se mantiene simple a propósito, ya que la asignación por disponibilidad es suficiente para demostrar la integración entre los tres microservicios.

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

## Ejecutar localmente
Primero deben estar corriendo MS Clientes (puerto 8001) y MS Vehículos (puerto 8002). Luego:
```bash
docker compose up --build
```
API: `http://localhost:8003`

Variables de entorno relevantes (ver `.env.example`): `CLIENTES_SERVICE_URL` y `VEHICULOS_SERVICE_URL`, ambas apuntando a `http://host.docker.internal:PUERTO` en local o a la IP privada / balanceador correspondiente en producción.

## Carga masiva
El enunciado pide mínimo 20,000 registros/documentos. Este proyecto genera **25,000 envíos**:
```bash
docker compose run --rm ms-envios npm run seed
```
El seed genera `vehiculoAsignado`/`conductorAsignado` con valores plausibles pero aleatorios (no llama a ms-vehiculos): es solo para cumplir el volumen de datos, no para validar la integración real — eso ya lo cubre el flujo normal de `POST /envios`.

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
- ms-envios se despliega con Docker Compose en las 2 MV de producción.
- MongoDB debe estar en la tercera MV privada.
- La API queda detrás del balanceador privado y se publica por AWS API Gateway HTTPS.
- MongoDB no debe exponerse a Internet.
