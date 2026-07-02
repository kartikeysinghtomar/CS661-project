"use client";

import { type ReactNode } from "react";

export function cn(...parts: (string | false | null | undefined)[]): string {
  return parts.filter(Boolean).join(" ");
}

/** Elevated white card. */
export function Card({
  children,
  className,
  hover = true,
}: {
  children: ReactNode;
  className?: string;
  hover?: boolean;
}) {
  return <div className={cn("card p-6 sm:p-7", hover && "card-hover", className)}>{children}</div>;
}

/** Card header: gradient icon chip + title. `grad` is a CSS var name (grad-1..6). */
export function CardHead({
  icon,
  title,
  grad = "grad-6",
  right,
}: {
  icon: string;
  title: string;
  grad?: string;
  right?: ReactNode;
}) {
  return (
    <div className="card-head">
      <span className="chip" style={{ background: `var(--${grad})` }}>
        {icon}
      </span>
      <h3 className="card-title flex-1">{title}</h3>
      {right}
    </div>
  );
}

export function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="control-label">{label}</span>
      {children}
    </label>
  );
}

/** A styled native <select>. */
export function Select({
  value,
  onChange,
  options,
  placeholder,
  className,
}: {
  value: string;
  onChange: (v: string) => void;
  options: { label: string; value: string }[];
  placeholder?: string;
  className?: string;
}) {
  return (
    <select
      className={cn("select", className)}
      value={value}
      onChange={(e) => onChange(e.target.value)}
    >
      {placeholder !== undefined && <option value="">{placeholder}</option>}
      {options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  );
}

export function Empty({ icon = "📊", message }: { icon?: string; message: string }) {
  return (
    <div className="flex flex-col items-center justify-center text-center h-full min-h-[240px] py-10">
      <div className="text-5xl opacity-40 mb-3">{icon}</div>
      <p className="text-slate-400 font-medium max-w-xs">{message}</p>
    </div>
  );
}

export function Spinner({ label }: { label?: string }) {
  return (
    <div className="flex flex-col items-center justify-center h-full min-h-[240px] py-10 gap-3">
      <div className="h-8 w-8 rounded-full border-[3px] border-slate-200 border-t-brand-500 animate-spin" />
      {label && <p className="text-slate-400 text-sm">{label}</p>}
    </div>
  );
}
