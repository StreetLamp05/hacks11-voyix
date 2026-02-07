"use client";

import { useState } from "react";
import Sidebar from "@/components/Sidebar";
import AssistantCard from "@/components/AssistantCard";
import { DashboardStats } from "@/components/DashboardStats";

export default function Home() {
  const [tab, setTab] = useState<string>("dashboard");

  return (
    <div className="min-h-screen flex bg-gray-50">
      <aside className="w-72">
        <Sidebar active={tab} onSelect={setTab} />
      </aside>

      <main className="flex-1 p-8">
        <header className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="text-4xl font-bold">{tab === "dashboard" ? "Dashboard Overview" : tab === "usage" ? "Usage Predictions" : "Inventory"}</h1>
            <p className="text-gray-500">{tab === "dashboard" ? "Monitor your ingredient inventory and usage patterns" : tab === "usage" ? "AI-powered forecasting for ingredient consumption" : "Manage your inventory and stock levels"}</p>
          </div>
          {tab === "usage" && (
            <div className="">
              <button className="btn-gradient">AI-Powered Forecasting</button>
            </div>
          )}
        </header>

        {tab === "dashboard" && (
          <>
            <section className="mb-8">
              <AssistantCard />
            </section>

            <section>
              <DashboardStats />
            </section>
          </>
        )}

        {tab === "usage" && (
          <section>
            <div className="grid grid-cols-4 gap-6 mb-6">
              <div className="card p-6">Predicted Revenue<br/><strong>$5,420</strong></div>
              <div className="card p-6">Predicted Orders<br/><strong>76</strong></div>
              <div className="card p-6">Avg Order Value<br/><strong>$71.32</strong></div>
              <div className="card p-6">Confidence Level<br/><strong>94%</strong></div>
            </div>

            <div className="card p-6">
              <h3 className="text-lg font-semibold mb-4">Daily Usage Forecast</h3>
              <div className="h-64 bg-white border rounded-md flex items-center justify-center text-gray-400">Chart placeholder</div>
            </div>
          </section>
        )}

        {tab === "inventory" && (
          <section>
            <div className="card p-6">
              <h3 className="text-lg font-semibold mb-4">Inventory</h3>
              <div className="h-48 bg-white border rounded-md flex items-center justify-center text-gray-400">Inventory table placeholder</div>
            </div>
          </section>
        )}
      </main>
    </div>
  );
}
