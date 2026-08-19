import React from "react";

export const Skeleton: React.FC<{
  width?: string | number;
  height?: string | number;
  borderRadius?: string | number;
  className?: string;
  style?: React.CSSProperties;
}> = ({ width = "100%", height = "1rem", borderRadius = "var(--radius-sm)", className = "", style = {} }) => {
  return (
    <div
      className={`skeleton ${className}`}
      style={{
        width: typeof width === "number" ? `${width}px` : width,
        height: typeof height === "number" ? `${height}px` : height,
        borderRadius: typeof borderRadius === "number" ? `${borderRadius}px` : borderRadius,
        ...style
      }}
    />
  );
};

export const SkeletonCard: React.FC<{ height?: number }> = ({ height = 120 }) => {
  return (
    <div className="card" style={{ minHeight: `${height}px`, display: "flex", flexDirection: "column", gap: "0.75rem" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <Skeleton width="40%" height={14} />
        <Skeleton width={32} height={32} borderRadius="50%" />
      </div>
      <Skeleton width="65%" height={24} />
      <Skeleton width="80%" height={12} style={{ marginTop: "auto" }} />
    </div>
  );
};

export const SkeletonTable: React.FC<{ rows?: number; columns?: number }> = ({ rows = 5, columns = 5 }) => {
  return (
    <div className="table-container" style={{ border: "none" }}>
      <table className="table">
        <thead>
          <tr>
            {Array.from({ length: columns }).map((_, i) => (
              <th key={i}>
                <Skeleton width="70%" height={14} />
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {Array.from({ length: rows }).map((_, r) => (
            <tr key={r}>
              {Array.from({ length: columns }).map((_, c) => (
                <td key={c}>
                  <Skeleton width={c === 0 ? "80%" : c === columns - 1 ? "40%" : "60%"} height={16} />
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

export default Skeleton;
