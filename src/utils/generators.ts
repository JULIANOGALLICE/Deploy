import { DeploymentProject, VpsServer } from '../types/deploy';

/**
 * Gera o script bash de deploy automatizado que roda diretamente no servidor
 */
export function generateDeployBashScript(vps: VpsServer, project: DeploymentProject): string {
  const envFileContent = project.envVariables
    .map(ev => `${ev.key}="${ev.value}"`)
    .join('\n');

  if (project.runtime === 'docker') {
    return `#!/usr/bin/env bash
# ==============================================================================
# Script de Deploy Contínuo Git -> VPS (Docker)
# Projeto: ${project.name} (Porta: ${project.appPort})
# Servidor: ${vps.host}
# ==============================================================================
set -euo pipefail

APP_DIR="${project.serverPath}"
REPO_URL="${project.gitRepoUrl}"
BRANCH="${project.branch}"
PORT="${project.appPort}"

echo "🚀 [$(date '+%Y-%m-%d %H:%M:%S')] Iniciando deploy do projeto: ${project.name}..."

# 1. Garante que o diretório existe e clona ou atualiza via Git
if [ ! -d "$APP_DIR/.git" ]; then
  echo "📦 Clonando repositório $REPO_URL no branch $BRANCH..."
  mkdir -p "$APP_DIR"
  git clone -b "$BRANCH" "$REPO_URL" "$APP_DIR"
  cd "$APP_DIR"
else
  echo "🔄 Atualizando repositório existente..."
  cd "$APP_DIR"
  git fetch origin "$BRANCH"
  git reset --hard "origin/$BRANCH"
fi

# 2. Injeta variáveis de ambiente (.env)
echo "🔒 Configurando arquivo .env..."
cat << 'EOF' > "$APP_DIR/.env"
PORT=${project.appPort}
NODE_ENV=production
${envFileContent}
EOF

# 3. Build e subida do container Docker
echo "🐳 Reconstruindo container Docker na porta $PORT..."
if [ -f "docker-compose.yml" ] || [ -f "compose.yaml" ]; then
  docker compose down --remove-orphans || true
  docker compose build --no-cache
  docker compose up -d
else
  # Build direto com Dockerfile
  IMAGE_NAME="app-${project.slug}"
  CONTAINER_NAME="container-${project.slug}"
  docker stop "$CONTAINER_NAME" 2>/dev/null || true
  docker rm "$CONTAINER_NAME" 2>/dev/null || true
  docker build -t "$IMAGE_NAME:latest" .
  docker run -d \\
    --name "$CONTAINER_NAME" \\
    --restart unless-stopped \\
    -p "$PORT:$PORT" \\
    --env-file "$APP_DIR/.env" \\
    "$IMAGE_NAME:latest"
fi

# 4. Teste de Saúde (Health Check)
echo "🩺 Verificando se a aplicação respondeu na porta $PORT..."
sleep 3
if curl -s -f "http://127.0.0.1:$PORT" > /dev/null || curl -s -I "http://127.0.0.1:$PORT" | grep -q "HTTP"; then
  echo "✅ Deploy concluído com SUCESSO! Aplicação rodando em http://localhost:$PORT"
else
  echo "⚠️ Aviso: Aplicação iniciada, mas endpoint HTTP pode requerer alguns segundos adicionais."
fi
`;
  }

  // Node.js com PM2 (padrão recomendado para React / Vite / Express / Next)
  return `#!/usr/bin/env bash
# ==============================================================================
# Script de Deploy Contínuo Git -> VPS (Node.js + PM2)
# Projeto: ${project.name} (Porta: ${project.appPort})
# Servidor: ${vps.host}
# ==============================================================================
set -euo pipefail

APP_DIR="${project.serverPath}"
REPO_URL="${project.gitRepoUrl}"
BRANCH="${project.branch}"
PORT="${project.appPort}"
APP_NAME="${project.slug}"

echo "🚀 [$(date '+%Y-%m-%d %H:%M:%S')] Iniciando deploy do projeto: ${project.name}..."

# Garante dependências de compilação C/C++ (para pacotes nativos como better-sqlite3)
which make >/dev/null || (sudo apt-get update -y && sudo apt-get install -y build-essential make)

# 1. Garante que o diretório existe e sincroniza via Git
mkdir -p "$APP_DIR"
cd "$APP_DIR"
if [ ! -d ".git" ]; then
  echo "📦 Inicializando Git em $APP_DIR..."
  git init
  git remote add origin "$REPO_URL" 2>/dev/null || git remote set-url origin "$REPO_URL"
fi

echo "🔄 Buscando código do repositório..."
git remote set-url origin "$REPO_URL" || true
git fetch origin --prune

TARGET_BRANCH="$BRANCH"
if ! git rev-parse --verify "origin/$TARGET_BRANCH" >/dev/null 2>&1; then
  if git rev-parse --verify "origin/main" >/dev/null 2>&1; then
    TARGET_BRANCH="main"
  elif git rev-parse --verify "origin/master" >/dev/null 2>&1; then
    TARGET_BRANCH="master"
  fi
fi

echo "🌿 Aplicando branch '$TARGET_BRANCH'..."
git checkout -f -B "$TARGET_BRANCH" "origin/$TARGET_BRANCH"
git reset --hard "origin/$TARGET_BRANCH"

# 2. Configura variáveis de ambiente
echo "🔒 Gerando arquivo de ambiente .env..."
cat << 'EOF' > "$APP_DIR/.env"
PORT=${project.appPort}
NODE_ENV=production
${envFileContent}
EOF

# 3. Instala dependências de produção
echo "📥 Instalando dependências (npm install --legacy-peer-deps)..."
npm install --legacy-peer-deps || npm install --force || npm install

# 4. Executa Build do projeto
echo "⚡ Executando comando de build: ${project.buildCommand}..."
PORT=$PORT npm run build

# 5. Gerenciamento de Processo com PM2
echo "🔄 Atualizando processo PM2 ('$APP_NAME') na porta $PORT..."
export PORT=$PORT

# Se o processo PM2 já estiver em execução, recarrega com zero-downtime
if pm2 describe "$APP_NAME" > /dev/null 2>&1; then
  echo "♻️ Recarregando processo existente no PM2..."
  pm2 reload "$APP_NAME" --update-env
else
  echo "✨ Iniciando novo processo no PM2..."
  pm2 start "${project.startCommand}" --name "$APP_NAME" --env PORT=$PORT --update-env
fi

# Salva a lista de processos para reiniciar automaticamente em reboot da VPS
pm2 save

# 6. Teste de integridade HTTP
echo "🩺 Verificando porta local $PORT..."
sleep 2
if curl -s -I "http://127.0.0.1:$PORT" | head -n 1 | grep -E "(200|301|302|304|307|308|404)" > /dev/null; then
  echo "✅ Deploy concluído com SUCESSO! Rodando perfeitamente na porta $PORT."
else
  echo "✨ Processo iniciado com sucesso no PM2. Verifique 'pm2 logs $APP_NAME' se necessário."
fi
`;
}

