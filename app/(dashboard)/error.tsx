"use client";

import { useEffect } from "react";
import { AlertTriangle, RefreshCw, Home } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[dashboard-error]", error);
  }, [error]);

  return (
    <div className="mx-auto max-w-2xl px-4 py-10">
      <Alert variant="destructive">
        <AlertTriangle className="h-4 w-4" />
        <AlertTitle>Səhifə yüklənmədi</AlertTitle>
        <AlertDescription className="space-y-3">
          <p>
            Bu bölmə açılarkən nasazlıq baş verdi. Yenidən cəhd edin, sonra problem qalırsa
            administratora bildirin.
          </p>
          {process.env.NODE_ENV !== "production" && (
            <pre className="overflow-x-auto rounded-md bg-rose-950/30 p-2 text-[11px]">
              {error.message}
            </pre>
          )}
          {error.digest && (
            <p className="text-[11px] opacity-70">Xəta kodu: {error.digest}</p>
          )}
          <div className="flex gap-2 pt-1">
            <Button onClick={reset} size="sm" variant="default">
              <RefreshCw className="h-3.5 w-3.5" />
              Yenidən cəhd et
            </Button>
            <Button asChild size="sm" variant="outline">
              <a href="/">
                <Home className="h-3.5 w-3.5" />
                Ana səhifə
              </a>
            </Button>
          </div>
        </AlertDescription>
      </Alert>
    </div>
  );
}
