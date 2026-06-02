"use client";

import { useState } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CheckSquare, Lock, Eye } from "lucide-react";
import { RolePermissionsMatrix } from "./role-permissions-matrix";
import { RolePreviewPanel } from "./role-preview-panel";

type Perm = { id: number; kod: string; ad: string; aciqlamaq: string | null };
type Group = { qrup: string; items: Perm[] };

export function RoleEditor({
  rolId,
  isSystem,
  initialIds,
  groups,
}: {
  rolId: number;
  isSystem: boolean;
  initialIds: number[];
  groups: Group[];
}) {
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set(initialIds));
  const [previewOpen, setPreviewOpen] = useState(true);

  return (
    <>
      <Card className="glass">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <CheckSquare className="h-4 w-4 text-primary" /> İcazə matrisi
            {isSystem ? (
              <Badge variant="outline" className="ml-2 text-[10px] text-amber-500 border-amber-500/40">
                <Lock className="mr-0.5 h-2.5 w-2.5" /> Yalnız oxuma
              </Badge>
            ) : (
              <Badge variant="outline" className="ml-2 text-[10px] text-emerald-500 border-emerald-500/40">
                Redaktə oluna bilər
              </Badge>
            )}
          </CardTitle>
          <p className="text-xs text-muted-foreground">
            Bu roldakı işçilərin sistemin hansı bölmələrini görüb dəyişdirə bildiyini buradan seç. Saxla basanda dərhal təsir göstərir.
          </p>
        </CardHeader>
        <CardContent>
          <RolePermissionsMatrix
            rolId={rolId}
            isSystem={isSystem}
            initialIds={initialIds}
            groups={groups}
            onSelectionChange={setSelectedIds}
          />
        </CardContent>
      </Card>

      {/* Canlı önizləmə paneli — kolapsla bağlana bilir */}
      <Card className="glass">
        <CardHeader
          className="cursor-pointer transition-colors hover:bg-secondary/30"
          onClick={() => setPreviewOpen((v) => !v)}
        >
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2 text-base">
              <Eye className="h-4 w-4 text-primary" /> Bu rolla işçi nə görəcək?
              <Badge variant="outline" className="ml-1 h-5 text-[10px]">
                {selectedIds.size} icazə
              </Badge>
            </CardTitle>
            <Button size="sm" variant="ghost" className="-mr-2">
              {previewOpen ? (
                <>
                  <ChevronUp className="h-3.5 w-3.5" /> Gizlət
                </>
              ) : (
                <>
                  <ChevronDown className="h-3.5 w-3.5" /> Göstər
                </>
              )}
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            Yuxarıdakı tikləri dəyişdikcə bu panel canlı yenilənir — sahibkar görəcək ki, bu rola sahib əməkdaş sistemdə nəyi açıb-bağlaya bilər.
          </p>
        </CardHeader>
        {previewOpen && (
          <CardContent>
            <RolePreviewPanel rolId={rolId} selectedIds={selectedIds} groups={groups} />
          </CardContent>
        )}
      </Card>
    </>
  );
}
