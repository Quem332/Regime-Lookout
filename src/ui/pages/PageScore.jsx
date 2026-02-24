import React, { useMemo, useState } from "react";
import { Pill } from "../components/Pill";
import { Modal } from "../components/Modal";
import { tSafe } from "../render/mriPipeline";


function tagText(tag){
  if (tag==null) return "";
  if (typeof tag === "string") return tag;
  if (typeof tag === "number") return String(tag);
  if (typeof tag === "object") return tag.label || tag.msg || JSON.stringify(tag);
  return String(tag);
}
function pct(v) {
  if (v === null || v === undefined || Number.isNaN(v)) return "—";
  return `${Math.round(v * 100)}%`;
}

function clamp01(x) {
  const v = Number(x);
  if (Number.isNaN(v)) return 0;
  return Math.max(0, Math.min(1, v));
}


function tGet(t, path, fallback) {
  try {
    if (typeof t === "function") return tSafe(t, path, fallback);
    if (t && typeof t === "object") {
      const parts = String(path || "").split(".");
      let cur = t;
      for (const p of parts) {
        if (!cur || typeof cur !== "object") return fallback;
        cur = cur[p];
      }
      return cur ?? fallback;
    }
    return fallback;
  } catch {
    return fallback;
  }
}
function Bar({ value01 }) {
  const w = Math.round(clamp01(value01) * 100);
  return (
    <div className="h-2 bg-white/10 rounded-full overflow-hidden">
      <div className="h-full bg-white/60" style={{ width: `${w}%` }} />
    </div>
  );
}

