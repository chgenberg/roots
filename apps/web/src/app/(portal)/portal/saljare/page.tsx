"use client";

import { useState, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { portalFetch } from "@/lib/portal-api";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from "@/components/ui/table";
import { Users, TrendingUp, Target, Award } from "lucide-react";

const FALLBACK_SELLERS = [
  {
    id: 1,
    name: "Erik Lindström",
    email: "erik@roots.se",
    clubs: 8,
    pipeline: "45 000 kr",
    closed: "28 000 kr",
    conversion: "35%",
    trend: "+12%",
  },
  {
    id: 2,
    name: "Sara Björk",
    email: "sara@roots.se",
    clubs: 6,
    pipeline: "38 200 kr",
    closed: "22 400 kr",
    conversion: "31%",
    trend: "+8%",
  },
  {
    id: 3,
    name: "Johan Ek",
    email: "johan@roots.se",
    clubs: 5,
    pipeline: "29 100 kr",
    closed: "18 700 kr",
    conversion: "42%",
    trend: "+15%",
  },
  {
    id: 4,
    name: "Maria Holm",
    email: "maria@roots.se",
    clubs: 4,
    pipeline: "21 500 kr",
    closed: "12 300 kr",
    conversion: "28%",
    trend: "+3%",
  },
  {
    id: 5,
    name: "Anders Nyström",
    email: "anders@roots.se",
    clubs: 3,
    pipeline: "16 800 kr",
    closed: "9 100 kr",
    conversion: "25%",
    trend: "-2%",
  },
];

export default function SaljarePage() {
  const [sellers, setSellers] = useState(FALLBACK_SELLERS);

  useEffect(() => {
    portalFetch<{ sellers: any[] }>("/sellers")
      .then((data) => {
        if (data.sellers?.length) setSellers(data.sellers);
      })
      .catch(() => {});
  }, []);

  const totalPipeline = "150 600 kr";
  const totalClosed = "90 500 kr";
  const avgConversion = "32%";

  return (
    <div className="page-enter space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Säljare</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Säljteamets prestation och resultat.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardContent className="p-5">
            <div className="flex items-center gap-3">
              <Users className="h-5 w-5 text-brand-400" />
              <div>
                <p className="text-2xl font-bold">{sellers.length}</p>
                <p className="text-xs text-muted-foreground">Aktiva säljare</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5">
            <div className="flex items-center gap-3">
              <Target className="h-5 w-5 text-brand-400" />
              <div>
                <p className="text-2xl font-bold">{totalPipeline}</p>
                <p className="text-xs text-muted-foreground">Total pipeline</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5">
            <div className="flex items-center gap-3">
              <TrendingUp className="h-5 w-5 text-brand-400" />
              <div>
                <p className="text-2xl font-bold">{totalClosed}</p>
                <p className="text-xs text-muted-foreground">Totalt stängt</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5">
            <div className="flex items-center gap-3">
              <Award className="h-5 w-5 text-brand-400" />
              <div>
                <p className="text-2xl font-bold">{avgConversion}</p>
                <p className="text-xs text-muted-foreground">Snittkonvertering</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardContent className="p-5">
          <h2 className="mb-4 font-semibold">Prestationsöversikt</h2>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>#</TableHead>
                <TableHead>Säljare</TableHead>
                <TableHead>E-post</TableHead>
                <TableHead>Klubbar</TableHead>
                <TableHead>Pipeline</TableHead>
                <TableHead>Stängt</TableHead>
                <TableHead>Konvertering</TableHead>
                <TableHead className="text-right">Trend</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sellers.map((s, i) => (
                <TableRow key={s.id}>
                  <TableCell>
                    {i < 3 ? (
                      <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-brand-50 text-xs font-bold">
                        {i + 1}
                      </span>
                    ) : (
                      <span className="flex h-7 w-7 items-center justify-center text-xs text-muted-foreground">
                        {i + 1}
                      </span>
                    )}
                  </TableCell>
                  <TableCell className="font-medium">{s.name}</TableCell>
                  <TableCell className="text-muted-foreground">{s.email}</TableCell>
                  <TableCell>{s.clubs}</TableCell>
                  <TableCell className="font-medium">{s.pipeline}</TableCell>
                  <TableCell className="font-medium">{s.closed}</TableCell>
                  <TableCell>{s.conversion}</TableCell>
                  <TableCell className="text-right">
                    <Badge
                      variant={s.trend.startsWith("+") ? "success" : "destructive"}
                    >
                      {s.trend}
                    </Badge>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
