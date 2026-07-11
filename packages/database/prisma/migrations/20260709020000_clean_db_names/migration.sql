-- CreateEnum
CREATE TYPE "message_direction" AS ENUM ('inbound', 'outbound');

-- DropForeignKey
ALTER TABLE "sleekflow_api_calls" DROP CONSTRAINT "sleekflow_api_calls_message_id_fkey";

-- DropForeignKey
ALTER TABLE "sleekflow_conversations" DROP CONSTRAINT "sleekflow_conversations_contact_id_fkey";

-- DropForeignKey
ALTER TABLE "sleekflow_messages" DROP CONSTRAINT "sleekflow_messages_contact_id_fkey";

-- DropForeignKey
ALTER TABLE "sleekflow_messages" DROP CONSTRAINT "sleekflow_messages_conversation_id_fkey";

-- DropTable
DROP TABLE "sleekflow_api_calls";

-- DropTable
DROP TABLE "sleekflow_contacts";

-- DropTable
DROP TABLE "sleekflow_conversations";

-- DropTable
DROP TABLE "sleekflow_messages";

-- DropEnum
DROP TYPE "sleekflow_message_direction";

-- CreateTable
CREATE TABLE "contacts" (
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

    CONSTRAINT "contacts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "conversations" (
    "id" UUID NOT NULL,
    "contact_id" UUID NOT NULL,
    "channel" TEXT NOT NULL,
    "conversation_id" TEXT NOT NULL,
    "last_message_at" TIMESTAMP(3),
    "raw" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "conversations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "messages" (
    "id" UUID NOT NULL,
    "contact_id" UUID NOT NULL,
    "conversation_id" UUID,
    "direction" "message_direction" NOT NULL,
    "channel" TEXT NOT NULL,
    "message_type" TEXT NOT NULL,
    "message_content" TEXT,
    "message_id" TEXT,
    "message_unique_id" TEXT,
    "status" TEXT,
    "file_name" TEXT,
    "file_url" TEXT,
    "analytic_tags" JSONB,
    "raw_payload" JSONB,
    "raw_response" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "messages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "api_calls" (
    "id" UUID NOT NULL,
    "message_id" UUID,
    "operation" TEXT NOT NULL,
    "request_url" TEXT NOT NULL,
    "request_payload" JSONB,
    "response_status" INTEGER,
    "response_payload" JSONB,
    "error" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "api_calls_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "contacts_phone_idx" ON "contacts"("phone");

-- CreateIndex
CREATE INDEX "contacts_channel_idx" ON "contacts"("channel");

-- CreateIndex
CREATE INDEX "contacts_last_seen_at_idx" ON "contacts"("last_seen_at");

-- CreateIndex
CREATE UNIQUE INDEX "contacts_channel_primary_identifier_key" ON "contacts"("channel", "primary_identifier");

-- CreateIndex
CREATE INDEX "conversations_contact_id_idx" ON "conversations"("contact_id");

-- CreateIndex
CREATE INDEX "conversations_last_message_at_idx" ON "conversations"("last_message_at");

-- CreateIndex
CREATE UNIQUE INDEX "conversations_channel_conversation_id_key" ON "conversations"("channel", "conversation_id");

-- CreateIndex
CREATE INDEX "messages_contact_id_idx" ON "messages"("contact_id");

-- CreateIndex
CREATE INDEX "messages_conversation_id_idx" ON "messages"("conversation_id");

-- CreateIndex
CREATE INDEX "messages_direction_idx" ON "messages"("direction");

-- CreateIndex
CREATE INDEX "messages_channel_idx" ON "messages"("channel");

-- CreateIndex
CREATE INDEX "messages_created_at_idx" ON "messages"("created_at");

-- CreateIndex
CREATE INDEX "messages_message_id_idx" ON "messages"("message_id");

-- CreateIndex
CREATE INDEX "api_calls_message_id_idx" ON "api_calls"("message_id");

-- CreateIndex
CREATE INDEX "api_calls_operation_idx" ON "api_calls"("operation");

-- CreateIndex
CREATE INDEX "api_calls_created_at_idx" ON "api_calls"("created_at");

-- AddForeignKey
ALTER TABLE "conversations" ADD CONSTRAINT "conversations_contact_id_fkey" FOREIGN KEY ("contact_id") REFERENCES "contacts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "messages" ADD CONSTRAINT "messages_contact_id_fkey" FOREIGN KEY ("contact_id") REFERENCES "contacts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "messages" ADD CONSTRAINT "messages_conversation_id_fkey" FOREIGN KEY ("conversation_id") REFERENCES "conversations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "api_calls" ADD CONSTRAINT "api_calls_message_id_fkey" FOREIGN KEY ("message_id") REFERENCES "messages"("id") ON DELETE SET NULL ON UPDATE CASCADE;