/**
 * Gera o arquivo de workflow do GitHub Actions (.github/workflows/deploy.yml)
 */
export function generateGitHubActionsWorkflow(vps: VpsServer, project: DeploymentProject): string {
  return `name: Deploy Contínuo VPS (${project.name})

on:
  push:
    branches:
      - ${project.branch}
  workflow_dispatch: # Permite disparar o deploy manualmente pelo painel do GitHub

jobs:
  deploy:
    name: Conectar via SSH e Atualizar VPS
    runs-on: ubuntu-latest

    steps:
      - name: 🌐 Executar Script de Deploy na VPS
        uses: appleboy/ssh-action@v1.0.3
        with:
          host: \${{ secrets.VPS_HOST }}       # Ex: ${vps.host}
          username: \${{ secrets.VPS_USER }}   # Ex: ${vps.sshUser}
          port: \${{ secrets.VPS_PORT }}       # Ex: ${vps.sshPort}
          key: \${{ secrets.VPS_SSH_KEY }}     # Chave privada SSH (id_rsa ou id_ed25519)
          script_stop: true
          envs: PORT,PROJECT_DIR,BRANCH
          script: |
            export PORT=${project.appPort}
            export PROJECT_DIR="${project.serverPath}"
            export BRANCH="${project.branch}"
            
            echo "🚀 [GitHub Actions] Conexão SSH estabelecida com sucesso!"
            echo "📂 Acessando diretório do projeto: $PROJECT_DIR"
            
            # Se o projeto ainda não foi clonado na VPS
            if [ ! -d "$PROJECT_DIR/.git" ]; then
              mkdir -p "$PROJECT_DIR"
              git clone -b "$BRANCH" "${project.gitRepoUrl}" "$PROJECT_DIR"
            fi
            
            cd "$PROJECT_DIR"
            
            # Atualiza o código para o último commit do GitHub
            echo "⬇️ Baixando commits mais recentes da branch $BRANCH..."
            git fetch origin "$BRANCH"
            git reset --hard "origin/$BRANCH"
            
            # Instala dependências e compila
            echo "📦 Instalando dependências e compilando..."
            npm ci || npm install
            PORT=$PORT npm run build
            
            # Reinicia a aplicação na porta configurada (${project.appPort})
            echo "🔄 Reiniciando serviço na porta ${project.appPort}..."
            if pm2 describe "${project.slug}" > /dev/null 2>&1; then
              pm2 reload "${project.slug}" --update-env
            else
              pm2 start "${project.startCommand}" --name "${project.slug}" --env PORT=$PORT
            fi
            pm2 save
            
            echo "✅ Deploy Contínuo finalizado com sucesso na porta ${project.appPort}!"
`;
}

