import { StrategiesManager } from "@/components/strategies-manager";
import { loadStrategiesForUser, loadTradesForUser } from "@/lib/data";
import { requireServerUser } from "@/lib/supabase/server";

export default async function StrategiesPage() {
  const { supabase, user } = await requireServerUser();
  if (!user) {
    return (
      <div className="rounded-md border border-line bg-panel p-6 shadow-dashboard">
        <h1 className="text-xl font-semibold text-white">로그인이 필요합니다</h1>
        <p className="mt-2 text-sm text-slate-400">전략을 관리하려면 먼저 로그인하세요.</p>
      </div>
    );
  }

  const [strategies, trades] = await Promise.all([
    loadStrategiesForUser(supabase, user.id),
    loadTradesForUser(supabase, user.id)
  ]);

  return <StrategiesManager initialStrategies={strategies} trades={trades} />;
}
