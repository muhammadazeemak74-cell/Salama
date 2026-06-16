"use client";

import { useCallback, useRef, useState } from "react";

type Status = "idle" | "recording" | "uploading" | "done" | "error";

// Preferred recording formats, most-compatible first. iOS Safari only supports
// audio/mp4; Chrome/Firefox use webm/opus.
const PREFERRED_MIME_TYPES = [
  "audio/mp4",
  "audio/webm;codecs=opus",
  "audio/webm",
];

/** Pick the first MediaRecorder mimeType the browser actually supports. */
function pickMimeType(): string | undefined {
  if (typeof MediaRecorder === "undefined") return undefined;
  for (const type of PREFERRED_MIME_TYPES) {
    if (MediaRecorder.isTypeSupported(type)) return type;
  }
  return undefined; // let the browser choose its default
}

/** File extension matching the chosen mimeType (mp4 -> .mp4, webm -> .webm). */
function extensionForMimeType(mimeType: string): string {
  const t = mimeType.toLowerCase();
  if (t.includes("mp4") || t.includes("m4a") || t.includes("aac")) return "mp4";
  if (t.includes("webm")) return "webm";
  if (t.includes("ogg")) return "ogg";
  return "webm";
}

export default function RecordPage() {
  const [status, setStatus] = useState<Status>("idle");
  const [transcript, setTranscript] = useState("");
  const [reply, setReply] = useState("");
  const [errorMsg, setErrorMsg] = useState("");

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);

  const stopTracks = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  }, []);

  const upload = useCallback(async (blob: Blob, filename: string) => {
    setStatus("uploading");
    setErrorMsg("");
    try {
      const form = new FormData();
      form.append("audio", blob, filename);
      const res = await fetch("/api/record", { method: "POST", body: form });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error ?? "Something went wrong.");
      setTranscript(data.transcript ?? "");
      setReply(data.reply ?? "");
      setStatus("done");
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : "Something went wrong.");
      setStatus("error");
    }
  }, []);

  const startRecording = useCallback(async () => {
    if (status === "recording" || status === "uploading") return;
    setTranscript("");
    setReply("");
    setErrorMsg("");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      chunksRef.current = [];

      const mimeType = pickMimeType();
      const recorder = mimeType
        ? new MediaRecorder(stream, { mimeType })
        : new MediaRecorder(stream);
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };
      recorder.onstop = () => {
        stopTracks();
        // Use the recorder's actual mimeType for the Blob and a matching file
        // extension/name so the server (and OpenAI) can decode it.
        const actualType = recorder.mimeType || mimeType || "audio/webm";
        const blob = new Blob(chunksRef.current, { type: actualType });
        if (blob.size === 0) {
          setStatus("idle");
          return;
        }
        const filename = `recording.${extensionForMimeType(actualType)}`;
        void upload(blob, filename);
      };

      recorder.start();
      mediaRecorderRef.current = recorder;
      setStatus("recording");
    } catch {
      setErrorMsg(
        "Microphone not available. Please allow microphone access and try again.",
      );
      setStatus("error");
    }
  }, [status, stopTracks, upload]);

  const stopRecording = useCallback(() => {
    const recorder = mediaRecorderRef.current;
    if (recorder && recorder.state !== "inactive") {
      recorder.stop();
    }
  }, []);

  const isRecording = status === "recording";
  const isBusy = status === "uploading";

  let buttonLabel = "Hold to Record";
  if (isRecording) buttonLabel = "Recording…";
  else if (isBusy) buttonLabel = "Sending…";

  return (
    <main
      style={{
        minHeight: "100dvh",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: "2rem",
        padding: "1.5rem",
        background: "#0b1220",
        color: "#f8fafc",
        textAlign: "center",
        WebkitUserSelect: "none",
        userSelect: "none",
        WebkitTouchCallout: "none",
      }}
    >
      <button
        type="button"
        aria-label="Hold to record"
        disabled={isBusy}
        // Pointer events cover both touch (tablet) and mouse.
        onPointerDown={(e) => {
          e.preventDefault();
          void startRecording();
        }}
        onPointerUp={(e) => {
          e.preventDefault();
          stopRecording();
        }}
        onPointerLeave={() => {
          if (isRecording) stopRecording();
        }}
        onPointerCancel={() => {
          if (isRecording) stopRecording();
        }}
        onContextMenu={(e) => e.preventDefault()}
        style={{
          width: "min(70vw, 320px)",
          height: "min(70vw, 320px)",
          borderRadius: "50%",
          border: "none",
          cursor: isBusy ? "default" : "pointer",
          color: "#ffffff",
          background: isRecording ? "#dc2626" : "#16a34a",
          boxShadow: isRecording
            ? "0 0 0 14px rgba(220,38,38,0.25)"
            : "0 0 0 8px rgba(22,163,74,0.20)",
          fontSize: "clamp(1.5rem, 6vw, 2.25rem)",
          fontWeight: 800,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: "0.75rem",
          transition: "background 120ms ease, box-shadow 120ms ease",
          touchAction: "none",
        }}
      >
        <span aria-hidden style={{ fontSize: "clamp(3rem, 14vw, 5rem)" }}>
          🎤
        </span>
        {buttonLabel}
      </button>

      {status === "error" && (
        <p
          role="alert"
          style={{
            fontSize: "clamp(1.1rem, 4vw, 1.5rem)",
            color: "#fca5a5",
            maxWidth: 640,
          }}
        >
          {errorMsg}
        </p>
      )}

      {status === "done" && (
        <section
          style={{
            display: "flex",
            flexDirection: "column",
            gap: "1.5rem",
            maxWidth: 720,
            width: "100%",
          }}
        >
          <div>
            <h2
              style={{
                fontSize: "clamp(1rem, 3.5vw, 1.25rem)",
                textTransform: "uppercase",
                letterSpacing: "0.08em",
                color: "#94a3b8",
                margin: "0 0 0.5rem",
              }}
            >
              You said
            </h2>
            <p style={{ fontSize: "clamp(1.4rem, 5vw, 2rem)", margin: 0 }}>
              {transcript}
            </p>
          </div>

          <div
            style={{
              background: "#1e293b",
              borderRadius: 16,
              padding: "1.25rem 1.5rem",
            }}
          >
            <h2
              style={{
                fontSize: "clamp(1rem, 3.5vw, 1.25rem)",
                textTransform: "uppercase",
                letterSpacing: "0.08em",
                color: "#94a3b8",
                margin: "0 0 0.5rem",
              }}
            >
              Reply
            </h2>
            <p
              style={{
                fontSize: "clamp(1.5rem, 5.5vw, 2.25rem)",
                fontWeight: 600,
                margin: 0,
              }}
            >
              {reply}
            </p>
          </div>
        </section>
      )}
    </main>
  );
}
