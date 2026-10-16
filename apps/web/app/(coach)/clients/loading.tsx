import { Skeleton } from '../../../lib/design-system'

export default function ClientsLoading() {
  return (
    <div className="page-pad">
      <Skeleton w={200} h={28} style={{ marginBottom: 16 }} />
      <Skeleton h={40} style={{ marginBottom: 16 }} />
      {Array.from({ length: 6 }).map((_, i) => (
        <Skeleton key={i} h={56} style={{ marginBottom: 8 }} />
      ))}
    </div>
  )
}
