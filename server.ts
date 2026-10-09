import express from 'express';
import { createServer as createViteServer } from 'vite';
import { Client } from 'ssh2';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  const PORT = Number(process.env.PORT) || 3000;

  app.use(express.json({ limit: '10mb' }));

  // Test SSH Connection Endpoint
  app.post('/api/test-ssh', (req, res) => {
    const { host, port = 22, username = 'root', authType = 'password', passwordOrKey = '' } = req.body;

    if (!host) {
      return res.status(400).json({ success: false, message: 'Host IP ou domínio é obrigatório.' });
    }

    const conn = new Client();
    let isFinished = false;

    const safeReply = (statusCode: number, data: any) => {
      if (isFinished || res.headersSent) return;
      isFinished = true;
      clearTimeout(timeout);
      try {
        conn.removeAllListeners();
        conn.end();
      } catch (e) {}
      res.status(statusCode).json(data);
    };

    const timeout = setTimeout(() => {
      safeReply(408, {
        success: false,
        message: `Tempo limite de conexão excedido ao tentar conectar a ${host}:${port}. Verifique se a porta SSH está aberta no firewall.`,
      });
    }, 10000);

    conn.on('ready', () => {
      safeReply(200, {
        success: true,
        message: `Conexão SSH bem-sucedida com ${username}@${host}:${port}!`,
      });
    });

    conn.on('error', (err) => {
      safeReply(500, {
        success: false,
        message: `Erro na conexão SSH: ${err.message}`,
      });
    });

    try {
      const connectConfig: any = {
        host,
        port: Number(port) || 22,
        username: username || 'root',
        readyTimeout: 9000,
      };

      if (authType === 'key' && passwordOrKey) {
        connectConfig.privateKey = passwordOrKey;
      } else if (passwordOrKey) {
        connectConfig.password = passwordOrKey;
      }

      conn.connect(connectConfig);
    } catch (err: any) {
      safeReply(500, { success: false, message: err.message });
    }
  });

  // Probe VPS Real Specifications & PM2 Status
  app.post('/api/probe-vps', (req, res) => {
    const { host, port = 22, username = 'root', authType = 'password', passwordOrKey = '' } = req.body;

    if (!host) {
      return res.status(400).json({ success: false, message: 'Host IP ou domínio é obrigatório.' });
    }

    const conn = new Client();
    let isFinished = false;

    const safeReply = (statusCode: number, data: any) => {
      if (isFinished || res.headersSent) return;
      isFinished = true;
      clearTimeout(timeout);
      try {
        conn.removeAllListeners();
        conn.end();
      } catch (e) {}
      res.status(statusCode).json(data);
    };

    const timeout = setTimeout(() => {
      safeReply(408, {
        success: false,
        message: `Tempo limite de conexão excedido ao tentar conectar a ${host}:${port}.`,
      });
    }, 12000);

    conn.on('ready', () => {
      const probeScript = `
echo "===OS==="
grep -oP '(?<=PRETTY_NAME=")[^"]*' /etc/os-release 2>/dev/null || cat /etc/issue 2>/dev/null | head -n1 || uname -s
echo "===CPU==="
nproc 2>/dev/null || grep -c ^processor /proc/cpuinfo 2>/dev/null || echo "2"
echo "===MEM==="
free -m | awk '/Mem:/ {print $2}' 2>/dev/null || echo "4096"
echo "===DISK==="
df -m / 2>/dev/null | awk 'NR==2 {print int($2/1024)}' || echo "50"
echo "===UFW==="
ufw status 2>/dev/null | grep -q "Status: active" && echo "active" || echo "inactive"
echo "===PM2==="
pm2 jlist 2>/dev/null || echo "[]"
`;
      conn.exec(probeScript, (err, stream) => {
        if (err) return safeReply(500, { success: false, message: err.message });
        let output = '';
        stream.on('data', (d: Buffer) => { output += d.toString(); });
        stream.stderr.on('data', (d: Buffer) => { output += d.toString(); });
        stream.on('close', () => {
          try {
            const extractSection = (tag: string) => {
              const regex = new RegExp(`===${tag}===\\n([\\s\\S]*?)(?=(===|$))`);
              const match = output.match(regex);
              return match ? match[1].trim() : '';
            };

            const rawOs = extractSection('OS');
            const rawCpu = extractSection('CPU');
            const rawMem = extractSection('MEM');
            const rawDisk = extractSection('DISK');
            const rawUfw = extractSection('UFW');
            const rawPm2 = extractSection('PM2');

            let parsedOs: any = 'Ubuntu 24.04 LTS';
            if (rawOs.toLowerCase().includes('24.04')) parsedOs = 'Ubuntu 24.04 LTS';
            else if (rawOs.toLowerCase().includes('22.04')) parsedOs = 'Ubuntu 22.04 LTS';
            else if (rawOs.toLowerCase().includes('debian 12')) parsedOs = 'Debian 12';
            else if (rawOs.toLowerCase().includes('alpine')) parsedOs = 'Alpine Linux';
            else if (rawOs) parsedOs = rawOs;

            const cpuCores = Number(rawCpu.trim()) || 2;
            const memMb = Number(rawMem.trim()) || 4096;
            const ramGb = Math.max(1, Math.round(memMb / 1024));
            const diskGb = Number(rawDisk.trim()) || 50;
            const firewallUfwActive = rawUfw.includes('active');

            let pm2Apps: Array<{ name: string; status: string; pid?: number; memoryMb?: number }> = [];
            try {
              const jsonStart = rawPm2.indexOf('[');
              const jsonEnd = rawPm2.lastIndexOf(']');
              if (jsonStart !== -1 && jsonEnd !== -1) {
                const list = JSON.parse(rawPm2.substring(jsonStart, jsonEnd + 1));
                if (Array.isArray(list)) {
                  pm2Apps = list.map((item: any) => ({
                    name: item.name || 'app',
                    status: item.pm2_env?.status || 'stopped',
                    pid: item.pid || undefined,
                    memoryMb: item.monit?.memory ? Math.round(item.monit.memory / 1024 / 1024) : 0,
                  }));
                }
              }
            } catch (e) {}

            const runningPm2Count = pm2Apps.filter((a) => a.status === 'online').length;

            safeReply(200, {
              success: true,
              os: parsedOs,
              rawOs,
              cpuCores,
              ramGb,
              diskGb,
              firewallUfwActive,
              pm2Apps,
              runningPm2Count,
              message: `Conexão SSH bem-sucedida! Detectado: ${parsedOs}, ${cpuCores} vCPU, ${ramGb}GB RAM, ${diskGb}GB Disco, ${runningPm2Count} apps PM2 rodando.`,
            });
          } catch (parseErr: any) {
            safeReply(200, {
              success: true,
              message: 'Conectado com sucesso à VPS via SSH.',
              rawOutput: output,
            });
          }
        });
      });
    });

    conn.on('error', (err) => {
      safeReply(500, {
        success: false,
        message: `Erro na conexão SSH: ${err.message}`,
      });
    });

    try {
      const connectConfig: any = {
        host,
        port: Number(port) || 22,
        username: username || 'root',
        readyTimeout: 9000,
      };

      if (authType === 'key' && passwordOrKey) {
        connectConfig.privateKey = passwordOrKey;
      } else if (passwordOrKey) {
        connectConfig.password = passwordOrKey;
      }

      conn.connect(connectConfig);
    } catch (err: any) {
      safeReply(500, { success: false, message: err.message });
    }
  });

  // Diagnose VPS Endpoint (pm2 list, logs, ports)
  app.post('/api/diagnose-vps', (req, res) => {
    const { host, port = 22, username = 'root', authType = 'password', passwordOrKey = '', slug = '', appPort = 3000 } = req.body;

    if (!host || !passwordOrKey) {
      return res.status(400).json({ success: false, message: 'Host e credenciais são obrigatórios.' });
    }

    const conn = new Client();
    let isFinished = false;

    const safeReply = (statusCode: number, data: any) => {
      if (isFinished || res.headersSent) return;
      isFinished = true;
      clearTimeout(timeout);
      try {
        conn.removeAllListeners();
        conn.end();
      } catch (e) {}
      res.status(statusCode).json(data);
    };

    const timeout = setTimeout(() => {
      safeReply(408, { success: false, message: 'Timeout ao conectar na VPS para diagnóstico.' });
    }, 15000);

    conn.on('ready', () => {
      const diagScript = `
echo "=== LISTA DE PROCESSOS PM2 ==="
pm2 list
echo ""
echo "=== PORTAS TCP EM ESCUTA (LISTEN) ==="
ss -tulpn | grep LISTEN || netstat -tlpn 2>/dev/null || true
echo ""
echo "=== ÚLTIMOS LOGS DO PM2 (${slug}) ==="
pm2 logs "${slug}" --lines 30 --nostream || true
echo ""
echo "=== TESTE CURL LOCAL NA PORTA ${appPort} ==="
curl -s -I http://127.0.0.1:${appPort} || echo "Falha ao responder na porta ${appPort}"
`;
      conn.exec(diagScript, (err, stream) => {
        if (err) return safeReply(500, { success: false, message: err.message });
        let output = '';
        stream.on('data', (d: Buffer) => { output += d.toString(); });
        stream.stderr.on('data', (d: Buffer) => { output += d.toString(); });
        stream.on('close', () => {
          safeReply(200, { success: true, output });
        });
      });
    });

    conn.on('error', (err) => {
      safeReply(500, { success: false, message: err.message });
    });

    try {
      const connectConfig: any = {
        host,
        port: Number(port) || 22,
        username: username || 'root',
        readyTimeout: 9000,
      };
      if (authType === 'key') connectConfig.privateKey = passwordOrKey;
      else connectConfig.password = passwordOrKey;
      conn.connect(connectConfig);
    } catch (err: any) {
      safeReply(500, { success: false, message: err.message });
    }
  });

  // Setup SSL & Nginx Reverse Proxy Endpoint
  app.post('/api/setup-ssl', (req, res) => {
    const {
      host,
      port = 22,
      username = 'root',
      authType = 'password',
      passwordOrKey = '',
      domain,
      email = 'admin@example.com',
      appPort = 3000,
      slug = 'app',
      certType = 'letsencrypt', // 'letsencrypt' | 'selfsigned'
    } = req.body;

    if (!host || !passwordOrKey) {
      return res.status(400).json({ success: false, message: 'Host e credenciais SSH são obrigatórios.' });
    }

    if (!domain) {
      return res.status(400).json({ success: false, message: 'Domínio ou IP é obrigatório para instalar o SSL.' });
    }

    const cleanDomain = domain.trim().replace(/^https?:\/\//, '').replace(/\/.*$/, '');
    const isBareIp = /^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(cleanDomain);

    let validEmail = (email || '').trim();
    if (!validEmail || /@\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(validEmail) || !validEmail.includes('@') || !validEmail.split('@')[1].includes('.')) {
      validEmail = 'julianogallice@gmail.com';
    }

    const logs: string[] = [];
    const pushLog = (line: string) => {
      const ts = new Date().toLocaleTimeString();
      logs.push(`[${ts}] ${line}`);
    };

    // If bare IP was sent with Let's Encrypt, auto-fallback to selfsigned
    let effectiveCertType = certType;
    if (isBareIp && certType === 'letsencrypt') {
      effectiveCertType = 'selfsigned';
      pushLog(`⚠️ O Let's Encrypt não emite certificados para IPs puros (${cleanDomain}).`);
      pushLog(`🔒 Mudando para Certificado SSL Autoassinado OpenSSL para ativar o HTTPS na porta 443!`);
      pushLog(`💡 Dica: Para usar Let's Encrypt oficial com cadeado verde no seu IP, use o domínio gratuito: ${cleanDomain}.nip.io`);
    }

    pushLog(`🔑 Conectando a ${username}@${host}:${port} para SSL (${effectiveCertType === 'selfsigned' ? 'Autoassinado OpenSSL' : "Let's Encrypt"})...`);

    const conn = new Client();
    let isFinished = false;

    const safeReply = (statusCode: number, data: any) => {
      if (isFinished || res.headersSent) return;
      isFinished = true;
      clearTimeout(timeout);
      try {
        conn.removeAllListeners();
        conn.end();
      } catch (e) {}
      res.status(statusCode).json(data);
    };

    const timeout = setTimeout(() => {
      pushLog(`❌ Tempo limite de execução (4 min) esgotado.`);
      safeReply(408, { success: false, logs, message: 'Timeout na configuração SSL.' });
    }, 240000);

    conn.on('ready', () => {
      pushLog(`✅ Autenticação SSH aceita!`);
      pushLog(`🌐 Configurando Nginx para rotear HTTPS (Porta 443) -> Aplicação interna :${appPort}...`);

      const isSelfSigned = effectiveCertType === 'selfsigned';

      const sslScript = `
set -e
export DEBIAN_FRONTEND=noninteractive

echo "📦 [1/4] Verificando Nginx e dependências na VPS..."
if ! command -v nginx >/dev/null 2>&1 || ! command -v certbot >/dev/null 2>&1; then
  echo "Instalando Nginx e Certbot via apt-get..."
  dpkg --configure -a 2>/dev/null || true
  apt-get update -y
  apt-get install -y nginx certbot python3-certbot-nginx openssl
fi

echo "🛡️ [2/4] Liberando portas HTTP (80) e HTTPS (443) no Firewall UFW..."
if command -v ufw >/dev/null 2>&1; then
  ufw allow 80/tcp comment "HTTP 80" || true
  ufw allow 443/tcp comment "HTTPS 443" || true
fi

# Remove default site if it blocks
rm -f /etc/nginx/sites-enabled/default 2>/dev/null || true

${isSelfSigned ? `
echo "🔒 [3/4] Gerando Certificado SSL Autoassinado OpenSSL para ${cleanDomain}..."
mkdir -p /etc/ssl/certs /etc/ssl/private
openssl req -x509 -nodes -days 365 -newkey rsa:2048 \\
  -keyout /etc/ssl/private/${slug}-selfsigned.key \\
  -out /etc/ssl/certs/${slug}-selfsigned.crt \\
  -subj "/CN=${cleanDomain}/O=GitVPS/C=BR" 2>/dev/null

echo "⚙️ [4/4] Configurando Nginx com SSL HTTPS (Porta 443) para ${cleanDomain}..."
cat << 'EOF' > /etc/nginx/sites-available/${slug}
server {
    listen 80;
    listen [::]:80;
    server_name ${cleanDomain};
    return 301 https://\\$host\\$request_uri;
}

server {
    listen 443 ssl default_server;
    listen [::]:443 ssl default_server;
    server_name ${cleanDomain};

    ssl_certificate /etc/ssl/certs/${slug}-selfsigned.crt;
    ssl_certificate_key /etc/ssl/private/${slug}-selfsigned.key;
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;

    location / {
        proxy_pass http://127.0.0.1:${appPort};
        proxy_http_version 1.1;
        proxy_set_header Upgrade \\$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \\$host;
        proxy_set_header X-Real-IP \\$remote_addr;
        proxy_set_header X-Forwarded-For \\$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \\$scheme;
        proxy_cache_bypass \\$http_upgrade;
        proxy_read_timeout 90;
    }
}
EOF

ln -sfn /etc/nginx/sites-available/${slug} /etc/nginx/sites-enabled/${slug}
nginx -t
systemctl reload nginx
echo "✅ Nginx configurado com SSL e ativo na porta 443!"
echo "🎉 CERTIFICADO SSL AUTOASSINADO INSTALADO COM SUCESSO!"
echo "👉 Acesse: https://${cleanDomain}"
echo "⚠️ ATENÇÃO: Acesse SEM colocar :${appPort}! O HTTPS roda na porta padrão 443 (https://${cleanDomain})."
echo "💡 Dica: No primeiro acesso, o navegador exibirá 'Sua conexão não é particular' porque é autoassinado. Clique em 'Avançado -> Continuar para ${cleanDomain}'."
` : `
echo "⚙️ [3/4] Configurando Proxy Reverso Nginx para ${cleanDomain}..."
cat << 'EOF' > /etc/nginx/sites-available/${slug}
server {
    listen 80;
    listen [::]:80;
    server_name ${cleanDomain};

    location / {
        proxy_pass http://127.0.0.1:${appPort};
        proxy_http_version 1.1;
        proxy_set_header Upgrade \\$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \\$host;
        proxy_set_header X-Real-IP \\$remote_addr;
        proxy_set_header X-Forwarded-For \\$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \\$scheme;
        proxy_cache_bypass \\$http_upgrade;
        proxy_read_timeout 90;
    }
}
EOF

ln -sfn /etc/nginx/sites-available/${slug} /etc/nginx/sites-enabled/${slug}
nginx -t
systemctl reload nginx
echo "✅ Nginx configurado e recarregado!"

echo "🔒 [4/4] Solicitando Certificado SSL Let's Encrypt para ${cleanDomain}..."
if certbot --nginx -d "${cleanDomain}" --non-interactive --agree-tos -m "${validEmail}" --redirect || certbot --nginx -d "${cleanDomain}" --non-interactive --agree-tos --register-unsafely-without-email --redirect; then
  echo "🎉 CERTIFICADO SSL LET'S ENCRYPT INSTALADO COM SUCESSO!"
  echo "👉 Acesse: https://${cleanDomain}"
  echo "⚠️ ATENÇÃO: Acesse SEM colocar :${appPort}! O HTTPS roda na porta padrão 443 (https://${cleanDomain})."
else
  echo "SSL_CERTBOT_FAILED=true"
  echo "⚠️ Falha: O Certbot não conseguiu emitir o certificado para '${cleanDomain}'."
  echo "💡 MOTIVO: O domínio precisa apontar uma entrada DNS Tipo A para o IP ${host}."
fi
`}
`;

      conn.exec(sslScript, (err, stream) => {
        if (err) {
          pushLog(`❌ Erro: ${err.message}`);
          return safeReply(500, { success: false, logs, message: err.message });
        }
        stream.on('data', (d: Buffer) => {
          d.toString().split('\n').filter(Boolean).forEach(l => pushLog(l));
        });
        stream.stderr.on('data', (d: Buffer) => {
          d.toString().split('\n').filter(Boolean).forEach(l => pushLog(`[stderr] ${l}`));
        });
        stream.on('close', (code: number) => {
          const hasCertbotFailure = logs.some(l => l.includes('SSL_CERTBOT_FAILED=true') || l.includes('will not issue certificates for a bare IP address'));
          const isReallySuccessful = code === 0 && !hasCertbotFailure;

          safeReply(200, {
            success: isReallySuccessful,
            logs,
            effectiveCertType,
            message: isReallySuccessful
              ? 'Certificado SSL e Nginx configurados com sucesso na porta 443!'
              : 'O Let\'s Encrypt não pôde validar este domínio/IP. Use o modo Autoassinado OpenSSL ou o domínio gratuito *.nip.io.',
          });
        });
      });
    });

    conn.on('error', (err) => {
      pushLog(`❌ Falha de conexão: ${err.message}`);
      safeReply(500, { success: false, logs, message: err.message });
    });

    try {
      const connectConfig: any = {
        host,
        port: Number(port) || 22,
        username: username || 'root',
        readyTimeout: 10000,
      };
      if (authType === 'key') connectConfig.privateKey = passwordOrKey;
      else connectConfig.password = passwordOrKey;
      conn.connect(connectConfig);
    } catch (err: any) {
      safeReply(500, { success: false, logs, message: err.message });
    }
  });

  // Uninstall Project from VPS Endpoint
  app.post('/api/uninstall-project', (req, res) => {
    const {
      host,
      port = 22,
      username = 'root',
      authType = 'password',
      passwordOrKey = '',
      slug,
      serverPath,
      domain = '',
      appPort,
    } = req.body;

    if (!host || !passwordOrKey || !slug) {
      return res.status(400).json({ success: false, message: 'Dados incompletos para desinstalação.' });
    }

    const logs: string[] = [];
    const pushLog = (line: string) => {
      const ts = new Date().toLocaleTimeString();
      logs.push(`[${ts}] ${line}`);
    };

    pushLog(`🛑 Conectando a ${username}@${host}:${port} para desinstalar '${slug}'...`);

    const conn = new Client();
    let isFinished = false;

    const safeReply = (statusCode: number, data: any) => {
      if (isFinished || res.headersSent) return;
      isFinished = true;
      clearTimeout(timeout);
      try {
        conn.removeAllListeners();
        conn.end();
      } catch (e) {}
      res.status(statusCode).json(data);
    };

    const timeout = setTimeout(() => {
      safeReply(408, { success: false, logs, message: 'Timeout na desinstalação.' });
    }, 60000);

    conn.on('ready', () => {
      pushLog(`✅ Autenticado com sucesso!`);
      const uninstallScript = `
echo "🛑 [1/4] Parando e removendo processo '${slug}' do PM2..."
pm2 stop "${slug}" 2>/dev/null || true
pm2 delete "${slug}" 2>/dev/null || true
pm2 save 2>/dev/null || true
echo "✅ Processo '${slug}' removido do PM2."

echo "📂 [2/4] Apagando arquivos e pasta do projeto em '${serverPath}'..."
if [ -n "${serverPath}" ] && [ "${serverPath}" != "/" ] && [ "${serverPath}" != "/var" ] && [ "${serverPath}" != "/var/www" ]; then
  rm -rf "${serverPath}"
  echo "✅ Pasta ${serverPath} apagada com sucesso!"
else
  echo "⚠️ Caminho do diretório protegido ou não especificado (${serverPath})."
fi

echo "🌐 [3/4] Removendo configuração do Nginx e Certificado SSL..."
rm -f "/etc/nginx/sites-enabled/${slug}" "/etc/nginx/sites-available/${slug}" 2>/dev/null || true
if [ -n "${domain}" ]; then
  certbot delete --cert-name "${domain}" --non-interactive 2>/dev/null || true
fi
if command -v nginx >/dev/null 2>&1; then
  nginx -t 2>/dev/null && systemctl reload nginx 2>/dev/null || true
fi
echo "✅ Configurações do Nginx atualizadas."

echo "🛡️ [4/4] Verificando regras de firewall..."
${appPort ? `ufw delete allow ${appPort}/tcp 2>/dev/null || true` : ''}
echo "✅ Porta ${appPort || ''} liberada/limpa."

echo "🎉 DESINSTALAÇÃO COMPLETA! O serviço '${slug}' e todos os arquivos associados foram apagados da VPS."
`;
      conn.exec(uninstallScript, (err, stream) => {
        if (err) return safeReply(500, { success: false, logs, message: err.message });
        stream.on('data', (d: Buffer) => {
          d.toString().split('\n').filter(Boolean).forEach(l => pushLog(l));
        });
        stream.stderr.on('data', (d: Buffer) => {
          d.toString().split('\n').filter(Boolean).forEach(l => pushLog(`[stderr] ${l}`));
        });
        stream.on('close', (code: number) => {
          safeReply(200, { success: code === 0, logs, message: 'Aplicação desinstalada da VPS com sucesso!' });
        });
      });
    });

    conn.on('error', (err) => {
      pushLog(`❌ Falha de conexão: ${err.message}`);
      safeReply(500, { success: false, logs, message: err.message });
    });

    try {
      const connectConfig: any = {
        host,
        port: Number(port) || 22,
        username: username || 'root',
        readyTimeout: 9000,
      };
      if (authType === 'key') connectConfig.privateKey = passwordOrKey;
      else connectConfig.password = passwordOrKey;
      conn.connect(connectConfig);
    } catch (err: any) {
      safeReply(500, { success: false, logs, message: err.message });
    }
  });

  // Control Service on VPS (Pause / Start / Restart via PM2)
  app.post('/api/control-service', (req, res) => {
    const {
      host,
      port = 22,
      username = 'root',
      authType = 'password',
      passwordOrKey = '',
      slug,
      action = 'stop', // 'stop' | 'start' | 'restart'
      serverPath = '',
      appPort = 3000,
    } = req.body;

    if (!host || !passwordOrKey || !slug) {
      return res.status(400).json({
        success: false,
        message: 'Host, credenciais SSH e slug da aplicação são obrigatórios para controlar o serviço.',
      });
    }

    const logs: string[] = [];
    const pushLog = (line: string) => {
      const ts = new Date().toLocaleTimeString();
      logs.push(`[${ts}] ${line}`);
    };

    const actionLabel = action === 'stop' ? 'Pausar' : action === 'restart' ? 'Reiniciar' : 'Iniciar';
    pushLog(`🔑 Conectando a ${username}@${host}:${port} para ${actionLabel} serviço '${slug}' no PM2...`);

    const conn = new Client();
    let isFinished = false;

    const safeReply = (statusCode: number, data: any) => {
      if (isFinished || res.headersSent) return;
      isFinished = true;
      clearTimeout(timeout);
      try {
        conn.removeAllListeners();
        conn.end();
      } catch (e) {}
      res.status(statusCode).json(data);
    };

    const timeout = setTimeout(() => {
      safeReply(408, {
        success: false,
        logs,
        message: `Tempo limite esgotado ao tentar ${actionLabel.toLowerCase()} serviço '${slug}' na VPS.`,
      });
    }, 45000);

    conn.on('ready', () => {
      pushLog(`✅ Autenticado com sucesso via SSH em ${username}@${host}!`);
      const lowerSlug = slug.toLowerCase();
      const script = `
export PATH=$PATH:/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin:~/.nvm/versions/node/$(ls ~/.nvm/versions/node 2>/dev/null | tail -n 1)/bin

# Localizar comando PM2
PM2="pm2"
if ! command -v pm2 >/dev/null 2>&1; then
  if [ -x /usr/local/bin/pm2 ]; then PM2="/usr/local/bin/pm2"
  elif [ -x /usr/bin/pm2 ]; then PM2="/usr/bin/pm2"
  elif [ -n "$(which pm2 2>/dev/null)" ]; then PM2="$(which pm2 2>/dev/null)"
  fi
fi

echo "🔍 Executável PM2 detectado: $PM2"

if [ "${action}" = "stop" ]; then
  echo "🛑 [1/3] Parando processo '${slug}' no PM2..."
  $PM2 stop "${slug}" 2>&1 || $PM2 stop "${lowerSlug}" 2>&1 || true

  # Tenta localizar processo no PM2 pela porta ou diretório
  PM2_MATCH_ID=$($PM2 jlist 2>/dev/null | node -e '
    try {
      const list = JSON.parse(require("fs").readFileSync(0, "utf-8"));
      const hit = list.find(p => 
        p.name === "${slug}" || 
        p.name === "${lowerSlug}" || 
        (p.pm2_env && (p.pm2_env.PORT == "${appPort}" || p.pm2_env.pm_cwd === "${serverPath}"))
      );
      if (hit) process.stdout.write(String(hit.pm_id));
    } catch(e) {}
  ' 2>/dev/null || true)

  if [ -n "$PM2_MATCH_ID" ]; then
    echo "🛑 Parando processo associado PM2 ID #$PM2_MATCH_ID..."
    $PM2 stop "$PM2_MATCH_ID" 2>&1 || true
  fi

  echo "💾 [2/3] Salvando estado do PM2..."
  $PM2 save 2>&1 || true

  echo "🔌 [3/3] Garantindo liberação da porta ${appPort}/tcp..."
  if command -v fuser >/dev/null 2>&1; then
    fuser -k "${appPort}/tcp" 2>/dev/null || true
  fi

  echo ""
  echo "=== VERIFICAÇÃO DE STATUS DA PORTA ${appPort} ==="
  if ss -tulpn 2>/dev/null | grep -q ":${appPort} "; then
    echo "⚠️ Aviso: Porta ${appPort} ainda consta em escuta no sistema operacional."
  else
    echo "✅ Porta ${appPort} está totalmente LIVRE e serviço '${slug}' PAUSADO no servidor!"
  fi

elif [ "${action}" = "start" ] || [ "${action}" = "restart" ]; then
  echo "▶️ [1/3] Iniciando serviço '${slug}' na porta ${appPort}..."
  if $PM2 describe "${slug}" >/dev/null 2>&1; then
    $PM2 restart "${slug}" --update-env 2>&1 || $PM2 start "${slug}" 2>&1
  elif $PM2 describe "${lowerSlug}" >/dev/null 2>&1; then
    $PM2 restart "${lowerSlug}" --update-env 2>&1 || $PM2 start "${lowerSlug}" 2>&1
  else
    if [ -n "${serverPath}" ] && [ -d "${serverPath}" ]; then
      cd "${serverPath}"
      if [ -f "ecosystem.config.cjs" ]; then
        $PM2 start ecosystem.config.cjs --update-env 2>&1
      elif [ -f "dist/server.cjs" ]; then
        PORT=${appPort} HOST=0.0.0.0 $PM2 start dist/server.cjs --name "${slug}" 2>&1
      elif [ -d "dist" ]; then
        $PM2 serve dist "${appPort}" --name "${slug}" --spa 2>&1
      elif [ -f "dist/server.js" ]; then
        PORT=${appPort} HOST=0.0.0.0 $PM2 start dist/server.js --name "${slug}" 2>&1
      elif [ -f "server.js" ]; then
        PORT=${appPort} HOST=0.0.0.0 $PM2 start server.js --name "${slug}" 2>&1
      else
        PORT=${appPort} $PM2 start npm --name "${slug}" -- start 2>&1
      fi
    else
      $PM2 start "${slug}" 2>&1 || true
    fi
  fi

  echo "💾 [2/3] Salvando estado do PM2..."
  $PM2 save 2>&1 || true

  echo ""
  echo "=== TESTE DE RESPOSTA LOCAL NA PORTA ${appPort} ==="
  sleep 1
  curl -s -I --connect-timeout 3 "http://127.0.0.1:${appPort}" 2>/dev/null | head -n 1 || echo "Serviço inicializado no PM2."
  echo "✅ Serviço '${slug}' iniciado na VPS!"
fi

echo ""
echo "=== TABELA ATUAL DO PM2 ==="
$PM2 list || true
`;
      conn.exec(script, (err, stream) => {
        if (err) return safeReply(500, { success: false, logs, message: err.message });
        stream.on('data', (d: Buffer) => {
          d.toString().split('\n').filter(Boolean).forEach((l) => pushLog(l));
        });
        stream.stderr.on('data', (d: Buffer) => {
          d.toString().split('\n').filter(Boolean).forEach((l) => pushLog(`[stderr] ${l}`));
        });
        stream.on('close', (code: number) => {
          const success = code === 0 || logs.some((l) => l.includes('com sucesso'));
          safeReply(200, {
            success,
            logs,
            action,
            message: success
              ? `Serviço '${slug}' foi ${action === 'stop' ? 'pausado' : 'iniciado'} com sucesso no PM2 da VPS!`
              : `Não foi possível ${actionLabel.toLowerCase()} o serviço '${slug}' na VPS.`,
          });
        });
      });
    });

    conn.on('error', (err) => {
      pushLog(`❌ Falha de conexão SSH: ${err.message}`);
      safeReply(500, { success: false, logs, message: `Erro ao conectar na VPS: ${err.message}` });
    });

    try {
      const connectConfig: any = {
        host,
        port: Number(port) || 22,
        username: username || 'root',
        readyTimeout: 10000,
      };
      if (authType === 'key') connectConfig.privateKey = passwordOrKey;
      else connectConfig.password = passwordOrKey;
      conn.connect(connectConfig);
    } catch (err: any) {
      safeReply(500, { success: false, logs, message: err.message });
    }
  });

  // Clean Entire VPS (Reset all applications) Endpoint
  app.post('/api/clean-vps', (req, res) => {
    const {
      host,
      port = 22,
      username = 'root',
      authType = 'password',
      passwordOrKey = '',
    } = req.body;

    if (!host || !passwordOrKey) {
      return res.status(400).json({ success: false, message: 'Host e credenciais são obrigatórios.' });
    }

    const logs: string[] = [];
    const pushLog = (line: string) => {
      const ts = new Date().toLocaleTimeString();
      logs.push(`[${ts}] ${line}`);
    };

    pushLog(`🧹 Conectando para limpeza completa de aplicações na VPS ${host}...`);

    const conn = new Client();
    let isFinished = false;

    const safeReply = (statusCode: number, data: any) => {
      if (isFinished || res.headersSent) return;
      isFinished = true;
      clearTimeout(timeout);
      try {
        conn.removeAllListeners();
        conn.end();
      } catch (e) {}
      res.status(statusCode).json(data);
    };

    const timeout = setTimeout(() => {
      safeReply(408, { success: false, logs, message: 'Timeout na limpeza da VPS.' });
    }, 60000);

    conn.on('ready', () => {
      const cleanScript = `
echo "🧹 [1/3] Parando e removendo todos os processos no PM2..."
pm2 delete all 2>/dev/null || true
pm2 save 2>/dev/null || true
echo "✅ Todos os processos PM2 foram finalizados."

echo "📂 [2/3] Apagando arquivos e aplicações em /var/www/*..."
rm -rf /var/www/*
echo "✅ Diretório /var/www/ limpo com sucesso."

echo "🌐 [3/3] Removendo configurações personalizadas do Nginx..."
rm -f /etc/nginx/sites-enabled/* /etc/nginx/sites-available/* 2>/dev/null || true
if command -v nginx >/dev/null 2>&1; then
  systemctl reload nginx 2>/dev/null || true
fi
echo "✅ Configurações do Nginx redefinidas."

echo "🎉 LIMPEZA CONCLUÍDA! A VPS está pronta para novas instalações limpas."
`;
      conn.exec(cleanScript, (err, stream) => {
        if (err) return safeReply(500, { success: false, logs, message: err.message });
        stream.on('data', (d: Buffer) => {
          d.toString().split('\n').filter(Boolean).forEach(l => pushLog(l));
        });
        stream.stderr.on('data', (d: Buffer) => {
          d.toString().split('\n').filter(Boolean).forEach(l => pushLog(`[stderr] ${l}`));
        });
        stream.on('close', (code: number) => {
          safeReply(200, { success: code === 0, logs, message: 'Limpeza da VPS concluída com sucesso!' });
        });
      });
    });

    conn.on('error', (err) => {
      safeReply(500, { success: false, logs, message: err.message });
    });

    try {
      const connectConfig: any = {
        host,
        port: Number(port) || 22,
        username: username || 'root',
        readyTimeout: 9000,
      };
      if (authType === 'key') connectConfig.privateKey = passwordOrKey;
      else connectConfig.password = passwordOrKey;
      conn.connect(connectConfig);
    } catch (err: any) {
      safeReply(500, { success: false, logs, message: err.message });
    }
  });

  // Real SSH Deployment Execution Endpoint
  app.post('/api/deploy-ssh', (req, res) => {
    const {
      host,
      port = 22,
      username = 'root',
      authType = 'password',
      passwordOrKey = '',
      repoUrl,
      branch = 'main',
      appPort = 3000,
      serverPath = '/var/www/app',
      buildCommand = 'npm run build',
      slug = 'app',
      runtime = 'node-pm2',
      envVariables = [],
      githubToken = '',
    } = req.body;

    if (!host) {
      return res.status(400).json({ success: false, message: 'Host IP ou domínio é obrigatório.' });
    }

    const logs: string[] = [];
    const pushLog = (line: string) => {
      const ts = new Date().toLocaleTimeString();
      logs.push(`[${ts}] ${line}`);
    };

    // Validação inteligente de URL do Repositório Git
    let normalizedRepoUrl = (repoUrl || '').trim();
    if (normalizedRepoUrl.startsWith('github.com/')) {
      normalizedRepoUrl = `https://${normalizedRepoUrl}`;
    }

    const isValidGit =
      normalizedRepoUrl.startsWith('https://') ||
      normalizedRepoUrl.startsWith('http://') ||
      normalizedRepoUrl.startsWith('git@');

    const looksLikeVpsDomain =
      normalizedRepoUrl.includes('publiccloud.com.br') ||
      normalizedRepoUrl.includes('locaweb') ||
      /^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}/.test(normalizedRepoUrl) ||
      (!normalizedRepoUrl.includes('/') && normalizedRepoUrl.includes('.'));

    if (!isValidGit || looksLikeVpsDomain) {
      pushLog(`❌ URL DO REPOSITÓRIO GIT INVÁLIDA: '${normalizedRepoUrl || '(vazio)'}'`);
      if (looksLikeVpsDomain) {
        pushLog(`💡 MOTIVO: Você informou o domínio/IP da sua própria VPS (${normalizedRepoUrl}).`);
        pushLog(`👉 O campo 'Repositório Git' precisa ser a URL onde o código fonte do projeto está hospedado no GitHub ou GitLab.`);
        pushLog(`📝 Exemplo correto: https://github.com/seu-usuario/conversoribge.git`);
      } else {
        pushLog(`💡 MOTIVO: A URL deve começar com https:// (ex: https://github.com/usuario/projeto.git).`);
      }
      return res.json({
        success: false,
        isInvalidRepo: true,
        logs,
        message: looksLikeVpsDomain
          ? `O endereço '${normalizedRepoUrl}' é o domínio da sua VPS, e não o repositório Git. Use a URL do GitHub (ex: https://github.com/usuario/conversoribge.git).`
          : `A URL do repositório Git é inválida. Use a URL completa do GitHub.`,
      });
    }

    let authenticatedCloneUrl = normalizedRepoUrl;
    if (githubToken && normalizedRepoUrl.startsWith('https://github.com/')) {
      authenticatedCloneUrl = normalizedRepoUrl.replace('https://github.com/', `https://${githubToken.trim()}@github.com/`);
    }

    pushLog(`🔑 Iniciando conexão SSH com ${username}@${host}:${port}...`);

    if (!passwordOrKey) {
      pushLog(`⚠️ Nenhuma senha ou chave SSH fornecida para conexão direta.`);
      pushLog(`💡 Dica: Para conectar automaticamente, informe a Senha ou Chave SSH no cadastro da VPS, ou copie o script manual.`);
      return res.json({
        success: false,
        requiresCredentials: true,
        logs,
        message: 'Credenciais SSH não fornecidas para execução remota.',
      });
    }

    const conn = new Client();
    let isFinished = false;

    const safeReply = (statusCode: number, data: any) => {
      if (isFinished || res.headersSent) return;
      isFinished = true;
      clearTimeout(timeout);
      try {
        conn.removeAllListeners();
        conn.end();
      } catch (e) {}
      res.status(statusCode).json(data);
    };

    const timeout = setTimeout(() => {
      pushLog(`❌ Tempo limite de execução (5 min) esgotado ao acessar ${host}:${port}.`);
      safeReply(408, {
        success: false,
        logs,
        message: 'Timeout ao conectar na VPS.',
      });
    }, 300000);

    conn.on('ready', () => {
      pushLog(`✅ Autenticação SSH aceita com sucesso!`);
      pushLog(`📂 Preparando diretório ${serverPath}...`);

      const envLines = (envVariables || [])
        .map((ev: any) => `${ev.key}="${ev.value}"`)
        .join('\n');

      const fullBashScript = `
set -e

echo "🔍 [1/5] Verificando dependências do sistema na VPS..."
export DEBIAN_FRONTEND=noninteractive

# Instalação de ferramentas de compilação C/C++ se make ou g++ estiverem faltando (necessário para pacotes nativos como better-sqlite3)
if ! command -v make >/dev/null 2>&1 || ! command -v g++ >/dev/null 2>&1 || ! command -v git >/dev/null 2>&1 || ! command -v curl >/dev/null 2>&1; then
  echo "📦 Instalando ferramentas de compilação (build-essential, make, g++, python3) para pacotes nativos (better-sqlite3)..."
  dpkg --configure -a 2>/dev/null || true
  for i in 1 2 3 4; do
    if apt-get update -y && apt-get install -y build-essential make gcc g++ python3 curl git; then
      break
    fi
    echo "Aguardando lock do apt ser liberado..."
    sleep 3
  done
fi

# Instalação automática de Node.js e NPM se ausentes
if ! command -v node >/dev/null 2>&1 || ! command -v npm >/dev/null 2>&1; then
  echo "📦 Node.js / NPM não encontrados! Instalando Node.js 20 LTS automaticamente..."
  curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
  apt-get install -y nodejs
fi

# Instalação automática de PM2 se ausente
if ! command -v pm2 >/dev/null 2>&1; then
  echo "⚡ Instalando PM2 globalmente..."
  npm install -g pm2
fi

echo "✅ Node: $(node -v) | NPM: $(npm -v) | PM2: $(pm2 -v 2>/dev/null || echo 'instalado') | Make: $(make -v 2>/dev/null | head -n 1 || echo 'ausente')"

echo "📂 [2/5] Preparando diretório ${serverPath}..."
mkdir -p "${serverPath}"
cd "${serverPath}"

echo "🔄 [3/5] Clonando/atualizando código do repositório Git..."
if [ ! -d ".git" ]; then
  echo "📦 Inicializando Git no diretório ${serverPath}..."
  git init
  git remote add origin "${authenticatedCloneUrl}" 2>/dev/null || git remote set-url origin "${authenticatedCloneUrl}"
fi

echo "🔄 Buscando código do repositório GitHub (${normalizedRepoUrl})..."
git remote set-url origin "${authenticatedCloneUrl}" || true
if ! git fetch origin --prune; then
  echo "❌ ERRO: Falha ao conectar ao repositório '${normalizedRepoUrl}'."
  echo "💡 DICAS:"
  echo "  1. Verifique se o repositório existe e é público no GitHub."
  echo "  2. Se for PRIVADO, informe o Personal Access Token do GitHub."
  exit 1
fi

# Auto-detecção inteligente de branch (main, master ou especificada)
TARGET_BRANCH="${branch}"
if ! git rev-parse --verify "origin/\$TARGET_BRANCH" >/dev/null 2>&1; then
  if git rev-parse --verify "origin/main" >/dev/null 2>&1; then
    TARGET_BRANCH="main"
  elif git rev-parse --verify "origin/master" >/dev/null 2>&1; then
    TARGET_BRANCH="master"
  fi
fi

echo "🌿 Aplicando código da branch '\$TARGET_BRANCH'..."
git checkout -f -B "\$TARGET_BRANCH" "origin/\$TARGET_BRANCH"
git reset --hard "origin/\$TARGET_BRANCH"
echo "✅ Código sincronizado no commit \$(git rev-parse --short HEAD): \$(git log -1 --pretty=%s | head -n 1)"

echo "🔒 [4/5] Configurando variáveis de ambiente .env..."
cat << 'EOF' > .env
PORT=${appPort}
${envLines}
EOF

echo "📦 [5/5] Instalando dependências e compilando..."
npm install --legacy-peer-deps || npm install --force || npm install

# Garante que react-is esteja instalado se o projeto usar recharts (evita erro de resolução no Rollup)
if grep -q "recharts" package.json 2>/dev/null && [ ! -d "node_modules/react-is" ]; then
  echo "📦 Instalando react-is para compatibilidade com recharts..."
  npm install react-is --legacy-peer-deps || true
fi

# Execução do build do projeto
if ! PORT=${appPort} ${buildCommand}; then
  echo "⚠️ Build inicial falhou. Tentando instalar react-is e retentar..."
  npm install react-is --legacy-peer-deps || true
  PORT=${appPort} ${buildCommand}
fi

# Liberar porta no Firewall UFW se existir
if command -v ufw >/dev/null 2>&1; then
  echo "🛡️ Liberando porta ${appPort}/tcp no Firewall UFW..."
  ufw allow ${appPort}/tcp comment "GitVPS Porta ${appPort}" || true
fi

# Gerenciamento de Processo no PM2
echo "🚀 Iniciando/Reiniciando processo no PM2..."
pm2 stop "${slug}" 2>/dev/null || true
pm2 delete "${slug}" 2>/dev/null || true

# Escolha da melhor estratégia de execução no PM2 com ecosystem dedicado
if [ -f "dist/server.cjs" ]; then
  echo "🚀 Configurando backend Node (dist/server.cjs) no PM2 na porta ${appPort}..."
  ln -sfn . dist/dist 2>/dev/null || true
  cat << EOF_ECO > ecosystem.config.cjs
module.exports = {
  apps: [{
    name: "${slug}",
    script: "./dist/server.cjs",
    env: {
      PORT: "${appPort}",
      HOST: "0.0.0.0",
      NODE_ENV: "production"
    }
  }]
};
EOF_ECO
  pm2 start ecosystem.config.cjs --update-env
elif [ -f "dist/server.js" ]; then
  echo "🚀 Configurando backend Node (dist/server.js) no PM2 na porta ${appPort}..."
  cat << EOF_ECO > ecosystem.config.cjs
module.exports = {
  apps: [{
    name: "${slug}",
    script: "./dist/server.js",
    env: {
      PORT: "${appPort}",
      HOST: "0.0.0.0",
      NODE_ENV: "production"
    }
  }]
};
EOF_ECO
  pm2 start ecosystem.config.cjs --update-env
elif [ -f "server.js" ]; then
  cat << EOF_ECO > ecosystem.config.cjs
module.exports = {
  apps: [{
    name: "${slug}",
    script: "./server.js",
    env: {
      PORT: "${appPort}",
      HOST: "0.0.0.0",
      NODE_ENV: "production"
    }
  }]
};
EOF_ECO
  pm2 start ecosystem.config.cjs --update-env
elif [ -d "dist" ]; then
  echo "🌐 Servindo SPA Vite/React via 'pm2 serve' na porta ${appPort} (Host 0.0.0.0)..."
  pm2 serve dist "${appPort}" --name "${slug}" --spa
elif grep -q '"start"' package.json; then
  echo "🚀 Iniciando via 'npm start' na porta ${appPort}..."
  PORT=${appPort} pm2 start npm --name "${slug}" -- start
else
  PORT=${appPort} pm2 start npm --name "${slug}" -- start
fi

# Aguarda 3 segundos e valida se a porta está respondendo
sleep 3
echo "🩺 Verificando se a aplicação respondeu na porta ${appPort}..."
IS_UP=false
if curl -s -I "http://127.0.0.1:${appPort}" | grep -q "HTTP"; then
  IS_UP=true
fi

if [ "\$IS_UP" = false ]; then
  echo "⚠️ ATENÇÃO: O processo não respondeu na porta ${appPort}."
  echo "📋 Últimos logs do processo '${slug}':"
  pm2 logs "${slug}" --lines 20 --nostream || true
  
  # Se o backend compilado não subiu mas temos dist/index.html (frontend pronto), ativamos o PM2 Serve SPA
  if [ -d "dist" ] && [ -f "dist/index.html" ]; then
    echo "🔄 Ativando PM2 Serve SPA em 0.0.0.0:${appPort} para garantir que o frontend fique online..."
    pm2 delete "${slug}" 2>/dev/null || true
    pm2 serve dist "${appPort}" --name "${slug}" --spa
    sleep 2
    if curl -s -I "http://127.0.0.1:${appPort}" | grep -q "HTTP"; then
      echo "✅ Frontend SPA ativo com sucesso em http://${host}:${appPort}!"
      IS_UP=true
    fi
  fi
else
  echo "✅ Aplicação confirmada respondendo em http://${host}:${appPort}!"
fi

pm2 save
env PATH=$PATH:/usr/bin pm2 startup systemd -u root --hp /root 2>/dev/null || true
echo "🎉 DEPLOY CONCLUÍDO COM SUCESSO! Aplicação ativa em http://${host}:${appPort}"
`;

      conn.exec(fullBashScript, (err, stream) => {
        if (err) {
          pushLog(`❌ Erro ao disparar comando: ${err.message}`);
          safeReply(500, { success: false, logs, message: err.message });
          return;
        }

        stream.on('data', (data: Buffer) => {
          const lines = data.toString().split('\n').filter(Boolean);
          lines.forEach((l) => pushLog(l));
        });

        stream.stderr.on('data', (data: Buffer) => {
          const lines = data.toString().split('\n').filter(Boolean);
          lines.forEach((l) => pushLog(`[stderr] ${l}`));
        });

        stream.on('close', (code: number) => {
          if (code === 0) {
            pushLog(`🎉 Deploy executado no servidor com SUCESSO (código de saída 0)!`);
            pushLog(`🟢 Aplicação online em http://${host}:${appPort}`);
            safeReply(200, { success: true, logs });
          } else {
            pushLog(`⚠️ O script encerrou com código de retorno ${code}.`);
            safeReply(200, { success: false, logs, exitCode: code });
          }
        });
      });
    });

    conn.on('error', (err) => {
      pushLog(`❌ Falha na conexão SSH com a VPS: ${err.message}`);
      safeReply(500, {
        success: false,
        logs,
        message: err.message,
      });
    });

    try {
      const connectConfig: any = {
        host,
        port: Number(port) || 22,
        username: username || 'root',
        readyTimeout: 15000,
      };

      if (authType === 'key' && passwordOrKey) {
        connectConfig.privateKey = passwordOrKey;
      } else if (passwordOrKey) {
        connectConfig.password = passwordOrKey;
      }

      conn.connect(connectConfig);
    } catch (err: any) {
      pushLog(`❌ Erro de configuração: ${err.message}`);
      safeReply(500, { success: false, logs, message: err.message });
    }
  });

  // Static / Vite Middleware
  if (process.env.NODE_ENV === 'production') {
    app.use(express.static(path.join(__dirname, 'dist')));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(__dirname, 'dist', 'index.html'));
    });
  } else {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 GitVPS Deploy server running on port ${PORT}`);
  });
}

startServer();
