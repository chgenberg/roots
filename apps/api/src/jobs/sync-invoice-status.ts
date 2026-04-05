import { getInvoiceProvider } from "../lib/invoicing";
import { childLogger } from "../lib/logger";

const log = childLogger("sync-invoice-status");

export async function syncInvoiceStatuses(): Promise<void> {
  const provider = getInvoiceProvider();

  // Will fetch all orders with invoiceStatus != 'paid' and invoiceStatus != 'cancelled'
  // and fortnoxInvoiceId IS NOT NULL, then check each one's status
  const pendingInvoices: Array<{
    orderId: string;
    fortnoxInvoiceId: string;
  }> = [];

  log.info(
    { count: pendingInvoices.length },
    `Checking ${pendingInvoices.length} pending invoices`
  );

  for (const invoice of pendingInvoices) {
    try {
      const status = await provider.getInvoiceStatus(
        invoice.fortnoxInvoiceId
      );
      log.info(
        { orderId: invoice.orderId, status: status.status },
        `Order ${invoice.orderId}: ${status.status}`
      );
      // Will update order.invoiceStatus in DB
    } catch (err) {
      log.error(
        { err, fortnoxInvoiceId: invoice.fortnoxInvoiceId },
        `Failed to check invoice ${invoice.fortnoxInvoiceId}`
      );
    }
  }

  log.info("Sync complete");
}
