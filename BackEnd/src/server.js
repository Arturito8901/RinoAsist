import dotenv from "dotenv";
import app from "./app.js";
import { getPool } from "./config/db.js";

dotenv.config();

const PORT = process.env.PORT || 4000;

const start = async () => {
  try {
    await getPool();
    app.listen(PORT, () => {
      console.log(`API escuchando en http://localhost:${PORT}`);
    });
  } catch (error) {
    console.error("No se pudo iniciar el servidor:", error);
    process.exit(1);
  }
};

start();
