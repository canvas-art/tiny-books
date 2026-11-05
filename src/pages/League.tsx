import { Link } from "react-router";
import type { League } from "../../shared/types";
import { useApi } from "../api";
import { ErrorState, Leaderboard, Loading } from "../components/ui";

export default function LeaguePage() {
  const { data, error } = useApi<League>("/league");
  if (error) return <ErrorState message={error.message} />;
  if (!data) return <Loading />;
  return (
    <div className="page">
      <div>
        <h1>League</h1>
        <p className="sub">{data.cohort ? `${data.cohort.name} · readers who started ${data.book.title} the same week as you` : "Start a book to join a league."}</p>
      </div>
      {data.cohort ? <Leaderboard rows={data.rows} /> : <div className="empty"><Link to="/library" className="btn primary">Pick a book</Link></div>}
    </div>
  );
}
