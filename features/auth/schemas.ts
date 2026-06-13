import { z } from "zod";

export const SignupSchema = z
  .object({
    sirket_adi: z.string().trim().min(2, "Şirkət adı ən az 2 simvol").max(150),
    // .trim() validasiyadan əvvəl — boşluqlu email/paste qeydiyyatı pozmasın.
    email: z.string().trim().email("Email düzgün deyil").max(150),
    telefon: z.string().trim().min(7, "Telefon düzgün deyil").max(30),
    sifre: z.string().min(6, "Şifrə ən az 6 simvol").max(100),
    sifre_tekrar: z.string(),
    biznes_novu: z.string().min(2).max(50).optional().or(z.literal("")),
    magaza_sayi: z.string().max(20).optional().or(z.literal("")),
    isci_sayi: z.string().max(20).optional().or(z.literal("")),
    seher: z.string().max(80).optional().or(z.literal("")),
    razilashma: z.literal("on", { message: "Razılaşmanı qəbul edin" }),
  })
  .refine((d) => d.sifre === d.sifre_tekrar, {
    message: "Şifrələr uyğun gəlmir",
    path: ["sifre_tekrar"],
  });

export type SignupInput = z.infer<typeof SignupSchema>;
