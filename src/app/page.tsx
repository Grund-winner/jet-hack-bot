'use client';

import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

// ─── SVG Icons ────────────────────────────────────────────────────────────
function IconBot({ className = '' }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="11" width="18" height="10" rx="2" />
      <circle cx="12" cy="5" r="2" />
      <path d="M12 7v4" />
      <path d="M8 16h.01" /><path d="M16 16h.01" />
      <path d="M9 20h6" />
    </svg>
  );
}

function IconGlobe({ className = '' }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" />
      <path d="M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20" />
      <path d="M2 12h20" />
    </svg>
  );
}

function IconServer({ className = '' }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="2" width="20" height="8" rx="2" />
      <rect x="2" y="14" width="20" height="8" rx="2" />
      <circle cx="6" cy="6" r="1" /><circle cx="6" cy="18" r="1" />
      <path d="M6 10v4" />
    </svg>
  );
}

function IconDatabase({ className = '' }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <ellipse cx="12" cy="5" rx="9" ry="3" />
      <path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3" />
      <path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5" />
    </svg>
  );
}

function IconRefresh({ className = '' }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 12a9 9 0 1 1-3.36-7" />
      <path d="M21 3v6h-6" />
    </svg>
  );
}

function IconShield({ className = '' }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
      <path d="M9 12l2 2 4-4" />
    </svg>
  );
}

function IconWarning({ className = '' }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
      <line x1="12" y1="9" x2="12" y2="13" />
      <line x1="12" y1="17" x2="12.01" y2="17" />
    </svg>
  );
}

function IconKey({ className = '' }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.778 7.778 5.5 5.5 0 0 1 7.777-7.777zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4" />
    </svg>
  );
}

function IconActivity({ className = '' }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M22 12h-4l-3 9L9 3l-3 9H2" />
    </svg>
  );
}

// ─── Types ────────────────────────────────────────────────────────────────
interface CheckItem {
  category: string;
  label: string;
  status: 'pass' | 'fail' | 'warn' | 'pending';
  message: string;
  solution?: string;
  duration?: number;
}

interface ServiceResult {
  id: string;
  name: string;
  platform: string;
  botUsername?: string;
  url?: string;
  repo?: string;
  status: 'online' | 'offline' | 'degraded' | 'unknown';
  checks: CheckItem[];
  envVars?: { key: string; value: string; hasValue: boolean }[];
  lastCommit?: string;
  lastCommitDate?: string;
  responseTime?: number;
}

interface DiagnosticData {
  timestamp: string;
  services: ServiceResult[];
  infrastructure: CheckItem[];
  summary: {
    total: number;
    online: number;
    offline: number;
    degraded: number;
    dbOk: boolean;
  };
}

