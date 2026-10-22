import { GoogleGenAI, Type } from '@google/genai';

export interface AiFixResult {
  diagnosis: string;
  explanation: string;
  commands: string[];
  confidence: number;
}

/**
 * Heurísticas especializadas para falhas clássicas de deploy em VPS Linux
 */
export function getHeuristicFix(logs: string[], params: {
  slug: string;
  appPort: number;
  serverPath: string;
  buildCommand: string;
}): AiFixResult | null {
  const logText = logs.slice(-100).join('\n');

  // 1. Falha de resolução do Rollup/Vite com react-is (comum no React 19 + Recharts)
  if (logText.includes('react-is') || logText.includes('Could not resolve "react-is"') || logText.includes('failed to resolve import "react-is"')) {
    return {
      diagnosis: 'Erro de compilação no Rollup/Vite: dependência "react-is" ausente ou não resolvida.',
      explanation: 'Instala o pacote react-is compatível com React 19 via --legacy-peer-deps e recompila o projeto.',
      commands: [
        `cd "${params.serverPath}"`,
        `npm install react-is --legacy-peer-deps --save`,
        `PORT=${params.appPort} ${params.buildCommand}`,
      ],
      confidence: 0.95,
    };
  }

  // 2. Conflito de dependências do NPM (ERESOLVE)
  if (logText.includes('ERESOLVE') || logText.includes('unable to resolve dependency tree') || logText.includes('conflicting peer dependency')) {
    return {
      diagnosis: 'Conflito de versões de pacotes (peer dependencies) durante o npm install.',
      explanation: 'Força a instalação contornando restrições de peer dependencies usando --legacy-peer-deps e --force.',
      commands: [
        `cd "${params.serverPath}"`,
        `npm install --legacy-peer-deps --force`,
        `PORT=${params.appPort} ${params.buildCommand}`,
      ],
      confidence: 0.95,
    };
  }

  // 3. Porta em uso (EADDRINUSE)
  if (logText.includes('EADDRINUSE') || logText.includes('address already in use') || logText.includes(`bind: address already in use`)) {
    return {
      diagnosis: `Porta TCP ${params.appPort} já está em uso por outro processo no servidor.`,
      explanation: `Mata o processo anterior preso na porta ${params.appPort} usando fuser e reinicia o PM2 limpo.`,
      commands: [
        `which fuser >/dev/null || (apt-get update -y && apt-get install -y psmisc)`,
        `fuser -k "${params.appPort}/tcp" 2>/dev/null || true`,
        `pm2 delete "${params.slug}" 2>/dev/null || true`,
        `cd "${params.serverPath}"`,
        `if [ -d dist ]; then pm2 serve dist "${params.appPort}" --name "${params.slug}" --spa; else PORT=${params.appPort} pm2 start npm --name "${params.slug}" -- start; fi`,
      ],
      confidence: 0.9,
    };
  }

  // 4. Falha de compilação C/C++ nativa (better-sqlite3, node-gyp, make, gcc)
  if (logText.includes('gyp ERR!') || logText.includes('make: not found') || logText.includes('g++: not found') || logText.includes('Python was not found')) {
    return {
      diagnosis: 'Módulos nativos C/C++ requerem ferramentas de compilação (build-essential, make, python3).',
      explanation: 'Instala o pacote build-essential, make e python3 no Ubuntu e recompila dependências nativas.',
      commands: [
        `apt-get update -y && apt-get install -y build-essential make gcc g++ python3`,
        `cd "${params.serverPath}"`,
        `npm rebuild 2>/dev/null || npm install --legacy-peer-deps`,
        `PORT=${params.appPort} ${params.buildCommand}`,
      ],
      confidence: 0.9,
    };
  }

  // 5. Git lock file residual
  if (logText.includes('.git/index.lock') || logText.includes('Another git process seems to be running')) {
    return {
      diagnosis: 'Arquivo de trava residual do Git (.git/index.lock) impedindo operações.',
      explanation: 'Remove o arquivo de trava e sincroniza o repositório novamente.',
      commands: [
        `rm -f "${params.serverPath}/.git/index.lock"`,
        `cd "${params.serverPath}"`,
        `git reset --hard HEAD`,
      ],
      confidence: 0.9,
    };
  }

  return null;
}

