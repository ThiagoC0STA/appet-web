'use client';

/**
 * Carteira compartilhada.
 *
 * O desenho desta página é a proteção, não a decoração:
 *
 * - O token vem no FRAGMENTO da URL (`/c#token`), não no caminho.
 *   Fragmento não entra na linha de requisição, então não aparece em
 *   log de servidor, log de CDN nem no cabeçalho Referer.
 *
 * - O HTML sai sem nenhum dado do pet. Os dados só chegam depois de um
 *   clique. Isso derruba de uma vez o preview de WhatsApp e Telegram, o
 *   robô de buscador e o prefetch do navegador: todos veem a casca.
 *
 * - Nada de terceiro carrega aqui. A CSP bloqueia, e é o que impede
 *   alguém acrescentar um analytics e mandar histórico clínico embora
 *   sem perceber.
 */

import { useEffect, useState } from 'react';

interface Cuidado {
  tipo: string;
  nome: string;
  realizado_em: string;
  proxima_em: string | null;
  veterinario: string | null;
  validado: boolean;
  comprovante_url: string | null;
}

interface FichaEmergencia {
  contato_nome: string | null;
  contato_telefone: string | null;
  veterinario: string | null;
  veterinario_telefone: string | null;
  alergias: string | null;
  condicoes: string | null;
  observacao: string | null;
}

interface DadosCarteira {
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
  /** Null quando o tutor não marcou o escopo `emergencia`. */
  emergencia: FichaEmergencia | null;
  cuidados: Cuidado[];
  peso_atual: number | null;
}

const MESES = [
  'jan',
  'fev',
  'mar',
  'abr',
  'mai',
  'jun',
  'jul',
  'ago',
  'set',
  'out',
  'nov',
  'dez',
];

/** `2026-07-04` vira `04 jul 2026`. Sem `Date`: fuso não muda a data. */
function dataLonga(iso: string): string {
  const [ano, mes, dia] = iso.slice(0, 10).split('-');
  return `${dia} ${MESES[Number(mes) - 1]} ${ano}`;
}

type Estado = 'espera' | 'carregando' | 'pronto' | 'invalido' | 'limite' | 'sem_token';

