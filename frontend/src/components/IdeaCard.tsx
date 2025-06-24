import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Zap, Target, TrendingUp, Users, ArrowRight, History, RefreshCw, Edit3, Star, Lightbulb, Briefcase, Info, Globe, AlertTriangle, ExternalLink, BarChart3, CheckCircle, XCircle } from 'lucide-react';
import React from 'react';
import type { Idea, IdeaStatus, DeepDiveVersion, Repo, DeepDive } from '@/lib/api';
import { Link } from 'react-router-dom';
import { Accordion, AccordionItem, AccordionTrigger, AccordionContent } from "@/components/ui/accordion";
import ReactMarkdown from 'react-markdown';
import { LensInsightsPreview } from './LensInsightsPreview';
import { getEffortColor } from '../lib/utils';

const statusOptions: { value: IdeaStatus; label: string }[] = [
  { value: 'suggested', label: 'Suggested' },
  { value: 'deep_dive', label: 'Deep Dive' },
  { value: 'iterating', label: 'Iterating' },
  { value: 'considering', label: 'Considering' },
  { value: 'closed', label: 'Closed' },
];

interface IdeaCardProps extends React.HTMLAttributes<HTMLDivElement> {
  idea: Idea & { deep_dive_versions?: DeepDiveVersion[] };
  onDeepDive?: (idea: Idea) => void;
  onStatusChange?: (id: string, newStatus: IdeaStatus) => void;
  onEdit?: (idea: Idea) => void;
  onShortlist?: (id: string) => void;
  onRestoreDeepDiveVersion?: (ideaId: string, versionNumber: number) => void;
  repos?: Repo[];
  showRepoSummary?: boolean;
  showStatusDropdown?: boolean;
  showStatusBadge?: boolean;
  forceNewBadge?: boolean;
  hideDetailsAccordion?: boolean;
  deepDiveInProgress?: boolean;
  onOpenModal?: (idea: Idea) => void;
}

// Helper functions for parsing deep dive sections
function parseSignalScoreSection(sections) {
  const section = sections.find(s => /signal score/i.test(s.title));
  if (!section) return null;
  try {
    const match = section.content.match(/\{[\s\S]*\}/);
    if (match) {
      const obj = JSON.parse(match[0]);
      if (typeof obj === 'object') return obj;
    }
  } catch {
    // Ignore JSON parsing errors and continue with fallback parsing
  }
  // Try to parse as key: value lines
  const lines = section.content.split('\n');
  const scores = {};
  let found = false;
  for (const line of lines) {
    const m = line.match(/([\w\s]+):\s*(\d+)/);
    if (m) {
      scores[m[1].trim()] = parseInt(m[2], 10);
      found = true;
    }
  }
  return found ? scores : null;
}
function extractGoNoGo(sections) {
  for (const s of sections) {
    if (/go\s*\/\s*no-go/i.test(s.title) || /go\s*\/\s*no-go/i.test(s.content)) {
      const match = s.content.match(/go\s*\/\s*no-go\s*[:-]?\s*(go|no-go)/i);
      if (match) return match[1].toUpperCase();
    }
    if (/go\s*\/\s*no-go/i.test(s.content)) {
      if (/no-go/i.test(s.content)) return 'NO-GO';
      if (/go/i.test(s.content)) return 'GO';
    }
  }
  return null;
}
function extractSummary(sections) {
  for (const s of sections) {
    if (/summary/i.test(s.title)) return s.content;
    if (/executive summary/i.test(s.content)) return s.content;
  }
  return null;
}
function extractMarketLayers(sections, market_snapshot) {
  // Try to find a section with TAM/SAM/SOM, else use market_snapshot
  let tam = null, sam = null, som = null, tamExp = '', samExp = '', somExp = '';
  if (market_snapshot) {
    const ms = market_snapshot;
    tam = ms.total_market?.value || ms.market_size || null;
    tamExp = ms.total_market?.explanation || '';
    sam = ms.addressable_market?.value || null;
    samExp = ms.addressable_market?.explanation || '';
    som = ms.obtainable_market?.value || null;
    somExp = ms.obtainable_market?.explanation || '';
  }
  // fallback: try to parse from a section
  // ...could add more logic here if needed...
  return { tam, sam, som, tamExp, samExp, somExp };
}
function parseNum(val) {
  if (!val) return 0;
  const n = parseFloat(val.replace(/[^\d.]/g, ''));
  if (/B/i.test(val)) return n * 1e9;
  if (/M/i.test(val)) return n * 1e6;
  return n;
}

