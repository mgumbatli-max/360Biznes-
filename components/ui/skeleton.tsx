import { cn } from "@/lib/utils"

/**
 * Skeleton — yumşaq subtle gray pulse.
 * Əvvəl `bg-accent` (purple/violet) istifadə edirdi — naviqasiyada parlaq
 * bənövşəyi flash yaradırdı. İndi `bg-muted/60` ilə neytral muted gray.
 */
function Skeleton({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="skeleton"
      className={cn("animate-pulse rounded-md bg-muted/60", className)}
      {...props}
    />
  )
}

export { Skeleton }
