import { redirect } from 'next/navigation';

interface Props {
  params: { id: string };
}

export const dynamic = 'force-dynamic';

export default function FrameworkAssessmentPage({ params }: Props) {
  redirect(`/frameworks/${params.id}`);
}
