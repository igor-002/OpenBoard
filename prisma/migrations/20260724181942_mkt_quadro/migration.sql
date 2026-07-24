-- CreateTable
CREATE TABLE "MktBoard" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MktBoard_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MktColumn" (
    "id" TEXT NOT NULL,
    "boardId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MktColumn_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MktCard" (
    "id" TEXT NOT NULL,
    "columnId" TEXT NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "kind" TEXT NOT NULL DEFAULT 'interna',
    "glpiId" INTEGER,
    "dueAt" TIMESTAMP(3),
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MktCard_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MktLabel" (
    "id" TEXT NOT NULL,
    "boardId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "color" TEXT NOT NULL DEFAULT '#6b7280',
    "order" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MktLabel_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "_MktCardLabels" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL,

    CONSTRAINT "_MktCardLabels_AB_pkey" PRIMARY KEY ("A","B")
);

-- CreateIndex
CREATE UNIQUE INDEX "MktBoard_slug_key" ON "MktBoard"("slug");

-- CreateIndex
CREATE INDEX "MktColumn_boardId_order_idx" ON "MktColumn"("boardId", "order");

-- CreateIndex
CREATE INDEX "MktCard_columnId_order_idx" ON "MktCard"("columnId", "order");

-- CreateIndex
CREATE INDEX "MktCard_glpiId_idx" ON "MktCard"("glpiId");

-- CreateIndex
CREATE INDEX "MktLabel_boardId_idx" ON "MktLabel"("boardId");

-- CreateIndex
CREATE INDEX "_MktCardLabels_B_index" ON "_MktCardLabels"("B");

-- AddForeignKey
ALTER TABLE "MktColumn" ADD CONSTRAINT "MktColumn_boardId_fkey" FOREIGN KEY ("boardId") REFERENCES "MktBoard"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MktCard" ADD CONSTRAINT "MktCard_columnId_fkey" FOREIGN KEY ("columnId") REFERENCES "MktColumn"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MktLabel" ADD CONSTRAINT "MktLabel_boardId_fkey" FOREIGN KEY ("boardId") REFERENCES "MktBoard"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_MktCardLabels" ADD CONSTRAINT "_MktCardLabels_A_fkey" FOREIGN KEY ("A") REFERENCES "MktCard"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_MktCardLabels" ADD CONSTRAINT "_MktCardLabels_B_fkey" FOREIGN KEY ("B") REFERENCES "MktLabel"("id") ON DELETE CASCADE ON UPDATE CASCADE;
