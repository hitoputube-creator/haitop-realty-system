-- 추천매물장 종료(보관) 처리: 삭제하지 않고 closed_at 에 종료 시각을 기록한다. NULL = 진행중
ALTER TABLE public.recommended_properties ADD COLUMN IF NOT EXISTS closed_at timestamptz;
