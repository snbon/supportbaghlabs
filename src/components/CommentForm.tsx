"use client";

import { useActionState, useEffect, useRef } from "react";
import { postComment, type CommentState } from "@/actions/comments";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

interface CommentFormProps {
  ticketId: string;
  githubRepo: string;
  issueNumber: number;
  onCommentPosted: () => void;
}

const initialState: CommentState = {};

export default function CommentForm({
  ticketId,
  githubRepo,
  issueNumber,
  onCommentPosted,
}: CommentFormProps) {
  const [state, formAction, isPending] = useActionState(postComment, initialState);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state.success) {
      formRef.current?.reset();
      onCommentPosted();
    }
  }, [state.success, onCommentPosted]);

  return (
    <form ref={formRef} action={formAction} className="mt-5 pt-5 border-t border-border/60">
      <input type="hidden" name="ticketId"    value={ticketId} />
      <input type="hidden" name="githubRepo"  value={githubRepo} />
      <input type="hidden" name="issueNumber" value={issueNumber} />

      {state.success && (
        <div className="mb-3 rounded-xl bg-emerald-50 border border-emerald-100 px-3.5 py-2.5 text-sm text-emerald-700 flex items-center gap-2">
          <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
            <circle cx="8" cy="8" r="7" stroke="currentColor" strokeWidth="1.5"/>
            <path d="M5 8l2 2 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
          Comment sent — visible on GitHub
        </div>
      )}
      {state.error && (
        <div className="mb-3 rounded-xl bg-red-50 border border-red-100 px-3.5 py-2.5 text-sm text-red-600">
          {state.error}
        </div>
      )}

      <Textarea
        name="body"
        placeholder="Write a comment… our team will reply as soon as possible."
        rows={3}
        className="resize-none text-sm leading-relaxed"
      />

      <div className="flex justify-end mt-3">
        <Button type="submit" size="sm" disabled={isPending} className="h-8 px-4 text-sm">
          {isPending ? "Sending…" : "Send reply"}
        </Button>
      </div>
    </form>
  );
}
