/**
 * Cliente de servidor.
 *
 * Usa a chave de service role, que ignora RLS. Ela nunca pode aparecer
 * em componente de cliente: este arquivo só é importado por rota de
 * API. Depois da migration 0008, `resolver_compartilhamento` só executa
 * com esta chave — nem `anon` nem `authenticated` conseguem chamá-la.
 */

import { createClient, type SupabaseClient } from '@supabase/supabase-js';

/**
 * Validade da URL do comprovante.
 *
 * Curta de propósito. URL assinada é portador puro: sobrevive à
 * revogação do link e circula sozinha se alguém a copiar. Dois minutos
 * dão tempo de a imagem carregar e pouco mais que isso.
 */
export const URL_ASSINADA_SEGUNDOS = 120;

let cliente: SupabaseClient | null = null;

export function servidor(): SupabaseClient {
  if (cliente) return cliente;

  const url = process.env.SUPABASE_URL;
  const chave = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !chave) {
    throw new Error(
      'Faltam SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY no ambiente. Veja web/.env.example.',
    );
  }

  cliente = createClient(url, chave, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return cliente;
}
