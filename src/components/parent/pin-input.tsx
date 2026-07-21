"use client";

import { Input } from "@/components/ui/input";

// A 4-digit PIN field. Numeric keypad on phones, masked like a password, and
// non-digits are dropped on the way in so the value is always submittable.
export function PinInput({
  id,
  value,
  onChange,
  onEnter,
  disabled,
  autoFocus,
  placeholder = "••••",
}: {
  id?: string;
  value: string;
  onChange: (value: string) => void;
  onEnter?: () => void;
  disabled?: boolean;
  autoFocus?: boolean;
  placeholder?: string;
}) {
  return (
    <Input
      id={id}
      type="password"
      inputMode="numeric"
      autoComplete="off"
      maxLength={4}
      placeholder={placeholder}
      value={value}
      disabled={disabled}
      autoFocus={autoFocus}
      onChange={(e) => onChange(e.target.value.replace(/\D/g, "").slice(0, 4))}
      onKeyDown={(e) => {
        if (e.key === "Enter" && onEnter) onEnter();
      }}
      className="h-12 text-center text-2xl tracking-[0.5em]"
    />
  );
}
