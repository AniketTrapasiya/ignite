export default function DashboardLoading() {
  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6 animate-pulse">
      {/* Header skeleton */}
      <div className="flex items-center justify-between">
        <div className="space-y-2">
          <div className="h-7 w-48 rounded-xl bg-white/[0.06]" />
          <div className="h-4 w-64 rounded-xl bg-white/4" />
        </div>
        <div className="h-9 w-28 rounded-xl bg-white/[0.06]" />
      </div>

      {/* Stats grid skeleton */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="rounded-2xl p-4 h-20 bg-white/4" />
        ))}
      </div>

      {/* Content skeletons */}
      <div className="space-y-3">
        {[1, 2, 3, 4, 5].map((i) => (
          <div key={i} className="rounded-xl p-4 h-16 bg-white/3" />
        ))}
      </div>
    </div>
  );
}
