"use client";

import { BadgeCheck, Check, CircleHelp, Star, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import type { PublicReview } from "./types";

type Review = PublicReview & {
  status: "PENDING" | "PUBLISHED" | "REJECTED";
  // The registered patient who wrote it (name and code only; the mobile number is never sent).
  patient: { name: string; patientCode: string } | null;
};

const statusLabels: Record<Review["status"], string> = {
  PENDING: "Pending",
  PUBLISHED: "Published",
  REJECTED: "Rejected",
};

const FILTERS = [
  { value: "ALL", label: "All" },
  { value: "PENDING", label: "Pending" },
  { value: "PUBLISHED", label: "Published" },
  { value: "REJECTED", label: "Rejected" },
] as const;

// Tailwind needs whole class names in the source, so each state spells its classes out.
const STATUS_PILL: Record<Review["status"], string> = {
  PENDING: "bg-warning-bg text-warning-text",
  PUBLISHED: "bg-success-bg text-success-text",
  REJECTED: "bg-danger-bg text-danger-text",
};
const STATUS_EDGE: Record<Review["status"], string> = {
  PENDING: "border-l-amber-500 bg-linear-to-r from-amber-500/10 to-transparent to-40%",
  PUBLISHED: "border-l-green-600",
  REJECTED: "border-l-red-600",
};

const initials = (name: string) =>
  name.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]?.toUpperCase()).join("") || "?";

function Stars({ rating }: { rating: number }) {
  return (
    <span className="inline-flex gap-0.5" role="img" aria-label={`${rating} out of 5 stars`}>
      {[1, 2, 3, 4, 5].map((value) => (
        <Star key={value} size={15} aria-hidden="true" className={value <= rating ? "fill-amber-500 text-amber-500" : "text-line-2"} />
      ))}
    </span>
  );
}

