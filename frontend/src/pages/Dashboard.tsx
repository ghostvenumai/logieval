import { useEffect, useState } from 'react';
import { api, Stats } from '../api';

const STATUS_LABELS: Record<string, string> = {
  done: 'Fertig', running: 'Läuft', error: 'Fehler', pending: 'Ausstehend'
};

function statusBadge(status: string) {
  const map: Record<string, string> = { done: 'badge-green', running: 'badge-yellow', error: 'badge-red', pending: 'badge-gray' };
  return <span className={`badge ${map[status] || 'badge-gray'}`}>{STATUS_LABELS[status] || status}</span>;
}

function scoreColor(s: number | null) {
  if (s === null) return '#8892a4';
  if (s >= 7) return '#22c55e';
  if (s >= 4) return '#f59e0b';
  return '#ef4444';
}

export default function Dashboard() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.evaluations.stats()
      .then(setStats)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div style={{ color: 'var(--text2)', padding: 40 }}>Wird geladen…</div>;

  return (
    <div>
      <div className="page-header">
        <div className="page-title">Dashboard</div>
        <div className="page-sub">LLM-Qualität auf einen Blick</div>
      </div>

      <div className="stat-grid">
        <div className="stat-card">
          <div className="stat-label">Prompts</div>
          <div className="stat-value">{stats?.total_prompts ?? 0}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Datensätze</div>
          <div className="stat-value">{stats?.total_datasets ?? 0}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Evaluierungen</div>
          <div className="stat-value">{stats?.total_evaluations ?? 0}</div>
          <div className="stat-sub">{stats?.evaluations_running ?? 0} laufen gerade</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Abgeschlossen</div>
          <div className="stat-value">{stats?.evaluations_done ?? 0}</div>
        </div>
      </div>

      <div className="card">
        <div className="section-title">Letzte Evaluierungen</div>
        {!stats?.recent_evaluations.length ? (
          <div className="empty-state">
            <div className="icon">🧪</div>
            <div>Noch keine Evaluierungen. Erst einen Prompt anlegen, dann einen Datensatz, dann evaluieren.</div>
          </div>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Prompt-Version</th>
                  <th>Datensatz</th>
                  <th>Status</th>
                  <th>Score</th>
                  <th>Fortschritt</th>
                  <th>Erstellt</th>
                </tr>
              </thead>
              <tbody>
                {stats.recent_evaluations.map(ev => (
                  <tr key={ev.id}>
                    <td style={{ fontWeight: 500 }}>{ev.name}</td>
                    <td className="mono">{ev.prompt_version_label}</td>
                    <td>{ev.dataset_name}</td>
                    <td>{statusBadge(ev.status)}</td>
                    <td>
                      {ev.avg_score !== null
                        ? <span style={{ color: scoreColor(ev.avg_score), fontWeight: 700 }}>{ev.avg_score.toFixed(1)}</span>
                        : <span style={{ color: 'var(--text2)' }}>—</span>}
                    </td>
                    <td>
                      {ev.total > 0 && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <div className="progress-bar" style={{ width: 80 }}>
                            <div className="progress-fill" style={{ width: `${(ev.progress / ev.total) * 100}%` }} />
                          </div>
                          <span style={{ color: 'var(--text2)', fontSize: 11 }}>{ev.progress}/{ev.total}</span>
                        </div>
                      )}
                    </td>
                    <td style={{ color: 'var(--text2)' }}>{new Date(ev.created_at).toLocaleDateString('de-DE')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
