import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Palco 21',
  description: 'Palco 21 — Escola de música, aulas e gestão.'
}

export default function RootLayout({children}:{children:React.ReactNode}){
  return <html lang="pt-PT"><body>{children}</body></html>
}
