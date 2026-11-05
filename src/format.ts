const NUMERALS: [number, string][] = [
  [1000, "M"], [900, "CM"], [500, "D"], [400, "CD"], [100, "C"], [90, "XC"], [50, "L"], [40, "XL"], [10, "X"], [9, "IX"], [5, "V"], [4, "IV"], [1, "I"],
];
export function roman(n: number) {
  let s = "";
  for (const [v, r] of NUMERALS) while (n >= v) { s += r; n -= v; }
  return s || String(n);
}

export function initials(name: string) {
  return name.split(" ").map((p) => p[0]).slice(0, 2).join("").toUpperCase();
}

/** SQLite "YYYY-MM-DD HH:MM:SS" (UTC) to Date. */
export const sqlDate = (s: string) => new Date(s.replace(" ", "T") + "Z");

export function timeAgo(s: string | null) {
  if (!s) return "not yet";
  const mins = Math.round((Date.now() - sqlDate(s).getTime()) / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const h = Math.round(mins / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.round(h / 24);
  return d === 1 ? "yesterday" : `${d}d ago`;
}

export function greeting() {
  const h = new Date().getHours();
  return h < 5 ? "Still up" : h < 12 ? "Good morning" : h < 18 ? "Good afternoon" : "Good evening";
}

export const shortDate = (s: string) => sqlDate(s).toLocaleDateString(undefined, { month: "short", day: "numeric" });
