"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";

export default function NewProtocolForm() {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState("");
  const [bodyText, setBodyText] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const fileRef = useRef<HTMLInputElement | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function submit() {
    setError(null);
    if (!title.trim()) {
      setError("Title is required.");
      return;
    }
    if (!bodyText.trim() && !file) {
      setError("Add either a file or protocol text.");
      return;
    }
    setSubmitting(true);
    try {
      const form = new FormData();
      form.set("title", title);
      form.set("category", category);
      form.set("bodyText", bodyText);
      if (file) form.set("file", file);

      const res = await fetch("/api/protocols", { method: "POST", body: form });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Could not save this protocol.");
        return;
      }
      router.push(`/protocols/${data.id}`);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="container">
      <h1 className="page-title">New / Update Protocol</h1>
      <p style={{ color: "var(--muted)", fontSize: 14 }}>
        If the title matches an existing protocol, the old version is archived (not deleted) and this becomes the new current version.
      </p>

      <div className="card" style={{ marginTop: 12, display: "flex", flexDirection: "column", gap: 10 }}>
        <div>
          <label style={{ fontSize: 13, fontWeight: 600 }}>Title</label>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g. Dermaplaning Aftercare"
            style={{ width: "100%", padding: 10, marginTop: 4, borderRadius: 8, border: "1px solid var(--border-strong)" }}
          />
        </div>
        <div>
          <label style={{ fontSize: 13, fontWeight: 600 }}>Category (optional)</label>
          <input
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            placeholder="e.g. Skincare, Devices"
            style={{ width: "100%", padding: 10, marginTop: 4, borderRadius: 8, border: "1px solid var(--border-strong)" }}
          />
        </div>
        <div>
          <label style={{ fontSize: 13, fontWeight: 600 }}>Protocol text (optional if uploading a file)</label>
          <textarea
            value={bodyText}
            onChange={(e) => setBodyText(e.target.value)}
            rows={6}
            style={{ width: "100%", padding: 10, marginTop: 4, borderRadius: 8, border: "1px solid var(--border-strong)", fontFamily: "inherit" }}
          />
        </div>
        <div>
          <label style={{ fontSize: 13, fontWeight: 600 }}>Or upload a PDF / Word doc</label>
          <input
            ref={fileRef}
            type="file"
            accept=".pdf,.doc,.docx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
            style={{ display: "none" }}
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
          />
          <button
            onClick={() => fileRef.current?.click()}
            style={{ width: "100%", marginTop: 6, padding: 13, borderRadius: 12, border: "1px dashed var(--gold)", background: "var(--gold-soft)", color: "var(--gold-dark)", fontWeight: 600, fontSize: 14.5, cursor: "pointer" }}
          >
            {file ? file.name : "Choose file"}
          </button>
        </div>

        {error && <p className="error-text">{error}</p>}

        <button className="btn" onClick={submit} disabled={submitting}>
          {submitting ? "Saving…" : "Save Protocol"}
        </button>
      </div>
    </div>
  );
}
