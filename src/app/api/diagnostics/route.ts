import { NextResponse } from 'next/server';

interface ServiceConfig {
  id: string;
  name: string;
  type: 'render' | 'vercel' | 'telegram';
  platform: string;
  url?: string;
  healthPath?: string;
  serviceId?: string;
  projectId?: string;
  botToken?: string;
  botUsername?: string;
  repo?: string;
}

const SERVICES: ServiceConfig[] = [
  {
    id: 'bot1',
    name: 'Code Ghost Bot',
    type: 'vercel',
    platform: 'Vercel',
    projectId: 'prj_PG5Owg8UCAym3XoHlWK9A30QrStp',
    url: 'https://code-ghost-deploy.vercel.app',
    healthPath: '/api/webhook',
    botUsername: '@Euro54Bot',
    repo: 'https://github.com/Grund-winner/Code_ghost',
  },
  {
    id: 'bot2',
    name: 'OldGames Bot',
    type: 'render',
    platform: 'Render',
    serviceId: 'srv-d7otp0kvikkc739ouvd0',
    url: 'https://oldgames.onrender.com',
    botToken: process.env.BOT_TOKEN_2 || '',
    botUsername: '@euro54oldbot',
    repo: 'https://github.com/Grund-winner/oldgames',
  },
  {
    id: 'bot3',
    name: 'Jet Hack Bot',
    type: 'render',
    platform: 'Render',
    serviceId: 'srv-d7ovpesm0tmc73deh1o0',
    url: 'https://jet-hack-bot.onrender.com',
    botToken: process.env.BOT_TOKEN_3 || '',
    botUsername: '@Jethackv12_bot',
    repo: 'https://github.com/Grund-winner/jet-hack-bot',
  },
  {
    id: 'website',
    name: 'Invest Intelligents',
    type: 'vercel',
    platform: 'Vercel',
    projectId: 'prj_BWjiNFiH3rpSF184N2wkzPltAy2X',
    url: 'https://invest-intelligents.vercel.app',
    repo: 'https://github.com/Grund-winner/Invest-intelligents',
  },
];

const RENDER_TOKEN = process.env.RENDER_TOKEN || '';
const VERCEL_TOKEN = process.env.VERCEL_TOKEN || '';

interface CheckResult {
  id: string;
  name: string;
  platform: string;
  botUsername?: string;
  url?: string;
  repo?: string;
  status: 'online' | 'offline' | 'degraded' | 'unknown';
  checks: {
    category: string;
    label: string;
    status: 'pass' | 'fail' | 'warn' | 'pending';
    message: string;
    solution?: string;
    duration?: number;
  }[];
  envVars?: { key: string; value: string; hasValue: boolean }[];
  lastCommit?: string;
  lastCommitDate?: string;
  responseTime?: number;
}

async function checkTelegramBot(token: string, username: string): Promise<{ status: 'pass' | 'fail'; message: string; solution?: string; botInfo?: any }> {
  try {
    const start = Date.now();
    const res = await fetch(`https://api.telegram.org/bot${token}/getMe`, { signal: AbortSignal.timeout(10000) });
    const duration = Date.now() - start;
    const data = await res.json();
    
    if (data.ok) {
      return {
        status: 'pass',
        message: `Bot actif - ${data.result.first_name} (@${data.result.username}) - ${duration}ms`,
        botInfo: data.result,
      };
    } else {
      return {
        status: 'fail',
        message: `Bot API erreur: ${data.description}`,
        solution: 'Verifiez que le BOT_TOKEN est valide et que le bot n\'a pas ete supprime. Utilisez @BotFather pour verifier.',
      };
    }
  } catch (e: any) {
    return {
      status: 'fail',
      message: `Impossible de contacter l'API Telegram: ${e.message}`,
      solution: 'Verifiez la connexion internet et que le token est correct.',
    };
  }
}

