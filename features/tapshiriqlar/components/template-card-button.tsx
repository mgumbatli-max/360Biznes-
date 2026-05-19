"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { createTaskFromTemplate } from "../template-actions";

export function TemplateCardButton({ templateId }: { templateId: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const handle = () => {
    startTransition(async () => {
      const res = await createTaskFromTemplate(templateId);
      if (res.ok) {
        toast.success("Tapşırıq yaradıldı");
        router.push(`/tapshiriqlar/${res.id}`);
      } else {
        toast.error(res.error);
      }
    });
  };

  return (
    <Button size="sm" onClick={handle} disabled={pending}>
      {pending ? <Loader2 className="h-3 w-3 animate-spin" /> : <Plus className="h-3 w-3" />}
      Tapşırıq yarat
    </Button>
  );
}
