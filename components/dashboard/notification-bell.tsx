"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";

interface Notification {
  id: string;
  type: string;
  title: string;
  message: string;
  read: boolean;
  link?: string | null;
  createdAt: string;
}

function timeAgo(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

const TYPE_ICON: Record<string, string> = {
  success: "✅",
  error: "❌",
  warning: "⚠️",
  info: "ℹ️",
};

export function NotificationBell() {
  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unread, setUnread] = useState(0);
  const [loading, setLoading] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  async function load() {
    setLoading(true);
    try {
      const r = await fetch("/api/notifications");
      const d = await r.json();
      setNotifications(d.notifications ?? []);
      setUnread(d.unread ?? 0);
    } catch {
      /* ignore */
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    const id = setInterval(load, 30000); // poll every 30s
    return () => clearInterval(id);
  }, []);

  // Close on outside click
  useEffect(() => {
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  async function markAllRead() {
    await fetch("/api/notifications", { method: "PATCH" });
    setNotifications((n) => n.map((x) => ({ ...x, read: true })));
    setUnread(0);
  }

  async function markRead(id: string) {
    await fetch(`/api/notifications/${id}`, { method: "PATCH" });
    setNotifications((n) => n.map((x) => (x.id === id ? { ...x, read: true } : x)));
    setUnread((u) => Math.max(0, u - 1));
  }

  async function dismiss(id: string, e: React.MouseEvent) {
    e.stopPropagation();
    await fetch(`/api/notifications/${id}`, { method: "DELETE" });
    const was = notifications.find((x) => x.id === id);
    setNotifications((n) => n.filter((x) => x.id !== id));
    if (was && !was.read) setUnread((u) => Math.max(0, u - 1));
  }

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => { setOpen((o) => !o); if (!open) load(); }}
        className="relative w-9 h-9 flex items-center justify-center rounded-xl transition-all"
        style={{
          background: open ? "rgba(168,85,247,0.15)" : "rgba(255,255,255,0.04)",
          border: `1px solid ${open ? "rgba(168,85,247,0.3)" : "rgba(255,255,255,0.08)"}`,
        }}
      >
        <svg className="w-4 h-4 text-white/60" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M14.857 17.082a23.848 23.848 0 005.454-1.31A8.967 8.967 0 0118 9.75v-.7V9A6 6 0 006 9v.75a8.967 8.967 0 01-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 01-5.714 0m5.714 0a3 3 0 11-5.714 0" />
        </svg>
        {unread > 0 && (
          <span
            className="absolute -top-1 -right-1 min-w-[16px] h-4 flex items-center justify-center rounded-full text-[9px] font-bold text-white px-1"
            style={{ background: "linear-gradient(135deg,#6366f1,#a855f7)" }}
          >
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </button>

      {open && (
        <div
          className="absolute right-0 top-11 w-80 rounded-2xl shadow-2xl z-50 overflow-hidden"
          style={{
            background: "#0d0b1e",
            border: "1px solid rgba(255,255,255,0.1)",
            boxShadow: "0 24px 64px rgba(0,0,0,0.6)",
          }}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-white/[0.07]">
            <div className="flex items-center gap-2">
              <span className="text-sm font-bold text-white">Notifications</span>
              {unread > 0 && (
                <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full text-purple-300"
                  style={{ background: "rgba(168,85,247,0.2)" }}>
                  {unread} new
                </span>
              )}
            </div>
            {unread > 0 && (
              <button onClick={markAllRead} className="text-[10px] text-purple-400 hover:text-purple-300 transition-colors">
                Mark all read
              </button>
            )}
          </div>

          {/* List */}
          <div className="max-h-80 overflow-y-auto">
            {loading && notifications.length === 0 ? (
              <div className="py-8 text-center text-white/30 text-xs">Loading…</div>
            ) : notifications.length === 0 ? (
              <div className="py-10 text-center">
                <p className="text-2xl mb-2">🔔</p>
                <p className="text-sm text-white/30">All caught up!</p>
                <p className="text-xs text-white/20 mt-1">No notifications yet</p>
              </div>
            ) : (
              notifications.map((n) => {
                const inner = (
                  <div
                    key={n.id}
                    className="flex items-start gap-3 px-4 py-3 border-b border-white/[0.04] cursor-pointer transition-all hover:bg-white/[0.03] relative"
                    style={{ opacity: n.read ? 0.6 : 1 }}
                    onClick={() => !n.read && markRead(n.id)}
                  >
                    {!n.read && (
                      <div className="absolute left-2 top-1/2 -translate-y-1/2 w-1 h-1 rounded-full bg-purple-500" />
                    )}
                    <span className="text-base shrink-0 mt-0.5">{TYPE_ICON[n.type] ?? "🔔"}</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-semibold text-white/80 leading-tight">{n.title}</p>
                      <p className="text-[11px] text-white/40 mt-0.5 leading-relaxed line-clamp-2">{n.message}</p>
                      <p className="text-[10px] text-white/25 mt-1">{timeAgo(n.createdAt)}</p>
                    </div>
                    <button
                      onClick={(e) => dismiss(n.id, e)}
                      className="shrink-0 w-5 h-5 flex items-center justify-center rounded text-white/20 hover:text-white/50 hover:bg-white/[0.08] transition-all mt-0.5"
                    >
                      <svg className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                );

                return n.link ? (
                  <Link key={n.id} href={n.link} onClick={() => { markRead(n.id); setOpen(false); }}>
                    {inner}
                  </Link>
                ) : (
                  <div key={n.id}>{inner}</div>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}
