export interface McpToolResult {
  name: string;
  result: unknown;
}

export type McpTool = {
  name: string;
  description: string;
  readonly: boolean;
  execute: (params: Record<string, unknown>) => Promise<unknown>;
};

export const mcpTools: McpTool[] = [
  {
    name: "lookup_product",
    description: "Look up a product by slug or name",
    readonly: true,
    execute: async (params) => {
      const products = [
        { slug: "shampoo", name: "Roots Shampoo", price: "149 kr" },
        { slug: "conditioner", name: "Roots Conditioner", price: "149 kr" },
        { slug: "body-wash", name: "Roots Body Wash", price: "129 kr" },
      ];
      const query = (params.query as string || "").toLowerCase();
      return products.find(
        (p) => p.slug === query || p.name.toLowerCase().includes(query)
      ) || null;
    },
  },
  {
    name: "check_order_status",
    description: "Check the status of an order by ID",
    readonly: true,
    execute: async (params) => {
      // Will query DB when connected
      return { orderId: params.orderId, status: "NOT_FOUND" };
    },
  },
];

export function getReadOnlyTools(): McpTool[] {
  return mcpTools.filter((t) => t.readonly);
}
