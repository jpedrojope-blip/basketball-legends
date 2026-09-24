# Revisão de segurança — THE MAMBA

## Escopo revisado

Servidor HTTP, login do painel, API de métricas, publicação de arquivos estáticos, integração do jogo com analytics e renderização dos saves locais.

## Correções aplicadas

- Removida a senha padrão `1234`. O servidor exige `ADMIN_PASSWORD` configurada no `.env`.
- Em produção, são obrigatórios senha de 12+ caracteres, `SESSION_SECRET` de 32+ caracteres e `ANALYTICS_SALT` de 32+ caracteres.
- Login com cookie `HttpOnly`, `SameSite=Strict`, expiração limitada e assinatura HMAC.
- Login limitado a 5 tentativas por IP a cada 15 minutos; API de analytics e métricas também têm limites de requisição.
- Validação de origem e rejeição de requisições JSON inválidas, corpos grandes e eventos fora do formato esperado.
- CSP e cabeçalhos de segurança: `Content-Security-Policy`, `X-Content-Type-Options`, `X-Frame-Options`, `Referrer-Policy`, `Permissions-Policy` e `Cross-Origin-Opener-Policy`.
- Allowlist de arquivos estáticos: o servidor não expõe código-fonte, `.env`, dados de audiência ou caminhos arbitrários.
- IDs de visitantes e sessões são armazenados somente como hashes com salt; o progresso da carreira não entra na telemetria.
- Escape de valores vindos de `localStorage` antes de renderizar HTML e remoção de handlers inline, compatível com CSP forte.
- Retenção automática de dados agregados e sessões expiradas.

## Configuração mínima

1. Copie `.env.example` para `.env`.
2. Troque todos os valores de exemplo por valores aleatórios.
3. Em produção, use `NODE_ENV=production`, `ALLOW_FILE_ORIGIN=false` e HTTPS.
4. Se houver proxy reverso, configure `PUBLIC_ORIGIN` com a origem pública exata.
5. Não versione `.env` nem `data/`.

## Limites conhecidos

- Uma aplicação HTML local não consegue impedir o dono do navegador de editar o próprio `localStorage`. Por isso, o jogo é seguro contra envio acidental de dados para o painel, mas não é um sistema anti-fraude.
- O contador “online agora” é uma estimativa baseada em heartbeat e janela de 90 segundos.
- Para publicar na internet, ainda é necessário firewall/reverse proxy, HTTPS válido, atualizações do sistema e backup protegido do arquivo de métricas.
- [Nuclei da ProjectDiscovery](https://github.com/projectdiscovery/nuclei) é útil para testar a superfície HTTP do servidor em execução; ele não substitui esta revisão do código nem prova que não existem vulnerabilidades.
