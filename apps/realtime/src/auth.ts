import { verifyRealtimeTicket } from "@repo/realtime";

export type RealtimeSubject = { id: string };

export function createTicketAuthenticator(secret: string) {
  return async (ticket: string): Promise<RealtimeSubject> => {
    const claims = verifyRealtimeTicket(ticket, secret);
    return { id: claims.subjectId };
  };
}
