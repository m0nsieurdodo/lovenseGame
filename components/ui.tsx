"use client";

import type { ButtonHTMLAttributes, ReactNode } from "react";

/* ------------------------------------------------------------------ */
/* Button — primary / secondary / danger                              */
/* ------------------------------------------------------------------ */
type Variant = "primary" | "secondary" | "danger";

const BTN: Record<Variant, string> = {
  primary:
    "bg-gradient-to-r from-cyan to-rose text-[#06040f] font-bold border-none hover:brightness-110 active:brightness-95",
  secondary:
    "bg-[#1a1638] text-ink border border-[#3a3670] hover:border-cyan active:glow-low",
  danger: "bg-[#2a0e18] text-danger border border-danger hover:brightness-125",
};

export function Button({
  variant = "secondary",
  className = "",
  children,
  ...rest
}: { variant?: Variant } & ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      {...rest}
      className={`cursor-pointer select-none rounded-[10px] px-4 py-2.5 text-sm transition disabled:cursor-not-allowed disabled:opacity-40 ${BTN[variant]} ${className}`}
    >
      {children}
    </button>
  );
}

/* ------------------------------------------------------------------ */
/* Card — surface glassmorphism                                        */
/* ------------------------------------------------------------------ */
export function Card({ className = "", children }: { className?: string; children: ReactNode }) {
  return <div className={`glass rounded-[16px] p-4 ${className}`}>{children}</div>;
}

export function CardTitle({ children }: { children: ReactNode }) {
  return (
    <h3 className="mb-2 text-[11px] uppercase tracking-[2px] text-muted">{children}</h3>
  );
}

/* ------------------------------------------------------------------ */
/* StatusDot — pastille de statut ON/OFF                               */
/* ------------------------------------------------------------------ */
export function StatusDot({ state }: { state: "idle" | "connecting" | "connected" | "error" }) {
  const color =
    state === "connected" ? "bg-success text-success" : state === "error" ? "bg-danger text-danger" : "bg-muted text-muted";
  return (
    <span
      className={`inline-block h-2.5 w-2.5 rounded-full ${color} ${state === "connecting" ? "animate-pulse" : ""}`}
      style={{ boxShadow: "0 0 8px currentColor" }}
    />
  );
}

/* ------------------------------------------------------------------ */
/* GlowBar — traduit visuellement l'intensité de vibration (0-100)     */
/* ------------------------------------------------------------------ */
export function GlowBar({ value }: { value: number }) {
  return (
    <div className="h-1.5 w-full overflow-hidden rounded border border-[#241f45] bg-[#0d0b20]">
      <i
        className="block h-full rounded bg-gradient-to-r from-cyan to-rose transition-[width] duration-100"
        style={{ width: `${Math.max(0, Math.min(100, value))}%` }}
      />
    </div>
  );
}
