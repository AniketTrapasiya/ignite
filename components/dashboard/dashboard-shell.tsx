"use client";

import { useState } from "react";
import { Sidebar } from "./sidebar";
import { Header } from "./header";

interface DashboardShellProps {
  userName: string;
  userEmail: string;
  children: React.ReactNode;
}

export function DashboardShell({ userName, userEmail, children }: DashboardShellProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="min-h-screen bg-[#07070f]">
      {/* Mobile sidebar overlay */}
      {sidebarOpen && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div
            className="fixed inset-0 bg-black/60 backdrop-blur-sm"
            onClick={() => setSidebarOpen(false)}
          />
          <div className="fixed inset-y-0 left-0 w-64 z-50">
            <Sidebar userName={userName} userEmail={userEmail} />
          </div>
        </div>
      )}

      {/* Desktop sidebar */}
      <div className="hidden lg:fixed lg:inset-y-0 lg:flex lg:w-64 lg:z-30">
        <Sidebar userName={userName} userEmail={userEmail} />
      </div>

      {/* Main content */}
      <div className="lg:pl-64 min-h-screen">
        <Header userName={userName} userEmail={userEmail} onMenuToggle={() => setSidebarOpen(true)} />
        <main className="min-h-screen">{children}</main>
      </div>
    </div>
  );
}