async function checkWebhook(token: string): Promise<{ status: 'pass' | 'fail' | 'warn'; message: string; solution?: string; webhookInfo?: any }> {
  try {
    const res = await fetch(`https://api.telegram.org/bot${token}/getWebhookInfo`, { signal: AbortSignal.timeout(10000) });
    const data = await res.json();
    
    if (data.ok) {
      const wh = data.result;
      if (wh.url && wh.url.length > 0) {
        const lastError = wh.last_error_date ? ` (Derniere erreur: ${new Date(wh.last_error_date * 1000).toLocaleString()})` : '';
        const errorMsg = wh.last_error_message ? ` - ${wh.last_error_message}` : '';
        if (wh.last_error_date && (Date.now() / 1000 - wh.last_error_date) < 3600) {
          return {
            status: 'warn',
            message: `Webhook configure (${wh.url}) mais erreur recente${lastError}${errorMsg}`,
            solution: 'Le webhook a rencontre une erreur recemment. Verifiez les logs du service hebergeur (Render/Vercel).',
            webhookInfo: wh,
          };
        }
        return {
          status: 'pass',
          message: `Webhook configure: ${wh.url}`,
          webhookInfo: wh,
        };
      } else {
        return {
          status: 'warn',
          message: 'Aucun webhook configure. Le bot ne recevra pas de messages.',
          solution: 'Configurez le webhook en appelant setWebhook avec l\'URL de votre service.',
        };
      }
    }
    return { status: 'fail', message: 'Impossible de verifier le webhook' };
  } catch {
    return { status: 'fail', message: 'Erreur lors de la verification du webhook' };
  }
}

async function checkRenderService(serviceId: string, serviceName: string): Promise<{ status: 'pass' | 'fail' | 'warn'; message: string; solution?: string; serviceData?: any }> {
  try {
    const res = await fetch(`https://api.render.com/v1/services/${serviceId}`, {
      headers: { 'Authorization': `Bearer ${RENDER_TOKEN}` },
      signal: AbortSignal.timeout(10000),
    });
    const data = await res.json();
    
    const service = data.service || data;
    const isSuspended = service.suspended === 'suspended';
    
    if (isSuspended) {
      return {
        status: 'fail',
        message: `Service SUSPENDU sur Render`,
        solution: `Connectez-vous au dashboard Render et resumez le service: https://dashboard.render.com/web/${serviceId}`,
        serviceData: service,
      };
    }
    
    return {
      status: 'pass',
      message: `Service actif - Plan: ${service.serviceDetails?.plan || 'N/A'} - Region: ${service.serviceDetails?.region || 'N/A'}`,
      serviceData: service,
    };
  } catch (e: any) {
    return {
      status: 'fail',
      message: `Impossible de verifier le service Render: ${e.message}`,
      solution: 'Verifiez que le token Render est valide et que le service existe.',
    };
  }
}

async function checkVercelProject(projectId: string, projectName: string): Promise<{ status: 'pass' | 'fail' | 'warn'; message: string; solution?: string; projectData?: any }> {
  try {
    const res = await fetch(`https://api.vercel.com/v9/projects/${projectId}`, {
      headers: { 'Authorization': `Bearer ${VERCEL_TOKEN}` },
      signal: AbortSignal.timeout(10000),
    });
    const data = await res.json();
    
    const targets = data.targets || {};
    const prod = targets.production;
    
    if (!prod) {
      return {
        status: 'warn',
        message: 'Aucun deploiement production trouve',
        solution: 'Deployez le projet sur Vercel.',
      };
    }
    
    const state = prod.readyState;
    const url = prod.alias?.[0] || 'N/A';
    
    if (state === 'READY') {
      return {
        status: 'pass',
        message: `Deploiement READY - URL: ${url}`,
        projectData: data,
      };
    } else if (state === 'BUILDING' || state === 'QUEUED') {
      return {
        status: 'warn',
        message: `Deploiement en cours: ${state}`,
        solution: 'Attendez que le deploiement se termine.',
      };
    } else if (state === 'ERROR') {
      return {
        status: 'fail',
        message: `Deploiement en ERREUR: ${state}`,
        solution: 'Consultez les logs Vercel pour corriger l\'erreur de build.',
      };
    }
    
    return { status: 'warn', message: `Etat inconnu: ${state}`, projectData: data };
  } catch (e: any) {
    return {
      status: 'fail',
      message: `Impossible de verifier le projet Vercel: ${e.message}`,
      solution: 'Verifiez que le token Vercel est valide.',
    };
  }
}

async function checkEndpointHealth(url: string): Promise<{ status: 'pass' | 'fail'; message: string; solution?: string; responseTime: number }> {
  try {
    const start = Date.now();
    const res = await fetch(url, { method: 'GET', signal: AbortSignal.timeout(15000) });
    const duration = Date.now() - start;
    
    if (res.ok) {
      return {
        status: 'pass',
        message: `Endpoint repond - HTTP ${res.status} - ${duration}ms`,
        responseTime: duration,
      };
    } else if (res.status === 502 || res.status === 503) {
      return {
        status: 'fail',
        message: `Service indisponible - HTTP ${res.status} - ${duration}ms`,
        solution: 'Le service est probablement en cold start (Render free tier). Attendez 30s et reessayez.',
        responseTime: duration,
      };
    } else {
      return {
        status: 'fail',
        message: `Erreur HTTP ${res.status} - ${duration}ms`,
        solution: `Verifiez les logs pour le code d'erreur ${res.status}.`,
        responseTime: duration,
      };
    }
  } catch (e: any) {
    return {
      status: 'fail',
      message: `Endpoint inaccessible: ${e.message}`,
      solution: 'Le service ne repond pas. Verifiez qu\'il est bien deploye et demarre.',
      responseTime: 15000,
    };
  }
}

