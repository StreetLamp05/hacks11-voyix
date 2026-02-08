"use client";

import type { ReactNode } from "react";

interface DashboardCardProps {
  title: string;
  children: ReactNode;
  isEditing?: boolean;
  dragHandleSlot?: ReactNode;
}

export default function DashboardCard({
  title,
  children,
  isEditing = false,
  dragHandleSlot,
}: DashboardCardProps) {
  return (
    <div
      style={{
        background: isEditing
          ? "var(--card-edit-bg)"
          : "var(--card-bg)",
        borderRadius: "var(--card-radius)",
        border: isEditing
          ? "var(--card-edit-border)"
          : "var(--card-border)",
        padding: "var(--card-padding)",
        boxShadow: "var(--card-shadow)",
        height: "100%",
        overflow: "hidden",
        display: "flex",
        flexDirection: "column",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: "0.75rem",
          flexShrink: 0,
        }}
      >
        <h3
          style={{
            fontSize: "var(--card-header-size)",
            fontWeight: "var(--card-header-weight)" as never,
            color: "var(--card-header-color)",
            margin: 0,
          }}
        >
          {title}
        </h3>
        {dragHandleSlot}
      </div>
      <div style={{ flex: 1, overflowY: "auto", minHeight: 0 }}>
        {children}
      </div>
    </div>
  );
}
