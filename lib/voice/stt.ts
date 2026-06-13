// Realtime speech-to-text for the browser. Primary engine is Deepgram (via a
// short-lived token from /api/voice/token); when that is unavailable it falls
// back to the browser's built-in Web Speech API so the demo always runs.
// TS strict, no `any`: the non-standard Web Speech surface is typed below.

export type SttState = "idle" | "starting" | "listening" | "error";
export type SttEngine = "deepgram" | "webspeech";

export interface SttCallbacks {
  onInterim: (text: string) => void;
  onFinal: (text: string) => void;
  onState: (state: SttState, engine: SttEngine | null) => void;
  onError: (message: string) => void;
}

// ---- minimal Web Speech typings (not in the standard TS lib) ----
interface SpeechAlternative {
  transcript: string;
}
interface SpeechResult {
  readonly isFinal: boolean;
  readonly length: number;
  [index: number]: SpeechAlternative;
}
interface SpeechResultList {
  readonly length: number;
  [index: number]: SpeechResult;
}
interface SpeechRecognitionEventLike extends Event {
  readonly resultIndex: number;
  readonly results: SpeechResultList;
}
interface SpeechRecognitionErrorLike extends Event {
  readonly error?: string;
}
interface SpeechRecognitionLike {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  start(): void;
  stop(): void;
  abort(): void;
  onresult: ((e: SpeechRecognitionEventLike) => void) | null;
  onerror: ((e: SpeechRecognitionErrorLike) => void) | null;
  onend: (() => void) | null;
}
type SpeechRecognitionCtor = new () => SpeechRecognitionLike;

interface DeepgramMessage {
  channel?: { alternatives?: { transcript?: string }[] };
  is_final?: boolean;
}

function getSpeechRecognitionCtor(): SpeechRecognitionCtor | null {
  const w = window as unknown as {
    SpeechRecognition?: SpeechRecognitionCtor;
    webkitSpeechRecognition?: SpeechRecognitionCtor;
  };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

export class SttController {
  private cb: SttCallbacks;
  private stopping = false;
  private ws: WebSocket | null = null;
  private recorder: MediaRecorder | null = null;
  private stream: MediaStream | null = null;
  private recognition: SpeechRecognitionLike | null = null;

  constructor(cb: SttCallbacks) {
    this.cb = cb;
  }

  async start(locale: string): Promise<void> {
    this.stopping = false;
    this.cb.onState("starting", null);
    const dgLang = locale === "fr" ? "fr" : "en";
    const srLang = locale === "fr" ? "fr-FR" : "en-US";

    let token: string | null = null;
    try {
      const res = await fetch("/api/voice/token");
      if (res.ok) {
        const data: unknown = await res.json();
        const d = data as { enabled?: boolean; token?: string };
        if (d.enabled && typeof d.token === "string") token = d.token;
      }
    } catch {
      // ignore - fall back below
    }

    const canDeepgram =
      token !== null &&
      typeof MediaRecorder !== "undefined" &&
      Boolean(navigator.mediaDevices?.getUserMedia);

    if (canDeepgram && token) {
      try {
        await this.startDeepgram(token, dgLang);
        return;
      } catch {
        this.teardownDeepgram();
        // fall through to Web Speech
      }
    }
    this.startWebSpeech(srLang);
  }

  private async startDeepgram(token: string, lang: string): Promise<void> {
    this.stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    const url =
      "wss://api.deepgram.com/v1/listen" +
      `?model=nova-2&language=${lang}&smart_format=true` +
      "&interim_results=true&punctuate=true";
    // Browser WebSocket auth uses the Sec-WebSocket-Protocol header.
    const ws = new WebSocket(url, ["token", token]);
    this.ws = ws;

    await new Promise<void>((resolve, reject) => {
      ws.onopen = () => resolve();
      ws.onerror = () => reject(new Error("deepgram ws error"));
    });

    const recorder = new MediaRecorder(this.stream, { mimeType: "audio/webm" });
    this.recorder = recorder;
    recorder.ondataavailable = (e: BlobEvent) => {
      if (e.data.size > 0 && ws.readyState === WebSocket.OPEN) ws.send(e.data);
    };
    ws.onmessage = (e: MessageEvent<string>) => {
      try {
        const msg = JSON.parse(e.data) as DeepgramMessage;
        const text = msg.channel?.alternatives?.[0]?.transcript ?? "";
        if (!text) return;
        if (msg.is_final) this.cb.onFinal(text);
        else this.cb.onInterim(text);
      } catch {
        // ignore malformed frames
      }
    };
    ws.onclose = () => {
      if (!this.stopping) this.cb.onState("idle", null);
    };
    recorder.start(250);
    this.cb.onState("listening", "deepgram");
  }

  private startWebSpeech(lang: string): void {
    const Ctor = getSpeechRecognitionCtor();
    if (!Ctor) {
      this.cb.onState("error", null);
      this.cb.onError("unsupported");
      return;
    }
    const recognition = new Ctor();
    this.recognition = recognition;
    recognition.lang = lang;
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.onresult = (e: SpeechRecognitionEventLike) => {
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const result = e.results[i];
        if (!result) continue;
        const text = result[0]?.transcript ?? "";
        if (!text) continue;
        if (result.isFinal) this.cb.onFinal(text.trim());
        else this.cb.onInterim(text);
      }
    };
    recognition.onerror = (e: SpeechRecognitionErrorLike) => {
      const code = e.error ?? "";
      if (code === "no-speech" || code === "aborted") return; // benign
      if (!this.stopping) {
        this.cb.onState("error", null);
        if (code === "not-allowed" || code === "service-not-allowed") {
          this.cb.onError("permission");
        } else if (code === "network") {
          this.cb.onError("network");
        } else {
          this.cb.onError("recognition");
        }
      }
    };
    recognition.onend = () => {
      if (!this.stopping) this.cb.onState("idle", null);
    };
    recognition.start();
    this.cb.onState("listening", "webspeech");
  }

  private teardownDeepgram(): void {
    try {
      this.recorder?.stop();
    } catch {
      /* noop */
    }
    this.stream?.getTracks().forEach((t) => t.stop());
    try {
      this.ws?.close();
    } catch {
      /* noop */
    }
    this.recorder = null;
    this.stream = null;
    this.ws = null;
  }

  stop(): void {
    this.stopping = true;
    this.teardownDeepgram();
    try {
      this.recognition?.stop();
    } catch {
      /* noop */
    }
    this.recognition = null;
    this.cb.onState("idle", null);
  }
}
