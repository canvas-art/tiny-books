import { useMe } from "../me";
import { Loading } from "../components/ui";
import Library from "./Library";
import BookPath from "./BookPath";

/** Home is the path of the book you're reading. No book yet? Pick one. */
export default function Home() {
  const { me } = useMe();
  if (!me) return <Loading />;
  return me.reading ? <BookPath slug={me.reading.book.slug} /> : <Library />;
}
