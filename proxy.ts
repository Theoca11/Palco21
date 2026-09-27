import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function proxy(request:NextRequest){
  let response=NextResponse.next({request})
  const supabase=createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL!,process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,{
    cookies:{getAll:()=>request.cookies.getAll(),setAll:(items)=>{items.forEach(({name,value})=>request.cookies.set(name,value));response=NextResponse.next({request});items.forEach(({name,value,options})=>response.cookies.set(name,value,options))}}
  })
  const {data:{claims}}=await supabase.auth.getClaims()
  const path=request.nextUrl.pathname
  if(!claims && path.startsWith('/dashboard')) return NextResponse.redirect(new URL('/login',request.url))
  if(claims && path==='/login') return NextResponse.redirect(new URL('/dashboard',request.url))
  return response
}
export const config={matcher:['/((?!_next/static|_next/image|favicon.ico).*)']}
