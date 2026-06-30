import { RulesManager } from "@/components/rules-manager";
import { loadRulesForUser, loadTradesForUser } from "@/lib/data";
import { requireServerUser } from "@/lib/supabase/server";

export default async function RulesPage() {
  const { supabase, user } = await requireServerUser();
  if (!user) {
    return (
      <div className="rounded-md border border-line bg-panel p-6 shadow-dashboard">
        <h1 className="text-xl font-semibold text-white">로그인이 필요합니다</h1>
        <p className="mt-2 text-sm text-slate-400">규칙을 관리하려면 먼저 로그인하세요.</p>
      </div>
    );
  }

  const [rules, trades] = await Promise.all([
    loadRulesForUser(supabase, user.id),
    loadTradesForUser(supabase, user.id)
  ]);

  return <RulesManager initialRules={rules} trades={trades} />;
}
