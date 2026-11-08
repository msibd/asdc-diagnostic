"use client";

import { useCallback, useId, useRef, useState, type ReactNode } from "react";
import Modal from "@/components/shared/modal";

type ConfirmOptions = {
  title: string;
  description: ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  /** Styles the confirm button as a destructive action. */
  destructive?: boolean;
};

/**
 * Replaces window.confirm(): `const ok = await confirm({ title, description })`. Render `dialog`
 * once in the component. The dialog traps focus, closes on Escape or a backdrop click (which
 * counts as "cancel"), and returns focus to the control that opened it.
 */
export function useConfirm() {
  const [pending, setPending] = useState<ConfirmOptions | null>(null);
  const resolver = useRef<((confirmed: boolean) => void) | null>(null);
  const titleId = useId();

  const confirm = useCallback((options: ConfirmOptions) => new Promise<boolean>((resolve) => {
    resolver.current?.(false);
    resolver.current = resolve;
    setPending(options);
  }), []);

  function settle(confirmed: boolean) {
    resolver.current?.(confirmed);
    resolver.current = null;
    setPending(null);
  }

  const dialog = pending ? (
    <Modal className="confirm-modal" labelledBy={titleId} onRequestClose={() => settle(false)}>
      <div className="modal-heading">
        <div>
          <h2 id={titleId}>{pending.title}</h2>
          <p>{pending.description}</p>
        </div>
      </div>
      <div className="modal-actions">
        <button type="button" className="button-secondary" onClick={() => settle(false)}>{pending.cancelLabel ?? "Cancel"}</button>
        <button type="button" className={pending.destructive ? "button-primary button-danger" : "button-primary"} onClick={() => settle(true)}>
          {pending.confirmLabel ?? "Confirm"}
        </button>
      </div>
    </Modal>
  ) : null;

  return { confirm, dialog };
}
