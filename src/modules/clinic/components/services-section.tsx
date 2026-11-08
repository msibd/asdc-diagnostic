"use client";

import { useCallback, useMemo, useRef, useState, type FormEvent } from "react";
import { FlaskConical, Layers, Plus, Printer, Search, Trash2, Upload, Wrench } from "lucide-react";
import { bdtCurrency as currency } from "@/lib/format";
import ImportDialog from "@/modules/import/components/import-dialog";
import {
  emptyParameter, emptyRange, emptyService, requestJson, serviceFormToPayload, serviceToForm,
  type CatalogKind, type ParameterForm, type RangeForm, type ServiceForm, type ServiceRecord,
} from "./clinic-types";
import { useSectionLoader, type SectionProps } from "./section-shared";

const SAMPLE_TYPES = ["Blood", "Serum", "Plasma", "Urine", "Stool", "Swab", "Sputum", "Semen", "Tissue", "Fluid", "None"];
const KIND_LABEL: Record<CatalogKind, string> = { TEST: "Test", PANEL: "Panel", SERVICE: "Service" };
const KIND_HINT: Record<CatalogKind, string> = {
  TEST: "One lab investigation with its own result parameters, e.g. Complete Blood Count.",
  PANEL: "A named package of tests sold at one price, e.g. Diabetes Profile.",
  SERVICE: "Anything that is not a lab result, e.g. home sample collection.",
};

const reportTime = (hours: number | null) => (hours == null ? "—" : hours % 24 === 0 && hours >= 24 ? `${hours / 24} day${hours === 24 ? "" : "s"}` : `${hours} h`);

