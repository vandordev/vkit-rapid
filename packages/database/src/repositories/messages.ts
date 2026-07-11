import type {
  Prisma,
  ApiCall,
  Contact,
  Conversation,
  Message,
  MessageDirection,
} from "@prisma/client";

import { prisma, type DatabaseClient } from "../client";

export type ContactIdentityInput = {
  channel: string;
  phone?: string | null;
  externalContactId?: string | null;
  channelIdentityId?: string | null;
  conversationId?: string | null;
};

export type ContactIdentity = {
  primaryIdentifier: string;
  lookupValue: string;
};

export function buildContactIdentity(input: ContactIdentityInput): ContactIdentity {
  if (input.phone) {
    return { primaryIdentifier: `phone:${input.phone}`, lookupValue: input.phone };
  }

  if (input.externalContactId) {
    return {
      primaryIdentifier: `external:${input.externalContactId}`,
      lookupValue: input.externalContactId,
    };
  }

  if (input.channelIdentityId) {
    return {
      primaryIdentifier: `channel:${input.channelIdentityId}`,
      lookupValue: input.channelIdentityId,
    };
  }

  if (input.conversationId) {
    return {
      primaryIdentifier: `conversation:${input.conversationId}`,
      lookupValue: input.conversationId,
    };
  }

  return {
    primaryIdentifier: `unknown:${input.channel}`,
    lookupValue: input.channel,
  };
}

export type UpsertContactInput = ContactIdentityInput & {
  displayName?: string | null;
  rawProfile?: Prisma.InputJsonValue;
};

export async function upsertContact(
  input: UpsertContactInput,
  db: DatabaseClient = prisma,
): Promise<Contact> {
  const identity = buildContactIdentity(input);

  return db.contact.upsert({
    where: {
      channel_primaryIdentifier: {
        channel: input.channel,
        primaryIdentifier: identity.primaryIdentifier,
      },
    },
    update: {
      phone: input.phone ?? undefined,
      externalContactId: input.externalContactId ?? undefined,
      channelIdentityId: input.channelIdentityId ?? undefined,
      displayName: input.displayName ?? undefined,
      rawProfile: input.rawProfile ?? undefined,
      lastSeenAt: new Date(),
    },
    create: {
      channel: input.channel,
      primaryIdentifier: identity.primaryIdentifier,
      phone: input.phone ?? undefined,
      externalContactId: input.externalContactId ?? undefined,
      channelIdentityId: input.channelIdentityId ?? undefined,
      displayName: input.displayName ?? undefined,
      rawProfile: input.rawProfile ?? undefined,
    },
  });
}

export type UpsertConversationInput = {
  contactId: string;
  channel: string;
  externalConversationId: string;
  raw?: Prisma.InputJsonValue;
  lastMessageAt?: Date;
};

export async function upsertConversation(
  input: UpsertConversationInput,
  db: DatabaseClient = prisma,
): Promise<Conversation> {
  return db.conversation.upsert({
    where: {
      channel_externalConversationId: {
        channel: input.channel,
        externalConversationId: input.externalConversationId,
      },
    },
    update: {
      contactId: input.contactId,
      raw: input.raw,
      lastMessageAt: input.lastMessageAt ?? new Date(),
    },
    create: {
      contactId: input.contactId,
      channel: input.channel,
      externalConversationId: input.externalConversationId,
      raw: input.raw,
      lastMessageAt: input.lastMessageAt ?? new Date(),
    },
  });
}

export type CreateMessageInput = {
  contactId: string;
  conversationId?: string | null;
  direction: MessageDirection;
  channel: string;
  messageType: string;
  messageContent?: string | null;
  externalMessageId?: string | null;
  externalMessageUniqueId?: string | null;
  status?: string | null;
  fileName?: string | null;
  fileUrl?: string | null;
  analyticTags?: Prisma.InputJsonValue;
  rawPayload?: Prisma.InputJsonValue;
  rawResponse?: Prisma.InputJsonValue;
};

export async function createMessage(
  input: CreateMessageInput,
  db: DatabaseClient = prisma,
): Promise<Message> {
  return db.message.create({
    data: {
      contactId: input.contactId,
      conversationId: input.conversationId ?? undefined,
      direction: input.direction,
      channel: input.channel,
      messageType: input.messageType,
      messageContent: input.messageContent ?? undefined,
      externalMessageId: input.externalMessageId ?? undefined,
      externalMessageUniqueId: input.externalMessageUniqueId ?? undefined,
      status: input.status ?? undefined,
      fileName: input.fileName ?? undefined,
      fileUrl: input.fileUrl ?? undefined,
      analyticTags: input.analyticTags,
      rawPayload: input.rawPayload,
      rawResponse: input.rawResponse,
    },
  });
}

export type CreateApiCallInput = {
  messageId?: string | null;
  operation: string;
  requestUrl: string;
  requestPayload?: Prisma.InputJsonValue;
  responseStatus?: number | null;
  responsePayload?: Prisma.InputJsonValue;
  error?: string | null;
};

export async function createApiCall(
  input: CreateApiCallInput,
  db: DatabaseClient = prisma,
): Promise<ApiCall> {
  return db.apiCall.create({
    data: {
      messageId: input.messageId ?? undefined,
      operation: input.operation,
      requestUrl: input.requestUrl,
      requestPayload: input.requestPayload,
      responseStatus: input.responseStatus ?? undefined,
      responsePayload: input.responsePayload,
      error: input.error ?? undefined,
    },
  });
}

export async function listContacts(limit = 100, db: DatabaseClient = prisma) {
  return db.contact.findMany({
    orderBy: { lastSeenAt: "desc" },
    take: limit,
    include: {
      _count: {
        select: {
          messages: true,
          conversations: true,
        },
      },
    },
  });
}

export async function getContactTimeline(
  identifier: string,
  limit = 100,
  db: DatabaseClient = prisma,
) {
  const contact = await db.contact.findFirst({
    where: {
      OR: [
        { primaryIdentifier: identifier },
        { phone: identifier },
        { externalContactId: identifier },
        { channelIdentityId: identifier },
      ],
    },
  });

  if (!contact) {
    return null;
  }

  const messages = await db.message.findMany({
    where: { contactId: contact.id },
    orderBy: { createdAt: "desc" },
    take: limit,
    include: { conversation: true },
  });

  return { contact, messages };
}

export async function listConversations(limit = 100, db: DatabaseClient = prisma) {
  return db.conversation.findMany({
    orderBy: { lastMessageAt: "desc" },
    take: limit,
    include: {
      contact: true,
      _count: {
        select: { messages: true },
      },
    },
  });
}
