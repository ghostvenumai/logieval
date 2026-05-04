import { useEffect, useState } from 'react';
import { api, Dataset, DatasetDetail, TestCase } from '../api';

type Modal = 'create' | 'add_case' | null;

export default function Datasets() {
  const [datasets, setDatasets] = useState<Dataset[]>([]);
  const [selected, setSelected] = useState<DatasetDetail | null>(null);
  const [modal, setModal] = useState<Modal>(null);
  const [form, setForm] = useState({ name: '', description: '' });
  const [caseForm, setCaseForm] = useState({ input_raw: '{}', expected_output: '', tags: '' });
  const [saving, setSaving] = useState(false);
  const [caseError, setCaseError] = useState('');

  const load = () => api.datasets.list().then(setDatasets);
  useEffect(() => { load(); }, []);

  const selectDataset = (d: Dataset) =>
    api.datasets.get(d.id).then(setSelected);

  const createDataset = async () => {
    setSaving(true);
    await api.datasets.create(form).catch(() => {});
    setSaving(false);
    setModal(null);
    setForm({ name: '', description: '' });
    load();
  };

  const addTestCase = async () => {
    if (!selected) return;
    setCaseError('');
    let input_variables: Record<string, string>;
    try {
      input_variables = JSON.parse(caseForm.input_raw);
    } catch {
      setCaseError('Eingabe muss gültiges JSON sein, z.B. {"frage": "Wo ist mein Paket?"}');
      return;
    }
    setSaving(true);
    await api.datasets.addTestCase(selected.id, {
      input_variables,
      expected_output: caseForm.expected_output,
      tags: caseForm.tags,
    }).catch(() => {});
    const detail = await api.datasets.get(selected.id);
    setSelected(detail);
    setSaving(false);
    setModal(null);
    setCaseForm({ input_raw: '{}', expected_output: '', tags: '' });
    load();
  };

  const deleteTestCase = async (tc: TestCase) => {
    if (!selected || !confirm('Diesen Testfall löschen?')) return;
    await api.datasets.deleteTestCase(tc.id);
    const detail = await api.datasets.get(selected.id);
    setSelected(detail);
    load();
  };

  const deleteDataset = async (id: number) => {
    if (!confirm('Diesen Datensatz und alle Testfälle löschen?')) return;
    await api.datasets.delete(id);
    setSelected(null);
    load();
  };

  return (
    <div>
      <div className="page-header">
        <div className="page-title">Datensätze</div>
        <div className="page-sub">Testfälle für LLM-Evaluierungsläufe</div>
      </div>

      <div className="toolbar">
        <div className="spacer" />
        <button className="btn btn-primary" onClick={() => setModal('create')}>+ Neuer Datensatz</button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '280px 1fr', gap: 20 }}>
        {/* Liste */}
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          {datasets.length === 0 ? (
            <div className="empty-state"><div className="icon">🗂️</div><div>Noch keine Datensätze</div></div>
          ) : datasets.map(d => (
            <div
              key={d.id}
              onClick={() => selectDataset(d)}
              style={{
                padding: '14px 16px', cursor: 'pointer', borderBottom: '1px solid var(--border)',
                background: selected?.id === d.id ? 'rgba(108,99,255,0.08)' : 'transparent',
                borderLeft: selected?.id === d.id ? '3px solid var(--accent)' : '3px solid transparent',
              }}
            >
              <div style={{ fontWeight: 600 }}>{d.name}</div>
              <div style={{ fontSize: 11, color: 'var(--text2)', marginTop: 2 }}>{d.test_case_count} Testfälle</div>
            </div>
          ))}
        </div>

        {/* Detail */}
        {selected ? (
          <div>
            <div className="card" style={{ marginBottom: 16 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 700, fontSize: 17 }}>{selected.name}</div>
                  {selected.description && <div style={{ color: 'var(--text2)', fontSize: 12, marginTop: 2 }}>{selected.description}</div>}
                </div>
                <button className="btn btn-primary btn-sm" onClick={() => setModal('add_case')}>+ Testfall hinzufügen</button>
                <button className="btn btn-danger btn-sm" onClick={() => deleteDataset(selected.id)}>Datensatz löschen</button>
              </div>
            </div>

            {selected.test_cases.length === 0 ? (
              <div className="card empty-state"><div className="icon">📋</div><div>Noch keine Testfälle</div></div>
            ) : (
              <div className="card" style={{ padding: 0 }}>
                <table>
                  <thead>
                    <tr>
                      <th>#</th>
                      <th>Eingabe-Variablen</th>
                      <th>Erwartete Ausgabe</th>
                      <th>Tags</th>
                      <th></th>
                    </tr>
                  </thead>
                  <tbody>
                    {selected.test_cases.map((tc, i) => (
                      <tr key={tc.id}>
                        <td style={{ color: 'var(--text2)', width: 40 }}>{i + 1}</td>
                        <td>
                          <pre style={{ background: 'none', border: 'none', padding: 0, fontSize: 11, maxWidth: 280, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'pre-wrap' }}>
                            {JSON.stringify(tc.input_variables, null, 2)}
                          </pre>
                        </td>
                        <td style={{ maxWidth: 300, color: 'var(--text2)', fontSize: 12 }}>
                          {tc.expected_output ? tc.expected_output.slice(0, 100) + (tc.expected_output.length > 100 ? '…' : '') : <em>—</em>}
                        </td>
                        <td>
                          {tc.tags ? tc.tags.split(',').map(t => (
                            <span key={t} className="badge badge-gray" style={{ marginRight: 3 }}>{t.trim()}</span>
                          )) : null}
                        </td>
                        <td>
                          <button className="btn btn-danger btn-sm" onClick={() => deleteTestCase(tc)}>✕</button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        ) : (
          <div className="card empty-state"><div className="icon">👈</div><div>Datensatz auswählen</div></div>
        )}
      </div>

      {/* Datensatz erstellen */}
      {modal === 'create' && (
        <div className="modal-overlay" onClick={() => setModal(null)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-title">Neuer Datensatz</div>
            <div className="form-group">
              <label>Name</label>
              <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="z.B. Logistik-Testfragen" />
            </div>
            <div className="form-group">
              <label>Beschreibung</label>
              <textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} style={{ minHeight: 60 }} />
            </div>
            <div className="modal-actions">
              <button className="btn btn-ghost" onClick={() => setModal(null)}>Abbrechen</button>
              <button className="btn btn-primary" onClick={createDataset} disabled={!form.name || saving}>
                {saving ? 'Wird erstellt…' : 'Erstellen'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Testfall hinzufügen */}
      {modal === 'add_case' && (
        <div className="modal-overlay" onClick={() => setModal(null)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-title">Testfall hinzufügen</div>
            <div className="form-group">
              <label>Eingabe-Variablen (JSON)</label>
              <textarea
                value={caseForm.input_raw}
                onChange={e => setCaseForm(f => ({ ...f, input_raw: e.target.value }))}
                placeholder={'{"frage": "Wo ist mein Paket?"}'}
                style={{ minHeight: 100 }}
              />
              {caseError && <div style={{ color: 'var(--red)', fontSize: 12, marginTop: 4 }}>{caseError}</div>}
            </div>
            <div className="form-group">
              <label>Erwartete Ausgabe</label>
              <textarea
                value={caseForm.expected_output}
                onChange={e => setCaseForm(f => ({ ...f, expected_output: e.target.value }))}
                placeholder="Was sollte das Modell idealerweise antworten?"
                style={{ minHeight: 80 }}
              />
            </div>
            <div className="form-group">
              <label>Tags (kommagetrennt)</label>
              <input value={caseForm.tags} onChange={e => setCaseForm(f => ({ ...f, tags: e.target.value }))} placeholder="grenzfall, regression" />
            </div>
            <div className="modal-actions">
              <button className="btn btn-ghost" onClick={() => setModal(null)}>Abbrechen</button>
              <button className="btn btn-primary" onClick={addTestCase} disabled={saving}>
                {saving ? 'Wird gespeichert…' : 'Hinzufügen'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
