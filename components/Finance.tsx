async function createTeacherPayroll(){
  if(!isAdmin)return;
  const lessons=await supabase.from('lessons').select('teacher_id,student_id').gte('starts_at',`${month.slice(0,7)}-01T00:00:00`).lt('starts_at',new Date(new Date(month).setMonth(new Date(month).getMonth()+1)).toISOString());
  if(lessons.error){setMsg(lessons.error.message);return;}
  const by=new Map<string,Set<string>>(); 
  (lessons.data||[]).forEach((x:any)=>{
    if(!by.has(x.teacher_id))by.set(x.teacher_id,new Set());
    by.get(x.teacher_id)!.add(x.student_id)
  });
  const rows=teachers.map(t=>({
    teacher_id:t.id,
    month,
    assigned_students:by.get(t.id)?.size||0,
    rate_per_student:20
  }));
  const r=await supabase
    .from('teacher_monthly_payments')
    .upsert(rows,{onConflict:'teacher_id,month'});

  if(r.error)
    setMsg(r.error.message);
  else {
    setMsg('Folha de professores atualizada a €20/aluno.');
    load();
  }
}

if(!isAdmin)return null;
