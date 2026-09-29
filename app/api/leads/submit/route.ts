import { NextResponse } from 'next/server';
import { createClient as createSupabaseClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';

async function sendEmail(
  to: string,
  subject: string,
  html: string
) {
  const key = process.env.RESEND_API_KEY;
  const from = process.env.RESEND_FROM;

  if (!key || !from || !to) {
    throw new Error(
      'Email não configurado: RESEND_API_KEY, RESEND_FROM e NOTIFICATIONS_ADMIN_EMAIL.'
    );
  }

  const response = await fetch(
    'https://api.resend.com/emails',
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${key}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        from,
        to,
        subject,
        html
      })
    }
  );

  const json =
    await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(
      json?.message ||
      'Erro ao enviar email.'
    );
  }

  return json?.id || null;
}

function clean(value: unknown) {
  const text = String(value ?? '').trim();
  return text || null;
}

function escapeHtml(value: unknown) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

export async function POST(
  req: Request
) {
  try {
    const body = await req.json();

    if (!body?.consent) {
      return NextResponse.json(
        {
          error:
            'O consentimento é obrigatório.'
        },
        { status: 400 }
      );
    }

    const url =
      process.env.NEXT_PUBLIC_SUPABASE_URL;

    const key =
      process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!url || !key) {
      return NextResponse.json(
        {
          error:
            'Configuração do Supabase em falta.'
        },
        { status: 500 }
      );
    }

    const supabase =
      createSupabaseClient(
        url,
        key,
        {
          auth: {
            autoRefreshToken: false,
            persistSession: false
          }
        }
      );

    const contactName =
      clean(body.contact_name);

    const email =
      clean(body.email);

    const phone =
      clean(body.phone);

    const preferredContact =
      clean(body.preferred_contact);

    const interestInstrumentId =
      clean(
        body.interest_instrument_id
      );

    const source =
      clean(body.source) ||
      'site';

    const campaign =
      clean(body.campaign);

    const {
      data: lead,
      error: leadError
    } = await supabase
      .from('leads')
      .insert({
        name: contactName,
        email,
        phone,
        preferred_contact:
          preferredContact,
        interest_instrument_id:
          interestInstrumentId,
        source,
        campaign,
        funnel_stage:
          'completed',
        consent_at:
          new Date().toISOString()
      })
      .select('id')
      .single();

    if (leadError || !lead) {
      return NextResponse.json(
        {
          error:
            leadError?.message ||
            'Não foi possível registar a inscrição.'
        },
        { status: 400 }
      );
    }

    let instrumentName =
      'Não indicado';

    if (interestInstrumentId) {
      const {
        data: instrument
      } = await supabase
        .from('instruments')
        .select('name')
        .eq(
          'id',
          interestInstrumentId
        )
        .maybeSingle();

      instrumentName =
        instrument?.name ||
        instrumentName;
    }

    let notificationSent =
      false;

    let notificationError:
      | string
      | null = null;

    const adminEmail =
      process.env
        .NOTIFICATIONS_ADMIN_EMAIL;

    if (adminEmail) {
      try {
        await sendEmail(
          adminEmail,
          `Nova inscrição — ${
            contactName ||
            'Novo contacto'
          } · Palco 21`,
          `
            <h2>Nova inscrição recebida</h2>

            <p>
              <strong>Nome:</strong>
              ${escapeHtml(
                contactName ||
                'Não indicado'
              )}
            </p>

            <p>
              <strong>Email:</strong>
              ${escapeHtml(
                email ||
                'Não indicado'
              )}
            </p>

            <p>
              <strong>Telemóvel:</strong>
              ${escapeHtml(
                phone ||
                'Não indicado'
              )}
            </p>

            <p>
              <strong>Contacto preferido:</strong>
              ${escapeHtml(
                preferredContact ||
                'Não indicado'
              )}
            </p>

            <p>
              <strong>Instrumento de interesse:</strong>
              ${escapeHtml(
                instrumentName
              )}
            </p>

            <p>
              A inscrição ficou registada no
              dashboard do Palco 21.
            </p>
          `
        );

        notificationSent = true;
      } catch (errorValue: any) {
        notificationError =
          errorValue?.message ||
          'Falha ao enviar a notificação.';
      }
    } else {
      notificationError =
        'NOTIFICATIONS_ADMIN_EMAIL não está configurado.';
    }

    return NextResponse.json({
      ok: true,
      lead_id: lead.id,
      notification_sent:
        notificationSent,
      notification_error:
        notificationError
    });
  } catch (errorValue: any) {
    return NextResponse.json(
      {
        error:
          errorValue?.message ||
          'Erro inesperado ao processar a inscrição.'
      },
      { status: 500 }
    );
  }
}

