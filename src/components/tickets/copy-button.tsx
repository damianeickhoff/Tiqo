"use client";

import { useState } from "react";
import { Check, Copy } from "lucide-react";

/** Copying an address is the most common thing anyone does with it. */
export function CopyButton({ value, label }: { value: string; label: string }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    } catch {
      // Clipboard access can be refused; the value is still on screen to read.
    }
  }

  return (
    <button
      type="button"
      onClick={copy}
      title={copied ? "Copied" : `Copy ${label}`}
      aria-label={copied ? "Copied" : `Copy ${label}`}
      className="text-text-3 hover:bg-surface-3 hover:text-text rounded-control shrink-0 p-1 transition-colors"
    >
      {copied ? <Check size={13} className="text-positive" /> : <Copy size={13} />}
    </button>
  );
}
