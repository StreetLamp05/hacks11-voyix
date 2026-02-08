"use client";

import React from "react";

type Props = {
  active?: string;
  onSelect?: (tab: string) => void;
};

const Sidebar: React.FC<Props> = ({ active = "dashboard", onSelect }) => {
  const navItem = (key: string, label: string, icon = "▦") => {
    const isActive = active === key;
    return (
      <button
        type="button"
        onClick={() => onSelect?.(key)}
        className={`nav-item ${isActive ? "active" : ""}`}
        aria-current={isActive ? "page" : undefined}
        style={{ width: "100%", textAlign: "left" }}
      >
        <span className="icon" aria-hidden>
          {icon}
        </span>
        <span className="label">{label}</span>
      </button>
    );
  };

  return (
    <div className="h-screen bg-white border-r shadow-sm">
      <div className="p-6 flex flex-col h-full">
        <div className="flex items-center gap-3 mb-8">
          <img
            src="/fcx_logo.png"
            alt="Foodix logo"
            className="w-14 h-14 rounded-full object-cover shadow-sm"
            onError={(e) => {
              // degrade gracefully if image missing
              const el = e.target as HTMLImageElement;
              el.style.display = "none";
            }}
          />

          <div>
            <div className="font-semibold text-lg">Foodix</div>
            <div className="text-sm text-gray-500">Ingredient Analytics</div>
          </div>
        </div>

        <nav className="space-y-2 flex-1" aria-label="Primary">
          {navItem("dashboard", "Dashboard", "▦")}
          {navItem("usage", "Usage Predictions", "📈")}
          {navItem("inventory", "Inventory", "📦")}
        </nav>

        <div className="mt-auto text-sm text-gray-400">v1.0 • Connected</div>
      </div>
    </div>
  );
};

export default Sidebar;
