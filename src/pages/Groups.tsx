import { useState } from "react";
import { Link, useNavigate } from "react-router";
import { ChevronRight, Plus } from "lucide-react";
import type { GroupSummary } from "../../shared/types";
import { api, ApiError, useApi } from "../api";
import { ErrorState, Loading } from "../components/ui";

export default function Groups() {
  const { data, error } = useApi<GroupSummary[]>("/groups");
  const [creating, setCreating] = useState(false);
  if (error) return <ErrorState message={error.message} />;
  if (!data) return <Loading />;
  return (
    <div className="page">
      <div className="page-title">
        <h1>Groups</h1>
        <button className="btn small" onClick={() => setCreating(true)}><Plus size={18} /> New</button>
      </div>
      <div className="list">
        {data.map((g) => (
          <Link key={g.id} to={`/groups/${g.id}`} className="row-link">
            <span className="dot" style={{ background: g.color }}>{g.name[0]}</span>
            <span className="grow"><strong>{g.name}</strong><small>{g.members} members · you're #{g.myRank}</small></span>
            <ChevronRight className="chev" />
          </Link>
        ))}
        {data.length === 0 && <div className="empty"><p>No groups yet.</p></div>}
      </div>
      {creating && <CreateGroup onClose={() => setCreating(false)} />}
    </div>
  );
}

function CreateGroup({ onClose }: { onClose: () => void }) {
  const nav = useNavigate();
  const [name, setName] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true); setErr(null);
    try {
      const { id } = await api<{ id: number }>("/groups", { body: { name, book: "meditations" } });
      nav(`/groups/${id}?invite=1`);
    } catch (e) { setErr(e instanceof ApiError ? e.message : "Couldn't create the group"); setBusy(false); }
  };
  return (
    <div className="sheet-backdrop" onClick={onClose}>
      <form className="sheet" onClick={(e) => e.stopPropagation()} onSubmit={submit}>
        <h2>New group</h2>
        <p className="muted">Everyone in the group reads Meditations together.</p>
        <input className="field" autoFocus value={name} onChange={(e) => setName(e.target.value)} placeholder="Group name" maxLength={60} />
        {err && <p className="error">{err}</p>}
        <button className="btn primary block" disabled={busy || !name.trim()}>Create</button>
      </form>
    </div>
  );
}