export default function ServicesSection({ onNotice, onBookService }: SectionProps & { onBookService?: (service: string) => void }) {
  const [services, setServices] = useState<ServiceRecord[]>([]);
  const [serviceForm, setServiceForm] = useState<ServiceForm>(emptyService);
  const [editingService, setEditingService] = useState<ServiceRecord | null>(null);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState("");
  const [kindFilter, setKindFilter] = useState<"ALL" | CatalogKind>("ALL");
  const [categoryFilter, setCategoryFilter] = useState("ALL");
  const [memberSearch, setMemberSearch] = useState("");
  const formRef = useRef<HTMLElement>(null);
  const [importing, setImporting] = useState(false);

  const load = useCallback(async () => {
    const result = await requestJson<{ services: ServiceRecord[] }>(await fetch("/api/services?includeInactive=true", { cache: "no-store" }));
    setServices(result.services);
  }, []);

  const { gate, reload } = useSectionLoader({ section: "services", load, shouldPauseLive: () => saving });

  const categories = useMemo(() => [...new Set(services.map((service) => service.category))].sort(), [services]);
  const visible = useMemo(() => {
    const needle = search.trim().toLowerCase();
    return services.filter((service) =>
      (kindFilter === "ALL" || service.kind === kindFilter)
      && (categoryFilter === "ALL" || service.category === categoryFilter)
      && (!needle || `${service.name} ${service.code} ${service.category}`.toLowerCase().includes(needle)));
  }, [services, search, kindFilter, categoryFilter]);
  const counts = useMemo(() => ({
    TEST: services.filter((service) => service.kind === "TEST").length,
    PANEL: services.filter((service) => service.kind === "PANEL").length,
    SERVICE: services.filter((service) => service.kind === "SERVICE").length,
  }), [services]);
  const availableTests = useMemo(() => services.filter((service) => service.kind === "TEST" && (service.isActive || serviceForm.panelTestIds.includes(service.id))), [services, serviceForm.panelTestIds]);
  const shownTests = availableTests.filter((test) => !memberSearch.trim() || `${test.name} ${test.code}`.toLowerCase().includes(memberSearch.trim().toLowerCase()));
  const separateTotal = availableTests.filter((test) => serviceForm.panelTestIds.includes(test.id)).reduce((sum, test) => sum + Number(test.standardPrice), 0);

  const set = <K extends keyof ServiceForm>(key: K, value: ServiceForm[K]) => setServiceForm((current) => ({ ...current, [key]: value }));
  const setParameters = (update: (list: ParameterForm[]) => ParameterForm[]) => setServiceForm((current) => ({ ...current, parameters: update(current.parameters) }));
  const setRange = (parameterIndex: number, rangeIndex: number, patch: Partial<RangeForm>) =>
    setParameters((list) => list.map((parameter, i) => i !== parameterIndex ? parameter : { ...parameter, ranges: parameter.ranges.map((range, j) => j === rangeIndex ? { ...range, ...patch } : range) }));

  function reset() {
    setEditingService(null);
    setServiceForm(emptyService);
    setMemberSearch("");
  }

  async function startEdit(service: ServiceRecord) {
    try {
      // The list only carries counts; the full definition (parameters, ranges, panel tests) is loaded on demand.
      const { service: detail } = await requestJson<{ service: ServiceRecord }>(await fetch(`/api/services/${service.id}`, { cache: "no-store" }));
      setEditingService(detail);
      setServiceForm(serviceToForm(detail));
      formRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    } catch (loadError) {
      onNotice(loadError instanceof Error ? loadError.message : "Unable to open this item.", true);
    }
  }

  async function submitService(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const highest = serviceForm.feeMax.trim();
    if (highest !== "" && Number(highest) < Number(serviceForm.standardPrice)) {
      onNotice("The highest fee must be at least the standard price.", true);
      return;
    }
    if (serviceForm.kind === "PANEL" && serviceForm.panelTestIds.length < 2) {
      onNotice("Choose at least two tests for the panel.", true);
      return;
    }
    setSaving(true);
    try {
      await requestJson(await fetch(editingService ? `/api/services/${editingService.id}` : "/api/services", {
        method: editingService ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(serviceFormToPayload(serviceForm, editingService?.isActive ?? true)),
      }));
      reset();
      reload();
      onNotice(`${KIND_LABEL[serviceForm.kind]} saved.`, false);
    } catch (saveError) {
      onNotice(saveError instanceof Error ? saveError.message : "Unable to save.", true);
    } finally { setSaving(false); }
  }

  async function toggleActive(service: ServiceRecord) {
    try {
      await requestJson(await fetch(`/api/services/${service.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...service, standardPrice: Number(service.standardPrice), feeMax: service.feeMax == null ? null : Number(service.feeMax), isActive: !service.isActive }),
      }));
      reload();
    } catch (toggleError) {
      onNotice(toggleError instanceof Error ? toggleError.message : "Unable to change status.", true);
    }
  }

  if (gate) return gate;

  const isLab = serviceForm.kind !== "SERVICE";

  return (
    <div className="clinic-module-grid test-catalog-grid">
      <section className="panel-card clinic-module-card" ref={formRef}>
        <header className="panel-header">
          <div>
            <h2 className="panel-title">{editingService ? `Edit ${KIND_LABEL[serviceForm.kind].toLowerCase()}` : "Add to catalog"}</h2>
            <p className="panel-description">Price, sample and report time are used for bookings, invoices and reports.</p>
          </div>
        </header>
        <form className="modal-form clinic-module-form" onSubmit={submitService}>
          <div className="test-kind-picker" role="radiogroup" aria-label="What are you adding?">
            {(["TEST", "PANEL", "SERVICE"] as CatalogKind[]).map((kind) => (
              <button key={kind} type="button" role="radio" aria-checked={serviceForm.kind === kind} className={serviceForm.kind === kind ? "is-selected" : ""} onClick={() => set("kind", kind)}>
                {kind === "TEST" ? <FlaskConical size={16} /> : kind === "PANEL" ? <Layers size={16} /> : <Wrench size={16} />}
                <strong>{KIND_LABEL[kind]}</strong>
                <small>{KIND_HINT[kind]}</small>
              </button>
            ))}
          </div>

          <div className="form-grid">
            <label className="form-field">Code<input required maxLength={30} placeholder="e.g. CBC" value={serviceForm.code} onChange={(event) => set("code", event.target.value)} /></label>
            <label className="form-field">Name<input required maxLength={120} placeholder="e.g. Complete Blood Count" value={serviceForm.name} onChange={(event) => set("name", event.target.value)} /></label>
            <label className="form-field">Name (বাংলা)<input maxLength={120} lang="bn" placeholder="ঐচ্ছিক, বাংলা সাইটে দেখায়" value={serviceForm.nameBn} onChange={(event) => set("nameBn", event.target.value)} /></label>
            <label className="form-field">Category<input required maxLength={80} list="catalog-categories" placeholder="e.g. Haematology" value={serviceForm.category} onChange={(event) => set("category", event.target.value)} /></label>
            <label className="form-field">Price (BDT)<input required type="number" inputMode="decimal" min="0" step="0.01" value={serviceForm.standardPrice} onChange={(event) => set("standardPrice", event.target.value)} /></label>
            <label className="form-field">{isLab ? "Sample collection time (minutes)" : "Duration (minutes)"}<input required type="number" inputMode="numeric" min="5" max="600" value={serviceForm.durationMinutes} onChange={(event) => set("durationMinutes", event.target.value)} /></label>
          </div>
          <datalist id="catalog-categories">{categories.map((category) => <option key={category} value={category} />)}</datalist>

          {isLab && (
            <div className="form-grid">
              <label className="form-field">Sample type
                <select value={serviceForm.sampleType} onChange={(event) => set("sampleType", event.target.value)}>
                  {SAMPLE_TYPES.map((type) => <option key={type} value={type}>{type}</option>)}
                </select>
              </label>
              <label className="form-field">Report ready in (hours)<input type="number" inputMode="numeric" min="1" max="720" step="1" placeholder="e.g. 24" value={serviceForm.turnaroundHours} onChange={(event) => set("turnaroundHours", event.target.value)} /></label>
              <label className="form-field test-check-field">
                <span>Preparation</span>
                <span className="test-check"><input type="checkbox" checked={serviceForm.fastingRequired} onChange={(event) => set("fastingRequired", event.target.checked)} /> Fasting required</span>
              </label>
            </div>
          )}
          {isLab && <label className="form-field">Patient instructions<textarea maxLength={1000} placeholder="e.g. Fast for 8–10 hours. Water is allowed." value={serviceForm.preparation} onChange={(event) => set("preparation", event.target.value)} /></label>}

          {serviceForm.kind === "PANEL" && (
            <fieldset className="test-panel-picker">
              <legend>Tests in this panel <span>{serviceForm.panelTestIds.length} selected</span></legend>
              <label className="patient-search"><Search size={15} /><input value={memberSearch} onChange={(event) => setMemberSearch(event.target.value)} placeholder="Search tests" aria-label="Search tests to add" /></label>
              <div className="test-panel-list">
                {shownTests.map((test) => (
                  <label key={test.id} className="test-panel-option">
                    <input type="checkbox" checked={serviceForm.panelTestIds.includes(test.id)} onChange={(event) => set("panelTestIds", event.target.checked ? [...serviceForm.panelTestIds, test.id] : serviceForm.panelTestIds.filter((id) => id !== test.id))} />
                    <span><strong>{test.name}</strong><small>{test.code} · {test.category}</small></span>
                    <em>{currency.format(Number(test.standardPrice))}</em>
                  </label>
                ))}
                {!shownTests.length && <p className="clinic-empty">{availableTests.length ? "No tests match your search." : "Add some tests first, then bundle them into a panel."}</p>}
              </div>
              {serviceForm.panelTestIds.length > 0 && <p className="test-panel-total">Priced separately these tests cost <strong>{currency.format(separateTotal)}</strong>. Set the panel price above to offer a discount.</p>}
            </fieldset>
          )}

          {serviceForm.kind === "TEST" && (
            <fieldset className="test-parameters">
              <legend>Result parameters <span>what the technician enters, with normal ranges</span></legend>
              {serviceForm.parameters.map((parameter, parameterIndex) => (
                <div className="test-parameter-card" key={parameterIndex}>
                  <div className="test-parameter-head">
                    <label className="form-field">Parameter<input required maxLength={80} placeholder="e.g. Haemoglobin" value={parameter.name} onChange={(event) => setParameters((list) => list.map((item, i) => i === parameterIndex ? { ...item, name: event.target.value } : item))} /></label>
                    <label className="form-field">Unit<input maxLength={30} placeholder="e.g. g/dL" value={parameter.unit} onChange={(event) => setParameters((list) => list.map((item, i) => i === parameterIndex ? { ...item, unit: event.target.value } : item))} /></label>
                    <button type="button" className="icon-button" aria-label={`Remove ${parameter.name || "parameter"}`} onClick={() => setParameters((list) => list.filter((_, i) => i !== parameterIndex))}><Trash2 size={15} /></button>
                  </div>
                  {parameter.ranges.map((range, rangeIndex) => (
                    <div className="test-range-row" key={rangeIndex}>
                      <label className="form-field">For
                        <select value={range.sex} onChange={(event) => setRange(parameterIndex, rangeIndex, { sex: event.target.value as RangeForm["sex"] })}>
                          <option value="ANY">Everyone</option><option value="MALE">Male</option><option value="FEMALE">Female</option>
                        </select>
                      </label>
                      <label className="form-field">Age from<input type="number" inputMode="decimal" min="0" max="150" step="any" placeholder="years" value={range.minAgeYears} onChange={(event) => setRange(parameterIndex, rangeIndex, { minAgeYears: event.target.value })} /></label>
                      <label className="form-field">Age to<input type="number" inputMode="decimal" min="0" max="150" step="any" placeholder="years" value={range.maxAgeYears} onChange={(event) => setRange(parameterIndex, rangeIndex, { maxAgeYears: event.target.value })} /></label>
                      <label className="form-field">Normal low<input type="number" inputMode="decimal" step="any" value={range.low} onChange={(event) => setRange(parameterIndex, rangeIndex, { low: event.target.value })} /></label>
                      <label className="form-field">Normal high<input type="number" inputMode="decimal" step="any" value={range.high} onChange={(event) => setRange(parameterIndex, rangeIndex, { high: event.target.value })} /></label>
                      <label className="form-field">Critical low<input type="number" inputMode="decimal" step="any" value={range.criticalLow} onChange={(event) => setRange(parameterIndex, rangeIndex, { criticalLow: event.target.value })} /></label>
                      <label className="form-field">Critical high<input type="number" inputMode="decimal" step="any" value={range.criticalHigh} onChange={(event) => setRange(parameterIndex, rangeIndex, { criticalHigh: event.target.value })} /></label>
                      <label className="form-field">Or text<input maxLength={120} placeholder="e.g. Negative" value={range.note} onChange={(event) => setRange(parameterIndex, rangeIndex, { note: event.target.value })} /></label>
                      <button type="button" className="request-action test-range-remove" disabled={parameter.ranges.length === 1} onClick={() => setParameters((list) => list.map((item, i) => i === parameterIndex ? { ...item, ranges: item.ranges.filter((_, j) => j !== rangeIndex) } : item))}>Remove range</button>
                    </div>
                  ))}
                  <button type="button" className="request-action" onClick={() => setParameters((list) => list.map((item, i) => i === parameterIndex ? { ...item, ranges: [...item.ranges, { ...emptyRange }] } : item))}><Plus size={13} /> Add range for another age or sex</button>
                </div>
              ))}
              {!serviceForm.parameters.length && <p className="clinic-empty">No parameters yet. A test with no parameters is reported as free text.</p>}
              <button type="button" className="button-secondary" onClick={() => setParameters((list) => [...list, emptyParameter()])}><Plus size={14} /> Add parameter</button>
            </fieldset>
          )}

          <label className="form-field">Description<textarea maxLength={1000} value={serviceForm.description} onChange={(event) => set("description", event.target.value)} /></label>
          <label className="form-field">Description (বাংলা)<textarea maxLength={1000} lang="bn" placeholder="ঐচ্ছিক, বাংলা সাইটে দেখায়" value={serviceForm.descriptionBn} onChange={(event) => set("descriptionBn", event.target.value)} /></label>
          <details className="service-public-details">
            <summary>Public website details <small>optional · shown on the website card and details window</small></summary>
            <div className="form-grid">
              <label className="form-field">Icon
                <select value={serviceForm.iconKey} onChange={(event) => set("iconKey", event.target.value)}>
                  <option value="">Automatic (from category)</option>
                  <option value="general">General</option>
                  <option value="blood">Blood test</option>
                  <option value="lab">Laboratory test</option>
                  <option value="package">Health package</option>
                  <option value="home">Home collection</option>
                  <option value="xray">X-ray and imaging</option>
                  <option value="preventive">Screening and prevention</option>
                  {["smile", "cosmetic", "endodontics", "surgery"].includes(serviceForm.iconKey) && <option value={serviceForm.iconKey}>Older icon ({serviceForm.iconKey})</option>}
                </select>
              </label>
              <label className="form-field">Category (বাংলা)<input maxLength={80} lang="bn" value={serviceForm.categoryBn} onChange={(event) => set("categoryBn", event.target.value)} /></label>
              <label className="form-field">Badge · English<input maxLength={80} placeholder="e.g. Same-day report" value={serviceForm.badgeEn} onChange={(event) => set("badgeEn", event.target.value)} /></label>
              <label className="form-field">Badge · বাংলা<input maxLength={80} lang="bn" value={serviceForm.badgeBn} onChange={(event) => set("badgeBn", event.target.value)} /></label>
              <label className="form-field">Time · English<input maxLength={80} placeholder="e.g. Report in 24 hours" value={serviceForm.timeTextEn} onChange={(event) => set("timeTextEn", event.target.value)} /></label>
              <label className="form-field">Time · বাংলা<input maxLength={80} lang="bn" value={serviceForm.timeTextBn} onChange={(event) => set("timeTextBn", event.target.value)} /></label>
              <label className="form-field">Note · English<input maxLength={80} placeholder="e.g. Fasting required" value={serviceForm.painTextEn} onChange={(event) => set("painTextEn", event.target.value)} /></label>
              <label className="form-field">Note · বাংলা<input maxLength={80} lang="bn" value={serviceForm.painTextBn} onChange={(event) => set("painTextBn", event.target.value)} /></label>
              <label className="form-field">Highest fee (BDT)<input type="number" inputMode="decimal" min="0" step="0.01" placeholder="Leave empty to show one price" value={serviceForm.feeMax} onChange={(event) => set("feeMax", event.target.value)} /></label>
            </div>
            <div className="form-grid">
              <label className="form-field">Details · English<textarea rows={4} maxLength={3000} value={serviceForm.detailsEn} onChange={(event) => set("detailsEn", event.target.value)} /></label>
              <label className="form-field">Details · বাংলা<textarea rows={4} maxLength={3000} lang="bn" value={serviceForm.detailsBn} onChange={(event) => set("detailsBn", event.target.value)} /></label>
              <label className="form-field">Steps · English <small>one per line, up to 12</small><textarea rows={5} value={serviceForm.stepsEn} onChange={(event) => set("stepsEn", event.target.value)} /></label>
              <label className="form-field">Steps · বাংলা <small>প্রতি লাইনে একটি</small><textarea rows={5} lang="bn" value={serviceForm.stepsBn} onChange={(event) => set("stepsBn", event.target.value)} /></label>
            </div>
          </details>
          <div className="modal-actions">
            {editingService && <button className="button-secondary" type="button" onClick={reset}>Cancel edit</button>}
            <button className="button-primary" disabled={saving}><Plus size={14} />{saving ? "Saving…" : editingService ? `Save ${KIND_LABEL[serviceForm.kind].toLowerCase()}` : `Add ${KIND_LABEL[serviceForm.kind].toLowerCase()}`}</button>
          </div>
        </form>
      </section>

      <section className="panel-card clinic-module-card">
        <header className="panel-header">
          <div>
            <h2 className="panel-title">Test catalog &amp; price list</h2>
            <p className="panel-description">{counts.TEST} tests · {counts.PANEL} panels · {counts.SERVICE} services</p>
          </div>
          <div className="inventory-row-actions">
            <button type="button" className="button-secondary" onClick={() => setImporting(true)}><Upload size={14} /> Import tests</button>
            <a className="button-secondary" href="/services/price-list" target="_blank" rel="noopener"><Printer size={14} /> Print price list</a>
          </div>
        </header>
        <div className="test-catalog-filters">
          <label className="patient-search"><Search size={15} /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search name, code or category" aria-label="Search the catalog" /></label>
          <div className="test-kind-filter" role="group" aria-label="Show">
            {(["ALL", "TEST", "PANEL", "SERVICE"] as const).map((kind) => <button key={kind} type="button" className={kindFilter === kind ? "is-selected" : ""} aria-pressed={kindFilter === kind} onClick={() => setKindFilter(kind)}>{kind === "ALL" ? "All" : `${KIND_LABEL[kind]}s`}</button>)}
          </div>
          <select className="select-control" value={categoryFilter} onChange={(event) => setCategoryFilter(event.target.value)} aria-label="Category">
            <option value="ALL">All categories</option>
            {categories.map((category) => <option key={category} value={category}>{category}</option>)}
          </select>
        </div>
        <div className="table-scroll"><table className="data-table"><thead><tr><th>Name</th><th>Type</th><th>Sample</th><th>Report</th><th>Price</th><th>Status</th><th>Action</th></tr></thead><tbody>
          {visible.map((service) => (
            <tr key={service.id}>
              <td><strong>{service.name}</strong><div className="cell-secondary">{service.code} · {service.category}{service.kind === "TEST" && service.parameterCount ? ` · ${service.parameterCount} parameter${service.parameterCount === 1 ? "" : "s"}` : ""}{service.kind === "PANEL" ? ` · ${service.panelTestCount} tests` : ""}</div></td>
              <td><span className={`catalog-kind catalog-kind-${service.kind.toLowerCase()}`}>{KIND_LABEL[service.kind]}</span></td>
              <td>{service.kind === "SERVICE" ? "—" : <>{service.sampleType ?? "—"}{service.fastingRequired && <div className="cell-secondary">Fasting</div>}</>}</td>
              <td>{service.kind === "SERVICE" ? "—" : reportTime(service.turnaroundHours)}</td>
              <td>{currency.format(Number(service.standardPrice))}</td>
              <td>{service.isActive ? "Active" : "Inactive"}</td>
              <td>
                {service.isActive && onBookService && <button className="request-action" onClick={() => onBookService(service.name)}>Book</button>}
                <button className="request-action" onClick={() => startEdit(service)}>Edit</button>
                <button className="request-action" onClick={() => toggleActive(service)}>{service.isActive ? "Disable" : "Enable"}</button>
              </td>
            </tr>
          ))}
          {!visible.length && <tr><td colSpan={7}>{services.length ? "Nothing matches your filters." : "The catalog is empty. Add your tests, panels and services above."}</td></tr>}
        </tbody></table></div>
      </section>
      {importing && <ImportDialog module="tests" onClose={() => setImporting(false)} onImported={() => void reload()} />}
    </div>
  );
}
