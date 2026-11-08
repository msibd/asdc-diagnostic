"use client";

import { ArrowDown, ArrowUp, ExternalLink, ImageOff, Maximize2, Plus, Trash2, X } from "lucide-react";
import Image from "next/image";
import { useEffect, useState, type FormEvent } from "react";
import { useConfirm } from "@/components/shared/confirm-dialog";
import { notify } from "@/lib/notify";
import Modal from "@/components/shared/modal";

type GalleryImage = {
  id: string;
  url: string;
  altText: string;
  sortOrder: number;
};

type ImageFields = Omit<GalleryImage, "id">;

// Shared looks for the form fields below (Tailwind needs the whole class names written out).
const LABEL = "grid gap-1.5 text-xs font-semibold text-ink-3";
const INPUT = "min-h-[38px] w-full min-w-0 rounded-control border border-line-1 bg-surface-1 px-2.5 py-2 text-sm font-normal text-ink-1";

const API = "/public_website/api/gallery/manage";
const byOrder = (first: GalleryImage, second: GalleryImage) => first.sortOrder - second.sortOrder;

// A photo that fails to load (bad link, private image) shows a clear placeholder instead of a broken icon.
function Preview({ image, onView }: { image: GalleryImage; onView: () => void }) {
  const [failedUrl, setFailedUrl] = useState("");
  if (failedUrl === image.url) {
    return (
      <div className="grid aspect-4/3 place-content-center justify-items-center gap-2 bg-line-1 p-4 text-center text-xs text-ink-3" role="img" aria-label="Image could not be loaded">
        <ImageOff size={22} /><span>Image could not be loaded. Check the link.</span>
      </div>
    );
  }
  return (
    <button type="button" className="group relative block w-full cursor-zoom-in bg-line-1 p-0"  onClick={onView} aria-haspopup="dialog" aria-label={`View photo larger: ${image.altText}`}>
      <Image src={image.url} alt="" width={900} height={650} unoptimized className="block aspect-4/3 h-auto w-full bg-line-1 object-cover" onError={() => setFailedUrl(image.url)} />
      <span className="absolute right-2 bottom-2 inline-flex items-center gap-1 rounded-full bg-slate-900/75 px-2.5 py-1 text-xs font-semibold text-white opacity-0 transition-opacity duration-150 group-hover:opacity-100 group-focus-visible:opacity-100 pointer-coarse:opacity-100" aria-hidden="true"><Maximize2 size={14} /> View</span>
    </button>
  );
}

