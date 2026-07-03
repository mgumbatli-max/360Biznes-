"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  BarChart,
  Bar,
  Line,
  LineChart,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  Legend,
} from "recharts";
import { Sparkles, Cake } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { formatDate, formatMoney } from "@/lib/utils";
import type { AnalitikaData } from "../analitika-queries";

const COLORS = ["#6366f1", "#22c55e", "#f59e0b", "#ef4444", "#0ea5e9", "#a855f7", "#14b8a6", "#f97316"];

export function AnalitikaPanel({
  data,
  insight,
}: {
  data: AnalitikaData;
  insight: { text: string; is_mock: boolean };
}) {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        {/* Headcount trend */}
        <Card className="glass lg:col-span-2">
          <CardHeader className="pb-2"><CardTitle className="text-base">Headcount trend (12 ay)</CardTitle></CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={240}>
              <LineChart data={data.headcount_trend} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
                <XAxis dataKey="ay" fontSize={10} />
                <YAxis fontSize={10} />
                <Tooltip />
                <Legend />
                <Line type="monotone" dataKey="aktiv" stroke="#6366f1" strokeWidth={2} name="Aktiv" dot={{ r: 3 }} />
                <Line type="monotone" dataKey="yeni" stroke="#22c55e" strokeWidth={2} name="Yeni" dot={{ r: 3 }} />
                <Line type="monotone" dataKey="cixmis" stroke="#ef4444" strokeWidth={2} name="Çıxmış" dot={{ r: 3 }} />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Role pie */}
        <Card className="glass">
          <CardHeader className="pb-2"><CardTitle className="text-base">Rol üzrə paylanma</CardTitle></CardHeader>
          <CardContent>
            {data.by_role.length === 0 ? (
              <div className="py-10 text-center text-sm text-muted-foreground">Məlumat yoxdur</div>
            ) : (
              <ResponsiveContainer width="100%" height={240}>
                <PieChart>
                  <Pie
                    data={data.by_role}
                    dataKey="say"
                    nameKey="ad"
                    cx="50%"
                    cy="50%"
                    outerRadius={80}
                    label
                    fontSize={10}
                  >
                    {data.by_role.map((_, i) => (
                      <Cell key={i} fill={COLORS[i % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {/* Salary by vezife */}
        <Card className="glass">
          <CardHeader className="pb-2"><CardTitle className="text-base">Vəzifə üzrə maaş paylanması</CardTitle></CardHeader>
          <CardContent>
            {data.by_vezife.length === 0 ? (
              <div className="py-10 text-center text-sm text-muted-foreground">Məlumat yoxdur</div>
            ) : (
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={data.by_vezife.slice(0, 8)} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
                  <XAxis dataKey="ad" fontSize={9} angle={-20} textAnchor="end" height={50} />
                  <YAxis fontSize={10} />
                  <Tooltip formatter={(v) => formatMoney(Number(v))} />
                  <Legend />
                  <Bar dataKey="min" fill="#0ea5e9" name="Min" />
                  <Bar dataKey="median" fill="#6366f1" name="Median" />
                  <Bar dataKey="max" fill="#a855f7" name="Max" />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        {/* AI insight */}
        <Card className="glass">
          <CardHeader className="pb-2 flex flex-row items-center gap-2">
            <Sparkles className="h-4 w-4 text-primary" />
            <CardTitle className="text-base">AI tövsiyəsi</CardTitle>
            {insight.is_mock && <Badge variant="outline" className="text-[10px] ml-auto">Mock</Badge>}
          </CardHeader>
          <CardContent>
            <p className="whitespace-pre-wrap text-sm leading-relaxed text-muted-foreground">
              {insight.text}
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {/* Birthdays */}
        <Card className="glass">
          <CardHeader className="pb-2 flex flex-row items-center gap-2">
            <Cake className="h-4 w-4 text-primary" />
            <CardTitle className="text-base">Bu ay doğum günləri</CardTitle>
          </CardHeader>
          <CardContent>
            {data.birthdays_this_month.length === 0 ? (
              <div className="text-sm text-muted-foreground">Bu ay doğum günü yoxdur.</div>
            ) : (
              <ul className="space-y-2">
                {data.birthdays_this_month.map((b) => (
                  <li key={b.id} className="flex items-center justify-between text-sm">
                    <div>
                      <div className="font-medium">{b.ad_soyad}</div>
                      <div className="text-xs text-muted-foreground">{b.vezife ?? "—"}</div>
                    </div>
                    <Badge variant="outline" className="text-[10px]">
                      {formatDate(b.tarix, { day: "2-digit", month: "short" })}
                    </Badge>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        {/* Yearly costs */}
        <Card className="glass">
          <CardHeader className="pb-2"><CardTitle className="text-base">İllik xərclər</CardTitle></CardHeader>
          <CardContent>
            <dl className="space-y-2 text-sm">
              <div className="flex justify-between"><dt className="text-muted-foreground">Maaş (ödənilmiş)</dt><dd className="tabular-nums font-medium">{formatMoney(data.yearly_costs.maas)}</dd></div>
              <div className="flex justify-between"><dt className="text-muted-foreground">Bonus + KPI</dt><dd className="tabular-nums font-medium text-success">{formatMoney(data.yearly_costs.bonus)}</dd></div>
              <div className="flex justify-between"><dt className="text-muted-foreground">Cərimə</dt><dd className="tabular-nums font-medium text-danger">−{formatMoney(data.yearly_costs.cerime)}</dd></div>
              <div className="flex justify-between"><dt className="text-muted-foreground">Treninq xərci</dt><dd className="tabular-nums font-medium">{formatMoney(data.yearly_costs.treninq)}</dd></div>
            </dl>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
