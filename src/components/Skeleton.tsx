// Pulsing skeleton loader for content that's still loading.
export function Skeleton({
  className = "",
  width,
  height,
}: {
  className?: string;
  width?: string;
  height?: string;
}) {
  const style = {
    width,
    height,
  };

  return (
    <span
      className={`inline-block animate-pulse rounded-md bg-muted/30 ${className}`}
      style={style}
      aria-hidden="true"
    />
  );
}

export function TableRowSkeleton({ cols }: { cols: number }) {
  return (
    <tr>
      {Array.from({ length: cols }).map((_, i) => (
        <td key={i} className="py-3">
          <Skeleton height="1rem" width={i === 0 ? "60%" : "80%"} />
        </td>
      ))}
    </tr>
  );
}