/**
 * Gera um listener de Webhook ultraleve em Node.js para rodar como daemon na VPS
 */
export function generateWebhookScript(vps: VpsServer, project: DeploymentProject): string {
  return `/**
 * Servidor Webhook Automático para Deploy Contínuo na VPS
 * Salve como: /opt/deploy-webhooks/webhook-server.js
 * Roda na VPS escutando eventos 'push' do GitHub/GitLab
 */
const http = require('http');
const crypto = require('crypto');
const { exec } = require('child_process');

const PORT = 9000; // Porta do listener de Webhook
const SECRET = "${project.webhookSecret}"; // Configure o mesmo Secret no GitHub Webhooks
const DEPLOY_SCRIPT = "${project.serverPath}/deploy.sh";

function verifySignature(payload, signature) {
  if (!signature) return false;
  const hmac = crypto.createHmac('sha256', SECRET);
  const digest = 'sha256=' + hmac.update(payload).digest('hex');
  return crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(digest));
}

const server = http.createServer((req, res) => {
  if (req.method === 'POST' && req.url === '/webhook/deploy-${project.slug}') {
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', () => {
      const signature = req.headers['x-hub-signature-256'];
      
      // Valida o segredo de segurança
      if (SECRET && !verifySignature(body, signature)) {
        console.error('❌ Assinatura de Webhook inválida!');
        res.writeHead(403, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify({ error: 'Assinatura inválida' }));
      }

      console.log('🔔 Evento Push recebido do Git! Disparando deploy...');
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ status: 'Deploy iniciado em segundo plano' }));

      // Executa o script de deploy na VPS
      exec(\`bash \${DEPLOY_SCRIPT}\`, (error, stdout, stderr) => {
        if (error) {
          console.error('❌ Erro durante o deploy:', error.message);
          console.error(stderr);
          return;
        }
        console.log('✅ Deploy finalizado com sucesso:\\n', stdout);
      });
    });
  } else {
    res.writeHead(404);
    res.end();
  }
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(\`🚀 Webhook Deploy Listener ativo na porta \${PORT}\`);
  console.log(\`👉 Endpoint: http://${vps.host}:\${PORT}/webhook/deploy-${project.slug}\`);
});
`;
}

/**
 * Gera a configuração Nginx Reverse Proxy para expor a porta na web
 */
