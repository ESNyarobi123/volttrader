"use client";

import { Trash2 } from "lucide-react";
import type { ReactNode } from "react";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogTitle,
} from "@/components/ui/dialog";

/** Destructive-action confirmation used by the admin list pages. */
export function ConfirmDeleteDialog({
  open,
  onClose,
  title,
  description,
  error,
  pending,
  disabled = false,
  confirmLabel = "Delete permanently",
  pendingLabel = "Deleting…",
  onConfirm,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  description: ReactNode;
  error?: string | null;
  pending: boolean;
  disabled?: boolean;
  confirmLabel?: string;
  pendingLabel?: string;
  onConfirm: () => void;
}) {
  return (
    <Dialog open={open} onOpenChange={(next) => !next && onClose()}>
      <DialogContent
        className="max-w-md overflow-hidden border-0 bg-transparent p-0 shadow-none"
        onClose={onClose}
      >
        <div className="overflow-hidden rounded-2xl border border-danger/30 bg-surface shadow-lift">
          <div className="border-b border-danger/20 bg-gradient-to-br from-danger/15 via-surface to-warning/10 px-6 py-5">
            <div className="flex items-start gap-3">
              <span className="grid h-11 w-11 place-items-center rounded-2xl bg-danger/15 text-danger">
                <Trash2 className="h-5 w-5" />
              </span>
              <div>
                <DialogTitle>{title}</DialogTitle>
                <DialogDescription className="mt-1">{description}</DialogDescription>
              </div>
            </div>
          </div>
          <div className="space-y-4 p-6">
            {error ? <Alert variant="danger">{error}</Alert> : null}
            <DialogFooter className="mt-0">
              <Button variant="outline" onClick={onClose}>
                Cancel
              </Button>
              <Button variant="danger" disabled={pending || disabled} onClick={onConfirm}>
                {pending ? pendingLabel : confirmLabel}
              </Button>
            </DialogFooter>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
