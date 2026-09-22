const mongoose=require("mongoose");
async function connectMongo(){
 const uri=process.env.MONGODB_URI||"mongodb://root:root123@localhost:27017/shipments_db?authSource=admin";
 try { await mongoose.connect(uri); console.log("Conectado correctamente a MongoDB"); }
 catch(error){ console.error("Error conectando a MongoDB:",error.message); process.exit(1); }
}
module.exports={connectMongo};
