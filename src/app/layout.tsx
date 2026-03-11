import type { Metadata, Viewport } from 'next'
import { IBM_Plex_Mono, Noto_Sans_SC, Space_Grotesk } from 'next/font/google'
import './globals.css'
import { LanguageProvider } from '@/components/LanguageProvider'

const bodyFont = Noto_Sans_SC({
  subsets: ['latin'],
  weight: ['400', '500', '700'],
  variable: '--font-body',
  display: 'swap',
})

const headingFont = Space_Grotesk({
  subsets: ['latin'],
  weight: ['500', '600', '700'],
  variable: '--font-heading',
  display: 'swap',
})

const monoFont = IBM_Plex_Mono({
  subsets: ['latin'],
  weight: ['400', '500'],
  variable: '--font-mono',
  display: 'swap',
})

const metadataBaseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:5001'

export const metadata: Metadata = {
  title: 'CISO助手 | Ciso-Assistant',
  description: '面向CISO的安全框架评估、治理改进与AI辅助分析工作台。',
  keywords: ['ciso', 'security frameworks', 'OWASP', 'NIST', 'ISO 27001', 'compliance', 'cybersecurity'],
  metadataBase: new URL(metadataBaseUrl),
  applicationName: 'CISO助手',
  manifest: '/site.webmanifest',
  icons: {
    icon: [
      { url: '/favicon.ico', type: 'image/x-icon' },
      { url: '/icon-192.png', sizes: '192x192', type: 'image/png' },
      { url: '/icon-512.png', sizes: '512x512', type: 'image/png' },
    ],
    shortcut: ['/favicon.ico'],
    apple: [{ url: '/apple-touch-icon.png', sizes: '180x180', type: 'image/png' }],
  },
  openGraph: {
    title: 'CISO助手 | Ciso-Assistant',
    description: '面向CISO的安全框架评估、治理改进与AI辅助分析工作台。',
    type: 'website',
    locale: 'zh_CN',
    images: [
      {
        url: '/og-image.png',
        width: 1200,
        height: 630,
        alt: 'CISO助手品牌图',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'CISO助手 | Ciso-Assistant',
    description: '面向CISO的安全框架评估、治理改进与AI辅助分析工作台。',
    images: ['/og-image.png'],
  },
}

export const viewport: Viewport = {
  themeColor: '#0a142c',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="zh-CN">
      <body className={`${bodyFont.variable} ${headingFont.variable} ${monoFont.variable} antialiased`}>
        <LanguageProvider>
          {children}
        </LanguageProvider>
      </body>
    </html>
  )
}
