import type { Metadata } from 'next';
import { DM_Mono, DM_Sans, Newsreader, Outfit, Space_Grotesk } from 'next/font/google';
import './globals.css';

// Display. Per-person themeable — Outfit (default), Space Grotesk, Newsreader
// are all loaded so the workspace switch is a pure CSS-var swap with no FOUT.
const outfit = Outfit({ subsets: ['latin'], variable: '--font-outfit', display: 'swap' });
const spaceGrotesk = Space_Grotesk({ subsets: ['latin'], variable: '--font-space-grotesk', display: 'swap' });
const newsreader = Newsreader({ subsets: ['latin'], variable: '--font-newsreader', display: 'swap' });

// Body + mono are fixed.
const dmSans = DM_Sans({ subsets: ['latin'], variable: '--font-dm-sans', display: 'swap' });
const dmMono = DM_Mono({ subsets: ['latin'], weight: ['400', '500'], variable: '--font-dm-mono', display: 'swap' });

export const metadata: Metadata = {
  title: 'TKBS Hub',
  description: 'TKBS internal ops board — pulse, builds, clients, money, awareness.',
};

const fonts = [outfit, spaceGrotesk, newsreader, dmSans, dmMono].map((f) => f.variable).join(' ');

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={fonts}>
      <body className="antialiased">{children}</body>
    </html>
  );
}
