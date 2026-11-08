"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AlertTriangle, ArrowDown, ArrowUp, Check, CheckCheck, Undo2 } from "lucide-react";
import { formatClinicDate, formatClinicTime } from "@/lib/clinic-date";
import { requestJson } from "@/modules/clinic/components/clinic-types";
import { evaluateValue, FLAG_LABEL, formatReference, isCritical, isOutOfRange, type ResultFlag } from "@/modules/orders/services/result-rules";
import { RESULT_STATE_LABEL, type OrderRecord, type ResultSheet, type SheetItem, type SheetParameter } from "./order-types";

type Draft = { values: Record<string, string>; text: string; note: string };
const draftFrom = (item: SheetItem): Draft => ({
  values: Object.fromEntries(item.parameters.map((parameter) => [parameter.name, parameter.value])),
  text: item.resultText ?? "",
  note: item.resultNote ?? "",
});

/** The flag a typed value would get, computed with the same rules the server applies when saving. */
function previewFlag(parameter: SheetParameter, typed: string): { flag: ResultFlag | null; error: string | null } {
  if (!typed.trim()) return { flag: null, error: null };
  const result = evaluateValue(typed, parameter.range, parameter.name);
  return "error" in result ? { flag: null, error: result.error } : { flag: result.flag, error: null };
}

function FlagChip({ flag }: { flag: ResultFlag | null }) {
  if (!flag) return <span className="result-flag result-flag-none">—</span>;
  return (
    <span className={`result-flag result-flag-${flag.toLowerCase().replaceAll("_", "-")}`}>
      {flag === "HIGH" || flag === "CRITICAL_HIGH" ? <ArrowUp size={12} aria-hidden /> : flag === "LOW" || flag === "CRITICAL_LOW" ? <ArrowDown size={12} aria-hidden /> : null}
      {FLAG_LABEL[flag]}
    </span>
  );
}

