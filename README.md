# AI Trade Review Lab

개인 거래 기록을 Supabase에 저장하고, 전략/규칙/감정/실수 유형을 구조화해 AI 복기 리포트를 생성하는 Next.js 앱입니다. AI 출력은 투자 추천이 아니라 과거 거래 기록 분석과 복기 보조 용도입니다.

## Stack

- Next.js App Router, TypeScript, Tailwind CSS, Recharts
- Supabase Auth, Postgres, Storage, RLS
- OpenAI-compatible provider abstraction
- Vitest unit tests for metrics, AI validation, Hyperliquid merge logic

## Setup

```bash
npm.cmd install
copy .env.local.example .env.local
npm.cmd run dev
```

Supabase SQL editor에서 `supabase/schema.sql`을 실행한 뒤 `.env.local`에 Supabase URL/anon key/service role key, OpenAI key, cron secret을 채웁니다.

## Environment

```bash
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
APP_USER_ID=
OPENAI_API_KEY=
OPENAI_MODEL=gpt-4.1-mini
CRON_SECRET=replace-with-a-long-random-secret
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

`CRON_SECRET`이 비어 있으면 `/api/cron/weekly-review`는 503으로 실행을 거부합니다. `SUPABASE_SERVICE_ROLE_KEY`와 `APP_USER_ID`는 Vercel Cron이 사용자 세션 없이 주간 리포트를 생성할 때만 사용합니다.

## Supabase Storage

`supabase/schema.sql`은 비공개 `trade-screenshots` 버킷과 Storage RLS 정책을 함께 생성합니다. 스크린샷은 `user_id/trade_id/file` 경로에 저장되고, 첫 폴더가 현재 사용자 ID와 일치할 때만 접근할 수 있습니다.

## Core Commands

```bash
npm.cmd run dev
npm.cmd run typecheck
npm.cmd run test
npm.cmd run build
```

## CSV

샘플 파일은 `public/sample-trades.csv`에 있습니다. `strategy` 컬럼은 기존 전략명과 매칭되며, 없으면 새 전략을 생성합니다. 시간 컬럼은 ISO8601을 권장하고, timezone이 없으면 KST로 해석합니다.

## Deploy

1. Vercel에 프로젝트를 연결합니다.
2. Vercel 환경변수에 `.env.local.example` 항목을 입력합니다.
3. Supabase에서 `supabase/schema.sql`을 실행합니다.
4. Vercel Cron은 `vercel.json`의 `/api/cron/weekly-review` 스케줄을 사용합니다.

## Safety

- 주문 실행 기능은 없습니다.
- 모든 앱 API는 Supabase Auth 사용자 기준으로 RLS를 적용합니다.
- Export 링크는 서버 쿠키 세션을 사용하며 현재 사용자 데이터만 반환합니다.
- Hyperliquid import는 공개 지갑 fills 조회용이고, fills를 포지션 단위 VWAP 거래로 병합합니다.
