export type RuntimeType = 'node-pm2' | 'docker' | 'nginx-static' | 'systemd';

export interface EnvVariable {
  key: string;
  value: string;
  isSecret: boolean;
}

export interface VpsServer {
  id: string;
  name: string;
  host: string;
  sshPort: number;
  sshUser: string;
  authType: 'key' | 'password';
  sshKeyOrPassword?: string;
  os: 'Ubuntu 24.04 LTS' | 'Ubuntu 22.04 LTS' | 'Debian 12' | 'Alpine Linux';
  status: 'connected' | 'unreachable' | 'checking';
  ipAddress: string;
  cpuCores: number;
  ramGb: number;
  diskGb: number;
  firewallUfwActive: boolean;
  notes?: string;
  createdAt: string;
}

export interface DeploymentProject {
  id: string;
  vpsId: string;
  name: string;
  slug: string;
  gitRepoUrl: string;
  branch: string;
  serverPath: string;
  appPort: number;
  runtime: RuntimeType;
  buildCommand: string;
  startCommand: string;
  domain?: string;
  enableHttps: boolean;
  sslType?: 'letsencrypt' | 'selfsigned';
  sslInstalledAt?: string;
  webhookSecret: string;
  autoDeployOnPush: boolean;
  githubToken?: string;
  envVariables: EnvVariable[];
  status: 'running' | 'stopped' | 'deploying' | 'failed';
  lastDeployedAt?: string;
  commitHash?: string;
  commitMessage?: string;
}

export interface DeploymentRecord {
  id: string;
  projectId: string;
  vpsId: string;
  timestamp: string;
  status: 'success' | 'failed' | 'in_progress';
  commitHash: string;
  commitMessage: string;
  durationSeconds: number;
  triggeredBy: 'git_push' | 'manual' | 'webhook' | 'rollback';
  logs: string[];
}
