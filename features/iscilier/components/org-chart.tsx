"use client";

import Link from "next/link";
import { Crown, Users, Briefcase, Printer, Filter } from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { OrgNode } from "../hr-types";

export function OrgChartView({
  ceo,
  directors,
  managers,
  staff,
  sobeler,
  activeSobe,
}: {
  ceo: OrgNode | null;
  directors: OrgNode[];
  managers: OrgNode[];
  staff: OrgNode[];
  sobeler: Array<{ ad: string; count: number }>;
  activeSobe?: string;
}) {
  return (
    <div className="space-y-4 print:space-y-2">
      <div className="flex flex-wrap items-center gap-2 print:hidden">
        <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
          <Filter className="h-3 w-3" /> Şöbə:
        </span>
        <Link
          href="/iscilier/org-chart"
          className={`rounded-md border px-2 py-1 text-xs ${
            !activeSobe ? "border-primary/40 bg-primary/10 text-primary-light" : "border-border/40"
          }`}
        >
          Hamısı ({sobeler.reduce((s, x) => s + x.count, 0)})
        </Link>
        {sobeler.map((s) => (
          <Link
            key={s.ad}
            href={`/iscilier/org-chart?sobe=${encodeURIComponent(s.ad)}`}
            className={`rounded-md border px-2 py-1 text-xs ${
              activeSobe === s.ad
                ? "border-primary/40 bg-primary/10 text-primary-light"
                : "border-border/40"
            }`}
          >
            {s.ad} ({s.count})
          </Link>
        ))}
        <div className="ml-auto">
          <Button size="sm" variant="outline" onClick={() => window.print()}>
            <Printer className="h-3.5 w-3.5" /> Çap et
          </Button>
        </div>
      </div>

      {/* CEO row */}
      {ceo && (
        <div className="flex flex-col items-center">
          <Node node={ceo} variant="ceo" />
        </div>
      )}

      {/* Directors row */}
      {directors.length > 0 && (
        <>
          {ceo && <Connector />}
          <Card className="glass">
            <CardHeader className="pb-2">
              <CardTitle className="text-xs uppercase tracking-wider text-muted-foreground inline-flex items-center gap-1.5">
                <Crown className="h-3.5 w-3.5" /> Direktorlar ({directors.length})
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap justify-center gap-3">
                {directors.map((n) => (
                  <Node key={n.id} node={n} variant="director" />
                ))}
              </div>
            </CardContent>
          </Card>
        </>
      )}

      {/* Managers row */}
      {managers.length > 0 && (
        <Card className="glass">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs uppercase tracking-wider text-muted-foreground inline-flex items-center gap-1.5">
              <Briefcase className="h-3.5 w-3.5" /> Menecerlər ({managers.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap justify-center gap-3">
              {managers.map((n) => (
                <Node key={n.id} node={n} variant="manager" />
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Staff row */}
      {staff.length > 0 && (
        <Card className="glass">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs uppercase tracking-wider text-muted-foreground inline-flex items-center gap-1.5">
              <Users className="h-3.5 w-3.5" /> Əməkdaşlar ({staff.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
              {staff.map((n) => (
                <Node key={n.id} node={n} variant="staff" />
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Departments summary */}
      <Card className="glass print:hidden">
        <CardHeader className="pb-2">
          <CardTitle className="text-xs uppercase tracking-wider text-muted-foreground">
            Şöbələr üzrə heyət sayğacları
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
            {sobeler.map((s) => (
              <div
                key={s.ad}
                className="flex items-center justify-between rounded-md border border-border/40 p-2 text-sm"
              >
                <span>{s.ad}</span>
                <Badge variant="outline">{s.count}</Badge>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function Connector() {
  return <div className="mx-auto h-3 w-0.5 bg-border" aria-hidden />;
}

function Node({
  node,
  variant,
}: {
  node: OrgNode;
  variant: "ceo" | "director" | "manager" | "staff";
}) {
  const initials = node.ad_soyad
    .split(" ")
    .map((p) => p[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
  const styles = {
    ceo: "border-warning/40 bg-warning/5",
    director: "border-info/40 bg-info/5",
    manager: "border-primary/30 bg-primary/5",
    staff: "border-border/40",
  }[variant];

  return (
    <Link
      href={`/iscilier/${node.id}`}
      className={`flex w-[160px] flex-col items-center gap-1.5 rounded-md border p-2.5 transition hover:scale-105 ${styles}`}
    >
      <Avatar className="h-10 w-10">
        <AvatarFallback
          className="text-xs font-semibold"
          style={{ background: "var(--brand-gradient)", color: "#fff" }}
        >
          {initials}
        </AvatarFallback>
      </Avatar>
      <div className="text-center">
        <div className="line-clamp-1 text-xs font-semibold">{node.ad_soyad}</div>
        <div className="line-clamp-1 text-[10px] text-muted-foreground">
          {node.vezife ?? node.rol_ad ?? "—"}
        </div>
        <div className="mt-0.5 line-clamp-1 text-[10px] text-muted-foreground/70">
          {node.sobe}
        </div>
      </div>
    </Link>
  );
}
