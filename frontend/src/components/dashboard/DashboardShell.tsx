"use client";

import { useState } from "react";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  sortableKeyboardCoordinates,
  rectSortingStrategy,
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { useDashboardLayout } from "@/lib/hooks/useDashboardLayout";
import { WIDGET_MAP } from "@/lib/constants/widget-registry";
import type { WidgetId, WidgetSize } from "@/lib/types/dashboard";
import DashboardCard from "./DashboardCard";
import WidgetPickerModal from "./WidgetPickerModal";

/* ── wiggle keyframes (injected once) ── */
const WIGGLE_CSS = `@keyframes widgetWiggle {
  0%   { transform: rotate(-0.5deg); }
  100% { transform: rotate(0.5deg); }
}`;

interface DashboardShellProps {
  restaurantId: number;
  restaurantName: string;
}

function sizeToSpans(size: WidgetSize): { colSpan: number; rowSpan: number } {
  const [c, r] = size.split("x").map(Number);
  return { colSpan: c, rowSpan: r };
}

function SortableWidget({
  widgetId,
  restaurantId,
  isDragMode,
}: {
  widgetId: WidgetId;
  restaurantId: number;
  isDragMode: boolean;
}) {
  const entry = WIDGET_MAP.get(widgetId);
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: widgetId, disabled: !isDragMode });

  if (!entry) return null;

  const Widget = entry.component;
  const { colSpan, rowSpan } = sizeToSpans(entry.defaultSize);

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    gridColumn: `span ${colSpan}`,
    gridRow: `span ${rowSpan}`,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...(isDragMode ? { ...attributes, ...listeners } : {})}
    >
      <DashboardCard title={entry.label} isDragMode={isDragMode}>
        <Widget restaurantId={restaurantId} />
      </DashboardCard>
    </div>
  );
}

/* ── Icon components ── */

function GridIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="currentColor">
      <rect x="1" y="1" width="7" height="7" rx="1.5" />
      <rect x="10" y="1" width="7" height="7" rx="1.5" />
      <rect x="1" y="10" width="7" height="7" rx="1.5" />
      <rect x="10" y="10" width="7" height="7" rx="1.5" />
    </svg>
  );
}

function MoveIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 1v16M1 9h16M9 1l-3 3M9 1l3 3M9 17l-3-3M9 17l3-3M1 9l3-3M1 9l3 3M17 9l-3-3M17 9l-3 3" />
    </svg>
  );
}

export default function DashboardShell({
  restaurantId,
  restaurantName,
}: DashboardShellProps) {
  const {
    visibleWidgetIds,
    toggleWidget,
    reorderWidgets,
    resetLayout,
  } = useDashboardLayout(restaurantId);

  const [isPickerOpen, setIsPickerOpen] = useState(false);
  const [isDragMode, setIsDragMode] = useState(false);

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIdx = visibleWidgetIds.indexOf(active.id as WidgetId);
    const newIdx = visibleWidgetIds.indexOf(over.id as WidgetId);
    if (oldIdx === -1 || newIdx === -1) return;

    const updated = [...visibleWidgetIds];
    updated.splice(oldIdx, 1);
    updated.splice(newIdx, 0, active.id as WidgetId);
    reorderWidgets(updated);
  }

  const iconBtnStyle: React.CSSProperties = {
    background: "var(--btn-bg)",
    color: "var(--btn-color)",
    border: "none",
    borderRadius: "var(--btn-radius)",
    padding: "0.5rem",
    cursor: "pointer",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  };

  return (
    <>
      {/* Inject wiggle animation */}
      <style>{WIGGLE_CSS}</style>

      <div style={{ padding: "1rem", paddingBottom: "6rem", maxWidth: 1400, margin: "0 auto" }}>
        {/* Header */}
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: "1.5rem",
          }}
        >
          <div>
            <h1 style={{ fontSize: "1.75rem", fontWeight: 700, margin: 0 }}>
              {restaurantName}
            </h1>
            <p style={{ color: "var(--chart-text)", margin: "0.25rem 0 0", fontSize: "0.85rem" }}>
              Dashboard
            </p>
          </div>

          <div style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
            {/* Widget picker */}
            <button
              onClick={() => setIsPickerOpen(true)}
              aria-label="Choose widgets"
              title="Choose widgets"
              style={iconBtnStyle}
            >
              <GridIcon />
            </button>

            {/* Drag mode toggle */}
            <button
              onClick={() => setIsDragMode((d) => !d)}
              aria-label={isDragMode ? "Done rearranging" : "Rearrange widgets"}
              title={isDragMode ? "Done rearranging" : "Rearrange widgets"}
              style={{
                ...iconBtnStyle,
                background: isDragMode ? "var(--color-success)" : "var(--btn-bg)",
              }}
            >
              <MoveIcon />
            </button>
          </div>
        </div>

        {/* Grid */}
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={handleDragEnd}
        >
          <SortableContext
            items={visibleWidgetIds}
            strategy={rectSortingStrategy}
          >
            <div
              style={{
                display: "grid",
                gridTemplateColumns:
                  "repeat(auto-fill, minmax(max(160px, calc(20% - 1rem)), 1fr))",
                gridAutoRows: 180,
                gap: "1rem",
              }}
            >
              {visibleWidgetIds.map((id) => (
                <SortableWidget
                  key={id}
                  widgetId={id}
                  restaurantId={restaurantId}
                  isDragMode={isDragMode}
                />
              ))}
            </div>
          </SortableContext>
        </DndContext>
      </div>

      {/* Widget picker modal */}
      {isPickerOpen && (
        <WidgetPickerModal
          visibleWidgetIds={visibleWidgetIds}
          onToggle={toggleWidget}
          onReset={resetLayout}
          onClose={() => setIsPickerOpen(false)}
        />
      )}
    </>
  );
}
