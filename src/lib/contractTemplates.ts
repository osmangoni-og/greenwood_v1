import type { ContractLanguage, ContractRow } from '@/types/database';

const BANGLA: Record<string, string> = {
  engineer: 'প্রকৌশলী চুক্তি', contractor: 'ঠিকাদার চুক্তি', supplier: 'সরবরাহকারী চুক্তি', work_order: 'কাজের আদেশ', change_order: 'পরিবর্তন আদেশ', completion_certificate: 'কাজ সমাপ্তি সনদ', warranty_certificate: 'ওয়ারেন্টি সনদ',
};
const labels = { english: { parties: 'Parties', scope: 'Scope of Work', value: 'Contract Value', period: 'Contract Period', owner: 'Owner / Employer', provider: 'Service Provider', signatures: 'Signatures', date: 'Date', notes: 'Notes' }, bangla: { parties: 'পক্ষসমূহ', scope: 'কাজের পরিধি', value: 'চুক্তির মূল্য', period: 'চুক্তির সময়কাল', owner: 'মালিক / নিয়োগকর্তা', provider: 'সেবা প্রদানকারী', signatures: 'স্বাক্ষর', date: 'তারিখ', notes: 'নোট' } };

export interface ContractBlock { heading: string; content: string; }
export interface ContractDocument { heading: string; blocks: ContractBlock[]; footer: string; }

export function getContractDocument(contract: ContractRow, language: ContractLanguage = contract.language): ContractDocument {
  const typeLabel = contract.contract_type;
  const titleEn = contract.title || typeLabel.replace(/_/g, ' ');
  const titleBn = BANGLA[contract.contract_type] ?? titleEn;
  const make = (lang: 'english' | 'bangla'): ContractDocument => {
    const l = labels[lang];
    return { heading: lang === 'bangla' ? titleBn : titleEn, blocks: [
      { heading: l.parties, content: `${l.owner}: ${contract.party_a_name}${contract.party_a_role ? ` (${contract.party_a_role})` : ''}\n${l.provider}: ${contract.party_b_name}${contract.party_b_role ? ` (${contract.party_b_role})` : ''}` },
      { heading: l.scope, content: contract.scope_of_work || 'To be agreed by both parties.' },
      { heading: l.value, content: contract.contract_value_bdt != null ? `BDT ${Number(contract.contract_value_bdt).toLocaleString('en-IN')}` : 'To be agreed' },
      { heading: l.period, content: `${contract.start_date || '—'}  to  ${contract.end_date || '—'}` },
      ...(contract.notes ? [{ heading: l.notes, content: contract.notes }] : []),
      { heading: l.signatures, content: `\n${l.owner}: ____________________        ${l.provider}: ____________________\n${l.date}: ____________________` },
    ], footer: `${contract.contract_number || 'Contract'} · ${lang === 'bangla' ? 'নিয়ন্ত্রিত নথি' : 'Controlled document'}` };
  };
  if (language === 'bilingual') {
    const english = make('english'); const bangla = make('bangla');
    return { heading: `${english.heading} / ${bangla.heading}`, blocks: english.blocks.map((block, index) => ({ heading: `${block.heading} / ${bangla.blocks[index]?.heading ?? ''}`, content: `${block.content}\n\n${bangla.blocks[index]?.content ?? ''}` })), footer: `${english.footer} / ${bangla.footer}` };
  }
  return make(language);
}
