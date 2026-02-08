"use client";

import type { ReactNode } from "react";

interface DashboardCardProps {
  title: string;
  children: ReactNode;
  isDragMode?: boolean;
}

export default function DashboardCard({
  title,
  children,
  isDragMode = false,
}: DashboardCardProps) {
  return (
    <div
      style={{
        background: "var(--card-bg)",
        borderRadius: "var(--card-radius)",
        border: "var(--card-border)",
        padding: "var(--card-padding)",
        boxShadow: "var(--card-shadow)",
        height: "100%",
        overflow: "hidden",
        display: "flex",
        flexDirection: "column",
        position: "relative",
        cursor: isDragMode ? "grab" : undefined,
        animation: isDragMode ? "widgetWiggle 0.3s ease-in-out infinite alternate" : undefined,
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
      </div>
      <div style={{ flex: 1, overflowY: isDragMode ? "hidden" : "auto", minHeight: 0 }}>
        {children}
      </div>

      {/* Drag-mode overlay blocks all interaction with widget content */}
      {isDragMode && (
        <div
          style={{
            position: "absolute",
            inset: 0,
            borderRadius: "var(--card-radius)",
            background: "rgba(128, 128, 128, 0.08)",
          }}
        />
      )}
    </div>
  );
}
