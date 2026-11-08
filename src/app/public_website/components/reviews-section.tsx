"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { MessageSquareText, Quote, Star } from "lucide-react";
import { validatePhone } from "@/lib/contact-rules";
import { localize, usePublicLanguage } from "./public-language";
import type { PublicReview } from "./types";

export default function ReviewsSection({ title, subtitle }: { title: string; subtitle?: string }) {
  const { language } = usePublicLanguage();
  const languageRef = useRef(language);
  const [reviews, setReviews] = useState<PublicReview[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [fieldErrors, setFieldErrors] = useState<{ name?: string; phone?: string }>({});
  const [rating, setRating] = useState("5");
  const [comment, setComment] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  useEffect(() => {
    languageRef.current = language;
  }, [language]);

  useEffect(() => {
    let active = true;
    fetch("/public_website/api/reviews", { cache: "no-store" })
      .then(async (response) => {
        const result = await response.json() as { reviews?: PublicReview[]; error?: string };
        if (!response.ok) throw new Error(result.error ?? localize(languageRef.current, "Could not load reviews.", "রিভিউ লোড করা যায়নি।"));
        return result;
      })
      .then((result) => {
        if (active) setReviews(result.reviews ?? []);
      })
      .catch((loadError: unknown) => {
        if (active) setError(loadError instanceof Error ? loadError.message : localize(languageRef.current, "Could not load reviews.", "রিভিউ লোড করা যায়নি।"));
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  async function submitReview(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setNotice("");
    // Same checks the server makes, with messages in the visitor's language.
    const problems: { name?: string; phone?: string } = {};
    if (name.trim().length < 2) problems.name = localize(language, "Enter your name.", "আপনার নাম লিখুন।");
    if (!phone.trim()) problems.phone = localize(language, "Enter your registered mobile number.", "আপনার নিবন্ধিত মোবাইল নম্বর লিখুন।");
    else if (validatePhone(phone, true)) problems.phone = localize(language, "Enter a valid mobile number, for example 01712345678.", "একটি সঠিক মোবাইল নম্বর লিখুন, যেমন 01712345678।");
    setFieldErrors(problems);
    if (problems.name || problems.phone) {
      document.getElementById(problems.name ? "review-name" : "review-phone")?.focus();
      return;
    }
    setSubmitting(true);
    try {
      const response = await fetch("/public_website/api/reviews", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim(), phone: phone.trim(), rating: Number(rating), comment: comment.trim() }),
      });
      const result = await response.json() as { error?: string };
      if (response.status === 403) {
        throw new Error(localize(language, "We could not match this name and mobile number with our patient records. Please enter them as you gave them to the clinic.", "এই নাম ও মোবাইল নম্বর আমাদের রোগীর তালিকায় মেলেনি। ক্লিনিকে যেভাবে দিয়েছেন সেভাবেই লিখুন।"));
      }
      if (response.status === 409) {
        throw new Error(localize(language, "You have already shared a review. Thank you! You can write another once the clinic has handled it.", "আপনি ইতিমধ্যে একটি রিভিউ দিয়েছেন, ধন্যবাদ! ক্লিনিক সেটি দেখার পর আবার লিখতে পারবেন।"));
      }
      if (!response.ok) throw new Error(result.error ?? localize(language, "Could not submit review.", "রিভিউ জমা দেওয়া যায়নি।"));
      setName("");
      setPhone("");
      setFieldErrors({});
      setComment("");
      setRating("5");
      setShowForm(false);
      setNotice(localize(language, "Review submitted. The clinic will review it before publishing.", "রিভিউ জমা হয়েছে; প্রকাশের আগে ক্লিনিক যাচাই করবে।"));
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : localize(language, "Could not submit review.", "রিভিউ জমা দেওয়া যায়নি।"));
    } finally {
      setSubmitting(false);
    }
  }

  const average = reviews.length
    ? reviews.reduce((sum, review) => sum + review.rating, 0) / reviews.length
    : null;
  const locale = language === "bn" ? "bn-BD" : "en-US";
  const numbers = new Intl.NumberFormat(locale, { maximumFractionDigits: 1 });
  const bnNumbers = new Intl.NumberFormat("bn-BD");
  const formatMonth = (value: string) => {
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? "" : new Intl.DateTimeFormat(locale, { month: "long", year: "numeric" }).format(date);
  };
  const inputClass = "min-h-11 rounded-md border border-purple-200 bg-white px-3 text-sm font-normal text-ink outline-none focus:border-purple-700 focus:ring-2 focus:ring-purple-200";

  return (
    <section id="reviews" className="site-section border-t border-purple-200">
      <div className="site-container grid gap-10 lg:grid-cols-12 lg:gap-12">
        <div className="lg:col-span-4">
          <span aria-hidden="true" className="mb-3 block h-1 w-10 rounded-full bg-purple-400" />
          <h2 className="text-3xl font-bold leading-tight tracking-tight text-ink sm:text-4xl">{title}</h2>
          {subtitle && <p className="mt-3 max-w-sm text-base leading-relaxed text-slate-600">{subtitle}</p>}

          {average !== null && (
            <div className="mt-6 flex items-center gap-4 rounded-xl border border-purple-200 bg-white p-4">
              <p className="text-4xl font-bold tabular-nums leading-none text-ink">{numbers.format(average)}</p>
              <div>
                <div className="flex gap-0.5" aria-hidden="true">
                  {Array.from({ length: 5 }, (_, index) => <Star key={index} size={16} className={index < Math.round(average) ? "fill-amber-400 text-amber-400" : "text-purple-200"} />)}
                </div>
                <p className="mt-1 text-sm text-slate-600">
                  <span className="sr-only">{localize(language, `Average rating ${numbers.format(average)} out of 5. `, `গড় রেটিং ৫-এর মধ্যে ${numbers.format(average)}। `)}</span>
                  {localize(language, `Based on ${reviews.length} ${reviews.length === 1 ? "review" : "reviews"}`, `${bnNumbers.format(reviews.length)}টি রিভিউয়ের ভিত্তিতে`)}
                </p>
              </div>
            </div>
          )}

          <button type="button" onClick={() => setShowForm(!showForm)} aria-expanded={showForm} className="mt-6 inline-flex min-h-11 items-center gap-2 rounded-md border border-purple-700 bg-white px-5 text-sm font-semibold text-purple-700 transition-colors hover:bg-purple-100">
            <MessageSquareText size={16} aria-hidden="true" /> {localize(language, "Write a review", "আপনার রিভিউ লিখুন")}
          </button>
          {notice && <p className="mt-4 rounded-md bg-purple-100 px-3 py-2 text-sm font-medium text-purple-900" role="status">{notice}</p>}
        </div>

        <div className="lg:col-span-8">
          {error && !showForm && <p className="mb-5 rounded-md bg-rose-50 px-3 py-2 text-sm text-rose-700" role="alert">{error}</p>}

          {showForm && (
            <form onSubmit={submitReview} noValidate className="mb-6 grid gap-4 rounded-xl border border-purple-200 bg-white p-5 sm:p-6" aria-describedby={error ? "review-error" : undefined}>
              <h3 className="text-lg font-bold text-ink">{localize(language, "Share your experience", "আপনার অভিজ্ঞতা শেয়ার করুন")}</h3>
              <div className="grid gap-4 sm:grid-cols-2">
                <label className="grid gap-1.5 text-sm font-semibold text-ink">
                  {localize(language, "Your name", "আপনার নাম")}
                  <input id="review-name" required maxLength={120} value={name} onChange={(event) => { setName(event.target.value); setFieldErrors((current) => ({ ...current, name: undefined })); }} aria-invalid={fieldErrors.name ? true : undefined} className={inputClass} />
                  {fieldErrors.name && <span className="text-xs font-semibold text-rose-700" role="alert">{fieldErrors.name}</span>}
                </label>
                <label className="grid gap-1.5 text-sm font-semibold text-ink">
                  {localize(language, "Your registered mobile number", "আপনার নিবন্ধিত মোবাইল নম্বর")}
                  <input
                    id="review-phone"
                    required
                    type="tel"
                    inputMode="tel"
                    autoComplete="tel"
                    maxLength={30}
                    placeholder="01XXXXXXXXX"
                    value={phone}
                    onChange={(event) => { setPhone(event.target.value); setFieldErrors((current) => ({ ...current, phone: undefined })); }}
                    aria-invalid={fieldErrors.phone ? true : undefined}
                    aria-describedby={fieldErrors.phone ? "review-phone-help review-phone-error" : "review-phone-help"}
                    className={inputClass}
                  />
                  {fieldErrors.phone && <span id="review-phone-error" className="text-xs font-semibold text-rose-700" role="alert">{fieldErrors.phone}</span>}
                </label>
              </div>
              <p id="review-phone-help" className="-mt-2 text-xs leading-relaxed text-slate-600">
                {localize(language, "Use the number you gave the clinic. Only patients of the clinic can write a review. We use the number only to check this and never show it on the website.", "ক্লিনিকে যে নম্বর দিয়েছেন সেটি লিখুন। শুধু ক্লিনিকের রোগীরাই রিভিউ লিখতে পারেন। নম্বরটি শুধু যাচাইয়ের জন্য ব্যবহার হয়, ওয়েবসাইটে কখনো দেখানো হয় না।")}
              </p>
              <fieldset className="grid gap-1.5">
                <legend className="mb-1.5 text-sm font-semibold text-ink">{localize(language, "Rating", "রেটিং")}</legend>
                <div className="flex gap-1">
                  {[1, 2, 3, 4, 5].map((value) => (
                    <label key={value} className="relative cursor-pointer rounded-md p-1 has-[:focus-visible]:outline has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-purple-700">
                      <input type="radio" name="review-rating" value={value} checked={Number(rating) === value} onChange={() => setRating(String(value))} className="sr-only" />
                      <Star size={28} aria-hidden="true" className={value <= Number(rating) ? "fill-amber-400 text-amber-400" : "text-purple-200"} />
                      <span className="sr-only">{localize(language, `${value} out of 5`, `৫-এর মধ্যে ${bnNumbers.format(value)}`)}</span>
                    </label>
                  ))}
                </div>
              </fieldset>
              <label className="grid gap-1.5 text-sm font-semibold text-ink">
                {localize(language, "Your comment", "আপনার মন্তব্য")}
                <textarea required maxLength={2000} rows={4} value={comment} onChange={(event) => setComment(event.target.value)} className="rounded-md border border-purple-200 bg-white px-3 py-2 text-sm font-normal text-ink outline-none focus:border-purple-700 focus:ring-2 focus:ring-purple-200" />
              </label>
              {error && <p id="review-error" className="text-sm text-rose-700" role="alert">{error}</p>}
              <div className="flex justify-end gap-3">
                <button type="button" onClick={() => setShowForm(false)} className="min-h-11 rounded-md px-4 text-sm font-medium text-slate-700 hover:bg-purple-100">{localize(language, "Cancel", "বাতিল")}</button>
                <button type="submit" disabled={submitting} className="min-h-11 rounded-md bg-purple-700 px-6 text-sm font-semibold text-white transition-colors hover:bg-purple-800 disabled:opacity-60">{submitting ? localize(language, "Submitting…", "জমা হচ্ছে…") : localize(language, "Submit", "জমা দিন")}</button>
              </div>
            </form>
          )}

          {loading ? (
            <div className="grid gap-4 md:grid-cols-2" aria-busy="true">
              {[0, 1].map((key) => <div key={key} className="h-44 animate-pulse rounded-xl border border-purple-200 bg-white motion-reduce:animate-none" />)}
              <p className="sr-only">{localize(language, "Loading reviews…", "রিভিউ লোড হচ্ছে…")}</p>
            </div>
          ) : reviews.length ? (
            <div className="grid gap-4 md:grid-cols-2">
              {reviews.map((review) => (
                <article key={review.id} className="flex flex-col rounded-xl border border-purple-200 bg-white p-5 sm:p-6">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex gap-0.5" role="img" aria-label={localize(language, `${review.rating} out of 5 stars`, `৫-এর মধ্যে ${bnNumbers.format(review.rating)} তারা`)}>
                      {Array.from({ length: 5 }, (_, index) => <Star key={index} size={16} aria-hidden="true" className={index < review.rating ? "fill-amber-400 text-amber-400" : "text-purple-200"} />)}
                    </div>
                    <Quote size={22} aria-hidden="true" className="shrink-0 text-purple-300" />
                  </div>
                  <p className="mt-3 flex-1 text-base leading-relaxed text-ink">{review.comment}</p>
                  <div className="mt-5 flex items-center gap-3 border-t border-purple-100 pt-4">
                    <span aria-hidden="true" className="grid size-10 shrink-0 place-items-center rounded-full bg-purple-700 text-sm font-bold text-white">{review.name.trim().charAt(0).toUpperCase()}</span>
                    <div className="min-w-0">
                      <h3 className="truncate text-sm font-bold text-ink">{review.name}</h3>
                      <p className="text-xs text-slate-600">{localize(language, "Patient review", "রোগীর রিভিউ")}{formatMonth(review.createdAt) && ` · ${formatMonth(review.createdAt)}`}</p>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          ) : (
            !error && (
              <div className="grid place-items-center rounded-xl border border-dashed border-purple-300 bg-white px-6 py-14 text-center">
                <span aria-hidden="true" className="grid size-14 place-items-center rounded-full bg-purple-100 text-purple-700"><MessageSquareText size={26} /></span>
                <p className="mt-4 text-lg font-bold text-ink">{localize(language, "No reviews yet", "এখনও কোনো রিভিউ নেই")}</p>
                <p className="mt-1 max-w-sm text-sm leading-relaxed text-slate-600">{localize(language, "Reviews from patients appear here once the clinic has approved them. Visited us? Tell others about your experience.", "ক্লিনিক অনুমোদন করলে রোগীদের রিভিউ এখানে দেখা যাবে। আমাদের কাছে এসেছেন? আপনার অভিজ্ঞতা জানান।")}</p>
              </div>
            )
          )}
        </div>
      </div>
    </section>
  );
}
