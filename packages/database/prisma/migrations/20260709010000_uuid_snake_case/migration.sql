-- CreateEnum
CREATE TYPE "sleekflow_message_direction" AS ENUM ('inbound', 'outbound');

-- DropForeignKey
ALTER TABLE "SleekflowApiCall" DROP CONSTRAINT "SleekflowApiCall_messageId_fkey";

-- DropForeignKey
ALTER TABLE "SleekflowConversation" DROP CONSTRAINT "SleekflowConversation_contactId_fkey";

-- DropForeignKey
ALTER TABLE "SleekflowMessage" DROP CONSTRAINT "SleekflowMessage_contactId_fkey";

-- DropForeignKey
ALTER TABLE "SleekflowMessage" DROP CONSTRAINT "SleekflowMessage_conversationId_fkey";

-- DropTable
DROP TABLE "SleekflowApiCall";

-- DropTable
DROP TABLE "SleekflowContact";

-- DropTable
DROP TABLE "SleekflowConversation";

-- DropTable
DROP TABLE "SleekflowMessage";

-- DropEnum
DROP TYPE "SleekflowMessageDirection";

-- CreateTable
CREATE TABLE "sleekflow_contacts" (
    "id" UUID NOT NULL,
    "primary_identifier" TEXT NOT NULL,
    "channel" TEXT NOT NULL,
    "phone" TEXT,
    "external_contact_id" TEXT,
    "channel_identity_id" TEXT,
    "display_name" TEXT,
    "raw_profile" JSONB,
    "first_seen_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "last_seen_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "sleekflow_contacts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sleekflow_conversations" (
    "id" UUID NOT NULL,
    "contact_id" UUID NOT NULL,
    "channel" TEXT NOT NULL,
    "sleekflow_conversation_id" TEXT NOT NULL,
    "last_message_at" TIMESTAMP(3),
    "raw" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "sleekflow_conversations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sleekflow_messages" (
    "id" UUID NOT NULL,
    "contact_id" UUID NOT NULL,
    "conversation_id" UUID,
    "direction" "sleekflow_message_direction" NOT NULL,
    "channel" TEXT NOT NULL,
    "message_type" TEXT NOT NULL,
    "message_content" TEXT,
    "sleekflow_message_id" TEXT,
    "sleekflow_message_unique_id" TEXT,
    "status" TEXT,
    "file_name" TEXT,
    "file_url" TEXT,
    "analytic_tags" JSONB,
    "raw_payload" JSONB,
    "raw_response" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "sleekflow_messages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sleekflow_api_calls" (
    "id" UUID NOT NULL,
    "message_id" UUID,
    "operation" TEXT NOT NULL,
    "request_url" TEXT NOT NULL,
    "request_payload" JSONB,
    "response_status" INTEGER,
    "response_payload" JSONB,
    "error" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sleekflow_api_calls_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "sleekflow_contacts_phone_idx" ON "sleekflow_contacts"("phone");

-- CreateIndex
CREATE INDEX "sleekflow_contacts_channel_idx" ON "sleekflow_contacts"("channel");

-- CreateIndex
CREATE INDEX "sleekflow_contacts_last_seen_at_idx" ON "sleekflow_contacts"("last_seen_at");

-- CreateIndex
CREATE UNIQUE INDEX "sleekflow_contacts_channel_primary_identifier_key" ON "sleekflow_contacts"("channel", "primary_identifier");

-- CreateIndex
CREATE INDEX "sleekflow_conversations_contact_id_idx" ON "sleekflow_conversations"("contact_id");

-- CreateIndex
CREATE INDEX "sleekflow_conversations_last_message_at_idx" ON "sleekflow_conversations"("last_message_at");

-- CreateIndex
CREATE UNIQUE INDEX "sleekflow_conversations_channel_sleekflow_conversation_id_key" ON "sleekflow_conversations"("channel", "sleekflow_conversation_id");

-- CreateIndex
CREATE INDEX "sleekflow_messages_contact_id_idx" ON "sleekflow_messages"("contact_id");

-- CreateIndex
CREATE INDEX "sleekflow_messages_conversation_id_idx" ON "sleekflow_messages"("conversation_id");

-- CreateIndex
CREATE INDEX "sleekflow_messages_direction_idx" ON "sleekflow_messages"("direction");

-- CreateIndex
CREATE INDEX "sleekflow_messages_channel_idx" ON "sleekflow_messages"("channel");

-- CreateIndex
CREATE INDEX "sleekflow_messages_created_at_idx" ON "sleekflow_messages"("created_at");

-- CreateIndex
CREATE INDEX "sleekflow_messages_sleekflow_message_id_idx" ON "sleekflow_messages"("sleekflow_message_id");

-- CreateIndex
CREATE INDEX "sleekflow_api_calls_message_id_idx" ON "sleekflow_api_calls"("message_id");

-- CreateIndex
CREATE INDEX "sleekflow_api_calls_operation_idx" ON "sleekflow_api_calls"("operation");

-- CreateIndex
CREATE INDEX "sleekflow_api_calls_created_at_idx" ON "sleekflow_api_calls"("created_at");

-- AddForeignKey
ALTER TABLE "sleekflow_conversations" ADD CONSTRAINT "sleekflow_conversations_contact_id_fkey" FOREIGN KEY ("contact_id") REFERENCES "sleekflow_contacts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sleekflow_messages" ADD CONSTRAINT "sleekflow_messages_contact_id_fkey" FOREIGN KEY ("contact_id") REFERENCES "sleekflow_contacts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sleekflow_messages" ADD CONSTRAINT "sleekflow_messages_conversation_id_fkey" FOREIGN KEY ("conversation_id") REFERENCES "sleekflow_conversations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sleekflow_api_calls" ADD CONSTRAINT "sleekflow_api_calls_message_id_fkey" FOREIGN KEY ("message_id") REFERENCES "sleekflow_messages"("id") ON DELETE SET NULL ON UPDATE CASCADE;
