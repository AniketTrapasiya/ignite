/**
 * lib/chat-engine.ts
 *
 * Chat-mode engine for the Agent Workshop and WhatsApp chatbot.
 * Supports multi-turn conversation history, human-in-the-loop credential
 * collection, and streaming SSE output.
 */
import { streamText, stepCountIs, type ModelMessage } from "ai";
import { prisma } from "./prisma";
import { resolveTextModel } from "./providers";
import { chatTools } from "./agent-tools";

const CHAT_SYSTEM_PROMPT = `You are AutoFlow — a skilled AI assistant and automation engineer.

You help users by:
- Answering questions and providing detailed explanations
- Writing, reviewing, and debugging code in any language
- Setting up automation workflows and API integrations
- Sending emails and messages via connected services
- Searching the web and fetching data from APIs
- Generating complete, production-ready code functions and scripts

When writing code:
1. Write complete, working code — not pseudocode or snippets
2. Include all imports, error handling, and type annotations
3. Use the 'generateCode' tool to save the code as a named artifact the user can copy/download
4. List any environment variables or secrets the code requires

When you need credentials (API keys, SMTP passwords, etc.):
1. ALWAYS check if you already have them in the conversation context
2. If not, use the 'requestCredentials' tool — do NOT make up or guess credentials
3. After the user provides credentials, retry the action immediately

When sending email:
1. Use the 'sendEmail' tool — it will call 'requestCredentials' automatically if no SMTP config exists
2. Once credentials are provided, proceedwith sending

Be thorough, precise, and execution-focused.
If you encounter an error, explain it clearly and suggest a fix.`;

export interface ChatMessage {
  role: "user" | "assistant" | "system" | "tool";
  content: string;
  artifacts?: CodeArtifact[];
  credentialRequest?: CredentialRequest | null;
  toolCalls?: ToolCallSummary[];
}

export interface CodeArtifact {
  filename: string;
  language: string;
  code: string;
  description: string;
  requiredEnvVars?: { name: string; description: string; required: boolean }[];
}

export interface CredentialRequest {
  id?: string;
  toolName: string;
  title: string;
  description: string;
  fields: {
    name: string;
    label: string;
    type: string;
    placeholder?: string;
    required: boolean;
    hint?: string;
  }[];
}

export interface ToolCallSummary {
  name: string;
  args: Record<string, unknown>;
  result?: unknown;
  status: "calling" | "done" | "error";
}

/**
 * Stream a chat turn. Returns a ReadableStream of SSE data.
 *
 * SSE event shapes:
 *   { text: "..." }
 *   { toolCall: { name, args } }
 *   { toolResult: { name, result } }
 *   { credentialRequest: { id, toolName, title, description, fields } }
 *   { codeArtifact: { filename, language, code, description, requiredEnvVars } }
 *   { done: true, messageId: "..." }
 *   { error: "..." }
 */
