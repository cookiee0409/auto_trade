import { TradesManager } from "@/components/trades-manager";
import { loadRulesForUser, loadStrategiesForUser, loadTradesForUser } from "@/lib/data";
import { requireServerUser } from "@/lib/supabase/server";

export default async function TradesPage() {
  const { supabase, user } = await requireServerUser();
  if (!user) {
    return (
      <div className="rounded-md border border-line bg-panel p-6 shadow-dashboard">
        <h1 className="text-xl font-semibold text-white">로그인이 필요합니다</h1>
        <p className="mt-2 text-sm text-slate-400">거래를 저장하고 조회하려면 먼저 로그인하세요.</p>
      </div>
    );
  }

  const [trades, strategies, rules] = await Promise.all([
    loadTradesForUser(supabase, user.id),
    loadStrategiesForUser(supabase, user.id),
    loadRulesForUser(supabase, user.id)
  ]);

  return <TradesManager initialTrades={trades} strategies={strategies} rules={rules} />;
}
