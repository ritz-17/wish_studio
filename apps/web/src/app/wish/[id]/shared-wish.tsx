"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

type Wish = {
  id: string;
  occasion: "BIRTHDAY" | "ANNIVERSARY" | "RETIREMENT" | "GRADUATION";
  recipients: string[];
  message: string;
};

// Empty in production: the API is served from the same origin behind the reverse proxy.
const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "";

const occasionLabels: Record<Wish["occasion"], string> = {
  BIRTHDAY: "Birthday",
  ANNIVERSARY: "Anniversary",
  RETIREMENT: "Retirement",
  GRADUATION: "Graduation",
};

export default function SharedWish({ id }: { id: string }) {
  const [wish, setWish] = useState<Wish | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    fetch(`${API_URL}/api/wishes/${encodeURIComponent(id)}`)
      .then(async (response) => {
        const result = (await response.json()) as { wish?: Wish; error?: string };
        if (!response.ok || !result.wish) throw new Error(result.error ?? "Could not load this wish.");
        if (!cancelled) setWish(result.wish);
      })
      .catch((loadError) => {
        if (!cancelled) setError(loadError instanceof Error ? loadError.message : "Could not load this wish.");
      });
    return () => {
      cancelled = true;
    };
  }, [id]);

  return (
    <main className="studio-shell">
      <header className="topbar">
        <Link className="brand" href="/" aria-label="Wish Studio home">
          <span className="brand-mark" aria-hidden="true">w.</span>
          <span>WISH<span className="brand-light">STUDIO</span></span>
        </Link>
        <div className="topbar-right">
          <span className="topbar-note">SMALL WORDS. BIG MOMENTS.</span>
        </div>
      </header>

      <section className="shared-wish" aria-live="polite">
        {!wish && !error && <p className="shared-status">Opening your wish…</p>}

        {error && (
          <div className="shared-status">
            <p>{error}</p>
            <Link className="primary-button" href="/">Make your own wish <span>↗</span></Link>
          </div>
        )}

        {wish && (
          <>
            <p className="eyebrow">SOMEONE MADE THIS FOR YOU <span>✳</span></p>
            <div className="final-preview">
              <div className="preview-strip"><span>{occasionLabels[wish.occasion].toUpperCase()}</span><span>MADE WITH CARE <i>✳</i></span></div>
              <h3>{wish.recipients.join(" & ")}<span>,</span></h3>
              <p>{wish.message}</p>
              <div className="preview-signoff">A LITTLE WISH, JUST FOR YOU <span>♥</span></div>
            </div>
            <Link className="primary-button shared-cta" href="/">Make your own wish <span>↗</span></Link>
          </>
        )}
      </section>

      <footer className="site-footer"><span>WISH STUDIO <i>✳</i></span><span>FOR THE DAYS THAT DESERVE A LITTLE MORE</span></footer>
    </main>
  );
}
