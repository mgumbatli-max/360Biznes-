"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  GraduationCap,
  Languages,
  Sparkles,
  Award,
  Briefcase,
  Plus,
  Trash2,
  Loader2,
  Save,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { saveEmployeeExtras } from "../hr-actions";
import type {
  CertRow,
  EduRow,
  ExpRow,
  LangRow,
  SkillRow,
  ProfileExtras,
} from "../hr-types";

export function ProfileExtrasEditor({
  istifadeciId,
  initial,
}: {
  istifadeciId: string;
  initial: ProfileExtras;
}) {
  const router = useRouter();
  const [education, setEducation] = useState<EduRow[]>(initial.education);
  const [languages, setLanguages] = useState<LangRow[]>(initial.languages);
  const [skills, setSkills] = useState<SkillRow[]>(initial.skills);
  const [certs, setCerts] = useState<CertRow[]>(initial.certs);
  const [experience, setExperience] = useState<ExpRow[]>(initial.experience);
  const [pending, startTransition] = useTransition();

  function save() {
    startTransition(async () => {
      const res = await saveEmployeeExtras({
        istifadeci_id: istifadeciId,
        education,
        languages,
        skills,
        certs,
        experience,
      });
      if (res.ok) {
        toast.success("Profil yeniləndi");
        router.refresh();
      } else toast.error(res.error);
    });
  }

  return (
    <div className="space-y-4">
      {/* Education */}
      <Card className="glass">
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="text-xs uppercase tracking-wider text-muted-foreground inline-flex items-center gap-1.5">
            <GraduationCap className="h-3.5 w-3.5" /> Təhsil
          </CardTitle>
          <Button
            size="sm"
            variant="ghost"
            onClick={() =>
              setEducation([...education, { uni: "", ixtisas: "", derece: "bakalavr", il: "" }])
            }
          >
            <Plus className="h-3.5 w-3.5" /> Əlavə et
          </Button>
        </CardHeader>
        <CardContent className="space-y-2">
          {education.length === 0 && (
            <p className="text-xs text-muted-foreground">Hələ təhsil əlavə edilməyib.</p>
          )}
          {education.map((row, i) => (
            <div key={i} className="grid grid-cols-1 gap-2 rounded-md border border-border/40 p-2 md:grid-cols-5">
              <Input
                placeholder="Ali məktəb"
                value={row.uni}
                onChange={(e) =>
                  setEducation(
                    education.map((r, j) => (j === i ? { ...r, uni: e.target.value } : r)),
                  )
                }
                className="h-8 md:col-span-2"
              />
              <Input
                placeholder="İxtisas"
                value={row.ixtisas}
                onChange={(e) =>
                  setEducation(
                    education.map((r, j) => (j === i ? { ...r, ixtisas: e.target.value } : r)),
                  )
                }
                className="h-8"
              />
              <select
                className="h-8 rounded-md border border-border bg-card px-2 text-sm"
                value={row.derece}
                onChange={(e) =>
                  setEducation(
                    education.map((r, j) => (j === i ? { ...r, derece: e.target.value } : r)),
                  )
                }
              >
                <option value="bakalavr">Bakalavr</option>
                <option value="magistr">Magistr</option>
                <option value="doktor">Doktor</option>
                <option value="orta">Orta ixt.</option>
              </select>
              <div className="flex gap-2">
                <Input
                  placeholder="İl"
                  value={row.il}
                  onChange={(e) =>
                    setEducation(
                      education.map((r, j) => (j === i ? { ...r, il: e.target.value } : r)),
                    )
                  }
                  className="h-8"
                />
                <Button
                  size="icon-sm"
                  variant="ghost"
                  onClick={() => setEducation(education.filter((_, j) => j !== i))}
                  title="Sil"
                >
                  <Trash2 className="h-3.5 w-3.5 text-danger" />
                </Button>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Languages */}
      <Card className="glass">
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="text-xs uppercase tracking-wider text-muted-foreground inline-flex items-center gap-1.5">
            <Languages className="h-3.5 w-3.5" /> Dillər
          </CardTitle>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => setLanguages([...languages, { lang: "", level: "B1" }])}
          >
            <Plus className="h-3.5 w-3.5" /> Əlavə et
          </Button>
        </CardHeader>
        <CardContent className="space-y-2">
          {languages.length === 0 && (
            <p className="text-xs text-muted-foreground">Dil əlavə edilməyib.</p>
          )}
          {languages.map((row, i) => (
            <div key={i} className="flex gap-2">
              <Input
                placeholder="Dil (Azərbaycan, İngilis, ...)"
                value={row.lang}
                onChange={(e) =>
                  setLanguages(
                    languages.map((r, j) => (j === i ? { ...r, lang: e.target.value } : r)),
                  )
                }
                className="h-8 flex-1"
              />
              <select
                className="h-8 rounded-md border border-border bg-card px-2 text-sm"
                value={row.level}
                onChange={(e) =>
                  setLanguages(
                    languages.map((r, j) => (j === i ? { ...r, level: e.target.value } : r)),
                  )
                }
              >
                {["A1", "A2", "B1", "B2", "C1", "C2", "Ana dili"].map((v) => (
                  <option key={v} value={v}>
                    {v}
                  </option>
                ))}
              </select>
              <Button
                size="icon-sm"
                variant="ghost"
                onClick={() => setLanguages(languages.filter((_, j) => j !== i))}
              >
                <Trash2 className="h-3.5 w-3.5 text-danger" />
              </Button>
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Skills */}
      <Card className="glass">
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="text-xs uppercase tracking-wider text-muted-foreground inline-flex items-center gap-1.5">
            <Sparkles className="h-3.5 w-3.5" /> Bacarıqlar
          </CardTitle>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => setSkills([...skills, { name: "", level: 3 }])}
          >
            <Plus className="h-3.5 w-3.5" /> Əlavə et
          </Button>
        </CardHeader>
        <CardContent className="space-y-2">
          {skills.length === 0 && (
            <p className="text-xs text-muted-foreground">Bacarıq əlavə edilməyib.</p>
          )}
          {skills.length > 0 && (
            <div className="mb-2 flex flex-wrap gap-1.5">
              {skills.map((s, i) => (
                <Badge
                  key={i}
                  variant="outline"
                  className="text-[10.5px]"
                  style={{
                    borderColor: levelColor(s.level),
                    color: levelColor(s.level),
                  }}
                >
                  {s.name || "—"} · {s.level}/5
                </Badge>
              ))}
            </div>
          )}
          {skills.map((row, i) => (
            <div key={i} className="flex gap-2">
              <Input
                placeholder="Excel, 1C, SQL, Liderlik, ..."
                value={row.name}
                onChange={(e) =>
                  setSkills(
                    skills.map((r, j) => (j === i ? { ...r, name: e.target.value } : r)),
                  )
                }
                className="h-8 flex-1"
              />
              <select
                className="h-8 rounded-md border border-border bg-card px-2 text-sm"
                value={row.level}
                onChange={(e) =>
                  setSkills(
                    skills.map((r, j) =>
                      j === i ? { ...r, level: Number(e.target.value) } : r,
                    ),
                  )
                }
              >
                {[1, 2, 3, 4, 5].map((v) => (
                  <option key={v} value={v}>
                    {v}/5
                  </option>
                ))}
              </select>
              <Button
                size="icon-sm"
                variant="ghost"
                onClick={() => setSkills(skills.filter((_, j) => j !== i))}
              >
                <Trash2 className="h-3.5 w-3.5 text-danger" />
              </Button>
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Certs */}
      <Card className="glass">
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="text-xs uppercase tracking-wider text-muted-foreground inline-flex items-center gap-1.5">
            <Award className="h-3.5 w-3.5" /> Sertifikatlar
          </CardTitle>
          <Button
            size="sm"
            variant="ghost"
            onClick={() =>
              setCerts([...certs, { ad: "", verən: "", tarix: "", bitme: "" }])
            }
          >
            <Plus className="h-3.5 w-3.5" /> Əlavə et
          </Button>
        </CardHeader>
        <CardContent className="space-y-2">
          {certs.length === 0 && (
            <p className="text-xs text-muted-foreground">Sertifikat əlavə edilməyib.</p>
          )}
          {certs.map((row, i) => (
            <div
              key={i}
              className="grid grid-cols-1 gap-2 rounded-md border border-border/40 p-2 md:grid-cols-5"
            >
              <Input
                placeholder="Sertifikat adı"
                value={row.ad}
                onChange={(e) =>
                  setCerts(certs.map((r, j) => (j === i ? { ...r, ad: e.target.value } : r)))
                }
                className="h-8 md:col-span-2"
              />
              <Input
                placeholder="Verən təşkilat"
                value={row.verən}
                onChange={(e) =>
                  setCerts(
                    certs.map((r, j) => (j === i ? { ...r, verən: e.target.value } : r)),
                  )
                }
                className="h-8"
              />
              <Input
                type="date"
                value={row.tarix}
                onChange={(e) =>
                  setCerts(
                    certs.map((r, j) => (j === i ? { ...r, tarix: e.target.value } : r)),
                  )
                }
                className="h-8"
              />
              <div className="flex gap-1">
                <Input
                  type="date"
                  value={row.bitme}
                  onChange={(e) =>
                    setCerts(
                      certs.map((r, j) => (j === i ? { ...r, bitme: e.target.value } : r)),
                    )
                  }
                  className="h-8"
                  placeholder="Bitmə"
                />
                <Button
                  size="icon-sm"
                  variant="ghost"
                  onClick={() => setCerts(certs.filter((_, j) => j !== i))}
                >
                  <Trash2 className="h-3.5 w-3.5 text-danger" />
                </Button>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Experience */}
      <Card className="glass">
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="text-xs uppercase tracking-wider text-muted-foreground inline-flex items-center gap-1.5">
            <Briefcase className="h-3.5 w-3.5" /> İş təcrübəsi
          </CardTitle>
          <Button
            size="sm"
            variant="ghost"
            onClick={() =>
              setExperience([
                ...experience,
                { sirket: "", vezife: "", tarix: "", sebeb: "" },
              ])
            }
          >
            <Plus className="h-3.5 w-3.5" /> Əlavə et
          </Button>
        </CardHeader>
        <CardContent className="space-y-2">
          {experience.length === 0 && (
            <p className="text-xs text-muted-foreground">Əvvəlki iş yeri əlavə edilməyib.</p>
          )}
          {experience.map((row, i) => (
            <div
              key={i}
              className="grid grid-cols-1 gap-2 rounded-md border border-border/40 p-2 md:grid-cols-5"
            >
              <Input
                placeholder="Şirkət"
                value={row.sirket}
                onChange={(e) =>
                  setExperience(
                    experience.map((r, j) =>
                      j === i ? { ...r, sirket: e.target.value } : r,
                    ),
                  )
                }
                className="h-8"
              />
              <Input
                placeholder="Vəzifə"
                value={row.vezife}
                onChange={(e) =>
                  setExperience(
                    experience.map((r, j) =>
                      j === i ? { ...r, vezife: e.target.value } : r,
                    ),
                  )
                }
                className="h-8"
              />
              <Input
                placeholder="2018–2022"
                value={row.tarix}
                onChange={(e) =>
                  setExperience(
                    experience.map((r, j) =>
                      j === i ? { ...r, tarix: e.target.value } : r,
                    ),
                  )
                }
                className="h-8"
              />
              <Input
                placeholder="Ayrılma səbəbi"
                value={row.sebeb}
                onChange={(e) =>
                  setExperience(
                    experience.map((r, j) =>
                      j === i ? { ...r, sebeb: e.target.value } : r,
                    ),
                  )
                }
                className="h-8 md:col-span-1"
              />
              <Button
                size="icon-sm"
                variant="ghost"
                onClick={() => setExperience(experience.filter((_, j) => j !== i))}
              >
                <Trash2 className="h-3.5 w-3.5 text-danger" />
              </Button>
            </div>
          ))}
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button onClick={save} disabled={pending}>
          {pending ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Save className="h-4 w-4" />
          )}{" "}
          Yadda saxla
        </Button>
      </div>
    </div>
  );
}

function levelColor(level: number): string {
  if (level >= 5) return "#10b981";
  if (level >= 4) return "#34d399";
  if (level >= 3) return "#f59e0b";
  if (level >= 2) return "#f87171";
  return "#ef4444";
}
