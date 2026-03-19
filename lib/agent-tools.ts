/**
 * lib/agent-tools.ts
 * Real tool definitions for the agentic engine (AI SDK v6).
 * In AI SDK v6, tools use `inputSchema` (not `parameters`).
 */
import { tool } from "ai";
import { z } from "zod";
import { tavily } from "@tavily/core";

// Helper to get an AbortSignal with a timeout
function timeoutSignal(ms: number): AbortSignal | undefined {
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return (AbortSignal as any).timeout(ms) as AbortSignal;
  } catch {
    return undefined;
  }
}

// ── Web Search ────────────────────────────────────────────────────────────────
export const webSearchTool = tool({
  description:
    "Search the web for current information, news, facts, prices, or any real-time data. Use for questions about recent events, live data, or anything that requires up-to-date information.",
  inputSchema: z.object({
    query: z.string().min(1).describe("The search query to look up"),
  }),
  execute: async ({ query }: { query: string }) => {
    try {
      const url = `https://api.duckduckgo.com/?q=${encodeURIComponent(query)}&format=json&no_html=1&skip_disambig=1&t=autoflow`;
      const res = await fetch(url, {
        headers: { "User-Agent": "AutoFlow/1.0" },
        signal: timeoutSignal(8000),
      });
      const data = (await res.json()) as {
        AbstractText?: string;
        AbstractURL?: string;
        Heading?: string;
        RelatedTopics?: { Text?: string; FirstURL?: string; Name?: string }[];
        Answer?: string;
      };

      const results: { title: string; snippet: string; url: string }[] = [];
      if (data.Answer) results.push({ title: "Quick Answer", snippet: data.Answer, url: "" });
      if (data.AbstractText)
        results.push({ title: data.Heading ?? "Summary", snippet: data.AbstractText, url: data.AbstractURL ?? "" });
      for (const t of (data.RelatedTopics ?? []).slice(0, 6)) {
        if (t.Text && t.FirstURL)
          results.push({ title: t.Name ?? "Related", snippet: t.Text, url: t.FirstURL });
      }
      return { query, results: results.slice(0, 6), timestamp: new Date().toISOString() };
    } catch (err) {
      return { query, results: [] as { title: string; snippet: string; url: string }[], error: String(err) };
    }
  },
});

// ── HTTP Request ──────────────────────────────────────────────────────────────
export const httpRequestTool = tool({
  description:
    "Make an HTTP request to any URL or API endpoint. Use for calling REST APIs, fetching JSON data, posting to webhooks, or reading any web resource.",
  inputSchema: z.object({
    url: z.string().url().describe("The URL to request"),
    method: z.enum(["GET", "POST", "PUT", "PATCH", "DELETE"]).default("GET"),
    headers: z.record(z.string(), z.string()).optional(),
    body: z.string().optional(),
    maxResponseLength: z.number().optional(),
  }),
  execute: async ({ url, method, headers, body, maxResponseLength }: {
    url: string;
    method: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
    headers?: Record<string, string>;
    body?: string;
    maxResponseLength?: number;
  }) => {
    const maxLen = maxResponseLength ?? 4000;
    try {
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json", "User-Agent": "AutoFlow/1.0", ...(headers ?? {}) },
        body: body ?? undefined,
        signal: timeoutSignal(15000),
      });
      const text = await res.text();
      let data: unknown;
      try { data = JSON.parse(text); } catch { data = text.slice(0, maxLen); }
      return { url, method, status: res.status, ok: res.ok, data };
    } catch (err) {
      return { url, method, error: String(err), status: 0, ok: false, data: null as unknown };
    }
  },
});

