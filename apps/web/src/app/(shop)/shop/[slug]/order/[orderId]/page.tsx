"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Loader2,
  Package,
  CheckCircle2,
  Truck,
  Clock,
  AlertCircle,
  ArrowLeft,
} from "lucide-react";

import { getBrowserApiBase } from "@/lib/api-base";

const API_URL = getBrowserApiBase();

interface OrderData {
  orderId: string;
  status: string;
  totalOre: number;
  shippingOre: number;
  customerName: string;
  deliveryType: string;
  createdAt: string;
  sellerName: string | null;
  shopSlug: string | null;
  items: Array<{ name: string; qty: number; unitPriceOre: number }>;
}

const STATUS_STEPS = [
  { key: "PENDING", label: "Mottagen", icon: Clock },
  { key: "PAID", label: "Betald", icon: CheckCircle2 },
  { key: "CONFIRMED", label: "Bekräftad", icon: Package },
  { key: "SHIPPED", label: "Skickad", icon: Truck },
  { key: "DELIVERED", label: "Levererad", icon: CheckCircle2 },
];

function getStepIndex(status: string): number {
  const idx = STATUS_STEPS.findIndex((s) => s.key === status);
  return idx >= 0 ? idx : 0;
}

export default function OrderStatusPage() {
  const params = useParams();
  const slug = params.slug as string;
  const orderId = params.orderId as string;

  const [order, setOrder] = useState<OrderData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch(
          `${API_URL}/v1/checkout/order-status/${orderId}`
        );
        if (res.ok) {
          setOrder(await res.json());
        } else {
          setError(true);
        }
      } catch {
        setError(true);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [orderId]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-brand-400" />
      </div>
    );
  }

  if (error || !order) {
    return (
      <div className="min-h-screen bg-brand-50/30">
        <main className="mx-auto flex max-w-lg flex-col items-center px-4 py-16">
          <Card className="w-full shadow-lg">
            <CardContent className="flex flex-col items-center gap-5 py-10">
              <AlertCircle className="h-14 w-14 text-destructive" />
              <h1 className="text-2xl font-semibold">Order hittades inte</h1>
              <p className="text-sm text-muted-foreground text-center">
                Vi kunde inte hitta denna order. Kontrollera länken och försök
                igen.
              </p>
              <Link href={`/shop/${slug}`} className="w-full">
                <Button variant="outline" className="w-full">
                  Tillbaka till shoppen
                </Button>
              </Link>
            </CardContent>
          </Card>
        </main>
      </div>
    );
  }

  const isFailed =
    order.status === "FAILED" ||
    order.status === "CANCELLED" ||
    order.status === "REFUNDED";
  const isPending = order.status === "PENDING" || order.status === "DRAFT";
  const currentStep = getStepIndex(order.status);

  return (
    <div className="min-h-screen bg-brand-50/30">
      <main className="mx-auto max-w-lg px-4 py-8">
        <Link
          href={`/shop/${slug}`}
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-6"
        >
          <ArrowLeft className="h-4 w-4" />
          Tillbaka till shoppen
        </Link>

        <Card className="shadow-lg">
          <CardContent className="py-8 space-y-6">
            <div className="text-center">
              {isFailed ? (
                <AlertCircle className="mx-auto h-12 w-12 text-destructive mb-3" />
              ) : order.status === "DELIVERED" ? (
                <CheckCircle2 className="mx-auto h-12 w-12 text-brand-500 mb-3" />
              ) : isPending ? (
                <Loader2 className="mx-auto h-12 w-12 animate-spin text-brand-400 mb-3" />
              ) : (
                <Package className="mx-auto h-12 w-12 text-brand-500 mb-3" />
              )}
              <h1 className="text-xl font-semibold">
                {order.status === "REFUNDED"
                  ? "Ordern har återbetalats"
                  : isFailed
                  ? "Ordern kunde inte genomföras"
                  : isPending
                  ? "Din betalning behandlas..."
                  : "Orderstatus"}
              </h1>
              <p className="text-sm text-muted-foreground mt-1">
                Order #{order.orderId.slice(0, 8)}
              </p>
            </div>

            {!isFailed && (
              <div className="relative">
                <div className="flex justify-between">
                  {STATUS_STEPS.map((step, i) => {
                    const StepIcon = step.icon;
                    const isActive = i <= currentStep;
                    return (
                      <div
                        key={step.key}
                        className="flex flex-col items-center gap-1.5 relative z-10"
                      >
                        <div
                          className={`flex h-8 w-8 items-center justify-center rounded-full transition-colors ${
                            isActive
                              ? "bg-brand-700 text-white"
                              : "bg-gray-200 text-gray-400"
                          }`}
                        >
                          <StepIcon className="h-4 w-4" />
                        </div>
                        <span
                          className={`text-xs ${
                            isActive
                              ? "font-medium text-foreground"
                              : "text-muted-foreground"
                          }`}
                        >
                          {step.label}
                        </span>
                      </div>
                    );
                  })}
                </div>
                <div className="absolute top-4 left-[10%] right-[10%] h-0.5 bg-gray-200 -z-0">
                  <div
                    className="h-full bg-brand-700 transition-all duration-500"
                    style={{
                      width: `${(currentStep / (STATUS_STEPS.length - 1)) * 100}%`,
                    }}
                  />
                </div>
              </div>
            )}

            <div className="space-y-1 rounded-lg bg-brand-50 p-4">
              <p className="text-sm text-muted-foreground">Kund</p>
              <p className="font-medium">{order.customerName}</p>
              <p className="text-xs text-muted-foreground mt-2">Leveransmetod</p>
              <p className="text-sm font-medium">
                {order.deliveryType === "DIRECT"
                  ? "Direktleverans till dig"
                  : "Samleverans till lagansvarig"}
              </p>
              {order.sellerName && (
                <>
                  <p className="text-xs text-muted-foreground mt-2">Säljare</p>
                  <p className="text-sm font-medium">{order.sellerName}</p>
                </>
              )}
              <p className="text-xs text-muted-foreground mt-2">Beställd</p>
              <p className="text-sm font-medium">
                {new Date(order.createdAt).toLocaleDateString("sv-SE", {
                  year: "numeric",
                  month: "long",
                  day: "numeric",
                })}
              </p>
            </div>

            <div className="space-y-2">
              <p className="text-sm font-medium">Produkter</p>
              {order.items.map((item, i) => (
                <div
                  key={i}
                  className="flex items-center justify-between text-sm py-1.5 border-b last:border-0"
                >
                  <span>
                    {item.name}{" "}
                    <span className="text-muted-foreground">x{item.qty}</span>
                  </span>
                  <span className="font-medium">
                    {((item.unitPriceOre * item.qty) / 100).toLocaleString(
                      "sv-SE"
                    )}{" "}
                    kr
                  </span>
                </div>
              ))}
              {order.shippingOre > 0 && (
                <div className="flex items-center justify-between text-sm py-1.5 border-b">
                  <span className="text-muted-foreground">Frakt</span>
                  <span>
                    {(order.shippingOre / 100).toLocaleString("sv-SE")} kr
                  </span>
                </div>
              )}
              <div className="flex items-center justify-between pt-2">
                <span className="font-semibold">Totalt</span>
                <span className="text-lg font-bold">
                  {(order.totalOre / 100).toLocaleString("sv-SE")} kr
                </span>
              </div>
            </div>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
