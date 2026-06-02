"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Plus } from "lucide-react";
import { toast } from "sonner";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { KampaniyaTemplate } from "../templates";
import { createFromTemplate } from "../actions";

export function TemplateCard({ template }: { template: KampaniyaTemplate }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function onCreate() {
    startTransition(async () => {
      const res = await createFromTemplate(template.kod);
      if (res.ok && res.id) {
        toast.success("Şablondan yaradıldı — indi aktivləşdir");
        router.push(`/kampaniyalar/${res.id}`);
      } else if (!res.ok) {
        toast.error(res.error);
      }
    });
  }

  return (
    <Card className="glass relative overflow-hidden transition hover:-translate-y-0.5 hover:shadow-lg">
      <div aria-hidden className={cn("absolute inset-x-0 top-0 h-1 bg-gradient-to-r", template.reng)} />
      <CardContent className="space-y-3 py-4">
        <div className="flex items-start gap-3">
          <div className={cn("grid h-12 w-12 flex-shrink-0 place-items-center rounded-2xl bg-gradient-to-br text-2xl shadow-sm", template.reng)}>
            {template.emoji}
          </div>
          <div className="min-w-0">
            <h3 className="font-bold leading-snug">{template.ad}</h3>
            <p className="mt-0.5 text-[11.5px] text-muted-foreground line-clamp-2">{template.qisa}</p>
          </div>
        </div>

        <div className="flex flex-wrap gap-1">
          {template.uygun.map((u) => (
            <span key={u} className="rounded-full bg-secondary/60 px-2 py-0.5 text-[9.5px] uppercase tracking-wider text-muted-foreground">
              {u}
            </span>
          ))}
        </div>

        <Button
          type="button"
          onClick={onCreate}
          disabled={pending}
          className="w-full font-semibold"
          variant="outline"
        >
          {pending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}
          Bu şablondan yarat
        </Button>
      </CardContent>
    </Card>
  );
}
