/**
 * LanguageSwitcher.tsx
 * PL / EN toggle button pair plus the useLang hook that persists the choice
 * to localStorage. Active language uses #D4213D fill (Polish flag red).
 * Used in: Navbar only.
 */
"use client";
import { useState, useEffect } from "react";

export type Lang = "pl" | "en";
const STORAGE_KEY = "powietrze_lang";

export function useLang(): [Lang, (l: Lang) => void] {
  const [lang, setLangState] = useState<Lang>("pl");
  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored === "pl" || stored === "en") setLangState(stored);
  }, []);
  const setLang = (l: Lang) => {
    localStorage.setItem(STORAGE_KEY, l);
    setLangState(l);
  };
  return [lang, setLang];
}

type Props = { lang: Lang; onChange: (l: Lang) => void; };

export default function LanguageSwitcher({ lang, onChange }: Props) {
  const base: React.CSSProperties = {
    padding: "4px 12px", fontSize: 12, fontWeight: 500,
    borderRadius: 20, cursor: "pointer", border: "0.5px solid",
    transition: "all 0.15s",
  };
  const active: React.CSSProperties = {
    ...base, background: "#D4213D", borderColor: "#D4213D", color: "#ffffff",
  };
  const inactive: React.CSSProperties = {
    ...base, background: "transparent", borderColor: "var(--color-border-secondary)",
    color: "var(--color-text-secondary)",
  };
  return (
    <div style={{ display: "flex", gap: 4 }}>
      <button style={lang === "pl" ? active : inactive} onClick={() => onChange("pl")}>PL</button>
      <button style={lang === "en" ? active : inactive} onClick={() => onChange("en")}>EN</button>
    </div>
  );
}
