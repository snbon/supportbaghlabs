/** Streaming fallback shown while dashboard data loads. */
export default function DashboardSkeleton() {
  return (
    <div className="min-h-screen bg-background flex flex-col" aria-busy="true" aria-label="Loading dashboard">
      <header className="sticky top-0 z-20 bg-card/95 border-b border-border/60">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg bg-muted animate-pulse" />
            <div className="h-3.5 w-28 rounded bg-muted animate-pulse" />
          </div>
          <div className="h-7 w-7 rounded-full bg-muted animate-pulse" />
        </div>
      </header>
      <main className="flex-1 max-w-5xl w-full mx-auto px-4 sm:px-6 py-6 space-y-6">
        <div className="grid grid-cols-3 gap-3">
          {[0, 1, 2].map((i) => (
            <div key={i} className="bg-card border border-border/60 rounded-2xl px-4 py-4 space-y-3">
              <div className="h-2.5 w-12 rounded bg-muted animate-pulse" />
              <div className="h-7 w-10 rounded bg-muted animate-pulse" />
            </div>
          ))}
        </div>
        <div className="flex flex-col lg:flex-row gap-5">
          <div className="w-full lg:w-80 h-72 bg-card border border-border/60 rounded-2xl animate-pulse" />
          <div className="w-full h-72 bg-card border border-border/60 rounded-2xl animate-pulse" />
        </div>
      </main>
    </div>
  );
}
