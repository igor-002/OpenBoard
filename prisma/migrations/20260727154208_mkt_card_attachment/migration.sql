-- CreateTable
CREATE TABLE "MktCardAttachment" (
    "id" TEXT NOT NULL,
    "cardId" TEXT NOT NULL,
    "filename" TEXT NOT NULL,
    "mime" TEXT NOT NULL,
    "size" INTEGER NOT NULL,
    "data" BYTEA NOT NULL,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MktCardAttachment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "MktCardAttachment_cardId_idx" ON "MktCardAttachment"("cardId");

-- AddForeignKey
ALTER TABLE "MktCardAttachment" ADD CONSTRAINT "MktCardAttachment_cardId_fkey" FOREIGN KEY ("cardId") REFERENCES "MktCard"("id") ON DELETE CASCADE ON UPDATE CASCADE;
