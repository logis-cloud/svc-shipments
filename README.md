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
  "_id": "ObjectId(...)" ,
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
  "fechaCreacion": "2026-09-09T10:00:00Z",
  "fechaActualizacion": "2026-09-09T10:00:00Z",
  "transportista": "Logística Express",
  "placaVehiculo": "ABC-123"
}
```

**Estructura:** 1 envío contiene 1 dirección de entrega embebida y una lista de N ítems.

## Consumo del microservicio de Clientes

Al crear un envío se consulta `GET /clientes/{clienteId}/direcciones` para obtener la dirección principal. Así se cumple el requisito de que al menos un microservicio consuma otro microservicio.

## Endpoints

| Método | Ruta | Descripción |
|---|---|---|
| GET | `/` | Health check |
| GET | `/envios` | Lista paginada de envíos |
| GET | `/envios/{id}` | Obtiene un envío por ID |
| GET | `/envios/tracking/{codigo}` | Consulta por tracking |
| POST | `/envios` | Crea un envío consultando MS Clientes |
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
  }],
  "transportista": "Logística Express",
  "placaVehiculo": "ABC-123"
}
```

## Ejecutar localmente
Primero debe funcionar MS Clientes en puerto 8001. Luego:
```bash
docker compose up --build
```
API: `http://localhost:8003`

## Carga masiva
El enunciado pide mínimo 20,000 registros/documentos. Este proyecto genera **25,000 envíos**:
```bash
docker compose run --rm ms-envios npm run seed
```

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
   /    \
  v      v
MongoDB  MS Clientes
  ^
  |
model
```

## Producción
- ms-envios se despliega con Docker Compose en las 2 MV de producción.
- MongoDB debe estar en la tercera MV privada.
- La API queda detrás del balanceador privado y se publica por AWS API Gateway HTTPS.
- MongoDB no debe exponerse a Internet.
