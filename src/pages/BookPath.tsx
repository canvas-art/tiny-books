import { Link, useParams } from "react-router";
import { ChevronDown } from "lucide-react";
import type { BookDetail } from "../../shared/types";
import { api, useApi } from "../api";
import { useMe } from "../me";
import { ErrorState, Loading, Streak, Xp } from "../components/ui";
import { CoverThumb } from "../components/Cover";
import Path from "../path/Path";
import { usePathTheme } from "../path/registry";

export function BookRoute() {
  return <BookPath slug={useParams().slug!} />;
}

/** A book's screen: the top bar and the book's path, drawn in the book's theme. */
export default function BookPath({ slug }: { slug: string }) {
  const { data, error, reload } = useApi<BookDetail>(`/books/${slug}`);
  const { me, reloadMe } = useMe();
  const theme = usePathTheme(data ? data.book.path_theme ?? null : undefined);

  if (error) return <ErrorState message={error.message} action={<Link className="btn" to="/library">Library</Link>} />;
  if (!data || !me || !theme) return <Loading />;
  const { book, chapters } = data;
  const s = me.stats;

  const start = async () => {
    await api(`/books/${book.slug}/start`, { method: "POST" });
    await Promise.all([reload(), reloadMe()]);
  };

  return (
    <>
      <header className="path-top">
        <Link to="/library" className="book-switch">
          <CoverThumb book={book} />
          {book.title}<ChevronDown size={16} strokeWidth={2.5} />
        </Link>
        <div className="stats"><Streak n={s.streak} today={s.todayCount > 0} /><Xp n={s.xp} /></div>
      </header>

      {!book.enrolled && <div className="empty"><button className="btn primary" onClick={start}>Start reading</button></div>}

      <Path book={book} chapters={chapters} theme={theme} />
    </>
  );
}
