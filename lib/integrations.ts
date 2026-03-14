import { prisma } from "./prisma";
import { encrypt, decrypt } from "./encryption";

export const INTEGRATIONS = [
  {
    service: "youtube",
    name: "YouTube",
    category: "Content",
    description: "Fetch trending videos, search content, get transcripts",
    authMethod: "api_key" as const,
    keyLabel: "YouTube Data API v3 Key",
    color: "#FF0000",
    capabilities: ["Fetch trending videos", "Search videos", "Get transcripts"],
  },
  {
    service: "gmail",
    name: "Gmail",
    category: "Communication",
    description: "Send emails, read inbox, search messages",
    authMethod: "api_key" as const,
    keyLabel: "Gmail App Password or OAuth Token",
    color: "#EA4335",
    capabilities: ["Send emails", "Read inbox", "Search messages"],
  },
  {
    service: "slack",
    name: "Slack",
    category: "Communication",
    description: "Send messages, post to channels, notify teams",
    authMethod: "api_key" as const,
    keyLabel: "Slack Bot Token (xoxb-...)",
    color: "#4A154B",
    capabilities: ["Send messages", "Post to channels", "List channels"],
  },
  {
    service: "hubspot",
    name: "HubSpot",
    category: "CRM",
    description: "Create contacts, update deals, send emails",
    authMethod: "api_key" as const,
    keyLabel: "HubSpot Private App Token",
    color: "#FF7A59",
    capabilities: ["Create contacts", "Update deals", "Log activity"],
  },
  {
    service: "facebook",
    name: "Facebook",
    category: "Social",
    description: "Post content to pages, read insights",
    authMethod: "api_key" as const,
    keyLabel: "Facebook Page Access Token",
    color: "#1877F2",
    capabilities: ["Post to page", "Read page insights", "Schedule posts"],
  },
  {
    service: "whatsapp",
    name: "WhatsApp",
    category: "Messaging",
    description: "Send messages using WhatsApp Business API",
    authMethod: "api_key" as const,
    keyLabel: "Meta WhatsApp Business API Token",
    color: "#25D366",
    capabilities: ["Send messages", "Use templates", "Send media"],
  },
  {
    service: "sheets",
    name: "Google Sheets",
    category: "Data",
    description: "Read and write spreadsheet data",
    authMethod: "api_key" as const,
    keyLabel: "Google Service Account JSON Key",
    color: "#34A853",
    capabilities: ["Read rows", "Write rows", "Create sheets"],
  },
  {
    service: "notion",
    name: "Notion",
    category: "Productivity",
    description: "Create pages, update databases, manage content",
    authMethod: "api_key" as const,
    keyLabel: "Notion Integration Token",
    color: "#000000",
    capabilities: ["Create pages", "Update databases", "Search content"],
  },
  {
    service: "airtable",
    name: "Airtable",
    category: "Data",
    description: "Read and write Airtable base records",
    authMethod: "api_key" as const,
    keyLabel: "Airtable Personal Access Token",
    color: "#FCB400",
    capabilities: ["Read records", "Write records", "Search base"],
  },
  {
    service: "custom",
    name: "Custom API",
    category: "Custom",
    description: "Call any HTTP API with custom auth headers",
    authMethod: "api_key" as const,
    keyLabel: "API Key (will be sent as Authorization header)",
    color: "#6366F1",
    capabilities: ["HTTP GET", "HTTP POST", "Custom headers"],
  },
] as const;

export type ServiceId = (typeof INTEGRATIONS)[number]["service"];

export interface IntegrationCredentials {
  apiKey?: string;
  baseUrl?: string;
  [key: string]: string | undefined;
}

export async function getIntegrations(userId: string) {
  const rows = await prisma.integration.findMany({ where: { userId } });
  return rows.map((r) => ({
    ...r,
    credentials: undefined, // never expose to client
  }));
}

export async function saveIntegration(
  userId: string,
  service: string,
  credentials: IntegrationCredentials
): Promise<void> {
  const encrypted = encrypt(JSON.stringify(credentials));
  await prisma.integration.upsert({
    where: { userId_service: { userId, service } },
    create: { userId, service, credentials: encrypted, status: "connected" },
    update: { credentials: encrypted, status: "connected", updatedAt: new Date() },
  });
}

export async function removeIntegration(userId: string, service: string): Promise<void> {
  await prisma.integration.deleteMany({ where: { userId, service } });
}

export async function getCredentials(
  userId: string,
  service: string
): Promise<IntegrationCredentials | null> {
  const row = await prisma.integration.findUnique({
    where: { userId_service: { userId, service } },
  });
  if (!row) return null;
  await prisma.integration.update({
    where: { userId_service: { userId, service } },
    data: { lastUsedAt: new Date() },
  });
  return JSON.parse(decrypt(row.credentials));
}

export async function getActiveServices(userId: string): Promise<string[]> {
  const rows = await prisma.integration.findMany({
    where: { userId, status: "connected" },
    select: { service: true },
  });
  return rows.map((r) => r.service);
}

export function buildModsContext(activeServices: string[]): string {
  if (activeServices.length === 0) return "";
  const mods = INTEGRATIONS.filter((i) => activeServices.includes(i.service));
  const lines = mods.map(
    (m) => `- ${m.name}: ${m.capabilities.join(", ")}`
  );
  return "[ACTIVE TOOLS / MODS]\nYou have access to the following integrations:\n" + lines.join("\n");
}
