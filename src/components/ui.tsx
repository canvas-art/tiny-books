import type { ReactNode } from "react";
import { Flame, Zap } from "lucide-react";
import type { NextStep, RankRow, User } from "../../shared/types";
import { initials } from "../format";

export const nextHref = (n: NextStep) => (n.type === "micro" ? `/read/${n.id}` : `/quiz/${n.chapterId}`);

export function Avatar({ user, size = 36 }: { user: Pick<User, "name" | "color">; size?: number }) {
  return <span className="avatar" style={{ width: size, height: size, background: user.color, fontSize: size * 0.36 }} aria-hidden>{initials(user.name)}</span>;
}

/** Grey until today's micro-chapter is done. */
export function Streak({ n, today }: { n: number; today: boolean }) {
  return <span className={`pill streak ${today ? "" : "off"}`} title={`${n}-day streak`}><Flame size={18} strokeWidth={2.4} />{n}</span>;
}

export function Xp({ n }: { n: number }) {
  return <span className="pill xp" title={`${n} XP`}><Zap size={17} strokeWidth={2.4} fill="currentColor" />{n}</span>;
}

export function Loading() {
  return <div className="loading"><span /><span /><span /></div>;
}

export function ErrorState({ message, action }: { message: string; action?: ReactNode }) {
  return <div className="empty"><p>{message}</p>{action}</div>;
}

export function Leaderboard({ rows }: { rows: RankRow[] }) {
  return (
    <ol className="board">
      {rows.map((r, i) => (
        <li key={r.user.id} className={`${r.isMe ? "me" : ""} ${i === 0 && r.xp > 0 ? "first" : ""}`}>
          <span className="rank">{i + 1}</span>
          <Avatar user={r.user} />
          <span className="name">{r.isMe ? "You" : r.user.name}</span>
          <span className="score">{r.xp} XP</span>
        </li>
      ))}
    </ol>
  );
}
