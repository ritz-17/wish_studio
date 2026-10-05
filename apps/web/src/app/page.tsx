"use client";

import { useEffect, useState } from "react";

type Occasion = "BIRTHDAY" | "ANNIVERSARY" | "RETIREMENT" | "GRADUATION";
type ApiStatus = "checking" | "online" | "offline";

const MAX_RECIPIENTS = 5;
// Empty in production: the API is served from the same origin behind the reverse proxy.
const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "";

const occasions: { value: Occasion; label: string; detail: string; index: string }[] = [
  { value: "BIRTHDAY", label: "Birthday", detail: "Another trip around the sun", index: "01" },
  { value: "ANNIVERSARY", label: "Anniversary", detail: "A love worth celebrating", index: "02" },
  { value: "RETIREMENT", label: "Retirement", detail: "A well-earned new chapter", index: "03" },
  { value: "GRADUATION", label: "Graduation", detail: "The start of what comes next", index: "04" },
];

const wishOpeners: Record<Occasion, string> = {
  BIRTHDAY: "Wishing you a year full of joy, good surprises, and all the things you love.",
  ANNIVERSARY: "May your life together keep growing in laughter, kindness, and love.",
  RETIREMENT: "Wishing you slow mornings, new adventures, and a retirement that feels like yours.",
  GRADUATION: "May this be the beginning of brave ideas, bright opportunities, and wonderful things.",
};

const steps = ["Occasion", "People", "Your words", "Preview"];