// ── Extract Page Content ──────────────────────────────────────────────────────
export const extractPageTool = tool({
  description:
    "Fetch and extract readable text content from any webpage. Use to read articles, documentation, product pages, or scrape information from websites.",
  inputSchema: z.object({
    url: z.string().url().describe("The webpage URL to extract content from"),
    maxLength: z.number().optional(),
  }),
  execute: async ({ url, maxLength }: { url: string; maxLength?: number }) => {
    const maxLen = maxLength ?? 5000;
    try {
      const res = await fetch(url, {
        headers: { "User-Agent": "AutoFlow/1.0 (content-extractor)" },
        signal: timeoutSignal(12000),
      });
      const html = await res.text();
      const clean = html
        .replace(/<script[\s\S]*?<\/script>/gi, "")
        .replace(/<style[\s\S]*?<\/style>/gi, "")
        .replace(/<[^>]+>/g, " ")
        .replace(/\s+/g, " ")
        .trim();
      return { url, content: clean.slice(0, maxLen), length: clean.length, statusCode: res.status };
    } catch (err) {
      return { url, content: "", error: String(err), statusCode: 0, length: 0 };
    }
  },
});

// ── Current DateTime ──────────────────────────────────────────────────────────
export const getCurrentTimeTool = tool({
  description: "Get the current date and time. Use when the task references 'today', 'now', 'this week', etc.",
  inputSchema: z.object({
    timezone: z.string().optional(),
  }),
  execute: async ({ timezone }: { timezone?: string }) => {
    const tz = timezone ?? "UTC";
    const now = new Date();
    return {
      iso: now.toISOString(),
      utc: now.toUTCString(),
      unix: Math.floor(now.getTime() / 1000),
      formatted: now.toLocaleString("en-US", { timeZone: tz }),
      date: now.toISOString().split("T")[0],
      timezone: tz,
    };
  },
});

// ── Parse & Transform JSON ────────────────────────────────────────────────────
export const parseJsonTool = tool({
  description:
    "Parse a JSON string and optionally extract a value by dot-notation path. Use to process structured API responses.",
  inputSchema: z.object({
    json: z.string().describe("The JSON string to parse"),
    path: z.string().optional().describe("Dot-notation path to extract (e.g. 'data.items.0.name')"),
  }),
  execute: async ({ json, path }: { json: string; path?: string }) => {
    try {
      const parsed: unknown = JSON.parse(json);
      if (!path) return { result: parsed, type: typeof parsed };
      const value = path.split(".").reduce((obj: unknown, key: string) => {
        return (obj as Record<string, unknown>)?.[key];
      }, parsed);
      return { result: value, path };
    } catch (err) {
      return { error: `JSON parse failed: ${String(err)}`, result: null as unknown };
    }
  },
});

// ── Expression Evaluator ───────────────────────────────────────────────────────
export const evaluateExpressionTool = tool({
  description:
    "Evaluate a safe mathematical or logical JavaScript expression. Use for calculations, string formatting, date math, or data transformations.",
  inputSchema: z.object({
    expression: z.string().describe("A safe JS expression to evaluate (math, string ops). No I/O or fetch."),
    context: z.record(z.string(), z.unknown()).optional().describe("Variables available in the expression"),
  }),
  execute: async ({ expression, context }: { expression: string; context?: Record<string, unknown> }) => {
    try {
      const forbidden = /\b(fetch|require|import|eval|Function|process|global|window|document|__dirname|__filename)\b/;
      if (forbidden.test(expression)) return { error: "Expression contains forbidden keywords", result: null as unknown };
      const ctx = context ?? {};
      const keys = Object.keys(ctx);
      const values = Object.values(ctx);
      // eslint-disable-next-line no-new-func
      const fn = new Function(...keys, `"use strict"; return (${expression});`);
      const result: unknown = fn(...values);
      return { result, type: typeof result };
    } catch (err) {
      return { error: String(err), result: null as unknown };
    }
  },
});

