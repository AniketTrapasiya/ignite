"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Input } from "@/components/ui/input";
import { PasswordInput } from "@/components/ui/password-input";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/alert";
import { isValidEmail } from "@/lib/validation";

export default function SignUpPage() {
  const router = useRouter();
  const [form, setForm] = useState({ name: "", email: "", password: "" });
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  function validateField(field: string, value: string) {
    const errors = { ...fieldErrors };
    switch (field) {
      case "name":
        errors.name =
          value.trim().length < 2 ? "Name must be at least 2 characters" : "";
        break;
      case "email":
        errors.email = !isValidEmail(value) ? "Please enter a valid email" : "";
        break;
      case "password":
        errors.password =
          value.length > 0 && value.length < 8
            ? "Password must be at least 8 characters"
            : "";
        break;
    }
    setFieldErrors(errors);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const res = await fetch("/api/auth/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error);
        return;
      }

      router.push(
        `/verify-otp?userId=${data.userId}&type=EMAIL_VERIFICATION`
      );
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-8">
      <h2 className="text-xl font-semibold text-gray-900 mb-6">
        Create your account
      </h2>

      <Alert message={error} type="error" onDismiss={() => setError("")} />

      <form onSubmit={handleSubmit} className="space-y-4">
        <Input
          label="Full Name"
          type="text"
          required
          value={form.name}
          onChange={(e) => setForm({ ...form, name: e.target.value })}
          onBlur={(e) => validateField("name", e.target.value)}
          error={fieldErrors.name}
          placeholder="John Doe"
        />

        <Input
          label="Email"
          type="email"
          required
          value={form.email}
          onChange={(e) => setForm({ ...form, email: e.target.value })}
          onBlur={(e) => validateField("email", e.target.value)}
          error={fieldErrors.email}
          placeholder="you@example.com"
        />

        <PasswordInput
          label="Password"
          required
          minLength={8}
          showStrength
          value={form.password}
          onChange={(e) => setForm({ ...form, password: e.target.value })}
          onBlur={(e) => validateField("password", e.target.value)}
          error={fieldErrors.password}
          placeholder="Min. 8 characters"
        />

        <Button type="submit" loading={loading} fullWidth>
          {loading ? "Creating account..." : "Sign Up"}
        </Button>
      </form>

      <p className="text-center text-sm text-gray-500 mt-6">
        Already have an account?{" "}
        <Link
          href="/signin"
          className="text-gray-900 font-medium hover:underline"
        >
          Sign in
        </Link>
      </p>
    </div>
  );
}
