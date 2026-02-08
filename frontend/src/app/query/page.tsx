"use client";

import Link from "next/link";
import QueryChat from "@/components/QueryChat";

export default function QueryPage() {
  return (
    <div className="flex h-screen flex-col">
      <header className="flex items-center justify-between border-b border-gray-700 px-6 py-3">
        <h1 className="text-lg font-bold">Query Inventory</h1>
        <Link href="/" className="text-sm text-blue-400 hover:underline">
          Home
        </Link>
      </header>
      <main className="flex-1 overflow-hidden">
        <QueryChat />
      </main>
    </div>
  );
}
