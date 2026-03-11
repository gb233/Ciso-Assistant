import { getFrameworksServer } from '@/lib/data-loader-server';
import { getServerLanguage } from '@/lib/server-language';
import HomePageClient from '@/components/HomePageClient';

export const dynamic = 'force-dynamic';

export default async function HomePage() {
  const lang = getServerLanguage();
  const frameworks = await getFrameworksServer(lang);
  const totalRequirements = frameworks.reduce((sum, f) => sum + f.requirements, 0);

  return (
    <HomePageClient
      frameworks={frameworks}
      totalRequirements={totalRequirements}
    />
  );
}