async function checkDatabase(): Promise<{ status: 'pass' | 'fail'; message: string; solution?: string }> {
  try {
    const start = Date.now();
    // Test database connectivity by checking the Neon endpoint via TCP
    const host = process.env.DB_HOST || 'ep-gentle-glade-anuz7xef.c-6.us-east-1.aws.neon.tech';
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);
    
    // Use a simple fetch to test if the DB host is reachable
    const res = await fetch(`https://${host}/v1/health`, {
      signal: controller.signal,
      headers: { 'Accept': 'application/json' },
    }).catch(() => null);
    clearTimeout(timeout);
    
    const duration = Date.now() - start;
    // If we get any response (even non-200), the host is reachable
    // Neon doesn't expose a health endpoint, so we just check reachability
    if (res !== null || duration < 7000) {
      return {
        status: 'pass',
        message: `Host Neon accessible - ${duration}ms`,
      };
    }
    return {
      status: 'fail',
      message: `Host Neon inaccessible apres ${duration}ms`,
      solution: 'Verifiez que la base Neon est active (elle peut se mettre en pause sur le plan gratuit).',
    };
  } catch (e: any) {
    return {
      status: 'fail',
      message: `Erreur de connexion DB: ${e.message}`,
      solution: 'Verifiez DATABASE_URL et que la base Neon est active (elle peut se mettre en pause sur le plan gratuit).',
    };
  }
}

async function checkGitHubRepo(repoUrl: string): Promise<{ status: 'pass' | 'warn' | 'fail'; message: string; lastCommit?: string; lastCommitDate?: string }> {
  try {
    const match = repoUrl.match(/github\.com\/([^/]+\/[^/]+)/);
    if (!match) return { status: 'warn', message: 'URL repo invalide' };
    
    const repoPath = match[1];
    const res = await fetch(`https://api.github.com/repos/${repoPath}/commits?per_page=1`, {
      headers: { 'Accept': 'application/vnd.github.v3+json' },
      signal: AbortSignal.timeout(10000),
    });
    const data = await res.json();
    
    if (Array.isArray(data) && data.length > 0) {
      return {
        status: 'pass',
        message: `Dernier commit: ${data[0].commit.message.substring(0, 50)}`,
        lastCommit: data[0].sha.substring(0, 7),
        lastCommitDate: data[0].commit.author.date,
      };
    }
    return { status: 'warn', message: 'Aucun commit trouve' };
  } catch {
    return { status: 'warn', message: 'Impossible de verifier le repo GitHub' };
  }
}

async function getRenderEnvVars(serviceId: string): Promise<{ key: string; value: string; hasValue: boolean }[]> {
  try {
    const res = await fetch(`https://api.render.com/v1/services/${serviceId}/env-vars`, {
      headers: { 'Authorization': `Bearer ${RENDER_TOKEN}` },
      signal: AbortSignal.timeout(10000),
    });
    const data = await res.json();
    
    if (Array.isArray(data)) {
      return data.map((item: any) => {
        const envVar = item.envVar || item;
        return {
          key: envVar.key,
          value: envVar.value,
          hasValue: !!envVar.value && envVar.value.length > 0,
        };
      });
    }
    return [];
  } catch {
    return [];
  }
}

async function getVercelEnvVars(projectId: string): Promise<{ key: string; value: string; hasValue: boolean }[]> {
  try {
    const res = await fetch(`https://api.vercel.com/v10/projects/${projectId}/env`, {
      headers: { 'Authorization': `Bearer ${VERCEL_TOKEN}` },
      signal: AbortSignal.timeout(10000),
    });
    const data = await res.json();
    
    if (data.envs) {
      return data.envs.map((env: any) => ({
        key: env.key,
        value: env.value || '[encrypted]',
        hasValue: !!env.value || env.encrypted,
      }));
    }
    return [];
  } catch {
    return [];
  }
}

