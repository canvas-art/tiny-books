import type { BookSummary } from "../../shared/types";

type CoverBook = Pick<BookSummary, "title" | "author" | "cover" | "cover_image">;

export function Cover({ book }: { book: CoverBook }) {
  if (book.cover_image) {
    return (
      <div className="cover has-image" style={{ backgroundColor: book.cover ?? "#1e2a4a" }}>
        <img src={book.cover_image} alt="" loading="lazy" />
        <b>{book.title}</b>
      </div>
    );
  }
  return (
    <div className="cover" style={{ background: book.cover ?? "#1e2a4a" }}>
      <b>{book.title}</b>
      <span>{book.author}</span>
    </div>
  );
}

export function CoverThumb({ book }: { book: CoverBook }) {
  return book.cover_image
    ? <img className="book-thumb" src={book.cover_image} alt="" />
    : <span className="book-thumb" style={{ background: book.cover ?? "#1e2a4a" }} />;
}
