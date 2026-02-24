const express = require("express");
const cors = require("cors"); // 1. N'oubliez pas d'importer cors
const swaggerUi = require("swagger-ui-express");

const apiRouter = require("./routes");
const swaggerSpec = require("./swagger");
const notFound = require("./middlewares/notFound");
const errorHandler = require("./middlewares/errorHandler");

// 2. Initialisation de 'app' EN PREMIER
const app = express();

// 3. Vous pouvez maintenant utiliser 'app' pour CORS et le reste
app.use(cors({ origin: "http://localhost:5173" }));
app.use(express.json());

// Swagger UI
app.use("/docs", swaggerUi.serve, swaggerUi.setup(swaggerSpec));

// API routes
app.use("/api", apiRouter);

// 404 + errors
app.use(notFound);
app.use(errorHandler);

module.exports = app;