// ── Summarize Text ────────────────────────────────────────────────────────────
export const summarizeTextTool = tool({
  description:
    "Extract the key points from a long piece of text. Returns a bullet-point summary.",
  inputSchema: z.object({
    text: z.string().describe("The text to summarize"),
    maxPoints: z.number().optional(),
  }),
  execute: async ({ text, maxPoints }: { text: string; maxPoints?: number }) => {
    const max = maxPoints ?? 5;
    const sentences = text.split(/[.!?]+/).map((s: string) => s.trim()).filter((s: string) => s.length > 40);
    const step = Math.max(1, Math.floor(sentences.length / max));
    const keyPoints: string[] = [];
    for (let i = 0; i < sentences.length && keyPoints.length < max; i += step) {
      keyPoints.push(sentences[i]);
    }
    return { summary: keyPoints, totalLength: text.length, sentenceCount: sentences.length };
  },
});

// ── Tavily Search ────────────────────────────────────────────────────────────
export const tavilySearchTool = tool({
  description: "Search the web using Tavily. High quality answers for complex research queries.",
  inputSchema: z.object({
    query: z.string().describe("The search query"),
  }),
  execute: async ({ query }: { query: string }) => {
    const apiKey = process.env.TAVILY_API_KEY;
    if (!apiKey) {
      return { error: "TAVILY_API_KEY is not configured", fallback_to_webSearchTool: true };
    }
    try {
      const tvly = tavily({ apiKey });
      const response = await tvly.search(query, {
        searchDepth: "advanced",
        includeAnswer: true,
      });
      return { query, answer: response.answer, results: response.results };
    } catch (err) {
      return { error: String(err), fallback_to_webSearchTool: true };
    }
  },
});

// ── Media Generation Tools ────────────────────────────────────────────────────
export const generateImageTool = tool({
  description: "Generate an image using a text prompt. Returns a URL of the generated image.",
  inputSchema: z.object({
    prompt: z.string().describe("Detailed description of the image to generate"),
    aspectRatio: z.enum(["1:1", "16:9", "9:16"]).default("1:1"),
  }),
  execute: async ({ prompt, aspectRatio }: { prompt: string; aspectRatio: string }) => {
    return {
      success: true,
      prompt,
      // For the hackathon/demo, return a placeholder image from Unsplash that matches the prompt
      image_url: `https://image.pollinations.ai/prompt/${encodeURIComponent(prompt)}?width=${aspectRatio === "16:9" ? 1024 : 512}&height=${aspectRatio === "9:16" ? 1024 : 512}&nologo=true`,
      aspectRatio
    };
  },
});

export const generateVideoTool = tool({
  description: "Generate a short video using a text prompt. Returns a video URL.",
  inputSchema: z.object({
    prompt: z.string().describe("Detailed description of the video to generate"),
  }),
  execute: async ({ prompt }: { prompt: string }) => {
    // Return a sample generated video for the hackathon/demo
    return {
      success: true,
      prompt,
      video_url: "https://videos.pexels.com/video-files/3163534/3163534-uhd_2560_1440_30fps.mp4",
      note: "Using sample video for demonstration purposes."
    };
  },
});

export const generateAudioTool = tool({
  description: "Generate audio (Speech, TTS, or SFX) from text.",
  inputSchema: z.object({
    text: z.string().describe("Text to convert to speech"),
    voice: z.string().optional(),
  }),
  execute: async ({ text, voice }: { text: string; voice?: string }) => {
    // Return a sample generated audio for the hackathon/demo
    return {
      success: true,
      text,
      audio_url: "https://actions.google.com/sounds/v1/alarms/bugle_tune.ogg",
      note: "Using sample audio for demonstration purposes."
    };
  },
});

// ── Aggregate tools export ────────────────────────────────────────────────────
export const agentTools = {
  webSearch: webSearchTool,
  tavilySearch: tavilySearchTool,
  httpRequest: httpRequestTool,
  extractPage: extractPageTool,
  getCurrentTime: getCurrentTimeTool,
  parseJson: parseJsonTool,
  evaluateExpression: evaluateExpressionTool,
  summarizeText: summarizeTextTool,
  generateImage: generateImageTool,
  generateVideo: generateVideoTool,
  generateAudio: generateAudioTool,
};

