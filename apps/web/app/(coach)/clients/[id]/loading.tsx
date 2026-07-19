export default function ClientProfileLoading() {
  return (
    <div className="max-w-4xl mx-auto p-6 space-y-6">
      {/* Header skeleton */}
      <div className="h-8 bg-gray-200 rounded w-48 animate-pulse" />
      <div className="h-4 bg-gray-200 rounded w-32 animate-pulse" />

      {/* Flash card skeleton */}
      <div className="border rounded-lg p-4 space-y-3">
        <div className="h-5 bg-gray-200 rounded w-24 animate-pulse" />
        <div className="h-20 bg-gray-200 rounded animate-pulse" />
      </div>

      {/* Log timeline skeleton */}
      <div className="border rounded-lg p-4 space-y-2">
        <div className="h-5 bg-gray-200 rounded w-32 animate-pulse" />
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="h-10 bg-gray-200 rounded animate-pulse" />
        ))}
      </div>
    </div>
  );
}
