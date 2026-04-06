"use client";

import { useEffect, useState } from "react";
import { useParams, useSearchParams } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { CheckCircle2, Loader2, Share2, AlertCircle } from "lucide-react";
import { getBrowserApiBase } from "@/lib/api-base";

const API_URL = getBrowserApiBase();

interface OrderConfirmation {
  orderId: string;
  status: string;
  totalOre: number;
  customerName: string;
  customerEmail: string;
}

export default function ConfirmationPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const slug = params.slug as string;
  const orderId = searchParams.get("order_id");

  const [order, setOrder] = useState<OrderConfirmation | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    async function confirm() {
      if (!orderId) {
        setError(true);
        setLoading(false);
        return;
      }
      try {
        const res = await fetch(`${API_URL}/v1/checkout/confirm/${orderId}`);
        if (res.ok) {
          const data = await res.json();
          if (data.status === "FAILED" || data.status === "CANCELLED") {
            setError(true);
          } else {
            setOrder(data);
          }
        } else {
          setError(true);
        }
      } catch {
        setError(true);
      } finally {
        setLoading(false);
      }
    }
    confirm();
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
              <h1 className="text-2xl font-semibold">Något gick fel</h1>
              <p className="text-sm text-muted-foreground text-center">
                Vi kunde inte bekräfta din beställning. Kontakta oss om problemet kvarstår.
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

  const isPending = order.status === "PENDING" || order.status === "DRAFT";

  return (
    <div className="min-h-screen bg-brand-50/30">
      <main className="mx-auto flex max-w-lg flex-col items-center px-4 py-16">
        <Card className="w-full shadow-lg">
          <CardContent className="flex flex-col items-center gap-5 py-10">
            {isPending ? (
              <Loader2 className="h-14 w-14 animate-spin text-brand-400" />
            ) : (
              <CheckCircle2 className="h-14 w-14 text-success" />
            )}
            <h1 className="text-2xl font-semibold">
              {isPending ? "Din betalning behandlas..." : "Tack för din beställning!"}
            </h1>

            <div className="w-full space-y-3 text-center">
              <p className="text-muted-foreground">
                En bekräftelse skickas till{" "}
                <span className="font-medium text-foreground">
                  {order.customerEmail}
                </span>
              </p>
              <div className="rounded-lg bg-brand-50 p-4">
                <p className="text-sm text-muted-foreground">Belopp</p>
                <p className="text-xl font-semibold">
                  {(order.totalOre / 100).toLocaleString("sv-SE")} kr
                </p>
              </div>
              <p className="text-xs text-muted-foreground">
                Ordernr: {order.orderId.slice(0, 8)}
              </p>
            </div>

            <div className="mt-2 flex flex-col gap-2 w-full">
              <Link
                href={`/shop/${slug}/order/${order.orderId}`}
                className="w-full"
              >
                <Button variant="outline" className="w-full">
                  Se orderstatus
                </Button>
              </Link>
              <Button
                variant="outline"
                className="w-full"
                onClick={() => {
                  const url = `${window.location.origin}/shop/${slug}`;
                  try {
                    if (navigator.share) {
                      navigator.share({ title: "Köp via Roots", url });
                    } else {
                      navigator.clipboard.writeText(url);
                    }
                  } catch {
                    /* Silently handle permission/cancel errors */
                  }
                }}
              >
                <Share2 className="mr-2 h-4 w-4" />
                Dela shoppen med en vän
              </Button>
              <Link href={`/shop/${slug}`} className="w-full">
                <Button variant="ghost" className="w-full">
                  Tillbaka till shoppen
                </Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
