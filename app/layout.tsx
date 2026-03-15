import type { Metadata } from 'next'
import { Analytics } from '@vercel/analytics/react'
import './globals.css'

export const metadata: Metadata = {
  title: 'Claude Code Explorer | Linda\'s Dev Tools',
  description: 'Browse Claude Code conversations, search tool uses, and explore your AI-assisted development history',
  keywords: 'Claude Code, conversation browser, tool use explorer, developer tools',
  authors: [{ name: 'Linda' }],
  openGraph: {
    title: 'Claude Code Explorer',
    description: 'Browse and search your Claude Code conversations and tool uses',
    url: 'https://jsonlbrowser.withlinda.dev',
    siteName: 'Claude Code Explorer',
    type: 'website',
  },
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" className="dark">
      <body className="bg-everforest-bg0 text-everforest-fg antialiased">
        {children}
        <Analytics />
      </body>
    </html>
  )
}