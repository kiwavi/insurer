import { OAuth2Client } from "google-auth-library";
import jwt from "jsonwebtoken";

const client = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

// utility functions for auth functionality
export function Format_phone_number(phone_number: string) {
  let Refined;
  if (phone_number.charAt(0) === "0") {
    let newPhone = phone_number.slice(1);
    Refined = "+254".concat(newPhone);
    return Refined.replace(/[" "]/g, "");
  } else if (phone_number.substring(0, 4) === "+254") {
    return phone_number.replace(/[" "]/g, "");
  }
}

export async function verifyGoogleToken(idToken: string) {
  const ticket = await client.verifyIdToken({
    idToken,
    audience: process.env.GOOGLE_CLIENT_ID,
  });

  const payload = ticket.getPayload();
  if (!payload) {
    throw new Error("Invalid Google token payload");
  }

  return {
    googleId: payload.sub!, // unique Google user id
    email: payload.email!,
    emailVerified: payload.email_verified,
    name: payload.name,
    picture: payload.picture,
  };
}

export async function signJwt(data: {
  user_id: number;
  jti: string;
}): Promise<string> {
  const tok = process.env.JWT_SIGN_PRIVATE_KEY as string;
  let token = jwt.sign(data, tok);
  return token;
}
