import { getCurrentUser } from "@/lib/auth";
import { redirect } from "next/navigation";
import { AIKeysClient } from "@/components/settings/ai-keys-client";

export default async function AIKeysPage() {
  const session = await getCurrentUser();
  if (!session) redirect("/signin");

  return (
    <div className="min-h-screen bg-[#09090f] text-white">
      <div className="max-w-4xl mx-auto px-6 py-10">
        <div className="flex items-center gap-3 mb-8">
          <div className="w-8 h-8 rounded-lg bg-purple-500/20 border border-purple-500/30 flex items-center justify-center">
            <svg className="w-4 h-4 text-purple-400" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 5.25a3 3 0 013 3m3 0a6 6 0 01-7.029 5.912c-.563-.097-1.159.026-1.563.43L10.5 17.25H8.25v2.25H6v2.25H2.25v-2.818c0-.597.237-1.17.659-1.591l6.499-6.499c.404-.404.527-1 .43-1.563A6 6 0 1121.75 8.25z" />
            </svg>
          </div>
          <div>
            <h1 className="text-2xl font-bold">AI Keys</h1>
            <p className="text-sm text-white/40">Manage your AI provider credentials</p>
          </div>
        </div>
        <AIKeysClient />
      </div>
    </div>
  );
}
