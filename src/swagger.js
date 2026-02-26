const swaggerJSDoc = require("swagger-jsdoc");

const options = {
  definition: {
    openapi: "3.0.0",
    info: { title: "Pokedex API", version: "1.0.0" },
    servers: [{ url: "http://localhost:3000" }],
    components: {
      securitySchemes: {
        bearerAuth: { type: "http", scheme: "bearer", bearerFormat: "JWT" }
      }
    }
  },
  apis: []
};

const swaggerSpec = swaggerJSDoc(options);

// On ajoute quelques paths de base sans annotations JSDoc
swaggerSpec.paths = {
  "/api/user/register": { post: { summary: "Register", requestBody: { required: true }, responses: { 201: { description: "Created" } } } },
  "/api/user/login": { post: { summary: "Login", requestBody: { required: true }, responses: { 200: { description: "OK" } } } },
  "/api/user/checkUser": { get: { summary: "Check user", security: [{ bearerAuth: [] }], responses: { 200: { description: "OK" } } } },

  "/api/pkmn/types": { get: { summary: "List types", security: [{ bearerAuth: [] }], responses: { 200: { description: "OK" } } } },
  "/api/pkmn/search": { get: { summary: "Search pokemons", security: [{ bearerAuth: [] }], responses: { 200: { description: "OK" } } } },
  "/api/pkmn": {
    get: { summary: "Get one pokemon (id or name)", security: [{ bearerAuth: [] }], responses: { 200: { description: "OK" } } },
    post: { summary: "Create pokemon (ADMIN)", security: [{ bearerAuth: [] }], responses: { 201: { description: "Created" } } },
    put: { summary: "Update pokemon (ADMIN)", security: [{ bearerAuth: [] }], responses: { 200: { description: "OK" } } },
    delete: { summary: "Delete pokemon (ADMIN)", security: [{ bearerAuth: [] }], responses: { 204: { description: "No Content" } } }
  },
  "/api/pkmn/region": {
    post: { summary: "Add region (ADMIN)", security: [{ bearerAuth: [] }], responses: { 200: { description: "OK" } } },
    delete: { summary: "Remove region (ADMIN)", security: [{ bearerAuth: [] }], responses: { 204: { description: "No Content" } } }
  },
  "/api/pkmn/cry": {
    post: { summary: "Sync pokemon cry from Pokepedia (ADMIN)", security: [{ bearerAuth: [] }], responses: { 200: { description: "OK" } } }
  },

  "/api/trainer": {
    post: { summary: "Create my trainer", security: [{ bearerAuth: [] }], responses: { 201: { description: "Created" } } },
    get: { summary: "Get my trainer", security: [{ bearerAuth: [] }], responses: { 200: { description: "OK" } } },
    delete: { summary: "Delete my trainer", security: [{ bearerAuth: [] }], responses: { 204: { description: "No Content" } } }
  },
  "/api/trainer/mark": {
    post: { summary: "Mark pokemon as SEEN/CATCHED", security: [{ bearerAuth: [] }], responses: { 200: { description: "OK" } } }
  }
};

module.exports = swaggerSpec;
