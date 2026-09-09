const express=require("express");
const controller=require("../controllers/envios.controller");
const router=express.Router();
/**
 * @swagger
 * components:
 *   schemas:
 *     PaqueteItem:
 *       type: object
 *       required: [sku, descripcion, cantidad, pesoKg]
 *       properties:
 *         sku: { type: string, example: SKU-001 }
 *         descripcion: { type: string, example: Monitor 27 pulgadas }
 *         cantidad: { type: integer, example: 1 }
 *         pesoKg: { type: number, example: 5.5 }
 *     EnvioCreate:
 *       type: object
 *       required: [clienteId, pedidoId, items]
 *       properties:
 *         clienteId: { type: integer, example: 1 }
 *         pedidoId: { type: string, example: PED-1001 }
 *         items:
 *           type: array
 *           items: { $ref: '#/components/schemas/PaqueteItem' }
 *         transportista: { type: string, example: Logística Express }
 *         placaVehiculo: { type: string, example: ABC-123 }
 */
/**
 * @swagger
 * /envios:
 *   get:
 *     summary: Lista envíos de forma paginada
 *     tags: [Envios]
 *     responses: { 200: { description: Lista paginada de envíos } }
 *   post:
 *     summary: Crea un envío consultando la dirección del microservicio de Clientes
 *     tags: [Envios]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema: { $ref: '#/components/schemas/EnvioCreate' }
 *     responses: { 201: { description: Envío creado } }
 */
router.get("/",controller.listar); router.post("/",controller.crear);
/**
 * @swagger
 * /envios/tracking/{codigo}:
 *   get:
 *     summary: Obtiene un envío por código de seguimiento
 *     tags: [Envios]
 *     parameters:
 *       - in: path
 *         name: codigo
 *         required: true
 *         schema: { type: string }
 *     responses: { 200: { description: Envío encontrado }, 404: { description: Envío no encontrado } }
 */
router.get("/tracking/:codigo",controller.obtenerPorTracking);
/**
 * @swagger
 * /envios/{id}:
 *   get:
 *     summary: Obtiene un envío por id
 *     tags: [Envios]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses: { 200: { description: Envío encontrado }, 404: { description: Envío no encontrado } }
 *   delete:
 *     summary: Elimina un envío
 *     tags: [Envios]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses: { 200: { description: Envío eliminado } }
 */
router.get("/:id",controller.obtener); router.delete("/:id",controller.eliminar);
/**
 * @swagger
 * /envios/{id}/estado:
 *   put:
 *     summary: Actualiza el estado de un envío
 *     tags: [Envios]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [estado]
 *             properties:
 *               estado: { type: string, example: EN_TRANSITO }
 *     responses: { 200: { description: Estado actualizado } }
 */
router.put("/:id/estado",controller.actualizarEstado);
module.exports=router;
