const express = require("express");
const swaggerUi = require("swagger-ui-express");

const apiRouter = require("./routes");
const swaggerSpec = require("./swagger");
const notFound = require("./middlewares/notFound");
const errorHandler = require("./middlewares/errorHandler");

const app = express();

app.use(express.json());

// Swagger UI
app.use("/docs", swaggerUi.serve, swaggerUi.setup(swaggerSpec));

// API routes
app.use("/api", apiRouter);

// 404 + errors
app.use(notFound);
app.use(errorHandler);

module.exports = app;