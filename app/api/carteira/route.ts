/**
 * Resolve o link compartilhado.
 *
 * Três coisas moram aqui e em nenhum outro lugar:
 *
 * 1. O token chega no CORPO de um POST, nunca na URL. Assim ele não
 *    entra em log de servidor, log de CDN nem no cabeçalho Referer.
 *
 * 2. A resposta é idêntica para token inexistente, revogado e expirado.
 *    Distinguir os três diria a quem tem um token velho que ele já
 *    existiu, e para qual pet.
 *
 * 3. `comprovante_path` morre aqui. O caminho é `{uuid-do-tutor}/...`,
 *    então mandá-lo ao navegador entregaria o identificador do tutor e
 *    o horário de cada upload. Sai daqui só a URL assinada.
 */

import { NextResponse } from 'next/server';

import { servidor, URL_ASSINADA_SEGUNDOS } from '@/lib/supabase';

// Nunca pré-renderizar nem cachear: a resposta precisa morrer junto
// com o link.
export const dynamic = 'force-dynamic';
export const revalidate = 0;

interface CuidadoDoBanco {
  tipo: string;
  nome: string;
  realizado_em: string;
  proxima_em: string | null;
  veterinario: string | null;
  validado: boolean;
  comprovante_path: string | null;
}

interface CarteiraDoBanco {
  pet: {
    nome: string;
    especie: string;
    raca: string | null;
    nascimento: string | null;
    nascimento_aproximado: boolean;
    microchip: string | null;
  };
  /** Null no QR de coleira: link de emergência não expira (0011). */
  expira_em: string | null;
  escopo: string[];
  /** Null quando o escopo não inclui `emergencia`. */
  emergencia: Record<string, string | null> | null;
  cuidados: CuidadoDoBanco[];
  peso_atual: number | null;
}

/**
 * Limite por IP.
 *
 * ponytail: contador em memória, por instância. Em serverless cada
 * instância tem o seu, então isso segura acidente e robô bobo, não um
 * atacante distribuído. Trocar por Redis ou pelo limite da borda quando
 * houver tráfego real.
 */
const JANELA_MS = 60_000;
const MAXIMO_POR_JANELA = 10;
const acessos = new Map<string, { contagem: number; reinicia: number }>();

function excedeuLimite(ip: string): boolean {
  const agora = Date.now();
  const atual = acessos.get(ip);

  if (!atual || agora > atual.reinicia) {
    acessos.set(ip, { contagem: 1, reinicia: agora + JANELA_MS });
    return false;
  }

  atual.contagem += 1;
  return atual.contagem > MAXIMO_POR_JANELA;
}

/** Mesma resposta para tudo que não abre. */
function naoEncontrado() {
  return NextResponse.json({ erro: 'nao_encontrado' }, { status: 404 });
}

export async function POST(requisicao: Request) {
  const ip = requisicao.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'desconhecido';

  if (excedeuLimite(ip)) {
    return NextResponse.json({ erro: 'muitas_tentativas' }, { status: 429 });
  }

  let token: unknown;
  try {
    token = (await requisicao.json())?.token;
  } catch {
    return naoEncontrado();
  }

  // O token é hex de 48 caracteres. Recusar o resto aqui evita ida ao
  // banco por qualquer lixo que chegue.
  if (typeof token !== 'string' || !/^[0-9a-f]{48}$/.test(token)) {
    return naoEncontrado();
  }

  const supabase = servidor();
  const { data, error } = await supabase.rpc('resolver_compartilhamento', {
    p_token: token,
  });

  if (error || !data) return naoEncontrado();

  const carteira = data as CarteiraDoBanco;

  // Assina o que existir e descarta o caminho. Assinatura falhando não
  // pode derrubar a página: o resto da carteira ainda vale.
  const cuidados = await Promise.all(
    carteira.cuidados.map(async (c) => {
      const { comprovante_path, ...resto } = c;
      if (!comprovante_path) return { ...resto, comprovante_url: null };

      const { data: assinada } = await supabase.storage
        .from('comprovantes')
        .createSignedUrl(comprovante_path, URL_ASSINADA_SEGUNDOS);

      return { ...resto, comprovante_url: assinada?.signedUrl ?? null };
    }),
  );

  return NextResponse.json(
    { ...carteira, cuidados },
    { headers: { 'Cache-Control': 'no-store, private, max-age=0, must-revalidate' } },
  );
}
