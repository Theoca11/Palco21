'use client';

import { useEffect, useMemo, useState } from 'react';
import { createClient } from '../lib/supabase/client';

type Teacher = {
  id: string;
  profile_id: string | null;
  name: string;
};

type LessonRow = {
  id: string;
  starts_at: string;
  status: string;
  student_id: string;
  teacher_id: string;
  instrument_id: string;
  student?: {
    full_name: string | null;
    profile_id: string | null;
  } | null;
  teacher?: {
    profile_id: string | null;
  } | null;
  instrument?: {
    name: string;
  } | null;
};

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

function localDateValue(d: Date) {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function mondayFromInput(value: string) {
  return startOfWeek(new Date(`${value}T12:00:00`));
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

function fmtDateTime(s: string) {
  return new Intl.DateTimeFormat('pt-PT', {
    dateStyle: 'short',
    timeStyle: 'short'
  }).format(new Date(s));
}

function escapeHtml(value: unknown) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function openPrintWindow(title: string, body: string) {
  const w = window.open('', '_blank', 'width=1000,height=800');

  if (!w) return false;

  w.document.write(`
    <!doctype html>
    <html lang="pt-PT">
      <head>
        <meta charset="utf-8">
        <title>${escapeHtml(title)}</title>

        <style>
          @page {
            size: A4;
            margin: 12mm;
          }

          * {
            box-sizing: border-box;
          }

          body {
            font-family: Arial, Helvetica, sans-serif;
            color: #111;
            margin: 0;
            font-size: 11px;
          }

          h1 {
            font-size: 20px;
            margin: 0 0 4px;
          }

          h2 {
            font-size: 14px;
            margin: 18px 0 7px;
          }

          .meta {
            color: #555;
            font-size: 10px;
            margin-bottom: 14px;
          }

          table {
            width: 100%;
            border-collapse: collapse;
            margin-top: 8px;
          }

          th,
          td {
            border: 1px solid #bbb;
            padding: 6px 7px;
            text-align: left;
            vertical-align: top;
          }

          th {
            background: #eee;
            font-weight: 700;
          }

          .footer {
            margin-top: 14px;
            color: #666;
            font-size: 9px;
          }

          @media print {
            button {
              display: none !important;
            }
          }
        </style>
      </head>

      <body>
        ${body}

        <script>
          window.onload = () => {
            setTimeout(() => window.print(), 250);
          };
        </script>
      </body>
    </html>
  `);

  w.document.close();

  return true;
}

function xmlEscape(value: unknown) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&apos;');
}

function xmlCell(value: unknown) {
  return `<Cell><Data ss:Type="String">${xmlEscape(value)}</Data></Cell>`;
}

function xmlSheet(
  name: string,
  rows: Record<string, unknown>[]
) {
  const safeRows = rows.length ? rows : [{}];

  const keys = Array.from(
    new Set(safeRows.flatMap(row => Object.keys(row)))
  );

  const header =
    `<Row>${keys.map(xmlCell).join('')}</Row>`;

  const data = safeRows
    .map(row =>
      `<Row>${keys
        .map(key => xmlCell(row[key]))
        .join('')}</Row>`
    )
    .join('');

  return `
    <Worksheet ss:Name="${xmlEscape(name.slice(0, 31))}">
      <Table>
        ${header}
        ${data}
      </Table>
    </Worksheet>
  `;
}

function makeExcelXml(
  sheets: {
    name: string;
    rows: Record<string, unknown>[];
  }[]
) {
  const created = new Date().toISOString();

  const info = {
    exportado_em: created,
    tipo: 'Backup Palco 21',
    nota: 'Não inclui palavras-passe nem credenciais do Supabase Auth.'
  };

  return `<?xml version="1.0"?>

<?mso-application progid="Excel.Sheet"?>

<Workbook
  xmlns="urn:schemas-microsoft-com:office:spreadsheet"
  xmlns:o="urn:schemas-microsoft-com:office:office"
  xmlns:x="urn:schemas-microsoft-com:office:excel"
  xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet">

  <Styles>
    <Style ss:ID="Default" ss:Name="Normal">
      <Font ss:FontName="Aptos" ss:Size="10"/>
    </Style>
  </Styles>

  ${xmlSheet('backup_info', [info])}

  ${sheets
    .map(sheet =>
      xmlSheet(sheet.name, sheet.rows)
    )
    .join('')}

</Workbook>`;
}

async function fetchProfilesMap(
  supabase: ReturnType<typeof createClient>,
  ids: string[]
) {
  const filtered = Array.from(
    new Set(ids.filter(Boolean))
  );

  if (!filtered.length) {
    return {} as Record<string, string>;
  }

  const {
    data,
    error
  } = await supabase
    .from('profiles')
    .select('id,full_name')
    .in('id', filtered);

  if (error) {
    throw new Error(`Perfis: ${error.message}`);
  }

  return Object.fromEntries(
    (data || []).map((p: any) => [
      p.id,
      p.full_name || 'Sem nome'
    ])
  ) as Record<string, string>;
}

export function Relatorios({ role }: { role: string }) {
  const admin = role === 'administrador';
  const supabase = createClient();

  const [weekStart, setWeekStart] = useState(
    localDateValue(startOfWeek(new Date()))
  );

  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [selectedTeacher, setSelectedTeacher] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const weekMonday = useMemo(
    () => mondayFromInput(weekStart),
    [weekStart]
  );

  const weekSunday = useMemo(
    () => addDays(weekMonday, 7),
    [weekMonday]
  );

  useEffect(() => {
    if (!admin) return;

    (async () => {
      const {
        data: teacherRows,
        error: teacherError
      } = await supabase
        .from('teachers')
        .select('id,profile_id')
        .eq('active', true);

      if (teacherError) {
        setError(teacherError.message);
        return;
      }

      const names = await fetchProfilesMap(
        supabase,
        (teacherRows || []).map(
          (teacher: any) => teacher.profile_id
        )
      );

      const loaded = (teacherRows || []).map(
        (teacher: any) => ({
          id: teacher.id,
          profile_id: teacher.profile_id,
          name:
            names[teacher.profile_id] ||
            'Sem nome'
        })
      );

      setTeachers(loaded);

      if (!selectedTeacher && loaded[0]) {
        setSelectedTeacher(loaded[0].id);
      }
    })().catch(errorValue => {
      setError(
        errorValue?.message ||
        'Erro ao carregar professores.'
      );
    });
  }, [admin]);

  if (!admin) {
    return null;
  }

  async function fetchWeekLessons() {
    const {
      data,
      error: lessonError
    } = await supabase
      .from('lessons')
      .select(`
        id,
        starts_at,
        status,
        student_id,
        teacher_id,
        instrument_id,
        student:students(
          full_name,
          profile_id
        ),
        teacher:teachers(
          profile_id
        ),
        instrument:instruments(
          name
        )
      `)
      .gte(
        'starts_at',
        weekMonday.toISOString()
      )
      .lt(
        'starts_at',
        weekSunday.toISOString()
      )
      .order('starts_at');

    if (lessonError) {
      throw new Error(
        `Aulas: ${lessonError.message}`
      );
    }

    const rows = (data || []).map(
      (row: any) => ({
        ...row,

        student: Array.isArray(row.student)
          ? row.student[0] ?? null
          : row.student,

        teacher: Array.isArray(row.teacher)
          ? row.teacher[0] ?? null
          : row.teacher,

        instrument: Array.isArray(row.instrument)
          ? row.instrument[0] ?? null
          : row.instrument
      })
    ) as LessonRow[];

    const teacherIds = rows
      .map(row =>
        row.teacher?.profile_id || ''
      )
      .filter(Boolean);

    const studentIds = rows
      .map(row =>
        row.student?.profile_id || ''
      )
      .filter(Boolean);

    const profileMap =
      await fetchProfilesMap(
        supabase,
        [...teacherIds, ...studentIds]
      );

    return {
      rows,
      profileMap
    };
  }

  async function printWeekly(
    kind: 'teacher' | 'general'
  ) {
    try {
      setError('');
      setMessage('A preparar impressão…');
      setLoading(true);

      const {
        rows,
        profileMap
      } = await fetchWeekLessons();

      if (
        kind === 'teacher' &&
        !selectedTeacher
      ) {
        throw new Error(
          'Escolhe um professor.'
        );
      }

      const filtered =
        kind === 'teacher'
          ? rows.filter(
              row =>
                row.teacher_id ===
                selectedTeacher
            )
          : rows;

      const group =
        new Map<string, LessonRow[]>();

      for (const row of filtered) {
        const key = localDateValue(
          new Date(row.starts_at)
        );

        if (!group.has(key)) {
          group.set(key, []);
        }

        group
          .get(key)!
          .push(row);
      }

      const teacherName =
        teachers.find(
          teacher =>
            teacher.id ===
            selectedTeacher
        )?.name || 'Professor';

      let html = `
        <h1>
          ${
            kind === 'teacher'
              ? `Aulas semanais — ${escapeHtml(
                  teacherName
                )}`
              : 'Aulas semanais — geral'
          }
        </h1>
      `;

      html += `
        <div class="meta">
          Semana de ${escapeHtml(
            fmtDate(weekMonday)
          )}
          a
          ${escapeHtml(
            fmtDate(
              addDays(weekMonday, 6)
            )
          )}
          · Gerado em
          ${escapeHtml(
            fmtDateTime(
              new Date().toISOString()
            )
          )}
        </div>
      `;

      if (!filtered.length) {
        html +=
          '<p>Não existem aulas nesta semana.</p>';
      } else {
        for (
          const [date, items]
          of Array.from(group.entries()).sort()
        ) {
          const day =
            new Date(`${date}T12:00:00`);

          html += `
            <h2>
              ${escapeHtml(
                new Intl.DateTimeFormat(
                  'pt-PT',
                  {
                    weekday: 'long',
                    day: '2-digit',
                    month: '2-digit'
                  }
                ).format(day)
              )}
            </h2>
          `;

          html += `
            <table>
              <thead>
                <tr>
                  ${
                    kind === 'general'
                      ? '<th>Professor</th>'
                      : ''
                  }
                  <th>Hora</th>
                  <th>Aluno</th>
                  <th>Instrumento</th>
                  <th>Estado</th>
                </tr>
              </thead>
              <tbody>
          `;

          for (
            const row
            of items.sort(
              (a, b) =>
                new Date(
                  a.starts_at
                ).getTime() -
                new Date(
                  b.starts_at
                ).getTime()
            )
          ) {
            const studentName =
              row.student?.full_name ||
              (
                row.student?.profile_id
                  ? profileMap[
                      row.student.profile_id
                    ]
                  : ''
              ) ||
              'Aluno';

            const teacherNameForRow =
              row.teacher?.profile_id
                ? profileMap[
                    row.teacher.profile_id
                  ]
                : 'Professor';

            html += `
              <tr>
                ${
                  kind === 'general'
                    ? `<td>${escapeHtml(
                        teacherNameForRow
                      )}</td>`
                    : ''
                }

                <td>
                  ${escapeHtml(
                    fmtTime(
                      row.starts_at
                    )
                  )}
                </td>

                <td>
                  ${escapeHtml(
                    studentName
                  )}
                </td>

                <td>
                  ${escapeHtml(
                    row.instrument?.name ||
                    '—'
                  )}
                </td>

                <td>
                  ${escapeHtml(
                    row.status
                  )}
                </td>
              </tr>
            `;
          }

          html += `
              </tbody>
            </table>
          `;
        }
      }

      html +=
        '<div class="footer">Palco 21 · documento de impressão</div>';

      const opened =
        openPrintWindow(
          kind === 'teacher'
            ? `Aulas — ${teacherName}`
            : 'Aulas semanais — geral',
          html
        );

      if (!opened) {
        throw new Error(
          'O navegador bloqueou a janela de impressão. Permite pop-ups para o Palco 21.'
        );
      }

      setMessage(
        'Documento de impressão aberto.'
      );
    } catch (errorValue: any) {
      setError(
        errorValue?.message ||
        'Não foi possível preparar a impressão.'
      );
    } finally {
      setLoading(false);
    }
  }

  async function printStudents() {
    try {
      setError('');
      setMessage(
        'A preparar lista de alunos…'
      );
      setLoading(true);

      const {
        data: students,
        error: studentError
      } = await supabase
        .from('students')
        .select(`
          id,
          full_name,
          profile_id,
          email,
          phone,
          guardian_name,
          guardian_phone,
          guardian_email,
          status,
          important_notes,
          student_instruments(
            instrument:instruments(
              name
            )
          )
        `)
        .order('full_name');

      if (studentError) {
        throw new Error(
          `Alunos: ${studentError.message}`
        );
      }

      const profileMap =
        await fetchProfilesMap(
          supabase,
          (students || []).map(
            (student: any) =>
              student.profile_id
          )
        );

      let html =
        '<h1>Lista de alunos — Palco 21</h1>';

      html += `
        <div class="meta">
          Gerado em
          ${escapeHtml(
            fmtDateTime(
              new Date().toISOString()
            )
          )}
          · ${(students || []).length}
          registos
        </div>
      `;

      html += `
        <table>
          <thead>
            <tr>
              <th>Aluno</th>
              <th>Instrumentos</th>
              <th>Contacto</th>
              <th>Encarregado</th>
              <th>Estado</th>
            </tr>
          </thead>

          <tbody>
      `;

      for (const student of students || []) {
        const name =
          student.full_name ||
          profileMap[
            student.profile_id
          ] ||
          'Sem nome';

        const instruments =
          (student.student_instruments || [])
            .map((item: any) => {
              const instrument =
                Array.isArray(
                  item.instrument
                )
                  ? item.instrument[0]
                  : item.instrument;

              return instrument?.name;
            })
            .filter(Boolean)
            .join(', ');

        const contact = [
          student.email,
          student.phone
        ]
          .filter(Boolean)
          .join(' · ');

        const guardian = [
          student.guardian_name,
          student.guardian_phone,
          student.guardian_email
        ]
          .filter(Boolean)
          .join(' · ');

        html += `
          <tr>
            <td>${escapeHtml(name)}</td>
            <td>${escapeHtml(
              instruments || '—'
            )}</td>
            <td>${escapeHtml(
              contact || '—'
            )}</td>
            <td>${escapeHtml(
              guardian || '—'
            )}</td>
            <td>${escapeHtml(
              student.status || '—'
            )}</td>
          </tr>
        `;
      }

      html += `
          </tbody>
        </table>

        <div class="footer">
          Palco 21 · documento de impressão
        </div>
      `;

      const opened =
        openPrintWindow(
          'Lista de alunos — Palco 21',
          html
        );

      if (!opened) {
        throw new Error(
          'O navegador bloqueou a janela de impressão.'
        );
      }

      setMessage(
        'Lista de alunos aberta para impressão.'
      );
    } catch (errorValue: any) {
      setError(
        errorValue?.message ||
        'Não foi possível preparar a lista.'
      );
    } finally {
      setLoading(false);
    }
  }

  async function backupExcel() {
    try {
      setError('');
      setMessage(
        'A preparar cópia de segurança Excel…'
      );
      setLoading(true);

      const tables = [
        'profiles',
        'teachers',
        'students',
        'instruments',
        'student_instruments',
        'teacher_student_assignments',
        'lessons',
        'lesson_series',
        'reschedule_requests',
        'monthly_payments',
        'teacher_monthly_payments',
        'leads',
        'notification_queue',
        'audit_log'
      ];

      const results =
        await Promise.all(
          tables.map(
            async table => {
              const {
                data,
                error
              } = await supabase
                .from(table)
                .select('*');

              if (error) {
                throw new Error(
                  `${table}: ${error.message}`
                );
              }

              return {
                name: table,
                rows:
                  (data ||
                    []) as Record<
                    string,
                    unknown
                  >[]
              };
            }
          )
        );

      const xml =
        makeExcelXml(results);

      const blob = new Blob(
        ['\ufeff', xml],
        {
          type:
            'application/vnd.ms-excel;charset=utf-8'
        }
      );

      const url =
        URL.createObjectURL(blob);

      const a =
        document.createElement('a');

      const stamp =
        new Date()
          .toISOString()
          .slice(0, 10);

      a.href = url;

      a.download =
        `Palco21_Backup_${stamp}.xls`;

      document.body.appendChild(a);

      a.click();

      a.remove();

      URL.revokeObjectURL(url);

      setMessage(
        'Cópia de segurança Excel criada.'
      );
    } catch (errorValue: any) {
      setError(
        `Backup incompleto: ${
          errorValue?.message ||
          'erro desconhecido'
        }`
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="section">
      <div className="peopleHead">
        <div>
          <div className="eyebrow">
            Relatórios e backup
          </div>

          <h2 style={{ margin: '6px 0 4px' }}>
            Impressão e cópia de segurança
          </h2>

          <div className="muted">
            Relatórios semanais e exportação
            dos dados da aplicação.
          </div>
        </div>
      </div>

      {error && (
        <div className="error">
          {error}
        </div>
      )}

      {message && (
        <div className="success">
          {message}
        </div>
      )}

      <div
        className="card"
        style={{
          display: 'grid',
          gap: 16
        }}
      >
        <div
          style={{
            display: 'flex',
            gap: 12,
            alignItems: 'end',
            flexWrap: 'wrap'
          }}
        >
          <div
            className="field"
            style={{ minWidth: 220 }}
          >
            <label>
              Semana
            </label>

            <input
              type="date"
              value={weekStart}
              onChange={e =>
                setWeekStart(
                  localDateValue(
                    startOfWeek(
                      new Date(
                        `${e.target.value}T12:00:00`
                      )
                    )
                  )
                )
              }
            />

            <small className="muted">
              A data é automaticamente
              ajustada para segunda-feira.
            </small>
          </div>

          <div
            className="field"
            style={{ minWidth: 260 }}
          >
            <label>
              Professor
            </label>

            <select
              value={selectedTeacher}
              onChange={e =>
                setSelectedTeacher(
                  e.target.value
                )
              }
            >
              <option value="">
                Selecionar…
              </option>

              {teachers.map(
                teacher => (
                  <option
                    key={teacher.id}
                    value={teacher.id}
                  >
                    {teacher.name}
                  </option>
                )
              )}
            </select>
          </div>
        </div>

        <div
          style={{
            display: 'flex',
            gap: 8,
            flexWrap: 'wrap'
          }}
        >
          <button
            className="btn primary"
            type="button"
            disabled={loading}
            onClick={() =>
              printWeekly('teacher')
            }
          >
            Imprimir professor
          </button>

          <button
            className="btn ghost"
            type="button"
            disabled={loading}
            onClick={() =>
              printWeekly('general')
            }
          >
            Imprimir semanal geral
          </button>

          <button
            className="btn ghost"
            type="button"
            disabled={loading}
            onClick={printStudents}
          >
            Imprimir lista de alunos
          </button>

          <button
            className="btn ghost"
            type="button"
            disabled={loading}
            onClick={backupExcel}
          >
            Fazer cópia de segurança Excel
          </button>
        </div>

        <div className="notice">
          <strong>
            Backup:
          </strong>{' '}
          o ficheiro contém os dados da
          aplicação em várias folhas do Excel,
          incluindo alunos, professores,
          aulas, séries, pagamentos, leads,
          notificações e auditoria.

          <br />

          Não inclui palavras-passe nem
          credenciais do Supabase Auth.
        </div>
      </div>
    </section>
  );
}
