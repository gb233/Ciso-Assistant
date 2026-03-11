import type { Metadata } from 'next'
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

export const metadata: Metadata = {
  title: 'CISO助手 | Ciso-Assistant',
  description: '面向CISO的安全框架评估、治理改进与AI辅助分析工作台。',
  keywords: ['ciso', 'security frameworks', 'OWASP', 'NIST', 'ISO 27001', 'compliance', 'cybersecurity'],
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
