import React, { useState, useEffect, useMemo } from 'react';
import {
  Palette,
  RotateCcw,
  SlidersHorizontal,
  X,
  Info,
  Check,
  ChevronRight,
  Eye,
  AlertTriangle,
  Flame,
  ShieldAlert,
  ShieldCheck,
  Search,
  Filter,
} from 'lucide-react';
import { HazardReport } from '../../types/index.ts';

export type RiskTier = 'Low' | 'Medium' | 'High' | 'Critical';

export interface MatrixColorConfig {
  low: string;
  medium: string;
  high: string;
  critical: string;
  name: string;
}

export const COLOR_PRESETS: Record<string, MatrixColorConfig> = {
  standard: {
    name: 'Standard HSE (Traffic Light)',
    low: '#10B981',      // Emerald Green
    medium: '#F59E0B',   // Amber Yellow
    high: '#F97316',     // Warning Orange
    critical: '#EF4444', // Crimson Red
  },
  highContrast: {
    name: 'High-Contrast Industrial',
    low: '#059669',      // Deep Emerald
    medium: '#D97706',   // Rich Amber
    high: '#EA580C',     // Dark Orange
    critical: '#DC2626', // Deep Red
  },
  accessible: {
    name: 'Colorblind-Safe (Okabe-Ito)',
    low: '#56B4E9',      // Sky Blue
    medium: '#009E73',   // Bluish Green
    high: '#E69F00',     // Orange
    critical: '#D55E00', // Vermilion
  },
  oceanic: {
    name: 'Modern Nordic & Cobalt',
    low: '#06B6D4',      // Cyan
    medium: '#3B82F6',   // Blue
    high: '#8B5CF6',     // Violet
    critical: '#F43F5E', // Rose
  },
};

export const SEVERITY_LEVELS = [
  { level: 1, label: 'Negligible', desc: 'No injury / minimal asset loss (<$1k)' },
  { level: 2, label: 'Minor', desc: 'First Aid case / low equipment damage (<$10k)' },
  { level: 3, label: 'Moderate', desc: 'Medical Treatment / reversible process delay' },
  { level: 4, label: 'Major', desc: 'Lost Time Injury / significant asset impact' },
  { level: 5, label: 'Catastrophic', desc: 'Fatality, permanent disability, massive release' },
];

export const LIKELIHOOD_LEVELS = [
  { level: 5, label: 'Almost Certain', desc: 'Expected to occur frequently in normal operations' },
  { level: 4, label: 'Likely', desc: 'Has occurred multiple times in the plant' },
  { level: 3, label: 'Possible', desc: 'Could occur at some time / industry history' },
  { level: 2, label: 'Unlikely', desc: 'Not expected, but possible in unusual conditions' },
  { level: 1, label: 'Rare', desc: 'Extremely unlikely / practically impossible' },
];

// Helper to determine text contrast (light or dark text) based on background hex
export function getContrastTextColor(hex: string): string {
  const cleanHex = hex.replace('#', '');
  const r = parseInt(cleanHex.substring(0, 2), 16) || 0;
  const g = parseInt(cleanHex.substring(2, 4), 16) || 0;
  const b = parseInt(cleanHex.substring(4, 6), 16) || 0;
  // Perceptive luminance formula
  const yiq = (r * 299 + g * 587 + b * 114) / 1000;
  return yiq >= 140 ? '#0F172A' : '#FFFFFF';
}

interface RiskMatrixProps {
  hazards: HazardReport[];
  selectedCell: { likelihood: number; severity: number } | null;
  onSelectCell: (cell: { likelihood: number; severity: number } | null) => void;
  selectedRiskLevel: string;
  onSelectRiskLevel: (level: string) => void;
  onHazardClick?: (hazard: HazardReport) => void;
  onQuickReassess?: (hazard: HazardReport, newSev: number, newLik: number) => void;
}

