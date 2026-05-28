export default function MarketPosLoading() {
  return (
    <div className="flex h-full w-full">
      <div className="flex flex-1 flex-col">
        <div className="border-b border-border/40 p-3">
          <div className="h-8 w-1/3 animate-pulse rounded-md bg-secondary/40" />
        </div>
        <div className="grid flex-1 grid-cols-4 gap-2 p-3">
          {Array.from({ length: 16 }).map((_, i) => (
            <div key={i} className="h-24 animate-pulse rounded-md bg-secondary/30" />
          ))}
        </div>
      </div>
    </div>
  );
}