// ─── Main Component ───────────────────────────────────────────────────────
export default function DiagnosticPanel() {
  const [data, setData] = useState<DiagnosticData | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'overview' | 'bots' | 'infra' | 'env'>('overview');
  const [selectedService, setSelectedService] = useState<string | null>(null);
  const [expandedChecks, setExpandedChecks] = useState<Set<string>>(new Set());
  const [lastRefresh, setLastRefresh] = useState<string>('');

  const fetchDiagnostics = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/diagnostics');
      const json = await res.json();
      setData(json);
      setLastRefresh(new Date().toLocaleTimeString('fr-FR'));
    } catch (e) {
      console.error('Failed to fetch diagnostics:', e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchDiagnostics();
    const interval = setInterval(fetchDiagnostics, 60000); // Refresh every 60s
    return () => clearInterval(interval);
  }, [fetchDiagnostics]);

  const toggleCheck = (serviceId: string, label: string) => {
    const key = `${serviceId}-${label}`;
    setExpandedChecks(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  // ─── Status helpers ───
  const statusColor = (status: string) => {
    switch (status) {
      case 'online': case 'pass': return 'text-emerald-400';
      case 'offline': case 'fail': return 'text-red-400';
      case 'degraded': case 'warn': return 'text-amber-400';
      default: return 'text-slate-400';
    }
  };

  const statusBg = (status: string) => {
    switch (status) {
      case 'online': case 'pass': return 'bg-emerald-500/10 border-emerald-500/20';
      case 'offline': case 'fail': return 'bg-red-500/10 border-red-500/20';
      case 'degraded': case 'warn': return 'bg-amber-500/10 border-amber-500/20';
      default: return 'bg-slate-500/10 border-slate-500/20';
    }
  };

  const statusDot = (status: string) => {
    switch (status) {
      case 'online': case 'pass': return 'bg-emerald-400 pulse-green';
      case 'offline': case 'fail': return 'bg-red-400 pulse-red';
      case 'degraded': case 'warn': return 'bg-amber-400 pulse-yellow';
      default: return 'bg-slate-400';
    }
  };

  const statusIcon = (status: string) => {
    if (status === 'pass' || status === 'online') return '✓';
    if (status === 'fail' || status === 'offline') return '✕';
    if (status === 'warn' || status === 'degraded') return '!';
    return '…';
  };

  const statusLabel = (status: string) => {
    switch (status) {
      case 'online': return 'En ligne';
      case 'offline': return 'Hors ligne';
      case 'degraded': return 'Degradé';
      default: return 'Inconnu';
    }
  };

  const getStatusGlow = (status: string) => {
    switch (status) {
      case 'online': return 'glow-green';
      case 'offline': return 'glow-red';
      case 'degraded': return 'glow-yellow';
      default: return '';
    }
  };

  // ─── Render ───
  return (
    <div className="min-h-screen p-4 md:p-8 max-w-[1400px] mx-auto">
      {/* Header */}
      <motion.header
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: [0.4, 0, 0.2, 1] }}
        className="mb-8"
      >
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-500/20 to-cyan-500/20 border border-emerald-500/20 flex items-center justify-center">
                <IconShield className="w-5 h-5 text-emerald-400" />
              </div>
              <h1 className="text-2xl md:text-3xl font-bold tracking-tight bg-gradient-to-r from-white via-slate-200 to-slate-400 bg-clip-text text-transparent">
                EURO54 Diagnostic
              </h1>
            </div>
            <p className="text-sm text-slate-500 ml-[52px]">
              Super Panneau d&apos;Administration &bull; Monitoring temps reel
            </p>
          </div>

          <div className="flex items-center gap-3">
            {lastRefresh && (
              <span className="text-xs text-slate-500 hidden md:block">
                Derniere verification: {lastRefresh}
              </span>
            )}
            <button
              onClick={fetchDiagnostics}
              disabled={loading}
              className="glass glass-hover px-4 py-2 flex items-center gap-2 text-sm text-slate-300 hover:text-white transition-colors disabled:opacity-50"
            >
              <motion.div
                animate={loading ? { rotate: 360 } : {}}
                transition={loading ? { duration: 1, repeat: Infinity, ease: 'linear' } : {}}
              >
                <IconRefresh className="w-4 h-4" />
              </motion.div>
              <span>{loading ? 'Analyse...' : 'Actualiser'}</span>
            </button>
          </div>
        </div>
      </motion.header>

      {/* Loading state */}
      {loading && !data && (
        <div className="flex flex-col items-center justify-center py-32">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-cyan-500/20 to-purple-500/20 border border-cyan-500/20 flex items-center justify-center mb-4">
            <motion.div
              animate={{ rotate: 360 }}
              transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}
            >
              <IconActivity className="w-8 h-8 text-cyan-400" />
            </motion.div>
          </div>
          <p className="text-slate-400 text-sm">Analyse en cours des services...</p>
          <div className="flex gap-1 mt-3">
            {[0, 1, 2].map(i => (
              <motion.div
                key={i}
                className="w-2 h-2 rounded-full bg-cyan-400"
                animate={{ scale: [1, 1.5, 1], opacity: [0.5, 1, 0.5] }}
                transition={{ duration: 1, repeat: Infinity, delay: i * 0.2 }}
              />
            ))}
          </div>
        </div>
      )}

      {/* Data display */}
      {data && (
        <>
          {/* Summary Bar */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1, duration: 0.5 }}
            className="glass p-4 mb-6 flex flex-wrap items-center justify-between gap-4"
          >
            <div className="flex items-center gap-6">
              <div className="flex items-center gap-2">
                <div className={`w-3 h-3 rounded-full ${data.summary.online === data.summary.total ? 'bg-emerald-400 pulse-green' : data.summary.offline > 0 ? 'bg-red-400 pulse-red' : 'bg-amber-400 pulse-yellow'}`} />
                <span className="text-sm font-medium text-slate-300">
                  {data.summary.online === data.summary.total ? 'Tous les systemes operationnels' :
                   data.summary.offline > 0 ? `${data.summary.offline} service(s) en panne` :
                   `${data.summary.degraded} service(s) degrades`}
                </span>
              </div>
            </div>
            <div className="flex items-center gap-4 text-xs">
              <div className="flex items-center gap-1.5">
                <div className="w-2 h-2 rounded-full bg-emerald-400" />
                <span className="text-slate-400">{data.summary.online} En ligne</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="w-2 h-2 rounded-full bg-amber-400" />
                <span className="text-slate-400">{data.summary.degraded} Degradé</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="w-2 h-2 rounded-full bg-red-400" />
                <span className="text-slate-400">{data.summary.offline} Hors ligne</span>
              </div>
            </div>
          </motion.div>

          {/* Tab Navigation */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2, duration: 0.5 }}
            className="flex gap-2 mb-6 overflow-x-auto pb-2"
          >
            {[
              { id: 'overview' as const, label: 'Vue d\'ensemble', icon: <IconActivity className="w-4 h-4" /> },
              { id: 'bots' as const, label: 'Bots', icon: <IconBot className="w-4 h-4" /> },
              { id: 'infra' as const, label: 'Infrastructure', icon: <IconServer className="w-4 h-4" /> },
              { id: 'env' as const, label: 'Variables', icon: <IconKey className="w-4 h-4" /> },
            ].map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`glass glass-hover px-4 py-2.5 flex items-center gap-2 text-sm whitespace-nowrap transition-all ${
                  activeTab === tab.id ? 'tab-active text-white' : 'text-slate-400'
                }`}
              >
                {tab.icon}
                <span>{tab.label}</span>
              </button>
            ))}
          </motion.div>

          {/* Tab Content */}
          <AnimatePresence mode="wait">
            {/* OVERVIEW TAB */}
            {activeTab === 'overview' && (
              <motion.div
                key="overview"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.3 }}
              >
                {/* Service Cards Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                  {data.services.map((service, idx) => (
                    <motion.div
                      key={service.id}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: idx * 0.1, duration: 0.4 }}
                      className={`diagnostic-card glass p-5 ${getStatusGlow(service.status)} cursor-pointer`}
                      onClick={() => { setActiveTab('bots'); setSelectedService(service.id); }}
                    >
                      <div className="flex items-start justify-between mb-4">
                        <div className="flex items-center gap-3">
                          <div className={`w-11 h-11 rounded-2xl border flex items-center justify-center ${
                            service.id === 'website'
                              ? 'bg-gradient-to-br from-cyan-500/15 to-blue-500/15 border-cyan-500/20'
                              : 'bg-gradient-to-br from-purple-500/15 to-pink-500/15 border-purple-500/20'
                          }`}>
                            {service.id === 'website'
                              ? <IconGlobe className="w-5 h-5 text-cyan-400" />
                              : <IconBot className="w-5 h-5 text-purple-400" />
                            }
                          </div>
                          <div>
                            <h3 className="font-semibold text-white text-sm">{service.name}</h3>
                            <div className="flex items-center gap-2 mt-0.5">
                              <span className="text-xs text-slate-500">{service.platform}</span>
                              {service.botUsername && (
                                <span className="text-xs text-cyan-500/70">{service.botUsername}</span>
                              )}
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <div className={`w-3 h-3 rounded-full ${statusDot(service.status)}`} />
                          <span className={`text-xs font-medium ${statusColor(service.status)}`}>
                            {statusLabel(service.status)}
                          </span>
                        </div>
                      </div>

                      {/* Mini checks */}
                      <div className="space-y-2">
                        {service.checks.slice(0, 3).map((check, ci) => (
                          <div key={ci} className="flex items-center gap-2">
                            <div className={`w-5 h-5 rounded-md flex items-center justify-center text-xs font-bold ${statusBg(check.status)}`}>
                              <span className={statusColor(check.status)}>{statusIcon(check.status)}</span>
                            </div>
                            <span className="text-xs text-slate-400 truncate flex-1">{check.label}</span>
                            {check.duration && (
                              <span className="text-[10px] text-slate-600">{check.duration}ms</span>
                            )}
                          </div>
                        ))}
                      </div>

                      {/* Footer */}
                      <div className="mt-4 pt-3 border-t border-white/5 flex items-center justify-between">
                        {service.lastCommit && (
                          <span className="text-[10px] text-slate-600">
                            commit: {service.lastCommit}
                          </span>
                        )}
                        {service.responseTime != null && service.responseTime > 0 && (
                          <span className="text-[10px] text-slate-600">
                            {service.responseTime}ms
                          </span>
                        )}
                      </div>
                    </motion.div>
                  ))}
                </div>

                {/* Infrastructure Section */}
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.4, duration: 0.4 }}
                  className="glass p-5"
                >
                  <div className="flex items-center gap-2 mb-4">
                    <IconDatabase className="w-5 h-5 text-cyan-400" />
                    <h3 className="font-semibold text-white text-sm">Infrastructure</h3>
                  </div>
                  <div className="space-y-3">
                    {data.infrastructure.map((item, idx) => (
                      <div
                        key={idx}
                        className={`flex items-center gap-3 p-3 rounded-xl border ${statusBg(item.status)}`}
                      >
                        <div className={`w-6 h-6 rounded-lg flex items-center justify-center text-xs font-bold ${statusBg(item.status)}`}>
                          <span className={statusColor(item.status)}>{statusIcon(item.status)}</span>
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="text-sm text-white">{item.label}</div>
                          <div className="text-xs text-slate-500 truncate">{item.message}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                </motion.div>
              </motion.div>
            )}

            {/* BOTS TAB */}
            {activeTab === 'bots' && (
              <motion.div
                key="bots"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.3 }}
                className="space-y-4"
              >
                {data.services.map((service, idx) => (
                  <motion.div
                    key={service.id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: idx * 0.1, duration: 0.4 }}
                    className={`diagnostic-card glass ${getStatusGlow(service.status)}`}
                  >
                    {/* Service Header */}
                    <div
                      className="p-5 cursor-pointer flex items-center justify-between"
                      onClick={() => setSelectedService(selectedService === service.id ? null : service.id)}
                    >
                      <div className="flex items-center gap-4">
                        <div className={`w-12 h-12 rounded-2xl border flex items-center justify-center ${
                          service.id === 'website'
                            ? 'bg-gradient-to-br from-cyan-500/15 to-blue-500/15 border-cyan-500/20'
                            : 'bg-gradient-to-br from-purple-500/15 to-pink-500/15 border-purple-500/20'
                        }`}>
                          {service.id === 'website'
                            ? <IconGlobe className="w-6 h-6 text-cyan-400" />
                            : <IconBot className="w-6 h-6 text-purple-400" />
                          }
                        </div>
                        <div>
                          <div className="flex items-center gap-3">
                            <h3 className="font-semibold text-white">{service.name}</h3>
                            <div className={`px-2 py-0.5 rounded-full text-[10px] font-medium border ${statusBg(service.status)} ${statusColor(service.status)}`}>
                              {statusLabel(service.status)}
                            </div>
                          </div>
                          <div className="flex items-center gap-3 mt-1 text-xs text-slate-500">
                            <span>{service.platform}</span>
                            {service.botUsername && <span className="text-cyan-500/70">{service.botUsername}</span>}
                            {service.url && <span className="truncate max-w-[200px]">{service.url}</span>}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-4">
                        <div className={`w-4 h-4 rounded-full ${statusDot(service.status)}`} />
                        <motion.div
                          animate={{ rotate: selectedService === service.id ? 180 : 0 }}
                          transition={{ duration: 0.2 }}
                          className="text-slate-500"
                        >
                          <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M6 9l6 6 6-6" /></svg>
                        </motion.div>
                      </div>
                    </div>

                    {/* Expanded Details */}
                    <AnimatePresence>
                      {selectedService === service.id && (
                        <motion.div
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: 'auto', opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          transition={{ duration: 0.3 }}
                          className="overflow-hidden"
                        >
                          <div className="px-5 pb-5 border-t border-white/5 pt-4">
                            {/* Checks Grid */}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-4">
                              {service.checks.map((check, ci) => {
                                const checkKey = `${service.id}-${check.label}`;
                                const isExpanded = expandedChecks.has(checkKey);
                                return (
                                  <motion.div
                                    key={ci}
                                    initial={{ opacity: 0, scale: 0.95 }}
                                    animate={{ opacity: 1, scale: 1 }}
                                    transition={{ delay: ci * 0.05 }}
                                    className={`p-3 rounded-xl border ${statusBg(check.status)} cursor-pointer`}
                                    onClick={() => toggleCheck(service.id, check.label)}
                                  >
                                    <div className="flex items-center gap-3">
                                      <div className={`w-7 h-7 rounded-lg flex items-center justify-center text-xs font-bold border ${statusBg(check.status)}`}>
                                        <span className={statusColor(check.status)}>{statusIcon(check.status)}</span>
                                      </div>
                                      <div className="flex-1 min-w-0">
                                        <div className="flex items-center justify-between">
                                          <span className="text-xs font-medium text-slate-300">{check.label}</span>
                                          <span className="text-[10px] text-slate-600 px-1.5 py-0.5 rounded bg-white/5">{check.category}</span>
                                        </div>
                                        <p className="text-xs text-slate-500 mt-0.5 truncate">{check.message}</p>
                                      </div>
                                      {check.duration && (
                                        <span className="text-[10px] text-slate-600">{check.duration}ms</span>
                                      )}
                                    </div>

                                    {/* Expanded Solution */}
                                    <AnimatePresence>
                                      {isExpanded && check.solution && (
                                        <motion.div
                                          initial={{ height: 0, opacity: 0 }}
                                          animate={{ height: 'auto', opacity: 1 }}
                                          exit={{ height: 0, opacity: 0 }}
                                          className="overflow-hidden"
                                        >
                                          <div className="mt-2 pt-2 border-t border-white/5">
                                            <div className="flex items-start gap-2">
                                              <IconWarning className="w-3.5 h-3.5 text-amber-400 mt-0.5 shrink-0" />
                                              <div>
                                                <span className="text-[10px] font-medium text-amber-400">Solution proposee:</span>
                                                <p className="text-xs text-slate-400 mt-0.5">{check.solution}</p>
                                              </div>
                                            </div>
                                          </div>
                                        </motion.div>
                                      )}
                                    </AnimatePresence>
                                  </motion.div>
                                );
                              })}
                            </div>

                            {/* Service Meta */}
                            <div className="glass-sm p-3 space-y-2">
                              <div className="flex items-center gap-2 text-xs">
                                <span className="text-slate-600 w-24">Repo:</span>
                                <span className="text-slate-400 truncate">{service.repo}</span>
                              </div>
                              {service.lastCommit && (
                                <div className="flex items-center gap-2 text-xs">
                                  <span className="text-slate-600 w-24">Dernier commit:</span>
                                  <span className="text-slate-400 font-mono">{service.lastCommit}</span>
                                  {service.lastCommitDate && (
                                    <span className="text-slate-600">{new Date(service.lastCommitDate).toLocaleDateString('fr-FR')}</span>
                                  )}
                                </div>
                              )}
                              {service.responseTime != null && (
                                <div className="flex items-center gap-2 text-xs">
                                  <span className="text-slate-600 w-24">Temps de reponse:</span>
                                  <span className={service.responseTime > 5000 ? 'text-amber-400' : 'text-emerald-400'}>
                                    {service.responseTime}ms
                                  </span>
                                </div>
                              )}
                            </div>
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </motion.div>
                ))}
              </motion.div>
            )}

            {/* INFRASTRUCTURE TAB */}
            {activeTab === 'infra' && (
              <motion.div
                key="infra"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.3 }}
                className="space-y-4"
              >
                {/* Render Services */}
                <div className="glass p-5">
                  <div className="flex items-center gap-2 mb-4">
                    <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-green-500/15 to-emerald-500/15 border border-green-500/20 flex items-center justify-center">
                      <IconServer className="w-4 h-4 text-green-400" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-white text-sm">Render Services</h3>
                      <p className="text-xs text-slate-600">2 services deploies</p>
                    </div>
                  </div>
                  <div className="space-y-3">
                    {data.services.filter(s => s.platform === 'Render').map((service, idx) => (
                      <motion.div
                        key={idx}
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: idx * 0.1 }}
                        className="glass-sm p-4"
                      >
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-2">
                            <div className={`w-2.5 h-2.5 rounded-full ${statusDot(service.status)}`} />
                            <span className="text-sm font-medium text-white">{service.name}</span>
                          </div>
                          <span className={`text-xs ${statusColor(service.status)}`}>{statusLabel(service.status)}</span>
                        </div>
                        <div className="text-xs text-slate-500 space-y-1">
                          <div>URL: <span className="text-slate-400">{service.url}</span></div>
                          <div>Service ID: <span className="text-slate-400 font-mono text-[10px]">{service.id}</span></div>
                          <div>Region: <span className="text-slate-400">Oregon (US)</span></div>
                          <div>Plan: <span className="text-slate-400">Free</span></div>
                        </div>
                      </motion.div>
                    ))}
                  </div>
                </div>

                {/* Vercel Projects */}
                <div className="glass p-5">
                  <div className="flex items-center gap-2 mb-4">
                    <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-slate-500/15 to-zinc-500/15 border border-slate-500/20 flex items-center justify-center">
                      <IconGlobe className="w-4 h-4 text-slate-300" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-white text-sm">Vercel Projects</h3>
                      <p className="text-xs text-slate-600">2 projets deployes</p>
                    </div>
                  </div>
                  <div className="space-y-3">
                    {data.services.filter(s => s.platform === 'Vercel').map((service, idx) => (
                      <motion.div
                        key={idx}
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: idx * 0.1 }}
                        className="glass-sm p-4"
                      >
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-2">
                            <div className={`w-2.5 h-2.5 rounded-full ${statusDot(service.status)}`} />
                            <span className="text-sm font-medium text-white">{service.name}</span>
                          </div>
                          <span className={`text-xs ${statusColor(service.status)}`}>{statusLabel(service.status)}</span>
                        </div>
                        <div className="text-xs text-slate-500 space-y-1">
                          <div>URL: <span className="text-slate-400">{service.url}</span></div>
                          <div>Framework: <span className="text-slate-400">{service.id === 'website' ? 'Next.js' : 'Node.js API'}</span></div>
                          <div>Plan: <span className="text-slate-400">Hobby</span></div>
                        </div>
                      </motion.div>
                    ))}
                  </div>
                </div>

                {/* Database */}
                <div className="glass p-5">
                  <div className="flex items-center gap-2 mb-4">
                    <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-blue-500/15 to-indigo-500/15 border border-blue-500/20 flex items-center justify-center">
                      <IconDatabase className="w-4 h-4 text-blue-400" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-white text-sm">Base de donnees</h3>
                      <p className="text-xs text-slate-600">Neon PostgreSQL</p>
                    </div>
                  </div>
                  {data.infrastructure.map((item, idx) => (
                    <div key={idx} className={`p-3 rounded-xl border ${statusBg(item.status)}`}>
                      <div className="flex items-center gap-2">
                        <span className={`text-xs font-bold ${statusColor(item.status)}`}>{statusIcon(item.status)}</span>
                        <span className="text-xs text-slate-400">{item.message}</span>
                      </div>
                    </div>
                  ))}
                  <div className="glass-sm p-3 mt-3 text-xs text-slate-500 space-y-1">
                    <div>Host: <span className="text-slate-400 font-mono">ep-gentle-glade-anuz7xef.c-6.us-east-1.aws.neon.tech</span></div>
                    <div>Database: <span className="text-slate-400">neondb</span></div>
                    <div>SSL Mode: <span className="text-slate-400">require</span></div>
                  </div>
                </div>
              </motion.div>
            )}

            {/* ENV VARS TAB */}
            {activeTab === 'env' && (
              <motion.div
                key="env"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.3 }}
                className="space-y-4"
              >
                {data.services.filter(s => s.envVars && s.envVars.length > 0).map((service, idx) => (
                  <motion.div
                    key={idx}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: idx * 0.1 }}
                    className="diagnostic-card glass p-5"
                  >
                    <div className="flex items-center gap-3 mb-4">
                      <div className={`w-9 h-9 rounded-xl border flex items-center justify-center ${
                        service.platform === 'Render'
                          ? 'bg-gradient-to-br from-green-500/15 to-emerald-500/15 border-green-500/20'
                          : 'bg-gradient-to-br from-slate-500/15 to-zinc-500/15 border-slate-500/20'
                      }`}>
                        {service.id === 'website'
                          ? <IconGlobe className="w-4 h-4 text-cyan-400" />
                          : <IconBot className="w-4 h-4 text-purple-400" />
                        }
                      </div>
                      <div>
                        <h3 className="font-semibold text-white text-sm">{service.name}</h3>
                        <span className="text-xs text-slate-500">{service.platform} &bull; {service.envVars?.length} variables</span>
                      </div>
                    </div>

                    <div className="space-y-2">
                      {service.envVars?.map((env, ei) => (
                        <div key={ei} className={`flex items-center gap-3 p-2.5 rounded-lg border ${
                          env.hasValue ? 'border-emerald-500/10 bg-emerald-500/5' : 'border-red-500/10 bg-red-500/5'
                        }`}>
                          <div className={`w-2 h-2 rounded-full ${env.hasValue ? 'bg-emerald-400' : 'bg-red-400'}`} />
                          <span className="text-xs font-mono text-slate-300 w-36 shrink-0">{env.key}</span>
                          <span className={`text-xs truncate ${env.hasValue ? 'text-slate-500' : 'text-red-400 font-medium'}`}>
                            {env.hasValue
                              ? (env.value.length > 20 ? env.value.substring(0, 20) + '...' : env.value)
                              : 'NON DEFINIE'}
                          </span>
                          {!env.hasValue && (
                            <span className="text-[10px] text-red-400/70 ml-auto shrink-0">Requise</span>
                          )}
                        </div>
                      ))}
                    </div>
                  </motion.div>
                ))}
              </motion.div>
            )}
          </AnimatePresence>

          {/* Footer */}
          <motion.footer
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.6 }}
            className="mt-8 pt-6 border-t border-white/5 flex flex-col md:flex-row items-center justify-between gap-2 text-[10px] text-slate-700"
          >
            <span>EURO54 Diagnostic Panel &bull; Monitoring temps reel</span>
            <span>Donnees mises a jour automatiquement toutes les 60 secondes</span>
          </motion.footer>
        </>
      )}
    </div>
  );
}
