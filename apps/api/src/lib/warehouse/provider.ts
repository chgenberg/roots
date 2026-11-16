/**
 * Hur en godkänd sändning lämnar oss.
 *
 * I dag finns bara "manual-file": en intern admin laddar ner plocklistan och
 * skickar den till lagret för hand. När ett 3PL-lager är valt (de flesta kör
 * Ongoing med API) läggs en provider till här som skapar ordrarna hos
 * lagret. Flödet i portalen ändras inte: avstämning, godkännande och
 * markeringen "skickad till lager" sker på samma sätt, och `externalRef`
 * sparar lagrets eget id på sändningen.
 *
 * En provider som anropar ett lager måste klara att `submit` körs om för
 * samma sändning (använd `batchId` som idempotensnyckel hos lagret):
 * anropet görs innan sändningen sparas, så ett avbrott däremellan leder
 * till ett nytt försök.
 */

export interface WarehouseShipmentLine {
  sku: string | null;
  productName: string;
  qty: number;
}

export interface WarehouseShipmentOrder {
  orderId: string;
  deliveryType: "BULK" | "DIRECT";
  /** Den som tar emot paketet: kunden vid hemleverans, föreningen annars. */
  recipientName: string;
  addressLine1: string | null;
  addressLine2: string | null;
  postalCode: string | null;
  city: string | null;
  phone: string | null;
  email: string | null;
  lines: WarehouseShipmentLine[];
}

export interface WarehouseShipment {
  batchId: string;
  orders: WarehouseShipmentOrder[];
}

export interface WarehouseProvider {
  readonly id: string;
  /** Lämnar sändningen till lagret. Returnerar lagrets id om det finns ett. */
  submit(shipment: WarehouseShipment): Promise<{ externalRef: string | null }>;
}

/** Plocklistan skickas för hand. Det finns inget att anropa. */
export const manualFileProvider: WarehouseProvider = {
  id: "manual-file",
  async submit() {
    return { externalRef: null };
  },
};

export function getWarehouseProvider(): WarehouseProvider {
  return manualFileProvider;
}