export async function streamChatTurn(opts: {
  userId: string;
  sessionId: string;
  history: ModelMessage[];   // previous messages in the session
  userMessage: string;
  modelId?: string;
  mediaContext?: string;     // image/file context (base64 data-URL or description)
}): Promise<ReadableStream<Uint8Array>> {
  const { userId, sessionId, userMessage, modelId = "gemini-2.5-flash", mediaContext } = opts;

  // Resolve AI model
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let aiModel: any;
  try {
    aiModel = await resolveTextModel(userId, modelId);
  } catch (err) {
    throw new Error(err instanceof Error ? err.message : "Failed to resolve AI model");
  }

  const fullUserMessage = mediaContext
    ? `${userMessage}\n\n[ATTACHED CONTENT]\n${mediaContext}`
    : userMessage;

  // Build message array for the model
  const messages: ModelMessage[] = [
    ...opts.history,
    { role: "user", content: fullUserMessage },
  ];

  const encoder = new TextEncoder();

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      function emit(data: Record<string, unknown>) {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
      }

      // Accumulated text and artifacts for DB persistence
      let fullText = "";
      const artifacts: CodeArtifact[] = [];
      let credentialRequest: CredentialRequest | null = null;

      try {
        const response = streamText({
          model: aiModel,
          system: CHAT_SYSTEM_PROMPT,
          messages,
          maxOutputTokens: 8192,
          tools: chatTools,
          stopWhen: stepCountIs(20),
        });

        for await (const part of response.fullStream) {
          const p = part as {
            type: string;
            text?: string;
            textDelta?: string;
            toolName?: string;
            input?: Record<string, unknown>;
            args?: Record<string, unknown>;
            output?: unknown;
            result?: unknown;
            error?: unknown;
          };

          if (p.type === "text-delta") {
            const chunk = p.text ?? p.textDelta ?? "";
            if (chunk) {
              fullText += chunk;
              emit({ text: chunk });
            }
          } else if (p.type === "tool-call") {
            emit({ toolCall: { name: p.toolName, args: p.input ?? p.args ?? {} } });
          } else if (p.type === "tool-result") {
            const result = p.output ?? p.result;

            // Detect special tool return values
            if (result && typeof result === "object") {
              const r = result as Record<string, unknown>;

              if (r.__code_artifact) {
                const artifact: CodeArtifact = {
                  filename: r.filename as string,
                  language: r.language as string,
                  code: r.code as string,
                  description: r.description as string,
                  requiredEnvVars: r.requiredEnvVars as CodeArtifact["requiredEnvVars"],
                };
                artifacts.push(artifact);
                emit({ codeArtifact: artifact });
              } else if (r.__credential_request) {
                const cr: CredentialRequest = {
                  toolName: r.toolName as string,
                  title: r.title as string,
                  description: r.description as string,
                  fields: r.fields as CredentialRequest["fields"],
                };

                // Persist as PendingCredential in DB
                try {
                  const pending = await prisma.pendingCredential.create({
                    data: {
                      sessionId,
                      toolName: cr.toolName,
                      schema: cr.fields as object[],
                      resolved: false,
                    },
                  });
                  cr.id = pending.id;
                } catch {
                  // DB unavailable — still emit without an id
                }

                credentialRequest = cr;
                emit({ credentialRequest: cr });
              } else {
                emit({ toolResult: { name: p.toolName, result } });
              }
            } else {
              emit({ toolResult: { name: p.toolName, result } });
            }
          } else if (p.type === "error") {
            emit({ error: String(p.error) });
          }
        }

        // Persist the assistant message to DB
        let messageId = `msg-${Date.now()}`;
        try {
          const msg = await prisma.chatMessage.create({
            data: {
              sessionId,
              role: "assistant",
              content: fullText,
              artifacts: artifacts as object[],
              metadata: credentialRequest
                ? ({ credentialRequest } as object)
                : ({} as object),
            },
          });
          messageId = msg.id;

          // Update session updatedAt
          await prisma.chatSession.update({
            where: { id: sessionId },
            data: { updatedAt: new Date() },
          });
        } catch {
          // DB unavailable — continue
        }

        emit({ done: true, messageId });
      } catch (err) {
        emit({ error: err instanceof Error ? err.message : String(err) });
      } finally {
        controller.close();
      }
    },
  });

  return stream;
}

/**
 * Load the last N messages from a session as ModelMessages for the AI model.
 */
export async function loadSessionHistory(
  sessionId: string,
  limit = 20
): Promise<ModelMessage[]> {
  const messages = await prisma.chatMessage.findMany({
    where: { sessionId },
    orderBy: { createdAt: "desc" },
    take: limit,
  });

  return messages
    .reverse()
    .filter((m) => m.role === "user" || m.role === "assistant")
    .map((m) => ({
      role: m.role as "user" | "assistant",
      content: [{ type: "text" as const, text: m.content }],
    }));
}

/**
 * Inject resolved credential values into the next user message as context.
 * Called when a user submits a credential form.
 */
export function buildCredentialResolutionMessage(
  toolName: string,
  values: Record<string, string>
): string {
  const entries = Object.entries(values)
    .map(([k, v]) => `  ${k}: ${v}`)
    .join("\n");
  return `Here are the credentials you requested for ${toolName}:\n${entries}\n\nPlease continue with the task now.`;
}
