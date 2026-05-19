"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Save, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { updateMyProfile } from "../hr-actions";

export function SelfServiceForm({
  telefon,
  unvan,
  dil,
  qohumAd,
  qohumTelefon,
  qohumMunasibet,
}: {
  telefon: string;
  unvan: string;
  dil: string;
  qohumAd: string;
  qohumTelefon: string;
  qohumMunasibet: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    startTransition(async () => {
      const res = await updateMyProfile(fd);
      if (res.ok) {
        toast.success("Profil yeniləndi");
        router.refresh();
      } else toast.error(res.error);
    });
  }

  return (
    <form onSubmit={submit}>
      <Card className="glass">
        <CardHeader className="pb-2">
          <CardTitle className="text-xs uppercase tracking-wider text-muted-foreground">
            Redaktə edə bildiyim sahələr
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <div className="space-y-1">
              <Label className="text-xs">Telefon</Label>
              <Input name="telefon" defaultValue={telefon} maxLength={30} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Dil</Label>
              <select
                name="dil"
                defaultValue={dil || "az"}
                className="h-9 w-full rounded-md border border-border bg-card px-2 text-sm"
              >
                <option value="az">Azərbaycan</option>
                <option value="en">English</option>
                <option value="ru">Русский</option>
                <option value="tr">Türkçe</option>
              </select>
            </div>
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Ünvan</Label>
            <Input name="unvan" defaultValue={unvan} maxLength={500} />
          </div>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
            <div className="space-y-1">
              <Label className="text-xs">Təcili əlaqə — Ad</Label>
              <Input name="qohum_ad" defaultValue={qohumAd} maxLength={100} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Telefon</Label>
              <Input name="qohum_telefon" defaultValue={qohumTelefon} maxLength={30} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Münasibət</Label>
              <Input
                name="qohum_munasibet"
                defaultValue={qohumMunasibet}
                maxLength={40}
                placeholder="Həyat yoldaşı, valideyn, ..."
              />
            </div>
          </div>
          <div className="flex justify-end">
            <Button type="submit" disabled={pending}>
              {pending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Save className="h-4 w-4" />
              )}{" "}
              Yadda saxla
            </Button>
          </div>
        </CardContent>
      </Card>
    </form>
  );
}
