import type { InputHTMLAttributes } from "react";

type Props = InputHTMLAttributes<HTMLInputElement>;

export default function InputField({ className = "", type = "text", ...props }: Props) {
  return (
    <input
      {...props}
      type={type}
      className={`rounded-lg border border-ui bg-surface px-3 py-2 text-sm text-ink-strong outline-none transition placeholder:text-ink-faint focus:border-action-accent focus:ring-2 focus:ring-action-soft disabled:cursor-not-allowed disabled:bg-surface-muted disabled:text-ink-faint ${className}`}
    />
  );
}
