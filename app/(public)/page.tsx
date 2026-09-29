import Link from 'next/link'
import { Suspense } from 'react'
import { SignupForm } from '../../components/SignupForm'

export default function Home() {
  const instruments = [
    'Guitarra',
    'Piano',
    'Baixo',
    'Bateria',
    'Canto',
    'Ukulele'
  ]

  return (
    <main>
      <header>
        <div className="wrap nav">
          <div className="brand">
            PALCO <span>21</span>
          </div>

          <nav className="navlinks">
            <a className="hideMobile" href="#aulas">
              Aulas
            </a>

            <a className="hideMobile" href="#instrumentos">
              Instrumentos
            </a>

            <Link className="btn ghost" href="/login">
              Área reservada
            </Link>
          </nav>
        </div>
      </header>

      <div className="wrap">
        <section className="heroNew">
          <div className="heroImage">
            <img
              src="/hero-palco21-red.png"
              alt="Palco 21 — Escola de Música nas Caldas das Taipas"
            />
          </div>

          <div className="heroForm" id="inscricao">
            <div className="eyebrow">
              Inscrição
            </div>

            <h1>
              Quero inscrever-me
            </h1>

            <p className="muted heroFormText">
              Deixa os teus dados e escolhe o instrumento
              em que tens interesse. A escola entra depois
              em contacto.
            </p>

            <Suspense
              fallback={
                <div className="card">
                  A carregar formulário…
                </div>
              }
            >
              <SignupForm />
            </Suspense>
          </div>
        </section>

        <section
          id="instrumentos"
          className="section"
        >
          <h2>Instrumentos</h2>

          <div className="grid">
            {instruments.map(instrument => (
              <a
                href="#inscricao"
                className="card"
                key={instrument}
              >
                <strong>{instrument}</strong>

                <div
                  className="muted"
                  style={{ marginTop: 8 }}
                >
                  Aulas individuais · 50 min
                </div>
              </a>
            ))}
          </div>
        </section>

        <section
          id="aulas"
          className="section"
        >
          <h2>Como funciona</h2>

          <div className="grid">
            <div className="card">
              <strong>
                1. Inscrição
              </strong>

              <p className="muted">
                Deixas os teus dados e escolhes
                o instrumento.
              </p>
            </div>

            <div className="card">
              <strong>
                2. Contacto
              </strong>

              <p className="muted">
                A escola entra em contacto pelo
                meio que preferires.
              </p>
            </div>

            <div className="card">
              <strong>
                3. Começas
              </strong>

              <p className="muted">
                Definimos professor e horário.
              </p>
            </div>
          </div>
        </section>

        <footer className="section muted">
          <div
            className="wrap"
            style={{
              padding: 0,
              display: 'flex',
              gap: 18,
              flexWrap: 'wrap'
            }}
          >
            <Link href="/privacidade">
              Privacidade
            </Link>

            <Link href="/termos">
              Termos
            </Link>
          </div>
        </footer>
      </div>
    </main>
  )
}
