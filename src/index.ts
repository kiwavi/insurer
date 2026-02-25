import Fastify, { FastifyInstance } from "fastify";
const server: FastifyInstance = Fastify({ logger: true });
import swagger from "@fastify/swagger";
import swaggerUi from "@fastify/swagger-ui";
import multipart from "@fastify/multipart";

await server.register(swagger, {
  openapi: {
    info: {
      title: "My API",
      description: "API documentation for Fastify app",
      version: "1.0.0",
    },
    components: {
      securitySchemes: {
        bearerAuth: {
          type: "http",
          scheme: "bearer",
          bearerFormat: "JWT",
        },
      },
    },
  },
});

await server.register(swaggerUi, {
  routePrefix: "/docs",
  uiConfig: { docExpansion: "full", deepLinking: false },
});

await server.register(multipart, {
  attachFieldsToBody: false,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB, adjust as needed
  },
});

server.get("/", async (request, reply) => {
  return { hello: "World" };
});

const start = async () => {
  try {
    await server.listen({ port: 3094 });
    const address = server.server.address();
    const port = typeof address === "string" ? address : address?.port;
  } catch (e) {
    server.log.error(e);
    process.exit(1);
  }
};

start();
