"use client";

import { useRef, useState, type DragEvent } from "react";
import { useMutation } from "@tanstack/react-query";
import { FileText, ImageIcon, Link2, Loader2, Trash2, Upload } from "lucide-react";
import type { StoragePresignView } from "@volt/types";
import { api, ApiRequestError } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

const ACCEPT = "image/jpeg,image/png,image/webp,image/jpg,application/pdf";
const MAX_BYTES = 8 * 1024 * 1024;

function isAllowed(file: File) {
  if (file.size > MAX_BYTES) return "Max 8 MB";
  const ok =
    file.type.startsWith("image/") ||
    file.type === "application/pdf" ||
    /\.pdf$/i.test(file.name);
  if (!ok) return "Use image or PDF";
  return null;
}

export function KycDocField({
  label,
  required,
  value,
  onChange,
  error,
  hint,
}: {
  label: string;
  required?: boolean;
  value: string;
  onChange: (key: string) => void;
  error?: string;
  hint?: string;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [mode, setMode] = useState<"upload" | "link">("upload");
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [localError, setLocalError] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);

  const upload = useMutation({
    mutationFn: async (file: File) => {
      const contentType =
        file.type || (/\.pdf$/i.test(file.name) ? "application/pdf" : "image/jpeg");
      const presign = await api.post<StoragePresignView>("/storage/presign-upload", {
        purpose: "kyc",
        filename: file.name,
        contentType,
      });
      const put = await fetch(presign.uploadUrl, {
        method: "PUT",
        headers: { "Content-Type": contentType },
        body: file,
      });
      if (!put.ok) throw new Error("Upload failed — try again");
      return { key: presign.key, file };
    },
    onSuccess: ({ key, file }) => {
      setLocalError(null);
      setFileName(file.name);
      if (previewUrl) URL.revokeObjectURL(previewUrl);
      if (file.type.startsWith("image/")) {
        setPreviewUrl(URL.createObjectURL(file));
      } else {
        setPreviewUrl(null);
      }
      onChange(key);
    },
    onError: (err) => {
      setLocalError(
        err instanceof ApiRequestError
          ? err.message
          : err instanceof Error
            ? err.message
            : "Upload failed",
      );
    },
  });

  const pickFile = (file: File | undefined) => {
    if (!file) return;
    const problem = isAllowed(file);
    if (problem) {
      setLocalError(problem);
      return;
    }
    setLocalError(null);
    upload.mutate(file);
  };

  const onDrop = (e: DragEvent) => {
    e.preventDefault();
    setDragging(false);
    pickFile(e.dataTransfer.files?.[0]);
  };

  const clear = () => {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl(null);
    setFileName(null);
    setLocalError(null);
    onChange("");
    if (inputRef.current) inputRef.current.value = "";
  };

  const showError = localError || error;
  const hasValue = Boolean(value?.trim());

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm font-medium">
          {label}
          {required ? <span className="text-danger"> *</span> : null}
        </p>
        <div className="flex gap-1 rounded-full bg-surface-2 p-0.5">
          <button
            type="button"
            onClick={() => setMode("upload")}
            className={cn(
              "rounded-full px-2.5 py-1 text-[11px] font-semibold transition",
              mode === "upload"
                ? "bg-volt text-volt-foreground"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            Upload
          </button>
          <button
            type="button"
            onClick={() => setMode("link")}
            className={cn(
              "rounded-full px-2.5 py-1 text-[11px] font-semibold transition",
              mode === "link"
                ? "bg-volt text-volt-foreground"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            Key / URL
          </button>
        </div>
      </div>

      {mode === "upload" ? (
        <div
          onDragOver={(e) => {
            e.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={onDrop}
          className={cn(
            "relative overflow-hidden rounded-2xl border border-dashed p-4 transition",
            dragging
              ? "border-volt bg-volt/10"
              : hasValue
                ? "border-volt/35 bg-volt/5"
                : "border-border bg-surface-2/40 hover:border-volt/30",
          )}
        >
          <input
            ref={inputRef}
            type="file"
            accept={ACCEPT}
            className="sr-only"
            onChange={(e) => pickFile(e.target.files?.[0])}
          />

          {hasValue ? (
            <div className="flex items-center gap-3">
              {previewUrl ? (
                <img
                  src={previewUrl}
                  alt=""
                  className="h-16 w-16 shrink-0 rounded-xl object-cover ring-1 ring-border"
                />
              ) : (
                <span className="grid h-16 w-16 shrink-0 place-items-center rounded-xl bg-ink/90 text-white">
                  {/\.pdf$/i.test(fileName ?? value) || value.includes(".pdf") ? (
                    <FileText className="h-6 w-6" />
                  ) : (
                    <ImageIcon className="h-6 w-6" />
                  )}
                </span>
              )}
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold">{fileName ?? "Document ready"}</p>
                <p className="mt-0.5 truncate font-mono text-[11px] text-muted-foreground">
                  {value}
                </p>
              </div>
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="shrink-0 rounded-full"
                onClick={clear}
              >
                <Trash2 className="h-3.5 w-3.5" />
                Clear
              </Button>
            </div>
          ) : (
            <button
              type="button"
              disabled={upload.isPending}
              onClick={() => inputRef.current?.click()}
              className="flex w-full flex-col items-center gap-2 py-3 text-center"
            >
              <span className="grid h-12 w-12 place-items-center rounded-2xl bg-volt/12 text-volt-dim">
                {upload.isPending ? (
                  <Loader2 className="h-5 w-5 animate-spin" />
                ) : (
                  <Upload className="h-5 w-5" />
                )}
              </span>
              <p className="text-sm font-semibold">
                {upload.isPending ? "Uploading…" : "Drop image / PDF or browse"}
              </p>
              <p className="text-[11px] text-muted-foreground">JPG, PNG, WebP, PDF · max 8 MB</p>
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-1.5">
          <div className="relative">
            <Link2 className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={value}
              onChange={(e) => onChange(e.target.value)}
              placeholder="kyc/… or storage key"
              className="pl-9 font-mono text-sm"
            />
          </div>
          {hint ? <p className="text-[11px] text-muted-foreground">{hint}</p> : null}
        </div>
      )}

      {showError ? <p className="text-xs text-danger">{showError}</p> : null}
    </div>
  );
}
