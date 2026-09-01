import { font } from '../../../lib/design-system'

export default function DashboardLoading() {
  return (
    <div style={{ padding: '2rem', fontFamily: font.body }}>
      <p style={{ color: '#6c757d' }}>Loading dashboard...</p>
    </div>
  )
}
