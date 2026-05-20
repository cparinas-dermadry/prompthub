import { SessionWorkspace } from '@/components/templates/SessionWorkspace';

interface SessionPageProps {
  params: Promise<{ id: string }>;
}

export default async function SessionPage({ params }: SessionPageProps) {
  const { id } = await params;
  return <SessionWorkspace sessionId={id} />;
}
