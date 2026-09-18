"use client";

import { useLayoutEffect, useSyncExternalStore } from "react";

type Choice = "system" | "light" | "dark";

const STORAGE_KEY = "nexo-theme";
const listeners = new Set<() => void>();

function readChoice(): Choice {
  try {
    const value = localStorage.getItem(STORAGE_KEY);
    return value === "light" || value === "dark" ? value : "system";
  } catch {
    return "system";
  }
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  window.addEventListener("storage", listener);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", listener);
  };
}

function writeChoice(next: Choice) {
  try {
    if (next === "system") localStorage.removeItem(STORAGE_KEY);
    else localStorage.setItem(STORAGE_KEY, next);
  } catch {}
  listeners.forEach((listener) => listener());
}

function apply(choice: Choice) {
  const dark = choice === "dark" || (choice === "system" && window.matchMedia("(prefers-color-scheme: dark)").matches);
  document.documentElement.setAttribute("data-theme", dark ? "dark" : "light");
}

const options: { value: Choice; label: string; icon: React.ReactNode }[] = [
  { value: "system", label: "Tema do sistema", icon: <path d="M3 5.5A1.5 1.5 0 0 1 4.5 4h11A1.5 1.5 0 0 1 17 5.5V12a1.5 1.5 0 0 1-1.5 1.5h-11A1.5 1.5 0 0 1 3 12V5.5ZM7.5 16.5h5M10 13.5v3" /> },
  { value: "light", label: "Tema claro", icon: <><circle cx="10" cy="10" r="3.2" /><path d="M10 2.5v1.6M10 15.9v1.6M2.5 10h1.6M15.9 10h1.6M4.7 4.7l1.1 1.1M14.2 14.2l1.1 1.1M4.7 15.3l1.1-1.1M14.2 5.8l1.1-1.1" /></> },
  { value: "dark", label: "Tema escuro", icon: <path d="M16.2 12.6A6.8 6.8 0 0 1 7.4 3.8a6.8 6.8 0 1 0 8.8 8.8Z" /> },
];

export function ThemeToggle({ className = "" }: { className?: string }) {
  // No servidor e na hidratação vale "system"; depois o React relê o
  // localStorage sozinho, sem descompasso de hidratação.
  const choice = useSyncExternalStore(subscribe, readChoice, () => "system" as Choice);

  // Em desenvolvimento o React remonta <html> e apaga o atributo posto pelo
  // script inline; aqui ele é reaplicado antes da pintura e acompanha o
  // sistema quando a escolha é "system".
  useLayoutEffect(() => {
    apply(choice);
    if (choice !== "system") return;
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const follow = () => apply("system");
    media.addEventListener("change", follow);
    return () => media.removeEventListener("change", follow);
  }, [choice]);

  return (
    <div className={`theme-toggle ${className}`} role="radiogroup" aria-label="Tema">
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          role="radio"
          aria-checked={choice === option.value}
          aria-label={option.label}
          title={option.label}
          onClick={() => writeChoice(option.value)}
        >
          <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{option.icon}</svg>
        </button>
      ))}
    </div>
  );
}
