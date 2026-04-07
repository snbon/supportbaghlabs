"use client";

/**
 * CommentForm — comment + file attachment input at the bottom of TicketDetailDialog.
 * Supports PDF, JPG, PNG attachments only. Files are uploaded to Supabase Storage
 * and embedded in the GitHub comment as markdown.
 */

import { useActionState, useEffect, useRef, useState } from "react";
import { postComment, type CommentState } from "@/actions/comments";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

interface CommentFormProps {
  ticketId: string;
  githubRepo: string;
  issueNumber: number;
  onCommentPosted: () => void; // callback to refresh the activity feed
}

const ACCEPTED = ["image/jpeg", "image/png", "application/pdf"] as const;
const MAX_SIZE  = 10 * 1024 * 1024; // 10 MB

const initialState: CommentState = {};

interface AttachedFile {
  file: File;
  preview: string | null; // data URL for images, null for PDFs
}

export default function CommentForm({
  ticketId,
  githubRepo,
  issueNumber,
  onCommentPosted,
}: CommentFormProps) {
  const [state, formAction, isPending] = useActionState(postComment, initialState);
  const [attachedFiles, setAttachedFiles] = useState<AttachedFile[]>([]);
  const [fileError, setFileError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const formRef      = useRef<HTMLFormElement>(null);

  // On success — reset form and notify parent to refetch comments
  useEffect(() => {
    if (state.success) {
      setAttachedFiles([]);
      formRef.current?.reset();
      onCommentPosted();
    }
  }, [state.success, onCommentPosted]);

  function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const picked = Array.from(e.target.files ?? []);
    setFileError(null);

    const invalid = picked.filter((f) => !ACCEPTED.includes(f.type as typeof ACCEPTED[number]));
    if (invalid.length > 0) {
      setFileError(`Only PDF, JPG, and PNG files are allowed.`);
      e.target.value = "";
      return;
    }

    const tooBig = picked.filter((f) => f.size > MAX_SIZE);
    if (tooBig.length > 0) {
      setFileError(`Files must be under 10 MB.`);
      e.target.value = "";
      return;
    }

    // Generate image previews
    Promise.all(
      picked.map(
        (file) =>
          new Promise<AttachedFile>((resolve) => {
            if (file.type.startsWith("image/")) {
              const reader = new FileReader();
              reader.onload = () => resolve({ file, preview: reader.result as string });
              reader.readAsDataURL(file);
            } else {
              resolve({ file, preview: null });
            }
          })
      )
    ).then((results) => {
      setAttachedFiles((prev) => [...prev, ...results]);
    });

    e.target.value = ""; // reset so same file can be re-added after removal
  }

  function removeFile(index: number) {
    setAttachedFiles((prev) => prev.filter((_, i) => i !== index));
  }

  return (
    <form ref={formRef} action={formAction} className="mt-5 pt-5 border-t border-border/60">
      {/* Hidden fields */}
      <input type="hidden" name="ticketId"    value={ticketId} />
      <input type="hidden" name="githubRepo"  value={githubRepo} />
      <input type="hidden" name="issueNumber" value={issueNumber} />

      {/* Hidden file inputs — one per attached file so FormData sends them */}
      {attachedFiles.map((af, i) => (
        <AttachedFileInput key={i} file={af.file} />
      ))}

      {/* Success */}
      {state.success && (
        <div className="mb-3 rounded-xl bg-emerald-50 border border-emerald-100 px-3.5 py-2.5 text-sm text-emerald-700 flex items-center gap-2">
          <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
            <circle cx="8" cy="8" r="7" stroke="currentColor" strokeWidth="1.5"/>
            <path d="M5 8l2 2 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
          Comment sent — visible on GitHub
        </div>
      )}
      {(state.error || fileError) && (
        <div className="mb-3 rounded-xl bg-red-50 border border-red-100 px-3.5 py-2.5 text-sm text-red-600">
          {fileError || state.error}
        </div>
      )}

      {/* Attached file previews */}
      {attachedFiles.length > 0 && (
        <div className="mb-3 flex flex-wrap gap-2">
          {attachedFiles.map((af, i) => (
            <div key={i}
              className="flex items-center gap-2 bg-muted border border-border/60 rounded-xl px-3 py-1.5 text-xs font-medium text-foreground">
              {af.preview ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={af.preview} alt={af.file.name}
                  className="w-6 h-6 rounded object-cover border border-border/40" />
              ) : (
                <span className="text-red-500 text-base leading-none">📄</span>
              )}
              <span className="max-w-28 truncate">{af.file.name}</span>
              <button type="button" onClick={() => removeFile(i)}
                className="text-muted-foreground hover:text-foreground transition-colors ml-1">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <path d="M18 6L6 18M6 6l12 12"/>
                </svg>
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Text area */}
      <Textarea
        name="body"
        placeholder="Write a comment… your team will see this on GitHub"
        rows={3}
        className="resize-none text-sm leading-relaxed"
      />

      {/* Actions row */}
      <div className="flex items-center justify-between mt-3 gap-3">
        {/* Attach button */}
        <div>
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground hover:text-foreground transition-colors px-2.5 py-1.5 rounded-lg hover:bg-muted"
          >
            <PaperclipIcon />
            Attach file
            <span className="text-[10px] text-muted-foreground/60 font-normal">PDF · JPG · PNG</span>
          </button>
          {/* Hidden real file input */}
          <input
            ref={fileInputRef}
            type="file"
            accept=".pdf,.jpg,.jpeg,.png"
            multiple
            onChange={handleFileSelect}
            className="hidden"
          />
        </div>

        <Button type="submit" size="sm" disabled={isPending} className="h-8 px-4 text-sm">
          {isPending ? "Sending…" : "Send reply"}
        </Button>
      </div>
    </form>
  );
}

/**
 * Renders a hidden file input for a single File object so it's included
 * in the FormData that the Server Action receives. This is necessary because
 * FormData from a <form> serialises only named inputs that are in the DOM.
 */
function AttachedFileInput({ file }: { file: File }) {
  const ref = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!ref.current) return;
    // Programmatically attach the File object to the input via DataTransfer
    const dt = new DataTransfer();
    dt.items.add(file);
    ref.current.files = dt.files;
  }, [file]);

  return <input ref={ref} type="file" name="files" className="hidden" />;
}

function PaperclipIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21.44 11.05l-9.19 9.19a6 6 0 01-8.49-8.49l9.19-9.19a4 4 0 015.66 5.66l-9.2 9.19a2 2 0 01-2.83-2.83l8.49-8.48"/>
    </svg>
  );
}
