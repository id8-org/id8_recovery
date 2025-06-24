import React, { useState } from 'react';
import { Idea, Repo, DeepDiveVersion } from '@/lib/api';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Accordion, AccordionItem, AccordionTrigger, AccordionContent } from '@/components/ui/accordion';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Star, TrendingUp, Zap, History, Lightbulb, Briefcase, Info, Rocket, Clock, Target, BarChart, ExternalLink, Edit3, BookOpen, Globe, Target as TargetIcon, Eye, Download } from 'lucide-react';
import { Progress } from '@/components/ui/progress';
import { Link } from 'react-router-dom';
import { CaseStudyLookup } from './CaseStudyLookup';
import { MarketSnapshotGenerator } from './MarketSnapshotGenerator';
import { VCThesisComparison } from './VCThesisComparison';
import { LensSwitcher } from './LensSwitcher';
import { InvestorDeckExporter } from './InvestorDeckExporter';
import { CollaboratorManager } from './CollaboratorManager';
import { ChangeProposalList } from './ChangeProposalList';
import { CommentSection } from './CommentSection';
import { DeepDiveVisualizer } from './DeepDiveVisualizer';
import { getEffortColor } from '../lib/utils';

interface IdeaDetailModalProps {
  idea: Idea & { deep_dive_versions?: DeepDiveVersion[] };
  repos: Repo[];
  onClose?: () => void;
  onDeepDive: (ideaId: string) => Promise<void>;
  hideActions?: boolean;
  hideTitle?: boolean;
}

