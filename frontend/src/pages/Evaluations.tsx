import { useEffect, useRef, useState } from 'react';
import {
  api, Evaluation, EvaluationDetail, EvaluationResult,
  Prompt, PromptVersion, Dataset, AutoImproveSuggestion, ScoreBreakdown
} from '../api';

const MODELS = ['claude-opus-4-7', 'claude-sonnet-4-6', 'claude-haiku-4-5'];
const JUDGE_MODELS = ['claude-haiku-4-5', 'claude-sonnet-4-6'];

const DIM_LABELS: Record<string, string> = {
  accuracy: 'Genauigkeit',
  helpfulness: 'Hilfsbereitschaft',
  logistics_expertise: 'Logistik-Expertise',
};
const DIM_COLORS: Record<string, string> = {
  accuracy: '#6c63ff',
  helpfulness: '#00d4aa',
  logistics_expertise: '#f59e0b',
};

const STATUS_DE: Record<string, string> = {
  done: 'Fertig', running: 'Läuft', error: 'Fehler', pending: 'Ausstehend'
};

function statusBadge(status: string) {
  const map: Record<string, string> = { done: 'badge-green', running: 'badge-yellow', error: 'badge-red', pending: 'badge-gray' };
  return <span className={`badge ${map[status] || 'badge-gray'}`}>{STATUS_DE[status] || status}</span>;
}

function ScoreChip({ score }: { score: number | null }) {
  if (score === null) return <span style={{ color: 'var(--text2)' }}>—</span>;
  const color = score >= 7 ? 'var(--green)' : score >= 4 ? 'var(--yellow)' : 'var(--red)';
  return <span className="score-chip" style={{ background: color + '22', color }}>{score.toFixed(1)}</span>;
}

function DimBar({ label, score, color }: { label: string; score: number; color: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
      <div style={{ width: 72, fontSize: 11, color: 'var(--text2)' }}>{label}</div>
      <div style={{ flex: 1, height: 8, background: 'var(--surface2)', borderRadius: 4, overflow: 'hidden' }}>
        <div style={{ height: '100%', width: `${(score / 10) * 100}%`, background: color, borderRadius: 4, transition: 'width 0.4s' }} />
      </div>
      <div style={{ width: 28, fontSize: 12, fontWeight: 700, color }}>{score.toFixed(1)}</div>
    </div>
  );
}

function BreakdownMini({ bd }: { bd: ScoreBreakdown }) {
  return (
    <div style={{ marginTop: 10 }}>
      {Object.entries(DIM_LABELS).map(([key, label]) => {
        const dim = bd[key as keyof ScoreBreakdown];
        return dim ? (
          <DimBar key={key} label={label} score={dim.score} color={DIM_COLORS[key]} />
        ) : null;
      })}
    </div>
  );
}

