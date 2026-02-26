import { FastifyReply, FastifyRequest } from "fastify";
import jwt from "jsonwebtoken";
import { users } from "../db/schema";
import { and, eq, isNull } from "drizzle-orm";
import { db } from "..";

let secret = process.env.JWT_SIGN_PRIVATE_KEY as string;

export async function userLoggedMiddleware(
  request: FastifyRequest,
  reply: FastifyReply,
) {
  const authHeader = request.headers.authorization;

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return reply.code(401).send({ error: "Missing token" });
  }

  const token = authHeader.slice(7);

  try {
    const payload = jwt.verify(token, secret);

    request.auth = payload as {
      user_id: number;
      jti: any;
    };

    // fetch user and ensure they are verified
    let user = await db
      .select()
      .from(users)
      .where(
        and(
          eq(users.id, request.auth.user_id),
          isNull(users.deleted_at),
          eq(users.activated, true),
        ),
      )
      .limit(1);

    if (!user?.length) {
      return reply.code(403).send({ error: "Not authorized" });
    }
  } catch (err) {
    return reply.code(401).send({ error: "Invalid token" });
  }
}
