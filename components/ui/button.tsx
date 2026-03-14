"use client";

import React from "react";
import { Spinner } from "./spinner";

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  loading?: boolean;
  variant?: "primary" | "secondary" | "ghost";
  fullWidth?: boolean;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      children,
      loading = false,
      variant = "primary",
      fullWidth = false,
      className = "",
      disabled,
      ...props
    },
    ref
  ) => {
    const variants = {
      primary:
        "bg-gray-900 text-white hover:bg-gray-800 disabled:bg-gray-400",
      secondary:
        "bg-white text-gray-900 border border-gray-300 hover:bg-gray-50 disabled:bg-gray-50",
      ghost:
        "text-gray-500 hover:text-gray-900 bg-transparent disabled:text-gray-300",
    };

    return (
      <button
        ref={ref}
        disabled={disabled || loading}
        className={`inline-flex items-center justify-center gap-2 py-2.5 px-4 rounded-lg font-medium transition-colors disabled:cursor-not-allowed ${variants[variant]
          } ${fullWidth ? "w-full" : ""} ${className}`}
        {...props}
      >
        {loading && <Spinner size="sm" />}
        {children}
      </button>
    );
  }
);

Button.displayName = "Button";
