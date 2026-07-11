-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "SleekflowMessageDirection" AS ENUM ('inbound', 'outbound');

-- CreateTable
CREATE TABLE "SleekflowContact" (
    "id" BIGSERIAL NOT NULL,
    "primaryIdentifier" TEXT NOT NULL,
    "channel" TEXT NOT NULL,
    "phone" TEXT,
    "externalContactId" TEXT,
    "channelIdentityId" TEXT,
    "displayName" TEXT,
    "rawProfile" JSONB,
    "firstSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SleekflowContact_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SleekflowConversation" (
    "id" BIGSERIAL NOT NULL,
    "contactId" BIGINT NOT NULL,
    "channel" TEXT NOT NULL,
    "sleekflowConversationId" TEXT NOT NULL,
    "lastMessageAt" TIMESTAMP(3),
    "raw" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SleekflowConversation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SleekflowMessage" (
    "id" BIGSERIAL NOT NULL,
    "contactId" BIGINT NOT NULL,
    "conversationId" BIGINT,
    "direction" "SleekflowMessageDirection" NOT NULL,
    "channel" TEXT NOT NULL,
    "messageType" TEXT NOT NULL,
    "messageContent" TEXT,
    "sleekflowMessageId" TEXT,
    "sleekflowMessageUniqueId" TEXT,
    "status" TEXT,
    "fileName" TEXT,
    "fileUrl" TEXT,
    "analyticTags" JSONB,
    "rawPayload" JSONB,
    "rawResponse" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SleekflowMessage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SleekflowApiCall" (
    "id" BIGSERIAL NOT NULL,
    "messageId" BIGINT,
    "operation" TEXT NOT NULL,
    "requestUrl" TEXT NOT NULL,
    "requestPayload" JSONB,
    "responseStatus" INTEGER,
    "responsePayload" JSONB,
    "error" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SleekflowApiCall_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SleekflowContact_phone_idx" ON "SleekflowContact"("phone");

-- CreateIndex
CREATE INDEX "SleekflowContact_channel_idx" ON "SleekflowContact"("channel");

-- CreateIndex
CREATE INDEX "SleekflowContact_lastSeenAt_idx" ON "SleekflowContact"("lastSeenAt");

-- CreateIndex
CREATE UNIQUE INDEX "SleekflowContact_channel_primaryIdentifier_key" ON "SleekflowContact"("channel", "primaryIdentifier");

-- CreateIndex
CREATE INDEX "SleekflowConversation_contactId_idx" ON "SleekflowConversation"("contactId");

-- CreateIndex
CREATE INDEX "SleekflowConversation_lastMessageAt_idx" ON "SleekflowConversation"("lastMessageAt");

-- CreateIndex
CREATE UNIQUE INDEX "SleekflowConversation_channel_sleekflowConversationId_key" ON "SleekflowConversation"("channel", "sleekflowConversationId");

-- CreateIndex
CREATE INDEX "SleekflowMessage_contactId_idx" ON "SleekflowMessage"("contactId");

-- CreateIndex
CREATE INDEX "SleekflowMessage_conversationId_idx" ON "SleekflowMessage"("conversationId");

-- CreateIndex
CREATE INDEX "SleekflowMessage_direction_idx" ON "SleekflowMessage"("direction");

-- CreateIndex
CREATE INDEX "SleekflowMessage_channel_idx" ON "SleekflowMessage"("channel");

-- CreateIndex
CREATE INDEX "SleekflowMessage_createdAt_idx" ON "SleekflowMessage"("createdAt");

-- CreateIndex
CREATE INDEX "SleekflowMessage_sleekflowMessageId_idx" ON "SleekflowMessage"("sleekflowMessageId");

-- CreateIndex
CREATE INDEX "SleekflowApiCall_messageId_idx" ON "SleekflowApiCall"("messageId");

-- CreateIndex
CREATE INDEX "SleekflowApiCall_operation_idx" ON "SleekflowApiCall"("operation");

-- CreateIndex
CREATE INDEX "SleekflowApiCall_createdAt_idx" ON "SleekflowApiCall"("createdAt");

-- AddForeignKey
ALTER TABLE "SleekflowConversation" ADD CONSTRAINT "SleekflowConversation_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "SleekflowContact"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SleekflowMessage" ADD CONSTRAINT "SleekflowMessage_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "SleekflowContact"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SleekflowMessage" ADD CONSTRAINT "SleekflowMessage_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "SleekflowConversation"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SleekflowApiCall" ADD CONSTRAINT "SleekflowApiCall_messageId_fkey" FOREIGN KEY ("messageId") REFERENCES "SleekflowMessage"("id") ON DELETE SET NULL ON UPDATE CASCADE;