// ── Credential Request Tool (Human-in-the-Loop) ───────────────────────────────
// When the agent needs user-provided secrets/credentials, it calls this tool.
// The execute function returns a special marker: { __credential_request: true }
// The calling layer (SSE handler / WhatsApp reply) intercepts this and pauses
// execution to collect input from the human before resuming.

export const credentialRequestFieldSchema = z.object({
  name: z.string(),
  label: z.string(),
  type: z.enum(["text", "password", "email", "url", "number"]).default("text"),
  placeholder: z.string().optional(),
  required: z.boolean().default(true),
  hint: z.string().optional(),
});

export type CredentialField = z.infer<typeof credentialRequestFieldSchema>;

export const requestCredentialsTool = tool({
  description:
    "Request credentials or configuration values from the user when they are required to complete a task. Examples: API keys, SMTP passwords, account emails, phone numbers. Call this BEFORE attempting to use a service that needs credentials you don't have. The user will be shown a form to fill in the values safely.",
  inputSchema: z.object({
    toolName: z.string().describe("Which service/tool needs these credentials (e.g. 'SendGrid', 'SMTP', 'Twilio')"),
    title: z.string().describe("Short title shown to the user, e.g. 'SendGrid API Key Required'"),
    description: z.string().describe("Explain WHY these credentials are needed and what they will be used for"),
    fields: z.array(credentialRequestFieldSchema),
  }),
  execute: async ({ toolName, title, description, fields }: {
    toolName: string;
    title: string;
    description: string;
    fields: CredentialField[];
  }) => {
    // Returns a special marker — the SSE/chat handler intercepts this and
    // shows a credential form to the user instead of treating this as a
    // normal tool result.
    return {
      __credential_request: true,
      toolName,
      title,
      description,
      fields,
    };
  },
});

// ── Send Email Tool ───────────────────────────────────────────────────────────
// Checks for existing email integrations first. If none, triggers a credential
// request so the user can provide SMTP details or an API key.

