import { useEffect, useState, type FormEvent, type ReactNode } from "react";
import { ApiError, request } from "../http";
import { Loading } from "./ui";

// A shareable link can carry the code (/?code=...). Read it once, then take it out of the address bar.
const params = new URLSearchParams(location.search);
const codeFromUrl = params.get("code");
if (codeFromUrl) {
  params.delete("code");
  const query = params.toString();
  history.replaceState(null, "", location.pathname + (query ? `?${query}` : "") + location.hash);
}

const unlock = (code: string) => request<{ granted: boolean }>("/access", { code });

/** Holds the app back until the visitor has entered the access code, so nothing calls the API before then. */
export function AccessGate({ children }: { children: ReactNode }) {
  const [granted, setGranted] = useState<boolean | null>(null);
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const fail = (e: unknown) => {
    setGranted(false);
    setError(e instanceof ApiError ? e.message : "Couldn't reach the server");
  };

  useEffect(() => {
    if (codeFromUrl) unlock(codeFromUrl).then(() => setGranted(true)).catch(fail);
    else request<{ granted: boolean }>("/access").then((r) => setGranted(r.granted)).catch(() => setGranted(false));
  }, []);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await unlock(code);
      setGranted(true);
    } catch (err) {
      fail(err);
    } finally {
      setBusy(false);
    }
  };

  if (granted === null) return <Loading />;
  if (granted) return <>{children}</>;

  return (
    <form className="access" onSubmit={submit}>
      <h1>Tiny Books</h1>
      <p>Enter the access code to open the app.</p>
      <input
        className="field"
        aria-label="Access code"
        placeholder="Access code"
        autoFocus
        autoComplete="off"
        autoCapitalize="none"
        spellCheck={false}
        maxLength={128}
        value={code}
        onChange={(e) => setCode(e.target.value)}
      />
      {error && <p className="error" role="alert">{error}</p>}
      <button className="btn primary block" disabled={busy || !code.trim()}>Open</button>
    </form>
  );
}
