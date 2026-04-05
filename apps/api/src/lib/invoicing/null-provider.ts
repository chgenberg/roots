import type {
  InvoiceProvider,
  InvoiceCustomer,
  InvoiceOrder,
  InvoiceResult,
  InvoiceStatusResult,
} from "@roots/contracts";
import { childLogger } from "../logger";

const log = childLogger("null-invoice-provider");

export class NullInvoiceProvider implements InvoiceProvider {
  async createOrUpdateCustomer(customer: InvoiceCustomer): Promise<string | null> {
    log.info(
      { name: customer.name, orgNumber: customer.orgNumber },
      "Would create/update customer"
    );
    return null;
  }

  async createInvoiceFromOrder(order: InvoiceOrder): Promise<InvoiceResult> {
    log.info(
      { orderId: order.orderId, totalSEK: order.totalOre / 100 },
      "Would create invoice for order"
    );
    return {
      externalId: null,
      status: "pending",
      message: "Fortnox integration not enabled. Invoice pending manual processing.",
    };
  }

  async getInvoiceStatus(externalId: string): Promise<InvoiceStatusResult> {
    return {
      externalId,
      status: "unknown",
    };
  }
}
