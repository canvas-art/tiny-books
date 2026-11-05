import { NavLink, Outlet, useLocation } from "react-router";
import { useEffect, useLayoutEffect } from "react";
import { BookOpen, Trophy, User, Users } from "lucide-react";
import { useMe } from "../me";
import { prefetch } from "../api";
import { loadPathTheme } from "../path/registry";

const NAV = [
  { to: "/", label: "Read", icon: BookOpen, end: true },
  { to: "/groups", label: "Groups", icon: Users },
  { to: "/league", label: "League", icon: Trophy },
  { to: "/profile", label: "Profile", icon: User },
];

export function Shell() {
  const { me, reloadMe } = useMe();
  const { pathname } = useLocation();

  // New screens start at the top. Layout effect, so it runs before a screen's own scroll (e.g. the path
  // scrolling to your next step) instead of undoing it.
  useLayoutEffect(() => { window.scrollTo(0, 0); }, [pathname]);
  // Fresh streak / XP after reading or a quiz.
  useEffect(() => { void reloadMe(); }, [pathname]); // eslint-disable-line react-hooks/exhaustive-deps

  // Load every tab's data up front so switching tabs never waits on the network.
  useEffect(() => {
    void prefetch("/groups");
    void prefetch("/league");
    void prefetch("/books");
  }, []);
  const reading = me?.reading?.book;
  useEffect(() => {
    if (!reading) return;
    void prefetch(`/books/${reading.slug}`);
    void loadPathTheme(reading.path_theme); // the path's artwork and fonts, so Home opens fully drawn
  }, [reading?.slug, reading?.path_theme]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="shell">
      <aside className="sidebar">
        {NAV.map(({ to, label, icon: Icon, end }) => (
          <NavLink key={to} to={to} end={end} className="nav-item"><Icon size={21} strokeWidth={2} />{label}</NavLink>
        ))}
      </aside>
      <main className="main">
        {/* Keyed so each screen fades in on its own. */}
        <div key={pathname} className="screen"><Outlet /></div>
      </main>
      <nav className="tabbar">
        {NAV.map(({ to, label, icon: Icon, end }) => (
          <NavLink key={to} to={to} end={end} className="tab"><Icon size={24} strokeWidth={2} /><span>{label}</span></NavLink>
        ))}
      </nav>
    </div>
  );
}
