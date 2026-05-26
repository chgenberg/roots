import type {
  InvoiceProvider,
  InvoiceCustomer,
  InvoiceCustomerRef,
  InvoiceOrder,
  InvoiceResult,
  InvoiceStatusResult,
} from "@roots/contracts";
import { childLogger } from "../logger";

const log = childLogger("fortnox-provider");

const FORTNOX_API_BASE = "https://api.fortnox.se/3";

/**
 * MASTERPLAN_01 KC1.4 — Fortnox-implementation av InvoiceProvider.
 *
 * Förbättringar mot tidigare version:
 *   - `findCustomerByOrgNumber` med filtering på Fortnox `?filter=...`.
 *   - `createOrUpdateCustomer` kör först lookup, sen PUT eller POST.
 *     Tidigare POST:ade vi blint → Fortnox 409:ar vid duplicates och
 *     fakturan hamnar utan kund.
 *   - `createInvoiceFromOrder` använder den retournerade
 *     `CustomerNumber` (provider-side ID), inte org-numret.
 *   - InvoiceRows har nu `ArticleNumber`, `VATPercent` (default 25),
 *     `AccountNumber` (default 3001 = svensk försäljning 25% moms).
 *
 * OBS: hela klassen instansieras bara när `FORTNOX_ENABLED=true` och
 * `FORTNOX_ACCESS_TOKEN` finns. Vid token-rotation rekommenderar vi
 * att kalla `resetProvider()` (se index.ts) så token cache:n släpps.
 */
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
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15_000);
    try {
      const res = await fetch(`${FORTNOX_API_BASE}${path}`, {
        method,
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${this.accessToken}`,
        },
        body: body ? JSON.stringify(body) : undefined,
        signal: controller.signal,
      });

      if (res.status === 404) {
        return null;
      }

      if (!res.ok) {
        const text = await res.text();
        throw new Error(`Fortnox API error ${res.status}: ${text}`);
      }

      return await res.json();
    } finally {
      clearTimeout(timeout);
    }
  }

  async findCustomerByOrgNumber(
    orgNumber: string
  ): Promise<InvoiceCustomerRef | null> {
    if (!orgNumber) return null;
    try {
      // Fortnox: GET /customers?filter=organisationnumber=NNNNNN-NNNN
      // returnerar { Customers: [...] }. Vi sweepar bara första 25
      // träffarna — i praktiken bör en org-nr-sökning ge 0 eller 1.
      const encoded = encodeURIComponent(orgNumber);
      const data = (await this.request(
        "GET",
        `/customers?organisationnumber=${encoded}`
      )) as {
        Customers?: Array<{
          CustomerNumber: string;
          OrganisationNumber: string;
          Name: string;
          Email?: string;
        }>;
      } | null;

      const hits = data?.Customers ?? [];
      const match = hits.find(
        (c) => c.OrganisationNumber === orgNumber
      );
      if (!match) return null;
      return {
        externalId: match.CustomerNumber,
        orgNumber: match.OrganisationNumber,
        name: match.Name,
        email: match.Email ?? "",
      };
    } catch (err) {
      log.warn(
        { err, orgNumber },
        "Fortnox customer lookup failed — treating as not found"
      );
      return null;
    }
  }

  async createOrUpdateCustomer(
    customer: InvoiceCustomer
  ): Promise<string | null> {
    const existing = await this.findCustomerByOrgNumber(customer.orgNumber);
    const payload = {
      Customer: {
        Name: customer.name,
        OrganisationNumber: customer.orgNumber,
        Email: customer.email,
        ...(customer.phone ? { Phone1: customer.phone } : {}),
        ...(customer.address?.street
          ? { Address1: customer.address.street }
          : {}),
        ...(customer.address?.postalCode
          ? { ZipCode: customer.address.postalCode }
          : {}),
        ...(customer.address?.city ? { City: customer.address.city } : {}),
        ...(customer.address?.countryCode
          ? { CountryCode: customer.address.countryCode }
          : {}),
      },
    };

    try {
      if (existing) {
        const data = (await this.request(
          "PUT",
          `/customers/${encodeURIComponent(existing.externalId)}`,
          payload
        )) as { Customer: { CustomerNumber: string } };
        return data.Customer.CustomerNumber;
      }
      const data = (await this.request(
        "POST",
        "/customers",
        payload
      )) as { Customer: { CustomerNumber: string } };
      return data.Customer.CustomerNumber;
    } catch (err) {
      log.error(
        { err, orgNumber: customer.orgNumber },
        "Failed to upsert customer"
      );
      return null;
    }
  }

  async createInvoiceFromOrder(order: InvoiceOrder): Promise<InvoiceResult> {
    try {
      // Säkerställ kund finns innan vi skapar fakturan; lookup → upsert.
      // Detta löser tomma customer-fält i Fortnox som var rotorsaken
      // bakom KC1 #4.
      const customerExternalId = await this.createOrUpdateCustomer(
        order.customer
      );
      if (!customerExternalId) {
        return {
          externalId: null,
          status: "error",
          message: "Kunde inte skapa/uppdatera kund i Fortnox.",
        };
      }

      const rows = order.lines.map((line) => ({
        ArticleNumber: line.sku,
        Description: line.description,
        DeliveredQuantity: line.qty,
        // Fortnox tar Price exkl. moms; vi har totalPriceOre inkl moms
        // som standard i Roots-DB. Om vatPercent satt och != 0,
        // räkna baklänges (totalt inkl/((100+vat)/100)).
        Price:
          line.vatPercent && line.vatPercent > 0
            ? Number(
                (line.unitPriceOre / 100 / (1 + line.vatPercent / 100)).toFixed(
                  2
                )
              )
            : line.unitPriceOre / 100,
        VAT: line.vatPercent ?? 25,
        AccountNumber: line.accountNumber ?? 3001,
      }));

      const data = (await this.request("POST", "/invoices", {
        Invoice: {
          CustomerNumber: customerExternalId,
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
      )) as {
        Invoice: {
          Cancelled: boolean;
          FinalPayDate: string;
          Balance: number;
        };
      } | null;

      if (!data) return { externalId, status: "unknown" };
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
