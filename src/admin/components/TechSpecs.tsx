import React, { useState, useEffect } from 'react';

export default function TechSpecs() {
  const [logs, setLogs] = useState<string[]>([
    '> [INFO] SYSTEM_INIT_COMPLETE',
    '> [INFO] NODE_04_LISTENING_8080',
    '> [AUTH] ADMIN_LOGIN_SUCCESS: NODE_ALPHA_9',
    '> [SYNC] 12_AUDIO_FILES_INDEXED'
  ]);

  useEffect(() => {
    const interval = setInterval(() => {
      const newLogs = [
        '> [PING] SECTOR_7_OK',
        '> [SYNC] BACKGROUND_INDEXING...',
        '> [WARN] LATENCY_SPIKE_DETECTED',
        '> [INFO] CACHE_CLEARED'
      ];
      const randomLog = newLogs[Math.floor(Math.random() * newLogs.length)];
      setLogs(prev => {
        const updated = [...prev, randomLog];
        if (updated.length > 8) return updated.slice(updated.length - 8);
        return updated;
      });
    }, 5000);
    return () => clearInterval(interval);
  }, []);

  return (
    <aside className="space-y-6">
      <div className="bg-surface-container-lowest border border-zinc-800 p-6 machined-edge">
        <div className="flex items-center gap-2 mb-4">
          <span className="material-symbols-outlined text-orange-500 text-sm">memory</span>
          <h3 className="font-label text-[10px] uppercase tracking-widest text-zinc-400">Storage_Allocation</h3>
        </div>
        <div className="space-y-4">
          <div>
            <div className="flex justify-between text-[8px] font-label uppercase mb-1">
              <span>Disk_Usage</span>
              <span className="text-orange-500">74%</span>
            </div>
            <div className="h-1 w-full bg-zinc-800">
              <div className="h-full bg-orange-600 w-3/4"></div>
            </div>
          </div>
          <div>
            <div className="flex justify-between text-[8px] font-label uppercase mb-1">
              <span>Bandwidth_Load</span>
              <span className="text-orange-500">12%</span>
            </div>
            <div className="h-1 w-full bg-zinc-800">
              <div className="h-full bg-orange-600 w-[12%]"></div>
            </div>
          </div>
        </div>
      </div>

      <div className="bg-zinc-900 border border-zinc-800 p-6 relative overflow-hidden machined-edge">
        <div className="absolute top-0 right-0 p-2 text-[8px] font-label text-zinc-700">MOD-099</div>
        <h3 className="font-label text-[10px] uppercase tracking-widest text-zinc-500 mb-6">Active_Terminal_Feed</h3>
        <div className="space-y-2 font-mono text-[9px] text-zinc-600 leading-tight">
          {logs.map((log, i) => (
            <p key={i} className={log.includes('WARN') || log.includes('AUTH') ? 'text-orange-500/60' : ''}>
              {log}
            </p>
          ))}
          <p className="animate-pulse">&gt; _</p>
        </div>
      </div>
    </aside>
  );
}