export default function ReviewManagement() {
  const [reviews, setReviews] = useState<Review[]>([]);
  const [filter, setFilter] = useState<"ALL" | Review["status"]>("ALL");
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    fetch("/public_website/api/reviews/moderation", { cache: "no-store" })
      .then(async (response) => {
        const result = await response.json() as { reviews?: Review[]; error?: string };
        if (!response.ok) throw new Error(result.error ?? "Could not load reviews.");
        return result;
      })
      .then((result) => {
        if (active) setReviews(result.reviews ?? []);
      })
      .catch((loadError: unknown) => {
        if (active) setError(loadError instanceof Error ? loadError.message : "Could not load reviews.");
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  async function changeStatus(review: Review, status: "PUBLISHED" | "REJECTED") {
    setBusyId(review.id);
    setError("");
    try {
      const response = await fetch("/public_website/api/reviews/moderation", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: review.id, status }),
      });
      const result = await response.json() as { review?: Review; error?: string };
      if (!response.ok) throw new Error(result.error ?? "Could not update review.");
      const updatedReview = result.review;
      if (!updatedReview) throw new Error("The server returned no updated review.");
      setReviews((current) => current.map((item) => item.id === review.id ? updatedReview : item));
    } catch (updateError) {
      setError(updateError instanceof Error ? updateError.message : "Could not update review.");
    } finally {
      setBusyId("");
    }
  }

  // Reviews waiting for a decision come first, then newest first.
  const sorted = useMemo(
    () => [...reviews].sort((first, second) =>
      Number(second.status === "PENDING") - Number(first.status === "PENDING") || second.createdAt.localeCompare(first.createdAt)),
    [reviews],
  );
  const counts = useMemo(() => ({
    ALL: reviews.length,
    PENDING: reviews.filter((review) => review.status === "PENDING").length,
    PUBLISHED: reviews.filter((review) => review.status === "PUBLISHED").length,
    REJECTED: reviews.filter((review) => review.status === "REJECTED").length,
  }), [reviews]);
  const published = reviews.filter((review) => review.status === "PUBLISHED");
  const average = published.length ? published.reduce((sum, review) => sum + review.rating, 0) / published.length : 0;
  const visibleReviews = sorted.filter((review) => filter === "ALL" || review.status === filter);

  return (
    <section className="panel-card grid gap-4 p-5 max-sm:p-3.5">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="panel-title">Patient feedback</h2>
          <p className="panel-description max-w-xl">New reviews stay private until you publish them. Only published reviews appear on the website.</p>
        </div>
        <div className="grid justify-items-center gap-0.5 rounded-card border border-warning-border bg-warning-bg px-4 py-2.5 text-warning-text" role="group" aria-label="Average rating of published reviews">
          <strong className="text-[26px] leading-none">{published.length ? average.toFixed(1) : "—"}</strong>
          <Stars rating={Math.round(average)} />
          <small className="text-xs">{published.length} published</small>
        </div>
      </header>

      <div className="flex flex-wrap gap-2" role="group" aria-label="Filter reviews by status">
        {FILTERS.map((item) => (
          <button
            key={item.value}
            type="button"
            aria-pressed={filter === item.value}
            className={`inline-flex cursor-pointer items-center gap-2 rounded-full border px-3.5 py-1.5 text-[13px] font-semibold transition-colors ${
              filter === item.value
                ? "border-transparent bg-linear-to-br from-brand-500 to-brand-700 text-white"
                : "border-line-1 bg-transparent text-ink-1 hover:bg-brand-600/10"
            }`}
            onClick={() => setFilter(item.value)}
          >
            {item.label}{" "}
            <span className={`min-w-5.5 rounded-full px-1.5 text-center text-xs ${
              filter === item.value ? "bg-white/25" : item.value === "PENDING" ? "bg-warning-bg text-warning-text" : "bg-black/10 dark:bg-white/15"
            }`}>{counts[item.value]}</span>
          </button>
        ))}
      </div>

      {error && <p className="m-0 text-sm text-danger-text" role="alert">{error}</p>}
      {loading ? (
        <div className="loading-state">Loading reviews…</div>
      ) : visibleReviews.length ? (
        <div className="grid gap-3">
          {visibleReviews.map((review) => (
            <article className={`grid grid-cols-[44px_minmax(0,1fr)] gap-3.5 rounded-card border border-l-4 border-line-1 bg-surface-1 p-4 max-sm:grid-cols-1 ${STATUS_EDGE[review.status]}`} key={review.id}>
              <div className="grid size-11 place-items-center rounded-full bg-linear-to-br from-brand-100 to-info-bg text-[15px] font-bold text-brand-800 dark:text-ink-1" aria-hidden="true">{initials(review.name)}</div>
              <div className="grid min-w-0 gap-2">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="grid gap-1">
                    <strong className="text-[15px]">{review.name}</strong>
                    <Stars rating={review.rating} />
                  </div>
                  <span className={`rounded-full px-2.5 py-1 text-xs font-bold ${STATUS_PILL[review.status]}`}>{statusLabels[review.status]}</span>
                </div>
                <p className={`m-0 flex flex-wrap items-center gap-1.5 text-[12.5px] ${review.patient ? "text-success-text" : "text-ink-3"}`}>
                  {review.patient
                    ? <><BadgeCheck size={14} aria-hidden="true" /> Verified patient: <strong>{review.patient.name}</strong> ({review.patient.patientCode})</>
                    : <><CircleHelp size={14} aria-hidden="true" /> Not linked to a patient record (written before patient verification)</>}
                </p>
                <blockquote className="m-0 rounded-r-lg border-l-[3px] border-brand-600/35 bg-brand-600/5 px-3.5 py-2.5 text-sm leading-7 wrap-anywhere whitespace-pre-wrap text-ink-1" lang={/[ঀ-৿]/.test(review.comment) ? "bn" : undefined}>{review.comment}</blockquote>
                <div className="flex flex-wrap items-center justify-between gap-2.5">
                  <time className="text-[12.5px] text-ink-3" dateTime={review.createdAt}>{new Intl.DateTimeFormat("en", { dateStyle: "medium", timeZone: "Asia/Dhaka" }).format(new Date(review.createdAt))}</time>
                  <div className="flex flex-wrap gap-2">
                    {review.status !== "PUBLISHED" && (
                      <button type="button" className="button-primary inline-flex items-center gap-1.5" disabled={busyId === review.id} onClick={() => void changeStatus(review, "PUBLISHED")}>
                        <Check size={14} /> {busyId === review.id ? "Saving…" : "Publish"}
                      </button>
                    )}
                    {review.status !== "REJECTED" && (
                      <button type="button" className="button-secondary inline-flex items-center gap-1.5" disabled={busyId === review.id} onClick={() => void changeStatus(review, "REJECTED")}>
                        <X size={14} /> {review.status === "PUBLISHED" ? "Unpublish and reject" : "Reject"}
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </article>
          ))}
        </div>
      ) : (
        <div className="empty-state">
          {reviews.length ? "No reviews with this status." : "No reviews yet. Reviews written on the website appear here for you to approve."}
        </div>
      )}
    </section>
  );
}