export function IdeaCard({
  idea,
  onDeepDive,
  onStatusChange,
  onEdit,
  onShortlist,
  onRestoreDeepDiveVersion,
  repos = [],
  showRepoSummary = true,
  showStatusDropdown = true,
  showStatusBadge = true,
  forceNewBadge = false,
  hideDetailsAccordion = false,
  deepDiveInProgress = false,
  onOpenModal,
  ...props
}: IdeaCardProps) {
  const [expanded, setExpanded] = React.useState(false);

  if (!idea) {
    return null;
  }

  const formatDeepDiveMarkdown = (markdown) => {
    if (!markdown) return '';
    // Replace standalone bolded lines with H3 markdown headings
    return markdown.replace(/^\*\*(.*)\*\*$/gm, '### $1');
  };

  const deepDiveContent = idea.deep_dive?.raw || idea.deep_dive_raw_response;

  // Helper for status badge
  const statusBadge = (status: IdeaStatus) => {
    const color = {
      suggested: 'bg-blue-100 text-blue-800',
      deep_dive: 'bg-purple-100 text-purple-800',
      iterating: 'bg-yellow-100 text-yellow-800',
      considering: 'bg-green-100 text-green-800',
      closed: 'bg-gray-200 text-gray-600',
    }[status];
    return <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${color}`}>{statusOptions.find(s => s.value === status)?.label}</span>;
  };

  // Icon for source
  const getSourceIcon = () => {
    if (idea.repo_id) return <TrendingUp className="w-4 h-4 text-blue-500" />;
    return <Zap className="w-4 h-4 text-orange-500" />;
  };

  const score = idea.score ?? 5;
  const mvpEffort = idea.mvp_effort ?? 5;

  // Lookup repo
  const repo = repos.find(r => r.id === idea.repo_id);

  // Format date
  const createdAt = idea.created_at ? new Date(idea.created_at).toLocaleDateString() : '';

  const shouldShowScores = (idea.deep_dive || idea.deep_dive_raw_response) && ['iterating', 'considering', 'closed'].includes(idea.status);

  const type = idea.type || '';
  const typeLabel = type === 'side_hustle' ? 'Side Hustle' : type === 'full_scale' ? 'Full Scale' : '';
  const typeIcon = type === 'side_hustle' ? <Lightbulb className="w-4 h-4 text-orange-500 inline-block mr-1" /> : type === 'full_scale' ? <Briefcase className="w-4 h-4 text-blue-600 inline-block mr-1" /> : null;
  const typeColor = type === 'side_hustle' ? 'bg-orange-100 text-orange-800' : type === 'full_scale' ? 'bg-blue-100 text-blue-800' : 'bg-gray-100 text-gray-600';

  const deepDiveSections = idea.deep_dive?.sections || [];
  const signalScores = parseSignalScoreSection(deepDiveSections);
  const goNoGo = extractGoNoGo(deepDiveSections);
  const summary = extractSummary(deepDiveSections);
  const market_snapshot = idea.business_intelligence?.market_snapshot;
  const { tam, sam, som, tamExp, samExp, somExp } = extractMarketLayers(deepDiveSections, market_snapshot);
  const tamNum = parseNum(tam);
  const samNum = parseNum(sam);
  const somNum = parseNum(som);
  const marketData = [
    { name: 'TAM', value: tamNum, label: tam, color: '#3b82f6', explanation: tamExp },
    { name: 'SAM', value: samNum, label: sam, color: '#10b981', explanation: samExp },
    { name: 'SOM', value: somNum, label: som, color: '#a21caf', explanation: somExp },
  ].filter(d => d.value > 0);

  // Check if deep dive is in progress
  const isDeepDiveLoading = idea.deepDiveStatus === 'loading' || deepDiveInProgress;

  return (
    <div className="bg-white rounded-lg border border-gray-200 shadow-sm hover:shadow-md transition-shadow duration-200 p-4 mb-3 relative" {...props}>
      {isDeepDiveLoading && (
        <div className="absolute top-3 right-3 flex items-center gap-2 z-10">
          <div className="animate-spin rounded-full h-4 w-4 border-2 border-blue-500 border-t-transparent"></div>
          <span className="text-xs text-blue-600 font-medium">Analyzing...</span>
        </div>
      )}
      
      {/* Header */}
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-2">
          {forceNewBadge ? (
            <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-semibold bg-green-100 text-green-700">
              <svg className="w-3 h-3 mr-1" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <path d="M12 2v2m0 16v2m10-10h-2M4 12H2m15.07-7.07l-1.41 1.41M6.34 17.66l-1.41 1.41m12.02 0l1.41-1.41M6.34 6.34L4.93 4.93" />
              </svg>
              New
            </span>
          ) : showStatusBadge && idea.status !== 'suggested' && (
            <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-600">
              {statusOptions.find(s => s.value === idea.status)?.label}
            </span>
          )}
        </div>
        
        {showStatusDropdown && (
          <div className="relative">
            <button className="flex items-center gap-1 px-2 py-1 rounded border border-gray-200 bg-white text-xs font-medium text-gray-700 hover:bg-gray-50">
              <svg width="12" height="12" fill="none" viewBox="0 0 24 24">
                <path d="M12 17a1 1 0 1 0 0-2 1 1 0 0 0 0 2zm0-5a1 1 0 1 0 0-2 1 1 0 0 0 0 2zm0-5a1 1 0 1 0 0-2 1 1 0 0 0 0 2z" fill="#6b7280"/>
              </svg>
              <span>{statusOptions.find(s => s.value === idea.status)?.label || 'Suggested'}</span>
            </button>
          </div>
        )}
      </div>
      
      {/* Title with modal and full page link */}
      <div className="mb-3 flex items-center gap-2">
        {onOpenModal ? (
          <button
            className="text-gray-900 hover:text-blue-600 font-semibold text-base bg-transparent border-none p-0 m-0 cursor-pointer text-left"
            style={{ appearance: 'none' }}
            onClick={e => {
              e.stopPropagation();
              if (isDeepDiveLoading) {
                // Don't open modal if deep dive is still loading
                return;
              }
              onOpenModal(idea);
            }}
          >
            {idea.title}
          </button>
        ) : (
          <span className="text-gray-900 font-semibold text-base">{idea.title}</span>
        )}
        <Link to={`/ideas/${idea.id}`} className="ml-1 text-blue-500 hover:text-blue-700" title="Open full page">
          <ExternalLink className="w-4 h-4" />
        </Link>
      </div>
      
      {/* Repo Summary */}
      {showRepoSummary && repo && repo.summary && repo.url && (
        <div className="mb-3 text-gray-600 text-sm">
          <a href={repo.url} target="_blank" rel="noopener noreferrer" className="underline hover:text-blue-600">{repo.summary}</a>
        </div>
      )}
      
      {/* Metrics */}
      <div className="flex gap-4 mb-3">
        <div className="flex flex-col items-center">
          <span className="text-xs text-gray-500 mb-1">Score</span>
          <span className="w-8 h-8 flex items-center justify-center rounded-lg text-sm font-bold bg-green-500 text-white">{score}</span>
        </div>
        <div className="flex flex-col items-center">
          <span className="text-xs text-gray-500 mb-1">Effort</span>
          <span className={`w-8 h-8 flex items-center justify-center rounded-lg text-sm font-bold ${getEffortColor(mvpEffort)}`}>{mvpEffort}</span>
        </div>
        {type && (
          <div className="flex flex-col items-center">
            <span className="text-xs text-gray-500 mb-1">Type</span>
            <span className={`px-3 py-1 rounded-full text-xs font-medium ${typeColor}`}>
              {typeIcon}{typeLabel}
              {type === 'side_hustle' && score < 8 && mvpEffort <= 3 && (
                <span className="ml-1" title="Low score, but very low effort makes this a quick win.">
                  <Info className="w-3 h-3 text-orange-400 inline-block" />
                </span>
              )}
            </span>
          </div>
        )}
      </div>
      
      {/* Executive Summary and Go/No-Go */}
      {(summary || goNoGo) && (
        <div className="mb-2 flex items-center gap-2">
          {goNoGo && (
            <Badge variant={goNoGo === 'GO' ? 'default' : 'destructive'} className="text-xs px-2 py-1">
              {goNoGo === 'GO' ? <CheckCircle className="w-4 h-4 mr-1 text-green-600" /> : <XCircle className="w-4 h-4 mr-1 text-red-600" />}
              {goNoGo}
            </Badge>
          )}
          {summary && <span className="text-xs text-gray-700 line-clamp-2">{summary.substring(0, 120)}...</span>}
        </div>
      )}
      {/* Market Layers Visualization */}
      {marketData.length > 0 && (
        <div className="mb-2">
          <div className="flex items-center gap-2 mb-1">
            <BarChart3 className="w-4 h-4 text-blue-500" />
            <span className="text-xs font-semibold text-blue-700">Market Size Layers</span>
          </div>
          <div className="flex gap-1 items-center">
            {marketData.map(d => (
              <div key={d.name} className="flex items-center gap-1">
                <span className="inline-block w-2 h-2 rounded-full" style={{ background: d.color }}></span>
                <span className="text-xs font-bold" title={d.explanation}>{d.name}: {d.label}</span>
              </div>
            ))}
          </div>
        </div>
      )}
      {/* Investor Scoring (prominent) */}
      {signalScores && (
        <div className="mb-2">
          <div className="text-xs text-slate-500 mb-1 font-medium">Investor Scoring</div>
          <div className="flex flex-wrap gap-2">
            {Object.entries(signalScores).map(([k, v]) => {
              if (typeof v !== 'number') return null;
              return (
                <div key={k} className="flex flex-col items-center">
                  <span className="font-semibold text-gray-700 text-xs">{k}</span>
                  <span className={`text-xs font-bold ${Number(v) >= 8 ? 'text-green-600' : Number(v) >= 6 ? 'text-yellow-600' : 'text-red-600'}`}>{Number(v)}/10</span>
                </div>
              );
            })}
          </div>
        </div>
      )}
      <div className="border-t border-slate-100 pt-2 mt-2">
        <Accordion type="multiple" className="w-full">
          {idea.hook && (
            <AccordionItem value="hook">
              <AccordionTrigger>Hook</AccordionTrigger>
              <AccordionContent>
                <div className="text-slate-700 text-sm">{idea.hook}</div>
              </AccordionContent>
            </AccordionItem>
          )}
          {idea.value && (
            <AccordionItem value="value">
              <AccordionTrigger>Value</AccordionTrigger>
              <AccordionContent>
                <div className="text-slate-700 text-sm">{idea.value}</div>
              </AccordionContent>
            </AccordionItem>
          )}
          {idea.evidence && (
            <AccordionItem value="evidence">
              <AccordionTrigger>Evidence</AccordionTrigger>
              <AccordionContent>
                <div className="text-slate-700 text-sm">{idea.evidence}</div>
              </AccordionContent>
            </AccordionItem>
          )}
          {idea.differentiator && (
            <AccordionItem value="differentiator">
              <AccordionTrigger>Differentiator</AccordionTrigger>
              <AccordionContent>
                <div className="text-slate-700 text-sm">{idea.differentiator}</div>
              </AccordionContent>
            </AccordionItem>
          )}
          {idea.call_to_action && (
            <AccordionItem value="call_to_action">
              <AccordionTrigger>Call to Action</AccordionTrigger>
              <AccordionContent>
                <div className="text-slate-700 text-sm">{idea.call_to_action}</div>
              </AccordionContent>
            </AccordionItem>
          )}
        </Accordion>
      </div>
      {/* Deep Dive Section */}
      {(idea.deep_dive?.raw || idea.deep_dive_raw_response) && (
        <div className="border-t border-slate-100 pt-2 mt-2">
          <Accordion type="single" collapsible defaultValue="">
            <AccordionItem value="deepdive">
              <button
                className="w-full text-left text-purple-700 text-sm font-bold flex items-center gap-2 py-1 hover:underline"
                onClick={e => e.stopPropagation()}
                type="button"
              >
                <span className="mr-1"><Star className="w-4 h-4 text-purple-500" /></span> Deep Dive Analysis
              </button>
              <AccordionContent>
                <div className="space-y-4 mt-2 text-slate-700 text-sm">
                  {/* Key Metrics Summary */}
                  {idea.deep_dive?.sections && (
                    <div className="grid grid-cols-2 gap-2 mb-3">
                      {idea.deep_dive.sections.slice(0, 4).map((section, index) => (
                        <div key={index} className="bg-gradient-to-r from-purple-50 to-blue-50 rounded-lg p-2 border border-purple-100">
                          <div className="text-xs font-semibold text-purple-800 mb-1 truncate">
                            {section.title}
                          </div>
                          <div className="text-xs text-slate-600 line-clamp-2">
                            {section.content.substring(0, 80)}...
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                  
                  {/* Market Indicators */}
                  {idea.deep_dive?.sections && (
                    <div className="bg-gradient-to-r from-green-50 to-emerald-50 rounded-lg p-3 border border-green-100">
                      <div className="text-xs font-semibold text-green-800 mb-2 flex items-center gap-1">
                        <Globe className="w-3 h-3" />
                        Market Insights
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        {idea.deep_dive.sections
                          .filter(section => 
                            section.title.toLowerCase().includes('market') || 
                            section.title.toLowerCase().includes('opportunity') ||
                            section.title.toLowerCase().includes('growth')
                          )
                          .slice(0, 2)
                          .map((section, index) => (
                            <div key={index} className="text-xs text-slate-700">
                              <div className="font-medium text-green-700">{section.title}</div>
                              <div className="text-slate-600 line-clamp-2">
                                {section.content.substring(0, 60)}...
                              </div>
                            </div>
                          ))}
                      </div>
                    </div>
                  )}
                  
                  {/* Risk & Opportunity Summary */}
                  {idea.deep_dive?.sections && (
                    <div className="grid grid-cols-2 gap-2">
                      {idea.deep_dive.sections
                        .filter(section => section.title.toLowerCase().includes('risk'))
                        .slice(0, 1)
                        .map((section, index) => (
                          <div key={index} className="bg-gradient-to-r from-red-50 to-orange-50 rounded-lg p-2 border border-red-100">
                            <div className="text-xs font-semibold text-red-800 mb-1 flex items-center gap-1">
                              <AlertTriangle className="w-3 h-3" />
                              Key Risks
                            </div>
                            <div className="text-xs text-slate-600 line-clamp-2">
                              {section.content.substring(0, 80)}...
                            </div>
                          </div>
                        ))}
                      {idea.deep_dive.sections
                        .filter(section => section.title.toLowerCase().includes('opportunity'))
                        .slice(0, 1)
                        .map((section, index) => (
                          <div key={index} className="bg-gradient-to-r from-blue-50 to-cyan-50 rounded-lg p-2 border border-blue-100">
                            <div className="text-xs font-semibold text-blue-800 mb-1 flex items-center gap-1">
                              <TrendingUp className="w-3 h-3" />
                              Opportunities
                            </div>
                            <div className="text-xs text-slate-600 line-clamp-2">
                              {section.content.substring(0, 80)}...
                            </div>
                          </div>
                        ))}
                    </div>
                  )}
                  
                  {/* Full Content Toggle */}
                  <div className="border-t border-slate-200 pt-2">
                    <button
                      className="text-xs text-purple-600 hover:text-purple-800 font-medium"
                      onClick={e => {
                        e.stopPropagation();
                        // Toggle full content view
                      }}
                    >
                      View Full Analysis →
                    </button>
                  </div>
                </div>
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        </div>
      )}

      {/* Lens Insights Preview */}
      {(idea.deep_dive || idea.deep_dive_raw_response) && (
        <LensInsightsPreview 
          ideaId={idea.id} 
          ideaTitle={idea.title}
          onOpenLensSwitcher={() => {
            // This would open the lens switcher modal
            console.log('Open lens switcher for idea:', idea.id);
          }}
        />
      )}
    </div>
  );
}