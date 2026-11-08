import { useState, type FormEvent } from 'react';
import { Modal } from '@/components/Modal';
import { Button } from '@/components/Button';
import { FormError, FormField, inputClassName } from '@/components/FormField';
import { getActiveUserId } from '@/lib/activeUser';
import { formatLabel } from '@/lib/format';
import { supabase } from '@/lib/supabase';
import { NOTIFICATION_SEVERITIES, type NotificationSeverity } from '@/types/database';

interface NotificationFormModalProps {
  projectId: string;
  onClose: () => void;
  onSaved: () => void;
}

const FORM_ID = 'notification-form';

export function NotificationFormModal({ projectId, onClose, onSaved }: NotificationFormModalProps) {
  const [title, setTitle] = useState('');
  const [message, setMessage] = useState('');
  const [severity, setSeverity] = useState<NotificationSeverity>('info');
  const [dueDate, setDueDate] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmedTitle = title.trim();
    if (!trimmedTitle) {
      setError('Enter a title for the reminder.');
      return;
    }

    setSaving(true);
    setError(null);
    const { error: insertError } = await supabase.from('notifications').insert({
      project_id: projectId,
      title: trimmedTitle,
      message: message.trim() || null,
      severity,
      due_date: dueDate || null,
      created_by: getActiveUserId(),
    });
    setSaving(false);
    if (insertError) {
      setError(insertError.message);
      return;
    }
    onSaved();
  }

  return (
    <Modal
      open
      title="New reminder"
      onClose={onClose}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button type="submit" form={FORM_ID} disabled={saving}>
            {saving ? 'Saving...' : 'Create reminder'}
          </Button>
        </>
      }
    >
      <form id={FORM_ID} onSubmit={handleSubmit} className="space-y-5">
        <FormError message={error} />
        <FormField label="Title" htmlFor="notification-title">
          <input id="notification-title" className={inputClassName} value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Pay mason for second floor" />
        </FormField>
        <FormField label="Details" htmlFor="notification-message">
          <textarea id="notification-message" rows={3} className={inputClassName} value={message} onChange={(e) => setMessage(e.target.value)} />
        </FormField>
        <div className="grid gap-5 sm:grid-cols-2">
          <FormField label="Priority" htmlFor="notification-severity">
            <select id="notification-severity" className={inputClassName} value={severity} onChange={(e) => setSeverity(e.target.value as NotificationSeverity)}>
              {NOTIFICATION_SEVERITIES.map((option) => (
                <option key={option} value={option}>
                  {formatLabel(option)}
                </option>
              ))}
            </select>
          </FormField>
          <FormField label="Due date" htmlFor="notification-due">
            <input id="notification-due" type="date" className={inputClassName} value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
          </FormField>
        </div>
      </form>
    </Modal>
  );
}
