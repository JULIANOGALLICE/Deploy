import React, { useState } from 'react';
import { BookOpen, GitBranch, Terminal, Shield, Key, Globe, Check, Copy, ExternalLink, HelpCircle, Layers } from 'lucide-react';

export const GuideTab: React.FC = () => {
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  const copySnippet = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(id);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  return (
    <div className="space-y-8 max-w-5xl mx-auto">
      {/* Intro */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-6 lg:p-8 space-y-3">
        <div className="inline-flex items-center gap-2 text-xs font-semibold text-emerald-400">
          <BookOpen className="w-4 h-4" />
          Manual Completo de Deploy Git → VPS
        </div>
        <h2 className="text-2xl font-bold text-white">
          Como automatizar a publicação contínua de um projeto em uma VPS
        </h2>
        <p className="text-sm text-slate-300 leading-relaxed">
          Neste guia você aprenderá como transformar o projeto desenvolvido aqui em uma aplicação
          autônoma rodando na sua VPS, com atualização automática a cada <code className="text-emerald-400">git push</code>,
          isolamento de portas e certificado SSL gratuito.
        </p>
      </div>

      {/* Alerta de Erro de Conexão Recusada */}
      <div className="p-5 bg-amber-500/10 border border-amber-500/30 rounded-xl space-y-3 text-xs">
        <div className="flex items-center gap-2 text-amber-300 font-semibold text-sm">
          <HelpCircle className="w-4 h-4 shrink-0" />
          <span>Viu o erro "A conexão com IP:PORTA foi recusada (ERR_CONNECTION_REFUSED)"?</span>
        </div>
        <p className="text-slate-300 leading-relaxed">
          Esse erro acontece quando o navegador tenta acessar a porta da VPS mas não há nenhum processo ativo escutando nela ou o firewall bloqueou. Siga estes 3 passos no terminal da VPS (Locaweb/Hostinger):
        </p>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-1">
          <div className="p-3 bg-slate-950/80 border border-slate-800 rounded-lg space-y-1">
            <strong className="text-white block">1. Liberar a porta no Firewall</strong>
            <code className="text-emerald-300 font-mono text-[11px] block">sudo ufw allow 3000/tcp</code>
          </div>
          <div className="p-3 bg-slate-950/80 border border-slate-800 rounded-lg space-y-1">
            <strong className="text-white block">2. Iniciar escutando em 0.0.0.0</strong>
            <code className="text-emerald-300 font-mono text-[11px] block">--host 0.0.0.0 --port 3000</code>
          </div>
          <div className="p-3 bg-slate-950/80 border border-slate-800 rounded-lg space-y-1">
            <strong className="text-white block">3. Fixar no PM2</strong>
            <code className="text-emerald-300 font-mono text-[11px] block">pm2 start ... && pm2 save</code>
          </div>
        </div>
      </div>

      {/* Passo a Passo */}
      <div className="space-y-6">
        {/* Passo 1: Exportar do AI Studio para o GitHub */}
        <section className="bg-slate-900/80 border border-slate-800 rounded-xl p-6 space-y-4">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400 font-bold text-sm">
              1
            </div>
            <div>
              <h3 className="text-base font-semibold text-white">
                Como enviar o projeto do Google AI Studio para o GitHub
              </h3>
              <p className="text-xs text-slate-400">
                Criando o repositório remoto para permitir o versionamento do código.
              </p>
            </div>
          </div>

          <div className="text-xs text-slate-300 space-y-3 leading-relaxed">
            <p>
              1. Crie um repositório vazio no seu <a href="https://github.com/new" target="_blank" rel="noreferrer" className="text-emerald-400 hover:underline inline-flex items-center gap-1">GitHub <ExternalLink className="w-3 h-3" /></a> (ex: <code className="text-white bg-slate-950 px-1 py-0.5 rounded">meu-app-aistudio</code>).
            </p>
            <p>
              2. No terminal local da sua máquina onde você clonou os arquivos deste projeto, vincule o repositório remoto:
            </p>
            <div className="relative bg-slate-950 p-3.5 rounded-lg border border-slate-800 font-mono text-xs text-slate-200">
              <button
                onClick={() =>
                  copySnippet(
                    `git init\ngit add .\ngit commit -m "feat: initial commit from Google AI Studio"\ngit branch -M main\ngit remote add origin https://github.com/SEU_USUARIO/meu-app-aistudio.git\ngit push -u origin main`,
                    'git-init'
                  )
                }
                className="absolute top-2.5 right-2.5 text-slate-400 hover:text-white p-1 rounded"
              >
                {copiedKey === 'git-init' ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
              </button>
              <pre className="overflow-x-auto whitespace-pre">
{`git init
git add .
git commit -m "feat: initial commit from Google AI Studio"
git branch -M main
git remote add origin https://github.com/SEU_USUARIO/meu-app-aistudio.git
git push -u origin main`}
              </pre>
            </div>
          </div>
        </section>

        {/* Passo 2: Configurar Acesso SSH sem senha na VPS */}
        <section className="bg-slate-900/80 border border-slate-800 rounded-xl p-6 space-y-4">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400 font-bold text-sm">
              2
            </div>
            <div>
              <h3 className="text-base font-semibold text-white">
                Como configurar acesso SSH na VPS para automação sem senha
              </h3>
              <p className="text-xs text-slate-400">
                O GitHub Actions ou seu script precisam de uma chave SSH autorizada para conectar sem intervenção humana.
              </p>
            </div>
          </div>

          <div className="text-xs text-slate-300 space-y-3 leading-relaxed">
            <p>
              Para que robôs de CI/CD conectem na sua VPS de forma segura, você cria um par de chaves SSH:
            </p>
            <div className="relative bg-slate-950 p-3.5 rounded-lg border border-slate-800 font-mono text-xs text-slate-200">
              <button
                onClick={() =>
                  copySnippet(
                    `# 1. No seu computador, gere um par de chaves dedicado:\nssh-keygen -t ed25519 -C "deploy-key-cicd" -f ~/.ssh/vps_deploy_key -N ""\n\n# 2. Copie a chave PÚBLICA para o servidor VPS:\nssh-copy-id -i ~/.ssh/vps_deploy_key.pub root@SEU_IP_DA_VPS\n\n# 3. O conteúdo da chave PRIVADA (~/.ssh/vps_deploy_key) será colocado no GitHub Secrets!`,
                    'ssh-gen'
                  )
                }
                className="absolute top-2.5 right-2.5 text-slate-400 hover:text-white p-1 rounded"
              >
                {copiedKey === 'ssh-gen' ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
              </button>
              <pre className="overflow-x-auto whitespace-pre">
{`# 1. No seu computador, gere um par de chaves dedicado:
ssh-keygen -t ed25519 -C "deploy-key-cicd" -f ~/.ssh/vps_deploy_key -N ""

# 2. Copie a chave PÚBLICA para o servidor VPS:
ssh-copy-id -i ~/.ssh/vps_deploy_key.pub root@SEU_IP_DA_VPS

# 3. O conteúdo da chave PRIVADA (~/.ssh/vps_deploy_key)
# será colocado como o segredo VPS_SSH_KEY no GitHub!`}
              </pre>
            </div>
          </div>
        </section>

        {/* Passo 3: Como funciona a escolha da Porta */}
        <section className="bg-slate-900/80 border border-slate-800 rounded-xl p-6 space-y-4">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400 font-bold text-sm">
              3
            </div>
            <div>
              <h3 className="text-base font-semibold text-white">
                Como escolher em qual porta a aplicação vai funcionar
              </h3>
              <p className="text-xs text-slate-400">
                Isolamento de processos múltiplos em um único servidor VPS.
              </p>
            </div>
          </div>

          <div className="text-xs text-slate-300 space-y-3 leading-relaxed">
            <p>
              Em um servidor Linux, uma mesma porta TCP não pode ser escutada por dois programas diferentes ao mesmo tempo. Por isso, organizamos da seguinte maneira:
            </p>
            <ul className="list-disc list-inside space-y-1.5 text-slate-400 pl-2">
              <li><strong className="text-white">Aplicação Frontend React / Vite:</strong> pode rodar na porta <code className="text-emerald-400 font-mono">3000</code> ou <code className="text-emerald-400 font-mono">3001</code>.</li>
              <li><strong className="text-white">API Backend Node.js / Express:</strong> pode rodar na porta <code className="text-emerald-400 font-mono">8080</code> ou <code className="text-emerald-400 font-mono">5000</code>.</li>
              <li><strong className="text-white">Microserviço ou Worker Docker:</strong> pode mapear <code className="text-emerald-400 font-mono">-p 4000:4000</code>.</li>
            </ul>
            <p>
              Ao disparar a inicialização com o <strong className="text-white">PM2</strong> ou <strong className="text-white">Docker</strong>, passamos a variável de ambiente:
            </p>
            <div className="bg-slate-950 p-3 rounded-lg border border-slate-800 font-mono text-xs text-slate-200">
              PORT=3000 pm2 start "npm run preview -- --port 3000 --host 0.0.0.0" --name app-frontend
            </div>
          </div>
        </section>

        {/* Passo 4: Como ativar o Deploy Contínuo (CI/CD) a cada push */}
        <section className="bg-slate-900/80 border border-slate-800 rounded-xl p-6 space-y-4">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400 font-bold text-sm">
              4
            </div>
            <div>
              <h3 className="text-base font-semibold text-white">
                Como configurar as atualizações contínuas a cada 'git push'
              </h3>
              <p className="text-xs text-slate-400">
                Existem dois caminhos principais: GitHub Actions ou Webhook na VPS.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs text-slate-300">
            <div className="p-4 bg-slate-950 rounded-lg border border-slate-800 space-y-2">
              <div className="font-semibold text-emerald-400 text-sm">Caminho A: GitHub Actions (Mais fácil)</div>
              <p className="text-slate-400 leading-relaxed">
                Você coloca o arquivo <code className="text-white">.github/workflows/deploy.yml</code> (gerado na aba CI/CD deste app). Sempre que fizer commit no GitHub, os servidores do GitHub conectam na sua VPS via SSH, executam <code className="text-white">git pull</code>, <code className="text-white">npm run build</code> e recarregam o PM2.
              </p>
              <div className="text-[11px] text-emerald-300">✓ Vantagens: Logs visíveis no GitHub, histórico de builds, não requer porta aberta para webhooks.</div>
            </div>

            <div className="p-4 bg-slate-950 rounded-lg border border-slate-800 space-y-2">
              <div className="font-semibold text-emerald-400 text-sm">Caminho B: Webhook na VPS (Ultraleve)</div>
              <p className="text-slate-400 leading-relaxed">
                Você roda o script <code className="text-white">webhook-server.js</code> (gerado na aba CI/CD) na porta 9000 da VPS. No GitHub (Settings → Webhooks), cadastra essa URL. Quando você faz push, o GitHub envia uma notificação HTTP e a VPS atualiza a si mesma.
              </p>
              <div className="text-[11px] text-emerald-300">✓ Vantagens: Roda 100% no servidor, zero dependência de minutos de computação do GitHub.</div>
            </div>
          </div>
        </section>

        {/* Passo 5: Nginx e Certificado SSL Let's Encrypt */}
        <section className="bg-slate-900/80 border border-slate-800 rounded-xl p-6 space-y-4">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400 font-bold text-sm">
              5
            </div>
            <div>
              <h3 className="text-base font-semibold text-white">
                Como configurar seu Domínio e SSL HTTPS Grátis (Let's Encrypt ou Autoassinado)
              </h3>
              <p className="text-xs text-slate-400">
                Transformando a porta interna (ex: 3000, 3001) em um endereço seguro com cadeado verde https://app.meudominio.com.br.
              </p>
            </div>
          </div>

          <div className="text-xs text-slate-300 space-y-3 leading-relaxed">
            <p>
              Você pode instalar o SSL diretamente pelo painel clicando no botão <strong>"Instalar SSL"</strong> em qualquer aplicação! O painel suporta dois modos:
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-1">
              <div className="p-3.5 bg-slate-950 rounded-lg border border-slate-800 space-y-2">
                <strong className="text-emerald-400 block font-semibold">1. Let's Encrypt (Recomendado & Oficial)</strong>
                <p className="text-slate-400 text-[11px]">
                  Crie uma entrada DNS tipo <strong>A</strong> no seu provedor (Cloudflare, Registro.br, Locaweb) apontando seu domínio para o IP da VPS. O Certbot gerará o certificado gratuito e renovará automaticamente.
                </p>
                <code className="text-slate-300 bg-slate-900 px-2 py-1 rounded block text-[11px]">
                  sudo certbot --nginx -d seudominio.com.br
                </code>
              </div>

              <div className="p-3.5 bg-slate-950 rounded-lg border border-slate-800 space-y-2">
                <strong className="text-cyan-400 block font-semibold">2. Autoassinado OpenSSL (Imediato para Testes)</strong>
                <p className="text-slate-400 text-[11px]">
                  Gera o SSL na hora na porta 443 mesmo sem domínio público propagado. Funciona direto com o IP ou subdomínio provisório.
                </p>
                <code className="text-slate-300 bg-slate-900 px-2 py-1 rounded block text-[11px]">
                  openssl req -x509 -nodes -days 365 -newkey rsa:2048 ...
                </code>
              </div>
            </div>
          </div>
        </section>

        {/* Passo 6: Desinstalar Serviços e Apagar Arquivos na VPS */}
        <section className="bg-slate-900/80 border border-slate-800 rounded-xl p-6 space-y-4">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-rose-500/10 border border-rose-500/30 flex items-center justify-center text-rose-400 font-bold text-sm">
              6
            </div>
            <div>
              <h3 className="text-base font-semibold text-white">
                Como desinstalar um serviço e apagar tudo o que foi instalado na VPS
              </h3>
              <p className="text-xs text-slate-400">
                Removendo processos do PM2, liberando portas e apagando as pastas do projeto em /var/www/.
              </p>
            </div>
          </div>

          <div className="text-xs text-slate-300 space-y-3 leading-relaxed">
            <p>
              Tanto pelo painel quanto pelo terminal SSH, você pode remover completamente uma aplicação ou fazer uma limpeza geral:
            </p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-1">
              <div className="p-3.5 bg-slate-950 rounded-lg border border-slate-800 space-y-2">
                <strong className="text-rose-400 block font-semibold">Desinstalar 1 Aplicação Específica</strong>
                <p className="text-slate-400 text-[11px]">
                  No painel, clique em <strong>"Desinstalar"</strong> no card da aplicação. Ele executa na VPS:
                </p>
                <pre className="p-2.5 bg-slate-900 rounded font-mono text-[11px] text-slate-200 overflow-x-auto">
{`# 1. Parar e remover do PM2:
pm2 delete nome-do-app && pm2 save

# 2. Apagar a pasta e arquivos:
rm -rf /var/www/nome-do-app

# 3. Remover proxy do Nginx:
rm -f /etc/nginx/sites-enabled/nome-do-app
systemctl reload nginx`}
                </pre>
              </div>

              <div className="p-3.5 bg-slate-950 rounded-lg border border-slate-800 space-y-2">
                <strong className="text-rose-400 block font-semibold">Limpeza Completa da VPS (Apagar Tudo)</strong>
                <p className="text-slate-400 text-[11px]">
                  Na aba <strong>Servidores VPS</strong>, use o botão <strong>"Limpar VPS (Reset Geral)"</strong>. Ele executa:
                </p>
                <pre className="p-2.5 bg-slate-900 rounded font-mono text-[11px] text-slate-200 overflow-x-auto">
{`# 1. Parar todos os processos PM2:
pm2 delete all && pm2 save

# 2. Apagar todas as aplicações:
rm -rf /var/www/*

# 3. Limpar sites do Nginx:
rm -f /etc/nginx/sites-enabled/*
systemctl reload nginx`}
                </pre>
              </div>
            </div>
          </div>
        </section>

        {/* Seção 7: Perguntas Frequentes (FAQ) Técnicas */}
        <section className="bg-slate-900/80 border border-slate-800 rounded-xl p-6 space-y-4">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400 font-bold text-sm">
              7
            </div>
            <div>
              <h3 className="text-base font-semibold text-white">
                Dúvidas Frequentes & Dicas Avançadas
              </h3>
              <p className="text-xs text-slate-400">
                Respostas práticas sobre subdomínios em IP, Login Google e controle de processos reais.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs text-slate-300">
            {/* FAQ 1 */}
            <div className="p-4 bg-slate-950 rounded-lg border border-slate-800 space-y-2">
              <strong className="text-white block font-semibold text-sm">
                1. Posso usar subdomínio direto no IP como <code className="text-amber-300">https://nfe.177.153.67.226</code>?
              </strong>
              <p className="text-slate-400 leading-relaxed text-[11px]">
                <strong>Não diretamente</strong>, porque o sistema DNS mundial não reconhece subdomínios na frente de números IP puros.
              </p>
              <div className="p-2.5 bg-slate-900 rounded border border-slate-800 space-y-1 text-[11px]">
                <div className="text-emerald-400 font-medium">Soluções que funcionam com SSL:</div>
                <ul className="list-disc list-inside space-y-1 text-slate-300">
                  <li><strong>DNS Wildcard Grátis:</strong> use <code className="text-emerald-300 font-mono">https://nfe.177.153.67.226.nip.io</code> (aponta automaticamente para o IP).</li>
                  <li><strong>Domínio Próprio:</strong> crie uma entrada DNS tipo A para <code className="text-emerald-300 font-mono">nfe.seusite.com.br</code> apontando para o IP da VPS.</li>
                  <li><strong>Por Rota:</strong> use <code className="text-emerald-300 font-mono">https://177.153.67.226/nfe</code> via Nginx.</li>
                </ul>
              </div>
            </div>

            {/* FAQ 2 */}
            <div className="p-4 bg-slate-950 rounded-lg border border-slate-800 space-y-2">
              <strong className="text-white block font-semibold text-sm">
                2. Para que serve o Login Google no topo do painel?
              </strong>
              <p className="text-slate-400 leading-relaxed text-[11px]">
                O Login Google autentica você como <strong>Operador / Engenheiro DevOps</strong> responsável pelos servidores.
              </p>
              <div className="p-2.5 bg-slate-900 rounded border border-slate-800 space-y-1 text-[11px] text-slate-300">
                <div>✓ <strong>Identificação:</strong> Vincula seu e-mail aos deploys executados e aos logs de auditoria gravados no Firestore.</div>
                <div>✓ <strong>Segurança:</strong> Permite proteger credenciais sensíveis (chaves SSH, tokens do GitHub) para que apenas operadores autorizados gerenciem a infraestrutura.</div>
              </div>
            </div>

            {/* FAQ 3 */}
            <div className="p-4 bg-slate-950 rounded-lg border border-slate-800 space-y-2">
              <strong className="text-white block font-semibold text-sm">
                3. O que acontece ao Pausar ou Desinstalar?
              </strong>
              <p className="text-slate-400 leading-relaxed text-[11px]">
                As ações refletem diretamente na máquina real via SSH:
              </p>
              <div className="p-2.5 bg-slate-900 rounded border border-slate-800 space-y-1 text-[11px] text-slate-300">
                <div>• <strong>Pausar:</strong> Executa <code className="text-amber-300 font-mono">pm2 stop</code>, salva o estado do PM2 e libera a porta TCP para que não fique em escuta.</div>
                <div>• <strong>Proteção contra exclusão:</strong> O painel bloqueia a exclusão de um servidor que tenha apps ativas, e bloqueia a exclusão de uma aplicação até que seja feita a desinstalação segura da VPS.</div>
              </div>
            </div>
          </div>
        </section>

        {/* Painéis Self-Hosted Prontos */}
        <section className="bg-slate-900/60 border border-slate-800 rounded-xl p-6 space-y-4">
          <div className="flex items-center gap-2">
            <Layers className="w-5 h-5 text-emerald-400" />
            <h3 className="text-base font-semibold text-white">
              Gostaria de um painel completo instalado na sua própria VPS?
            </h3>
          </div>
          <p className="text-xs text-slate-400 leading-relaxed">
            Se você quiser uma interface web instalada diretamente dentro da sua VPS para gerenciar múltiplos repositórios com interface gráfica idêntica à Vercel / Heroku, você pode instalar uma dessas ferramentas de código aberto:
          </p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
            <div className="p-3.5 bg-slate-950 rounded-lg border border-slate-800 space-y-1.5">
              <strong className="text-white">Coolify (Altamente recomendado)</strong>
              <p className="text-slate-400 text-[11px]">
                O mais moderno. Uma alternativa auto-hospedada à Vercel e Heroku. Instala com 1 comando Docker e tem deploy automático via Git e SSL.
              </p>
              <div className="font-mono text-[10px] text-emerald-400">curl -fsSL https://cdn.coollabs.io/coolify/install.sh | bash</div>
            </div>

            <div className="p-3.5 bg-slate-950 rounded-lg border border-slate-800 space-y-1.5">
              <strong className="text-white">Dokku</strong>
              <p className="text-slate-400 text-[11px]">
                Um mini-Heroku baseado em Docker. Você faz deploy simplesmente rodando <code className="text-white">git push dokku main</code> do seu terminal.
              </p>
              <div className="font-mono text-[10px] text-emerald-400">dokku apps:create meu-app</div>
            </div>

            <div className="p-3.5 bg-slate-950 rounded-lg border border-slate-800 space-y-1.5">
              <strong className="text-white">CapRover</strong>
              <p className="text-slate-400 text-[11px]">
                Painel muito simples para Docker e Node.js com suporte a certificados SSL em 1 clique e mapeamento de portas fácil.
              </p>
              <div className="font-mono text-[10px] text-emerald-400">npm install -g caprover</div>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
};
