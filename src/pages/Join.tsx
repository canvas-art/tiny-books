import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router";
import { api, ApiError } from "../api";
import { ErrorState, Loading } from "../components/ui";

export default function Join() {
  const { code } = useParams();
  const nav = useNavigate();
  const [err, setErr] = useState<string | null>(null);
  useEffect(() => {
    api<{ id: number }>("/groups/join", { body: { code } })
      .then(({ id }) => nav(`/groups/${id}`, { replace: true }))
      .catch((e) => setErr(e instanceof ApiError ? e.message : "Couldn't join the group"));
  }, [code, nav]);
  return err ? <ErrorState message={err} action={<Link to="/groups" className="btn">Your groups</Link>} /> : <Loading />;
}