/**
 * Analisa os logs do terminal com IA (Gemini 3.8 Flash) e retorna diagnóstico e comandos de correção
 */
export async function analyzeTerminalLogsWithAi(params: {
  logs: string[];
  slug: string;
  appPort: number;
  serverPath: string;
  buildCommand: string;
  runtime: string;
}): Promise<AiFixResult> {
  // Primeiro, verifica se há uma correspondência direta por heurística confiável
  const heuristic = getHeuristicFix(params.logs, params);
  if (heuristic && heuristic.confidence >= 0.95) {
    return heuristic;
  }

  // Tenta com Gemini 3.8 Flash
  try {
    const ai = new GoogleGenAI({
      apiKey: process.env.GEMINI_API_KEY,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        },
      },
    });
    const relevantLogs = params.logs.slice(-70).join('\n');

    const prompt = `
Você é um Especialista Sênior em DevOps Linux e Deploy Node.js/PM2/Vite.
Um deploy na VPS Ubuntu falhou. Analise a saída do terminal abaixo e gere os comandos Bash exatos para corrigir o problema no servidor.

=== DETALHES DO PROJETO ===
Nome/Slug: ${params.slug}
Porta TCP Alvo: ${params.appPort}
Diretório da Aplicação na VPS: ${params.serverPath}
Comando de Build: ${params.buildCommand}
Runtime: ${params.runtime}
Sistema Operacional: Ubuntu 24.04 / Debian

=== ÚLTIMOS LOGS DO TERMINAL (ERRO) ===
${relevantLogs}

=== INSTRUÇÕES ===
1. Descubra a causa raiz do erro (ex: pacote ausente, erro Rollup/Vite, porta ocupada, dependências com conflito, node-gyp, etc.).
2. Gere um array com os comandos exatos que devem ser executados no terminal da VPS para resolver.
3. Não use comandos interativos (ex: sempre passe -y para apt, --legacy-peer-deps para npm).
4. Sempre garanta que no final o processo PM2 seja recarregado ou iniciado na porta ${params.appPort}.
5. Retorne APENAS um objeto JSON no formato especificado.
`;

    const response = await ai.models.generateContent({
      model: 'gemini-3.8-flash',
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            diagnosis: { type: Type.STRING, description: 'Diagnóstico claro em português do motivo da falha' },
            explanation: { type: Type.STRING, description: 'Explicação em português de como os comandos resolvem o erro' },
            commands: {
              type: Type.ARRAY,
              items: { type: Type.STRING },
              description: 'Lista de comandos bash a serem executados na VPS',
            },
            confidence: { type: Type.NUMBER, description: 'Confiança de 0 a 1' },
          },
          required: ['diagnosis', 'explanation', 'commands'],
        },
      },
    });

    if (response.text) {
      const parsed = JSON.parse(response.text);
      if (parsed.commands && Array.isArray(parsed.commands) && parsed.commands.length > 0) {
        return {
          diagnosis: parsed.diagnosis || 'Falha analisada pela Inteligência Artificial.',
          explanation: parsed.explanation || 'Comandos gerados automaticamente para recuperação.',
          commands: parsed.commands,
          confidence: parsed.confidence || 0.9,
        };
      }
    }
  } catch (err: any) {
    console.warn('Aviso: IA Gemini gerou exceção durante a análise, recorrendo a heurísticas:', err.message);
  }

  // Fallback caso a IA não tenha retornado ou esteja em pico 503
  if (heuristic) {
    return heuristic;
  }

  // Fallback genérico de auto-recuperação
  return {
    diagnosis: 'Falha durante o build ou inicialização do processo.',
    explanation: 'Tentativa de limpeza de cache, reinstalação forçada de dependências e reinício seguro do processo.',
    commands: [
      `cd "${params.serverPath}"`,
      `npm install --legacy-peer-deps || npm install --force`,
      `PORT=${params.appPort} ${params.buildCommand} || true`,
      `fuser -k "${params.appPort}/tcp" 2>/dev/null || true`,
      `if [ -d dist ]; then pm2 serve dist "${params.appPort}" --name "${params.slug}" --spa; else PORT=${params.appPort} pm2 start npm --name "${params.slug}" -- start; fi`,
    ],
    confidence: 0.75,
  };
}
