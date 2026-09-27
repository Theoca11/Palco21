import {createClient} from './supabase/server';
export type NotificationInput={channel:'email'|'sms';recipient:string;subject?:string;body:string;event_type:string;related_id?:string|null;scheduled_for?:string};
export async function enqueueNotifications(items:NotificationInput[]){
 const sb=await createClient();
 const {error}=await sb.from('notification_queue').insert(items.map(x=>({...x,scheduled_for:x.scheduled_for||new Date().toISOString()})));
 if(error) throw new Error(error.message); return true;
}
