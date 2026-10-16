import { Skeleton, T } from '../../../../lib/design-system'

export default function ClientProfileLoading() {
  const panel = { border: `1px solid ${T.border}`, borderRadius: 2, padding: 16 }
  return (
    <div className="page-pad">
      <Skeleton w={220} h={28} style={{ marginBottom: 10 }} />
      <Skeleton w={140} h={14} style={{ marginBottom: 20 }} />

      <div style={{ ...panel, marginBottom: 20 }}>
        <Skeleton w={100} h={18} style={{ marginBottom: 12 }} />
        <Skeleton h={80} />
      </div>

      <div style={panel}>
        <Skeleton w={130} h={18} style={{ marginBottom: 10 }} />
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} h={40} style={{ marginBottom: 8 }} />
        ))}
      </div>
    </div>
  )
}
