import { useState, type FormEvent } from 'react';
import { Modal } from '@/components/Modal';
import { Button } from '@/components/Button';
import { FormError, FormField, inputClassName } from '@/components/FormField';
import { recordActivity } from '@/lib/activity';
import { formatLabel } from '@/lib/format';
import { supabase } from '@/lib/supabase';
import { PROJECT_PHASES, type ProjectPhase, type ProjectRow } from '@/types/database';

interface ProjectEditModalProps {
  project: ProjectRow;
  onClose: () => void;
  onSaved: () => void;
}

interface ProjectForm {
  name: string;
  project_code: string;
  description: string;
  location: string;
  village: string;
  union: string;
  upazila: string;
  district: string;
  country: string;
  latitude: string;
  longitude: string;
  owner_name: string;
  project_type: string;
  phase: ProjectPhase;
  start_date: string;
  target_completion_date: string;
  notes: string;
}

const FORM_ID = 'project-edit-form';

function toForm(project: ProjectRow): ProjectForm {
  return {
    name: project.name,
    project_code: project.project_code ?? '',
    description: project.description ?? '',
    location: project.location,
    village: project.village ?? '',
    union: project.union ?? '',
    upazila: project.upazila ?? '',
    district: project.district ?? '',
    country: project.country ?? '',
    latitude: project.latitude === null ? '' : String(project.latitude),
    longitude: project.longitude === null ? '' : String(project.longitude),
    owner_name: project.owner_name ?? '',
    project_type: project.project_type,
    phase: project.phase,
    start_date: project.start_date ?? '',
    target_completion_date: project.target_completion_date ?? '',
    notes: project.notes ?? '',
  };
}

function buildPayload(form: ProjectForm): { payload: Partial<ProjectRow> } | { error: string } {
  const name = form.name.trim();
  const location = form.location.trim();
  const projectType = form.project_type.trim();
  if (!name) return { error: 'Enter a project name.' };
  if (!location) return { error: 'Enter the project location.' };
  if (!projectType) return { error: 'Enter the structure type.' };

  if (form.start_date && form.target_completion_date && form.target_completion_date < form.start_date) {
    return { error: 'Target completion cannot be before the start date.' };
  }

  const lat = form.latitude.trim() === '' ? null : Number(form.latitude);
  const lng = form.longitude.trim() === '' ? null : Number(form.longitude);
  if (lat !== null && !Number.isFinite(lat)) return { error: 'Latitude must be a valid number.' };
  if (lng !== null && !Number.isFinite(lng)) return { error: 'Longitude must be a valid number.' };

  return {
    payload: {
      name,
      project_code: form.project_code.trim() || null,
      description: form.description.trim() || null,
      location,
      village: form.village.trim() || null,
      union: form.union.trim() || null,
      upazila: form.upazila.trim() || null,
      district: form.district.trim() || null,
      country: form.country.trim() || null,
      latitude: lat,
      longitude: lng,
      owner_name: form.owner_name.trim() || null,
      project_type: projectType,
      phase: form.phase,
      start_date: form.start_date || null,
      target_completion_date: form.target_completion_date || null,
      notes: form.notes.trim() || null,
    },
  };
}

