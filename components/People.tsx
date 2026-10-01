'use client';

import { useEffect, useMemo, useState } from 'react';
import { createClient } from '../lib/supabase/client';

type Student = {
  id: string;
  full_name: string | null;
  phone: string | null;
  email: string | null;
  guardian_name: string | null;
  guardian_phone: string | null;
  status: string;
  important_notes: string | null;
};

type Teacher = {
  id: string;
  profile_id: string | null;
  specialty: string | null;
  active: boolean;
  profile?: {
    full_name: string | null;
    email: string | null;
    phone: string | null;
  } | null;
  studentCount?: number;
};

type Instrument = {
  id: string;
  name: string;
};

type ViewMode = 'active' | 'archive';

export function People({ role }: { role: string }) {
  const supabase = createClient();

  const [students, setStudents] = useState<Student[]>([]);
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [instruments, setInstruments] = useState<Instrument[]>([]);
  const [studentInstruments, setStudentInstruments] = useState<
    Record<string, string[]>
  >({});

  const [tab, setTab] = useState<'students' | 'teachers'>('students');
  const [view, setView] = useState<ViewMode>('active');

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [ok, setOk] = useState('');

  const [studentOpen, setStudentOpen] = useState(false);
  const [teacherOpen, setTeacherOpen] = useState(false);
  const [teacherEditOpen, setTeacherEditOpen] = useState(false);

  const [editingTeacher, setEditingTeacher] =
    useState<Teacher | null>(null);

  const [studentForm, setStudentForm] = useState({
    full_name: '',
    email: '',
    phone: '',
    guardian_name: '',
    guardian_phone: '',
    important_notes: '',
    instrument_ids: [] as string[],
  });

  const [teacherForm, setTeacherForm] = useState({
    full_name: '',
    email: '',
    phone: '',
    specialty: '',
  });

  const admin = role === 'administrador';

  async function load() {
    setLoading(true);
    setError('');

    const ss = await supabase
      .from('students')
      .select(
        'id,full_name,phone,email,guardian_name,guardian_phone,status,important_notes'
      )
      .order('full_name', { ascending: true });

    if (ss.error) {
      setError(ss.error.message);
      setLoading(false);
      return;
    }

    const ts = await supabase
      .from('teachers')
      .select(
        'id,profile_id,specialty,active,profile:profiles(full_name,email,phone)'
      )
      .order('active', { ascending: false });

    if (ts.error) {
      setError(ts.error.message);
      setLoading(false);
      return;
    }

    const ins = await supabase
      .from('instruments')
      .select('id,name')
      .order('name');

    if (ins.error) {
      setError(ins.error.message);
      setLoading(false);
      return;
    }

    const si = await supabase
      .from('student_instruments')
      .select('student_id,instrument_id');

    if (si.error) {
      setError(si.error.message);
      setLoading(false);
      return;
    }

    /*
     * Vamos buscar as aulas para calcular quantos alunos
     * estão atualmente ligados a cada professor.
     */
    const lessons = await supabase
      .from('lessons')
      .select('teacher_id,student_id');

    if (lessons.error) {
      setError(lessons.error.message);
      setLoading(false);
      return;
    }

    const teacherStudents: Record<string, Set<string>> = {};

    (lessons.data || []).forEach((lesson: any) => {
      if (!teacherStudents[lesson.teacher_id]) {
        teacherStudents[lesson.teacher_id] = new Set();
      }

      teacherStudents[lesson.teacher_id].add(lesson.student_id);
    });

    const map: Record<string, string[]> = {};

    (si.data || []).forEach((x: any) => {
      if (!map[x.student_id]) {
        map[x.student_id] = [];
      }

      map[x.student_id].push(x.instrument_id);
    });

    setStudents((ss.data || []) as Student[]);

    setTeachers(
      (ts.data || []).map((row: any) => {
        const profile = Array.isArray(row.profile)
          ? row.profile[0] ?? null
          : row.profile;

        const studentCount =
          teacherStudents[row.id]?.size || 0;

        return {
          ...row,
          profile,
          studentCount,
        };
      }) as Teacher[]
    );

    setInstruments((ins.data || []) as Instrument[]);
    setStudentInstruments(map);

    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  function toggleInstrument(id: string) {
    setStudentForm((f) => ({
      ...f,
      instrument_ids: f.instrument_ids.includes(id)
        ? f.instrument_ids.filter((x) => x !== id)
        : [...f.instrument_ids, id],
    }));
  }

  function openNewStudent() {
    setStudentForm({
      full_name: '',
      email: '',
      phone: '',
      guardian_name: '',
      guardian_phone: '',
      important_notes: '',
      instrument_ids: [],
    });

    setOk('');
    setError('');
    setStudentOpen(true);
  }

  function openNewTeacher() {
    setTeacherForm({
      full_name: '',
      email: '',
      phone: '',
      specialty: '',
    });

    setOk('');
    setError('');
    setTeacherOpen(true);
  }

  function openEditTeacher(teacher: Teacher) {
    setEditingTeacher(teacher);

    setTeacherForm({
      full_name: teacher.profile?.full_name || '',
      email: teacher.profile?.email || '',
      phone: teacher.profile?.phone || '',
      specialty: teacher.specialty || '',
    });

    setOk('');
    setError('');
    setTeacherEditOpen(true);
  }

  async function saveStudent(e: React.FormEvent) {
    e.preventDefault();

    if (!admin) return;

    setError('');
    setOk('');

    if (!studentForm.full_name.trim()) {
      setError('Nome é obrigatório.');
      return;
    }

    const { data, error } = await supabase
      .from('students')
      .insert({
        full_name: studentForm.full_name.trim(),
        email: studentForm.email || null,
        phone: studentForm.phone || null,
        guardian_name: studentForm.guardian_name || null,
        guardian_phone: studentForm.guardian_phone || null,
        important_notes:
          studentForm.important_notes || null,
      })
      .select('id')
      .single();

    if (error) {
      setError(error.message);
      return;
    }

    if (studentForm.instrument_ids.length) {
      const { error: instrumentError } = await supabase
        .from('student_instruments')
        .insert(
          studentForm.instrument_ids.map((instrument_id) => ({
            student_id: data.id,
            instrument_id,
          }))
        );

      if (instrumentError) {
        setError(instrumentError.message);
        return;
      }
    }

    setStudentOpen(false);
    setOk('Aluno criado.');
    load();
  }

  /*
   * CRIAR PROFESSOR
   *
   * Usa o endpoint /api/admin/invite que já existe no projeto.
   * O endpoint cria o utilizador no Supabase Auth,
   * cria o profile e cria a entrada em teachers.
   */
  async function saveTeacher(e: React.FormEvent) {
    e.preventDefault();

    if (!admin) return;

    setError('');
    setOk('');

    if (!teacherForm.full_name.trim()) {
      setError('O nome do professor é obrigatório.');
      return;
    }

    if (!teacherForm.email.trim()) {
      setError('O email do professor é obrigatório.');
      return;
    }

    try {
      const response = await fetch('/api/admin/invite', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          fullName: teacherForm.full_name.trim(),
          email: teacherForm.email.trim().toLowerCase(),
          phone: teacherForm.phone.trim(),
          specialty: teacherForm.specialty.trim(),
          role: 'professor',
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        setError(result?.error || 'Não foi possível criar o professor.');
        return;
      }

      setTeacherOpen(false);

      setOk(
        `Professor criado. Foi enviado um convite para ${teacherForm.email}.`
      );

      load();
    } catch (err: any) {
      setError(
        err?.message ||
          'Erro de ligação ao servidor ao criar o professor.'
      );
    }
  }

  /*
   * EDITAR PROFESSOR
   */
  async function saveTeacherEdit(e: React.FormEvent) {
    e.preventDefault();

    if (!admin || !editingTeacher) return;

    setError('');
    setOk('');

    if (!teacherForm.full_name.trim()) {
      setError('O nome do professor é obrigatório.');
      return;
    }

    if (!editingTeacher.profile_id) {
      setError('Este professor ainda não tem um perfil de acesso.');
      return;
    }

    const { error: profileError } = await supabase
      .from('profiles')
      .update({
        full_name: teacherForm.full_name.trim(),
        phone: teacherForm.phone.trim() || null,
      })
      .eq('id', editingTeacher.profile_id);

    if (profileError) {
      setError(profileError.message);
      return;
    }

    const { error: teacherError } = await supabase
      .from('teachers')
      .update({
        specialty: teacherForm.specialty.trim() || null,
      })
      .eq('id', editingTeacher.id);

    if (teacherError) {
      setError(teacherError.message);
      return;
    }

    setTeacherEditOpen(false);
    setEditingTeacher(null);

    setOk(`${teacherForm.full_name} foi atualizado.`);

    load();
  }

  async function archiveStudent(student: Student) {
    if (!admin) return;

    const name = student.full_name || 'este aluno';

    if (
      !window.confirm(
        `Arquivar ${name}? O aluno deixa de aparecer nos ativos, mas fica recuperável.`
      )
    ) {
      return;
    }

    setError('');
    setOk('');

    const { error } = await supabase
      .from('students')
      .update({ status: 'arquivado' })
      .eq('id', student.id);

    if (error) {
      setError(error.message);
      return;
    }

    setOk(`${name} foi arquivado.`);
    load();
  }

  async function restoreStudent(student: Student) {
    if (!admin) return;

    const name = student.full_name || 'este aluno';

    if (!window.confirm(`Recuperar ${name}?`)) return;

    setError('');
    setOk('');

    const { error } = await supabase
      .from('students')
      .update({ status: 'ativo' })
      .eq('id', student.id);

    if (error) {
      setError(error.message);
      return;
    }

    setOk(`${name} foi recuperado.`);
    load();
  }

  async function archiveTeacher(teacher: Teacher) {
    if (!admin) return;

    const name =
      teacher.profile?.full_name || 'este professor';

    if (
      !window.confirm(
        `Arquivar ${name}? O professor passa para o arquivo e deixa de aparecer nos professores ativos.`
      )
    ) {
      return;
    }

    setError('');
    setOk('');

    const { error } = await supabase
      .from('teachers')
      .update({ active: false })
      .eq('id', teacher.id);

    if (error) {
      setError(error.message);
      return;
    }

    setOk(`${name} foi arquivado.`);
    load();
  }

  async function restoreTeacher(teacher: Teacher) {
    if (!admin) return;

    const name =
      teacher.profile?.full_name || 'este professor';

    if (!window.confirm(`Recuperar ${name}?`)) return;

    setError('');
    setOk('');

    const { error } = await supabase
      .from('teachers')
      .update({ active: true })
      .eq('id', teacher.id);

    if (error) {
      setError(error.message);
      return;
    }

    setOk(`${name} foi recuperado.`);
    load();
  }


  async function deletePerson(
    type: 'student' | 'teacher',
    id: string,
    name: string
  ) {
    if (!admin) return;

    const confirmed = window.confirm(
      `ATENÇÃO!\n\nEliminar definitivamente ${name}?\n\n` +
        `Esta ação irá apagar a pessoa, a conta de acesso, ` +
        `as aulas associadas e os pedidos de remarcação.\n\n` +
        `A pessoa NÃO ficará no arquivo e esta ação não pode ser desfeita.\n\nContinuar?`
    );

    if (!confirmed) return;

    setError('');
    setOk('');

    try {
      const response = await fetch('/api/admin/delete-person', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ type, id }),
      });

      const result = await response.json();

      if (!response.ok) {
        setError(
          result?.error ||
            'Não foi possível eliminar a pessoa.'
        );
        return;
      }

      setOk(
        result?.message ||
          `${name} foi eliminado definitivamente.`
      );

      await load();
    } catch (err: any) {
      setError(
        err?.message ||
          'Erro de ligação ao servidor ao eliminar a pessoa.'
      );
    }
  }

  const instrumentName = useMemo(
    () =>
      Object.fromEntries(
        instruments.map((i) => [i.id, i.name])
      ),
    [instruments]
  );

  const visibleStudents = students.filter((s) =>
    view === 'archive'
      ? s.status === 'arquivado'
      : s.status !== 'arquivado'
  );

  const visibleTeachers = teachers.filter((t) =>
    view === 'archive' ? !t.active : t.active
  );

  const studentArchiveCount = students.filter(
    (s) => s.status === 'arquivado'
  ).length;

  const teacherArchiveCount = teachers.filter(
    (t) => !t.active
  ).length;

  return (
    <section className="section">

      {/* CABEÇALHO */}
      <div className="peopleHead">

        <div>
          <div className="eyebrow">Pessoas</div>

          <h2 style={{ margin: '6px 0 4px' }}>
            Alunos e professores
          </h2>

          <div className="muted">
            Perfis ligados à agenda e às permissões de acesso.
          </div>
        </div>

        {admin &&
          view === 'active' &&
          tab === 'students' && (
            <button
              className="btn primary"
              onClick={openNewStudent}
            >
              + Novo aluno
            </button>
          )}

        {admin &&
          view === 'active' &&
          tab === 'teachers' && (
            <button
              className="btn primary"
              onClick={openNewTeacher}
            >
              + Novo professor
            </button>
          )}

      </div>

      {/* TABS */}
      <div
        className="tabs"
        style={{
          display: 'flex',
          gap: 8,
          flexWrap: 'wrap',
        }}
      >

        <button
          className={
            tab === 'students'
              ? 'tab active'
              : 'tab'
          }
          onClick={() => setTab('students')}
        >
          Alunos{' '}
          <span>
            {
              students.filter(
                (s) => s.status !== 'arquivado'
              ).length
            }
          </span>
        </button>

        <button
          className={
            tab === 'teachers'
              ? 'tab active'
              : 'tab'
          }
          onClick={() => setTab('teachers')}
        >
          Professores{' '}
          <span>
            {
              teachers.filter(
                (t) => t.active
              ).length
            }
          </span>
        </button>

        {admin && (
          <button
            className={
              view === 'archive'
                ? 'tab active'
                : 'tab'
            }
            onClick={() =>
              setView((v) =>
                v === 'active'
                  ? 'archive'
                  : 'active'
              )
            }
          >
            Arquivo{' '}
            <span>
              {studentArchiveCount +
                teacherArchiveCount}
            </span>
          </button>
        )}

      </div>

      {admin && (
        <div
          className="muted"
          style={{
            margin: '8px 0 12px',
          }}
        >
          {view === 'archive'
            ? 'A visualizar elementos arquivados. Podem ser recuperados a qualquer momento.'
            : 'A visualizar apenas elementos ativos.'}
        </div>
      )}

      {error && (
        <div className="error">
          {error}
        </div>
      )}

      {ok && (
        <div className="success">
          {ok}
        </div>
      )}

      {/* CONTEÚDO */}
      {loading ? (
        <div className="muted">
          A carregar…
        </div>
      ) : tab === 'students' ? (

        /* =========================
           ALUNOS
           ========================= */

        <div className="peopleGrid">

          {visibleStudents.map((s) => (
            <div
              className="personCard"
              key={s.id}
            >

              <div className="personTop">

                <div>
                  <strong>
                    {s.full_name || 'Sem nome'}
                  </strong>

                  <div className="muted">
                    {view === 'archive'
                      ? 'Arquivado'
                      : s.status}
                  </div>
                </div>

                <span className="pill">
                  {(studentInstruments[s.id] || [])
                    .map(
                      (id) =>
                        instrumentName[id]
                    )
                    .filter(Boolean)
                    .join(' · ') ||
                    'Sem instrumento'}
                </span>

              </div>

              <div className="personMeta">
                {s.phone || 'Sem telefone'}
                {s.email
                  ? ` · ${s.email}`
                  : ''}
              </div>

              {s.guardian_name && (
                <div className="personMeta">
                  Encarregado:{' '}
                  {s.guardian_name}

                  {s.guardian_phone
                    ? ` · ${s.guardian_phone}`
                    : ''}
                </div>
              )}

              {s.important_notes && (
                <div className="noteSmall">
                  {s.important_notes}
                </div>
              )}

              {admin && (
                <div
                  style={{
                    display: 'flex',
                    gap: 8,
                    marginTop: 10,
                  }}
                >

                  {view === 'archive' ? (

                    <button
                      className="btn ghost"
                      onClick={() =>
                        restoreStudent(s)
                      }
                    >
                      Recuperar
                    </button>

                  ) : (

                    <>
                      <button
                        className="btn ghost"
                        onClick={() =>
                          archiveStudent(s)
                        }
                      >
                        Arquivar
                      </button>

                      <button
                        className="btn ghost"
                        style={{
                          color: '#dc2626',
                          borderColor: '#dc2626',
                        }}
                        onClick={() =>
                          deletePerson(
                            'student',
                            s.id,
                            s.full_name || 'este aluno'
                          )
                        }
                      >
                        Eliminar definitivamente
                      </button>
                    </>

                  )}

                </div>
              )}

            </div>
          ))}

          {visibleStudents.length === 0 && (
            <div className="emptyCard">
              {view === 'archive'
                ? 'Não existem alunos arquivados.'
                : 'Ainda não existem alunos ativos.'}
            </div>
          )}

        </div>

      ) : (

        /* =========================
           PROFESSORES
           ========================= */

        <div className="peopleGrid">

          {visibleTeachers.map((teacher) => (

            <div
              className="personCard"
              key={teacher.id}
            >

              <div className="personTop">

                <div>

                  <strong>
                    {teacher.profile?.full_name ||
                      'Professor sem perfil'}
                  </strong>

                  <div className="muted">
                    {teacher.specialty ||
                      'Especialidade por definir'}
                  </div>

                </div>

                <span className="pill">
                  {view === 'archive'
                    ? 'Arquivado'
                    : 'Ativo'}
                </span>

              </div>

              <div className="personMeta">
                {teacher.profile?.email ||
                  'Sem email'}

                {teacher.profile?.phone
                  ? ` · ${teacher.profile.phone}`
                  : ''}
              </div>

              <div
                className="personMeta"
                style={{
                  marginTop: 8,
                }}
              >
                <strong>
                  {teacher.studentCount || 0}
                </strong>{' '}
                aluno
                {(teacher.studentCount || 0) !== 1
                  ? 's'
                  : ''}{' '}
                atribuído
                {(teacher.studentCount || 0) !== 1
                  ? 's'
                  : ''}
              </div>

              {admin && (
                <div
                  style={{
                    display: 'flex',
                    gap: 8,
                    marginTop: 12,
                    flexWrap: 'wrap',
                  }}
                >

                  {view === 'archive' ? (

                    <button
                      className="btn ghost"
                      onClick={() =>
                        restoreTeacher(teacher)
                      }
                    >
                      Recuperar
                    </button>

                  ) : (

                    <>
                      <button
                        className="btn ghost"
                        onClick={() =>
                          openEditTeacher(
                            teacher
                          )
                        }
                      >
                        Gerir
                      </button>

                      <button
                        className="btn ghost"
                        onClick={() =>
                          archiveTeacher(
                            teacher
                          )
                        }
                      >
                        Arquivar
                      </button>

                      <button
                        className="btn ghost"
                        style={{
                          color: '#dc2626',
                          borderColor: '#dc2626',
                        }}
                        onClick={() =>
                          deletePerson(
                            'teacher',
                            teacher.id,
                            teacher.profile?.full_name ||
                              'este professor'
                          )
                        }
                      >
                        Eliminar definitivamente
                      </button>
                    </>

                  )}

                </div>
              )}

            </div>

          ))}

          {visibleTeachers.length === 0 && (
            <div className="emptyCard">

              {view === 'archive'
                ? 'Não existem professores arquivados.'
                : 'Ainda não existem professores ativos.'}

            </div>
          )}

        </div>
      )}

      {/* =========================
          MODAL NOVO ALUNO
          ========================= */}

      {studentOpen && (

        <div className="modalBackdrop">

          <form
            className="modalCard"
            onSubmit={saveStudent}
          >

            <div className="dashHead">

              <div>

                <div className="eyebrow">
                  Novo aluno
                </div>

                <h3
                  style={{
                    margin: '6px 0',
                  }}
                >
                  Ficha do aluno
                </h3>

              </div>

              <button
                type="button"
                className="btn ghost"
                onClick={() =>
                  setStudentOpen(false)
                }
              >
                Fechar
              </button>

            </div>

            <div className="field">
              <label>
                Nome completo
              </label>

              <input
                value={studentForm.full_name}
                onChange={(e) =>
                  setStudentForm({
                    ...studentForm,
                    full_name:
                      e.target.value,
                  })
                }
              />
            </div>

            <div className="twoFields">

              <div className="field">

                <label>
                  Telefone
                </label>

                <input
                  value={studentForm.phone}
                  onChange={(e) =>
                    setStudentForm({
                      ...studentForm,
                      phone:
                        e.target.value,
                    })
                  }
                />

              </div>

              <div className="field">

                <label>
                  Email
                </label>

                <input
                  type="email"
                  value={studentForm.email}
                  onChange={(e) =>
                    setStudentForm({
                      ...studentForm,
                      email:
                        e.target.value,
                    })
                  }
                />

              </div>

            </div>

            <div className="twoFields">

              <div className="field">

                <label>
                  Encarregado
                </label>

                <input
                  value={
                    studentForm.guardian_name
                  }
                  onChange={(e) =>
                    setStudentForm({
                      ...studentForm,
                      guardian_name:
                        e.target.value,
                    })
                  }
                />

              </div>

              <div className="field">

                <label>
                  Telefone encarregado
                </label>

                <input
                  value={
                    studentForm.guardian_phone
                  }
                  onChange={(e) =>
                    setStudentForm({
                      ...studentForm,
                      guardian_phone:
                        e.target.value,
                    })
                  }
                />

              </div>

            </div>

            <div className="field">

              <label>
                Instrumentos
              </label>

              <div className="checks">

                {instruments.map((i) => (

                  <label
                    className="check"
                    key={i.id}
                  >

                    <input
                      type="checkbox"
                      checked={studentForm.instrument_ids.includes(
                        i.id
                      )}
                      onChange={() =>
                        toggleInstrument(
                          i.id
                        )
                      }
                    />

                    {i.name}

                  </label>

                ))}

              </div>

            </div>

            <div className="field">

              <label>
                Notas importantes
              </label>

              <textarea
                rows={4}
                value={
                  studentForm.important_notes
                }
                onChange={(e) =>
                  setStudentForm({
                    ...studentForm,
                    important_notes:
                      e.target.value,
                  })
                }
              />

            </div>

            <button
              className="btn primary"
              type="submit"
            >
              Guardar aluno
            </button>

          </form>

        </div>
      )}

      {/* =========================
          MODAL NOVO PROFESSOR
          ========================= */}

      {teacherOpen && (

        <div className="modalBackdrop">

          <form
            className="modalCard"
            onSubmit={saveTeacher}
          >

            <div className="dashHead">

              <div>

                <div className="eyebrow">
                  Novo professor
                </div>

                <h3
                  style={{
                    margin: '6px 0',
                  }}
                >
                  Criar acesso
                </h3>

              </div>

              <button
                type="button"
                className="btn ghost"
                onClick={() =>
                  setTeacherOpen(false)
                }
              >
                Fechar
              </button>

            </div>

            <div className="muted" style={{ marginBottom: 16 }}>
              O professor receberá um email para
              ativar o acesso ao Palco 21.
            </div>

            <div className="field">

              <label>
                Nome completo
              </label>

              <input
                value={teacherForm.full_name}
                onChange={(e) =>
                  setTeacherForm({
                    ...teacherForm,
                    full_name:
                      e.target.value,
                  })
                }
                placeholder="Ex.: Pedro Silva"
              />

            </div>

            <div className="field">

              <label>
                Email
              </label>

              <input
                type="email"
                value={teacherForm.email}
                onChange={(e) =>
                  setTeacherForm({
                    ...teacherForm,
                    email:
                      e.target.value,
                  })
                }
                placeholder="professor@email.com"
              />

            </div>

            <div className="twoFields">

              <div className="field">

                <label>
                  Telefone
                </label>

                <input
                  value={teacherForm.phone}
                  onChange={(e) =>
                    setTeacherForm({
                      ...teacherForm,
                      phone:
                        e.target.value,
                    })
                  }
                />

              </div>

              <div className="field">

                <label>
                  Especialidade
                </label>

                <input
                  value={
                    teacherForm.specialty
                  }
                  onChange={(e) =>
                    setTeacherForm({
                      ...teacherForm,
                      specialty:
                        e.target.value,
                    })
                  }
                  placeholder="Ex.: Guitarra"
                />

              </div>

            </div>

            <button
              className="btn primary"
              type="submit"
            >
              Criar professor e enviar convite
            </button>

          </form>

        </div>
      )}

      {/* =========================
          MODAL GERIR PROFESSOR
          ========================= */}

      {teacherEditOpen &&
        editingTeacher && (

          <div className="modalBackdrop">

            <form
              className="modalCard"
              onSubmit={saveTeacherEdit}
            >

              <div className="dashHead">

                <div>

                  <div className="eyebrow">
                    Gerir professor
                  </div>

                  <h3
                    style={{
                      margin: '6px 0',
                    }}
                  >
                    Dados do professor
                  </h3>

                </div>

                <button
                  type="button"
                  className="btn ghost"
                  onClick={() =>
                    setTeacherEditOpen(false)
                  }
                >
                  Fechar
                </button>

              </div>

              <div className="field">

                <label>
                  Nome completo
                </label>

                <input
                  value={
                    teacherForm.full_name
                  }
                  onChange={(e) =>
                    setTeacherForm({
                      ...teacherForm,
                      full_name:
                        e.target.value,
                    })
                  }
                />

              </div>

              <div className="field">

                <label>
                  Email
                </label>

                <input
                  value={
                    teacherForm.email
                  }
                  disabled
                />

                <div
                  className="muted"
                  style={{
                    marginTop: 5,
                  }}
                >
                  O email de acesso não é
                  alterado nesta área.
                </div>

              </div>

              <div className="twoFields">

                <div className="field">

                  <label>
                    Telefone
                  </label>

                  <input
                    value={
                      teacherForm.phone
                    }
                    onChange={(e) =>
                      setTeacherForm({
                        ...teacherForm,
                        phone:
                          e.target.value,
                      })
                    }
                  />

                </div>

                <div className="field">

                  <label>
                    Especialidade
                  </label>

                  <input
                    value={
                      teacherForm.specialty
                    }
                    onChange={(e) =>
                      setTeacherForm({
                        ...teacherForm,
                        specialty:
                          e.target.value,
                      })
                    }
                  />

                </div>

              </div>

              <div
                className="personMeta"
                style={{
                  marginBottom: 15,
                }}
              >
                <strong>
                  {editingTeacher.studentCount ||
                    0}
                </strong>{' '}
                aluno
                {(editingTeacher.studentCount ||
                  0) !== 1
                  ? 's'
                  : ''}{' '}
                atribuído
                {(editingTeacher.studentCount ||
                  0) !== 1
                  ? 's'
                  : ''}
              </div>

              <button
                className="btn primary"
                type="submit"
              >
                Guardar alterações
              </button>

            </form>

          </div>
        )}

    </section>
  );
}
