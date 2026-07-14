-- CreateIndex
CREATE INDEX "setup_watch_items_lifecycle_status_updated_at_idx" ON "setup_watch_items"("lifecycle_status", "updated_at");

-- CreateIndex
CREATE INDEX "stock_symbols_active_idx" ON "stock_symbols"("active");
