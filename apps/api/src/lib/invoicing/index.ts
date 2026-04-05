import type { InvoiceProvider } from "@roots/contracts";
import { NullInvoiceProvider } from "./null-provider";
import { FortnoxInvoiceProvider } from "./fortnox-provider";
import { childLogger } from "../logger";

const log = childLogger("invoicing");

let _provider: InvoiceProvider | null = null;

export function getInvoiceProvider(): InvoiceProvider {
  if (_provider) return _provider;

  const enabled = process.env.FORTNOX_ENABLED === "true";

  if (enabled) {
    const token = process.env.FORTNOX_ACCESS_TOKEN;
    if (!token) {
      log.warn(
        "FORTNOX_ENABLED=true but no access token found, falling back to NullProvider"
      );
      _provider = new NullInvoiceProvider();
    } else {
      _provider = new FortnoxInvoiceProvider(token);
    }
  } else {
    _provider = new NullInvoiceProvider();
  }

  return _provider;
}

export function resetProvider(): void {
  _provider = null;
}
