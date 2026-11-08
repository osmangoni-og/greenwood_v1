import { useEffect, useState } from 'react';
import { Button } from '@/components/Button';
import { FormError, FormField, inputClassName } from '@/components/FormField';
import { Modal } from '@/components/Modal';
import { getActiveUserId } from '@/lib/activeUser';
import { recordActivity } from '@/lib/activity';
import { supabase } from '@/lib/supabase';
import {
  MATERIAL_TYPES,
  MATERIAL_TYPE_LABELS,
  type MaterialDeliveryRow,
  type MaterialType,
  type ProjectRow,
  type VendorRow,
} from '@/types/database';

const TYPE_OPTIONS = MATERIAL_TYPES.map((t) => ({ value: t, label: MATERIAL_TYPE_LABELS[t] }));

interface DeliveryFormModalProps {
  project: ProjectRow;
  delivery: MaterialDeliveryRow | null;
  vendors: VendorRow[];
  onClose: () => void;
  onSaved: () => void;
}

export function DeliveryFormModal({ project, delivery, vendors, onClose, onSaved }: DeliveryFormModalProps) {
  const [vendorId, setVendorId] = useState(delivery?.vendor_id ?? '');
  const [deliveryDate, setDeliveryDate] = useState(delivery?.delivery_date ?? new Date().toISOString().slice(0, 10));
  const [materialType, setMaterialType] = useState<MaterialType>(delivery?.material_type ?? 'rod');
  const [quantity, setQuantity] = useState(delivery?.quantity ?? 0);
  const [unit, setUnit] = useState(delivery?.unit ?? 'ton');
  const [unitRate, setUnitRate] = useState(delivery?.unit_rate_bdt ?? 0);
  const [invoiceRef, setInvoiceRef] = useState(delivery?.invoice_reference ?? '');
  const [notes, setNotes] = useState(delivery?.notes ?? '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const total = Math.max(0, Number(quantity) * Number(unitRate));

  useEffect(() => {
    if (!delivery) return;
    setVendorId(delivery.vendor_id ?? '');
    setDeliveryDate(delivery.delivery_date);
    setMaterialType(delivery.material_type);
    setQuantity(delivery.quantity);
    setUnit(delivery.unit);
    setUnitRate(delivery.unit_rate_bdt);
    setInvoiceRef(delivery.invoice_reference ?? '');
    setNotes(delivery.notes ?? '');
  }, [delivery]);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    if (Number(quantity) <= 0) {
      setError('Quantity must be greater than zero.');
      return;
    }
    setBusy(true);
    try {
      const payload: Record<string, unknown> = {
        project_id: project.id,
        vendor_id: vendorId || null,
        delivery_date: deliveryDate,
        material_type: materialType,
        quantity: Number(quantity),
        unit: unit.trim() || 'unit',
        unit_rate_bdt: Number(unitRate) || 0,
        total_amount_bdt: Math.round(total * 100) / 100,
        invoice_reference: invoiceRef.trim() || null,
        notes: notes.trim() || null,
      };
      if (delivery) {
        const { error: updateErr } = await supabase
          .from('material_deliveries')
          .update({ ...payload, updated_at: new Date().toISOString() })
          .eq('id', delivery.id);
        if (updateErr) throw new Error(updateErr.message);
      } else {
        payload.created_by = getActiveUserId();
        const { error: insertErr } = await supabase.from('material_deliveries').insert(payload);
        if (insertErr) throw new Error(insertErr.message);
      }
      await recordActivity({
        projectId: project.id,
        action: delivery ? 'update' : 'create',
        entityType: 'material_delivery',
        entityId: delivery?.id,
        summary: `${delivery ? 'Updated' : 'Added'} delivery: ${MATERIAL_TYPE_LABELS[materialType]} x ${quantity} ${unit}`,
      });
      onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save delivery.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal
      open
      title={delivery ? 'Edit delivery' : 'New delivery'}
      onClose={onClose}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={busy}>Cancel</Button>
          <Button onClick={handleSubmit} disabled={busy}>{busy ? 'Saving...' : 'Save delivery'}</Button>
        </>
      }
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <FormField label="Vendor" htmlFor="delivery-vendor">
            <select id="delivery-vendor" className={inputClassName} value={vendorId} onChange={(e) => setVendorId(e.target.value)}>
              <option value="">General (no specific vendor)</option>
              {vendors.map((v) => <option key={v.id} value={v.id}>{v.name}</option>)}
            </select>
          </FormField>
          <FormField label="Delivery date" htmlFor="delivery-date">
            <input id="delivery-date" type="date" className={inputClassName} value={deliveryDate} onChange={(e) => setDeliveryDate(e.target.value)} />
          </FormField>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <FormField label="Material type" htmlFor="delivery-material">
            <select id="delivery-material" className={inputClassName} value={materialType} onChange={(e) => setMaterialType(e.target.value as MaterialType)}>
              {TYPE_OPTIONS.map((opt) => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
            </select>
          </FormField>
          <FormField label="Unit" htmlFor="delivery-unit">
            <input id="delivery-unit" className={inputClassName} value={unit} onChange={(e) => setUnit(e.target.value)} placeholder="ton, bag, cft, etc." />
          </FormField>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <FormField label="Quantity" htmlFor="delivery-quantity">
            <input id="delivery-quantity" type="number" min={0} step="any" className={inputClassName} value={quantity} onChange={(e) => setQuantity(Number(e.target.value))} />
          </FormField>
          <FormField label="Unit rate (Tk)" htmlFor="delivery-rate">
            <input id="delivery-rate" type="number" min={0} step="any" className={inputClassName} value={unitRate} onChange={(e) => setUnitRate(Number(e.target.value))} />
          </FormField>
        </div>
        <div className="rounded-lg bg-stone-50 px-4 py-3 text-sm text-stone-700">
          <div className="flex justify-between"><span>Total amount</span><span className="font-semibold">Tk {total.toLocaleString('en-IN', { maximumFractionDigits: 0 })}</span></div>
        </div>
        <FormField label="Invoice reference" htmlFor="delivery-invoice">
          <input id="delivery-invoice" className={inputClassName} value={invoiceRef} onChange={(e) => setInvoiceRef(e.target.value)} />
        </FormField>
        <FormField label="Notes" htmlFor="delivery-notes">
          <textarea id="delivery-notes" rows={2} className={inputClassName} value={notes} onChange={(e) => setNotes(e.target.value)} />
        </FormField>
        <FormError message={error} />
      </form>
    </Modal>
  );
}
