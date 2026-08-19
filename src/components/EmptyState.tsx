import React from "react";
import { LucideIcon, Inbox } from "lucide-react";

interface EmptyStateProps {
  icon?: LucideIcon;
  title: string;
  description?: string;
  actionText?: string;
  onAction?: () => void;
  actionIcon?: LucideIcon;
  compact?: boolean;
}

const EmptyState: React.FC<EmptyStateProps> = ({
  icon: Icon = Inbox,
  title,
  description,
  actionText,
  onAction,
  actionIcon: ActionIcon,
  compact = false
}) => {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        textAlign: "center",
        padding: compact ? "2rem 1rem" : "3.5rem 1.5rem",
        gap: "0.75rem",
        width: "100%"
      }}
      className="animate-fade"
    >
      <div
        style={{
          width: compact ? "42px" : "56px",
          height: compact ? "42px" : "56px",
          borderRadius: "50%",
          backgroundColor: "rgba(99, 102, 241, 0.08)",
          color: "var(--primary)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          marginBottom: "0.25rem"
        }}
      >
        <Icon size={compact ? 22 : 28} />
      </div>

      <div style={{ fontWeight: 700, fontSize: compact ? "0.95rem" : "1.1rem", color: "var(--text-primary)" }}>
        {title}
      </div>

      {description && (
        <p
          style={{
            fontSize: "0.85rem",
            color: "var(--text-muted)",
            maxWidth: "380px",
            margin: 0,
            lineHeight: 1.5
          }}
        >
          {description}
        </p>
      )}

      {actionText && onAction && (
        <button
          type="button"
          onClick={onAction}
          className="btn btn-primary btn-sm"
          style={{ marginTop: "0.5rem", gap: "0.35rem" }}
        >
          {ActionIcon && <ActionIcon size={15} />}
          <span>{actionText}</span>
        </button>
      )}
    </div>
  );
};

export default EmptyState;
