const swaggerJsdoc=require("swagger-jsdoc");
module.exports=swaggerJsdoc({definition:{openapi:"3.0.0",info:{title:"Microservicio de Envíos - Centro Logístico",version:"1.0.0",description:"API REST NoSQL (Node.js + Express + MongoDB) para gestionar envíos."},servers:[{url:"http://localhost:8003",description:"Servidor local"}]},apis:["./src/routes/*.js"]});