export default function Carteira() {
  const [estado, setEstado] = useState<Estado>('espera');
  const [dados, setDados] = useState<DadosCarteira | null>(null);

  useEffect(() => {
    // O fragmento só existe no navegador; o servidor nunca o recebe.
    if (!window.location.hash.slice(1)) setEstado('sem_token');
  }, []);

  const abrir = async () => {
    const token = window.location.hash.slice(1);
    if (!token) {
      setEstado('sem_token');
      return;
    }

    setEstado('carregando');
    try {
      const resposta = await fetch('/api/carteira', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token }),
      });

      if (resposta.status === 429) {
        setEstado('limite');
        return;
      }
      if (!resposta.ok) {
        setEstado('invalido');
        return;
      }

      setDados(await resposta.json());
      setEstado('pronto');
    } catch {
      setEstado('invalido');
    }
  };

  if (estado === 'sem_token') {
    return (
      <main>
        <div className="cartao">
          <h1>Link incompleto</h1>
          <p className="aviso">
            Falta a parte final do endereço. Copie o link inteiro da mensagem que você recebeu,
            sem cortar nada depois do <code>#</code>.
          </p>
        </div>
      </main>
    );
  }

  if (estado === 'invalido') {
    return (
      <main>
        <div className="cartao">
          <h1>Este link não abre mais</h1>
          <p className="aviso">
            Ele expirou ou o tutor cancelou o acesso. Peça um link novo para quem enviou.
          </p>
        </div>
      </main>
    );
  }

  if (estado === 'limite') {
    return (
      <main>
        <div className="cartao">
          <h1>Muitas tentativas</h1>
          <p className="aviso">Espere um minuto e tente de novo.</p>
        </div>
      </main>
    );
  }

  if (estado !== 'pronto' || !dados) {
    return (
      <main>
        <div className="cartao">
          <h1>Carteira de saúde</h1>
          <p className="aviso">
            Um tutor compartilhou a carteira de saúde do pet dele com você. O conteúdo só é
            carregado quando você abre, e o tutor pode cancelar o acesso a qualquer momento.
          </p>
          <button
            className="botao"
            onClick={abrir}
            disabled={estado === 'carregando'}
            style={{ marginTop: 20 }}>
            {estado === 'carregando' ? 'Abrindo…' : 'Ver carteira'}
          </button>
        </div>
        <p className="rodape">AppPet</p>
      </main>
    );
  }

  const { pet, cuidados, peso_atual, expira_em, escopo, emergencia } = dados;
  const especie = pet.especie === 'cao' ? 'Cão' : 'Gato';
  // Ficha marcada mas em branco não vira seção vazia com título.
  const temFicha = emergencia && Object.values(emergencia).some(Boolean);

  return (
    <main>
      <div className="cartao">
        <h1>{pet.nome}</h1>
        <p className="aviso">{[especie, pet.raca].filter(Boolean).join(' · ')}</p>

        {pet.nascimento || pet.microchip ? (
          <p className="aviso" style={{ marginTop: 12 }}>
            {pet.nascimento
              ? `Nascimento: ${dataLonga(pet.nascimento)}${
                  pet.nascimento_aproximado ? ' (aproximado)' : ''
                }`
              : null}
            {pet.nascimento && pet.microchip ? <br /> : null}
            {pet.microchip ? `Microchip: ${pet.microchip}` : null}
          </p>
        ) : null}

        {peso_atual !== null ? (
          <p className="aviso" style={{ marginTop: 12 }}>
            Peso mais recente: {String(peso_atual).replace('.', ',')} kg
          </p>
        ) : null}
      </div>

      {/* Vem antes do histórico: numa urgência é o que se lê primeiro. */}
      {temFicha && emergencia ? (
        <>
          <h2>Em caso de emergência</h2>
          <div className="cartao urgente">
            {emergencia.alergias ? (
              <p className="alerta">
                <strong>Alergias:</strong> {emergencia.alergias}
              </p>
            ) : null}
            {emergencia.condicoes ? (
              <p className="alerta">
                <strong>Condições e medicação:</strong> {emergencia.condicoes}
              </p>
            ) : null}
            {emergencia.contato_nome || emergencia.contato_telefone ? (
              <p className="aviso">
                <strong>Contato:</strong>{' '}
                {[emergencia.contato_nome, emergencia.contato_telefone]
                  .filter(Boolean)
                  .join(' · ')}
              </p>
            ) : null}
            {emergencia.veterinario || emergencia.veterinario_telefone ? (
              <p className="aviso">
                <strong>Veterinário de referência:</strong>{' '}
                {[emergencia.veterinario, emergencia.veterinario_telefone]
                  .filter(Boolean)
                  .join(' · ')}
              </p>
            ) : null}
            {emergencia.observacao ? <p className="aviso">{emergencia.observacao}</p> : null}
          </div>
        </>
      ) : null}

      {escopo.includes('cuidados') ? (
        <>
          <h2>Cuidados registrados</h2>
          <div className="cartao">
            {cuidados.length === 0 ? (
              <p className="aviso">Nenhum cuidado registrado até agora.</p>
            ) : (
              cuidados.map((c, i) => (
                <div className="registro" key={`${c.realizado_em}-${c.nome}-${i}`}>
                  <div className="data">{dataLonga(c.realizado_em)}</div>
                  <div style={{ flex: 1 }}>
                    <div className="nome">{c.nome}</div>
                    <div className="detalhe">
                      {[
                        c.tipo,
                        c.veterinario,
                        c.proxima_em
                          ? `próxima em ${dataLonga(c.proxima_em)}`
                          : 'próxima a confirmar',
                      ]
                        .filter(Boolean)
                        .join(' · ')}
                    </div>
                    {c.validado ? <span className="selo">Validado por veterinário</span> : null}
                    {c.comprovante_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        className="comprovante"
                        src={c.comprovante_url}
                        alt={`Comprovante de ${c.nome}`}
                      />
                    ) : null}
                  </div>
                </div>
              ))
            )}
          </div>
        </>
      ) : null}

      <p className="rodape">
        {expira_em
          ? `Este link deixa de funcionar em ${dataLonga(expira_em)}, ou antes disso se o tutor cancelar.`
          : 'Este link continua aberto até o tutor cancelar.'}
        <br />
        Registrado no AppPet. Confirme sempre com o veterinário.
      </p>
    </main>
  );
}
