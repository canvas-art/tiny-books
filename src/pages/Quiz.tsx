import { useCallback, useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router";
import { Check, RotateCcw, Swords, X, Zap } from "lucide-react";
import type { QuizCheck, QuizSubmitResult, QuizView } from "../../shared/types";
import { api, useApi } from "../api";
import { useMe } from "../me";
import { roman } from "../format";
import { ErrorState, Loading, nextHref } from "../components/ui";

export default function Quiz() {
  const { chapterId } = useParams();
  const { data, error } = useApi<QuizView>(`/quiz/${chapterId}`);
  const { reloadMe } = useMe();
  const nav = useNavigate();
  const [started, setStarted] = useState(false);
  const [idx, setIdx] = useState(0);
  const [choice, setChoice] = useState<number | null>(null);
  const [check, setCheck] = useState<QuizCheck | null>(null);
  const [answers, setAnswers] = useState<Record<number, number>>({});
  const [result, setResult] = useState<QuizSubmitResult | null>(null);
  const [busy, setBusy] = useState(false);
  const q = data?.questions[idx];

  const doCheck = useCallback(async () => {
    if (!data || !q || choice == null || busy) return;
    setBusy(true);
    try {
      setCheck(await api<QuizCheck>(`/quiz/${data.chapter.id}/check`, { body: { questionId: q.id, choice } }));
      setAnswers((a) => ({ ...a, [q.id]: choice }));
    } finally { setBusy(false); }
  }, [data, q, choice, busy]);

  const doNext = useCallback(async () => {
    if (!data || busy) return;
    if (idx + 1 < data.questions.length) { setIdx(idx + 1); setChoice(null); setCheck(null); return; }
    setBusy(true);
    try { setResult(await api<QuizSubmitResult>(`/quiz/${data.chapter.id}/submit`, { body: { answers } })); void reloadMe(); }
    finally { setBusy(false); }
  }, [data, idx, answers, busy, reloadMe]);

  useEffect(() => {
    if (!started || result || !q) return;
    const on = (e: KeyboardEvent) => {
      const n = Number(e.key);
      if (!check && n >= 1 && n <= q.options.length) setChoice(n - 1);
      if (e.key === "Enter") { e.preventDefault(); void (check ? doNext() : doCheck()); }
    };
    window.addEventListener("keydown", on);
    return () => window.removeEventListener("keydown", on);
  }, [started, result, q, check, doCheck, doNext]);

  const restart = () => { setIdx(0); setChoice(null); setCheck(null); setAnswers({}); setResult(null); };

  if (error) return <div className="focus"><ErrorState message={error.message} action={<Link className="btn" to="/">Back</Link>} /></div>;
  if (!data) return <div className="focus"><Loading /></div>;
  const close = <header className="focus-bar"><Link to="/" className="icon-btn" aria-label="Close"><X size={24} /></Link></header>;

  if (!started) {
    return (
      <div className="focus">
        {close}
        <div className="center-screen">
          <div className="emblem"><Swords size={44} strokeWidth={2} /></div>
          <h1>Book {roman(data.chapter.position)} quiz</h1>
          <p className="muted">{data.questions.length} questions · {data.passMark} to pass</p>
          <div className="actions"><button className="btn primary block" onClick={() => setStarted(true)}>Start</button></div>
        </div>
      </div>
    );
  }

  if (result) {
    return (
      <div className="focus">
        {close}
        <div className="center-screen">
          <div className={`emblem ${result.passed ? "good" : "gray"}`}>{result.passed ? <Check size={46} strokeWidth={3} /> : <RotateCcw size={40} strokeWidth={2.5} />}</div>
          <h1>{result.score} of {result.total}</h1>
          <p className="muted">{result.perfect ? "Perfect." : result.passed ? "Passed. Next book unlocked." : `You need ${data.passMark} to pass.`}</p>
          {result.xp > 0 && <div className="big-num" style={{ fontSize: 30, marginTop: 8 }}><Zap size={24} fill="currentColor" className="inline" /> +{result.xp} XP</div>}
          <div className="actions">
            {result.passed
              ? <button className="btn primary block" onClick={() => nav(result.next ? nextHref(result.next) : "/")}>Continue</button>
              : <button className="btn primary block" onClick={restart}>Try again</button>}
            <Link to="/" className="btn text">Back</Link>
          </div>
        </div>
      </div>
    );
  }

  if (!q) return null;
  return (
    <div className="focus">
      <header className="focus-bar">
        <Link to="/" className="icon-btn" aria-label="Quit"><X size={24} /></Link>
        <div className="track good"><div style={{ transform: `scaleX(${(idx + (check ? 1 : 0)) / data.questions.length})` }} /></div>
      </header>
      <div className="quiz-body" key={q.id}>
        <h2 className="question">{q.question}</h2>
        <div className="options">
          {q.options.map((opt, i) => {
            let cls = "option";
            if (check) cls += i === check.answer ? " right" : choice === i ? " wrong" : " dim";
            else if (choice === i) cls += " sel";
            return <button key={i} className={cls} disabled={!!check} onClick={() => setChoice(i)}>{opt}</button>;
          })}
        </div>
      </div>
      <footer className={`quiz-foot ${check ? (check.correct ? "good" : "bad") : ""}`}>
        <div className="quiz-foot-inner">
          {check && (
            <div className="verdict">
              <strong>{check.correct ? "Correct" : "Not quite"}</strong>
              {!check.correct && check.explanation && <p>{check.explanation}</p>}
            </div>
          )}
          {check
            ? <button className="btn primary block" disabled={busy} onClick={doNext}>Continue</button>
            : <button className="btn primary block" disabled={choice == null || busy} onClick={doCheck}>Check</button>}
        </div>
      </footer>
    </div>
  );
}
