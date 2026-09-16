const express = require("express");
const cors = require("cors");
const { connectMongo } = require("./config/database");
const swaggerUi = require("swagger-ui-express");
const swaggerSpec = require("./config/swagger");
const enviosRoutes = require("./routes/envios.routes");

const app = express();
const PORT = process.env.PORT || 3000;
app.use(cors());
app.use(express.json());

app.get("/", (req,res)=>res.json({status:"ok",service:"ms-envios",database:"mongodb"}));
app.use("/envios", enviosRoutes);
app.use("/swagger-ui", swaggerUi.serve, swaggerUi.setup(swaggerSpec));
app.use("/docs", swaggerUi.serve, swaggerUi.setup(swaggerSpec));
app.use((err,req,res,next)=>{ console.error(err); res.status(err.status||500).json({detail:err.message||"Error interno del servidor"}); });

async function start(){ await connectMongo(); app.listen(PORT,()=>{ console.log(`ms-envios escuchando en puerto ${PORT}`); console.log(`Swagger: http://localhost:${PORT}/swagger-ui`); }); }
start();
module.exports=app;
