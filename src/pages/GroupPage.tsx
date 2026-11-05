import { useState } from "react";
import { Link, useParams, useSearchParams } from "react-router";
import { ArrowLeft, Check, Copy } from "lucide-react";
import type { GroupDetail } from "../../shared/types";
import { api, ApiError, useApi } from "../api";
import { ErrorState, Leaderboard, Loading } from "../components/ui";

export default function GroupPage() {
  const { id } = useParams();
  const [params, setParams] = useSearchParams();
  const { data, error } = useApi<GroupDetail>(`/groups/${id}`);
  if (error) return <ErrorState message={error.message} action={<Link className="btn" to="/groups">Groups</Link>} />;
  if (!data) return <Loading />;
  const { group, rows } = data;
  return (
    <div className="page">
      <Link to="/groups" className="back"><ArrowLeft size={16} /> Groups</Link>
      <div className="page-title">
        <div>
          <h1>{group.name}</h1>
          <p className="sub">{group.members} members · {group.book.title}</p>
        </div>
        <button className="btn small" onClick={() => setParams({ invite: "1" })}>Invite</button>
      </div>
      <Leaderboard rows={rows} />
      {params.get("invite") === "1" && <Invite code={group.inviteCode} groupId={group.id} onClose={() => setParams({})} />}
    </div>
  );
}

function Invite({ code, groupId, onClose }: { code: string; groupId: number; onClose: () => void }) {
  const [email, setEmail] = useState("");
  const [copied, setCopied] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const copy = async () => {
    try { await navigator.clipboard.writeText(`${location.origin}/join/${code}`); setCopied(true); setTimeout(() => setCopied(false), 1500); } catch { /* blocked */ }
  };
  const send = async (e: React.FormEvent) => {
    e.preventDefault();
    try { await api(`/groups/${groupId}/invite`, { body: { email } }); setMsg({ ok: true, text: `Invite sent to ${email}` }); setEmail(""); }
    catch (e) { setMsg({ ok: false, text: e instanceof ApiError ? e.message : "Couldn't send the invite" }); }
  };
  return (
    <div className="sheet-backdrop" onClick={onClose}>
      <div className="sheet" onClick={(e) => e.stopPropagation()}>
        <h2>Invite friends</h2>
        <div className="code-box">
          <code>{code}</code>
          <button className="btn small" onClick={copy}>{copied ? <><Check size={16} /> Copied</> : <><Copy size={16} /> Copy link</>}</button>
        </div>
        <form onSubmit={send} style={{ display: "flex", gap: 8 }}>
          <input className="field" type="email" placeholder="or invite by email" value={email} onChange={(e) => setEmail(e.target.value)} />
          <button className="btn primary" disabled={!email}>Send</button>
        </form>
        {msg && <p className={msg.ok ? "ok" : "error"}>{msg.text}</p>}
      </div>
    </div>
  );
}
