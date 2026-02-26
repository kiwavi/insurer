import Fastify, { FastifyInstance } from "fastify";
const server: FastifyInstance = Fastify({ logger: true });
import swagger from "@fastify/swagger";
import swaggerUi from "@fastify/swagger-ui";
import multipart from "@fastify/multipart";
import { claims, members, procedures, users } from "./db/schema";
import { drizzle } from "drizzle-orm/node-postgres";
import { eq, or } from "drizzle-orm";
import * as argon2 from "argon2";
import {
  Format_phone_number,
  signJwt,
  verifyGoogleToken,
} from "./utils/authentication";
import "dotenv/config";
import { v4 as uuidv4 } from "uuid";
import { userLoggedMiddleware } from "./middleware/auth";
import { calculateBenefitLimit, calculateFraud } from "./utils/claims";
import { claimsStatusEnums } from "./db/schema";

export const db = drizzle(process.env.DATABASE_URL!);
type ClaimsStatus = (typeof claimsStatusEnums.enumValues)[number];

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
            activated: true,
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

server.post(
  "/auth/google",
  {
    schema: {
      body: {
        type: "object",
        properties: {
          idToken: { type: "string" },
        },
        required: ["idToken"],
      },
      response: {
        200: {
          type: "object",
          properties: {
            success: { type: "boolean" },
            message: { type: "string" },
            status: { type: "string" },
            data: {
              type: "object",
              properties: {
                id: { type: "number" },
                email: { type: "string", format: "email" },
                activated: { type: "boolean" },
                deleted_at: { type: ["string", "null"], format: "date-time" },
                phone_number: { type: "string" },
              },
              required: ["id", "email", "activated"],
            },
          },
        },
        202: {
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
        409: {
          type: "object",
          properties: {
            success: {
              type: "boolean",
            },
            message: {
              type: "string",
            },
            token: {
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
        401: {
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
        404: {
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
        201: {
          type: "object",
          properties: {
            success: {
              type: "boolean",
            },
            message: {
              type: "string",
            },
            status: {
              type: "string",
            },
          },
        },
      },
    },
  },
  async (request, reply) => {
    try {
      let { idToken, role_id } = request.body as {
        idToken: string;
        role_id: number;
      };

      let user;

      try {
        user = await verifyGoogleToken(idToken);
      } catch (e) {
        request.log.error(e);
        return reply
          .status(401)
          .send({ success: false, message: "Invalid Google token" });
      }

      const { email, name } = user as { name: string; email: string };

      // fetch user from db.
      let fetchUser = await db
        .select({
          id: users.id,
          email: users.email,
          activated: users.activated,
          deleted_at: users.deleted_at,
          phone_number: users.phone_number,
        })
        .from(users)
        .where(eq(users.email, email))
        .limit(1);

      if (fetchUser?.length) {
        // already exists. check that they can proceed with login
        if (!fetchUser[0].activated && !fetchUser[0].deleted_at) {
          // user exists but is not activated, return details and tell them. Esp if they signed up manually and now they are using the email to login. Means the number should be verified.
          return reply
            .code(409)
            .send({ success: false, message: "Signup process not finished" });
        }

        if (fetchUser[0].deleted_at) {
          // user exists (phone number or email) and is deactivated
          return reply.code(409).send({
            success: false,
            message: `Account with this email exists but is deactivated`,
          });
        }

        let token = await signJwt({
          user_id: fetchUser[0].id,
          jti: uuidv4(),
        });

        return reply.code(200).send({
          success: true,
          message: "Success",
          data: fetchUser[0],
          status: "active",
          token,
        });

        // return user
      } else {
        let createUser: {
          name: string;
          id: number;
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

        // user does not exist. Create one
        await db.transaction(async (tx) => {
          createUser = await tx
            .insert(users)
            .values({
              name,
              email,
              activated: true,
            })
            .returning();
        });

        return reply.code(201).send({
          success: true,
          message: `Account created successfully and can now login`,
          status: "active",
        });
      }
    } catch (e) {
      console.log(e);
      return reply
        .code(500)
        .send({ success: false, message: "Internal server error" });
    }
  },
);

server.put(
  "/auth/login",
  {
    schema: {
      body: {
        type: "object",
        properties: {
          email: { type: "string" },
          phone_number: { type: "string" },
          password: { type: "string" },
        },
        required: ["password"],
        anyOf: [{ required: ["email"] }, { required: ["phone_number"] }],
      },
      response: {
        200: {
          type: "object",
          properties: {
            success: { type: "boolean" },
            message: { type: "string" },
            status: { type: "string" },
            token: { type: "string" },
            data: {
              type: "object",
              properties: {
                id: { type: "number" },
                email: { type: ["string", "null"] },
                activated: { type: "boolean" },
                deleted_at: { type: ["string", "null"] },

                phone_number: { type: ["string", "null"] },
              },
              required: ["id", "activated"],
            },
          },
          required: ["success", "message", "status", "token", "data"],
        },
        404: {
          type: "object",
          properties: {
            success: { type: "boolean" },
            message: { type: "string" },
          },
          required: ["success", "message"],
        },
        401: {
          type: "object",
          properties: {
            success: { type: "boolean" },
            message: { type: "string" },
          },
          required: ["success", "message"],
        },
        409: {
          oneOf: [
            {
              type: "object",
              properties: {
                success: { type: "boolean" },
                message: { type: "string" },
              },
              required: ["success", "message"],
            },
            {
              type: "object",
              properties: {
                success: { type: "boolean" },
                message: { type: "string" },
                status: { type: "string" },
                token: { type: "string" },
              },
              required: ["success", "message", "status", "token"],
            },
          ],
        },
        500: {
          type: "object",
          properties: {
            success: { type: "boolean" },
            message: { type: "string" },
          },
          required: ["success", "message"],
        },
      },
    },
  },
  async (request, reply) => {
    try {
      let { phone_number, email, password } = request.body as {
        phone_number: string | null;
        email: string | null;
        password: string;
      };

      let user: {
        id: number;
        email: string;
        activated: boolean;
        deleted_at: Date | null;
        phone_number: string | null;
        password_hash: string | null;
      }[] = [];

      if (phone_number) {
        phone_number = Format_phone_number(phone_number) as string;
        user = await db
          .select({
            id: users.id,
            email: users.email,
            activated: users.activated,
            deleted_at: users.deleted_at,
            phone_number: users.phone_number,
            password_hash: users.password_hash,
          })
          .from(users)
          .where(eq(users.phone_number, phone_number))
          .limit(1);
      }

      if (email) {
        user = await db
          .select({
            id: users.id,
            email: users.email,
            activated: users.activated,
            deleted_at: users.deleted_at,
            phone_number: users.phone_number,
            password_hash: users.password_hash,
          })
          .from(users)
          .where(eq(users.email, email))
          .limit(1);
      }

      if (!user?.length) {
        return reply
          .code(404)
          .send({ success: false, message: "User not found" });
      }

      if (!user[0]?.activated) {
        return reply
          .code(409)
          .send({ success: false, message: "Signup process not finished" });
      }

      if (user[0]?.deleted_at) {
        return reply.code(409).send({
          success: false,
          message: "Account exists but is deactivated.",
        });
      }

      // validate password
      try {
        if (!(await argon2.verify(user[0].password_hash as string, password))) {
          // password does not match
          return reply.code(401).send({
            success: false,
            message: "Invalid credentials.",
          });
        }
      } catch (err) {
        return reply.code(500).send({
          success: false,
          message: "Internal server error",
        });
      }

      let token = await signJwt({
        user_id: user[0].id,
        jti: uuidv4(),
      });

      return reply.code(200).send({
        success: true,
        message: "Success",
        data: user[0],
        status: "active",
        token,
      });
    } catch (e) {
      console.log(e);
      return reply
        .code(500)
        .send({ success: false, message: "Internal server error" });
    }
  },
);

server.post(
  "/claims",
  {
    preHandler: userLoggedMiddleware,
    schema: {
      summary: "Post A Claim",
      security: [{ bearerAuth: [] }],
      body: {
        type: "object",
        properties: {
          member_id: { type: "integer" },
          claim_amount: { type: "integer" },
          procedure_code: { type: "string" },
          // diagnosis_code: { type: "string" },
        },
        required: [
          "member_id",
          "claim_amount",
          "procedure_code",
          // "diagnosis_code",
        ],
      },
      response: {
        200: {
          type: "object",
          properties: {
            claim_id: { type: "string", format: "uuid" },
            status: {
              type: "string",
              enum: ["APPROVED", "PARTIAL", "REJECTED"],
            },
            fraud_flag: { type: "boolean" },
            approved_amount: { type: "number" },
          },
          required: ["claim_id", "status", "fraud_flag", "approved_amount"],
        },
        404: {
          type: "object",
          properties: {
            success: { type: "boolean", const: false },
            message: { type: "string" },
          },
          required: ["success", "message"],
        },
        500: {
          type: "object",
          properties: {
            success: { type: "boolean", const: false },
            message: { type: "string" },
          },
          required: ["success", "message"],
        },
      },
    },
  },
  async (request, reply) => {
    try {
      let { member_id, claim_amount, procedure_code } = request.body as {
        member_id: number;
        claim_amount: number;
        procedure_code: string;
      };

      await db.transaction(async (tx) => {
        // find member
        let [member] = await tx
          .select({
            id: members.id,
            active: members.active,
            plan_id: members.plan_id,
          })
          .from(members)
          .where(eq(members.id, member_id))
          .for("update")
          .limit(1);

        if (!member) {
          return reply
            .code(404)
            .send({ success: false, message: "Member not found" });
        }

        // validate eligibility
        if (!member.active) {
          return reply
            .code(404)
            .send({ success: false, message: "Member is inactive." });
        }

        // validate procedure code
        let [procedure] = await db
          .select()
          .from(procedures)
          .where(eq(procedures.code, procedure_code));

        if (!procedure) {
          return reply
            .code(404)
            .send({ success: false, message: "Procedure not found" });
        }

        // benefit coverage check.
        let { status, amount_approved } = await calculateBenefitLimit(
          member.plan_id,
          claim_amount,
          procedure.benefit_id,
        );

        let fraud_flag: boolean = await calculateFraud(claim_amount, procedure);

        const claimStatus = status as ClaimsStatus;

        let [claim] = await tx
          .insert(claims)
          .values({
            member_id: member_id,
            claim_amount: claim_amount.toString(),
            procedure_id: procedure.id,
            fraud_flag,
            approved_amount: amount_approved?.toString() ?? null,
            status: claimStatus,
          })
          .returning();

        return reply.code(200).send({
          claim_id: claim.claim_id,
          status: claim.status,
          fraud_flag: claim.fraud_flag,
          approved_amount: claim.approved_amount,
        });
      });
    } catch (e) {
      console.log(e);
      return reply
        .code(500)
        .send({ success: false, message: "Internal server error" });
    }
  },
);

server.get(
  "/claims/:id",
  {
    preHandler: userLoggedMiddleware,
    schema: {
      summary: "Get A Claim",
      security: [{ bearerAuth: [] }],
      params: {
        type: "object",
        required: ["id"],
        properties: {
          id: { type: "string", format: "uuid" }, // validates that the param is a UUID
        },
      },
      response: {
        200: {
          type: "object",
          properties: {
            claim: {
              type: "object",
              properties: {
                id: { type: "string", format: "uuid" },
                status: {
                  type: "string",
                  enum: ["APPROVED", "PARTIAL", "REJECTED"], // match your enum values
                },
              },
              required: ["id", "status"],
            },
          },
          required: ["claim"],
        },
        404: {
          type: "object",
          properties: {
            success: { type: "boolean", const: false },
            message: { type: "string" },
          },
          required: ["success", "message"],
        },
        500: {
          type: "object",
          properties: {
            success: { type: "boolean", const: false },
            message: { type: "string" },
          },
          required: ["success", "message"],
        },
      },
    },
  },
  async (request, reply) => {
    try {
      const { id } = request.params as { id: string };

      let [claim] = await db
        .select({ id: claims.claim_id, status: claims.status })
        .from(claims)
        .where(eq(claims.claim_id, id));

      if (!claim) {
        return reply
          .code(404)
          .send({ success: false, message: "Claim not found" });
      }

      return reply.code(200).send(claim);
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
    await server.listen({ port: Number(process.env.PORT) });
    const address = server.server.address();
  } catch (e) {
    server.log.error(e);
    process.exit(1);
  }
};

start();
