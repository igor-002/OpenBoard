-- Filtro da ingestão do quadro de marketing (getBoard → ingestGlpiCards), que
-- roda a cada carga de /marketing/quadro.
CREATE INDEX "GlpiTicket_isDeleted_hiddenFromBoard_idx" ON "GlpiTicket"("isDeleted", "hiddenFromBoard");
