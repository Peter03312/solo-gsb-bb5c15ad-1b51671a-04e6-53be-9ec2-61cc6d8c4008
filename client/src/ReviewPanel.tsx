import { useMemo, useState } from 'react';
import { buildReview } from './schedule';
import { CycleInfo, NodeRuntime, Project, ReviewSnapshot, ReviewStatus } from './types';
import { CyclePath } from './SidePanel';

interface ReviewPanelProps {
  /** 模拟开始时冻结的排程快照；null 表示尚未开始模拟（复盘不可用） */
  snapshot: ReviewSnapshot | null;
  /** 当前口令图（仅用于在不可用时展示成环路径；不参与复盘数据） */
  project: Project;
  /** 当前执行记录（暂停 / 结束时按此计算实际起止与状态） */
  runtime: Record<string, NodeRuntime>;
  /** 冻结快照时图存在环依赖；为 true 时复盘不可用 */
  cyclic: boolean;
  /** 冻结之后图当前存在的环依赖路径（有环时同样不可用；快照本身保留不变） */
  cycle?: CycleInfo;
}

/**
 * 执行复盘面板（只读，不写回项目）。
 * - 模拟开始时冻结排程快照，结束或暂停时查看每条口令的计划起止、实际起止、
 *   开始 / 结束偏差及状态（按时、延迟、未执行），按实际开始时间排序；
 * - 总览显示完成数、最大延迟与总工期偏差；
 * - 模拟期间的图编辑与现场续排不改写冻结快照；重置后快照清空；
 * - 图有环或尚未开始模拟时显示不可用。
 */
export function ReviewPanel(props: ReviewPanelProps) {
  const { snapshot, project, runtime, cyclic, cycle } = props;
  const [collapsed, setCollapsed] = useState(false);

  const review = useMemo(
    () => (snapshot && !cyclic && !cycle ? buildReview(snapshot, runtime) : null),
    [snapshot, runtime, cyclic, cycle],
  );

  const unavailableReason = !snapshot
    ? '尚未开始模拟：执行复盘将在开始模拟时冻结本次排程快照，暂停或结束后可查看。'
    : cyclic
      ? '开始模拟时口令图存在环依赖，排程不可信，执行复盘不可用；请解除成环约束后重新开始模拟。'
      : cycle
        ? '口令图当前存在环依赖，执行复盘不可用；冻结快照保留不变，解除成环后可继续查看。'
        : null;

  return (
    <section className="review-panel">
      <header className="review-panel-head">
        <h2>执行复盘</h2>
        {review && (
          <>
            <span className="review-meta">
              完成 {review.summary.completed}/{review.summary.total}
            </span>
            <span className="review-meta">
              最大延迟 {fmt(review.summary.maxDelay)}s
            </span>
            <span className="review-meta">
              总工期偏差 <Deviation value={review.summary.makespanDeviation} />
            </span>
          </>
        )}
        {unavailableReason && <span className="review-meta review-meta-off">不可用</span>}
        <span className="spacer" />
        <button className="review-toggle" onClick={() => setCollapsed((c) => !c)}>
          {collapsed ? '展开 ▾' : '收起 ▴'}
        </button>
      </header>
      {!collapsed && (
        <div className="review-panel-body">
          {unavailableReason ? (
            <>
              <p className="hint review-unavailable">{unavailableReason}</p>
              {cycle && <CyclePath project={project} cycle={cycle} />}
              {!cycle && cyclic && snapshot?.cycle && (
                <CyclePath project={project} cycle={snapshot.cycle} />
              )}
            </>
          ) : !review || review.rows.length === 0 ? (
            <p className="hint">冻结快照内暂无口令。</p>
          ) : (
            <>
              <div className="review-summary">
                <div className="review-stat">
                  <span className="review-stat-label">完成数</span>
                  <span className="review-stat-value">
                    {review.summary.completed}
                    <span className="review-stat-sub"> / {review.summary.total}</span>
                  </span>
                </div>
                <div className="review-stat">
                  <span className="review-stat-label">最大延迟</span>
                  <span className="review-stat-value">
                    {fmt(review.summary.maxDelay)}
                    <span className="review-stat-sub">s</span>
                  </span>
                </div>
                <div className="review-stat">
                  <span className="review-stat-label">计划总工期</span>
                  <span className="review-stat-value">
                    {fmt(review.summary.plannedMakespan)}
                    <span className="review-stat-sub">s</span>
                  </span>
                </div>
                <div className="review-stat">
                  <span className="review-stat-label">实际总工期</span>
                  <span className="review-stat-value">
                    {fmt(review.summary.actualMakespan)}
                    <span className="review-stat-sub">s</span>
                  </span>
                </div>
                <div className="review-stat">
                  <span className="review-stat-label">总工期偏差</span>
                  <span className="review-stat-value">
                    <Deviation value={review.summary.makespanDeviation} />
                  </span>
                </div>
              </div>
              <table className="review-table">
                <thead>
                  <tr>
                    <th>口令</th>
                    <th>计划起</th>
                    <th>计划止</th>
                    <th>实际起</th>
                    <th>实际止</th>
                    <th>开始偏差</th>
                    <th>结束偏差</th>
                    <th>状态</th>
                  </tr>
                </thead>
                <tbody>
                  {review.rows.map((r) => (
                    <tr key={r.nodeId} className={`review-row review-${r.status}`}>
                      <td>
                        {r.name}
                        {r.running && <span className="review-tag">执行中</span>}
                      </td>
                      <td>{fmt(r.plannedStart)}s</td>
                      <td>{fmt(r.plannedEnd)}s</td>
                      <td>{r.actualStart === undefined ? '—' : `${fmt(r.actualStart)}s`}</td>
                      <td>{r.actualEnd === undefined ? '—' : `${fmt(r.actualEnd)}s`}</td>
                      <td>
                        {r.startDeviation === undefined ? '—' : <Deviation value={r.startDeviation} />}
                      </td>
                      <td>
                        {r.endDeviation === undefined ? '—' : <Deviation value={r.endDeviation} />}
                      </td>
                      <td><StatusBadge status={r.status} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <p className="hint">
                按实际开始时间升序排列，未执行口令列于末尾；执行中口令的“实际止”为按冻结时长推算的预计结束。
                快照于模拟开始时冻结，模拟期间的图编辑与现场续排不会改写本复盘；重置模拟后清空。复盘只读，不写回项目。
              </p>
            </>
          )}
        </div>
      )}
    </section>
  );
}

function StatusBadge({ status }: { status: ReviewStatus }) {
  if (status === 'ontime') return <span className="review-status review-status-ontime">按时</span>;
  if (status === 'delayed') return <span className="review-status review-status-delayed">延迟</span>;
  return <span className="review-status review-status-notrun">未执行</span>;
}

/** 带正负号的偏差展示（秒）；0 显示“±0.0s”。 */
function Deviation({ value }: { value: number }) {
  const rounded = Math.round(value * 10) / 10;
  if (Math.abs(rounded) < 1e-9) return <span className="dev-zero">±0.0s</span>;
  return (
    <span className={rounded > 0 ? 'dev-up' : 'dev-down'}>
      {rounded > 0 ? '+' : '−'}
      {fmt(Math.abs(rounded))}s
    </span>
  );
}

function fmt(v: number): string {
  return (Math.round(v * 10) / 10).toString();
}
