"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Send, CheckCircle2, XCircle, Trash2, Loader2, ShoppingCart, Printer } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import {
  sendProposal,
  decideProposal,
  deleteProposal,
  convertProposalToPurchaseOrder,
} from "../proposal-actions";

export function ProposalActions({
  teklifId,
  status,
  canDeleteNonDraft = false,
}: {
  teklifId: number;
  status: string;
  /** True if the current user may delete non-draft (təsdiq/rədd/göndərildi) proposals — sahibkar, admin, or has `satinalma.tesdiq_silme` */
  canDeleteNonDraft?: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [decideOpen, setDecideOpen] = useState<null | "tesdiq" | "redd">(null);
  const [qeyd, setQeyd] = useState("");
  const showDelete = status === "draft" || canDeleteNonDraft;

  async function send() {
    if (!confirm("Bu təklifi sahibkara göndərmək istəyirsiniz?")) return;
    const fd = new FormData();
    fd.set("id", String(teklifId));
    startTransition(async () => {
      const res = await sendProposal(fd);
      if (!res.ok) toast.error(res.error);
      else {
        toast.success("Göndərildi");
        router.refresh();
      }
    });
  }

  async function decide() {
    if (!decideOpen) return;
    const fd = new FormData();
    fd.set("id", String(teklifId));
    fd.set("qerar", decideOpen);
    if (qeyd) fd.set("qeyd", qeyd);
    startTransition(async () => {
      const res = await decideProposal(fd);
      if (!res.ok) toast.error(res.error);
      else {
        toast.success(decideOpen === "tesdiq" ? "Təsdiqləndi" : "Rədd edildi");
        setDecideOpen(null);
        setQeyd("");
        router.refresh();
      }
    });
  }

  async function onDelete() {
    if (!confirm("Bu təklifi silmək istəyirsiniz?")) return;
    const fd = new FormData();
    fd.set("id", String(teklifId));
    startTransition(async () => {
      const res = await deleteProposal(fd);
      if (!res.ok) toast.error(res.error);
      else {
        toast.success("Silindi");
        router.replace("/anbar/satinalma");
        router.refresh();
      }
    });
  }

  return (
    <>
      <div className="flex items-center gap-2">
        {showDelete && (
          <Button
            type="button"
            variant="ghost"
            onClick={onDelete}
            disabled={pending}
            className="text-rose-500 hover:bg-rose-500/10 hover:text-rose-500"
            title={status === "draft" ? "Draft təklifi sil" : "Bu təklifi sistemdən tam sil (yalnız icazəlilər)"}
          >
            {pending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Trash2 className="mr-2 h-4 w-4" />}
            Sil
          </Button>
        )}

        {status === "draft" && (
          <Button
            type="button"
            onClick={send}
            disabled={pending}
            className="font-semibold text-white"
            style={{ background: "var(--brand-gradient)" }}
          >
            {pending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />}
            Sahibkara göndər
          </Button>
        )}

        {status === "gonderildi" && (
          <>
            <Button
              type="button"
              variant="outline"
              onClick={() => setDecideOpen("redd")}
              disabled={pending}
              className="text-rose-500 hover:bg-rose-500/10"
            >
              <XCircle className="mr-2 h-4 w-4" /> Rədd et
            </Button>
            <Button
              type="button"
              onClick={() => setDecideOpen("tesdiq")}
              disabled={pending}
              className="bg-emerald-600 font-semibold text-white hover:bg-emerald-700"
            >
              <CheckCircle2 className="mr-2 h-4 w-4" /> Təsdiqlə
            </Button>
          </>
        )}

        {status === "tesdiq" && <ConvertToOrderButton teklifId={teklifId} />}

        <button
          type="button"
          onClick={() => window.print()}
          className="inline-flex items-center gap-1.5 rounded-md border border-border bg-secondary px-3 py-2 text-xs font-semibold hover:bg-secondary/70"
        >
          <Printer className="h-3.5 w-3.5" /> Print
        </button>
      </div>

      <Dialog open={!!decideOpen} onOpenChange={(o) => !o && setDecideOpen(null)}>
        <DialogContent className="md:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {decideOpen === "tesdiq" ? "Təklifi təsdiqlə" : "Təklifi rədd et"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="qerar_qeyd">Qeyd ({decideOpen === "tesdiq" ? "opsional" : "tövsiyyə olunur"})</Label>
            <textarea
              id="qerar_qeyd"
              value={qeyd}
              onChange={(e) => setQeyd(e.target.value)}
              rows={3}
              maxLength={2000}
              placeholder={
                decideOpen === "tesdiq"
                  ? "Təsdiq səbəbi və ya əlavə təlimat"
                  : "Niyə rədd edirsiniz? Əməkdaş bunu görəcək"
              }
              className="flex w-full rounded-md border border-input bg-background px-3 py-1.5 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            />
          </div>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => setDecideOpen(null)} disabled={pending}>
              İmtina
            </Button>
            <Button
              type="button"
              onClick={decide}
              disabled={pending}
              className={
                decideOpen === "tesdiq"
                  ? "bg-emerald-600 hover:bg-emerald-700"
                  : "bg-rose-600 hover:bg-rose-700"
              }
            >
              {pending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {decideOpen === "tesdiq" ? "Təsdiqlə" : "Rədd et"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

function ConvertToOrderButton({ teklifId }: { teklifId: number }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function convert() {
    if (!confirm("Bu təklifi alış qaiməsinə çevirməyi təsdiq edirsiniz?")) return;
    const fd = new FormData();
    fd.set("id", String(teklifId));
    startTransition(async () => {
      const res = await convertProposalToPurchaseOrder(fd);
      if (!res.ok) toast.error(res.error);
      else {
        toast.success(`Alış qaiməsi yaradıldı: ${res.data.nomre}`);
        router.push(`/ticaret/alis`);
      }
    });
  }

  return (
    <Button
      type="button"
      onClick={convert}
      disabled={pending}
      className="bg-emerald-600 font-semibold text-white hover:bg-emerald-700"
    >
      {pending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <ShoppingCart className="mr-2 h-4 w-4" />}
      Alış qaiməsinə çevir
    </Button>
  );
}