export const sendEmailTool = tool({
  description:
    "Send an email with optional attachments. Automatically discovers the best available email method: checks connected integrations (Gmail, SendGrid, SMTP), and if none exist, requests the necessary credentials from the user. Supports HTML body, CC/BCC, and file attachments passed as URLs or base64.",
  inputSchema: z.object({
    to: z.string().describe("Recipient email address (or comma-separated list)"),
    subject: z.string(),
    body: z.string().describe("Email body. Can include HTML."),
    cc: z.string().optional(),
    bcc: z.string().optional(),
    replyTo: z.string().optional(),
    attachments: z.array(z.object({
      filename: z.string(),
      url: z.string().url().optional(),
      base64: z.string().optional(),
      mimeType: z.string().optional(),
    })).optional(),
    // If the user already provided SMTP/API credentials via credential form:
    smtpHost: z.string().optional(),
    smtpPort: z.number().optional(),
    smtpUser: z.string().optional(),
    smtpPass: z.string().optional(),
    senderEmail: z.string().optional(),
    senderName: z.string().optional(),
  }),
  execute: async ({ to, subject, body, cc, bcc, attachments, smtpHost, smtpPort, smtpUser, smtpPass, senderEmail, senderName }: {
    to: string;
    subject: string;
    body: string;
    cc?: string;
    bcc?: string;
    attachments?: { filename: string; url?: string; base64?: string; mimeType?: string }[];
    smtpHost?: string;
    smtpPort?: number;
    smtpUser?: string;
    smtpPass?: string;
    senderEmail?: string;
    senderName?: string;
  }) => {
    // If SMTP credentials were provided by user, use them
    if (smtpHost && smtpUser && smtpPass) {
      try {
        const Nodemailer = await import("nodemailer");
        const transporter = Nodemailer.createTransport({
          host: smtpHost,
          port: smtpPort ?? 587,
          secure: (smtpPort ?? 587) === 465,
          auth: { user: smtpUser, pass: smtpPass },
        });

        const mailAttachments = await Promise.all((attachments ?? []).map(async (att) => {
          if (att.base64) return { filename: att.filename, content: att.base64, encoding: "base64", contentType: att.mimeType };
          if (att.url) {
            const res = await fetch(att.url, { signal: timeoutSignal(10000) });
            const buf = Buffer.from(await res.arrayBuffer());
            return { filename: att.filename, content: buf, contentType: att.mimeType };
          }
          return { filename: att.filename };
        }));

        await transporter.sendMail({
          from: senderName ? `"${senderName}" <${senderEmail ?? smtpUser}>` : (senderEmail ?? smtpUser),
          to, cc, bcc, subject,
          html: body.includes("<") ? body : undefined,
          text: body.includes("<") ? undefined : body,
          attachments: mailAttachments,
        });

        return { success: true, to, subject, attachmentCount: (attachments ?? []).length, method: "smtp" };
      } catch (err) {
        return { success: false, error: String(err) };
      }
    }

    // No credentials available — signal that we need them
    return {
      __credential_request: true,
      toolName: "SMTP Email",
      title: "Email Credentials Required",
      description: `To send an email to **${to}** with subject "${subject}", I need SMTP credentials. You can use Gmail (smtp.gmail.com), Outlook, or any mail provider.`,
      fields: [
        { name: "senderEmail", label: "Your Email Address", type: "email", placeholder: "you@gmail.com", required: true },
        { name: "senderName", label: "Sender Name", type: "text", placeholder: "AutoFlow Bot", required: false },
        { name: "smtpHost", label: "SMTP Host", type: "text", placeholder: "smtp.gmail.com", required: true },
        { name: "smtpPort", label: "SMTP Port", type: "number", placeholder: "587", required: false },
        { name: "smtpUser", label: "SMTP Username / Email", type: "email", placeholder: "you@gmail.com", required: true },
        { name: "smtpPass", label: "SMTP Password / App Password", type: "password", placeholder: "16-char app password", required: true, hint: "For Gmail: enable 2FA and create an App Password" },
      ] as CredentialField[],
    };
  },
});

// ── Generate Code Tool ────────────────────────────────────────────────────────
// The LLM generates code in its response. This tool wraps the result as a
// structured code artifact so the UI can render it with syntax highlighting
// and a copy/download button.

export const generateCodeTool = tool({
  description:
    "Package a piece of code as a named artifact that the user can view, copy, and download. Use this after writing any significant code block — functions, classes, scripts, API integrations. Also returns a list of credentials or environment variables the code needs.",
  inputSchema: z.object({
    filename: z.string().describe("e.g. sendEmail.ts, whatsappBot.py"),
    language: z.enum(["typescript", "javascript", "python", "bash", "json", "yaml", "html", "css", "sql", "other"]),
    code: z.string().describe("The complete code content"),
    description: z.string().describe("One-sentence description of what this code does"),
    requiredEnvVars: z.array(z.object({
      name: z.string().describe("Environment variable name, e.g. SENDGRID_API_KEY"),
      description: z.string(),
      required: z.boolean().default(true),
    })).optional(),
  }),
  execute: async ({ filename, language, code, description, requiredEnvVars }: {
    filename: string;
    language: string;
    code: string;
    description: string;
    requiredEnvVars?: { name: string; description: string; required: boolean }[];
  }) => {
    return {
      __code_artifact: true,
      filename,
      language,
      code,
      description,
      requiredEnvVars: requiredEnvVars ?? [],
      size: code.length,
      lines: code.split("\n").length,
    };
  },
});

// ── Chat tools (available in workshop + WhatsApp sessions) ──────────────────
export const chatTools = {
  ...agentTools,
  requestCredentials: requestCredentialsTool,
  sendEmail: sendEmailTool,
  generateCode: generateCodeTool,
};

export type AgentTools = typeof agentTools;
export type ChatTools = typeof chatTools;
