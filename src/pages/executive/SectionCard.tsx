import type { ReactNode } from 'react';
import { Card, CardHeader } from '@/components/Card';

interface SectionCardProps {
  title: string;
  description?: string;
  children: ReactNode;
}

export function SectionCard({ title, description, children }: SectionCardProps) {
  return (
    <Card>
      <CardHeader title={title} description={description} />
      <div className="mt-5">{children}</div>
    </Card>
  );
}