export function ProjectEditModal({ project, onClose, onSaved }: ProjectEditModalProps) {
  const [form, setForm] = useState<ProjectForm>(() => toForm(project));
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  function update<K extends keyof ProjectForm>(key: K, value: ProjectForm[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const result = buildPayload(form);
    if ('error' in result) {
      setError(result.error);
      return;
    }

    setSaving(true);
    setError(null);
    try {
      const { data, error: updateError } = await supabase
        .from('projects')
        .update(result.payload)
        .eq('id', project.id)
        .select('*')
        .maybeSingle();
      if (updateError) throw new Error(updateError.message);
      if (!data) throw new Error('This project could not be found. Refresh the page and try again.');

      const updated = data as ProjectRow;
      const phaseChanged = updated.phase !== project.phase;
      await recordActivity({
        projectId: project.id,
        action: phaseChanged ? 'status_change' : 'update',
        entityType: 'project',
        entityId: project.id,
        summary: phaseChanged ? `Phase changed to ${formatLabel(updated.phase)}` : 'Project details updated',
      });
      onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'The project could not be saved.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal
      open
      title="Edit project master data"
      onClose={onClose}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button type="submit" form={FORM_ID} disabled={saving}>
            {saving ? 'Saving...' : 'Save changes'}
          </Button>
        </>
      }
    >
      <form id={FORM_ID} onSubmit={handleSubmit} className="space-y-6">
        <FormError message={error} />

        <section className="grid gap-5 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <FormField label="Project name" htmlFor="project-name">
              <input id="project-name" className={inputClassName} value={form.name} onChange={(e) => update('name', e.target.value)} />
            </FormField>
          </div>
          <FormField label="Project code" htmlFor="project-code">
            <input id="project-code" className={inputClassName} value={form.project_code} onChange={(e) => update('project_code', e.target.value)} />
          </FormField>
          <FormField label="Project type" htmlFor="project-type">
            <input id="project-type" className={inputClassName} value={form.project_type} onChange={(e) => update('project_type', e.target.value)} />
          </FormField>
          <div className="sm:col-span-2">
            <FormField label="Description" htmlFor="project-description">
              <textarea id="project-description" rows={3} className={inputClassName} value={form.description} onChange={(e) => update('description', e.target.value)} />
            </FormField>
          </div>
        </section>

        <section className="grid gap-5 sm:grid-cols-2">
          <FormField label="Location" htmlFor="project-location">
            <input id="project-location" className={inputClassName} value={form.location} onChange={(e) => update('location', e.target.value)} />
          </FormField>
          <FormField label="Village" htmlFor="project-village">
            <input id="project-village" className={inputClassName} value={form.village} onChange={(e) => update('village', e.target.value)} />
          </FormField>
          <FormField label="Union" htmlFor="project-union">
            <input id="project-union" className={inputClassName} value={form.union} onChange={(e) => update('union', e.target.value)} />
          </FormField>
          <FormField label="Upazila" htmlFor="project-upazila">
            <input id="project-upazila" className={inputClassName} value={form.upazila} onChange={(e) => update('upazila', e.target.value)} />
          </FormField>
          <FormField label="District" htmlFor="project-district">
            <input id="project-district" className={inputClassName} value={form.district} onChange={(e) => update('district', e.target.value)} />
          </FormField>
          <FormField label="Country" htmlFor="project-country">
            <input id="project-country" className={inputClassName} value={form.country} onChange={(e) => update('country', e.target.value)} />
          </FormField>
          <FormField label="Latitude" htmlFor="project-latitude">
            <input id="project-latitude" type="number" step="any" className={inputClassName} value={form.latitude} onChange={(e) => update('latitude', e.target.value)} />
          </FormField>
          <FormField label="Longitude" htmlFor="project-longitude">
            <input id="project-longitude" type="number" step="any" className={inputClassName} value={form.longitude} onChange={(e) => update('longitude', e.target.value)} />
          </FormField>
        </section>

        <section className="grid gap-5 sm:grid-cols-2">
          <FormField label="Owner name" htmlFor="project-owner">
            <input id="project-owner" className={inputClassName} value={form.owner_name} onChange={(e) => update('owner_name', e.target.value)} />
          </FormField>
          <FormField label="Project status" htmlFor="project-phase">
            <select id="project-phase" className={inputClassName} value={form.phase} onChange={(e) => update('phase', e.target.value as ProjectPhase)}>
              {PROJECT_PHASES.map((phase) => (
                <option key={phase} value={phase}>
                  {formatLabel(phase)}
                </option>
              ))}
            </select>
          </FormField>
          <FormField label="Target start date" htmlFor="project-start">
            <input id="project-start" type="date" className={inputClassName} value={form.start_date} onChange={(e) => update('start_date', e.target.value)} />
          </FormField>
          <FormField label="Target completion date" htmlFor="project-target">
            <input id="project-target" type="date" className={inputClassName} value={form.target_completion_date} onChange={(e) => update('target_completion_date', e.target.value)} />
          </FormField>
          <div className="sm:col-span-2">
            <FormField label="Notes" htmlFor="project-notes">
              <textarea id="project-notes" rows={4} className={inputClassName} value={form.notes} onChange={(e) => update('notes', e.target.value)} />
            </FormField>
          </div>
        </section>
      </form>
    </Modal>
  );
}
