# appet-web

Página pública do AppPet. Hoje serve um único caso: abrir a carteira de saúde de um
pet a partir de um link temporário que o tutor enviou, sem exigir conta nem
instalação. O aplicativo em si é outro repositório.

## Por que a página é assim

O conteúdo é dado de saúde, servido sem login, a partir de um segredo que circula por
WhatsApp. Três decisões carregam quase toda a proteção, e nenhuma é óbvia lendo o
código pronto:

**O token vai no fragmento da URL** (`/c#token`), nunca no caminho. Fragmento não entra
na linha de requisição, então não aparece em log de servidor, log de CDN nem no
cabeçalho `Referer`. No caminho, o segredo ficaria meses em registros de
infraestrutura cujo acesso não é o mesmo acesso ao dado clínico.

**O HTML sai sem nenhum dado.** Os dados só chegam depois de um clique. WhatsApp,
Telegram e Slack fazem `GET` no link assim que a mensagem é enviada, antes de qualquer
pessoa abrir; sem esse intervalo, o nome do pet e o histórico apareceriam no card para
o grupo inteiro. O mesmo clique derruba robô de buscador e prefetch de navegador.

**O caminho do comprovante morre no servidor.** Ele tem o formato
`{uuid-do-tutor}/{timestamp}.jpg`, então entregá-lo ao navegador revelaria o
identificador do tutor e o horário de cada upload. A rota de API assina e devolve
apenas a URL, válida por dois minutos — URL assinada é portador puro e sobrevive à
revogação do link, então quanto mais curta, melhor.

Além disso: resposta `404` idêntica para token inexistente, revogado e expirado
(distinguir contaria a quem tem um token velho que ele existiu, e para qual pet);
`X-Robots-Tag: noindex`; `Cache-Control: no-store`; e uma CSP com `default-src 'self'`
que proíbe recurso de terceiro por construção — é o que impede alguém acrescentar um
analytics numa página com prontuário e vazar tudo sem perceber.

## Rodar

```bash
npm install
cp .env.example .env.local   # preencha as duas variáveis
npm run dev
```

| Variável | O que é |
|---|---|
| `SUPABASE_URL` | URL do projeto Supabase |
| `SUPABASE_SERVICE_ROLE_KEY` | Chave de service role, **só servidor** |

Nenhuma das duas leva o prefixo `NEXT_PUBLIC_`. Com ele, o Next embutiria os valores no
pacote do navegador, e a chave de service role ignora o RLS inteiro.

O banco exige as migrations do repositório do aplicativo aplicadas até a `0008`: é ela
que passa a guardar apenas o hash do token e restringe `resolver_compartilhamento` ao
papel `service_role`.

Para testar, gere um link pelo aplicativo e abra em aba anônima. `curl` não serve:
mascara justamente os problemas que só aparecem em navegador.

## Limitações conhecidas

O limite de requisições é um contador em memória, por instância. Em ambiente
serverless cada instância tem o seu, então ele segura acidente e robô simples, não um
atacante distribuído. Trocar pelo limite da borda quando houver tráfego real.

O token permanece no histórico do navegador de quem abriu. No computador de uma
clínica, compartilhado por vários profissionais, isso persiste. A correção seria trocar
o token por um cookie de sessão curto logo após o primeiro carregamento, ao custo de
recarregar a página deixar de funcionar.

## Adiante

A busca de plantão veterinário por bairro, essa sim indexável, com dados estruturados
`schema.org/VeterinaryCare`. É o oposto desta página em requisitos, e por isso mora no
mesmo lugar: precisa de domínio próprio e de HTML pronto no servidor.