export const RiskMatrix: React.FC<RiskMatrixProps> = ({
  hazards,
  selectedCell,
  onSelectCell,
  selectedRiskLevel,
  onSelectRiskLevel,
  onHazardClick,
  onQuickReassess,
}) => {
  // Color configuration state with localStorage persistence
  const [colors, setColors] = useState<MatrixColorConfig>(() => {
    try {
      const stored = localStorage.getItem('hse_risk_matrix_colors');
      if (stored) {
        return JSON.parse(stored);
      }
    } catch {
      // ignore
    }
    return COLOR_PRESETS.standard;
  });

  const [activePreset, setActivePreset] = useState<string>('standard');
  const [showConfigModal, setShowConfigModal] = useState(false);
  const [hoveredCell, setHoveredCell] = useState<{ likelihood: number; severity: number } | null>(null);
  const [activeQuickReassessHazard, setActiveQuickReassessHazard] = useState<HazardReport | null>(null);
  const [reassessSev, setReassessSev] = useState<number>(3);
  const [reassessLik, setReassessLik] = useState<number>(3);

  // Save color config when modified
  const handleUpdateColors = (newColors: MatrixColorConfig, presetKey?: string) => {
    setColors(newColors);
    if (presetKey) setActivePreset(presetKey);
    else setActivePreset('custom');
    try {
      localStorage.setItem('hse_risk_matrix_colors', JSON.stringify(newColors));
    } catch {
      // ignore
    }
  };

  const handleResetColors = () => {
    handleUpdateColors(COLOR_PRESETS.standard, 'standard');
  };

  // Determine risk level based on score (1 - 25)
  const getRiskTier = (score: number): RiskTier => {
    if (score >= 15) return 'Critical';
    if (score >= 10) return 'High';
    if (score >= 5) return 'Medium';
    return 'Low';
  };

  // Get color for a score
  const getScoreColor = (score: number): string => {
    const tier = getRiskTier(score);
    switch (tier) {
      case 'Critical':
        return colors.critical;
      case 'High':
        return colors.high;
      case 'Medium':
        return colors.medium;
      case 'Low':
      default:
        return colors.low;
    }
  };

  // Map hazards to grid cells
  const cellHazardsMap = useMemo(() => {
    const map = new Map<string, HazardReport[]>();
    for (const h of hazards) {
      // Fallback severity and likelihood if not explicitly set
      let sev = h.severity || 3;
      let lik = h.likelihood || 3;
      if (!h.severity || !h.likelihood) {
        if (h.riskRating === 'Critical') {
          sev = 5;
          lik = 4;
        } else if (h.riskRating === 'High') {
          sev = 4;
          lik = 3;
        } else if (h.riskRating === 'Medium') {
          sev = 3;
          lik = 3;
        } else {
          sev = 2;
          lik = 2;
        }
      }
      const key = `${lik}-${sev}`;
      if (!map.has(key)) {
        map.set(key, []);
      }
      map.get(key)!.push(h);
    }
    return map;
  }, [hazards]);

  // Aggregate counts by Risk Tier
  const tierCounts = useMemo(() => {
    const counts = { Critical: 0, High: 0, Medium: 0, Low: 0, Total: hazards.length };
    for (const h of hazards) {
      const sev = h.severity || (h.riskRating === 'Critical' ? 5 : h.riskRating === 'High' ? 4 : h.riskRating === 'Medium' ? 3 : 2);
      const lik = h.likelihood || (h.riskRating === 'Critical' ? 4 : h.riskRating === 'High' ? 3 : h.riskRating === 'Medium' ? 3 : 2);
      const tier = getRiskTier(sev * lik);
      counts[tier]++;
    }
    return counts;
  }, [hazards]);

  const hoveredHazards = useMemo(() => {
    if (!hoveredCell) return [];
    return cellHazardsMap.get(`${hoveredCell.likelihood}-${hoveredCell.severity}`) || [];
  }, [hoveredCell, cellHazardsMap]);

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-5 shadow-sm">
      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-800/80">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-semibold text-white tracking-tight">Interactive 5×5 Risk Matrix</h3>
            <span className="text-xs text-slate-400 font-mono tabular-nums">
              ({hazards.length} mapped hazards)
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-0.5">
            Click any matrix cell or risk level to filter identified hazards. Color-coding fully customizable.
          </p>
        </div>

        <div className="flex items-center gap-2">
          {/* Active Filter Clearer */}
          {(selectedCell || selectedRiskLevel !== 'All') && (
            <button
              onClick={() => {
                onSelectCell(null);
                onSelectRiskLevel('All');
              }}
              className="flex items-center gap-1.5 px-2.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-xs font-medium transition-colors"
              title="Reset matrix cell filter"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Reset Filter</span>
            </button>
          )}

          {/* Color Coding Settings Button */}
          <button
            onClick={() => setShowConfigModal(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700/60 rounded-lg text-xs font-medium transition-colors"
          >
            <Palette className="w-3.5 h-3.5 text-amber-400" />
            <span>Color-Code Matrix</span>
          </button>
        </div>
      </div>

      {/* Risk Tiers Legend & Summary Counters */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
        {(['Critical', 'High', 'Medium', 'Low'] as RiskTier[]).map((tier) => {
          const count = tierCounts[tier];
          const isSelected = selectedRiskLevel === tier && !selectedCell;
          let tierColor = colors.low;
          if (tier === 'Critical') tierColor = colors.critical;
          if (tier === 'High') tierColor = colors.high;
          if (tier === 'Medium') tierColor = colors.medium;

          return (
            <button
              key={tier}
              onClick={() => {
                onSelectCell(null);
                onSelectRiskLevel(selectedRiskLevel === tier ? 'All' : tier);
              }}
              className={`p-3 rounded-lg text-left transition-all border flex items-center justify-between ${
                isSelected
                  ? 'bg-slate-800/90 border-white/40 ring-1 ring-white/30'
                  : 'bg-slate-950/60 border-slate-800/80 hover:bg-slate-800/40'
              }`}
            >
              <div className="flex items-center gap-2.5">
                <span
                  className="w-3 h-3 rounded-full shrink-0 shadow-sm"
                  style={{ backgroundColor: tierColor }}
                />
                <div>
                  <div className="text-xs font-semibold text-white">{tier} Risk</div>
                  <div className="text-[11px] text-slate-400 font-mono">
                    {tier === 'Critical'
                      ? 'Score 15–25'
                      : tier === 'High'
                      ? 'Score 10–14'
                      : tier === 'Medium'
                      ? 'Score 5–9'
                      : 'Score 1–4'}
                  </div>
                </div>
              </div>
              <div className="text-right">
                <span className="text-sm font-bold text-white font-mono tabular-nums">
                  {count}
                </span>
                <span className="block text-[10px] text-slate-500">hazards</span>
              </div>
            </button>
          );
        })}
      </div>

      {/* Main Interactive Matrix Grid Layout */}
      <div className="relative overflow-x-auto pb-2">
        <div className="min-w-[620px] max-w-4xl mx-auto">
          {/* Matrix Frame */}
          <div className="flex">
            {/* Y-Axis Label: Likelihood */}
            <div className="w-10 flex items-center justify-center pr-2">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 -rotate-90 whitespace-nowrap">
                Likelihood (Probability)
              </span>
            </div>

            {/* Matrix Body */}
            <div className="flex-1 space-y-1.5">
              {/* Rows (Likelihood 5 down to 1) */}
              {LIKELIHOOD_LEVELS.map(({ level: likLevel, label: likLabel }) => (
                <div key={likLevel} className="flex items-center gap-1.5">
                  {/* Row Header */}
                  <div className="w-28 text-right pr-2">
                    <div className="text-xs font-medium text-slate-300 leading-none">
                      {likLabel}
                    </div>
                    <div className="text-[10px] text-slate-500 font-mono">
                      Level {likLevel}
                    </div>
                  </div>

                  {/* 5 Severity Columns in this row */}
                  <div className="flex-1 grid grid-cols-5 gap-1.5">
                    {SEVERITY_LEVELS.map(({ level: sevLevel, label: sevLabel }) => {
                      const score = likLevel * sevLevel;
                      const tier = getRiskTier(score);
                      const hex = getScoreColor(score);
                      const textColor = getContrastTextColor(hex);
                      const cellHazards = cellHazardsMap.get(`${likLevel}-${sevLevel}`) || [];
                      const count = cellHazards.length;
                      const isCellSelected =
                        selectedCell?.likelihood === likLevel &&
                        selectedCell?.severity === sevLevel;
                      const isDimmed =
                        (selectedCell && !isCellSelected) ||
                        (selectedRiskLevel !== 'All' && selectedRiskLevel !== tier);

                      return (
                        <button
                          key={sevLevel}
                          onClick={() => {
                            if (isCellSelected) {
                              onSelectCell(null);
                            } else {
                              onSelectCell({ likelihood: likLevel, severity: sevLevel });
                              onSelectRiskLevel('All');
                            }
                          }}
                          onMouseEnter={() =>
                            setHoveredCell({ likelihood: likLevel, severity: sevLevel })
                          }
                          onMouseLeave={() => setHoveredCell(null)}
                          style={{
                            backgroundColor: hex,
                            color: textColor,
                            opacity: isDimmed ? 0.35 : 1,
                          }}
                          className={`group relative h-16 rounded-lg p-2 transition-all flex flex-col justify-between text-left select-none shadow-sm ${
                            isCellSelected
                              ? 'ring-2 ring-white ring-offset-2 ring-offset-slate-900 scale-[1.02] z-10'
                              : 'hover:scale-[1.02] hover:shadow-md'
                          }`}
                        >
                          {/* Score & Tier indicator */}
                          <div className="flex items-center justify-between w-full">
                            <span className="text-[11px] font-bold font-mono tracking-wider opacity-90">
                              {score}
                            </span>
                            <span className="text-[9px] font-semibold uppercase tracking-wider opacity-80">
                              {tier}
                            </span>
                          </div>

                          {/* Hazard Count Badge */}
                          <div className="flex items-center justify-between w-full mt-auto">
                            {count > 0 ? (
                              <div
                                style={{
                                  backgroundColor: textColor === '#FFFFFF' ? 'rgba(0,0,0,0.3)' : 'rgba(255,255,255,0.4)',
                                  color: textColor,
                                }}
                                className="px-2 py-0.5 rounded text-[11px] font-bold font-mono tabular-nums flex items-center gap-1 shadow-inner"
                              >
                                <span>{count}</span>
                                <span className="text-[9px] font-normal">
                                  {count === 1 ? 'hazard' : 'hazards'}
                                </span>
                              </div>
                            ) : (
                              <span className="text-[10px] opacity-40 font-mono">0</span>
                            )}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}

              {/* Column Headers (Severity 1 to 5) */}
              <div className="flex items-center gap-1.5 pt-1">
                <div className="w-28" />
                <div className="flex-1 grid grid-cols-5 gap-1.5 text-center">
                  {SEVERITY_LEVELS.map(({ level: sevLevel, label: sevLabel }) => (
                    <div key={sevLevel} className="px-1 py-1">
                      <div className="text-[10px] text-slate-500 font-mono">Level {sevLevel}</div>
                      <div className="text-xs font-medium text-slate-300 truncate" title={sevLabel}>
                        {sevLabel}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* X-Axis Label: Severity */}
              <div className="flex items-center gap-1.5">
                <div className="w-28" />
                <div className="flex-1 text-center pt-1">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                    Severity (Consequence)
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Cell Hover Tooltip & Summary Preview */}
      {hoveredCell && hoveredHazards.length > 0 && (
        <div className="bg-slate-950 border border-slate-800 rounded-lg p-3 text-xs text-slate-300 animate-fadeIn">
          <div className="flex items-center justify-between border-b border-slate-800/80 pb-2 mb-2">
            <div className="font-semibold text-white flex items-center gap-2">
              <span className="font-mono text-amber-400">
                Cell [{hoveredCell.likelihood} × {hoveredCell.severity}]
              </span>
              <span>·</span>
              <span>
                Likelihood: {LIKELIHOOD_LEVELS.find((l) => l.level === hoveredCell.likelihood)?.label}
              </span>
              <span>·</span>
              <span>
                Severity: {SEVERITY_LEVELS.find((s) => s.level === hoveredCell.severity)?.label}
              </span>
            </div>
            <span className="text-slate-400 font-mono">
              {hoveredHazards.length} {hoveredHazards.length === 1 ? 'hazard' : 'hazards'}
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-2 max-h-36 overflow-y-auto">
            {hoveredHazards.map((h) => (
              <div
                key={h.id}
                onClick={() => onHazardClick?.(h)}
                className="p-2 bg-slate-900 hover:bg-slate-850 border border-slate-800 rounded flex items-start justify-between gap-2 cursor-pointer transition-colors"
              >
                <div className="truncate">
                  <div className="flex items-center gap-1.5">
                    <span className="font-mono font-bold text-amber-400">{h.hazardId}</span>
                    <span className="text-[10px] text-slate-400">({h.department?.name || 'Operations'})</span>
                  </div>
                  <div className="text-white font-medium truncate mt-0.5">{h.title}</div>
                </div>
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-800 text-slate-300 shrink-0 font-medium">
                  {h.status}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Active Filter Banner when a cell is clicked */}
      {selectedCell && (
        <div className="flex items-center justify-between p-3 bg-slate-950/90 border border-amber-500/30 rounded-lg text-xs">
          <div className="flex items-center gap-2 text-slate-200">
            <Filter className="w-4 h-4 text-amber-400" />
            <span>
              Filtering hazards by cell:{' '}
              <strong className="text-white">
                Likelihood {selectedCell.likelihood} ({LIKELIHOOD_LEVELS.find((l) => l.level === selectedCell.likelihood)?.label})
              </strong>{' '}
              ×{' '}
              <strong className="text-white">
                Severity {selectedCell.severity} ({SEVERITY_LEVELS.find((s) => s.level === selectedCell.severity)?.label})
              </strong>
            </span>
            <span className="text-slate-400 font-mono">
              ({cellHazardsMap.get(`${selectedCell.likelihood}-${selectedCell.severity}`)?.length || 0} records)
            </span>
          </div>

          <button
            onClick={() => onSelectCell(null)}
            className="flex items-center gap-1 text-slate-400 hover:text-white transition-colors"
          >
            <X className="w-4 h-4" />
            <span>Clear filter</span>
          </button>
        </div>
      )}

      {/* COLOR-CODING CONFIGURATION MODAL */}
      {showConfigModal && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-lg p-6 space-y-5 shadow-2xl">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <Palette className="w-5 h-5 text-amber-400" />
                <h3 className="text-sm font-bold text-white uppercase tracking-wider">
                  Color-Code Risk Matrix Levels
                </h3>
              </div>
              <button
                onClick={() => setShowConfigModal(false)}
                className="text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-xs text-slate-300">
              Customize the color palette representing each risk level across the HSE Risk Matrix. Select a standard theme or choose specific hex colors.
            </p>

            {/* Presets List */}
            <div className="space-y-2">
              <label className="text-xs font-semibold text-slate-300">Curated Palettes</label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {Object.entries(COLOR_PRESETS).map(([key, preset]) => {
                  const isActive =
                    activePreset === key ||
                    (colors.low === preset.low &&
                      colors.medium === preset.medium &&
                      colors.high === preset.high &&
                      colors.critical === preset.critical);

                  return (
                    <button
                      key={key}
                      onClick={() => handleUpdateColors(preset, key)}
                      className={`p-2.5 rounded-lg border text-left flex items-center justify-between transition-colors ${
                        isActive
                          ? 'bg-slate-800 border-amber-500/50 ring-1 ring-amber-500/30'
                          : 'bg-slate-950/70 border-slate-800 hover:bg-slate-800/40'
                      }`}
                    >
                      <div>
                        <div className="text-xs font-medium text-white">{preset.name}</div>
                        <div className="flex items-center gap-1.5 mt-2">
                          <span
                            className="w-3.5 h-3.5 rounded-full"
                            style={{ backgroundColor: preset.low }}
                            title="Low"
                          />
                          <span
                            className="w-3.5 h-3.5 rounded-full"
                            style={{ backgroundColor: preset.medium }}
                            title="Medium"
                          />
                          <span
                            className="w-3.5 h-3.5 rounded-full"
                            style={{ backgroundColor: preset.high }}
                            title="High"
                          />
                          <span
                            className="w-3.5 h-3.5 rounded-full"
                            style={{ backgroundColor: preset.critical }}
                            title="Critical"
                          />
                        </div>
                      </div>
                      {isActive && <Check className="w-4 h-4 text-amber-400" />}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Individual Color Pickers */}
            <div className="space-y-3 pt-2 border-t border-slate-800">
              <label className="text-xs font-semibold text-slate-300">Custom Level Colors</label>
              <div className="grid grid-cols-2 gap-3">
                {/* Low Risk */}
                <div className="p-2.5 bg-slate-950 rounded-lg border border-slate-800 flex items-center justify-between">
                  <div>
                    <div className="text-xs font-medium text-white">Low Risk</div>
                    <div className="text-[10px] text-slate-400 font-mono">{colors.low}</div>
                  </div>
                  <input
                    type="color"
                    value={colors.low}
                    onChange={(e) =>
                      handleUpdateColors({ ...colors, low: e.target.value })
                    }
                    className="w-8 h-8 rounded border-0 cursor-pointer bg-transparent"
                  />
                </div>

                {/* Medium Risk */}
                <div className="p-2.5 bg-slate-950 rounded-lg border border-slate-800 flex items-center justify-between">
                  <div>
                    <div className="text-xs font-medium text-white">Medium Risk</div>
                    <div className="text-[10px] text-slate-400 font-mono">{colors.medium}</div>
                  </div>
                  <input
                    type="color"
                    value={colors.medium}
                    onChange={(e) =>
                      handleUpdateColors({ ...colors, medium: e.target.value })
                    }
                    className="w-8 h-8 rounded border-0 cursor-pointer bg-transparent"
                  />
                </div>

                {/* High Risk */}
                <div className="p-2.5 bg-slate-950 rounded-lg border border-slate-800 flex items-center justify-between">
                  <div>
                    <div className="text-xs font-medium text-white">High Risk</div>
                    <div className="text-[10px] text-slate-400 font-mono">{colors.high}</div>
                  </div>
                  <input
                    type="color"
                    value={colors.high}
                    onChange={(e) =>
                      handleUpdateColors({ ...colors, high: e.target.value })
                    }
                    className="w-8 h-8 rounded border-0 cursor-pointer bg-transparent"
                  />
                </div>

                {/* Critical Risk */}
                <div className="p-2.5 bg-slate-950 rounded-lg border border-slate-800 flex items-center justify-between">
                  <div>
                    <div className="text-xs font-medium text-white">Critical Risk</div>
                    <div className="text-[10px] text-slate-400 font-mono">{colors.critical}</div>
                  </div>
                  <input
                    type="color"
                    value={colors.critical}
                    onChange={(e) =>
                      handleUpdateColors({ ...colors, critical: e.target.value })
                    }
                    className="w-8 h-8 rounded border-0 cursor-pointer bg-transparent"
                  />
                </div>
              </div>
            </div>

            {/* Quick Swatch Bar */}
            <div className="p-3 bg-slate-950/80 rounded-lg border border-slate-800/80 flex items-center justify-between">
              <span className="text-xs text-slate-400">Live Palette Preview:</span>
              <div className="flex items-center gap-1.5">
                <span
                  className="px-2 py-0.5 rounded text-[10px] font-bold"
                  style={{
                    backgroundColor: colors.low,
                    color: getContrastTextColor(colors.low),
                  }}
                >
                  Low
                </span>
                <span
                  className="px-2 py-0.5 rounded text-[10px] font-bold"
                  style={{
                    backgroundColor: colors.medium,
                    color: getContrastTextColor(colors.medium),
                  }}
                >
                  Medium
                </span>
                <span
                  className="px-2 py-0.5 rounded text-[10px] font-bold"
                  style={{
                    backgroundColor: colors.high,
                    color: getContrastTextColor(colors.high),
                  }}
                >
                  High
                </span>
                <span
                  className="px-2 py-0.5 rounded text-[10px] font-bold"
                  style={{
                    backgroundColor: colors.critical,
                    color: getContrastTextColor(colors.critical),
                  }}
                >
                  Critical
                </span>
              </div>
            </div>

            {/* Modal Actions */}
            <div className="flex items-center justify-between pt-3 border-t border-slate-800">
              <button
                type="button"
                onClick={handleResetColors}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-slate-400 hover:text-white transition-colors"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Reset to Standard</span>
              </button>
              <button
                type="button"
                onClick={() => setShowConfigModal(false)}
                className="px-4 py-1.5 bg-amber-600 hover:bg-amber-500 text-white rounded text-xs font-semibold shadow-sm transition-colors"
              >
                Apply & Save
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