export default function GalleryManagement() {
  const { confirm, dialog: confirmDialog } = useConfirm();
  const [images, setImages] = useState<GalleryImage[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState("");
  const [error, setError] = useState("");
  const [addFormKey, setAddFormKey] = useState(0);
  const [viewing, setViewing] = useState<GalleryImage | null>(null);

  useEffect(() => {
    let active = true;
    fetch(API, { cache: "no-store" })
      .then(async (response) => {
        const result = await response.json() as { images?: GalleryImage[]; error?: string };
        if (!response.ok) throw new Error(result.error ?? "Could not load the gallery.");
        return result;
      })
      .then((result) => {
        if (active) setImages([...(result.images ?? [])].sort(byOrder));
      })
      .catch((loadError: unknown) => {
        if (active) setError(loadError instanceof Error ? loadError.message : "Could not load the gallery.");
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  async function send(method: "POST" | "PATCH" | "DELETE", body: unknown) {
    const response = await fetch(API, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    const result = await response.json().catch(() => ({})) as { image?: GalleryImage; error?: string };
    if (!response.ok) throw new Error(result.error ?? "The change could not be saved.");
    return result;
  }

  async function submitImage(event: FormEvent<HTMLFormElement>, id?: string) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    setBusyId(id ?? "new");
    setError("");
    const fields: ImageFields = {
      url: String(formData.get("url") ?? "").trim(),
      altText: String(formData.get("altText") ?? "").trim(),
      // New photos go to the end; existing photos keep their place (use the arrows to move them).
      sortOrder: id ? (images.find((item) => item.id === id)?.sortOrder ?? 0) : images.length,
    };
    try {
      const result = await send(id ? "PATCH" : "POST", id ? { id, ...fields } : fields);
      const saved = result.image;
      if (!saved) throw new Error("The server returned no saved photo.");
      setImages((current) => (id ? current.map((item) => (item.id === id ? saved : item)) : [...current, saved]).sort(byOrder));
      if (!id) setAddFormKey((key) => key + 1);
      notify(id ? "Photo updated." : "Photo added to the gallery.");
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Could not save the photo.");
    } finally {
      setBusyId("");
    }
  }

  // Moves a photo one place, then renumbers the list 0..n-1 so the order is always clean.
  async function move(index: number, direction: -1 | 1) {
    const target = index + direction;
    if (target < 0 || target >= images.length) return;
    const next = [...images];
    [next[index], next[target]] = [next[target], next[index]];
    const renumbered = next.map((item, position) => ({ ...item, sortOrder: position }));
    const changed = renumbered.filter((item) => images.find((old) => old.id === item.id)?.sortOrder !== item.sortOrder);
    setBusyId(next[target].id);
    setError("");
    try {
      for (const item of changed) await send("PATCH", { id: item.id, url: item.url, altText: item.altText, sortOrder: item.sortOrder });
      setImages(renumbered);
      notify("Order updated.");
    } catch (moveError) {
      setError(moveError instanceof Error ? moveError.message : "Could not change the order.");
    } finally {
      setBusyId("");
    }
  }

  async function deleteImage(image: GalleryImage) {
    const confirmed = await confirm({
      title: "Remove this photo?",
      description: "The photo is removed from the gallery on the website. The image file itself is not touched.",
      confirmLabel: "Remove",
      cancelLabel: "Cancel",
      destructive: true,
    });
    if (!confirmed) return;
    setBusyId(image.id);
    setError("");
    try {
      await send("DELETE", { id: image.id });
      setImages((current) => current.filter((item) => item.id !== image.id));
      notify("Photo removed from the gallery.");
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : "Could not remove the photo.");
    } finally {
      setBusyId("");
    }
  }

  const busy = busyId !== "";

  return (
    <section className="panel-card grid gap-5 p-5 max-sm:p-3.5">
      {confirmDialog}
      <div className="flex items-center justify-between gap-3 max-sm:flex-col max-sm:items-start">
        <div>
          <h2 className="m-0 text-base font-bold text-ink-1">Clinic gallery</h2>
          <p className="mt-1.5 text-[13px] text-ink-3">Photos shown in the Gallery section of the website. Paste a public image link (https://…); the photo file itself is not stored here. Changes go live immediately.</p>
        </div>
        <a href="/#gallery" target="_blank" rel="noopener noreferrer" className="button-secondary"><ExternalLink size={14} /> View on website</a>
      </div>

      <div className="grid gap-1.5 empty:hidden" aria-live="polite">
        {error && <p className="m-0 text-[13px] text-danger-text" role="alert">{error}</p>}
      </div>

      <form key={addFormKey} className="grid grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)_auto] items-end gap-3 rounded-card border border-line-1 p-4 max-sm:grid-cols-1" onSubmit={(event) => void submitImage(event)}>
        <h3 className="col-span-full m-0 text-base font-bold text-ink-1">Add a photo</h3>
        <label className={LABEL}>
          Image link
          <input className={INPUT} name="url" type="url" placeholder="https://example.com/clinic.jpg" required maxLength={2048} />
        </label>
        <label className={LABEL}>
          Short description (read aloud by screen readers)
          <input className={INPUT} name="altText" type="text" placeholder="e.g. Treatment room" required minLength={2} maxLength={240} />
        </label>
        <button type="submit" className="button-primary inline-flex min-h-[38px] items-center gap-1.5 max-sm:justify-self-start" disabled={busy}><Plus size={14} /> {busyId === "new" ? "Adding…" : "Add photo"}</button>
      </form>

      {loading ? (
        <div className="loading-state">Loading the gallery…</div>
      ) : images.length ? (
        <>
          <p className="m-0 text-[13px] text-ink-3">{images.length} {images.length === 1 ? "photo" : "photos"}. Photos appear on the website in this order.</p>
          <div className="grid grid-cols-[repeat(auto-fill,minmax(min(100%,260px),1fr))] gap-4">
            {images.map((image, index) => (
              <article key={image.id} className="overflow-hidden rounded-card border border-line-1">
                <div className="relative">
                  <Preview image={image} onView={() => setViewing(image)} />
                  <span className="absolute top-2 left-2 grid h-6 min-w-6 place-items-center rounded-full bg-slate-900/75 text-xs font-bold text-white">{index + 1}</span>
                  <div className="absolute top-1.5 right-1.5 flex gap-1 [&_button]:bg-white/90 [&_button]:text-slate-800">
                    <button type="button" className="icon-action" aria-label={`Move photo ${index + 1} earlier`} disabled={busy || index === 0} onClick={() => void move(index, -1)}><ArrowUp size={15} /></button>
                    <button type="button" className="icon-action" aria-label={`Move photo ${index + 1} later`} disabled={busy || index === images.length - 1} onClick={() => void move(index, 1)}><ArrowDown size={15} /></button>
                  </div>
                </div>
                <form className="grid gap-3 p-3.5" onSubmit={(event) => void submitImage(event, image.id)}>
                  <label className={LABEL}>
                    Image link
                    <input className={INPUT} name="url" type="url" defaultValue={image.url} required maxLength={2048} />
                  </label>
                  <label className={LABEL}>
                    Short description
                    <input className={INPUT} name="altText" type="text" defaultValue={image.altText} required minLength={2} maxLength={240} />
                  </label>
                  <div className="flex flex-wrap items-center gap-3">
                    <button type="submit" className="button-primary inline-flex items-center gap-1.5" disabled={busy}>{busyId === image.id ? "Saving…" : "Save"}</button>
                    <button type="button" className="button-secondary inline-flex items-center gap-1.5" disabled={busy} onClick={() => void deleteImage(image)}><Trash2 size={14} /> Remove</button>
                  </div>
                </form>
              </article>
            ))}
          </div>
        </>
      ) : (
        <div className="empty-state">No photos yet. Add an image link above and it will appear in the website gallery.</div>
      )}
      {viewing && (
        <Modal className="gallery-image-modal" labelledBy="gallery-viewer-title" onRequestClose={() => setViewing(null)}>
          <div className="gallery-image-modal-content">
            <div className="gallery-image-modal-heading">
              <h2 id="gallery-viewer-title">{viewing.altText}</h2>
              <button type="button" className="icon-button gallery-image-close" onClick={() => setViewing(null)} aria-label="Close photo"><X size={18} /></button>
            </div>
            <Image src={viewing.url} alt={viewing.altText} width={1600} height={1200} unoptimized className="gallery-image-expanded" />
          </div>
        </Modal>
      )}
    </section>
  );
}
