"use client";

import { useState, Suspense } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { PasswordInput } from "@/components/ui/password-input";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/alert";
import { useToast } from "@/components/ui/toast";

function ResetPasswordForm() {
  const { toast } = useToast();
  const searchParams = useSearchParams();
  const token = searchParams.get("token");

  const [form, setForm] = useState({ password: "", confirmPassword: "" });
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState("");
  const [matchError, setMatchError] = useState("");
  const [loading, setLoading] = useState(false);

  if (!token) {
    return (
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-8 text-center">
        <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
          <svg className="w-6 h-6 text-red-600" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
          </svg>
        </div>
        <h2 className="text-xl font-semibold text-gray-900 mb-2">
          Invalid link
        </h2>
        <p className="text-gray-500 mb-4">
          This password reset link is invalid or has expired.
        </p>
        <Link
          href="/forgot-password"
          className="text-gray-900 font-medium hover:underline"
        >
          Request a new link
        </Link>
      </div>
    );
  }

  function handleConfirmChange(value: string) {
    setForm((prev) => ({ ...prev, confirmPassword: value }));
    if (value && value !== form.password) {
      setMatchError("Passwords do not match");
    } else {
      setMatchError("");
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    if (form.password !== form.confirmPassword) {
      setMatchError("Passwords do not match");
      return;
    }

    setLoading(true);

    try {
      const res = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, password: form.password }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error);
        return;
      }

      toast("Password reset successfully!", "success");
      setSuccess(true);
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  if (success) {
    return (
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-8 text-center animate-fade-in">
        <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
          <svg
            className="w-6 h-6 text-green-600"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M5 13l4 4L19 7"
            />
          </svg>
        </div>
        <h2 className="text-xl font-semibold text-gray-900 mb-2">
          Password reset!
        </h2>
        <p className="text-gray-500 mb-6">
          Your password has been reset successfully.
        </p>
        <Link
          href="/signin"
          className="inline-block bg-gray-900 text-white px-6 py-2.5 rounded-lg font-medium hover:bg-gray-800 transition-colors"
        >
          Sign in
        </Link>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-8">
      <h2 className="text-xl font-semibold text-gray-900 mb-2">
        Set new password
      </h2>
      <p className="text-gray-500 mb-6 text-sm">
        Enter your new password below.
      </p>

      <Alert message={error} type="error" onDismiss={() => setError("")} />

      <form onSubmit={handleSubmit} className="space-y-4">
        <PasswordInput
          label="New Password"
          required
          minLength={8}
          showStrength
          value={form.password}
          onChange={(e) => setForm({ ...form, password: e.target.value })}
          placeholder="Min. 8 characters"
        />

        <PasswordInput
          label="Confirm Password"
          required
          minLength={8}
          value={form.confirmPassword}
          onChange={(e) => handleConfirmChange(e.target.value)}
          error={matchError}
          placeholder="Re-enter your password"
        />

        <Button type="submit" loading={loading} fullWidth>
          {loading ? "Resetting..." : "Reset Password"}
        </Button>
      </form>
    </div>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense
      fallback={
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-8 animate-pulse h-80" />
      }
    >
      <ResetPasswordForm />
    </Suspense>
  );
}
