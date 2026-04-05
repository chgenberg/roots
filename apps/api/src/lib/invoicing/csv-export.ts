export interface CsvOrderRow {
  orderId: string;
  orgName: string;
  orgNumber: string;
  date: string;
  items: string;
  totalSek: number;
  status: string;
}

export function generateOrdersCsv(orders: CsvOrderRow[]): string {
  const header =
    "Order-ID;Forening;Org.nummer;Datum;Produkter;Summa (SEK);Status";
  const rows = orders.map(
    (o) =>
      `${o.orderId};${o.orgName};${o.orgNumber};${o.date};${o.items};${o.totalSek};${o.status}`
  );
  return [header, ...rows].join("\n");
}
