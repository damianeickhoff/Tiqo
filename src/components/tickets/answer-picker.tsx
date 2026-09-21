"use client";

import { useEffect, useRef, useState } from "react";
import { searchAnswers } from "@/lib/actions/tickets";
import { Input } from "@/components/ui";
import { Modal } from "@/components/modal";
import { useMessages } from "@/components/shell/instance-context";

type Answer = { id: string; slug: string; title: string; summary: string | null; body: string };

/**
 * The published answers, offered to whoever is writing a reply.
 *
 * Picking one puts the answer itself into the reply, with a link to it after — the desk answers
 * the same question five times a week, and the answer is already written on the
 * portal. Nothing is stored here: the link is text in the message like any
 * other, so an answer can be edited or unpublished afterwards without leaving
 * a broken record behind.
 */
export function AnswerPicker({
  onPick,
  onClose,
}: {
  onPick: (answer: Answer) => void;
  onClose: () => void;
}) {
  const m = useMessages();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Answer[]>([]);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Debounced from the change handler rather than driven from an effect, the
  // same way the merge dialog searches: one round trip per pause, not per key.
  function search(next: string) {
    setQuery(next);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(async () => {
      setResults(await searchAnswers(next));
    }, 180);
  }

  // Primed with the most-opened answers, so the list is useful before anything
  // is typed.
  useEffect(() => {
    let live = true;
    searchAnswers("").then((initial) => {
      if (live) setResults(initial);
    });
    return () => {
      live = false;
      if (timer.current) clearTimeout(timer.current);
    };
  }, []);

  return (
    <Modal
      title={m.ticket.insertAnswerTitle}
      description={m.ticket.insertAnswerBlurb}
      onClose={onClose}
    >
      <div className="space-y-3">
        <Input
          autoFocus
          value={query}
          onChange={(event) => search(event.target.value)}
          placeholder={m.ticket.searchAnswers}
          aria-label={m.ticket.searchAnswers}
        />

        <div className="bg-surface-2 rounded-card max-h-64 space-y-1 overflow-y-auto p-1">
          {results.length === 0 ? (
            <p className="text-text-3 px-2.5 py-3 text-base">{m.ticket.noAnswers}</p>
          ) : (
            results.map((answer) => (
              <button
                key={answer.id}
                type="button"
                onClick={() => onPick(answer)}
                className="hover:bg-surface rounded-control block w-full px-2.5 py-2 text-left transition-colors"
              >
                <span className="block truncate text-base font-medium">{answer.title}</span>
                {answer.summary ? (
                  <span className="text-text-3 mt-0.5 block truncate text-sm">
                    {answer.summary}
                  </span>
                ) : null}
              </button>
            ))
          )}
        </div>
      </div>
    </Modal>
  );
}