function LiveProgress({ evalId, onDone }: { evalId: number; onDone: () => void }) {
  const [log, setLog] = useState<string[]>([]);
  const [progress, setProgress] = useState(0);
  const [total, setTotal] = useState(0);
  const logRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const es = new EventSource(`/api/evaluations/${evalId}/stream/`);
    es.addEventListener('message', e => {
      const data = JSON.parse(e.data);
      if (data.type === 'start') {
        setTotal(data.total);
        setLog(l => [...l, `▶ Gestartet — ${data.total} Testfälle (3-Agenten-Bewertung)`]);
      } else if (data.type === 'progress') {
        setProgress(data.index);
        setTotal(data.total);
        const bd = data.breakdown;
        const bdStr = bd
          ? ` [A:${bd.accuracy} H:${bd.helpfulness} L:${bd.logistics_expertise}]`
          : '';
        const cached = data.cache_read_tokens > 0 ? ` cache:${data.cache_read_tokens}tk` : '';
        setLog(l => [...l, `[${data.index}/${data.total}] ∑${data.score?.toFixed(1) ?? '—'}${bdStr} ${data.latency_ms}ms${cached}`]);
      } else if (data.type === 'done') {
        const s = data.summary;
        const dims = s.dimension_averages || {};
        const dimStr = Object.entries(dims).map(([k, v]) => `${DIM_LABELS[k] || k}:${(v as number).toFixed(1)}`).join(' ');
        setLog(l => [...l, `✓ Fertig — Ø:${s.avg_score?.toFixed(2) ?? '—'} | ${dimStr} | Fehler:${s.errors}`]);
        es.close();
        onDone();
      } else if (data.type === 'error') {
        setLog(l => [...l, `✗ Fehler: ${data.message}`]);
        es.close();
      } else if (data.type === 'error_item') {
        setLog(l => [...l, `✗ [${data.index}] ${data.message}`]);
      }
    });
    es.onerror = () => es.close();
    return () => es.close();
  }, [evalId]);

  useEffect(() => {
    if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight;
  }, [log]);

  return (
    <div>
      {total > 0 && (
        <div style={{ marginBottom: 8 }}>
          <div className="progress-bar">
            <div className="progress-fill" style={{ width: `${(progress / total) * 100}%` }} />
          </div>
          <div style={{ fontSize: 11, color: 'var(--text2)', marginTop: 4 }}>{progress} / {total}</div>
        </div>
      )}
      <div className="event-log" ref={logRef}>
        {log.map((l, i) => (
          <div key={i} style={{ color: l.startsWith('✓') ? 'var(--green)' : l.startsWith('✗') ? 'var(--red)' : 'var(--text2)' }}>{l}</div>
        ))}
      </div>
    </div>
  );
}

