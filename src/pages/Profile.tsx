import { useNavigate } from "react-router";
import { api } from "../api";
import { useMe } from "../me";
import { Avatar, Loading } from "../components/ui";

export default function Profile() {
  const { me, reloadMe } = useMe();
  const nav = useNavigate();
  if (!me) return <Loading />;
  const s = me.stats;
  const reset = async () => {
    if (!confirm("Reset your reading progress?")) return;
    await api("/demo/reset", { method: "POST" });
    await reloadMe();
    nav("/");
  };
  return (
    <div className="page">
      <div className="profile">
        <Avatar user={me.user} size={80} />
        <h1>{me.user.name}</h1>
      </div>
      <div className="stat-row">
        <div className="stat"><strong>{s.streak}</strong><small>day streak</small></div>
        <div className="stat"><strong>{s.xp}</strong><small>XP</small></div>
        <div className="stat"><strong>{s.completed}</strong><small>read</small></div>
      </div>
      <button className="btn text" onClick={reset}>Reset demo progress</button>
    </div>
  );
}
