#!/usr/bin/env bash
# shadcn 컴포넌트 추가 후, 레지스트리가 넣는 `cn` 패키지를 clsx + tailwind-merge 기반 @/lib/utils로 되돌린다.
# 사용법: pnpm ui:add dialog table ...
set -euo pipefail

(yes n || true) | pnpm dlx shadcn@latest add --yes "$@"

grep -rl 'from "cn"' src 2>/dev/null | xargs -r sed -i.bak 's#import { cn } from "cn"#import { cn } from "@/lib/utils"#'
find src -name "*.bak" -delete

if grep -q '"cn":' package.json; then
  pnpm remove cn
fi
