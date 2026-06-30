import type { AiReview, Rule, Screenshot, Strategy, Trade } from "@/lib/types";

export const tradeSelect =
  "*, strategies(id,name,status), trade_rules(status, rules(id,name)), screenshots(*)";

export function normalizeTrade(row: any): Trade {
  return {
    ...row,
    strategy: row.strategies ?? null,
    strategy_name: row.strategies?.name ?? null,
    rule_results: (row.trade_rules ?? []).map((item: any) => ({
      rule_id: item.rules?.id,
      rule_name: item.rules?.name ?? "unknown",
      status: item.status
    })),
    screenshots: row.screenshots ?? []
  };
}

export async function loadTradesForUser(supabase: any, userId: string): Promise<Trade[]> {
  const { data, error } = await supabase
    .from("trades")
    .select(tradeSelect)
    .eq("user_id", userId)
    .order("entry_time", { ascending: false });

  if (error) throw new Error(error.message);
  return (data ?? []).map(normalizeTrade);
}

export async function loadTradeForUser(
  supabase: any,
  userId: string,
  tradeId: string
): Promise<Trade | null> {
  const { data, error } = await supabase
    .from("trades")
    .select(tradeSelect)
    .eq("user_id", userId)
    .eq("id", tradeId)
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!data) return null;
  return addScreenshotUrls(supabase, normalizeTrade(data));
}

export async function loadStrategiesForUser(supabase: any, userId: string): Promise<Strategy[]> {
  const { data, error } = await supabase
    .from("strategies")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });

  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function loadRulesForUser(supabase: any, userId: string): Promise<Rule[]> {
  const { data, error } = await supabase
    .from("rules")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });

  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function loadAiReviewsForUser(
  supabase: any,
  userId: string,
  limit = 10
): Promise<AiReview[]> {
  const { data, error } = await supabase
    .from("ai_reviews")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) throw new Error(error.message);
  return data ?? [];
}

async function addScreenshotUrls(supabase: any, trade: Trade): Promise<Trade> {
  const screenshots = trade.screenshots ?? [];
  if (screenshots.length === 0) return trade;

  const withUrls = await Promise.all(
    screenshots.map(async (screenshot: Screenshot) => {
      const { data } = await supabase.storage
        .from("trade-screenshots")
        .createSignedUrl(screenshot.storage_path, 60 * 60);
      return {
        ...screenshot,
        signed_url: data?.signedUrl ?? null
      };
    })
  );

  return {
    ...trade,
    screenshots: withUrls
  };
}
