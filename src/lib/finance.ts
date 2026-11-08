import type { ProjectRow } from '@/types/database';

export interface ProjectFinancials {
  budget: number;
  secured: number;
  spent: number;
  remaining: number;
  fundingGap: number;
  securedPct: number;
  spentPct: number;
  isOverBudget: boolean;
}

export function summarizeFinancials(project: ProjectRow): ProjectFinancials {
  const budget = Number(project.total_budget_bdt);
  const secured = Number(project.funds_secured_bdt);
  const spent = Number(project.amount_spent_bdt);
  const percentOfBudget = (part: number) => (budget > 0 ? (part / budget) * 100 : 0);

  return {
    budget,
    secured,
    spent,
    remaining: budget - spent,
    fundingGap: Math.max(budget - secured, 0),
    securedPct: percentOfBudget(secured),
    spentPct: percentOfBudget(spent),
    isOverBudget: spent > budget,
  };
}
