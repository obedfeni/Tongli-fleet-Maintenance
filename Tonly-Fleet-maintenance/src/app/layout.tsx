import type { Metadata } from 'next';
import './globals.css';
import { Toaster } from 'sonner';
import { ThemeProvider } from '@/components/ThemeProvider';

// Deliberately using the system font stack (see tailwind.config.ts) instead
// of next/font/google — zero external font fetch at build or request time,
// which means one less network dependency for your Vercel build to trip on.

export const metadata: Metadata = {
  title: 'Fleet PM Predictor',
  description: 'Predictive preventive maintenance for EV truck fleets, powered by robust ML odometer-trend regression.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="font-sans antialiased">
        <ThemeProvider>
          {children}
          <Toaster richColors position="top-right" />
        </ThemeProvider>
      </body>
    </html>
  );
}
