import type {
  InvoiceProvider,
  InvoiceCustomer,
  InvoiceOrder,
  InvoiceResult,
  InvoiceStatusResult,
} from "@roots/contracts";
import { childLogger } from "../logger";

const log = childLogger("fortnox-provider");

const FORTNOX_API_BASE = "https://api.fortnox.se/3";

export class FortnoxInvoiceProvider implements InvoiceProvider {
  private accessToken: string;

  constructor(accessToken: string) {
    this.accessToken = accessToken;
  }

  private async request(
    method: string,
    path: string,
    body?: unknown
  ): Promise<unknown> {
    const res = await fetch(`${FORTNOX_API_BASE}${path}`, {
      method,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${this.accessToken}`,
      },
      body: body ? JSON.stringify(body) : undefined,
    });

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Fortnox API error ${res.status}: ${text}`);
    }

    return res.json();
  }

  async createOrUpdateCustomer(
    customer: InvoiceCustomer
  ): Promise<string | null> {
    try {
      const data = (await this.request("POST", "/customers", {
        Customer: {
          Name: customer.name,
          OrganisationNumber: customer.orgNumber,
          Email: customer.email,
        },
      })) as { Customer: { CustomerNumber: string } };

      return data.Customer.CustomerNumber;
    } catch (err) {
      log.error({ err }, "Failed to create customer");
      return null;
    }
  }

  async createInvoiceFromOrder(order: InvoiceOrder): Promise<InvoiceResult> {
    try {
      const rows = order.lines.map((line) => ({
        ArticleNumber: line.sku,
        Description: line.description,
        DeliveredQuantity: line.qty,
        Price: line.unitPriceOre / 100,
      }));

      const data = (await this.request("POST", "/invoices", {
        Invoice: {
          CustomerNumber: order.customer.orgNumber,
          InvoiceRows: rows,
          YourOrderNumber: order.orderId,
        },
      })) as { Invoice: { DocumentNumber: string } };

      return {
        externalId: data.Invoice.DocumentNumber,
        status: "issued",
      };
    } catch (err) {
      log.error({ err }, "Failed to create invoice");
      return {
        externalId: null,
        status: "error",
        message: String(err),
      };
    }
  }

  async getInvoiceStatus(externalId: string): Promise<InvoiceStatusResult> {
    try {
      const data = (await this.request(
        "GET",
        `/invoices/${externalId}`
      )) as { Invoice: { Cancelled: boolean; FinalPayDate: string; Balance: number } };

      const invoice = data.Invoice;

      let status: InvoiceStatusResult["status"] = "issued";
      if (invoice.Cancelled) status = "cancelled";
      else if (invoice.Balance === 0) status = "paid";

      return { externalId, status };
    } catch {
      return { externalId, status: "unknown" };
    }
  }
}
