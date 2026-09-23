const express = require("express");
const router = express.Router();

/**
 * @swagger
 * /health:
 *   get:
 *     summary: Health check para load balancer
 *     tags: [Health]
 *     responses:
 *       200:
 *         description: Servicio disponible
 */
router.get("/", (req, res) => {
  res.status(200).json({ status: "ok", service: "ms-envios" });
});

module.exports = router;
