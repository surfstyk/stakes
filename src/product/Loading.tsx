// Tiny shared loading state for screens that now fetch their challenge from /api.
export function Loading() {
  return (
    <div className="s-center" style={{ paddingTop: 64 }}>
      <span className="s-spin" role="status" aria-label="Loading" />
    </div>
  )
}
