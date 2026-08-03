/**
 * Os cabeçalhos daqui não são enfeite: são metade da proteção da
 * página. A carteira é dado de saúde servido sem login, a partir de um
 * segredo que circula por WhatsApp.
 *
 * @type {import('next').NextConfig}
 */
const nextConfig = {
  poweredByHeader: false,

  async headers() {
    return [
      {
        // Vale para a página e para o endpoint que devolve os dados.
        source: '/:path*',
        headers: [
          // Buscador não pode indexar carteira de saúde. Cabeçalho, e
          // não só a meta tag, porque o HTML sai vazio até o clique e
          // um robô que leia só o corpo não veria meta nenhuma.
          {
            key: 'X-Robots-Tag',
            value: 'noindex, nofollow, noarchive, nosnippet, noimageindex',
          },
          // Sem isso, qualquer recurso externo levaria a URL junto.
          // Não há recurso externo aqui, mas link de saída também leva.
          { key: 'Referrer-Policy', value: 'no-referrer' },
          // CDN, proxy e o botão voltar do navegador não podem guardar
          // a resposta: ela precisa morrer junto com o link.
          { key: 'Cache-Control', value: 'no-store, private, max-age=0, must-revalidate' },
          // A CSP proíbe recurso de terceiro por construção. É o que
          // impede alguém acrescentar um analytics numa página com
          // histórico clínico e vazar tudo sem perceber.
          {
            key: 'Content-Security-Policy',
            value: [
              "default-src 'self'",
              "script-src 'self'",
              "style-src 'self' 'unsafe-inline'",
              // As fotos de comprovante vêm assinadas do Storage.
              "img-src 'self' data: https://*.supabase.co",
              "connect-src 'self'",
              "font-src 'self'",
              "frame-ancestors 'none'",
              "base-uri 'none'",
              "form-action 'none'",
            ].join('; '),
          },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'X-Frame-Options', value: 'DENY' },
        ],
      },
    ];
  },
};

export default nextConfig;
