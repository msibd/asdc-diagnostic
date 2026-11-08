-- Live updates for the inventory and cash-closing screens (same trigger the other tables use).
DO $$
DECLARE
  table_name TEXT;
BEGIN
  FOREACH table_name IN ARRAY ARRAY[
    'InventoryItem',
    'StockBatch',
    'StockMovement',
    'StockPurchase',
    'Supplier',
    'CashClosing',
    'Expense'
  ]
  LOOP
    EXECUTE format(
      'CREATE TRIGGER clinic_change_notification
       AFTER INSERT OR UPDATE OR DELETE ON %I
       FOR EACH STATEMENT
       EXECUTE FUNCTION notify_clinic_change()',
      table_name
    );
  END LOOP;
END;
$$;
