"use client";
import { useEffect, useState } from "react";

type Theme = "light" | "dark";
const KEY = "ms-theme";
const sys = (): Theme => (matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light");

function apply(t: Theme, save: boolean, setTheme: (t: Theme) => void) {
  const de = document.documentElement;
  const swap = () => { de.dataset.theme = t; };
  const vt = (document as any).startViewTransition;
  // a cross-fade of the whole page where supported (gradients included), else a CSS colour fade
  if (vt && !matchMedia("(prefers-reduced-motion: reduce)").matches) vt.call(document, swap);
  else { de.classList.add("theme-anim"); swap(); }
  document.querySelector('meta[name="theme-color"]:not([media])')?.setAttribute("content", t === "dark" ? "#000000" : "#F3F4F2");
  if (save) try { localStorage.setItem(KEY, t); } catch {}
  setTheme(t);
  clearTimeout((window as any).__msThemeT);
  (window as any).__msThemeT = setTimeout(() => de.classList.remove("theme-anim"), 700);
}

/** Night mode: defaults to the system setting, remembers an explicit choice, fades between modes. */
export default function ThemeToggle() {
  const [theme, setTheme] = useState<Theme | null>(null);
  useEffect(() => {
    (window as any).__msThemeReady = true; // the head script stops handling clicks once React owns the button
    setTheme((document.documentElement.dataset.theme as Theme) || sys());
    const mq = matchMedia("(prefers-color-scheme: dark)");
    const on = () => { let saved: string | null = null; try { saved = localStorage.getItem(KEY); } catch {} if (!saved) apply(sys(), false, setTheme); };
    mq.addEventListener("change", on);
    return () => mq.removeEventListener("change", on);
  }, []);
  const dark = theme === "dark";
  return (
    <button type="button" className="theme-btn" aria-label={dark ? "Switch to day mode" : "Switch to night mode"} title={dark ? "Day mode" : "Night mode"} aria-pressed={dark} onClick={() => apply(dark ? "light" : "dark", true, setTheme)}>
      <svg className="ic-sun" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="4.2" /><path d="M12 2.5v2.2M12 19.3v2.2M4.6 4.6l1.6 1.6M17.8 17.8l1.6 1.6M2.5 12h2.2M19.3 12h2.2M4.6 19.4l1.6-1.6M17.8 6.2l1.6-1.6" /></svg>
      <svg className="ic-moon" viewBox="0 0 24 24" aria-hidden="true"><path d="M20 14.6A8.2 8.2 0 0 1 9.4 4a8.2 8.2 0 1 0 10.6 10.6z" /></svg>
    </button>
  );
}
