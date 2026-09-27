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
  student?: { profile?: { full_name: string } | null; guardian_name?: string | null } | null;
  teacher?: { profile?: { full_name: string } | null } | null;
  instrument?: { name: string } | null;
  series?: { repeat_until: string; active: boolean; start_time: string | null } | null;
};

type Option = { id: string; name: string };

const pad = (n: number) => String(n).padStart(2, '0');

function startOfWeek(d: Date) {
  const x = new Date(d);
  const day = x.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  x.setDate(x.getDate() + diff);
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
    year: 'numeric'
  }).format(d);
}

function fmtTime(s: string) {
  return new Intl.DateTimeFormat('pt-PT', {
    hour: '2-digit',
    minute: '2-digit'
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
  const year = d.getMonth() >= 8 ? d.getFullYear() + 1 : d.getFullYear();
  return `${year}-07-31`;
}

function formatDateTimeForInput(d: Date) {
  return `${localDateValue(d)} ${localTimeValue(d)}`;
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
  const [seriesLesson, setSeriesLesson] = useState<Lesson | null>(null);
  const [seriesForm, setSeriesForm] = useState({ time: '17:00', repeatUntil: '' });
  const [form, setForm] = useState({
    student_id: '',
    teacher_id: '',
    instrument_id: '',
    date: '',
    time: '17:00',
    repeatWeekly: false,
    repeatUntil: '',
    notes: ''
  });

  const monday = week;
  const sunday = addDays(monday, 7);

  const weekLessons = useMemo(
    () =>
      lessons.filter(l => {
        const t = new Date(l.starts_at);
        return t >= monday && t < sunday;
      }),
    [lessons, monday, sunday]
  );

  async function load() {
    setLoading(true);
    setError('');

    const {
      data: { user }
    } = await supabase.auth.getUser();

    if (!user) {
      setLoading(false);
      return;
    }

    const { data, error } = await supabase
      .from('lessons')
      .select(
        'id,student_id,teacher_id,instrument_id,series_id,starts_at,status,notes,student:students(profile:profiles(full_name),guardian_name),teacher:teachers(profile:profiles(full_name)),instrument:instruments(name),series:lesson_series(repeat_until,active,start_time)'
      )
      .gte('starts_at', monday.toISOString())
      .lt(
        'starts_at',
        (showFullAgenda
          ? new Date(`${academicYearEnd(localDateValue(monday))}T23:59:59.999`)
          : sunday
        ).toISOString()
      )
      .order('starts_at');

    if (error) {
      setError(error.message);
      setLoading(false);
      return;
    }

    setLessons(
      (data || []).map((row: any) => ({
        ...row,
        student: Array.isArray(row.student) ? row.student[0] ?? null : row.student,
        teacher: Array.isArray(row.teacher) ? row.teacher[0] ?? null : row.teacher,
        instrument: Array.isArray(row.instrument) ? row.instrument[0] ?? null : row.instrument,
        series: Array.isArray(row.series) ? row.series[0] ?? null : row.series
      })) as Lesson[]
    );

    const [s, t, i] = await Promise.all([
      supabase
        .from('students')
        .select('id,full_name,profile_id')
        .eq('status', 'ativo')
        .order('full_name'),
      supabase
        .from('teachers')
        .select('id,profile_id,specialty,active')
        .eq('active', true),
      supabase
        .from('instruments')
        .select('id,name')
        .order('name')
    ]);

    if (s.error) {
      setError(`Alunos: ${s.error.message}`);
      setLoading(false);
      return;
    }

    if (t.error) {
      setError(`Professores: ${t.error.message}`);
      setLoading(false);
      return;
    }

    if (i.error) {
      setError(`Instrumentos: ${i.error.message}`);
      setLoading(false);
      return;
    }

    const studentProfileIds = (s.data || [])
      .map((x: any) => x.profile_id)
      .filter(Boolean);

    const teacherProfileIds = (t.data || [])
      .map((x: any) => x.profile_id)
      .filter(Boolean);

    const allProfileIds = Array.from(new Set([...studentProfileIds, ...teacherProfileIds]));

    let profiles: Record<string, string> = {};

    if (allProfileIds.length) {
      const { data: profileRows, error: profilesError } = await supabase
        .from('profiles')
        .select('id,full_name')
        .in('id', allProfileIds);

      if (profilesError) {
        setError(`Perfis: ${profilesError.message}`);
        setLoading(false);
        return;
      }

      profiles = Object.fromEntries(
        (profileRows || []).map((p: any) => [p.id, p.full_name])
      );
    }

    setStudents(
      (s.data || []).map((x: any) => ({
        id: x.id,
        name: x.full_name || profiles[x.profile_id] || 'Sem nome'
      }))
    );

    const loadedTeachers = (t.data || []).map((x: any) => ({
      id: x.id,
      name: profiles[x.profile_id] || 'Sem nome',
      profile_id: x.profile_id
    }));

    setTeachers(
      role === 'professor'
        ? loadedTeachers.filter((x: any) => x.profile_id === user.id).map(({ id, name }: any) => ({ id, name }))
        : loadedTeachers.map(({ id, name }: any) => ({ id, name }))
    );

    setInstruments((i.data || []) as Option[]);
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, [week, showFullAgenda]);

  function move(n: number) {
    setWeek(addDays(week, n * 7));
  }

  function openNew() {
    setSuccess('');
    setError('');

    const d = addDays(monday, 0);
    d.setHours(17, 0, 0, 0);

    setForm({
      student_id: '',
      teacher_id: '',
      instrument_id: '',
      date: localDateValue(d),
      time: localTimeValue(d),
      repeatWeekly: false,
      repeatUntil: academicYearEnd(localDateValue(d)),
      notes: ''
    });

    setShowAdd(true);
  }

  async function addLesson(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (!form.student_id || !form.teacher_id || !form.instrument_id || !form.date || !form.time) {
      setError('Preenche aluno, professor, instrumento, data e hora.');
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
        setError('A data final da repetição tem de ser igual ou posterior à primeira aula.');
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

    // Pre-check conflicts against currently loaded week, plus DB conflicts for recurring series.
    if (role === 'administrador') {
      const first = occurrences[0];
      const last = occurrences[occurrences.length - 1];
      const { data: existing, error: existingError } = await supabase
        .from('lessons')
        .select('id,starts_at,teacher_id')
        .gte('starts_at', first.toISOString())
        .lt('starts_at', new Date(last.getTime() + 50 * 60000).toISOString());

      if (existingError) {
        setError(existingError.message);
        return;
      }

      for (const occurrence of occurrences) {
        const end = new Date(occurrence.getTime() + 50 * 60000);
        const overlap = (existing || []).some((row: any) => {
          const a = new Date(row.starts_at);
          const b = new Date(a.getTime() + 50 * 60000);
          return occurrence < b && end > a;
        });
        if (overlap) {
          setError(`Existe uma aula sobreposta em ${occurrence.toLocaleString('pt-PT')}. A série não foi criada.`);
          return;
        }
      }
    }

    let seriesId: string | null = null;

    if (form.repeatWeekly) {
      const { data: series, error: seriesError } = await supabase
        .from('lesson_series')
        .insert({
          student_id: form.student_id,
          teacher_id: form.teacher_id,
          instrument_id: form.instrument_id,
          first_starts_at: starts.toISOString(),
          start_time: form.time,
          weekday: starts.getDay() === 0 ? 7 : starts.getDay(),
          repeat_until: form.repeatUntil,
          active: true
        })
        .select('id')
        .single();

      if (seriesError || !series) {
        setError(seriesError?.message || 'Não foi possível criar a série.');
        return;
      }
      seriesId = series.id;
    }

    const rows = occurrences.map(occurrence => ({
      student_id: form.student_id,
      teacher_id: form.teacher_id,
      instrument_id: form.instrument_id,
      series_id: seriesId,
      starts_at: occurrence.toISOString(),
      duration_minutes: 50,
      notes: form.notes || null
    }));

    const { error } = await supabase.from('lessons').insert(rows);

    if (error) {
      if (seriesId) await supabase.from('lesson_series').delete().eq('id', seriesId);
      setError(error.message);
      return;
    }

    setShowAdd(false);
    setSuccess(
      rows.length === 1
        ? 'Aula criada.'
        : `${rows.length} aulas semanais criadas, até ${form.repeatUntil}.`
    );

    try {
      await fetch('/api/notifications/enqueue', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          items: [{
            channel: 'email',
            recipient: 'admin@palco21.pt',
            subject: rows.length === 1 ? 'Nova aula — Palco 21' : 'Série semanal — Palco 21',
            body: rows.length === 1
              ? `Foi criada uma aula de 50 minutos para ${starts.toLocaleString('pt-PT')}.`
              : `Foi criada uma série semanal de ${rows.length} aulas, a partir de ${starts.toLocaleString('pt-PT')}.`,
            event_type: 'lesson_created'
          }]
        })
      });
    } catch {}

    await load();
  }

  async function cancelLesson(lesson: Lesson) {
    if (lesson.status === 'cancelada') return;

    const name = lesson.student?.profile?.full_name || 'esta aula';
    const when = new Date(lesson.starts_at).toLocaleString('pt-PT');
    const ok = window.confirm(`Cancelar a aula de ${name} em ${when}?`);

    if (!ok) return;

    setError('');
    setSuccess('');

    const { error } = await supabase
      .from('lessons')
      .update({ status: 'cancelada' })
      .eq('id', lesson.id);

    if (error) {
      setError(error.message);
      return;
    }

    setSuccess('Aula cancelada.');
    await load();
  }

  function openSeriesManager(lesson: Lesson) {
    if (!lesson.series_id || !lesson.series) return;
    const d = new Date(lesson.starts_at);
    setSeriesLesson(lesson);
    setSeriesForm({
      time: localTimeValue(d),
      repeatUntil: lesson.series.repeat_until
    });
    setError('');
    setSuccess('');
  }

  async function saveSeriesChanges() {
    if (!seriesLesson?.series_id || !seriesLesson.series) return;
    setError('');
    setSuccess('');

    const current = new Date(seriesLesson.starts_at);
    const newTime = seriesForm.time;
    const until = localDateTimeToDate(seriesForm.repeatUntil, newTime);

    if (Number.isNaN(until.getTime()) || until < current) {
      setError('A data final da série é inválida.');
      return;
    }

    const { data: futureLessons, error: futureError } = await supabase
      .from('lessons')
      .select('id,starts_at,status')
      .eq('series_id', seriesLesson.series_id)
      .gte('starts_at', current.toISOString())
      .order('starts_at');

    if (futureError) {
      setError(futureError.message);
      return;
    }

    const future = futureLessons || [];
    const newDates: Date[] = [];
    let cursor = new Date(current);
    while (cursor <= until) {
      const next = localDateTimeToDate(localDateValue(cursor), newTime);
      if (next >= current) newDates.push(next);
      cursor = addDays(cursor, 7);
      if (newDates.length > 60) {
        setError('A série excede o limite de 60 ocorrências.');
        return;
      }
    }

    // Check other lessons before applying the change.
    if (role === 'administrador') {
      const { data: others, error: othersError } = await supabase
        .from('lessons')
        .select('id,starts_at')
        .neq('series_id', seriesLesson.series_id)
        .gte('starts_at', current.toISOString())
        .lt('starts_at', new Date(until.getTime() + 50 * 60000).toISOString());
      if (othersError) {
        setError(othersError.message);
        return;
      }
      for (const d of newDates) {
        const end = new Date(d.getTime() + 50 * 60000);
        const conflict = (others || []).some((row: any) => {
          const a = new Date(row.starts_at);
          const b = new Date(a.getTime() + 50 * 60000);
          return d < b && end > a;
        });
        if (conflict) {
          setError(`Existe conflito em ${d.toLocaleString('pt-PT')}. A série não foi alterada.`);
          return;
        }
      }
    }

    // Update current/future lessons that remain in the series.
    const agendadas = future.filter((x: any) => x.status === 'agendada');
    const keep = Math.min(agendadas.length, newDates.length);

    for (let i = 0; i < keep; i++) {
      const { error } = await supabase
        .from('lessons')
        .update({ starts_at: newDates[i].toISOString() })
        .eq('id', agendadas[i].id);
      if (error) {
        setError(error.message);
        return;
      }
    }

    // Cancel extra old occurrences if the new end date is shorter.
    if (agendadas.length > newDates.length) {
      const extra = agendadas.slice(newDates.length);
      for (const row of extra) {
        const { error } = await supabase
          .from('lessons')
          .update({ status: 'cancelada' })
          .eq('id', row.id);
        if (error) {
          setError(error.message);
          return;
        }
      }
    }

    // Create extra occurrences if the new end date is longer.
    if (newDates.length > agendadas.length) {
      const rows = newDates.slice(agendadas.length).map(d => ({
        student_id: seriesLesson.student_id,
        teacher_id: seriesLesson.teacher_id,
        instrument_id: seriesLesson.instrument_id,
        series_id: seriesLesson.series_id,
        starts_at: d.toISOString(),
        duration_minutes: 50,
        notes: seriesLesson.notes || null
      }));
      const { error } = await supabase.from('lessons').insert(rows);
      if (error) {
        setError(error.message);
        return;
      }
    }

    const { error: seriesError } = await supabase
      .from('lesson_series')
      .update({ repeat_until: seriesForm.repeatUntil, start_time: newTime, active: true })
      .eq('id', seriesLesson.series_id);

    if (seriesError) {
      setError(seriesError.message);
      return;
    }

    setSeriesLesson(null);
    setSuccess('Série atualizada.');
    await load();
  }

  async function cancelSeries(targetLesson?: Lesson) {
    const target = targetLesson || seriesLesson;
    if (!target?.series_id) return;

    const ok = window.confirm(
      'Cancelar esta série a partir de hoje? As aulas futuras serão canceladas e as aulas já realizadas ficam intactas.'
    );
    if (!ok) return;

    setError('');
    setSuccess('');

    const { error: lessonsError } = await supabase
      .from('lessons')
      .update({ status: 'cancelada' })
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
      const d = new Date(lesson.starts_at);
      const key = localDateValue(d);
      if (!groups[key]) groups[key] = [];
      groups[key].push(lesson);
    });

    return Object.entries(groups)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, dayLessons]) => ({
        date,
        lessons: dayLessons.sort(
          (a, b) => new Date(a.starts_at).getTime() - new Date(b.starts_at).getTime()
        )
      }));
  }, [lessons]);

  const days = Array.from({ length: 7 }, (_, i) => addDays(monday, i));

  return (
    <section className="section">
      <div className="agendaToolbar">
        <div>
          <div className="eyebrow">Agenda</div>
          <h2 style={{ margin: '6px 0 4px' }}>Semana de {fmtDate(monday)}</h2>
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
          <button className="btn ghost" onClick={() => move(-1)}>←</button>
          <button className="btn ghost" onClick={() => setWeek(startOfWeek(new Date()))}>Hoje</button>
          <button className="btn ghost" onClick={() => move(1)}>→</button>
          <button className="btn ghost" onClick={() => setShowFullAgenda(!showFullAgenda)}>
            {showFullAgenda ? 'Vista semanal' : 'Agenda completa'}
          </button>
          {role !== 'aluno_encarregado' && (
            <button className="btn primary" onClick={openNew}>+ Nova aula</button>
          )}
        </div>
      </div>

      {error && <div className="error">{error}</div>}
      {success && <div className="success">{success}</div>}

      {showFullAgenda ? (
        <div className="fullAgenda" style={{ display: 'grid', gap: 12 }}>
          {fullAgendaDays.length === 0 && <div className="emptyDay">Sem aulas agendadas.</div>}

          {fullAgendaDays.map(day => (
            <div className="sectionCard" key={day.date}>
              <div className="dayHead" style={{ marginBottom: 8 }}>
                <strong>
                  {new Intl.DateTimeFormat('pt-PT', {
                    weekday: 'long',
                    day: '2-digit',
                    month: '2-digit',
                    year: 'numeric'
                  }).format(new Date(`${day.date}T12:00:00`))}
                </strong>
                <span>{day.lessons.length} {day.lessons.length === 1 ? 'aula' : 'aulas'}</span>
              </div>

              <div style={{ display: 'grid', gap: 8 }}>
                {day.lessons.map(l => (
                  <div
                    className="lessonCard"
                    key={l.id}
                    style={{ display: 'grid', gap: 3, opacity: l.status === 'cancelada' ? 0.55 : 1 }}
                  >
                    <b>{fmtTime(l.starts_at)}</b>
                    <span>{l.student?.profile?.full_name || 'Aluno'}</span>
                    <small>
                      {l.instrument?.name || 'Instrumento'} · {l.teacher?.profile?.full_name || 'Professor'}
                    </small>
                    <em>{l.status}</em>

                    {l.status !== 'cancelada' && role !== 'aluno_encarregado' && (
                      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 6 }}>
                        {l.series_id && l.series?.active && (
                          <>
                            <button
                              type="button"
                              className="btn ghost"
                              style={{ padding: '4px 8px', fontSize: 12 }}
                              onClick={() => openSeriesManager(l)}
                            >
                              Gerir série
                            </button>
                            <button
                              type="button"
                              className="btn ghost"
                              style={{ padding: '4px 8px', fontSize: 12 }}
                              onClick={() => cancelSeries(l)}
                            >
                              Cancelar série
                            </button>
                          </>
                        )}
                        <button
                          type="button"
                          className="btn ghost"
                          style={{ padding: '4px 8px', fontSize: 12 }}
                          onClick={() => cancelLesson(l)}
                        >
                          Cancelar aula
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="agendaGrid">
          {days.map(d => (
            <div className="dayCol" key={d.toISOString()}>
              <div className="dayHead">
                <strong>{new Intl.DateTimeFormat('pt-PT', { weekday: 'short' }).format(d)}</strong>
                <span>{new Intl.DateTimeFormat('pt-PT', { day: '2-digit', month: '2-digit' }).format(d)}</span>
              </div>

              {weekLessons
                .filter(l => {
                  const x = new Date(l.starts_at);
                  return x.getDate() === d.getDate() && x.getMonth() === d.getMonth();
                })
                .map(l => (
                  <div className="lessonCard" key={l.id} style={{ opacity: l.status === 'cancelada' ? 0.55 : 1 }}>
                    <b>{fmtTime(l.starts_at)}</b>
                    <span>{l.student?.profile?.full_name || 'Aluno'}</span>
                    <small>
                      {l.instrument?.name || 'Instrumento'} · {l.teacher?.profile?.full_name || 'Professor'}
                    </small>
                    <em>{l.status}</em>

                    {l.status !== 'cancelada' && role !== 'aluno_encarregado' && (
                      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 6 }}>
                        {l.series_id && l.series?.active && (
                          <>
                            <button
                              type="button"
                              className="btn ghost"
                              style={{ padding: '4px 8px', fontSize: 12 }}
                              onClick={() => openSeriesManager(l)}
                            >
                              Gerir série
                            </button>
                            <button
                              type="button"
                              className="btn ghost"
                              style={{ padding: '4px 8px', fontSize: 12 }}
                              onClick={() => cancelSeries(l)}
                            >
                              Cancelar série
                            </button>
                          </>
                        )}
                        <button
                          type="button"
                          className="btn ghost"
                          style={{ padding: '4px 8px', fontSize: 12 }}
                          onClick={() => cancelLesson(l)}
                        >
                          Cancelar aula
                        </button>
                      </div>
                    )}
                  </div>
                ))}

              {!weekLessons.some(l => {
                const x = new Date(l.starts_at);
                return x.getDate() === d.getDate() && x.getMonth() === d.getMonth();
              }) && <div className="emptyDay">Sem aulas</div>}
            </div>
          ))}
        </div>
      )}

      {loading && <div className="muted" style={{ marginTop: 12 }}>A carregar…</div>}

      {showAdd && (
        <div className="modalBackdrop">
          <form className="modalCard" onSubmit={addLesson}>
            <div className="dashHead">
              <div>
                <div className="eyebrow">Nova aula</div>
                <h3 style={{ margin: '6px 0' }}>Agendar aula</h3>
              </div>
              <button type="button" className="btn ghost" onClick={() => setShowAdd(false)}>
                Fechar
              </button>
            </div>

            <div className="field">
              <label>Aluno</label>
              <select
                value={form.student_id}
                onChange={e => setForm({ ...form, student_id: e.target.value })}
              >
                <option value="">Selecionar…</option>
                {students.map(o => <option key={o.id} value={o.id}>{o.name}</option>)}
              </select>
            </div>

            <div className="field">
              <label>Professor</label>
              <select
                value={form.teacher_id}
                onChange={e => setForm({ ...form, teacher_id: e.target.value })}
              >
                <option value="">Selecionar…</option>
                {teachers.map(o => <option key={o.id} value={o.id}>{o.name}</option>)}
              </select>
            </div>

            <div className="field">
              <label>Instrumento</label>
              <select
                value={form.instrument_id}
                onChange={e => setForm({ ...form, instrument_id: e.target.value })}
              >
                <option value="">Selecionar…</option>
                {instruments.map(o => <option key={o.id} value={o.id}>{o.name}</option>)}
              </select>
            </div>

            <div className="field">
              <label>Data</label>
              <input
                type="date"
                value={form.date}
                onChange={e => setForm({ ...form, date: e.target.value })}
              />
            </div>

            <div className="field">
              <label>Hora</label>
              <input
                type="time"
                value={form.time}
                onChange={e => setForm({ ...form, time: e.target.value })}
                step={300}
              />
            </div>

            <div className="field">
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={form.repeatWeekly}
                  onChange={e =>
                    setForm({
                      ...form,
                      repeatWeekly: e.target.checked,
                      repeatUntil: e.target.checked
                        ? form.repeatUntil || academicYearEnd(form.date)
                        : form.repeatUntil
                    })
                  }
                />
                Repetir semanalmente até julho
              </label>
            </div>

            {form.repeatWeekly && (
              <div className="field">
                <label>Repetir até</label>
                <input
                  type="date"
                  value={form.repeatUntil}
                  min={form.date}
                  onChange={e => setForm({ ...form, repeatUntil: e.target.value })}
                />
                <small className="muted">
                  Por defeito, fica até 31 de julho do ano letivo. Tu ou o professor podem alterar ou cancelar a série mais tarde.
                </small>
              </div>
            )}

            <div className="field">
              <label>Notas</label>
              <textarea
                rows={3}
                value={form.notes}
                onChange={e => setForm({ ...form, notes: e.target.value })}
              />
            </div>

            <button className="btn primary" type="submit">{form.repeatWeekly ? 'Criar série' : 'Criar aula'}</button>
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
            <button type="button" className="btn ghost" onClick={() => setSeriesLesson(null)}>Fechar</button>
          </div>

          <div className="muted" style={{ marginBottom: 12 }}>
            Altera a hora ou prolonga/encurta a série. O passado mantém-se intacto.
          </div>

          <div className="field">
            <label>Hora semanal</label>
            <input
              type="time"
              value={seriesForm.time}
              onChange={e => setSeriesForm({ ...seriesForm, time: e.target.value })}
              step={300}
            />
          </div>

          <div className="field">
            <label>Repetir até</label>
            <input
              type="date"
              value={seriesForm.repeatUntil}
              min={localDateValue(new Date(seriesLesson.starts_at))}
              onChange={e => setSeriesForm({ ...seriesForm, repeatUntil: e.target.value })}
            />
          </div>

          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <button className="btn primary" type="button" onClick={saveSeriesChanges}>Guardar alterações</button>
            <button className="btn ghost" type="button" onClick={() => cancelSeries()}>Cancelar série</button>
          </div>
        </div>
      </div>
    )}
    </section>
  );
}

