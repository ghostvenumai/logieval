import { useEffect, useState } from 'react';
import { api, Prompt, PromptDetail, PromptVersion } from '../api';

type Modal = 'create_prompt' | 'add_version' | 'diff' | null;

function DiffView({ v1, v2 }: { v1: PromptVersion; v2: PromptVersion }) {
  return (
    <div>
      <div className="diff-grid" style={{ marginBottom: 16 }}>
        <div>
          <div className="diff-label">v{v1.version_number} — System-Prompt</div>
          <pre>{v1.system_prompt}</pre>
        </div>
        <div>
          <div className="diff-label">v{v2.version_number} — System-Prompt</div>
          <pre>{v2.system_prompt}</pre>
        </div>
      </div>
      <div className="diff-grid">
        <div>
          <div className="diff-label">v{v1.version_number} — Benutzer-Vorlage</div>
          <pre>{v1.user_template}</pre>
        </div>
        <div>
          <div className="diff-label">v{v2.version_number} — Benutzer-Vorlage</div>
          <pre>{v2.user_template}</pre>
        </div>
      </div>
    </div>
  );
}

export default function Prompts() {
  const [prompts, setPrompts] = useState<Prompt[]>([]);
  const [selected, setSelected] = useState<PromptDetail | null>(null);
  const [modal, setModal] = useState<Modal>(null);
  const [diffVersions, setDiffVersions] = useState<{ v1: PromptVersion; v2: PromptVersion } | null>(null);
  const [form, setForm] = useState({ name: '', description: '' });
  const [versionForm, setVersionForm] = useState({ system_prompt: '', user_template: '', notes: '' });
  const [diffV1, setDiffV1] = useState('');
  const [diffV2, setDiffV2] = useState('');
  const [saving, setSaving] = useState(false);

  const load = () => api.prompts.list().then(setPrompts);
  useEffect(() => { load(); }, []);

  const selectPrompt = async (p: Prompt) => {
    const detail = await api.prompts.get(p.id);
    setSelected(detail);
  };

  const createPrompt = async () => {
    setSaving(true);
    await api.prompts.create(form).then(load).catch(() => {});
    setSaving(false);
    setModal(null);
    setForm({ name: '', description: '' });
  };

  const addVersion = async () => {
    if (!selected) return;
    setSaving(true);
    await api.prompts.addVersion(selected.id, versionForm).catch(() => {});
    const detail = await api.prompts.get(selected.id);
    setSelected(detail);
    setSaving(false);
    setModal(null);
    setVersionForm({ system_prompt: '', user_template: '', notes: '' });
    load();
  };

  const showDiff = async () => {
    if (!selected || !diffV1 || !diffV2 || diffV1 === diffV2) return;
    const data = await api.prompts.diff(selected.id, +diffV1, +diffV2);
    setDiffVersions(data);
    setModal('diff');
  };

  const deletePrompt = async (id: number) => {
    if (!confirm('Diesen Prompt und alle Versionen löschen?')) return;
    await api.prompts.delete(id);
    setSelected(null);
    load();
  };

  return (
    <div>
      <div className="page-header">
        <div className="page-title">Prompts</div>
        <div className="page-sub">System-Prompts verwalten mit vollständiger Versionshistorie</div>
      </div>

      <div className="toolbar">
        <div className="spacer" />
        <button className="btn btn-primary" onClick={() => setModal('create_prompt')}>+ Neuer Prompt</button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '280px 1fr', gap: 20 }}>
        {/* Liste */}
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          {prompts.length === 0 ? (
            <div className="empty-state"><div className="icon">📝</div><div>Noch keine Prompts</div></div>
          ) : (
            prompts.map(p => (
              <div
                key={p.id}
                onClick={() => selectPrompt(p)}
                style={{
                  padding: '14px 16px', cursor: 'pointer', borderBottom: '1px solid var(--border)',
                  background: selected?.id === p.id ? 'rgba(108,99,255,0.08)' : 'transparent',
                  borderLeft: selected?.id === p.id ? '3px solid var(--accent)' : '3px solid transparent',
                }}
              >
                <div style={{ fontWeight: 600 }}>{p.name}</div>
                <div style={{ fontSize: 11, color: 'var(--text2)', marginTop: 2 }}>
                  {p.version_count} Version{p.version_count !== 1 ? 'en' : ''}
                </div>
              </div>
            ))
          )}
        </div>

        {/* Detail */}
        {selected ? (
          <div>
            <div className="card" style={{ marginBottom: 16 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 700, fontSize: 17 }}>{selected.name}</div>
                  {selected.description && <div style={{ color: 'var(--text2)', fontSize: 12, marginTop: 2 }}>{selected.description}</div>}
                </div>
                <button className="btn btn-primary btn-sm" onClick={() => setModal('add_version')}>+ Version hinzufügen</button>
                <button className="btn btn-danger btn-sm" onClick={() => deletePrompt(selected.id)}>Löschen</button>
              </div>

              {/* Vergleich */}
              {selected.versions.length >= 2 && (
                <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 16 }}>
                  <span style={{ fontSize: 12, color: 'var(--text2)' }}>Vergleichen:</span>
                  <select style={{ width: 80 }} value={diffV1} onChange={e => setDiffV1(e.target.value)}>
                    <option value="">v1</option>
                    {selected.versions.map(v => <option key={v.id} value={v.version_number}>v{v.version_number}</option>)}
                  </select>
                  <span style={{ color: 'var(--text2)' }}>↔</span>
                  <select style={{ width: 80 }} value={diffV2} onChange={e => setDiffV2(e.target.value)}>
                    <option value="">v2</option>
                    {selected.versions.map(v => <option key={v.id} value={v.version_number}>v{v.version_number}</option>)}
                  </select>
                  <button className="btn btn-ghost btn-sm" onClick={showDiff}>Vergleich anzeigen</button>
                </div>
              )}
            </div>

            {/* Versionen */}
            {selected.versions.map(v => (
              <div className="card" key={v.id} style={{ marginBottom: 12 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
                  <span className="badge badge-blue">v{v.version_number}</span>
                  {v.notes && <span style={{ color: 'var(--text2)', fontSize: 12 }}>{v.notes}</span>}
                  <span style={{ marginLeft: 'auto', color: 'var(--text2)', fontSize: 11 }}>
                    {new Date(v.created_at).toLocaleDateString('de-DE')}
                  </span>
                </div>
                <div style={{ marginBottom: 10 }}>
                  <div className="diff-label">System-Prompt</div>
                  <pre style={{ maxHeight: 120, overflow: 'auto' }}>{v.system_prompt}</pre>
                </div>
                <div>
                  <div className="diff-label">Benutzer-Vorlage</div>
                  <pre style={{ maxHeight: 120, overflow: 'auto' }}>{v.user_template}</pre>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="card empty-state"><div className="icon">👈</div><div>Prompt auswählen</div></div>
        )}
      </div>

      {/* Prompt erstellen */}
      {modal === 'create_prompt' && (
        <div className="modal-overlay" onClick={() => setModal(null)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-title">Neuer Prompt</div>
            <div className="form-group">
              <label>Name</label>
              <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="z.B. Kundenservice-Bot" />
            </div>
            <div className="form-group">
              <label>Beschreibung</label>
              <textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} placeholder="Wofür ist dieser Prompt?" style={{ minHeight: 60 }} />
            </div>
            <div className="modal-actions">
              <button className="btn btn-ghost" onClick={() => setModal(null)}>Abbrechen</button>
              <button className="btn btn-primary" onClick={createPrompt} disabled={!form.name || saving}>
                {saving ? 'Wird erstellt…' : 'Erstellen'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Version hinzufügen */}
      {modal === 'add_version' && selected && (
        <div className="modal-overlay" onClick={() => setModal(null)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-title">Version hinzufügen — {selected.name}</div>
            <div className="form-group">
              <label>System-Prompt</label>
              <textarea value={versionForm.system_prompt} onChange={e => setVersionForm(f => ({ ...f, system_prompt: e.target.value }))} placeholder="Du bist ein hilfreicher Assistent…" style={{ minHeight: 120 }} />
            </div>
            <div className="form-group">
              <label>Benutzer-Vorlage</label>
              <textarea value={versionForm.user_template} onChange={e => setVersionForm(f => ({ ...f, user_template: e.target.value }))} placeholder="{{variable}} für dynamische Teile. z.B. Frage: {{frage}}" style={{ minHeight: 80 }} />
            </div>
            <div className="form-group">
              <label>Notizen</label>
              <input value={versionForm.notes} onChange={e => setVersionForm(f => ({ ...f, notes: e.target.value }))} placeholder="Was hat sich geändert?" />
            </div>
            <div className="modal-actions">
              <button className="btn btn-ghost" onClick={() => setModal(null)}>Abbrechen</button>
              <button className="btn btn-primary" onClick={addVersion} disabled={!versionForm.system_prompt || saving}>
                {saving ? 'Wird gespeichert…' : 'Version speichern'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Diff-Ansicht */}
      {modal === 'diff' && diffVersions && (
        <div className="modal-overlay" onClick={() => setModal(null)}>
          <div className="modal" style={{ width: 900 }} onClick={e => e.stopPropagation()}>
            <div className="modal-title">
              Versionsvergleich — v{diffVersions.v1.version_number} ↔ v{diffVersions.v2.version_number}
            </div>
            <DiffView v1={diffVersions.v1} v2={diffVersions.v2} />
            <div className="modal-actions">
              <button className="btn btn-ghost" onClick={() => setModal(null)}>Schließen</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
