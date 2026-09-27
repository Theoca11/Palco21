import { NextResponse } from 'next/server'

export async function GET() {
  return NextResponse.json({
    ok: true,
    app: 'Palco 21',
    version: 'v12',
    timestamp: new Date().toISOString(),
  })
}