export const IdeaDetailModal: React.FC<IdeaDetailModalProps> = ({ idea, repos, onDeepDive, hideActions, hideTitle }) => {
  const [activeFeature, setActiveFeature] = useState<string | null>(null);
  const [deepDiveLoading, setDeepDiveLoading] = useState(false);
  const [deepDiveError, setDeepDiveError] = useState<string | null>(null);

  if (!idea) return null;
  
  try {
    const repo = repos.find(r => r.id === idea.repo_id);
    const deepDive = idea.deep_dive;
    const createdAt = idea.created_at ? new Date(idea.created_at).toLocaleString() : '';

    const type = idea.type || '';
    const typeLabel = type === 'side_hustle' ? 'Side Hustle' : type === 'full_scale' ? 'Full Scale' : '';
    const typeIcon = type === 'side_hustle' ? <Lightbulb className="w-4 h-4 text-orange-500 inline-block mr-1" /> : type === 'full_scale' ? <Briefcase className="w-4 h-4 text-blue-600 inline-block mr-1" /> : null;
    const typeColor = type === 'side_hustle' ? 'bg-orange-100 text-orange-800' : type === 'full_scale' ? 'bg-blue-100 text-blue-800' : 'bg-gray-100 text-gray-600';

    const renderFeature = () => {
      switch (activeFeature) {
        case 'case-studies':
          return <CaseStudyLookup ideaId={idea.id} ideaTitle={idea.title} onClose={() => setActiveFeature(null)} />;
        case 'market-snapshot':
          return <MarketSnapshotGenerator idea={idea} onClose={() => setActiveFeature(null)} />;
        case 'vc-thesis':
          return <VCThesisComparison idea={idea} onClose={() => setActiveFeature(null)} />;
        case 'lens-switcher':
          return <LensSwitcher ideaId={idea.id} ideaTitle={idea.title} onClose={() => setActiveFeature(null)} />;
        case 'investor-deck':
          return <InvestorDeckExporter idea={idea} onClose={() => setActiveFeature(null)} />;
        default:
          return null;
      }
    };

    return (
      <div className="w-full max-w-5xl px-4 py-2">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-2 mb-4 border-b pb-2">
          <div>
            {!hideTitle && (
              <h2 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
                <Link to={`/ideas/${idea.id}`} className="text-blue-900 underline hover:text-blue-600 cursor-pointer">
                  {idea.title}
                </Link>
                {repo ? <a href={repo.url} target="_blank" rel="noopener noreferrer" className="ml-2 text-blue-600 underline text-base">{repo.name}</a> : null}
              </h2>
            )}
            <div className="flex items-center gap-2 mt-1">
              <Badge variant="outline">{idea.status.toUpperCase()}</Badge>
              {repo && repo.language && <Badge variant="secondary">{repo.language}</Badge>}
              <span className="text-xs text-slate-500">Created: {createdAt}</span>
            </div>
          </div>
          <div className="flex gap-4 mt-2 md:mt-0">
            <div className="flex flex-col items-center">
              <span className="text-xs text-slate-500 mb-1">Score</span>
              <span className="w-10 h-10 flex items-center justify-center rounded-lg text-xl font-bold bg-green-500 text-white">{idea.score ?? 5}</span>
            </div>
            <div className="flex flex-col items-center">
              <span className="text-xs text-slate-500 mb-1">Effort</span>
              <span className={`w-10 h-10 flex items-center justify-center rounded-lg text-xl font-bold ${getEffortColor(idea.mvp_effort ?? 5)}`}>{idea.mvp_effort ?? 5}</span>
            </div>
            {type && (
              <div className="flex flex-col items-center">
                <span className="text-xs text-slate-500 mb-1">Type</span>
                <span className={`w-24 h-10 flex items-center justify-center rounded-lg text-sm font-bold ${typeColor}`}>{typeIcon}{typeLabel}
                  {type === 'side_hustle' && (idea.score ?? 5) < 8 && (idea.mvp_effort ?? 5) <= 3 && (
                    <span className="ml-1" title="Low score, but very low effort makes this a quick win."><Info className="w-3 h-3 text-orange-400 inline-block" /></span>
                  )}
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Feature Content */}
        {activeFeature && (
          <div className="mb-6">
            {renderFeature()}
          </div>
        )}

        {/* Action Buttons */}
        {!hideActions && (
          <div className="flex flex-wrap gap-2 mb-6 justify-center">
            {idea.status === 'suggested' ? (
              <>
                <Button 
                  variant="secondary" 
                  size="lg" 
                  className="min-w-[180px]"
                  onClick={async () => {
                    setDeepDiveLoading(true);
                    setDeepDiveError(null);
                    try {
                      await onDeepDive(idea.id);
                    } catch (err: unknown) {
                      let message = 'Failed to generate deep dive.';
                      if (err instanceof Error) message = err.message;
                      else if (typeof err === 'string') message = err;
                      setDeepDiveError(message);
                    } finally {
                      setDeepDiveLoading(false);
                    }
                  }}
                  disabled={deepDiveLoading}
                >
                  {deepDiveLoading ? 'Generating Deep Dive...' : 'Generate Deep Dive'}
                </Button>
                <Button asChild className="flex-1 min-w-[150px]">
                  <Link to={`/ideas/${idea.id}`}>
                    <ExternalLink className="w-4 h-4 mr-2" />
                    View Full Page
                  </Link>
                </Button>
                {deepDiveError && <div className="text-red-600 text-xs mt-2">{deepDiveError}</div>}
              </>
            ) : (
              <>
                {/* Advanced actions for non-suggested ideas only */}
                <Button asChild className="flex-1 min-w-[150px]">
                  <Link to={`/ideas/${idea.id}`}>
                    <ExternalLink className="w-4 h-4 mr-2" />
                    View Full Page
                  </Link>
                </Button>
                {idea.deep_dive && (
                  <Button variant="outline" className="flex-1 min-w-[150px]">
                    <Edit3 className="w-4 h-4 mr-2" />
                    Start Iterating
                  </Button>
                )}
                <Button 
                  variant="outline" 
                  className="flex-1 min-w-[150px]"
                  onClick={() => setActiveFeature(activeFeature === 'case-studies' ? null : 'case-studies')}
                >
                  <BookOpen className="w-4 h-4 mr-2" />
                  Case Studies
                </Button>
                <Button 
                  variant="outline" 
                  className="flex-1 min-w-[150px]"
                  onClick={() => setActiveFeature(activeFeature === 'market-snapshot' ? null : 'market-snapshot')}
                >
                  <Globe className="w-4 h-4 mr-2" />
                  Market Snapshot
                </Button>
                <Button 
                  variant="outline" 
                  className="flex-1 min-w-[150px]"
                  onClick={() => setActiveFeature(activeFeature === 'vc-thesis' ? null : 'vc-thesis')}
                >
                  <TargetIcon className="w-4 h-4 mr-2" />
                  VC Thesis
                </Button>
                <Button 
                  variant="outline" 
                  className="flex-1 min-w-[150px]"
                  onClick={() => setActiveFeature(activeFeature === 'lens-switcher' ? null : 'lens-switcher')}
                  data-tour="lens-switcher"
                >
                  <Eye className="w-4 h-4 mr-2" />
                  Lens Switcher
                </Button>
                <Button 
                  variant="outline" 
                  className="flex-1 min-w-[150px]"
                  onClick={() => setActiveFeature(activeFeature === 'investor-deck' ? null : 'investor-deck')}
                  data-tour="investor-deck"
                >
                  <Download className="w-4 h-4 mr-2" />
                  Export Deck
                </Button>
                <div data-tour="collaboration">
                  <CollaboratorManager idea={idea} />
                </div>
              </>
            )}
          </div>
        )}

        {/* Elevator Pitch & Details */}
        <div className="mb-6 grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <h3 className="text-lg font-semibold mb-2">Elevator Pitch</h3>
            {idea.hook && <div className="mb-2"><span className="font-semibold">Hook:</span> {idea.hook}</div>}
            {idea.value && <div className="mb-2"><span className="font-semibold">Value:</span> {idea.value}</div>}
            {idea.evidence && <div className="mb-2"><span className="font-semibold">Evidence:</span> {idea.evidence}</div>}
            {idea.differentiator && <div className="mb-2"><span className="font-semibold">Differentiator:</span> {idea.differentiator}</div>}
            {idea.call_to_action && <div className="mb-2"><span className="font-semibold">Call to Action:</span> {idea.call_to_action}</div>}
          </div>
          <div>
            <h3 className="text-lg font-semibold mb-2">Repository</h3>
            {repo ? (
              <>
                <div className="mb-1"><span className="font-semibold">Name:</span> {repo.name}</div>
                <div className="mb-1"><span className="font-semibold">Language:</span> {repo.language}</div>
                <div className="mb-1"><span className="font-semibold">Stars:</span> {repo.stargazers_count}</div>
                <div className="mb-1"><span className="font-semibold">Forks:</span> {repo.forks_count}</div>
                <div className="mb-1"><span className="font-semibold">Watchers:</span> {repo.watchers_count}</div>
                <div className="mb-1"><span className="font-semibold">Summary:</span> {repo.summary}</div>
                <div className="mb-1"><span className="font-semibold">URL:</span> <a href={repo.url} target="_blank" rel="noopener noreferrer" className="text-blue-600 underline">{repo.url}</a></div>
              </>
            ) : <div className="text-slate-500 italic">No repository info</div>}
          </div>
        </div>

        <div className="my-6" data-tour="collaboration">
          <h3 className="text-lg font-semibold mb-2">Collaboration Zone</h3>
          <ChangeProposalList idea={idea} />
          <CommentSection idea={idea} />
        </div>

        {/* Deep Dive Section: Always show, even if not available yet */}
        <div className="mb-6">
          <h3 className="text-lg font-semibold mb-4 flex items-center gap-2"><Star className="w-5 h-5 text-purple-500" /> Deep Dive Analysis</h3>
          {idea.deep_dive && idea.deep_dive.sections && idea.deep_dive.sections.length > 0 ? (
            // Check for error section
            idea.deep_dive.sections[0].title === 'Error Generating Deep Dive' ? (
              <div className="text-center py-10 px-6 bg-red-50 rounded-lg">
                <p className="text-red-700 font-semibold mb-2">Sorry, we couldn't generate a deep dive for this idea.</p>
                <p className="text-red-600 mb-4">{idea.deep_dive.sections[0].content || 'The AI was unable to produce a valid analysis. This sometimes happens if the idea is too vague or the AI is overloaded.'}</p>
                {idea.deep_dive_raw_response && (
                  <details className="mb-4">
                    <summary className="cursor-pointer text-blue-700 underline">Show Raw LLM Response</summary>
                    <pre className="bg-slate-100 p-2 rounded text-xs overflow-x-auto whitespace-pre-wrap mt-2">{idea.deep_dive_raw_response}</pre>
                  </details>
                )}
                <Button
                  variant="secondary"
                  size="lg"
                  onClick={async () => {
                    setDeepDiveLoading(true);
                    setDeepDiveError(null);
                    try {
                      await onDeepDive(idea.id);
                    } catch (err: unknown) {
                      let message = 'Failed to generate deep dive.';
                      if (err instanceof Error) message = err.message;
                      else if (typeof err === 'string') message = err;
                      setDeepDiveError(message);
                    } finally {
                      setDeepDiveLoading(false);
                    }
                  }}
                  disabled={deepDiveLoading}
                >
                  {deepDiveLoading ? 'Retrying...' : 'Retry Deep Dive'}
                </Button>
                {deepDiveError && <div className="text-red-600 text-xs mt-2">{deepDiveError}</div>}
              </div>
            ) : (
              <DeepDiveVisualizer idea={idea} />
            )
          ) : (
            <div className="text-center py-10 px-6 bg-slate-50 rounded-lg">
              <p className="text-slate-600">No deep dive analysis available yet.</p>
              <Button 
                variant="secondary" 
                size="sm" 
                className="mt-4"
                onClick={async () => {
                  setDeepDiveLoading(true);
                  setDeepDiveError(null);
                  try {
                    await onDeepDive(idea.id);
                  } catch (err: unknown) {
                    let message = 'Failed to generate deep dive.';
                    if (err instanceof Error) message = err.message;
                    else if (typeof err === 'string') message = err;
                    setDeepDiveError(message);
                  } finally {
                    setDeepDiveLoading(false);
                  }
                }}
                disabled={deepDiveLoading}
              >
                {deepDiveLoading ? 'Generating...' : 'Generate Deep Dive'}
              </Button>
              {deepDiveError && <div className="text-red-600 text-xs mt-2">{deepDiveError}</div>}
            </div>
          )}
        </div>

        {/* Raw LLM/Deep Dive Responses */}
        <Accordion type="single" collapsible>
          {idea.llm_raw_response && (
            <AccordionItem value="llmraw">
              <AccordionTrigger>Raw LLM Response</AccordionTrigger>
              <AccordionContent>
                <pre className="bg-slate-100 p-2 rounded text-xs overflow-x-auto whitespace-pre-wrap">{idea.llm_raw_response}</pre>
              </AccordionContent>
            </AccordionItem>
          )}
          {idea.deep_dive_raw_response && (
            <AccordionItem value="deepdiveraw">
              <AccordionTrigger>Raw Deep Dive Response</AccordionTrigger>
              <AccordionContent>
                <pre className="bg-slate-100 p-2 rounded text-xs overflow-x-auto whitespace-pre-wrap">{idea.deep_dive_raw_response}</pre>
              </AccordionContent>
            </AccordionItem>
          )}
        </Accordion>

        {/* Deep Dive Version History */}
        {idea.deep_dive_versions && idea.deep_dive_versions.length > 0 && (
          <div className="mt-6">
            <h3 className="text-lg font-semibold mb-2 flex items-center gap-2"><History className="w-5 h-5 text-slate-500" /> Deep Dive Version History</h3>
            <ul className="space-y-2">
              {idea.deep_dive_versions.map(version => (
                <li key={version.version_number} className="bg-slate-50 rounded p-2 text-xs">
                  <div className="font-semibold">Version {version.version_number} - {version.created_at ? new Date(version.created_at).toLocaleString() : 'Unknown date'}</div>
                  <div className="truncate">{version.llm_raw_response?.slice(0, 120) || 'No raw response'}</div>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    );
  } catch (error) {
    console.error('Error in IdeaDetailModal:', error);
    return null;
  }
}; 