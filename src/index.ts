import Fastify, { FastifyInstance } from "fastify";
const server: FastifyInstance = Fastify({ logger: true });
import swagger from "@fastify/swagger";
import swaggerUi from "@fastify/swagger-ui";
import multipart from "@fastify/multipart";
import { users } from "./db/schema";
import { drizzle } from "drizzle-orm/node-postgres";
import { eq, or } from "drizzle-orm";
import * as argon2 from "argon2";
import { Format_phone_number } from "./utils/authentication";
import "dotenv/config";

export const db = drizzle(process.env.DATABASE_URL!);

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

server.post(
  "/auth/register",
  {
    schema: {
      body: {
        type: "object",
        properties: {
          name: { type: "string" },
          email: { type: "string", format: "email" },
          password: { type: "string", minLength: 8 },
          phone_number: {
            type: "string",
            pattern: "^(\\+254|0)(1|7)[0-9]{8}$",
          },
        },
        required: ["name", "phone_number", "password", "email"],
      },
      response: {
        202: {
          type: "object",
          properties: {
            success: {
              type: "boolean",
            },
            message: {
              type: "string",
            },
            update_token: {
              type: "string",
            },
          },
          required: ["success", "message"],
        },
        409: {
          type: "object",
          properties: {
            success: {
              type: "boolean",
            },
            message: {
              type: "string",
            },
          },
        },
        500: {
          type: "object",
          properties: {
            success: {
              type: "boolean",
            },
            message: {
              type: "string",
            },
          },
        },
        400: {
          type: "object",
          properties: {
            success: {
              type: "boolean",
            },
            message: {
              type: "string",
            },
          },
        },
      },
    },
  },
  async (request, reply) => {
    try {
      // type assertion because req.body is usually unknown
      let { name, email, password, phone_number } = request.body as {
        name: string;
        email: string;
        password: string;
        phone_number: string;
      };

      // convert the phone number into 254 format. it is already in valid kenyan phone number format
      phone_number = Format_phone_number(phone_number) as string;

      // find whether there are any people already who have the given details
      let user = await db
        .select()
        .from(users)
        .where(or(eq(users.email, email), eq(users.phone_number, phone_number)))
        .limit(1);

      if (user?.length) {
        if (!user[0].activated && !user[0].deleted_at) {
          // user exists but is not activated, return details and tell them
          return reply
            .code(409)
            .send({ success: false, message: "Signup process not finished" });
        }

        let emailTrue = email === user[0].email;
        let phoneTrue = email === user[0].phone_number;

        if (user[0].deleted_at) {
          // user exists (phone number or email) and is deactivated
          return reply.code(409).send({
            success: false,
            message: `Account with this ${emailTrue ? "email" : "phone number"} exists but is deactivated`,
          });
        }

        return reply.code(409).send({
          success: false,
          message: `Account with this ${emailTrue ? "email" : "phone number"} already exists`,
        });
      }

      let password_hash = await argon2.hash(password);

      let createUser: {
        id: number;
        name: string;
        email: string;
        phone_number: string | null;
        activated: boolean;
        created_at: Date;
        updated_at: Date;
        deleted_at: Date | null;
        password_hash: string | null;
        hashed_verification_code: number | null;

        profile_picture: string | null;
      }[];

      await db.transaction(async (tx) => {
        createUser = await tx
          .insert(users)
          .values({
            phone_number,
            name,
            email,
            password_hash,
          })
          .returning();
      });

      return reply
        .code(202)
        .send({ success: true, message: "User created successfully" });
    } catch (e) {
      console.log(e);
      return reply
        .code(500)
        .send({ success: false, message: "Internal server error" });
    }
  },
);

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
