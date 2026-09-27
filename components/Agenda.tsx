'use client';

import { useEffect, useMemo, useState } from 'react';
import { createClient } from '../lib/supabase/client';

type Lesson = {
  id: string;
  student_id: string;
  teacher_id: string;
  instrument_id: string;
  starts_at: string;
  status: string;
  notes: string | null;
  student?: { profile?: { full_name: string } | null; guardian_name?: string | null } | null;
  teacher?: { profile?: { full_name: string } | null } | null;
  instrument?: { name: string } | null;
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
  const [form, setForm] = useState({
    student_id: '',
    teacher_id: '',
    instrument_id: '',
    date: '',
    time: '17:00',
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
        'id,student_id,teacher_id,instrument_id,starts_at,status,notes,student:students(profile:profiles(full_name),guardian_name),teacher:teachers(profile:profiles(full_name)),instrument:instruments(name)'
      )
      .gte('starts_at', monday.toISOString())
      .lt('starts_at', sunday.toISOString())
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
        instrument: Array.isArray(row.instrument) ? row.instrument[0] ?? null : row.instrument
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
  }, [week]);

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

    const end = new Date(starts.getTime() + 50 * 60000);

    const overlap = lessons.find(l => {
      const a = new Date(l.starts_at);
      const b = new Date(a.getTime() + 50 * 60000);
      return starts < b && end > a;
    });

    if (overlap && role === 'administrador') {
      setError('O administrador não pode criar aulas sobrepostas.');
      return;
    }

    const { error } = await supabase.from('lessons').insert({
      student_id: form.student_id,
      teacher_id: form.teacher_id,
      instrument_id: form.instrument_id,
      starts_at: starts.toISOString(),
      duration_minutes: 50,
      notes: form.notes || null
    });

    if (error) {
      setError(error.message);
      return;
    }

    setShowAdd(false);
    setSuccess('Aula criada.');

    try {
      await fetch('/api/notifications/enqueue', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          items: [
            {
              channel: 'email',
              recipient: 'admin@palco21.pt',
              subject: 'Nova aula — Palco 21',
              body: `Foi criada uma aula de 50 minutos para ${starts.toLocaleString('pt-PT')}.`,
              event_type: 'lesson_created'
            }
          ]
        })
      });
    } catch {}

    await load();
  }

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
          {role !== 'aluno_encarregado' && (
            <button className="btn primary" onClick={openNew}>+ Nova aula</button>
          )}
        </div>
      </div>

      {error && <div className="error">{error}</div>}
      {success && <div className="success">{success}</div>}

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
                <div className="lessonCard" key={l.id}>
                  <b>{fmtTime(l.starts_at)}</b>
                  <span>{l.student?.profile?.full_name || 'Aluno'}</span>
                  <small>
                    {l.instrument?.name || 'Instrumento'} · {l.teacher?.profile?.full_name || 'Professor'}
                  </small>
                  <em>{l.status}</em>
                </div>
              ))}

            {!weekLessons.some(l => {
              const x = new Date(l.starts_at);
              return x.getDate() === d.getDate() && x.getMonth() === d.getMonth();
            }) && <div className="emptyDay">Sem aulas</div>}
          </div>
        ))}
      </div>

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
              <label>Notas</label>
              <textarea
                rows={3}
                value={form.notes}
                onChange={e => setForm({ ...form, notes: e.target.value })}
              />
            </div>

            <button className="btn primary" type="submit">Criar aula</button>
          </form>
        </div>
      )}
    </section>
  );
}
