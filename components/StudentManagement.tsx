
'use client';

import { useCallback, useEffect, useState } from 'react';
import { createClient } from '../lib/supabase/client';

type Student = {
  id: string;
  full_name: string | null;
  monthly_fee: number | null;
  status: string;
};

type Teacher = {
  id: string;
  profile_id: string | null;
  active: boolean;
  profile?: { full_name: string | null } | null;
};

type Instrument = { id: string; name: string };

type Assignment = {
  id: string;
  student_id: string;
  teacher_id: string;
  instrument_id: string;
};

export function StudentManagement({ role }: { role: string }) {
  const supabase = createClient();
  const admin = role === 'administrador';

  const [students, setStudents] = useState<Student[]>([]);
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [instruments, setInstruments] = useState<Instrument[]>([]);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [fees, setFees] = useState<Record<string, string>>({});
  const [studentId, setStudentId] = useState('');
  const [teacherId, setTeacherId] = useState('');
  const [instrumentId, setInstrumentId] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  const load = useCallback(async () => {
    if (!admin) {
      setLoading(false);
      return;
    }

    setLoading(true);
    setError('');

    try {
      const [s, t, i, a] = await Promise.all([
        supabase
          .from('students')
          .select('id,full_name,monthly_fee,status')
          .eq('status', 'ativo')
          .order('full_name'),

        supabase
          .from('teachers')
          .select('id,profile_id,active,profile:profiles(full_name)')
          .eq('active', true),

        supabase
          .from('instruments')
          .select('id,name')
          .order('name'),

        supabase
          .from('student_teacher_assignments')
          .select('id,student_id,teacher_id,instrument_id'),
      ]);

      if (s.error) throw s.error;
      if (t.error) throw t.error;
      if (i.error) throw i.error;
      if (a.error) throw a.error;

      const loadedStudents = (s.data || []) as Student[];

      setStudents(loadedStudents);

      setFees(
        Object.fromEntries(
          loadedStudents.map(student => [
            student.id,
            String(student.monthly_fee ?? 40),
          ])
        )
      );

      setTeachers(
        ((t.data || []) as any[]).map(teacher => ({
          ...teacher,
          profile: Array.isArray(teacher.profile)
            ? teacher.profile[0] || null
            : teacher.profile || null,
        }))
      );

      setInstruments((i.data || []) as Instrument[]);
      setAssignments((a.data || []) as Assignment[]);

      setStudentId(current =>
        current || loadedStudents[0]?.id || ''
      );

      setTeacherId(current =>
        current || (t.data || [])[0]?.id || ''
      );

      setInstrumentId(current =>
        current || (i.data || [])[0]?.id || ''
      );
    } catch (e: any) {
      setError(
        e?.message || 'Não foi possível carregar os dados.'
      );
    } finally {
      setLoading(false);
    }
  }, [supabase, admin]);

  useEffect(() => {
    void load();
  }, [load]);

  if (!admin) return null;

  async function saveFee(id: string) {
    const amount = Number((fees[id] || '').replace(',', '.'));

    if (!Number.isFinite(amount) || amount < 0) {
      setError('Introduz uma mensalidade válida, igual ou superior a 0 €.');
      return;
    }

    setSaving(true);
    setError('');
    setMessage('');

    try {
      const { error } = await supabase
        .from('students')
        .update({ monthly_fee: amount })
        .eq('id', id);

      if (error) throw error;

      setMessage(
        'Mensalidade base guardada. Será usada nas novas mensalidades.'
      );

      await load();
    } catch (e: any) {
      setError(e?.message || 'Não foi possível guardar o valor.');
    } finally {
      setSaving(false);
    }
  }

  async function addAssignment(e: React.FormEvent) {
    e.preventDefault();

    if (!studentId || !teacherId || !instrumentId) {
      setError('Escolhe o aluno, o professor e o instrumento.');
      return;
    }

    setSaving(true);
    setError('');
    setMessage('');

    try {
      const { error } = await supabase
        .from('student_teacher_assignments')
        .upsert(
          {
            student_id: studentId,
            teacher_id: teacherId,
            instrument_id: instrumentId,
          },
          {
            onConflict: 'student_id,teacher_id,instrument_id',
            ignoreDuplicates: true,
          }
        );

      if (error) throw error;

      setMessage('Professor atribuído ao aluno para esse instrumento.');
      await load();
    } catch (e: any) {
      setError(e?.message || 'Não foi possível atribuir o professor.');
    } finally {
      setSaving(false);
    }
  }

  async function removeAssignment(id: string) {
    if (
      !window.confirm(
        'Retirar esta atribuição? As aulas já marcadas não serão apagadas.'
      )
    ) return;

    setSaving(true);
    setError('');
    setMessage('');

    try {
      const { error } = await supabase
        .from('student_teacher_assignments')
        .delete()
        .eq('id', id);

      if (error) throw error;

      setMessage('Atribuição removida. As aulas existentes mantêm-se.');
      await load();
    } catch (e: any) {
      setError(e?.message || 'Não foi possível remover a atribuição.');
    } finally {
      setSaving(false);
    }
  }

  const studentName = (id: string) =>
    students.find(x => x.id === id)?.full_name || 'Aluno';

  const teacherName = (id: string) =>
    teachers.find(x => x.id === id)?.profile?.full_name || 'Professor';

  const instrumentName = (id: string) =>
    instruments.find(x => x.id === id)?.name || 'Instrumento';

  return (
    <section className="section">
      <div className="panelHead">
        <div>
          <div className="eyebrow">GESTÃO DE ALUNOS</div>
          <h2 style={{ margin: '6px 0 2px' }}>
            Professores e mensalidades
          </h2>
          <div className="muted">
            Cada aluno pode ter vários professores, por instrumento.
          </div>
        </div>
      </div>

      {error && <div className="error">{error}</div>}
      {message && <div className="notice">{message}</div>}

      {loading ? (
        <div className="emptyCard">A carregar…</div>
      ) : (
        <>
          <div className="card" style={{ marginTop: 16, padding: 18 }}>
            <h3 style={{ marginTop: 0 }}>
              Atribuir professor a um aluno
            </h3>

            <form onSubmit={addAssignment} className="twoFields">
              <div className="field">
                <label>Aluno</label>
                <select
                  className="input"
                  value={studentId}
                  onChange={e => setStudentId(e.target.value)}
                  required
                >
                  <option value="">Selecionar aluno</option>
                  {students.map(s => (
                    <option key={s.id} value={s.id}>
                      {s.full_name || 'Aluno sem nome'}
                    </option>
                  ))}
                </select>
              </div>

              <div className="field">
                <label>Professor</label>
                <select
                  className="input"
                  value={teacherId}
                  onChange={e => setTeacherId(e.target.value)}
                  required
                >
                  <option value="">Selecionar professor</option>
                  {teachers.map(t => (
                    <option key={t.id} value={t.id}>
                      {t.profile?.full_name || 'Professor sem nome'}
                    </option>
                  ))}
                </select>
              </div>

              <div className="field">
                <label>Instrumento</label>
                <select
                  className="input"
                  value={instrumentId}
                  onChange={e => setInstrumentId(e.target.value)}
                  required
                >
                  <option value="">Selecionar instrumento</option>
                  {instruments.map(i => (
                    <option key={i.id} value={i.id}>
                      {i.name}
                    </option>
                  ))}
                </select>
              </div>

              <div style={{ display: 'flex', alignItems: 'end' }}>
                <button
                  className="btn primary"
                  disabled={
                    saving ||
                    !students.length ||
                    !teachers.length ||
                    !instruments.length
                  }
                >
                  Guardar atribuição
                </button>
              </div>
            </form>
          </div>

          <div
            className="card"
            style={{ marginTop: 16, padding: 18, overflowX: 'auto' }}
          >
            <h3 style={{ marginTop: 0 }}>Atribuições atuais</h3>

            {!assignments.length ? (
              <div className="muted">
                Ainda não há atribuições.
              </div>
            ) : (
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr>
                    <th style={{ textAlign: 'left', padding: 10 }}>Aluno</th>
                    <th style={{ textAlign: 'left', padding: 10 }}>Instrumento</th>
                    <th style={{ textAlign: 'left', padding: 10 }}>Professor</th>
                    <th style={{ padding: 10 }}>Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {assignments.map(a => (
                    <tr key={a.id}>
                      <td style={{ padding: 10 }}>
                        {studentName(a.student_id)}
                      </td>
                      <td style={{ padding: 10 }}>
                        {instrumentName(a.instrument_id)}
                      </td>
                      <td style={{ padding: 10 }}>
                        {teacherName(a.teacher_id)}
                      </td>
                      <td style={{ padding: 10 }}>
                        <button
                          type="button"
                          className="btn ghost"
                          disabled={saving}
                          onClick={() => void removeAssignment(a.id)}
                        >
                          Retirar
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          <div
            className="card"
            style={{ marginTop: 16, padding: 18, overflowX: 'auto' }}
          >
            <h3 style={{ marginTop: 0 }}>
              Mensalidade definida por aluno
            </h3>
            <p className="muted">
              Alterar este valor não modifica mensalidades de meses já criados.
            </p>

            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  <th style={{ textAlign: 'left', padding: 10 }}>Aluno</th>
                  <th style={{ textAlign: 'left', padding: 10 }}>Mensalidade (€)</th>
                  <th style={{ padding: 10 }}>Ações</th>
                </tr>
              </thead>
              <tbody>
                {students.map(s => (
                  <tr key={s.id}>
                    <td style={{ padding: 10 }}>
                      {s.full_name || 'Aluno sem nome'}
                    </td>
                    <td style={{ padding: 10 }}>
                      <input
                        className="input"
                        type="number"
                        min="0"
                        step="0.01"
                        value={fees[s.id] ?? String(s.monthly_fee ?? 40)}
                        onChange={e =>
                          setFees(current => ({
                            ...current,
                            [s.id]: e.target.value,
                          }))
                        }
                        style={{ width: 120 }}
                        aria-label={`Mensalidade de ${s.full_name || 'aluno'}`}
                      />
                    </td>
                    <td style={{ padding: 10 }}>
                      <button
                        type="button"
                        className="btn ghost"
                        disabled={saving}
                        onClick={() => void saveFee(s.id)}
                      >
                        Guardar valor
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {!students.length && (
              <div className="muted">Não existem alunos ativos.</div>
            )}
          </div>
        </>
      )}
    </section>
  );
}
