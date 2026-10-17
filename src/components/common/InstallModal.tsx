import React, { useState, useEffect } from 'react';
import {
  Download,
  Smartphone,
  Monitor,
  Apple,
  Check,
  Copy,
  Terminal,
  ExternalLink,
  Shield,
  X,
  Layers,
  Sparkles,
  Laptop
} from 'lucide-react';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

export const InstallModal: React.FC<{ isOpen: boolean; onClose: () => void }> = ({
  isOpen,
  onClose,
}) => {
  const [activeTab, setActiveTab] = useState<'pwa' | 'source'>('pwa');
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isInstalled, setIsInstalled] = useState(false);
  const [copiedCmd, setCopiedCmd] = useState(false);

  useEffect(() => {
    // Check if already installed
    if (window.matchMedia('(display-mode: standalone)').matches) {
      setIsInstalled(true);
    }

    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };

    window.addEventListener('beforeinstallprompt', handler);
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  if (!isOpen) return null;

  const handleInstallClick = async () => {
    if (deferredPrompt) {
      await deferredPrompt.prompt();
      const choice = await deferredPrompt.userChoice;
      if (choice.outcome === 'accepted') {
        setIsInstalled(true);
      }
      setDeferredPrompt(null);
    } else {
      // In browsers where beforeinstallprompt isn't fired (or in an iframe), guide user
      alert('To install: click the Install icon (computer screen with arrow) in your browser address bar, or open your browser menu and choose "Install Industrial EHS System" or "Add to Home Screen".');
    }
  };

  const copyLocalCommands = () => {
    const text = `git clone <repo-url> \n# or extract the downloaded zip file\ncd industrial-ehs-management-system\nnpm install\nnpm run dev`;
    navigator.clipboard.writeText(text);
    setCopiedCmd(true);
    setTimeout(() => setCopiedCmd(false), 3000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-2xl overflow-hidden shadow-2xl flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between bg-slate-950/60">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-600/20 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
              <Download className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white">Get & Download EHS System</h2>
              <p className="text-xs text-slate-400">
                Install as a native desktop/mobile app or download the full source code
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab selection */}
        <div className="flex border-b border-slate-800 bg-slate-950/30 px-6 pt-3 gap-6">
          <button
            onClick={() => setActiveTab('pwa')}
            className={`pb-3 text-xs font-semibold flex items-center gap-2 border-b-2 transition-all ${
              activeTab === 'pwa'
                ? 'border-emerald-500 text-emerald-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Smartphone className="w-4 h-4" />
            <span>Install on Desktop & Mobile (PWA)</span>
          </button>
          <button
            onClick={() => setActiveTab('source')}
            className={`pb-3 text-xs font-semibold flex items-center gap-2 border-b-2 transition-all ${
              activeTab === 'source'
                ? 'border-emerald-500 text-emerald-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Download className="w-4 h-4" />
            <span>Download Source Code (.ZIP)</span>
          </button>
        </div>

        {/* Tab Content */}
        <div className="p-6 overflow-y-auto space-y-5 text-xs text-slate-300">
          {activeTab === 'pwa' ? (
            <div className="space-y-5">
              {/* Feature highlight */}
              <div className="bg-emerald-950/30 border border-emerald-500/20 rounded-xl p-4 flex items-start gap-3">
                <Shield className="w-5 h-5 text-emerald-400 flex-shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <div className="font-semibold text-emerald-300">Native App Experience (Zero App Store Required)</div>
                  <p className="text-slate-400 text-[11px] leading-relaxed">
                    Install this EHS system directly onto your Windows, macOS, Android, or iOS device. Launch from your home screen or dock without browser toolbars, with fast offline asset loading.
                  </p>
                </div>
              </div>

              {/* Install trigger */}
              <div className="flex flex-col sm:flex-row items-center justify-between gap-4 p-4 bg-slate-950/60 rounded-xl border border-slate-800">
                <div className="space-y-0.5">
                  <div className="text-sm font-bold text-white flex items-center gap-2">
                    <Laptop className="w-4 h-4 text-emerald-400" />
                    <span>Quick Install</span>
                  </div>
                  <div className="text-slate-400 text-[11px]">
                    {isInstalled
                      ? 'The app is already installed on this device!'
                      : 'Click below to launch the one-click installation.'}
                  </div>
                </div>

                <button
                  onClick={handleInstallClick}
                  disabled={isInstalled}
                  className={`px-4 py-2.5 rounded-xl font-semibold text-xs flex items-center gap-2 shadow-lg transition-all ${
                    isInstalled
                      ? 'bg-slate-800 text-slate-500 cursor-not-allowed border border-slate-700'
                      : 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-emerald-950'
                  }`}
                >
                  <Download className="w-4 h-4" />
                  <span>{isInstalled ? 'Already Installed' : 'Install App to Device'}</span>
                </button>
              </div>

              {/* Step-by-step for platforms */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-2">
                <div className="p-3.5 bg-slate-950/40 border border-slate-800 rounded-xl space-y-2">
                  <div className="flex items-center gap-2 text-white font-semibold">
                    <Monitor className="w-4 h-4 text-sky-400" />
                    <span>Chrome / Edge</span>
                  </div>
                  <p className="text-[11px] text-slate-400 leading-relaxed">
                    Click the <strong className="text-slate-200">Install icon</strong> in your browser address bar (top right) or press <strong className="text-slate-200">Settings ⋮ &gt; Install App</strong>.
                  </p>
                </div>

                <div className="p-3.5 bg-slate-950/40 border border-slate-800 rounded-xl space-y-2">
                  <div className="flex items-center gap-2 text-white font-semibold">
                    <Apple className="w-4 h-4 text-slate-300" />
                    <span>iPhone & iPad</span>
                  </div>
                  <p className="text-[11px] text-slate-400 leading-relaxed">
                    Open in Safari, tap the <strong className="text-slate-200">Share button (square with arrow)</strong>, then select <strong className="text-slate-200">'Add to Home Screen'</strong>.
                  </p>
                </div>

                <div className="p-3.5 bg-slate-950/40 border border-slate-800 rounded-xl space-y-2">
                  <div className="flex items-center gap-2 text-white font-semibold">
                    <Smartphone className="w-4 h-4 text-emerald-400" />
                    <span>Android</span>
                  </div>
                  <p className="text-[11px] text-slate-400 leading-relaxed">
                    Tap the browser menu <strong className="text-slate-200">⋮ &gt; 'Install app'</strong> or <strong className="text-slate-200">'Add to Home screen'</strong>.
                  </p>
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-5">
              {/* Download ZIP Card */}
              <div className="p-5 bg-slate-950/80 rounded-xl border border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-4">
                <div className="space-y-1">
                  <div className="text-sm font-bold text-white flex items-center gap-2">
                    <Download className="w-4 h-4 text-emerald-400" />
                    <span>Complete Project Source Archive (.ZIP)</span>
                  </div>
                  <p className="text-[11px] text-slate-400">
                    Includes all React components, Express API routers, Cloud SQL database schemas, and configuration.
                  </p>
                </div>
                <a
                  href="/api/download-project"
                  download="industrial-ehs-management-system.zip"
                  className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl font-semibold text-xs flex items-center gap-2 shadow-lg shadow-emerald-950 transition-colors flex-shrink-0"
                >
                  <Download className="w-4 h-4" />
                  <span>Download .ZIP</span>
                </a>
              </div>

              {/* Local run instructions */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-white flex items-center gap-1.5">
                    <Terminal className="w-3.5 h-3.5 text-emerald-400" />
                    How to run locally on your machine
                  </span>
                  <button
                    onClick={copyLocalCommands}
                    className="flex items-center gap-1 text-[11px] text-emerald-400 hover:text-emerald-300 font-medium transition-colors"
                  >
                    {copiedCmd ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>{copiedCmd ? 'Copied!' : 'Copy commands'}</span>
                  </button>
                </div>

                <div className="bg-slate-950 p-3.5 rounded-xl border border-slate-800 font-mono text-[11px] text-emerald-300 space-y-1.5 overflow-x-auto">
                  <div className="text-slate-500"># 1. Unzip the downloaded file</div>
                  <div>unzip industrial-ehs-management-system.zip</div>
                  <div>cd industrial-ehs-management-system</div>
                  <div className="text-slate-500 pt-1"># 2. Install dependencies</div>
                  <div>npm install</div>
                  <div className="text-slate-500 pt-1"># 3. Start development server</div>
                  <div>npm run dev</div>
                </div>
              </div>

              {/* Git & Cloud Notes */}
              <div className="p-3.5 bg-slate-950/40 border border-slate-800 rounded-xl space-y-1.5 text-[11px] text-slate-400">
                <div className="font-semibold text-slate-200">Database & Cloud SQL Connection</div>
                <p>
                  The app is configured to connect to your provisioned Google Cloud SQL PostgreSQL database. When running locally, ensure your database connection parameters (<code className="text-emerald-400">SQL_HOST</code>, <code className="text-emerald-400">SQL_DB_NAME</code>, <code className="text-emerald-400">SQL_ADMIN_USER</code>, <code className="text-emerald-400">SQL_ADMIN_PASSWORD</code>) are in your local <code className="text-emerald-400">.env</code> file.
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t border-slate-800 bg-slate-950/60 flex items-center justify-end">
          <button
            onClick={onClose}
            className="px-4 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg text-xs font-semibold transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
