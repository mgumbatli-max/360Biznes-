export default function PosLoading() {
  return (
    <div className="flex h-full w-full">
      <aside className="flex w-72 flex-col gap-2 border-r border-border/40 bg-card/30 p-3">
        <div className="h-9 animate-pulse rounded-md bg-secondary/40" />
        <div className="grid grid-cols-3 gap-2">
          {Array.from({ length: 12 }).map((_, i) => (
            <div key={i} className="h-20 animate-pulse rounded-md bg-secondary/40" />
          ))}
        </div>
      </aside>
      <main className="flex flex-1 flex-col">
        <div className="border-b border-border/40 bg-card/20 p-3">
          <div className="h-8 w-1/3 animate-pulse rounded-md bg-secondary/40" />
        </div>
        <div className="flex-1 space-y-2 p-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-14 animate-pulse rounded-md bg-secondary/30" />
          ))}
        </div>
        <div className="border-t border-border/40 bg-card/20 p-3">
          <div className="h-10 w-full animate-pulse rounded-md bg-secondary/40" />
        </div>
      </main>
    </div>
  );
}
