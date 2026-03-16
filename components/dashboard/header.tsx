"use client";

import Link from "next/link";
import { NotificationBell } from "./notification-bell";

interface HeaderProps {
  userName: string;
  userEmail?: string;
  onMenuToggle: () => void;
}

export function Header({ userName, userEmail, onMenuToggle }: HeaderProps) {
  const initials = userName
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

  return (
    <>
      {/* Mobile header */}
      <header className="bg-[#0d0d1a] border-b border-white/[0.07] px-4 py-3 lg:hidden sticky top-0 z-20">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              onClick={onMenuToggle}
              className="p-2 text-white/40 hover:text-white hover:bg-white/[0.06] rounded-xl transition-colors"
              aria-label="Open menu"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" />
              </svg>
            </button>
            <div className="flex items-center gap-2">
              <div
                className="w-7 h-7 rounded-lg flex items-center justify-center"
                style={{ background: "linear-gradient(135deg, #6366f1, #a855f7)" }}
              >
                <svg className="w-3.5 h-3.5 text-white" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
              </div>
              <span className="font-bold text-white text-sm">AutoFlow <span className="bg-gradient-to-r from-indigo-400 to-purple-400 bg-clip-text text-transparent">AI</span></span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <NotificationBell />
            <div
              className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-white"
              style={{ background: "linear-gradient(135deg, #6366f1, #a855f7)" }}
            >
              {initials}
            </div>
          </div>
        </div>
      </header>

      {/* Desktop top bar */}
      <header className="hidden lg:flex sticky top-0 z-20 items-center justify-between px-6 py-3 border-b border-white/[0.05]"
        style={{ background: "rgba(7,7,15,0.85)", backdropFilter: "blur(16px)" }}
      >
        {/* Left: breadcrumb placeholder — pages can use <title> */}
        <div className="flex items-center gap-2">
          <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
          <span className="text-xs text-white/25 font-medium">AutoFlow AI</span>
        </div>

        {/* Right: actions */}
        <div className="flex items-center gap-3">
          <Link
            href="/dashboard/engine"
            className="flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-semibold text-white transition-all"
            style={{ background: "linear-gradient(135deg,#6366f1,#a855f7)", boxShadow: "0 0 16px rgba(168,85,247,0.3)" }}
          >
            <svg className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
            Run Engine
          </Link>

          <NotificationBell />

          <Link
            href="/dashboard/settings"
            className="flex items-center gap-2 px-2 py-1.5 rounded-xl transition-all hover:bg-white/[0.06]"
          >
            <div
              className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold text-white shrink-0"
              style={{ background: "linear-gradient(135deg, #6366f1, #a855f7)" }}
            >
              {initials}
            </div>
            <div className="hidden xl:block">
              <p className="text-xs font-medium text-white/80 leading-none">{userName}</p>
              {userEmail && <p className="text-[10px] text-white/30 mt-0.5 leading-none truncate max-w-[140px]">{userEmail}</p>}
            </div>
          </Link>
        </div>
      </header>
    </>
  );
}

