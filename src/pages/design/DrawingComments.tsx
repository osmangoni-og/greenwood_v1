import { useState, type FormEvent } from 'react';
import { CheckCircle2, MessageSquare, Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/Button';
import { EmptyState, ErrorState, LoadingState } from '@/components/StatePanel';
import { FormError, inputClassName } from '@/components/FormField';
import { useAsyncData } from '@/hooks/useAsyncData';
import { recordActivity } from '@/lib/activity';
import { getActiveUserId } from '@/lib/activeUser';
import { cx } from '@/lib/cx';
import { formatDateTime } from '@/lib/format';
import { supabase, unwrap } from '@/lib/supabase';
import type { DrawingCommentRow, DrawingRow, DrawingVersionRow } from '@/types/database';

interface DrawingCommentsProps {
  projectId: string;
  drawing: DrawingRow;
  versions: DrawingVersionRow[];
  refresh: () => void;
}

interface CommentsData {
  comments: DrawingCommentRow[];
  userNames: Record<string, string>;
}

async function loadComments(drawingId: string): Promise<CommentsData> {
  const [comments, users] = await Promise.all([
    supabase
      .from('drawing_comments')
      .select('*')
      .eq('drawing_id', drawingId)
      .order('created_at', { ascending: true }),
    supabase.from('users').select('id, full_name'),
  ]);
  const userRows = unwrap<{ id: string; full_name: string }[]>(users);
  return {
    comments: unwrap<DrawingCommentRow[]>(comments),
    userNames: Object.fromEntries(userRows.map((user) => [user.id, user.full_name])),
  };
}

export function DrawingComments({ projectId, drawing, versions, refresh }: DrawingCommentsProps) {
  const { data, error, loading, reload } = useAsyncData(() => loadComments(drawing.id), [drawing.id]);
  const [draft, setDraft] = useState('');
  const [draftError, setDraftError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [showResolved, setShowResolved] = useState(true);

  if (loading && !data) return <LoadingState />;
  if (error) return <ErrorState message={error} onRetry={reload} />;
  const comments = data?.comments ?? [];
  const userNames = data?.userNames ?? {};

  const visible = showResolved ? comments : comments.filter((comment) => !comment.is_resolved);
  const openCount = comments.filter((comment) => !comment.is_resolved).length;

  async function addComment(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const text = draft.trim();
    if (!text) {
      setDraftError('Enter a comment.');
      return;
    }
    setSaving(true);
    setDraftError(null);
    const { error } = await supabase.from('drawing_comments').insert({
      drawing_id: drawing.id,
      comment: text,
      created_by: getActiveUserId(),
    });
    setSaving(false);
    if (error) {
      setDraftError(error.message);
      return;
    }
    await recordActivity({
      projectId,
      action: 'note',
      entityType: 'drawing_comment',
      entityId: drawing.id,
      summary: `Comment added to ${drawing.drawing_number} ${drawing.title}`,
    });
    setDraft('');
    refresh();
    reload();
  }

  async function toggleResolved(comment: DrawingCommentRow) {
    setActionError(null);
    const { error } = await supabase
      .from('drawing_comments')
      .update({ is_resolved: !comment.is_resolved })
      .eq('id', comment.id);
    if (error) {
      setActionError(error.message);
      return;
    }
    reload();
  }

  async function removeComment(comment: DrawingCommentRow) {
    setActionError(null);
    const { error } = await supabase.from('drawing_comments').delete().eq('id', comment.id);
    if (error) {
      setActionError(error.message);
      return;
    }
    await recordActivity({
      projectId,
      action: 'delete',
      entityType: 'drawing_comment',
      entityId: drawing.id,
      summary: `Comment removed from ${drawing.drawing_number}`,
    });
    reload();
  }

  function versionLabel(versionId: string | null): string {
    if (!versionId) return '';
    const version = versions.find((entry) => entry.id === versionId);
    return version ? `${version.revision_label} (v${version.version_number})` : '';
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm text-stone-600">
          <MessageSquare className="h-4 w-4" aria-hidden />
          {openCount} open / {comments.length} total
        </div>
        <label className="flex items-center gap-2 text-xs font-medium text-stone-600">
          <input
            type="checkbox"
            checked={showResolved}
            onChange={(event) => setShowResolved(event.target.checked)}
            className="h-4 w-4 rounded border-stone-300 text-primary-700 focus:ring-primary-500"
          />
          Show resolved
        </label>
      </div>

      <form onSubmit={addComment} className="space-y-2">
        <textarea
          rows={2}
          className={inputClassName}
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          placeholder="Add a review comment..."
        />
        <div className="flex items-center justify-between gap-3">
          <FormError message={draftError} />
          <Button type="submit" disabled={saving} className="shrink-0">
            <Plus className="h-4 w-4" aria-hidden />
            {saving ? 'Adding...' : 'Add comment'}
          </Button>
        </div>
      </form>

      {actionError && <ErrorState message={actionError} />}

      {comments.length === 0 ? (
        <EmptyState icon={MessageSquare} title="No comments yet" description="Add the first review comment for this drawing." />
      ) : visible.length === 0 ? (
        <p className="rounded-xl border border-dashed border-stone-300 bg-white px-4 py-8 text-center text-sm text-stone-500">
          No open comments. Toggle "Show resolved" to see them.
        </p>
      ) : (
        <ul className="space-y-3">
          {visible.map((comment) => {
            const author = comment.created_by ? userNames[comment.created_by] ?? 'Former member' : 'Unassigned';
            const version = versionLabel(comment.drawing_version_id);
            return (
              <li
                key={comment.id}
                className={cx(
                  'rounded-xl border p-4 transition-colors',
                  comment.is_resolved ? 'border-stone-200 bg-stone-50' : 'border-stone-200 bg-white',
                )}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-stone-900">{author}</p>
                    <p className="text-xs text-stone-500">
                      {formatDateTime(comment.created_at)}
                      {version && <> &middot; {version}</>}
                    </p>
                  </div>
                  <div className="flex items-center gap-1">
                    <Button
                      variant="ghost"
                      className={cx('p-1.5', comment.is_resolved ? 'text-emerald-700' : 'text-stone-500 hover:text-emerald-700')}
                      aria-label={comment.is_resolved ? 'Reopen comment' : 'Resolve comment'}
                      onClick={() => toggleResolved(comment)}
                    >
                      <CheckCircle2 className="h-4 w-4" aria-hidden />
                    </Button>
                    <Button
                      variant="ghost"
                      className="p-1.5 text-stone-500 hover:text-rose-700"
                      aria-label="Delete comment"
                      onClick={() => removeComment(comment)}
                    >
                      <Trash2 className="h-4 w-4" aria-hidden />
                    </Button>
                  </div>
                </div>
                <p className={cx('mt-2 whitespace-pre-line text-sm leading-relaxed', comment.is_resolved ? 'text-stone-500 line-through' : 'text-stone-700')}>
                  {comment.comment}
                </p>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
