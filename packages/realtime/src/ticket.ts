import { createHmac, timingSafeEqual } from "node:crypto";

import { z } from "zod";

export const realtimeClaimsSchema = z.object({
  subjectId: z.string().min(1),
  expiresAt: z.string().datetime(),
});

export type RealtimeClaims = z.infer<typeof realtimeClaimsSchema>;

function base64url(value: string): string {
  return Buffer.from(value).toString("base64url");
}

function signature(payload: string, secret: string): string {
  return createHmac("sha256", secret).update(payload).digest("base64url");
}

export function signRealtimeTicket(claims: RealtimeClaims, secret: string): string {
  const payload = base64url(JSON.stringify(realtimeClaimsSchema.parse(claims)));
  return `${payload}.${signature(payload, secret)}`;
}

export function verifyRealtimeTicket(ticket: string, secret: string): RealtimeClaims {
  const [payload, receivedSignature, ...rest] = ticket.split(".");
  if (!payload || !receivedSignature || rest.length > 0) throw new Error("Invalid realtime ticket");

  const expectedSignature = signature(payload, secret);
  const received = Buffer.from(receivedSignature);
  const expected = Buffer.from(expectedSignature);
  if (received.length !== expected.length || !timingSafeEqual(received, expected)) {
    throw new Error("Invalid realtime ticket");
  }

  let claims: RealtimeClaims;
  try {
    claims = realtimeClaimsSchema.parse(JSON.parse(Buffer.from(payload, "base64url").toString()));
  } catch {
    throw new Error("Invalid realtime ticket");
  }
  if (new Date(claims.expiresAt).getTime() <= Date.now()) throw new Error("Expired realtime ticket");
  return claims;
}
