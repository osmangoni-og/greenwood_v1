import { useState, type FormEvent } from 'react';
import { Modal } from '@/components/Modal';
import { Button } from '@/components/Button';
import { FormError, FormField, inputClassName } from '@/components/FormField';
import { recordActivity } from '@/lib/activity';
import { getActiveUserId } from '@/lib/activeUser';
import { formatLabel } from '@/lib/format';
import { supabase } from '@/lib/supabase';
import { USER_ROLES, type UserRole, type UserRow } from '@/types/database';

interface UserFormModalProps {
  projectId: string | null;
  user: UserRow | null;
  onClose: () => void;
  onSaved: () => void;
}

interface UserPayload {
  full_name: string;
  email: string | null;
  phone: string | null;
  role: UserRole;
  is_active: boolean;
}

const FORM_ID = 'team-member-form';
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const DUPLICATE_KEY_CODE = '23505';

export function UserFormModal({ projectId, user, onClose, onSaved }: UserFormModalProps) {
  const [fullName, setFullName] = useState(user?.full_name ?? '');
  const [email, setEmail] = useState(user?.email ?? '');
  const [phone, setPhone] = useState(user?.phone ?? '');
  const [role, setRole] = useState<UserRole>(user?.role ?? 'engineer');
  const [isActive, setIsActive] = useState(user?.is_active ?? true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const isEdit = user !== null;

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const name = fullName.trim();
    const emailValue = email.trim();
    if (!name) {
      setError('Enter the full name.');
      return;
    }
    if (emailValue && !EMAIL_PATTERN.test(emailValue)) {
      setError('Enter a valid email address.');
      return;
    }

    const payload: UserPayload = {
      full_name: name,
      email: emailValue || null,
      phone: phone.trim() || null,
      role,
      is_active: isActive,
    };

    setSaving(true);
    setError(null);
    const result = user
      ? await supabase.from('users').update(payload).eq('id', user.id)
      : await supabase.from('users').insert({ ...payload, created_by: getActiveUserId() });
    setSaving(false);

    if (result.error) {
      setError(
        result.error.code === DUPLICATE_KEY_CODE
          ? 'Another team member already uses this email address.'
          : result.error.message,
      );
      return;
    }

    await recordActivity({
      projectId,
      action: isEdit ? 'update' : 'create',
      entityType: 'team_member',
      entityId: user?.id ?? null,
      summary: `${isEdit ? 'Team member updated' : 'Team member added'}: ${name}`,
    });
    onSaved();
  }

  return (
    <Modal
      open
      title={isEdit ? 'Edit team member' : 'Add team member'}
      onClose={onClose}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button type="submit" form={FORM_ID} disabled={saving}>
            {saving ? 'Saving...' : isEdit ? 'Save changes' : 'Add member'}
          </Button>
        </>
      }
    >
      <form id={FORM_ID} onSubmit={handleSubmit} className="space-y-5">
        <FormError message={error} />
        <FormField label="Full name" htmlFor="member-name">
          <input id="member-name" className={inputClassName} value={fullName} onChange={(e) => setFullName(e.target.value)} />
        </FormField>
        <div className="grid gap-5 sm:grid-cols-2">
          <FormField label="Email" htmlFor="member-email">
            <input id="member-email" type="email" className={inputClassName} value={email} onChange={(e) => setEmail(e.target.value)} />
          </FormField>
          <FormField label="Phone" htmlFor="member-phone">
            <input id="member-phone" type="tel" className={inputClassName} value={phone} onChange={(e) => setPhone(e.target.value)} />
          </FormField>
        </div>
        <div className="grid gap-5 sm:grid-cols-2">
          <FormField label="Role" htmlFor="member-role">
            <select id="member-role" className={inputClassName} value={role} onChange={(e) => setRole(e.target.value as UserRole)}>
              {USER_ROLES.map((option) => (
                <option key={option} value={option}>
                  {formatLabel(option)}
                </option>
              ))}
            </select>
          </FormField>
          <div className="flex items-end">
            <label className="flex items-center gap-3 rounded-lg border border-stone-200 px-4 py-2.5 text-sm font-medium text-stone-700">
              <input
                type="checkbox"
                checked={isActive}
                onChange={(e) => setIsActive(e.target.checked)}
                className="h-4 w-4 rounded border-stone-300 text-primary-700 focus:ring-primary-500"
              />
              Active member
            </label>
          </div>
        </div>
      </form>
    </Modal>
  );
}