export default function Home() {
  const [step, setStep] = useState(1);
  const [occasion, setOccasion] = useState<Occasion>("BIRTHDAY");
  const [recipients, setRecipients] = useState([""]);
  const [message, setMessage] = useState(wishOpeners.BIRTHDAY);
  const [apiStatus, setApiStatus] = useState<ApiStatus>("checking");
  const [saving, setSaving] = useState(false);
  const [savedId, setSavedId] = useState("");
  const [feedback, setFeedback] = useState("");

  useEffect(() => {
    let cancelled = false;
    const socketUrl = new URL(API_URL || window.location.origin);
    socketUrl.protocol = socketUrl.protocol === "https:" ? "wss:" : "ws:";
    socketUrl.pathname = "/ws";

    fetch(`${API_URL}/api/health`)
      .then((response) => {
        if (!response.ok) throw new Error("API unavailable");
        if (!cancelled) setApiStatus("online");
      })
      .catch(() => {
        if (!cancelled) setApiStatus("offline");
      });

    const socket = new WebSocket(socketUrl);
    socket.addEventListener("open", () => {
      if (!cancelled) setApiStatus("online");
    });
    socket.addEventListener("close", () => {
      if (!cancelled) setApiStatus("offline");
    });
    socket.addEventListener("error", () => {
      if (!cancelled) setApiStatus("offline");
    });
    socket.addEventListener("message", (event) => {
      const payload = JSON.parse(String(event.data)) as { type?: string };
      if (payload.type === "wish.created" && !cancelled) {
        setFeedback("Wish saved and shared live.");
      }
    });

    return () => {
      cancelled = true;
      socket.close();
    };
  }, []);

  const selectedOccasion = occasions.find((item) => item.value === occasion) ?? occasions[0];
  const cleanRecipients = recipients.map((recipient) => recipient.trim()).filter(Boolean);
  const wishText = `${cleanRecipients.join(" & ")} — ${message.trim()}`;
  const shareUrl = savedId && typeof window !== "undefined" ? `${window.location.origin}/wish/${savedId}` : "";

  function chooseOccasion(value: Occasion) {
    setOccasion(value);
    setMessage(wishOpeners[value]);
    setSavedId("");
    setFeedback("");
  }

  function updateRecipient(recipientIndex: number, value: string) {
    setRecipients((currentRecipients) =>
      currentRecipients.map((recipient, currentIndex) =>
        currentIndex === recipientIndex ? value : recipient,
      ),
    );
    setSavedId("");
  }

  function continueFlow() {
    if (step === 2) {
      if (cleanRecipients.length === 0) {
        setFeedback("Add at least one name to continue.");
        return;
      }
      setRecipients(cleanRecipients);
    }
    if (step === 3 && !message.trim()) {
      setFeedback("Write a few words for your wish first.");
      return;
    }
    setFeedback("");
    setStep((currentStep) => Math.min(4, currentStep + 1));
  }

  function goBack() {
    setFeedback("");
    setStep((currentStep) => Math.max(1, currentStep - 1));
  }

  function startOver() {
    setStep(1);
    setOccasion("BIRTHDAY");
    setRecipients([""]);
    setMessage(wishOpeners.BIRTHDAY);
    setSavedId("");
    setFeedback("");
  }

  async function saveWish() {
    if (cleanRecipients.length === 0 || !message.trim()) return;
    setSaving(true);
    setFeedback("");
    try {
      const response = await fetch(`${API_URL}/api/wishes`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ occasion, recipients: cleanRecipients, message: message.trim() }),
      });
      const result = (await response.json()) as { wish?: { id: string }; error?: string };
      if (!response.ok || !result.wish) throw new Error(result.error ?? "Could not save this wish.");
      setSavedId(result.wish.id);
      setFeedback("Wish saved. Your share link is ready.");
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : "Could not save this wish.");
    } finally {
      setSaving(false);
    }
  }

  async function shareWish() {
    try {
      if (navigator.share) {
        await navigator.share(
          shareUrl
            ? { title: `${selectedOccasion.label} wish`, text: `A wish for ${cleanRecipients.join(" & ")}`, url: shareUrl }
            : { title: `${selectedOccasion.label} wish`, text: wishText },
        );
      } else {
        await navigator.clipboard.writeText(shareUrl || wishText);
        setFeedback(shareUrl ? "Link copied to your clipboard." : "Wish copied to your clipboard.");
      }
    } catch (error) {
      if (error instanceof Error && error.name !== "AbortError") {
        setFeedback("Sharing isn’t available here. Copy the wish text instead.");
      }
    }
  }

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(shareUrl);
      setFeedback("Link copied to your clipboard.");
    } catch {
      setFeedback("Clipboard access isn’t available in this browser. Copy the link above instead.");
    }
  }

  async function copyWish() {
    try {
      await navigator.clipboard.writeText(wishText);
      setFeedback("Wish copied to your clipboard.");
    } catch {
      setFeedback("Clipboard access isn’t available in this browser.");
    }
  }

  return (
    <main className="studio-shell">
      <header className="topbar">
        <a className="brand" href="#home" aria-label="Wish Studio home">
          <span className="brand-mark" aria-hidden="true">w.</span>
          <span>WISH<span className="brand-light">STUDIO</span></span>
        </a>
        <div className="topbar-right">
          <span className="topbar-note">SMALL WORDS. BIG MOMENTS.</span>
          <span className={`connection-status ${apiStatus}`}>
            <i /> {apiStatus === "checking" ? "CONNECTING" : apiStatus === "online" ? "LIVE" : "OFFLINE"}
          </span>
        </div>
      </header>

      <section className="studio-grid" id="home">
        <div className="composer-column">
          <div className="intro-row">
            <div>
              <p className="eyebrow">THE CELEBRATION DESK <span>✳</span></p>
              <h1>Make a moment<br /><em>mean more.</em></h1>
            </div>
            <p className="intro-aside">A thoughtful wish, made personal and ready to share.</p>
          </div>

          <nav className="step-nav" aria-label="Wish creation steps">
            {steps.map((label, index) => {
              const stepNumber = index + 1;
              return (
                <div className={`step-item ${stepNumber === step ? "active" : ""} ${stepNumber < step ? "complete" : ""}`} key={label}>
                  <span>{stepNumber < step ? "✓" : `0${stepNumber}`}</span>
                  <b>{label}</b>
                </div>
              );
            })}
          </nav>

          <section className="form-panel" aria-live="polite">
            <div className="panel-heading">
              <div>
                <p className="step-caption">STEP 0{step} / 04</p>
                <h2>{step === 1 ? "What are we celebrating?" : step === 2 ? "Who is it for?" : step === 3 ? "Put it into words." : "One last look."}</h2>
              </div>
              <span className="heading-spark" aria-hidden="true">✳</span>
            </div>

            {step === 1 && (
              <div className="occasion-grid">
                {occasions.map((item) => (
                  <button
                    aria-pressed={occasion === item.value}
                    className={`occasion-option ${occasion === item.value ? "selected" : ""}`}
                    key={item.value}
                    onClick={() => chooseOccasion(item.value)}
                    type="button"
                  >
                    <span className="occasion-index">{item.index}</span>
                    <span className="occasion-copy"><b>{item.label}</b><small>{item.detail}</small></span>
                    <span className="option-check" aria-hidden="true">{occasion === item.value ? "✓" : "+"}</span>
                  </button>
                ))}
              </div>
            )}

            {step === 2 && (
              <div className="recipient-editor">
                <p className="field-hint">Add one to five people. They’ll share this same wish.</p>
                {recipients.map((recipient, recipientIndex) => (
                  <div className="recipient-row" key={recipientIndex}>
                    <span className="recipient-number">0{recipientIndex + 1}</span>
                    <input
                      aria-label={`Recipient ${recipientIndex + 1}`}
                      autoComplete="off"
                      maxLength={60}
                      onChange={(event) => updateRecipient(recipientIndex, event.target.value)}
                      placeholder="Enter a name"
                      value={recipient}
                    />
                    {recipients.length > 1 && (
                      <button
                        aria-label={`Remove recipient ${recipientIndex + 1}`}
                        className="remove-recipient"
                        onClick={() => setRecipients((current) => current.filter((_, index) => index !== recipientIndex))}
                        type="button"
                      >×</button>
                    )}
                  </div>
                ))}
                {recipients.length < MAX_RECIPIENTS && (
                  <button className="add-recipient" onClick={() => setRecipients((current) => [...current, ""])} type="button">
                    <span>+</span> Add another name <small>{recipients.length}/{MAX_RECIPIENTS}</small>
                  </button>
                )}
              </div>
            )}

            {step === 3 && (
              <div className="message-editor">
                <label htmlFor="wish-message">YOUR WISH</label>
                <textarea
                  id="wish-message"
                  maxLength={2000}
                  onChange={(event) => { setMessage(event.target.value); setSavedId(""); }}
                  placeholder="Write something that sounds like you..."
                  rows={6}
                  value={message}
                />
                <div className="message-meta"><span>Make it yours. Edit every word.</span><span>{message.length}/2000</span></div>
              </div>
            )}

            {step === 4 && (
              <div className="final-preview">
                <div className="preview-strip"><span>{selectedOccasion.label.toUpperCase()}</span><span>MADE WITH CARE <i>✳</i></span></div>
                <h3>{cleanRecipients.join(" & ")}<span>,</span></h3>
                <p>{message}</p>
                <div className="preview-signoff">A LITTLE WISH, JUST FOR YOU <span>♥</span></div>
              </div>
            )}

            {step === 4 && shareUrl && (
              <div className="share-link">
                <input aria-label="Share link" onFocus={(event) => event.target.select()} readOnly value={shareUrl} />
                <button className="quiet-button" onClick={copyLink} type="button">Copy link</button>
                <a className="quiet-button" href={shareUrl} rel="noreferrer" target="_blank">Open ↗</a>
              </div>
            )}

            {feedback && <p className={`feedback ${savedId ? "success" : ""}`} role="status">{feedback}</p>}

            <div className="panel-actions">
              {step > 1 ? <button className="back-button" onClick={goBack} type="button">← Back</button> : <span />}
              {step < 4 ? (
                <button className="primary-button" onClick={continueFlow} type="button">Continue <span>↗</span></button>
              ) : (
                <div className="final-actions">
                  <button className="quiet-button" onClick={copyWish} type="button">Copy wish</button>
                  <button className="quiet-button" onClick={shareWish} type="button">Share ↗</button>
                  <button className="primary-button" disabled={saving || Boolean(savedId)} onClick={saveWish} type="button">
                    {saving ? "Saving…" : savedId ? "Saved ✓" : "Save & get link"}
                  </button>
                </div>
              )}
            </div>
          </section>
        </div>

        <aside className="side-column">
          <section className="live-card">
            <div className="live-photo" role="img" aria-label="A candlelit celebration table">
              <span>YOUR MOMENT, IN THE MAKING</span>
              <b>✳</b>
            </div>
            <div className="live-card-body">
              <div className="live-card-title"><span>YOUR DRAFT</span><span className="draft-count">0{step} / 04</span></div>
              <h2>{selectedOccasion.label}<span> / </span>{cleanRecipients.length ? `${cleanRecipients.length} ${cleanRecipients.length === 1 ? "person" : "people"}` : "Add a name"}</h2>
              <p>{message || "Your words will find their place here."}</p>
              <div className="draft-rule" />
              <div className="draft-footer"><span>UP TO {MAX_RECIPIENTS} RECIPIENTS</span><span>✦</span></div>
            </div>
          </section>
          <div className="aside-note"><span className="aside-note-mark">↗</span><p>Good wishes are better when they sound like you. Change anything, make it yours.</p></div>
          <button className="reset-button" onClick={startOver} type="button">Start a new wish <span>↺</span></button>
        </aside>
      </section>

      <footer className="site-footer"><span>WISH STUDIO <i>✳</i></span><span>FOR THE DAYS THAT DESERVE A LITTLE MORE</span></footer>
    </main>
  );
}
