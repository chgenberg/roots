/**
 * Real BankID adapter using the `bankid` npm package (v3.2.1+).
 *
 * Requirements:
 * - npm install bankid
 * - PFX certificate file from your bank
 * - Environment variables:
 *   BANKID_PFX_PATH=/path/to/cert.p12
 *   BANKID_PASSPHRASE=your-passphrase
 *   BANKID_ENV=production  (omit for test/playground)
 *
 * Usage:
 *   import { RealBankIdAdapter } from './real-adapter';
 *   import { setBankIdAdapter } from './adapter';
 *   setBankIdAdapter(new RealBankIdAdapter());
 */

import type {
  BankIdAdapter,
  BankIdStartResult,
  BankIdAuthResult,
} from "./adapter";
import { childLogger } from "../logger";

const log = childLogger("bankid");

export class RealBankIdAdapter implements BankIdAdapter {
  private client: any;
  private initialized = false;

  private async getClient() {
    if (this.initialized) return this.client;

    try {
      const { BankIdClientV6 } = await import("bankid");
      const fs = await import("fs");

      const pfxPath = process.env.BANKID_PFX_PATH;
      const passphrase = process.env.BANKID_PASSPHRASE || "";
      const isProduction = process.env.BANKID_ENV === "production";

      if (!pfxPath) {
        throw new Error("BANKID_PFX_PATH environment variable is required");
      }

      const pfx = fs.readFileSync(pfxPath);

      this.client = new BankIdClientV6({
        pfx,
        passphrase,
        production: isProduction,
      });

      this.initialized = true;
      return this.client;
    } catch (err) {
      log.error({ err }, "Failed to initialize client");
      throw err;
    }
  }

  async startAuth(endUserIp: string): Promise<BankIdStartResult> {
    const client = await this.getClient();

    const response = await client.authenticate({
      endUserIp,
    });

    return {
      orderRef: response.orderRef,
      autoStartToken: response.autoStartToken,
      qrStartToken: response.qrStartToken,
      qrStartSecret: response.qrStartSecret,
    };
  }

  async collect(orderRef: string) {
    const client = await this.getClient();

    const response = await client.collect({ orderRef });

    if (response.status === "pending") {
      return {
        status: "pending" as const,
        hintCode: response.hintCode || "outstandingTransaction",
      };
    }

    if (response.status === "complete") {
      return {
        status: "complete" as const,
        user: {
          personalNumber: response.completionData.user.personalNumber,
          name: response.completionData.user.name,
          givenName: response.completionData.user.givenName,
          surname: response.completionData.user.surname,
        } as BankIdAuthResult,
      };
    }

    return {
      status: "failed" as const,
      hintCode: response.hintCode || "unknown",
    };
  }

  async cancel(orderRef: string): Promise<void> {
    const client = await this.getClient();
    await client.cancel({ orderRef });
  }
}
