
'use client';

import { useEffect, useMemo, useState } from 'react';
import { createClient } from '../lib/supabase/client';

type Lesson = {
  id: string;
  student_id: string;
  teacher_id: string;
  instrument_id: string;
  series_id: string | null;
  starts_at: string;
  status: string;
  notes: string | null;
  student?: {
    full_name?: string | null;
    profile?: { full_name: string | null } | null;
    guardian_name?: string | null;
  } | null;
  teacher?: {
    profile?: { full_name: string | null } | null;
  } | null;
  instrument?: { name: string } | null;
  series?: {
    repeat_until: string;
    active: boolean;
    start_time: string | null;
  } | null;
};

type Option = { id: string; name: string };

const pad = (n: number) => String(n).padStart(2, '0');

function startOfWeek(d: Date) {
  const x = new Date(d);
  const day = x.getDay();
  x.setDate(x.getDate() + (day === 0 ? -6 : 1 - day));
  x.setHours(0, 0, 0, 0);
  return x;
}

function addDays(d: Date, n: number) {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
}

function fmtDate(d: Date) {
  return new Intl.DateTimeFormat('pt-PT', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(d);
}

function fmtTime(s: string) {
  return new Intl.DateTimeFormat('pt-PT', {
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(s));
}

function localDateValue(d: Date) {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function localTimeValue(d: Date) {
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function localDateTimeToDate(date: string, time: string) {
  return new Date(`${date}T${time}:00`);
}

function academicYearEnd(dateText: string) {
  const d = new Date(`${dateText}T12:00:00`);
  const year = d.getMonth() >= 8
    ? d.getFullYear() + 1
    : d.getFullYear();

  return `${year}-07-31`;
}

function studentName(lesson: Lesson) {
  return (
    lesson.student?.full_name ||
    lesson.student?.profile?.full_name ||
    'Aluno'
  );
}

function teacherName(lesson: Lesson) {
  return lesson.teacher?.profile?.full_name || 'Professor';
}

export function Agenda({ role }: { role: string }) {
  const supabase = createClient();

  const [week, setWeek] = useState(startOfWeek(new Date()));
  const [lessons, setLessons] = useState<Lesson[]>([]);
  const [students, setStudents] = useState<Option[]>([]);
  const [teachers, setTeachers] = useState<Option[]>([]);
  const [instruments, setInstruments] = useState<Option[]>([]);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [showAdd, setShowAdd] = useState(false);
  const [showFullAgenda, setShowFullAgenda] = useState(false);
  const [saving, setSaving] = useState(false);

  const [seriesLesson, setSeriesLesson] = useState<Lesson | null>(null);
  const [seriesForm, setSeriesForm] = useState({
    time: '17:00',
    repeatUntil: '',
  });

  const [form, setForm] = useState({
    student_ids: [] as string[],
    teacher_id: '',
    instrument_id: '',
    date: '',
    time: '17:00',
    repeatWeekly: false,
    repeatUntil: '',
    notes: '',
  });

  const monday = week;
  const sunday = addDays(monday, 7);

  const weekLessons = useMemo(
    () =>
      lessons.filter(lesson => {
        const date = new Date(lesson.starts_at);
        return date >= monday && date < sunday;
      }),
    [lessons, monday, sunday]
  );

  async function load() {
    setLoading(true);
    setError('');

    try {
      const {
        data: { user },
        error: authError,
      } = await supabase.auth.getUser();

      if (authError) throw authError;

      if (!user) {
        setLessons([]);
        setStudents([]);
        setTeachers([]);
        setInstruments([]);
        return;
      }

      // Identificar o perfil de professor ligado à sessão atual.
      let ownTeacherId: string | null = null;

      if (role === 'professor') {
        const { data: ownTeacher, error: ownTeacherError } = await supabase
          .from('teachers')
          .select('id')
          .eq('profile_id', user.id)
          .eq('active', true)
          .maybeSingle();

        if (ownTeacherError) throw ownTeacherError;

        if (!ownTeacher) {
          setLessons([]);
          setStudents([]);
          setTeachers([]);
          setError(
            'Não foi encontrado um perfil de professor ativo associado a esta conta.'
          );
          return;
        }

        ownTeacherId = ownTeacher.id;
      }

      const endDate = showFullAgenda
        ? new Date(
            `${academicYearEnd(localDateValue(monday))}T23:59:59.999`
          )
        : sunday;

      // Consultar as aulas e filtrar pelo professor quando aplicável.
      let lessonQuery = supabase
        .from('lessons')
        .select(`
          id,
          student_id,
          teacher_id,
          instrument_id,
          series_id,
          starts_at,
          status,
          notes,
          student:students(
            full_name,
            guardian_name,
            profile:profiles(full_name)
          ),
          teacher:teachers(
            profile:profiles(full_name)
          ),
          instrument:instruments(name),
          series:lesson_series(
            repeat_until,
            active,
            start_time
          )
        `)
        .gte('starts_at', monday.toISOString())
        .lt('starts_at', endDate.toISOString());

      if (ownTeacherId) {
        lessonQuery = lessonQuery.eq('teacher_id', ownTeacherId);
      }

      const { data, error: lessonError } = await lessonQuery.order('starts_at');

      if (lessonError) throw lessonError;

      const loadedLessons = ((data || []) as any[]).map(row => ({
        ...row,
        student: Array.isArray(row.student)
          ? row.student[0] ?? null
          : row.student,
        teacher: Array.isArray(row.teacher)
          ? row.teacher[0] ?? null
          : row.teacher,
        instrument: Array.isArray(row.instrument)
          ? row.instrument[0] ?? null
          : row.instrument,
        series: Array.isArray(row.series)
          ? row.series[0] ?? null
          : row.series,
      })) as Lesson[];

      setLessons(loadedLessons);

      const [studentsResult, teachersResult, instrumentsResult] =
        await Promise.all([
          supabase
            .from('students')
            .select('id,full_name,profile_id')
            .eq('status', 'ativo')
            .order('full_name'),

          supabase
            .from('teachers')
            .select('id,profile_id,active')
            .eq('active', true),

          supabase
            .from('instruments')
            .select('id,name')
            .order('name'),
        ]);

      if (studentsResult.error) {
        throw new Error(`Alunos: ${studentsResult.error.message}`);
      }

      if (teachersResult.error) {
        throw new Error(`Professores: ${teachersResult.error.message}`);
      }

      if (instrumentsResult.error) {
        throw new Error(`Instrumentos: ${instrumentsResult.error.message}`);
      }

      const profileIds = Array.from(
        new Set([
          ...(studentsResult.data || []).map((item: any) => item.profile_id),
          ...(teachersResult.data || []).map((item: any) => item.profile_id),
        ].filter(Boolean))
      );

      let profiles: Record<string, string> = {};

      if (profileIds.length) {
        const { data: profileRows, error: profileError } = await supabase
          .from('profiles')
          .select('id,full_name')
          .in('id', profileIds);

        if (profileError) throw profileError;

        profiles = Object.fromEntries(
          (profileRows || []).map((profile: any) => [
            profile.id,
            profile.full_name,
          ])
        );
      }

      setStudents(
        (studentsResult.data || []).map((student: any) => ({
          id: student.id,
          name:
            student.full_name ||
            profiles[student.profile_id] ||
            'Sem nome',
        }))
      );

      const availableTeachers = (teachersResult.data || []).map(
        (teacher: any) => ({
          id: teacher.id,
          name: profiles[teacher.profile_id] || 'Sem nome',
          profile_id: teacher.profile_id,
        })
      );

      setTeachers(
        role === 'professor'
          ? availableTeachers
              .filter((teacher: any) => teacher.profile_id === user.id)
              .map(({ id, name }: any) => ({ id, name }))
          : availableTeachers.map(({ id, name }: any) => ({ id, name }))
      );

      setInstruments((instrumentsResult.data || []) as Option[]);
    } catch (err: any) {
      setError(err?.message || 'Não foi possível carregar a agenda.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, [week, showFullAgenda, role]);

  function move(amount: number) {
    setWeek(addDays(week, amount * 7));
  }

  function openNew() {
    setError('');
    setSuccess('');

    const date = new Date(monday);
    date.setHours(17, 0, 0, 0);

    setForm({
      student_ids: [],
      teacher_id: teachers.length === 1 ? teachers[0].id : '',
      instrument_id: '',
      date: localDateValue(date),
      time: '17:00',
      repeatWeekly: false,
      repeatUntil: academicYearEnd(localDateValue(date)),
      notes: '',
    });

    setShowAdd(true);
  }

  function toggleStudent(id: string) {
    setForm(current => ({
      ...current,
      student_ids: current.student_ids.includes(id)
        ? current.student_ids.filter(studentId => studentId !== id)
        : [...current.student_ids, id],
    }));
  }

  async function addLesson(e: React.FormEvent) {
    e.preventDefault();

    if (saving) return;

    setError('');
    setSuccess('');

    if (
      !form.student_ids.length ||
      !form.teacher_id ||
      !form.instrument_id ||
      !form.date ||
      !form.time
    ) {
      setError(
        'Seleciona pelo menos um aluno, professor, instrumento, data e hora.'
      );
      return;
    }

    // Um professor só pode criar aulas em nome do próprio perfil.
    if (
      role === 'professor' &&
      !teachers.some(
        teacher =>
          teacher.id === form.teacher_id
      )
    ) {
      setError('Só podes agendar aulas no teu próprio perfil.');
      return;
    }

    const starts = localDateTimeToDate(form.date, form.time);

    if (Number.isNaN(starts.getTime())) {
      setError('Data ou hora inválida.');
      return;
    }

    const occurrences: Date[] = [starts];

    if (form.repeatWeekly) {
      if (!form.repeatUntil) {
        setError('Indica até quando queres repetir a aula.');
        return;
      }

      const until = localDateTimeToDate(form.repeatUntil, form.time);

      if (Number.isNaN(until.getTime()) || until < starts) {
        setError(
          'A data final tem de ser igual ou posterior à primeira aula.'
        );
        return;
      }

      let cursor = new Date(starts);

      while (true) {
        cursor = addDays(cursor, 7);

        if (cursor > until) break;

        occurrences.push(new Date(cursor));

        if (occurrences.length > 60) {
          setError('A série excede o limite de 60 ocorrências.');
          return;
        }
      }
    }

    setSaving(true);

    let seriesId: string | null = null;

    try {
      if (form.repeatWeekly) {
        const { data: series, error: seriesError } = await supabase
          .from('lesson_series')
          .insert({
            student_id: form.student_ids[0],
            teacher_id: form.teacher_id,
            instrument_id: form.instrument_id,
            first_starts_at: starts.toISOString(),
            start_time: form.time,
            weekday: starts.getDay() === 0 ? 7 : starts.getDay(),
            repeat_until: form.repeatUntil,
            active: true,
          })
          .select('id')
          .single();

        if (seriesError || !series) {
          throw new Error(
            seriesError?.message || 'Não foi possível criar a série.'
          );
        }

        seriesId = series.id;
      }

      const rows = occurrences.flatMap(occurrence =>
        form.student_ids.map(student_id => ({
          student_id,
          teacher_id: form.teacher_id,
          instrument_id: form.instrument_id,
          series_id: seriesId,
          starts_at: occurrence.toISOString(),
          duration_minutes: 50,
          notes: form.notes.trim() || null,
        }))
      );

      const { error: insertError } = await supabase
        .from('lessons')
        .insert(rows);

      if (insertError) {
        if (seriesId) {
          await supabase
            .from('lesson_series')
            .delete()
            .eq('id', seriesId);
        }

        throw insertError;
      }

      setShowAdd(false);

      setSuccess(
        form.repeatWeekly
          ? `Série criada: ${form.student_ids.length} aluno(s), ${occurrences.length} aulas por aluno.`
          : `Aula criada para ${form.student_ids.length} aluno(s) no mesmo horário.`
      );

      try {
        await fetch('/api/notifications/enqueue', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            items: [
              {
                channel: 'email',
                recipient: 'admin@palco21.pt',
                subject: form.repeatWeekly
                  ? 'Série semanal — Palco 21'
                  : 'Nova aula — Palco 21',
                body: form.repeatWeekly
                  ? `Foi criada uma série semanal para ${form.student_ids.length} aluno(s), com ${occurrences.length} aulas por aluno, a partir de ${starts.toLocaleString('pt-PT')}.`
                  : `Foi criada uma aula para ${form.student_ids.length} aluno(s), no mesmo horário: ${starts.toLocaleString('pt-PT')}.`,
                event_type: 'lesson_created',
              },
            ],
          }),
        });
      } catch {
        // Uma falha de notificação não invalida a aula criada.
      }

      await load();
    } catch (err: any) {
      setError(err?.message || 'Não foi possível criar a aula.');
    } finally {
      setSaving(false);
    }
  }

  async function cancelLesson(lesson: Lesson) {
    if (lesson.status === 'cancelada') return;

    const confirmed = window.confirm(
      `Cancelar a aula de ${studentName(lesson)} em ${new Date(
        lesson.starts_at
      ).toLocaleString('pt-PT')}?`
    );

    if (!confirmed) return;

    setError('');
    setSuccess('');

    const { error } = await supabase
      .from('lessons')
      .delete()
      .eq('id', lesson.id);

    if (error) {
      setError(error.message);
      return;
    }

    setSuccess('Aula cancelada e removida da agenda.');
    await load();
  }

  function openSeriesManager(lesson: Lesson) {
    if (!lesson.series_id || !lesson.series) return;

    setSeriesLesson(lesson);

    setSeriesForm({
      time: localTimeValue(new Date(lesson.starts_at)),
      repeatUntil: lesson.series.repeat_until,
    });

    setError('');
    setSuccess('');
  }

  async function saveSeriesChanges() {
    if (!seriesLesson?.series_id || !seriesLesson.series) return;

    setError('');
    setSuccess('');

    const current = new Date(seriesLesson.starts_at);
    const until = localDateTimeToDate(
      seriesForm.repeatUntil,
      seriesForm.time
    );

    if (Number.isNaN(until.getTime()) || until < current) {
      setError('A data final da série é inválida.');
      return;
    }

    const { data: futureLessons, error: futureError } = await supabase
      .from('lessons')
      .select('id,student_id,starts_at,status')
      .eq('series_id', seriesLesson.series_id)
      .gte('starts_at', current.toISOString())
      .order('starts_at');

    if (futureError) {
      setError(futureError.message);
      return;
    }

    const future = futureLessons || [];

    const studentIds = Array.from(
      new Set([
        ...future.map((lesson: any) => lesson.student_id),
        seriesLesson.student_id,
      ])
    );

    const newDates: Date[] = [];
    let cursor = new Date(current);

    while (cursor <= until) {
      const next = localDateTimeToDate(
        localDateValue(cursor),
        seriesForm.time
      );

      if (next >= current) newDates.push(next);

      cursor = addDays(cursor, 7);

      if (newDates.length > 60) {
        setError('A série excede o limite de 60 ocorrências.');
        return;
      }
    }

    const scheduled = future.filter(
      (lesson: any) => lesson.status === 'agendada'
    );

    for (const studentId of studentIds) {
      const studentLessons = scheduled
        .filter((lesson: any) => lesson.student_id === studentId)
        .sort(
          (a: any, b: any) =>
            new Date(a.starts_at).getTime() -
            new Date(b.starts_at).getTime()
        );

      const keep = Math.min(studentLessons.length, newDates.length);

      for (let index = 0; index < keep; index++) {
        const { error } = await supabase
          .from('lessons')
          .update({
            starts_at: newDates[index].toISOString(),
          })
          .eq('id', studentLessons[index].id);

        if (error) {
          setError(error.message);
          return;
        }
      }

      for (const extra of studentLessons.slice(newDates.length)) {
        const { error } = await supabase
          .from('lessons')
          .delete()
          .eq('id', extra.id);

        if (error) {
          setError(error.message);
          return;
        }
      }

      if (newDates.length > studentLessons.length) {
        const rows = newDates.slice(studentLessons.length).map(date => ({
          student_id: studentId,
          teacher_id: seriesLesson.teacher_id,
          instrument_id: seriesLesson.instrument_id,
          series_id: seriesLesson.series_id,
          starts_at: date.toISOString(),
          duration_minutes: 50,
          notes: seriesLesson.notes || null,
        }));

        const { error } = await supabase
          .from('lessons')
          .insert(rows);

        if (error) {
          setError(error.message);
          return;
        }
      }
    }

    const { error: seriesError } = await supabase
      .from('lesson_series')
      .update({
        repeat_until: seriesForm.repeatUntil,
        start_time: seriesForm.time,
        active: true,
      })
      .eq('id', seriesLesson.series_id);

    if (seriesError) {
      setError(seriesError.message);
      return;
    }

    setSeriesLesson(null);
    setSuccess('Série atualizada para todos os alunos.');
    await load();
  }

  async function cancelSeries(targetLesson?: Lesson) {
    const target = targetLesson || seriesLesson;
    if (!target?.series_id) return;

    const confirmed = window.confirm(
      'Cancelar esta série a partir de hoje? As aulas futuras serão removidas e as aulas passadas ficam intactas.'
    );

    if (!confirmed) return;

    setError('');
    setSuccess('');

    const { error: lessonsError } = await supabase
      .from('lessons')
      .delete()
      .eq('series_id', target.series_id)
      .gte('starts_at', new Date().toISOString());

    if (lessonsError) {
      setError(lessonsError.message);
      return;
    }

    const { error: seriesError } = await supabase
      .from('lesson_series')
      .update({ active: false })
      .eq('id', target.series_id);

    if (seriesError) {
      setError(seriesError.message);
      return;
    }

    setSeriesLesson(null);
    setSuccess('Série cancelada a partir de agora.');
    await load();
  }

  const fullAgendaDays = useMemo(() => {
    const groups: Record<string, Lesson[]> = {};

    lessons.forEach(lesson => {
      const key = localDateValue(new Date(lesson.starts_at));

      if (!groups[key]) groups[key] = [];

      groups[key].push(lesson);
    });

    return Object.entries(groups)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, dayLessons]) => ({
        date,
        lessons: dayLessons.sort(
          (a, b) =>
            new Date(a.starts_at).getTime() -
            new Date(b.starts_at).getTime()
        ),
      }));
  }, [lessons]);

  const days = Array.from({ length: 7 }, (_, index) =>
    addDays(monday, index)
  );

  function renderLesson(lesson: Lesson) {
    return (
      <div
        className="lessonCard"
        key={lesson.id}
        style={{
          display: 'grid',
          gap: 4,
          opacity: lesson.status === 'cancelada' ? 0.55 : 1,
        }}
      >
        <b>{fmtTime(lesson.starts_at)}</b>
        <span>{studentName(lesson)}</span>
        <small>Instrumento: {lesson.instrument?.name || 'Não indicado'}</small>

        {role !== 'professor' && (
          <small>Professor: {teacherName(lesson)}</small>
        )}

        {lesson.status !== 'cancelada' &&
          role !== 'aluno_encarregado' && (
            <div
              style={{
                display: 'flex',
                gap: 6,
                flexWrap: 'wrap',
                marginTop: 6,
              }}
            >
              {lesson.series_id && lesson.series?.active && (
                <>
                  <button
                    type="button"
                    className="btn ghost"
                    style={{ padding: '4px 8px', fontSize: 12 }}
                    onClick={() => openSeriesManager(lesson)}
                  >
                    Gerir série
                  </button>

                  <button
                    type="button"
                    className="btn ghost"
                    style={{ padding: '4px 8px', fontSize: 12 }}
                    onClick={() => cancelSeries(lesson)}
                  >
                    Cancelar série
                  </button>
                </>
              )}

              <button
                type="button"
                className="btn ghost"
                style={{ padding: '4px 8px', fontSize: 12 }}
                onClick={() => cancelLesson(lesson)}
              >
                Cancelar aula
              </button>
            </div>
          )}
      </div>
    );
  }

  return (
    <section className="section">
      <div className="agendaToolbar">
        <div>
          <div className="eyebrow">Agenda</div>

          <h2 style={{ margin: '6px 0 4px' }}>
            Semana de {fmtDate(monday)}
          </h2>

          <div className="muted">
            Aulas de 50 minutos ·{' '}
            {role === 'administrador'
              ? 'visão global'
              : role === 'professor'
                ? 'a tua agenda'
                : 'as tuas aulas'}
          </div>
        </div>

        <div className="agendaActions">
          <button className="btn ghost" onClick={() => move(-1)}>
            ←
          </button>

          <button
            className="btn ghost"
            onClick={() => setWeek(startOfWeek(new Date()))}
          >
            Hoje
          </button>

          <button className="btn ghost" onClick={() => move(1)}>
            →
          </button>

          <button
            className="btn ghost"
            onClick={() => setShowFullAgenda(!showFullAgenda)}
          >
            {showFullAgenda ? 'Vista semanal' : 'Agenda completa'}
          </button>

          {role !== 'aluno_encarregado' && (
            <button className="btn primary" onClick={openNew}>
              + Nova aula
            </button>
          )}
        </div>
      </div>

      {error && <div className="error">{error}</div>}
      {success && <div className="success">{success}</div>}

      {showFullAgenda ? (
        <div className="fullAgenda" style={{ display: 'grid', gap: 12 }}>
          {fullAgendaDays.length === 0 && (
            <div className="emptyDay">Sem aulas agendadas.</div>
          )}

          {fullAgendaDays.map(day => (
            <div className="sectionCard" key={day.date}>
              <div className="dayHead" style={{ marginBottom: 8 }}>
                <strong>
                  {new Intl.DateTimeFormat('pt-PT', {
                    weekday: 'long',
                    day: '2-digit',
                    month: '2-digit',
                    year: 'numeric',
                  }).format(new Date(`${day.date}T12:00:00`))}
                </strong>

                <span>
                  {day.lessons.length}{' '}
                  {day.lessons.length === 1 ? 'aula' : 'aulas'}
                </span>
              </div>

              <div style={{ display: 'grid', gap: 8 }}>
                {day.lessons.map(renderLesson)}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="agendaGrid">
          {days.map(date => {
            const dayLessons = weekLessons.filter(lesson => {
              return (
                localDateValue(new Date(lesson.starts_at)) ===
                localDateValue(date)
              );
            });

            return (
              <div className="dayCol" key={localDateValue(date)}>
                <div className="dayHead">
                  <strong>
                    {new Intl.DateTimeFormat('pt-PT', {
                      weekday: 'short',
                    }).format(date)}
                  </strong>

                  <span>
                    {new Intl.DateTimeFormat('pt-PT', {
                      day: '2-digit',
                      month: '2-digit',
                    }).format(date)}
                  </span>
                </div>

                {dayLessons.length
                  ? dayLessons.map(renderLesson)
                  : <div className="emptyDay">Sem aulas</div>}
              </div>
            );
          })}
        </div>
      )}

      {loading && (
        <div className="muted" style={{ marginTop: 12 }}>
          A carregar agenda…
        </div>
      )}

      {showAdd && (
        <div className="modalBackdrop">
          <form className="modalCard" onSubmit={addLesson}>
            <div className="dashHead">
              <div>
                <div className="eyebrow">Nova aula</div>
                <h3 style={{ margin: '6px 0' }}>Agendar aula</h3>
              </div>

              <button
                type="button"
                className="btn ghost"
                onClick={() => setShowAdd(false)}
              >
                Fechar
              </button>
            </div>

            <div className="field">
              <label>Alunos</label>

              <div
                style={{
                  display: 'grid',
                  gap: 8,
                  maxHeight: 220,
                  overflowY: 'auto',
                  padding: 10,
                  border: '1px solid rgba(255,255,255,.12)',
                  borderRadius: 10,
                }}
              >
                {students.map(student => (
                  <label
                    key={student.id}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 8,
                      cursor: 'pointer',
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={form.student_ids.includes(student.id)}
                      onChange={() => toggleStudent(student.id)}
                    />
                    {student.name}
                  </label>
                ))}
              </div>

              <small className="muted">
                Seleciona todos os alunos que vão partilhar o horário.
              </small>

              {form.student_ids.length > 0 && (
                <small className="muted">
                  {form.student_ids.length} aluno(s) selecionado(s).
                </small>
              )}
            </div>

            <div className="field">
              <label>Professor</label>

              <select
                value={form.teacher_id}
                onChange={event =>
                  setForm({ ...form, teacher_id: event.target.value })
                }
                disabled={role === 'professor'}
              >
                <option value="">Selecionar…</option>
                {teachers.map(teacher => (
                  <option key={teacher.id} value={teacher.id}>
                    {teacher.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="field">
              <label>Instrumento</label>

              <select
                value={form.instrument_id}
                onChange={event =>
                  setForm({ ...form, instrument_id: event.target.value })
                }
              >
                <option value="">Selecionar…</option>
                {instruments.map(instrument => (
                  <option key={instrument.id} value={instrument.id}>
                    {instrument.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="field">
              <label>Data</label>

              <input
                type="date"
                value={form.date}
                onChange={event =>
                  setForm({ ...form, date: event.target.value })
                }
              />
            </div>

            <div className="field">
              <label>Hora</label>

              <input
                type="time"
                value={form.time}
                onChange={event =>
                  setForm({ ...form, time: event.target.value })
                }
                step={300}
              />
            </div>

            <div className="field">
              <label
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  cursor: 'pointer',
                }}
              >
                <input
                  type="checkbox"
                  checked={form.repeatWeekly}
                  onChange={event =>
                    setForm({
                      ...form,
                      repeatWeekly: event.target.checked,
                      repeatUntil: event.target.checked
                        ? form.repeatUntil || academicYearEnd(form.date)
                        : form.repeatUntil,
                    })
                  }
                />
                Repetir semanalmente
              </label>
            </div>

            {form.repeatWeekly && (
              <div className="field">
                <label>Repetir até</label>

                <input
                  type="date"
                  value={form.repeatUntil}
                  min={form.date}
                  onChange={event =>
                    setForm({ ...form, repeatUntil: event.target.value })
                  }
                />

                <small className="muted">
                  A série será criada para todos os alunos selecionados.
                </small>
              </div>
            )}

            <div className="field">
              <label>Notas</label>

              <textarea
                rows={3}
                value={form.notes}
                onChange={event =>
                  setForm({ ...form, notes: event.target.value })
                }
              />
            </div>

            <button
              className="btn primary"
              type="submit"
              disabled={saving}
            >
              {saving
                ? 'A guardar…'
                : form.repeatWeekly
                  ? 'Criar série'
                  : 'Criar aula'}
            </button>
          </form>
        </div>
      )}

      {seriesLesson && (
        <div className="modalBackdrop">
          <div className="modalCard">
            <div className="dashHead">
              <div>
                <div className="eyebrow">Série semanal</div>
                <h3 style={{ margin: '6px 0' }}>Gerir aulas seguintes</h3>
              </div>

              <button
                type="button"
                className="btn ghost"
                onClick={() => setSeriesLesson(null)}
              >
                Fechar
              </button>
            </div>

            <div className="muted" style={{ marginBottom: 12 }}>
              As alterações à série aplicam-se aos alunos associados.
            </div>

            <div className="field">
              <label>Hora semanal</label>

              <input
                type="time"
                value={seriesForm.time}
                onChange={event =>
                  setSeriesForm({
                    ...seriesForm,
                    time: event.target.value,
                  })
                }
                step={300}
              />
            </div>

            <div className="field">
              <label>Repetir até</label>

              <input
                type="date"
                value={seriesForm.repeatUntil}
                min={localDateValue(new Date(seriesLesson.starts_at))}
                onChange={event =>
                  setSeriesForm({
                    ...seriesForm,
                    repeatUntil: event.target.value,
                  })
                }
              />
            </div>

            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <button
                className="btn primary"
                type="button"
                onClick={saveSeriesChanges}
              >
                Guardar alterações
              </button>

              <button
                className="btn ghost"
                type="button"
                onClick={() => cancelSeries()}
              >
                Cancelar série
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