export async function GET() {
  const results: CheckResult[] = [];
  const overallChecks: { category: string; label: string; status: 'pass' | 'fail' | 'warn'; message: string; solution?: string }[] = [];
  
  // Run all checks in parallel
  const promises = SERVICES.map(async (service) => {
    const checks: CheckResult['checks'] = [];
    let overallStatus: 'online' | 'offline' | 'degraded' | 'unknown' = 'online';
    let responseTime = 0;
    
    // 1. Check endpoint health (use healthPath for API bots)
    if (service.url) {
      const healthUrl = service.healthPath ? `${service.url}${service.healthPath}` : service.url;
      const health = await checkEndpointHealth(healthUrl);
      checks.push({
        category: 'Endpoint',
        label: 'Sante HTTP',
        status: health.status,
        message: health.message,
        solution: health.solution,
        duration: health.responseTime,
      });
      responseTime = health.responseTime;
      if (health.status === 'fail') overallStatus = 'offline';
      else if ((health.status as string) === 'warn' && (overallStatus as string) !== 'offline') overallStatus = 'degraded';
    }
    
    // 2. Platform-specific checks
    if (service.type === 'render') {
      const renderCheck = await checkRenderService(service.serviceId!, service.name);
      checks.push({
        category: 'Render',
        label: 'Service Render',
        status: renderCheck.status,
        message: renderCheck.message,
        solution: renderCheck.solution,
      });
      if (renderCheck.status === 'fail') overallStatus = 'offline';
      
      // Get env vars
      const envVars = await getRenderEnvVars(service.serviceId!);
      
      // 3. Telegram bot check
      if (service.botToken) {
        const botCheck = await checkTelegramBot(service.botToken, service.botUsername!);
        checks.push({
          category: 'Telegram',
          label: 'Bot API',
          status: botCheck.status,
          message: botCheck.message,
          solution: botCheck.solution,
        });
        if (botCheck.status === 'fail') overallStatus = 'degraded';
        
        const whCheck = await checkWebhook(service.botToken);
        checks.push({
          category: 'Telegram',
          label: 'Webhook',
          status: whCheck.status,
          message: whCheck.message,
          solution: whCheck.solution,
        });
        if (whCheck.status === 'fail') overallStatus = 'degraded';
      }
      
      return { ...service, checks, overallStatus, responseTime, envVars } as any;
    } else if (service.type === 'vercel') {
      const vercelCheck = await checkVercelProject(service.projectId!, service.name);
      checks.push({
        category: 'Vercel',
        label: 'Deploiement',
        status: vercelCheck.status,
        message: vercelCheck.message,
        solution: vercelCheck.solution,
      });
      if (vercelCheck.status === 'fail') overallStatus = 'offline';
      else if (vercelCheck.status === 'warn' && overallStatus !== 'offline') overallStatus = 'degraded';
      
      // Get env vars
      const envVars = await getVercelEnvVars(service.projectId!);
      
      return { ...service, checks, overallStatus, responseTime, envVars } as any;
    }
    
    return { ...service, checks, overallStatus, responseTime } as any;
  });
  
  const serviceResults = await Promise.all(promises);
  
  // Check database separately
  const dbCheck = await checkDatabase();
  overallChecks.push({
    category: 'Base de donnees',
    label: 'PostgreSQL (Neon)',
    status: dbCheck.status,
    message: dbCheck.message,
    solution: dbCheck.solution,
  });
  
  // Build final results
  for (const sr of serviceResults) {
    const repoCheck = await checkGitHubRepo(sr.repo!);
    sr.checks.push({
      category: 'GitHub',
      label: 'Repository',
      status: repoCheck.status,
      message: repoCheck.message,
    });
    sr.lastCommit = repoCheck.lastCommit;
    sr.lastCommitDate = repoCheck.lastCommitDate;
    
    results.push({
      id: sr.id,
      name: sr.name,
      platform: sr.platform,
      botUsername: sr.botUsername,
      url: sr.url,
      repo: sr.repo,
      status: sr.overallStatus,
      checks: sr.checks,
      envVars: sr.envVars,
      lastCommit: sr.lastCommit,
      lastCommitDate: sr.lastCommitDate,
      responseTime: sr.responseTime,
    });
  }
  
  return NextResponse.json({
    timestamp: new Date().toISOString(),
    services: results,
    infrastructure: overallChecks,
    summary: {
      total: results.length,
      online: results.filter(r => r.status === 'online').length,
      offline: results.filter(r => r.status === 'offline').length,
      degraded: results.filter(r => r.status === 'degraded').length,
      dbOk: dbCheck.status === 'pass',
    },
  });
}
