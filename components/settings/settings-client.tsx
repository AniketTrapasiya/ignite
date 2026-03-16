"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

// ── Shared Toast ──────────────────────────────────────────────────────────────
function Toast({ msg, ok }: { msg: string; ok: boolean }) {
  return (
    <div
      className="fixed bottom-6 right-6 z-50 flex items-center gap-3 px-4 py-3 rounded-2xl text-sm font-medium shadow-2xl"
      style={{
        background: ok ? "rgba(16,185,129,0.15)" : "rgba(239,68,68,0.15)",
        border: `1px solid ${ok ? "rgba(16,185,129,0.3)" : "rgba(239,68,68,0.3)"}`,
        color: ok ? "#34d399" : "#f87171",
        backdropFilter: "blur(16px)",
      }}
    >
      <span>{ok ? "✓" : "✗"}</span>
      {msg}
    </div>
  );
}

// ── Input field ───────────────────────────────────────────────────────────────
function Field({
  label,
  type = "text",
  value,
  onChange,
  placeholder,
  disabled,
}: {
  label: string;
  type?: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  disabled?: boolean;
}) {
  return (
    <div>
      <label className="block text-xs font-semibold text-white/50 uppercase tracking-widest mb-2">
        {label}
      </label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        disabled={disabled}
        className="w-full px-4 py-3 rounded-xl text-white placeholder-white/20 text-sm outline-none transition-all disabled:opacity-40"
        style={{
          background: "rgba(255,255,255,0.05)",
          border: "1.5px solid rgba(255,255,255,0.1)",
        }}
        onFocus={(e) => (e.target.style.borderColor = "#a855f7")}
        onBlur={(e) => (e.target.style.borderColor = "rgba(255,255,255,0.1)")}
      />
    </div>
  );
}

// ── Profile section ───────────────────────────────────────────────────────────
function ProfileSection({
  initial,
  onSave,
}: {
  initial: { name: string; email: string };
  onSave: (msg: string, ok: boolean) => void;
}) {
  const [name, setName] = useState(initial.name);
  const [email, setEmail] = useState(initial.email);
  const [saving, setSaving] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await fetch("/api/user/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to save");
      onSave("Profile updated successfully", true);
    } catch (err) {
      onSave(err instanceof Error ? err.message : "Failed to save", false);
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-5">
      <div>
        <h2 className="text-lg font-bold text-white mb-1">Profile</h2>
        <p className="text-white/40 text-sm">Update your name and email address.</p>
      </div>

      {/* Avatar preview */}
      <div className="flex items-center gap-4">
        <div
          className="w-16 h-16 rounded-2xl flex items-center justify-center text-2xl font-bold text-white shrink-0"
          style={{ background: "linear-gradient(135deg,#6366f1,#a855f7)" }}
        >
          {name.trim().charAt(0).toUpperCase() || "?"}
        </div>
        <div>
          <p className="text-white text-sm font-medium">{name || "Your name"}</p>
          <p className="text-white/40 text-xs mt-0.5">{email}</p>
        </div>
      </div>

      <Field label="Full Name" value={name} onChange={setName} placeholder="Your full name" />
      <Field label="Email Address" type="email" value={email} onChange={setEmail} placeholder="you@example.com" />

      <button
        type="submit"
        disabled={saving}
        className="px-6 py-2.5 rounded-xl text-sm font-bold text-white transition-all disabled:opacity-50"
        style={{ background: "linear-gradient(135deg,#6366f1,#a855f7)" }}
      >
        {saving ? "Saving…" : "Save Changes"}
      </button>
    </form>
  );
}

