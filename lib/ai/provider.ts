import { REVIEW_SYSTEM_PROMPT, buildReviewUserPrompt } from "@/lib/ai/prompts";
import type { ReviewInput } from "@/lib/ai/build-input";

export interface AiCompletion {
  content: string;
  model: string;
  token_usage?: {
    input?: number;
    output?: number;
    total?: number;
  };
}

export interface AiReviewProvider {
  completeReview(input: ReviewInput, retryHint?: string): Promise<AiCompletion>;
}

export class OpenAiReviewProvider implements AiReviewProvider {
  constructor(
    private readonly apiKey = process.env.OPENAI_API_KEY,
    private readonly model = process.env.OPENAI_MODEL ?? "gpt-4.1-mini"
  ) {}

  async completeReview(input: ReviewInput, retryHint?: string): Promise<AiCompletion> {
    if (!this.apiKey) {
      throw new Error("OPENAI_API_KEY is not configured.");
    }

    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: this.model,
        temperature: 0.2,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: REVIEW_SYSTEM_PROMPT },
          { role: "user", content: buildReviewUserPrompt(input, retryHint) }
        ]
      })
    });

    if (!response.ok) {
      const detail = await response.text();
      throw new Error(`OpenAI request failed: ${response.status} ${detail}`);
    }

    const payload = await response.json();
    const choice = payload.choices?.[0]?.message?.content;
    if (!choice) throw new Error("OpenAI response did not include content.");

    return {
      content: choice,
      model: payload.model ?? this.model,
      token_usage: {
        input: payload.usage?.prompt_tokens,
        output: payload.usage?.completion_tokens,
        total: payload.usage?.total_tokens
      }
    };
  }
}

export function getAiReviewProvider(): AiReviewProvider {
  return new OpenAiReviewProvider();
}
