"use client";

import { useTransition } from "react";
import { signOut } from "next-auth/react";
import { useRouter } from "next/navigation";
import { LogOut, Settings, User, BadgeCheck, ChevronDown } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import type { SessionUser } from "@/lib/auth/types";

type Props = {
  user: SessionUser;
};

export function UserMenu({ user }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const initials = (user.ad_soyad || user.email)
    .split(/\s+/)
    .map((s) => s[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  function handleLogout() {
    startTransition(async () => {
      await signOut({ redirect: false });
      router.push("/login");
      router.refresh();
    });
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className="flex items-center gap-2 rounded-md px-1.5 py-1 transition hover:bg-secondary"
          aria-label="İstifadəçi menyusu"
        >
          <Avatar className="h-8 w-8 border border-border/60">
            <AvatarFallback className="bg-secondary text-xs font-semibold text-foreground">
              {initials}
            </AvatarFallback>
          </Avatar>
          <div className="hidden text-left sm:block">
            <div className="text-sm font-medium leading-tight">{user.ad_soyad}</div>
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
              {user.rol_ad || "—"}
            </div>
          </div>
          <ChevronDown className="hidden h-3.5 w-3.5 text-muted-foreground sm:block" />
        </button>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end" className="w-72">
        <DropdownMenuLabel className="font-normal">
          <div className="flex flex-col gap-1">
            <div className="flex items-center gap-2">
              <span className="font-semibold">{user.ad_soyad}</span>
              {user.rol_id === 9 && (
                <Badge variant="secondary" className="h-5 text-[10px]">
                  <BadgeCheck className="h-3 w-3" />
                  Sahibkar
                </Badge>
              )}
            </div>
            <span className="text-xs text-muted-foreground">{user.email}</span>
          </div>
        </DropdownMenuLabel>

        <DropdownMenuSeparator />

        <div className="px-2 py-1.5 text-xs text-muted-foreground">
          <div className="flex items-center justify-between">
            <span>Şirkət</span>
            <span className="font-medium text-foreground">{user.sahibkar_ad}</span>
          </div>
          <div className="mt-1 flex items-center justify-between">
            <span>Plan</span>
            <span className="font-medium text-foreground">
              {user.plan_ad ?? "—"}{" "}
              {user.abune_status === "aktiv" && (
                <span className="text-success">·</span>
              )}
            </span>
          </div>
          {user.abune_bitme && (
            <div className="mt-1 flex items-center justify-between">
              <span>Bitir</span>
              <span className="font-medium text-foreground">
                {new Date(user.abune_bitme).toLocaleDateString("az-AZ")}
              </span>
            </div>
          )}
        </div>

        <DropdownMenuSeparator />

        <DropdownMenuItem onSelect={() => router.push("/ayarlar/hesab")}>
          <User className="h-4 w-4" />
          Profilim
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={() => router.push("/ayarlar")}>
          <Settings className="h-4 w-4" />
          Ayarlar
        </DropdownMenuItem>

        <DropdownMenuSeparator />

        <DropdownMenuItem
          variant="destructive"
          onSelect={(e) => {
            e.preventDefault();
            handleLogout();
          }}
          disabled={pending}
        >
          <LogOut className="h-4 w-4" />
          Çıxış
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