// ── Password section ──────────────────────────────────────────────────────────
function PasswordSection({ onSave }: { onSave: (msg: string, ok: boolean) => void }) {
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [saving, setSaving] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (next !== confirm) { onSave("New passwords don't match", false); return; }
    if (next.length < 8) { onSave("Password must be at least 8 characters", false); return; }
    setSaving(true);
    try {
      const res = await fetch("/api/user/password", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword: current, newPassword: next }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to update");
      onSave("Password changed successfully", true);
      setCurrent(""); setNext(""); setConfirm("");
    } catch (err) {
      onSave(err instanceof Error ? err.message : "Failed to update", false);
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-5">
      <div>
        <h2 className="text-lg font-bold text-white mb-1">Change Password</h2>
        <p className="text-white/40 text-sm">Use a strong password with at least 8 characters.</p>
      </div>

      <Field label="Current Password" type="password" value={current} onChange={setCurrent} placeholder="••••••••" />
      <Field label="New Password" type="password" value={next} onChange={setNext} placeholder="••••••••" />
      <Field label="Confirm New Password" type="password" value={confirm} onChange={setConfirm} placeholder="••••••••" />

      {/* Strength bar */}
      {next && (
        <div className="space-y-1">
          <div className="flex gap-1">
            {[1, 2, 3, 4].map((i) => {
              const score = [next.length >= 8, /[A-Z]/.test(next), /\d/.test(next), /[^a-zA-Z0-9]/.test(next)].filter(Boolean).length;
              return (
                <div
                  key={i}
                  className="h-1 flex-1 rounded-full transition-all"
                  style={{
                    background: i <= score
                      ? score <= 1 ? "#ef4444" : score === 2 ? "#f97316" : score === 3 ? "#eab308" : "#10b981"
                      : "rgba(255,255,255,0.08)",
                  }}
                />
              );
            })}
          </div>
          <p className="text-xs text-white/30">
            {[next.length >= 8, /[A-Z]/.test(next), /\d/.test(next), /[^a-zA-Z0-9]/.test(next)].filter(Boolean).length <= 1
              ? "Weak" : [next.length >= 8, /[A-Z]/.test(next), /\d/.test(next), /[^a-zA-Z0-9]/.test(next)].filter(Boolean).length === 2
                ? "Fair" : [next.length >= 8, /[A-Z]/.test(next), /\d/.test(next), /[^a-zA-Z0-9]/.test(next)].filter(Boolean).length === 3
                  ? "Good" : "Strong"} password
          </p>
        </div>
      )}

      <button
        type="submit"
        disabled={saving || !current || !next || !confirm}
        className="px-6 py-2.5 rounded-xl text-sm font-bold text-white transition-all disabled:opacity-50"
        style={{ background: "linear-gradient(135deg,#6366f1,#a855f7)" }}
      >
        {saving ? "Updating…" : "Update Password"}
      </button>
    </form>
  );
}

// ── Danger zone ───────────────────────────────────────────────────────────────
function DangerZone() {
  const [confirm, setConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const router = useRouter();

  async function deleteAccount() {
    setDeleting(true);
    try {
      await fetch("/api/auth/signout", { method: "POST" });
      router.push("/signin");
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div
      className="rounded-2xl p-5 space-y-4"
      style={{ background: "rgba(239,68,68,0.05)", border: "1px solid rgba(239,68,68,0.15)" }}
    >
      <div>
        <h2 className="text-base font-bold text-red-400 mb-1">Danger Zone</h2>
        <p className="text-white/40 text-sm">These actions are irreversible. Please be certain.</p>
      </div>
      {!confirm ? (
        <button
          onClick={() => setConfirm(true)}
          className="px-4 py-2 rounded-xl text-sm font-medium text-red-400 transition-all"
          style={{ background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.2)" }}
        >
          Delete Account
        </button>
      ) : (
        <div className="space-y-3">
          <p className="text-sm text-red-300">
            Are you sure? This will permanently delete your account, all agents, memories and runs.
          </p>
          <div className="flex gap-2">
            <button
              onClick={deleteAccount}
              disabled={deleting}
              className="px-4 py-2 rounded-xl text-sm font-bold text-white bg-red-600 hover:bg-red-700 transition-all disabled:opacity-50"
            >
              {deleting ? "Deleting…" : "Yes, delete everything"}
            </button>
            <button
              onClick={() => setConfirm(false)}
              className="px-4 py-2 rounded-xl text-sm font-medium text-white/60"
              style={{ background: "rgba(255,255,255,0.05)" }}
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Main settings client component ───────────────────────────────────────────
export function SettingsClient({ name, email }: { name: string; email: string }) {
  const [tab, setTab] = useState<"profile" | "password" | "danger">("profile");
  const [toast, setToast] = useState<{ msg: string; ok: boolean } | null>(null);

  function showToast(msg: string, ok: boolean) {
    setToast({ msg, ok });
    setTimeout(() => setToast(null), 3500);
  }

  const tabs = [
    { key: "profile" as const, label: "Profile", icon: "👤" },
    { key: "password" as const, label: "Password", icon: "🔒" },
    { key: "danger" as const, label: "Danger Zone", icon: "⚠️" },
  ];

  return (
    <>
      {toast && <Toast msg={toast.msg} ok={toast.ok} />}

      <div className="p-6 max-w-2xl mx-auto space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-2xl font-bold text-white">Settings</h1>
          <p className="text-white/40 text-sm mt-1">Manage your profile, security and account preferences</p>
        </div>

        {/* Tab bar */}
        <div
          className="flex gap-1 p-1 rounded-xl"
          style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)" }}
        >
          {tabs.map((t) => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className="flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-xs font-semibold transition-all"
              style={
                tab === t.key
                  ? { background: "rgba(168,85,247,0.2)", color: "#c084fc", border: "1px solid rgba(168,85,247,0.3)" }
                  : { color: "rgba(255,255,255,0.4)" }
              }
            >
              {t.icon} {t.label}
            </button>
          ))}
        </div>

        {/* Tab content */}
        <div
          className="rounded-2xl p-6"
          style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)" }}
        >
          {tab === "profile" && (
            <ProfileSection initial={{ name, email }} onSave={showToast} />
          )}
          {tab === "password" && <PasswordSection onSave={showToast} />}
          {tab === "danger" && <DangerZone />}
        </div>
      </div>
    </>
  );
}
