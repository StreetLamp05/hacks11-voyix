"use client";

import React from "react";

export const DashboardStats: React.FC = () => {
  return (
    <div className="grid grid-cols-3 gap-6">
      <div className="col-span-2">
        <div className="card p-6 mb-6">
          <h4 className="text-lg font-semibold mb-4">Stock Levels by Product</h4>
          <div className="h-56 bg-gradient-to-b from-white to-gray-50 border rounded-md flex items-center justify-center text-gray-400">Chart placeholder</div>
        </div>

        <div className="card p-6">
          <h4 className="text-lg font-semibold mb-4">Inventory Table</h4>
          <div className="h-40 bg-white border rounded-md flex items-center justify-center text-gray-400">Table placeholder</div>
        </div>
      </div>

      <aside>
        <div className="card p-6 mb-6">
          <h4 className="text-lg font-semibold">Quick Metrics</h4>
          <ul className="mt-4 space-y-3 text-gray-700">
            <li>Total Items: <strong>890</strong></li>
            <li>Low Stock Items: <strong>12</strong></li>
            <li>Categories: <strong>8</strong></li>
          </ul>
        </div>

        <div className="card p-6">
          <h4 className="text-lg font-semibold">Shortcuts</h4>
          <div className="mt-4 flex flex-col gap-2">
            <button className="btn-outline">Add Inventory</button>
            <button className="btn-outline">Run Reorder</button>
          </div>
        </div>
      </aside>
    </div>
  );
};

export default DashboardStats;