export function generateNginxConfig(vps: VpsServer, project: DeploymentProject): string {
  const domain = project.domain || `${vps.host}`;
  return `# Configuração Nginx para ${project.name}
# Arquivo: /etc/nginx/sites-available/${project.slug}
# Habilitar: sudo ln -s /etc/nginx/sites-available/${project.slug} /etc/nginx/sites-enabled/
# Testar: sudo nginx -t && sudo systemctl reload nginx

server {
    listen 80;
    listen [::]:80;
    server_name ${domain};

    # Logs
    access_log /var/log/nginx/${project.slug}.access.log;
    error_log /var/log/nginx/${project.slug}.error.log;

    # Encaminha tráfego para a porta local da aplicação (${project.appPort})
    location / {
        proxy_pass http://127.0.0.1:${project.appPort};
        proxy_http_version 1.1;
        
        # Suporte completo a WebSockets e Headers HTTP
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        
        proxy_cache_bypass $http_upgrade;
        proxy_read_timeout 90;
    }

    # Limite de tamanho de upload
    client_max_body_size 50M;
}

# -------------------------------------------------------------
# 🔒 Para ativar SSL HTTPS Grátis com Let's Encrypt:
# Execute na VPS:
# sudo certbot --nginx -d ${domain}
# -------------------------------------------------------------
`;
}

/**
 * Script de preparação inicial completa da VPS (One-Click Bootstrap)
 */
export function generateVPSBootstrapScript(vps: VpsServer, projects: DeploymentProject[]): string {
  const portsToAllow = [22, 80, 443, ...projects.map(p => p.appPort)];
  const ufwCommands = Array.from(new Set(portsToAllow))
    .map(p => `ufw allow ${p}/tcp comment "Porta ${p}"`)
    .join('\n');

  return `#!/usr/bin/env bash
# ==============================================================================
# 🛠️ Script de Inicialização e Preparação Automática da VPS
# Servidor: ${vps.name} (${vps.host}) - ${vps.os}
# ==============================================================================
set -euo pipefail

echo "🚀 Iniciando configuração do servidor..."

# 1. Atualização do Sistema
export DEBIAN_FRONTEND=noninteractive
apt update && apt upgrade -y

# 2. Pacotes essenciais
apt install -y curl wget git build-essential ufw nginx certbot python3-certbot-nginx htop unzip

# 3. Instalação do Node.js LTS (v20 ou v22)
echo "📦 Instalando Node.js LTS..."
curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
apt install -y nodejs

# 4. Instalação do PM2 (Gerenciador de Processos)
echo "⚡ Instalando PM2 globalmente..."
npm install -g pm2
pm2 startup systemd -u root --hp /root || true

# 5. Instalação do Docker e Docker Compose (Opcional, mas recomendado)
echo "🐳 Instalando Docker..."
curl -fsSL https://get.docker.com | sh || true
usermod -aG docker root || true

# 6. Configuração do Firewall (UFW)
echo "🛡️ Configurando Firewall UFW..."
ufw default deny incoming
ufw default allow outgoing
${ufwCommands}
echo "y" | ufw enable || true

# 7. Criação da pasta padrão para aplicações
mkdir -p /var/www
chmod 755 /var/www

echo "=============================================================================="
echo "🎉 VPS PREPARADA COM SUCESSO!"
echo "Node: $(node -v) | NPM: $(npm -v) | PM2: $(pm2 -v)"
echo "Nginx: Ativo | Firewall: Configurado"
echo "=============================================================================="
`;
}

/**
 * Gera arquivo de serviço Linux Systemd
 */
export function generateSystemdService(project: DeploymentProject): string {
  return `[Unit]
Description=Servico ${project.name}
After=network.target

[Service]
Type=simple
User=root
WorkingDirectory=${project.serverPath}
ExecStart=/usr/bin/npm start
Restart=always
RestartSec=10
StandardOutput=syslog
StandardError=syslog
SyslogIdentifier=${project.slug}
Environment=NODE_ENV=production
Environment=PORT=${project.appPort}

[Install]
WantedBy=multi-user.target
`;
}

/**
 * Gera arquivo docker-compose.yml
 */
export function generateDockerCompose(project: DeploymentProject): string {
  return `version: '3.8'

services:
  ${project.slug}:
    build:
      context: .
      dockerfile: Dockerfile
    container_name: ${project.slug}
    restart: unless-stopped
    ports:
      - "${project.appPort}:${project.appPort}"
    environment:
      - PORT=${project.appPort}
      - NODE_ENV=production
    env_file:
      - .env
`;
}
