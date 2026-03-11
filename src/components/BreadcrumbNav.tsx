import Link from 'next/link';
import { ChevronRight } from 'lucide-react';

interface BreadcrumbItem {
  label: string;
  href: string;
}

interface BreadcrumbNavProps {
  items: BreadcrumbItem[];
}

export default function BreadcrumbNav({ items }: BreadcrumbNavProps) {
  return (
    <nav aria-label="Breadcrumb" className="py-3 text-sm">
      <ol className="flex flex-wrap items-center gap-2 text-gray-600">
        <li>
          <Link href="/" className="hover:text-gray-900">
            Home
          </Link>
        </li>

        {items.map((item, index) => {
          const isLast = index === items.length - 1;
          return (
            <li key={`${item.href}-${item.label}`} className="flex items-center gap-2">
              <ChevronRight className="h-4 w-4 text-gray-400" />
              {isLast ? (
                <span className="font-medium text-gray-900">{item.label}</span>
              ) : (
                <Link href={item.href} className="hover:text-gray-900">
                  {item.label}
                </Link>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
