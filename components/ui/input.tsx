import * as React from "react"

import { cn } from "@/lib/utils"

/** Type → ən uyğun mobil inputMode. iOS/Android-da düzgün klaviatura açır. */
const TYPE_TO_INPUT_MODE: Record<string, React.HTMLAttributes<HTMLInputElement>["inputMode"]> = {
  number: "decimal",   // numeric pad + decimal (vergül/nöqtə)
  tel: "tel",          // telefon dial pad
  email: "email",      // @ + . üçün xüsusi key
  url: "url",          // / + . üçün xüsusi key
  search: "search",    // klaviatura return key "axtar"
}

function Input({ className, type, inputMode, ...props }: React.ComponentProps<"input">) {
  // Type-əsasli inputMode auto-əlavə (istifadəçi öz inputMode-u vermirsə)
  const effectiveInputMode =
    inputMode ?? (type ? TYPE_TO_INPUT_MODE[type] : undefined)

  return (
    <input
      type={type}
      inputMode={effectiveInputMode}
      data-slot="input"
      className={cn(
        // Mobile-da 44px touch target (Apple HIG/WCAG AA), desktop-da 36px
        "h-11 md:h-9 w-full min-w-0 rounded-md border border-input bg-transparent px-3 py-1 text-base shadow-xs transition-[color,box-shadow] outline-none selection:bg-primary selection:text-primary-foreground file:inline-flex file:h-7 file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground placeholder:text-muted-foreground disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 md:text-sm dark:bg-input/30",
        "focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50",
        "aria-invalid:border-destructive aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40",
        className
      )}
      {...props}
    />
  )
}

export { Input }
