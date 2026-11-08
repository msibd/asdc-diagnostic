"use client";

import { useEffect, useId, useRef, useState, type KeyboardEvent } from "react";

export type PatientSelectChoice = { id: string; patientCode: string; name: string };

const SEARCH_DEBOUNCE_MS = 250;
const SEARCH_PAGE_SIZE = 50;

const label = (patient: PatientSelectChoice) => `${patient.patientCode} · ${patient.name}`;

// A patient combobox: type to search (server-side, so patients beyond the preloaded choices can be
// found), then pick from the list with the mouse or keyboard. The first option clears the selection.
export default function PatientSelect({
  id,
  name,
  value,
  onChange,
  choices,
  status,
  placeholder,
  required,
  className,
}: {
  id?: string;
  name?: string;
  value: string;
  onChange: (patientId: string) => void;
  choices: PatientSelectChoice[];
  status: "ACTIVE" | "ALL";
  placeholder: string;
  required?: boolean;
  className?: string;
}) {
  // query === null means "not editing": the input shows the selected patient instead.
  const [query, setQuery] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const [result, setResult] = useState<{ term: string; patients: PatientSelectChoice[]; error: string } | null>(null);
  const [pickedChoice, setPickedChoice] = useState<PatientSelectChoice | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const baseId = useId();
  const listId = `${baseId}-list`;
  const messageId = `${baseId}-message`;
  const term = (query ?? "").trim();

  useEffect(() => {
    if (!term) return;

    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      try {
        const params = new URLSearchParams({
          page: "1",
          pageSize: String(SEARCH_PAGE_SIZE),
          status,
          fields: "picker",
          search: term,
        });
        const response = await fetch(`/api/patients?${params}`, { cache: "no-store", signal: controller.signal });
        if (!response.ok) throw new Error("Unable to search patients.");
        const body = await response.json() as { patients: PatientSelectChoice[] };
        setResult({ term, patients: body.patients, error: "" });
      } catch (error) {
        if (!controller.signal.aborted) {
          setResult({ term, patients: [], error: error instanceof Error ? error.message : "Unable to search patients." });
        }
      }
    }, SEARCH_DEBOUNCE_MS);

    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [term, status]);

  // Results only apply to the term they were fetched for; otherwise show the preloaded choices.
  const current = term && result?.term === term ? result : null;
  const searching = Boolean(term) && !current;
  const searchError = current?.error ?? "";
  const results = current && !current.error ? current.patients : null;
  const visible = results ?? choices;
  const selectedPatient = value
    ? [pickedChoice, ...choices, ...(result?.patients ?? [])].find((patient) => patient?.id === value) ?? null
    : null;
  const noMatches = !searching && !searchError && results !== null && results.length === 0;

  // Option 0 clears the selection; the rest are patients.
  const optionCount = visible.length + 1;
  const activeIndex = Math.min(active, optionCount - 1);
  const optionId = (index: number) => `${baseId}-opt-${index}`;

  // A required picker is invalid until a patient is chosen (typed text alone does not count).
  useEffect(() => {
    inputRef.current?.setCustomValidity(required && !value ? "Select a patient from the list." : "");
  }, [required, value]);

  function openList() {
    if (open) return;
    // Start on the currently selected patient (or the clear option).
    const selectedIndex = value ? visible.findIndex((patient) => patient.id === value) + 1 : 0;
    setActive(Math.max(selectedIndex, 0));
    setOpen(true);
  }

  function close() {
    setOpen(false);
    setQuery(null);
  }

  function choose(index: number) {
    const patient = index === 0 ? null : visible[index - 1];
    setPickedChoice(patient);
    onChange(patient?.id ?? "");
    close();
  }

  function onKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      if (!open) {
        openList();
        return;
      }
      const step = event.key === "ArrowDown" ? 1 : -1;
      setActive((activeIndex + step + optionCount) % optionCount);
    } else if (event.key === "Enter" && open) {
      event.preventDefault();
      choose(activeIndex);
    } else if (event.key === "Escape" && open) {
      event.preventDefault();
      close();
    } else if (event.key === "Home" && open) {
      event.preventDefault();
      setActive(0);
    } else if (event.key === "End" && open) {
      event.preventDefault();
      setActive(optionCount - 1);
    }
  }

  const inputText = query ?? (selectedPatient ? label(selectedPatient) : "");
  const hasMessage = searching || Boolean(searchError) || noMatches;

  return (
    <div className="patient-combobox">
      <input
        ref={inputRef}
        id={id}
        type="text"
        role="combobox"
        autoComplete="off"
        className={`patient-select-search${className ? ` ${className}` : ""}`}
        value={inputText}
        placeholder={selectedPatient ? undefined : placeholder}
        aria-label={id ? undefined : "Patient"}
        aria-expanded={open}
        aria-controls={listId}
        aria-autocomplete="list"
        aria-activedescendant={open ? optionId(activeIndex) : undefined}
        aria-required={required || undefined}
        aria-invalid={searchError ? true : undefined}
        aria-describedby={hasMessage ? messageId : undefined}
        maxLength={120}
        onFocus={openList}
        onClick={openList}
        onBlur={close}
        onChange={(event) => {
          setQuery(event.target.value);
          setActive(0);
          setOpen(true);
        }}
        onKeyDown={onKeyDown}
      />
      {name && <input type="hidden" name={name} value={value} />}
      {open && (
        <ul id={listId} role="listbox" aria-label="Patients" className="patient-combobox-list" tabIndex={-1} onMouseDown={(event) => event.preventDefault()} onClick={(event) => event.preventDefault()}>
          {/* Mouse selection uses mousedown so the input keeps focus (and onBlur does not close first). */}
          <li
            id={optionId(0)}
            role="option"
            aria-selected={!value}
            className={`patient-combobox-option patient-combobox-clear${activeIndex === 0 ? " is-active" : ""}`}
            onMouseDown={(event) => { event.preventDefault(); choose(0); }}
            onMouseEnter={() => setActive(0)}
          >
            {placeholder}
          </li>
          {visible.map((patient, index) => (
            <li
              key={patient.id}
              id={optionId(index + 1)}
              role="option"
              aria-selected={patient.id === value}
              className={`patient-combobox-option${activeIndex === index + 1 ? " is-active" : ""}`}
              onMouseDown={(event) => { event.preventDefault(); choose(index + 1); }}
              onMouseEnter={() => setActive(index + 1)}
            >
              {label(patient)}
            </li>
          ))}
        </ul>
      )}
      {searching && <small id={messageId} role="status">Searching…</small>}
      {!searching && searchError && <small id={messageId} role="alert">{searchError}</small>}
      {noMatches && <small id={messageId} role="status">No matching patients.</small>}
    </div>
  );
}
