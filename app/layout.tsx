/**
 * Layout raiz.
 *
 * Os metadados são fixos e genéricos de propósito. WhatsApp, Telegram e
 * Slack fazem GET na URL assim que a mensagem é enviada, antes de
 * qualquer pessoa clicar. Se o título trouxesse o nome do pet, o card
 * apareceria para o grupo inteiro sem ninguém abrir o link — e a imagem
 * viraria objeto cacheado no CDN deles, fora do alcance da revogação.
 */

import type { Metadata } from 'next';

import './globals.css';

export const metadata: Metadata = {
  title: 'Carteira de saúde compartilhada · AppPet',
  description: 'Um tutor compartilhou a carteira de vacinação do pet dele com você.',
  robots: { index: false, follow: false, nocache: true },
  referrer: 'no-referrer',
  openGraph: {
    title: 'Carteira de saúde compartilhada',
    description: 'Link temporário, enviado por um tutor do AppPet.',
    type: 'website',
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <body>{children}</body>
    </html>
  );
}
