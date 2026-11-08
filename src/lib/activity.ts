import { getActiveUserId } from '@/lib/activeUser';
import { supabase } from '@/lib/supabase';
import type { ActivityAction } from '@/types/database';

interface ActivityInput {
  projectId: string | null;
  action: ActivityAction;
  entityType: string;
  entityId?: string | null;
  summary: string;
}

export async function recordActivity(input: ActivityInput): Promise<void> {
  const { error } = await supabase.from('activity_logs').insert({
    project_id: input.projectId,
    action: input.action,
    entity_type: input.entityType,
    entity_id: input.entityId ?? null,
    summary: input.summary,
    created_by: getActiveUserId(),
  });
  if (error) console.warn('Activity log was not saved:', error.message);
}