export function PageScore({ t, daily, lang }) {
  const [openTags, setOpenTags] = useState(false);
  const [tagPage, setTagPage] = useState(0);
  const TAGS_PER_PAGE = 12;
  const [openScenarios, setOpenScenarios] = useState(false);

  const score = daily?.score ?? 0;
  const C = daily?.confidenceFinal ?? 0;
  const regime = daily?.regime || "—";

  const topScenarios = useMemo(() => {
    const arr = daily?.topScenarios || [];
    return arr.slice(0, 3);
  }, [daily]);

  const allScenarios = daily?.topScenarios || [];
  const tags = daily?.tags || [];

  const scoreTone = score >= 70 ? "green" : score >= 50 ? "yellow" : "red";
  const confTone = C >= 70 ? "green" : C >= 50 ? "yellow" : "red";

  return (
    <div className="h-full flex flex-col gap-3">
      {/* Header row: Score (top) + regime */}
      <div className="rounded-2xl border border-white/10 bg-white/5 p-3">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="text-xs text-gray-400">{tGet(t, "score.titleTop", "Score")}</div>
            <div className="text-3xl font-extrabold leading-none mt-1">{Math.round(score)}</div>
            <div className="text-[11px] text-gray-400 mt-1">{tGet(t, "score.reliability", lang === "ko" ? "신뢰도" : "Reliability")}: {Math.round(C)}</div>
          </div>

          <div className="text-right">
            <div className="text-xs text-gray-400">{lang === "ko" ? "레짐" : "Regime"}</div>
            <div className="text-lg font-bold mt-0.5">{regime}</div>
            <div className="flex gap-2 mt-2 justify-end">
              <Pill tone={scoreTone}>{lang === "ko" ? "점수" : "Score"}: {Math.round(score)}</Pill>
              <Pill tone={confTone}>C: {Math.round(C)}</Pill>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2 mt-3">
          <div>
            <div className="text-[11px] text-gray-400 mb-1">Score</div>
            <Bar value01={score / 100} />
          </div>
          <div>
            <div className="text-[11px] text-gray-400 mb-1">C</div>
            <Bar value01={C / 100} />
          </div>
        </div>
      </div>

      {/* Top scenarios */}
      <div className="rounded-2xl border border-white/10 bg-white/5 p-3">
        <div className="flex items-center justify-between">
          <div className="text-sm font-semibold">{tGet(t, "score.topScenarios", "Top scenarios")}</div>
          {allScenarios.length > 3 ? (
            <button
              data-swipe-ignore
              className="text-xs text-blue-300"
              onClick={() => setOpenScenarios(true)}
            >
              {lang === "ko" ? "더보기" : "More"}
            </button>
          ) : null}
        </div>
        <div className="mt-2 grid grid-cols-1 gap-2">
          {topScenarios.map((s) => (
            <div key={s.key} className="flex items-center justify-between rounded-xl border border-white/10 bg-white/0 px-3 py-2">
              <div className="text-sm font-semibold min-w-0 truncate">{tGet(t, `scenarios.${s.key}`, "—") || s.name || "—"}</div>
              <div className="text-sm font-bold">{pct(s.prob)}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Tags */}
      <div className="rounded-2xl border border-white/10 bg-white/5 p-3 flex-1">
        <div className="flex items-center justify-between">
          <div className="text-sm font-semibold">{lang === "ko" ? "태그" : "Tags"}</div>
          {tags.length > 3 ? (
            <button data-swipe-ignore className="text-xs text-blue-300" onClick={() => setOpenTags(true)}>
              {lang === "ko" ? "더보기" : "More"}
            </button>
          ) : null}
        </div>

        <div className="mt-2 flex flex-wrap gap-2">
          {(tags || []).slice(0, 6).map((tag, i) => (
            <Pill key={`${tagText(tag)}-${i}`} tone="blue">
              {tagText(tag)}
            </Pill>
          ))}
          {(tags || []).length === 0 ? <div className="text-xs text-gray-500">—</div> : null}
        </div>
      </div>

      {/* Modals */}
      <Modal
        open={openTags}
        title={lang === "ko" ? "태그 전체" : "All tags"}
        onClose={() => setOpenTags(false)}
      >
        <div className="flex items-center justify-between mb-3">
          <div className="text-xs text-white/50">
            {(tags || []).length} {lang === "ko" ? "개" : "items"}
          </div>
          <div className="flex gap-2">
            <button
              className="text-xs px-2 py-1 rounded-lg bg-white/10 hover:bg-white/15 disabled:opacity-40"
              onClick={() => setTagPage((p) => Math.max(0, p - 1))}
              disabled={tagPage === 0}
            >
              {lang === "ko" ? "이전" : "Prev"}
            </button>
            <button
              className="text-xs px-2 py-1 rounded-lg bg-white/10 hover:bg-white/15 disabled:opacity-40"
              onClick={() =>
                setTagPage((p) =>
                  (p + 1) * TAGS_PER_PAGE >= (tags || []).length ? p : p + 1
                )
              }
              disabled={(tagPage + 1) * TAGS_PER_PAGE >= (tags || []).length}
            >
              {lang === "ko" ? "다음" : "Next"}
            </button>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          {(tags || [])
            .slice(tagPage * TAGS_PER_PAGE, (tagPage + 1) * TAGS_PER_PAGE)
            .map((tag, i) => (
              <Pill key={i} tone="blue" label={tag.label ?? tagText(tag)} msg={tag.msg} lang={lang} />
            ))}
        </div>
      </Modal>

      <Modal
        open={openScenarios}
        title={lang === "ko" ? "시나리오 전체" : "All scenarios"}
        onClose={() => setOpenScenarios(false)}
      >
        <div className="grid gap-2">
          {(allScenarios || []).slice(0, 8).map((s, i) => (
            <div
              key={i}
              className="rounded-xl border border-white/10 bg-white/5 p-3 flex items-center justify-between"
            >
              <div className="min-w-0">
                <div className="text-sm font-semibold text-white/90 truncate">
                  {s.name}
                </div>
                <div className="text-xs text-white/50 mt-1 truncate">
                  {s.reason || ""}
                </div>
              </div>
              <div className="shrink-0 text-sm font-semibold text-white/80">
                {Math.round((s.p || 0) * 100)}%
              </div>
            </div>
          ))}
          {(allScenarios || []).length > 8 ? (
            <div className="text-xs text-white/45">
              {lang === "ko"
                ? "상위 8개만 표시 (스크롤 0 고정)"
                : "Showing top 8 (scroll-0 fixed)"}
            </div>
          ) : null}
        </div>
      </Modal>
    </div>
  );
}