function ResultsTable({ results }: { results: EvaluationResult[] }) {
  const [expanded, setExpanded] = useState<number | null>(null);
  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>
            <th>#</th>
            <th>Score</th>
            <th style={{ color: DIM_COLORS.accuracy }}>Genauigkeit</th>
            <th style={{ color: DIM_COLORS.helpfulness }}>Hilfsbereitschaft</th>
            <th style={{ color: DIM_COLORS.logistics_expertise }}>Logistik</th>
            <th>Latenz</th>
            <th>Cache</th>
            <th>Ausgabe-Vorschau</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {results.map((r, i) => (
            <>
              <tr key={r.id}>
                <td style={{ color: 'var(--text2)', width: 30 }}>{i + 1}</td>
                <td><ScoreChip score={r.score} /></td>
                <td><ScoreChip score={r.score_breakdown?.accuracy?.score ?? null} /></td>
                <td><ScoreChip score={r.score_breakdown?.helpfulness?.score ?? null} /></td>
                <td><ScoreChip score={r.score_breakdown?.logistics_expertise?.score ?? null} /></td>
                <td style={{ color: 'var(--text2)', fontSize: 12 }}>{r.latency_ms ? `${r.latency_ms}ms` : '—'}</td>
                <td>
                  {r.cache_read_tokens > 0
                    ? <span className="badge badge-green" style={{ fontSize: 10 }}>{r.cache_read_tokens}tk</span>
                    : <span style={{ color: 'var(--text2)' }}>—</span>}
                </td>
                <td style={{ maxWidth: 260, color: 'var(--text2)', fontSize: 12 }}>
                  {r.error
                    ? <span style={{ color: 'var(--red)' }}>{r.error.slice(0, 80)}</span>
                    : (r.actual_output || '').slice(0, 80) + (r.actual_output.length > 80 ? '…' : '')}
                </td>
                <td>
                  <button className="btn btn-ghost btn-sm" onClick={() => setExpanded(expanded === r.id ? null : r.id)}>
                    {expanded === r.id ? '▲' : '▼'}
                  </button>
                </td>
              </tr>
              {expanded === r.id && (
                <tr key={`${r.id}-detail`}>
                  <td colSpan={9} style={{ padding: '14px 16px', background: 'rgba(0,0,0,0.2)' }}>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
                      <div>
                        <div className="diff-label">Input</div>
                        <pre style={{ maxHeight: 100, overflow: 'auto' }}>{JSON.stringify(r.test_case_input, null, 2)}</pre>
                      </div>
                      <div>
                        <div className="diff-label">Expected</div>
                        <pre style={{ maxHeight: 100, overflow: 'auto' }}>{r.test_case_expected || '—'}</pre>
                      </div>
                      <div>
                        <div className="diff-label">Actual Output</div>
                        <pre style={{ maxHeight: 160, overflow: 'auto' }}>{r.actual_output}</pre>
                      </div>
                      <div>
                        <div className="diff-label">Agent Reasoning</div>
                        {r.score_breakdown ? (
                          <div style={{ background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 7, padding: 12 }}>
                            {Object.entries(DIM_LABELS).map(([key, label]) => {
                              const dim = r.score_breakdown![key as keyof ScoreBreakdown];
                              return dim ? (
                                <div key={key} style={{ marginBottom: 8 }}>
                                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
                                    <span style={{ fontSize: 11, fontWeight: 700, color: DIM_COLORS[key] }}>{label}</span>
                                    <span style={{ fontSize: 12, color: DIM_COLORS[key] }}>{dim.score.toFixed(1)}</span>
                                  </div>
                                  <div style={{ fontSize: 11, color: 'var(--text2)' }}>{dim.reasoning}</div>
                                </div>
                              ) : null;
                            })}
                          </div>
                        ) : (
                          <pre style={{ maxHeight: 160, overflow: 'auto', color: 'var(--text2)' }}>{r.judge_reasoning || '—'}</pre>
                        )}
                      </div>
                    </div>
                  </td>
                </tr>
              )}
            </>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function AutoImproveModal({
  suggestion, promptId, userTemplate, basedOn, onSave, onClose
}: {
  suggestion: AutoImproveSuggestion;
  promptId: number;
  userTemplate: string;
  basedOn: { total_cases: number; failed_cases: number; avg_score: number };
  onSave: (improved: string) => void;
  onClose: () => void;
}) {
  const [editedPrompt, setEditedPrompt] = useState(suggestion.improved_prompt);
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    await onSave(editedPrompt);
    setSaving(false);
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" style={{ width: 760 }} onClick={e => e.stopPropagation()}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20 }}>
          <span style={{ fontSize: 22 }}>✨</span>
          <div>
            <div className="modal-title" style={{ marginBottom: 0 }}>Auto-Verbesserungs-Agent</div>
            <div style={{ fontSize: 12, color: 'var(--text2)' }}>
              {basedOn.failed_cases} von {basedOn.total_cases} Testfällen analysiert (Ø {basedOn.avg_score?.toFixed(1)})
            </div>
          </div>
        </div>

        {/* Analysis */}
        <div style={{ background: 'rgba(108,99,255,0.08)', border: '1px solid rgba(108,99,255,0.2)', borderRadius: 8, padding: 14, marginBottom: 16 }}>
          <div className="diff-label" style={{ marginBottom: 6 }}>Agenten-Analyse</div>
          <div style={{ fontSize: 13, color: 'var(--text)', lineHeight: 1.5 }}>{suggestion.analysis}</div>
        </div>

        {/* Changes */}
        <div style={{ marginBottom: 16 }}>
          <div className="diff-label" style={{ marginBottom: 8 }}>Vorgeschlagene Änderungen</div>
          <ul style={{ paddingLeft: 20, display: 'flex', flexDirection: 'column', gap: 4 }}>
            {suggestion.changes.map((c, i) => (
              <li key={i} style={{ fontSize: 13, color: 'var(--text2)' }}>
                <span style={{ color: 'var(--accent2)' }}>✓</span> {c}
              </li>
            ))}
          </ul>
        </div>

        {/* Editable prompt */}
        <div className="form-group">
          <label>Verbesserter System-Prompt — bei Bedarf bearbeiten</label>
          <textarea
            value={editedPrompt}
            onChange={e => setEditedPrompt(e.target.value)}
            style={{ minHeight: 200 }}
          />
        </div>

        <div className="modal-actions">
          <button className="btn btn-ghost" onClick={onClose}>Abbrechen</button>
          <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
            {saving ? 'Wird gespeichert…' : '💾 Als neue Version speichern'}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function Evaluations() {
  const [evals, setEvals] = useState<Evaluation[]>([]);
  const [selected, setSelected] = useState<EvaluationDetail | null>(null);
  const [prompts, setPrompts] = useState<Prompt[]>([]);
  const [datasets, setDatasets] = useState<Dataset[]>([]);
  const [showCreate, setShowCreate] = useState(false);
  const [liveId, setLiveId] = useState<number | null>(null);
  const [form, setForm] = useState({
    name: '', prompt_version: '', dataset: '', model: 'claude-opus-4-7', judge_model: 'claude-haiku-4-5'
  });
  const [allVersions, setAllVersions] = useState<(PromptVersion & { prompt_name: string })[]>([]);
  const [saving, setSaving] = useState(false);
  const [improving, setImproving] = useState(false);
  const [improveData, setImproveData] = useState<{
    suggestion: AutoImproveSuggestion;
    promptId: number;
    userTemplate: string;
    basedOn: { total_cases: number; failed_cases: number; avg_score: number };
  } | null>(null);
  const [improveMsg, setImproveMsg] = useState('');

  const loadEvals = () => api.evaluations.list().then(setEvals);

  useEffect(() => {
    loadEvals();
    api.prompts.list().then(async ps => {
      setPrompts(ps);
      const versions: (PromptVersion & { prompt_name: string })[] = [];
      for (const p of ps) {
        const detail = await api.prompts.get(p.id);
        detail.versions.forEach(v => versions.push({ ...v, prompt_name: p.name }));
      }
      setAllVersions(versions);
    });
    api.datasets.list().then(setDatasets);
  }, []);

  const selectEval = async (ev: Evaluation) => {
    const detail = await api.evaluations.get(ev.id);
    setSelected(detail);
    setImproveMsg('');
    if (ev.status === 'running') setLiveId(ev.id);
  };

  const createEval = async () => {
    if (!form.name || !form.prompt_version || !form.dataset) return;
    setSaving(true);
    const ev = await api.evaluations.create({
      name: form.name,
      prompt_version: +form.prompt_version,
      dataset: +form.dataset,
      model: form.model,
      judge_model: form.judge_model,
    });
    setSaving(false);
    setShowCreate(false);
    setForm({ name: '', prompt_version: '', dataset: '', model: 'claude-opus-4-7', judge_model: 'claude-haiku-4-5' });
    await loadEvals();
    selectEval(ev);
    setLiveId(ev.id);
  };

  const handleDone = async () => {
    setLiveId(null);
    if (selected) {
      const detail = await api.evaluations.get(selected.id);
      setSelected(detail);
    }
    loadEvals();
  };

  const handleAutoImprove = async () => {
    if (!selected) return;
    setImproving(true);
    setImproveMsg('');
    try {
      const res = await api.evaluations.autoImprove(selected.id);
      if (!res.suggestion) {
        setImproveMsg(res.message || 'No improvements needed.');
      } else {
        setImproveData({
          suggestion: res.suggestion,
          promptId: res.prompt_id!,
          userTemplate: res.user_template!,
          basedOn: res.based_on!,
        });
      }
    } catch (e: any) {
      setImproveMsg(`Error: ${e.message}`);
    }
    setImproving(false);
  };

  const saveImprovedVersion = async (improvedPrompt: string) => {
    if (!improveData) return;
    await api.prompts.addVersion(improveData.promptId, {
      system_prompt: improvedPrompt,
      user_template: improveData.userTemplate,
      notes: `Auto-improved by agent — based on eval "${selected?.name}"`,
    });
    setImproveData(null);
    setImproveMsg('✓ New version saved! Run a new evaluation to compare.');
    // Refresh prompt versions list
    const ps = await api.prompts.list();
    const versions: (PromptVersion & { prompt_name: string })[] = [];
    for (const p of ps) {
      const detail = await api.prompts.get(p.id);
      detail.versions.forEach(v => versions.push({ ...v, prompt_name: p.name }));
    }
    setAllVersions(versions);
  };

  return (
    <div>
      <div className="page-header">
        <div className="page-title">Evaluierungen</div>
        <div className="page-sub">3-Agenten-Bewertung: Genauigkeit · Hilfsbereitschaft · Logistik-Expertise</div>
      </div>

      <div className="toolbar">
        <div className="spacer" />
        <button className="btn btn-primary" onClick={() => setShowCreate(true)}>+ Neue Evaluierung</button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '300px 1fr', gap: 20 }}>
        {/* List */}
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          {evals.length === 0 ? (
            <div className="empty-state"><div className="icon">🧪</div><div>Noch keine Evaluierungen</div></div>
          ) : evals.map(ev => (
            <div
              key={ev.id}
              onClick={() => selectEval(ev)}
              style={{
                padding: '12px 16px', cursor: 'pointer', borderBottom: '1px solid var(--border)',
                background: selected?.id === ev.id ? 'rgba(108,99,255,0.08)' : 'transparent',
                borderLeft: selected?.id === ev.id ? '3px solid var(--accent)' : '3px solid transparent',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                <span style={{ fontWeight: 600, flex: 1, fontSize: 13 }}>{ev.name}</span>
                {statusBadge(ev.status)}
              </div>
              <div style={{ fontSize: 11, color: 'var(--text2)' }}>{ev.prompt_version_label} · {ev.dataset_name}</div>
              {ev.avg_score !== null && (
                <div style={{ fontSize: 11, color: 'var(--green)', marginTop: 2 }}>avg {ev.avg_score.toFixed(1)}</div>
              )}
            </div>
          ))}
        </div>

        {/* Detail */}
        {selected ? (
          <div>
            {/* Header card */}
            <div className="card" style={{ marginBottom: 16 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 700, fontSize: 17 }}>{selected.name}</div>
                  <div style={{ color: 'var(--text2)', fontSize: 12, marginTop: 2 }}>
                    {selected.prompt_version_label} · {selected.dataset_name} · {selected.model}
                  </div>
                </div>
                {statusBadge(selected.status)}
                {selected.status === 'done' && (
                  <button
                    className="btn btn-primary"
                    onClick={handleAutoImprove}
                    disabled={improving}
                    style={{ gap: 6 }}
                  >
                    {improving ? <><span className="spinner" /> Analysiere…</> : '✨ Auto-Verbessern'}
                  </button>
                )}
              </div>

              {improveMsg && (
                <div style={{
                  padding: '10px 14px', borderRadius: 7, marginBottom: 12,
                  background: improveMsg.startsWith('✓') ? 'rgba(34,197,94,0.1)' : 'rgba(108,99,255,0.08)',
                  border: `1px solid ${improveMsg.startsWith('✓') ? 'rgba(34,197,94,0.3)' : 'rgba(108,99,255,0.2)'}`,
                  fontSize: 13, color: improveMsg.startsWith('✓') ? 'var(--green)' : 'var(--text)',
                }}>
                  {improveMsg}
                </div>
              )}

              {liveId === selected.id && selected.status === 'running' && (
                <div style={{ marginBottom: 16 }}>
                  <div className="diff-label" style={{ marginBottom: 8 }}>Live-Fortschritt</div>
                  <LiveProgress evalId={selected.id} onDone={handleDone} />
                </div>
              )}

              {selected.summary && (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 16 }}>
                  {/* Stats */}
                  <div>
                    <div className="diff-label" style={{ marginBottom: 10 }}>Zusammenfassung</div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                      {[
                        { label: 'Ø Score', value: selected.summary.avg_score?.toFixed(2) ?? '—' },
                        { label: 'Min', value: selected.summary.min_score?.toFixed(1) ?? '—' },
                        { label: 'Gesamt', value: selected.summary.total_cases },
                        { label: 'Fehler', value: selected.summary.errors },
                      ].map(s => (
                        <div key={s.label} className="stat-card" style={{ padding: '10px 12px' }}>
                          <div className="stat-label" style={{ fontSize: 10 }}>{s.label}</div>
                          <div className="stat-value" style={{ fontSize: 18 }}>{s.value}</div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Dimension averages */}
                  <div>
                    <div className="diff-label" style={{ marginBottom: 10 }}>Dimensionen-Durchschnitt</div>
                    <div style={{ paddingTop: 4 }}>
                      {Object.entries(DIM_LABELS).map(([key, label]) => {
                        const avg = selected.summary?.dimension_averages?.[key];
                        return avg !== undefined ? (
                          <DimBar key={key} label={label} score={avg} color={DIM_COLORS[key]} />
                        ) : null;
                      })}
                    </div>
                  </div>

                  {/* Score distribution */}
                  <div>
                    <div className="diff-label" style={{ marginBottom: 10 }}>Score-Verteilung</div>
                    {Object.entries(selected.summary.score_distribution).map(([range, count]) => {
                      const max = Math.max(...Object.values(selected.summary!.score_distribution));
                      return (
                        <div key={range} className="dist-bar">
                          <div className="dist-label">{range}</div>
                          <div className="dist-fill" style={{ width: max > 0 ? `${(count / max) * 140}px` : '4px' }} />
                          <div className="dist-count">{count}</div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>

            {/* Results table */}
            {selected.results.length > 0 && (
              <div className="card" style={{ padding: 0 }}>
                <div style={{ padding: '14px 20px', borderBottom: '1px solid var(--border)', fontWeight: 600, fontSize: 14 }}>
                  Ergebnisse ({selected.results.length}) — ▼ für Details und Agenten-Begründung
                </div>
                <ResultsTable results={selected.results} />
              </div>
            )}
          </div>
        ) : (
          <div className="card empty-state"><div className="icon">👈</div><div>Evaluierung auswählen</div></div>
        )}
      </div>

      {/* Create Modal */}
      {showCreate && (
        <div className="modal-overlay" onClick={() => setShowCreate(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-title">Neue Evaluierung</div>
            <div className="form-group">
              <label>Name</label>
              <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="z.B. v2 vs Basis" />
            </div>
            <div className="form-group">
              <label>Prompt-Version</label>
              <select value={form.prompt_version} onChange={e => setForm(f => ({ ...f, prompt_version: e.target.value }))}>
                <option value="">— Prompt-Version auswählen —</option>
                {allVersions.map(v => (
                  <option key={v.id} value={v.id}>{v.prompt_name} v{v.version_number}</option>
                ))}
              </select>
            </div>
            <div className="form-group">
              <label>Datensatz</label>
              <select value={form.dataset} onChange={e => setForm(f => ({ ...f, dataset: e.target.value }))}>
                <option value="">— Datensatz auswählen —</option>
                {datasets.map(d => <option key={d.id} value={d.id}>{d.name} ({d.test_case_count} cases)</option>)}
              </select>
            </div>
            <div className="grid2">
              <div className="form-group">
                <label>Model</label>
                <select value={form.model} onChange={e => setForm(f => ({ ...f, model: e.target.value }))}>
                  {MODELS.map(m => <option key={m} value={m}>{m}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label>Bewertungs-Modell</label>
                <select value={form.judge_model} onChange={e => setForm(f => ({ ...f, judge_model: e.target.value }))}>
                  {JUDGE_MODELS.map(m => <option key={m} value={m}>{m}</option>)}
                </select>
              </div>
            </div>
            <div className="modal-actions">
              <button className="btn btn-ghost" onClick={() => setShowCreate(false)}>Abbrechen</button>
              <button className="btn btn-primary" onClick={createEval} disabled={!form.name || !form.prompt_version || !form.dataset || saving}>
                {saving ? 'Wird gestartet…' : 'Evaluierung starten'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Auto-Improve Modal */}
      {improveData && (
        <AutoImproveModal
          suggestion={improveData.suggestion}
          promptId={improveData.promptId}
          userTemplate={improveData.userTemplate}
          basedOn={improveData.basedOn}
          onSave={saveImprovedVersion}
          onClose={() => setImproveData(null)}
        />
      )}
    </div>
  );
}
