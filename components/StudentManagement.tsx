
'use client';

import { useEffect, useMemo, useState } from 'react';
import { createClient } from '../lib/supabase/client';

type Student = {
  id: string;
  full_name: string | null;
  email: string | null;
  phone: string | null;
  guardian_name: string | null;
  guardian_phone: string | null;
  guardian_email: string | null;
  important_notes: string | null;
  status: string;
  monthly_fee: number;
};

type Instrument = {
  id: string;
  name: string;
};

type Teacher = {
  id: string;
  specialty: string | null;
  active: boolean;
  profile: { full_name: string | null } | null;
};

type Assignment = {
  instrument_id: string;
  teacher_id: string;
};

const EMPTY_FORM = {
  full_name: '',
  email: '',
  phone: '',
  guardian_name: '',
  guardian_phone: '',
  guardian_email: '',
  important_notes: '',
  status: 'ativo',
  monthly_fee: '40',
};

export function StudentManagement({
  role,
}: {
  role: string;
}) {
  const supabase = createClient();
  const admin = role === 'administrador';

  const [students, setStudents] = useState<Student[]>([]);
  const [instruments, setInstruments] = useState<Instrument[]>([]);
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [assignments, setAssignments] = useState<
    Record<string, Assignment[]>
  >({});

  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const [editing, setEditing] = useState<Student | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [selectedInstruments, setSelectedInstruments] =
    useState<string[]>([]);
  const [teacherByInstrument, setTeacherByInstrument] =
    useState<Record<string, string>>({});

  async function load() {
    setLoading(true);
    setError('');

    const [studentResult, instrumentResult, teacherResult, assignmentResult] =
      await Promise.all([
        supabase
          .from('students')
          .select(
            'id,full_name,email,phone,guardian_name,guardian_phone,guardian_email,important_notes,status,monthly_fee'
          )
          .order('full_name'),

        supabase
          .from('instruments')
          .select('id,name')
          .order('name'),

        supabase
          .from('teachers')
          .select(
            'id,specialty,active,profile:profiles(full_name)'
          )
          .eq('active', true),

        supabase
          .from('student_teacher_instruments')
          .select('student_id,instrument_id,teacher_id'),
      ]);

    const failed = [
      studentResult.error,
      instrumentResult.error,
      teacherResult.error,
      assignmentResult.error,
    ].find(Boolean);

    if (failed) {
      setError(failed.message);
      setLoading(false);
      return;
    }

    setStudents((studentResult.data || []) as Student[]);
    setInstruments((instrumentResult.data || []) as Instrument[]);

    setTeachers(
      (teacherResult.data || []).map((row: any) => ({
        ...row,
        profile: Array.isArray(row.profile)
          ? row.profile[0] ?? null
          : row.profile,
      })) as Teacher[]
    );

    const grouped: Record<string, Assignment[]> = {};

    for (const row of assignmentResult.data || []) {
      if (!grouped[row.student_id]) {
        grouped[row.student_id] = [];
      }

      grouped[row.student_id].push({
        instrument_id: row.instrument_id,
        teacher_id: row.teacher_id,
      });
    }

    setAssignments(grouped);
    setLoading(false);
  }

  useEffect(() => {
    void load();
  }, []);

  const visibleStudents = useMemo(() => {
    const q = search.trim().toLocaleLowerCase('pt-PT');

    if (!q) return students;

    return students.filter((student) =>
      [
        student.full_name,
        student.email,
        student.phone,
        student.guardian_name,
      ]
        .some((value) =>
          (value || '').toLocaleLowerCase('pt-PT').includes(q)
        )
    );
  }, [students, search]);

  function openNew() {
    setEditing(null);
    setForm(EMPTY_FORM);
    setSelectedInstruments([]);
    setTeacherByInstrument({});
    setError('');
    setSuccess('');
  }

  function openEdit(student: Student) {
    setEditing(student);

    setForm({
      full_name: student.full_name || '',
      email: student.email || '',
      phone: student.phone || '',
      guardian_name: student.guardian_name || '',
      guardian_phone: student.guardian_phone || '',
      guardian_email: student.guardian_email || '',
      important_notes: student.important_notes || '',
      status: student.status || 'ativo',
      monthly_fee: String(student.monthly_fee ?? 40),
    });

    const current = assignments[student.id] || [];
    const selected = current.map((item) => item.instrument_id);

    setSelectedInstruments(selected);

    const mapping: Record<string, string> = {};
    current.forEach((item) => {
      mapping[item.instrument_id] = item.teacher_id;
    });

    setTeacherByInstrument(mapping);
    setError('');
    setSuccess('');
  }

  function updateField(
    field: keyof typeof EMPTY_FORM,
    value: string
  ) {
    setForm((current) => ({
      ...current,
      [field]: value,
    }));
  }

  function toggleInstrument(id: string) {
    setSelectedInstruments((current) => {
      if (current.includes(id)) {
        setTeacherByInstrument((previous) => {
          const next = { ...previous };
          delete next[id];
          return next;
        });

        return current.filter((item) => item !== id);
      }

      return [...current, id];
    });
  }

  async function saveStudent(event: React.FormEvent) {
    event.preventDefault();

    if (!admin) {
      setError('Só o administrador pode editar alunos.');
      return;
    }

    if (!form.full_name.trim()) {
      setError('O nome do aluno é obrigatório.');
      return;
    }

    const fee = Number(form.monthly_fee);

    if (!Number.isFinite(fee) || fee < 0) {
      setError('Indica uma mensalidade válida.');
      return;
    }

    for (const instrumentId of selectedInstruments) {
      if (!teacherByInstrument[instrumentId]) {
        setError('Escolhe um professor para cada instrumento selecionado.');
        return;
      }
    }

    setSaving(true);
    setError('');
    setSuccess('');

    try {
      const payload = {
        full_name: form.full_name.trim(),
        email: form.email.trim() || null,
        phone: form.phone.trim() || null,
        guardian_name: form.guardian_name.trim() || null,
        guardian_phone: form.guardian_phone.trim() || null,
        guardian_email: form.guardian_email.trim() || null,
        important_notes: form.important_notes.trim() || null,
        status: form.status,
        monthly_fee: fee,
      };

      let studentId = editing?.id;

      if (editing) {
        const { error: updateError } = await supabase
          .from('students')
          .update(payload)
          .eq('id', editing.id);

        if (updateError) throw updateError;
      } else {
        const { data, error: insertError } = await supabase
          .from('students')
          .insert(payload)
          .select('id')
          .single();

        if (insertError) throw insertError;
        studentId = data.id;
      }

      if (!studentId) {
        throw new Error('Não foi possível identificar o aluno.');
      }

      // Atualiza os instrumentos do aluno.
      const { error: deleteInstrumentError } = await supabase
        .from('student_instruments')
        .delete()
        .eq('student_id', studentId);

      if (deleteInstrumentError) throw deleteInstrumentError;

      if (selectedInstruments.length) {
        const { error: insertInstrumentError } = await supabase
          .from('student_instruments')
          .insert(
            selectedInstruments.map((instrument_id) => ({
              student_id: studentId,
              instrument_id,
            }))
          );

        if (insertInstrumentError) throw insertInstrumentError;
      }

      // Substitui as atribuições de professor do aluno.
      const { error: deleteAssignmentsError } = await supabase
        .from('student_teacher_instruments')
        .delete()
        .eq('student_id', studentId);

      if (deleteAssignmentsError) throw deleteAssignmentsError;

      if (selectedInstruments.length) {
        const rows = selectedInstruments.map((instrument_id) => ({
          student_id: studentId,
          instrument_id,
          teacher_id: teacherByInstrument[instrument_id],
        }));

        const { error: assignmentInsertError } = await supabase
          .from('student_teacher_instruments')
          .insert(rows);

        if (assignmentInsertError) throw assignmentInsertError;
      }

      setSuccess(
        editing
          ? 'Ficha do aluno atualizada.'
          : 'Aluno criado com sucesso.'
      );

      setEditing(null);
      setForm(EMPTY_FORM);
      setSelectedInstruments([]);
      setTeacherByInstrument({});

      await load();
    } catch (err: any) {
      setError(
        err?.message ||
          'Não foi possível guardar os dados do aluno.'
      );
    } finally {
      setSaving(false);
    }
  }

  async function archiveStudent(student: Student) {
    if (!admin) return;

    if (
      !window.confirm(
        `Arquivar ${student.full_name || 'este aluno'}?`
      )
    ) {
      return;
    }

    const { error } = await supabase
      .from('students')
      .update({ status: 'arquivado' })
      .eq('id', student.id);

    if (error) {
      setError(error.message);
      return;
    }

    setSuccess('Aluno arquivado.');
    await load();
  }

  return (
    <section className="section">
      <div className="peopleHead">
        <div>
          <div className="eyebrow">Gestão escolar</div>
          <h2 style={{ margin: '6px 0' }}>Lista de alunos</h2>
          <div className="muted">
            Edita os dados, a mensalidade, os instrumentos e os professores.
          </div>
        </div>

        {admin && (
          <button className="btn primary" onClick={openNew}>
            + Novo aluno
          </button>
        )}
      </div>

      {error && <div className="error">{error}</div>}
      {success && <div className="success">{success}</div>}

      <div className="field" style={{ margin: '16px 0' }}>
        <label htmlFor="student-search">Pesquisar alunos</label>
        <input
          id="student-search"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Nome, email, telefone ou encarregado..."
        />
      </div>

      {loading ? (
        <div className="emptyCard">A carregar alunos…</div>
      ) : (
        <div style={{ display: 'grid', gap: 12 }}>
          {visibleStudents.map((student) => {
            const assigned = assignments[student.id] || [];

            return (
              <article
                className="personCard"
                key={student.id}
              >
                <div className="personTop">
                  <div>
                    <strong>{student.full_name || 'Sem nome'}</strong>
                    <div className="muted">
                      {student.email || 'Sem email'}
                      {student.phone ? ` · ${student.phone}` : ''}
                    </div>
                  </div>

                  <span className="pill">
                    {student.status}
                  </span>
                </div>

                <div className="personMeta">
                  Mensalidade: {Number(student.monthly_fee || 0).toLocaleString(
                    'pt-PT',
                    { style: 'currency', currency: 'EUR' }
                  )}
                </div>

                <div className="personMeta">
                  {assigned.length
                    ? assigned.map((item) => {
                        const instrument = instruments.find(
                          (i) => i.id === item.instrument_id
                        );
                        const teacher = teachers.find(
                          (t) => t.id === item.teacher_id
                        );

                        return `${instrument?.name || 'Instrumento'}: ${
                          teacher?.profile?.full_name || 'Professor'
                        }`;
                      }).join(' · ')
                    : 'Sem professores atribuídos nesta secção'}
                </div>

                {admin && (
                  <div
                    style={{
                      display: 'flex',
                      gap: 8,
                      flexWrap: 'wrap',
                      marginTop: 12,
                    }}
                  >
                    <button
                      className="btn primary"
                      onClick={() => openEdit(student)}
                    >
                      Editar ficha
                    </button>

                    {student.status !== 'arquivado' && (
                      <button
                        className="btn ghost"
                        onClick={() => void archiveStudent(student)}
                      >
                        Arquivar
                      </button>
                    )}
                  </div>
                )}
              </article>
            );
          })}

          {visibleStudents.length === 0 && (
            <div className="emptyCard">
              Não foram encontrados alunos.
            </div>
          )}
        </div>
      )}

      {admin && (editing || form.full_name === '') && (
        <div className="modalBackdrop">
          <form className="modalCard" onSubmit={saveStudent}>
            <div className="dashHead">
              <div>
                <div className="eyebrow">
                  {editing ? 'Editar aluno' : 'Novo aluno'}
                </div>
                <h3 style={{ margin: '6px 0' }}>
                  Ficha do aluno
                </h3>
              </div>

              <button
                type="button"
                className="btn ghost"
                onClick={() => {
                  setEditing(null);
                  setForm({
                    ...EMPTY_FORM,
                    full_name: '__CANCELLED__',
                  });
                  setSelectedInstruments([]);
                  setTeacherByInstrument({});
                }}
              >
                Fechar
              </button>
            </div>

            <div className="field">
              <label>Nome completo *</label>
              <input
                required
                value={form.full_name === '__CANCELLED__' ? '' : form.full_name}
                onChange={(e) => updateField('full_name', e.target.value)}
              />
            </div>

            <div className="twoFields">
              <div className="field">
                <label>Email do aluno</label>
                <input
                  type="email"
                  value={form.email}
                  onChange={(e) => updateField('email', e.target.value)}
                />
              </div>
              <div className="field">
                <label>Telefone do aluno</label>
                <input
                  value={form.phone}
                  onChange={(e) => updateField('phone', e.target.value)}
                />
              </div>
            </div>

            <div className="twoFields">
              <div className="field">
                <label>Nome do encarregado</label>
                <input
                  value={form.guardian_name}
                  onChange={(e) => updateField('guardian_name', e.target.value)}
                />
              </div>
              <div className="field">
                <label>Telefone do encarregado</label>
                <input
                  value={form.guardian_phone}
                  onChange={(e) => updateField('guardian_phone', e.target.value)}
                />
              </div>
            </div>

            <div className="field">
              <label>Email do encarregado</label>
              <input
                type="email"
                value={form.guardian_email}
                onChange={(e) => updateField('guardian_email', e.target.value)}
              />
            </div>

            <div className="twoFields">
              <div className="field">
                <label>Mensalidade (€)</label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  required
                  value={form.monthly_fee}
                  onChange={(e) => updateField('monthly_fee', e.target.value)}
                />
              </div>

              <div className="field">
                <label>Estado</label>
                <select
                  value={form.status}
                  onChange={(e) => updateField('status', e.target.value)}
                >
                  <option value="ativo">Ativo</option>
                  <option value="inativo">Inativo</option>
                  <option value="arquivado">Arquivado</option>
                </select>
              </div>
            </div>

            <div className="field">
              <label>Instrumentos e professores</label>
              <div className="checks">
                {instruments.map((instrument) => (
                  <div
                    key={instrument.id}
                    style={{
                      display: 'grid',
                      gridTemplateColumns: 'minmax(120px, 1fr) minmax(160px, 2fr)',
                      gap: 10,
                      alignItems: 'center',
                      marginBottom: 8,
                    }}
                  >
                    <label className="check">
                      <input
                        type="checkbox"
                        checked={selectedInstruments.includes(instrument.id)}
                        onChange={() => toggleInstrument(instrument.id)}
                      />
                      {instrument.name}
                    </label>

                    {selectedInstruments.includes(instrument.id) && (
                      <select
                        required
                        value={teacherByInstrument[instrument.id] || ''}
                        onChange={(e) =>
                          setTeacherByInstrument((previous) => ({
                            ...previous,
                            [instrument.id]: e.target.value,
                          }))
                        }
                      >
                        <option value="">Escolher professor</option>
                        {teachers.map((teacher) => (
                          <option key={teacher.id} value={teacher.id}>
                            {teacher.profile?.full_name || 'Professor'}
                            {teacher.specialty ? ` — ${teacher.specialty}` : ''}
                          </option>
                        ))}
                      </select>
                    )}
                  </div>
                ))}
              </div>
            </div>

            <div className="field">
              <label>Notas importantes</label>
              <textarea
                rows={4}
                value={form.important_notes}
                onChange={(e) => updateField('important_notes', e.target.value)}
              />
            </div>

            {error && <div className="error">{error}</div>}

            <button
              className="btn primary"
              type="submit"
              disabled={saving || form.full_name === '__CANCELLED__'}
            >
              {saving ? 'A guardar…' : 'Guardar ficha'}
            </button>
          </form>
        </div>
      )}
    </section>
  );
}