export default function OrderResultsPanel({ order, canEnter, canVerify, onOrderChange }: {
  order: OrderRecord;
  canEnter: boolean;
  canVerify: boolean;
  onOrderChange: (order: OrderRecord) => void;
}) {
  const [sheet, setSheet] = useState<ResultSheet | null>(null);
  const [loadError, setLoadError] = useState("");
  const [drafts, setDrafts] = useState<Record<string, Draft>>({});
  // Tests whose typed values differ from what is saved. State (not a ref) because the screen shows it;
  // a ref mirror lets the reload callback read the latest value without being re-created.
  const [dirtyIds, setDirtyIds] = useState<ReadonlySet<string>>(new Set());
  const dirtyRef = useRef(dirtyIds);
  useEffect(() => { dirtyRef.current = dirtyIds; }, [dirtyIds]);
  const markDirty = (itemId: string, isDirty: boolean) => setDirtyIds((current) => {
    if (current.has(itemId) === isDirty) return current;
    const next = new Set(current);
    if (isDirty) next.add(itemId); else next.delete(itemId);
    return next;
  });
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [returning, setReturning] = useState<string | null>(null);
  const [reason, setReason] = useState("");
  const [ack, setAck] = useState<{ at: string; by: string; informedPerson: string; note: string | null } | null>(null);
  const [informed, setInformed] = useState("");

  // Reload when the order moves (another user entered something, a sample arrived, ...).
  const signature = `${order.status}|${order.items.map((item) => item.resultStatus).join(",")}`;

  const apply = useCallback((next: ResultSheet) => {
    setSheet(next);
    setDrafts((current) => {
      const merged = { ...current };
      for (const item of next.items) if (!dirtyRef.current.has(item.itemId)) merged[item.itemId] = draftFrom(item);
      return merged;
    });
  }, []);

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/orders/${order.id}/results`, { cache: "no-store" })
      .then((response) => requestJson<{ sheet: ResultSheet }>(response))
      .then((result) => { if (!cancelled) { apply(result.sheet); setLoadError(""); } })
      .catch((reason) => { if (!cancelled) setLoadError(reason instanceof Error ? reason.message : "Unable to load results."); });
    return () => { cancelled = true; };
  }, [order.id, signature, apply]);

  const criticalItems = useMemo(
    () => (sheet?.items ?? []).flatMap((item) => item.parameters.filter((parameter) => isCritical(parameter.flag)).map((parameter) => ({ test: item.testName, parameter }))),
    [sheet],
  );

  const hasCritical = criticalItems.length > 0;
  const loadAck = useCallback(() => {
    fetch(`/api/orders/${order.id}/critical-ack`, { cache: "no-store" })
      .then((response) => requestJson<{ acknowledgement: typeof ack }>(response))
      .then((result) => setAck(result.acknowledgement ?? null))
      .catch(() => setAck(null));
  }, [order.id]);
  useEffect(() => { if (hasCritical) loadAck(); }, [hasCritical, loadAck]);

  const edit = (itemId: string, change: Partial<Draft> | { name: string; value: string }) => {
    markDirty(itemId, true);
    setDrafts((current) => {
      const draft = current[itemId];
      if (!draft) return current;
      return { ...current, [itemId]: "name" in change ? { ...draft, values: { ...draft.values, [change.name]: change.value } } : { ...draft, ...change } };
    });
  };

  async function call(key: string, request: () => Promise<Response>, onDone?: () => void) {
    setBusy(key);
    setError("");
    try {
      const result = await requestJson<{ sheet: ResultSheet; order: OrderRecord }>(await request());
      apply(result.sheet);
      onOrderChange(result.order);
      onDone?.();
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : "That did not work.");
    } finally {
      setBusy(null);
    }
  }

  const save = (item: SheetItem) => {
    const draft = drafts[item.itemId];
    return call(`save:${item.itemId}`, () => fetch(`/api/results/${item.itemId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        values: item.parameters.filter((parameter) => !parameter.retired).map((parameter) => ({ name: parameter.name, value: draft.values[parameter.name] ?? "" })),
        text: item.parameters.length ? null : draft.text,
        note: draft.note,
      }),
    }), () => markDirty(item.itemId, false));
  };

  const review = (key: string, body: Record<string, unknown>, onDone?: () => void) => call(key, () => fetch(`/api/orders/${order.id}/review`, {
    method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
  }), onDone);

  if (loadError) return <div className="form-error" role="alert">{loadError}</div>;
  if (!sheet) return <p className="clinic-empty">Loading results…</p>;

  const waiting = sheet.items.filter((item) => item.resultStatus === "ENTERED").length;
  async function acknowledge() {
    setBusy("ack");
    setError("");
    try {
      await requestJson(await fetch(`/api/orders/${order.id}/critical-ack`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ informedPerson: informed }),
      }));
      setInformed("");
      loadAck();
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : "Unable to record this.");
    } finally { setBusy(null); }
  }

  const entryOpen = ["RECEIVED", "IN_PROCESS", "RESULT_ENTERED"].includes(order.status);

  return (
    <div className="result-panel">
      {error && <div className="form-error" role="alert">{error}</div>}

      {criticalItems.length > 0 && (
        <div className="result-critical" role="alert">
          <AlertTriangle size={16} aria-hidden />
          <div>
            <strong>Critical result{criticalItems.length > 1 ? "s" : ""}: tell the doctor or patient without delay.</strong>
            <ul>{criticalItems.map(({ test, parameter }) => <li key={`${test}:${parameter.name}`}>{parameter.name} ({test}): <b>{parameter.value} {parameter.unit ?? ""}</b> · {FLAG_LABEL[parameter.flag as ResultFlag]}</li>)}</ul>
            {ack ? (
              <p className="result-critical-ack">Told to {ack.informedPerson} · recorded by {ack.by}, {formatClinicDate(ack.at)} {formatClinicTime(ack.at)}</p>
            ) : canEnter && (
              <div className="result-critical-form">
                <input value={informed} onChange={(event) => setInformed(event.target.value)} placeholder="Who was told? e.g. Dr Rahman (referring doctor)" aria-label="Who was told about the critical result" maxLength={120} />
                <button type="button" className="button-secondary" disabled={busy !== null || informed.trim().length < 2} onClick={() => void acknowledge()}>{busy === "ack" ? "Saving…" : "Record that they were told"}</button>
              </div>
            )}
          </div>
        </div>
      )}

      {canVerify && waiting > 0 && order.status !== "DELIVERED" && (
        <div className="result-approve-all">
          <span>{waiting} test{waiting > 1 ? "s" : ""} waiting for your approval.</span>
          <button type="button" className="button-primary" disabled={busy !== null} onClick={() => review("verify-all", { action: "verify" })}><CheckCheck size={14} /> {busy === "verify-all" ? "Approving…" : `Approve all ${waiting}`}</button>
        </div>
      )}

      {sheet.items.map((item) => {
        const draft = drafts[item.itemId];
        if (!draft) return null;
        const locked = item.resultStatus === "VERIFIED" || order.status === "DELIVERED";
        const editable = canEnter && entryOpen && !locked;
        const isDirty = dirtyIds.has(item.itemId);
        const problems = item.parameters.map((parameter) => ({ parameter, ...previewFlag(parameter, draft.values[parameter.name] ?? "") }));
        const hasInput = item.parameters.length ? problems.some(({ parameter }) => (draft.values[parameter.name] ?? "").trim()) : draft.text.trim().length > 0;
        const hasError = problems.some((entry) => entry.error);

        return (
          <section className={`result-card result-card-${item.resultStatus.toLowerCase()}`} key={item.itemId} aria-label={item.testName}>
            <header className="result-card-head">
              <div>
                <h4>{item.testName}</h4>
                <small>{item.testCode}{item.panelName ? ` · ${item.panelName}` : ""}</small>
              </div>
              <span className={`result-state result-state-${item.resultStatus.toLowerCase()}`}>{RESULT_STATE_LABEL[item.resultStatus]}</span>
            </header>

            {item.returnReason && <div className="form-error" role="status"><strong>Sent back by the pathologist:</strong> {item.returnReason}</div>}

            {item.parameters.length > 0 ? (
              <div className="table-scroll">
                <table className="data-table result-table">
                  <thead><tr><th>Parameter</th><th>Result</th><th>Unit</th><th>Normal range</th><th>Flag</th></tr></thead>
                  <tbody>
                    {problems.map(({ parameter, flag, error: fieldError }) => {
                      const shownFlag = editable || isDirty ? flag : parameter.flag;
                      return (
                        <tr key={parameter.name} className={isOutOfRange(shownFlag) ? "result-row-abnormal" : ""}>
                          <td><strong>{parameter.name}</strong>{parameter.retired && <div className="cell-secondary">No longer in the catalog</div>}{!parameter.range && !parameter.retired && parameter.rangeProblem && <div className="cell-secondary result-range-problem">{parameter.rangeProblem}</div>}</td>
                          <td>
                            <input
                              className="result-input"
                              aria-label={`${parameter.name} result`}
                              aria-invalid={fieldError ? true : undefined}
                              inputMode="decimal"
                              autoComplete="off"
                              maxLength={200}
                              disabled={!editable || parameter.retired}
                              value={draft.values[parameter.name] ?? ""}
                              onChange={(event) => edit(item.itemId, { name: parameter.name, value: event.target.value })}
                            />
                            {fieldError && <div className="field-error">{fieldError}</div>}
                          </td>
                          <td>{parameter.unit ?? ""}</td>
                          <td>{(editable || isDirty ? formatReference(parameter.range) : parameter.referenceText) ?? "—"}</td>
                          <td><FlagChip flag={shownFlag} /></td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            ) : (
              <label className="form-field">Result
                <textarea rows={3} maxLength={5000} disabled={!editable} placeholder="Write the result or finding" value={draft.text} onChange={(event) => edit(item.itemId, { text: event.target.value })} />
              </label>
            )}

            <label className="form-field">Comment for the report <small>optional</small>
              <textarea rows={2} maxLength={2000} disabled={!editable} placeholder="Interpretation or advice" value={draft.note} onChange={(event) => edit(item.itemId, { note: event.target.value })} />
            </label>

            <footer className="result-card-foot">
              <small>
                {item.enteredBy && <>Entered by {item.enteredBy}{item.enteredAt ? ` · ${formatClinicDate(item.enteredAt)} ${formatClinicTime(item.enteredAt)}` : ""}. </>}
                {item.verifiedBy && <>Approved by <strong>{item.verifiedBy}</strong>{item.verifiedAt ? ` · ${formatClinicDate(item.verifiedAt)} ${formatClinicTime(item.verifiedAt)}` : ""}.</>}
              </small>
              <div className="result-card-actions">
                {editable && (
                  <button type="button" className="button-primary" disabled={busy !== null || !hasInput || hasError} onClick={() => save(item)}>
                    <Check size={14} /> {busy === `save:${item.itemId}` ? "Saving…" : item.resultStatus === "PENDING" ? "Save results" : isDirty ? "Save changes" : "Saved"}
                  </button>
                )}
                {canVerify && item.resultStatus === "ENTERED" && !isDirty && order.status !== "DELIVERED" && (
                  <button type="button" className="button-primary" disabled={busy !== null} onClick={() => review(`verify:${item.itemId}`, { action: "verify", itemId: item.itemId })}>{busy === `verify:${item.itemId}` ? "Approving…" : "Approve"}</button>
                )}
                {canVerify && item.resultStatus !== "PENDING" && order.status !== "DELIVERED" && returning !== item.itemId && (
                  <button type="button" className="button-secondary" disabled={busy !== null} onClick={() => { setReturning(item.itemId); setReason(""); }}><Undo2 size={14} /> {item.resultStatus === "VERIFIED" ? "Reopen" : "Send back"}</button>
                )}
              </div>
            </footer>

            {returning === item.itemId && (
              <div className="order-inline-form">
                <input aria-label="Why is it sent back?" autoFocus maxLength={500} placeholder="Reason, e.g. repeat the test" value={reason} onChange={(event) => setReason(event.target.value)} />
                <button type="button" className="button-primary" disabled={busy !== null || reason.trim().length < 3} onClick={() => review(`return:${item.itemId}`, { action: "return", itemId: item.itemId, reason }, () => { setReturning(null); setReason(""); markDirty(item.itemId, false); })}>Send back</button>
                <button type="button" className="button-secondary" onClick={() => setReturning(null)}>Cancel</button>
              </div>
            )}
          </section>
        );
      })}
    </div>
  );
}
