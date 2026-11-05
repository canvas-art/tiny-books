import { useState } from "react";
import { useNavigate } from "react-router";
import type { BookSummary } from "../../shared/types";
import { api, useApi } from "../api";
import { useMe } from "../me";
import { ErrorState, Loading } from "../components/ui";
import { Cover } from "../components/Cover";

export default function Library() {
  const { data, error } = useApi<BookSummary[]>("/books");
  const { reloadMe } = useMe();
  const nav = useNavigate();
  const [busy, setBusy] = useState<string | null>(null);
  if (error) return <ErrorState message={error.message} />;
  if (!data) return <Loading />;

  const open = async (b: BookSummary) => {
    if (!b.enrolled) {
      setBusy(b.slug);
      await api(`/books/${b.slug}/start`, { method: "POST" });
      await reloadMe();
    }
    nav("/");
  };

  return (
    <div className="page">
      <h1>Library</h1>
      <div className="list">
        {data.map((b) => (
          <div key={b.id} className="book-row">
            <Cover book={b} />
            <div className="info">
              <h2>{b.title}</h2>
              <p>{b.author}</p>
              <p>{b.totalMicros} micro-chapters · ~{Math.round(b.totalMinutes / b.totalMicros)} min each</p>
              <button className="btn primary small" disabled={busy === b.slug} onClick={() => open(b)}>
                {b.enrolled ? "Continue" : "Start reading"}
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
