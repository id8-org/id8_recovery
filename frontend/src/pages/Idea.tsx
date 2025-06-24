import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { getIdeas, triggerDeepDive, updateIdeaStatus, getDeepDiveVersions, restoreDeepDiveVersion, getAllIdeas, getIdeaById, updateIdea, generateLensInsight, getLensInsights } from '@/lib/api';
import { IdeaCard } from '@/components/IdeaCard';
import type { Idea, IdeaStatus, DeepDiveVersion, Repo, LensInsight } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Separator } from '@/components/ui/separator';
import { Accordion, AccordionItem, AccordionTrigger, AccordionContent } from '@/components/ui/accordion';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import ReactMarkdown from 'react-markdown';
import { 
  ArrowLeft, 
  Star, 
  TrendingUp, 
  Zap, 
  History, 
  Lightbulb, 
  Briefcase, 
  Info, 
  Rocket, 
  Clock, 
  Target, 
  BarChart,
  Edit3,
  Save,
  RefreshCw,
  GitBranch,
  Calendar,
  Users,
  DollarSign,
  Shield,
  CheckCircle,
  AlertCircle,
  Loader2,
  BookOpen,
  Globe,
  Eye,
  Download,
  Brain,
  FileText,
  Map,
  Building2,
  Trophy,
  Crown,
  ArrowRight
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { CaseStudyLookup } from '@/components/CaseStudyLookup';
import { MarketSnapshotGenerator } from '@/components/MarketSnapshotGenerator';
import { VCThesisComparison } from '@/components/VCThesisComparison';
import { LensSwitcher } from '@/components/LensSwitcher';
import { InvestorDeckExporter } from '@/components/InvestorDeckExporter';
import { DeepDiveVisualizer } from '@/components/DeepDiveVisualizer';
import { getEffortColor } from '../lib/utils';
import { IdeaFilterBar } from '@/components/IdeaFilterBar';
import { IdeaWorkspace } from '@/components/IdeaWorkspace';
import { IdeaDetailModal } from '@/components/IdeaDetailModal';
import { useAuth } from '@/contexts/AuthContext';

export default function IdeaPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [idea, setIdea] = useState<Idea | null>(null);
  const [repos, setRepos] = useState<Repo[]>([]);
  const [deepDiveVersions, setDeepDiveVersions] = useState<DeepDiveVersion[]>([]);
  const [lensInsights, setLensInsights] = useState<LensInsight[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statusLoading, setStatusLoading] = useState(false);
  const [deepDiveLoading, setDeepDiveLoading] = useState(false);
  const [lensLoading, setLensLoading] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [activeTab, setActiveTab] = useState('overview');
  const [editData, setEditData] = useState({
    title: '',
    hook: '',
    value: '',
    evidence: '',
    differentiator: '',
    call_to_action: '',
    business_model: '',
    market_positioning: '',
    revenue_streams: '',
    target_audience: '',
    competitive_advantage: '',
    go_to_market_strategy: '',
    success_metrics: '',
    risk_factors: '',
    iteration_notes: ''
  });
  const [allIdeas, setAllIdeas] = useState<Idea[]>([]);
  const [filters, setFilters] = useState({
    language: 'all',
    ideaType: 'all',
    minScore: 0,
    maxEffort: 10,
  });
  const [selectedFilter, setSelectedFilter] = useState<'all' | 'high_potential' | 'quick_wins' | 'recent'>('all');
  const { config: globalConfig } = useAuth();
  const [config, setConfig] = useState<any | null>(globalConfig);

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    setError(null);
    
    // Fetch the idea directly by ID
    getIdeaById(id)
      .then((found) => {
        setIdea(found);
        setEditData({
          title: found.title || '',
          hook: found.hook || '',
          value: found.value || '',
          evidence: found.evidence || '',
          differentiator: found.differentiator || '',
          call_to_action: found.call_to_action || '',
          business_model: found.business_model || '',
          market_positioning: found.market_positioning || '',
          revenue_streams: found.revenue_streams || '',
          target_audience: found.target_audience || '',
          competitive_advantage: found.competitive_advantage || '',
          go_to_market_strategy: found.go_to_market_strategy || '',
          success_metrics: found.success_metrics || '',
          risk_factors: found.risk_factors || '',
          iteration_notes: found.iteration_notes || ''
        });
        fetchVersions(found.id);
        fetchLensInsights(found.id);
        setLoading(false);
      })
      .catch(() => {
        setError('Idea not found');
        setLoading(false);
      });
  }, [id]);

  const fetchVersions = async (ideaId: string) => {
    try {
      const versions = await getDeepDiveVersions(ideaId);
      setDeepDiveVersions(versions);
    } catch {
      setDeepDiveVersions([]);
    }
  };

  const fetchLensInsights = async (ideaId: string) => {
    try {
      const response = await getLensInsights(ideaId);
      setLensInsights(response.lens_insights);
    } catch (error) {
      console.error('Error fetching lens insights:', error);
      setLensInsights([]);
    }
  };

  const handleDeepDive = async () => {
    if (!idea) return;
    setDeepDiveLoading(true);
    try {
      const { idea: updatedIdea, config: newConfig } = await triggerDeepDive(idea.id);
      setIdea(updatedIdea);
      setConfig(newConfig);
      toast({
        title: 'Deep Dive Started',
        description: 'Analysis is being generated. This may take a few minutes.',
      });
      // Poll for completion
      const pollDeepDive = async (retries = 30) => {
        for (let i = 0; i < retries; i++) {
          try {
            const updated = await getIdeaById(updatedIdea.id);
            if ((updated.deep_dive_raw_response && updated.deep_dive_raw_response.length > 0) || 
                (updated.deep_dive && Object.keys(updated.deep_dive).length > 0) || updated.status !== 'suggested') {
              setIdea(updated);
              fetchVersions(updated.id);
              toast({
                title: 'Deep Dive Complete',
                description: 'Analysis is ready!',
              });
              return;
            }
            await new Promise(res => setTimeout(res, 2000));
          } catch (error) {
            console.error('Error polling for deep dive:', error);
            break;
          }
        }
        toast({
          title: 'Deep Dive Timeout',
          description: 'The analysis is taking longer than expected.',
          variant: 'destructive',
        });
      };
      await pollDeepDive();
    } catch (error) {
      toast({
        title: 'Deep Dive Failed',
        description: 'Failed to start analysis. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setDeepDiveLoading(false);
    }
  };

  const handleLensInsight = async (lensType: string) => {
    if (!idea) return;
    setLensLoading(true);
    try {
      await generateLensInsight(idea.id, lensType);
      toast({
        title: 'Lens Insight Started',
        description: `${lensType} perspective analysis is being generated.`,
      });
      
      // Refresh lens insights
      await fetchLensInsights(idea.id);
      toast({
        title: 'Lens Insight Complete',
        description: `${lensType} perspective analysis is ready!`,
      });
    } catch (error) {
      console.error('Error generating lens insight:', error);
      toast({
        title: 'Lens Insight Failed',
        description: 'Failed to generate lens insight. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setLensLoading(false);
    }
  };

  const handleStatusChange = async (newStatus: IdeaStatus) => {
    if (!idea) return;
    setStatusLoading(true);
    try {
      await updateIdeaStatus(idea.id, newStatus);
      const updated = await getIdeaById(idea.id);
      setIdea(updated);
      toast({
        title: 'Status Updated',
        description: `Idea moved to ${newStatus.replace('_', ' ')}`,
      });
    } catch (error) {
      toast({
        title: 'Update Failed',
        description: 'Failed to update idea status.',
        variant: 'destructive',
      });
    } finally {
      setStatusLoading(false);
    }
  };

  const handleRestoreVersion = async (versionNumber: number) => {
    if (!idea) return;
    try {
      await restoreDeepDiveVersion(idea.id, versionNumber);
      const updated = await getIdeaById(idea.id);
      setIdea(updated);
      fetchVersions(idea.id);
      toast({
        title: 'Version Restored',
        description: `Deep dive version ${versionNumber} has been restored.`,
      });
    } catch (error) {
      toast({
        title: 'Restore Failed',
        description: 'Failed to restore version.',
        variant: 'destructive',
      });
    }
  };

  const handleSaveEdit = async () => {
    if (!idea) return;
    try {
      await updateIdea(idea.id, editData);
      const updated = await getIdeaById(idea.id);
      setIdea(updated);
      setIsEditing(false);
      toast({
        title: 'Changes Saved',
        description: 'Idea has been updated successfully.',
      });
    } catch (error) {
      toast({
        title: 'Save Failed',
        description: 'Failed to save changes.',
        variant: 'destructive',
      });
    }
  };

  const getStatusColor = (status: IdeaStatus) => {
    switch (status) {
      case 'suggested': return 'bg-gray-100 text-gray-800';
      case 'deep_dive': return 'bg-blue-100 text-blue-800';
      case 'iterating': return 'bg-yellow-100 text-yellow-800';
      case 'considering': return 'bg-purple-100 text-purple-800';
      case 'closed': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  // Fetch all ideas on mount
  useEffect(() => {
    getAllIdeas().then(({ ideas, config }) => {
      setAllIdeas(ideas);
      setConfig(config);
    });
  }, []);

  // Filtering logic
  useEffect(() => {
    let ideas = [...allIdeas];
    if (filters.language !== 'all') {
      ideas = ideas.filter(idea => {
        const repo = repos.find(r => r.id === idea.repo_id);
        return repo?.language === filters.language;
      });
    }
    if (filters.ideaType !== 'all') {
      ideas = ideas.filter(idea => idea.type === filters.ideaType);
    }
    if (filters.minScore > 0) {
      ideas = ideas.filter(idea => (idea.score || 0) >= filters.minScore);
    }
    if (filters.maxEffort < 10) {
      ideas = ideas.filter(idea => (idea.mvp_effort || 10) <= filters.maxEffort);
    }
  }, [allIdeas, filters, repos]);

  // Get available languages and types
  const availableLanguages = Array.from(new Set(repos.map(r => r.language).filter(Boolean)));
  const availableIdeaTypes = Array.from(new Set(allIdeas.map(i => i.type).filter(Boolean)));

  // Calculate idea potential (score - effort)
  const ideasWithPotential = allIdeas.map(idea => ({
    ...idea,
    potential: (idea.score || 0) - (idea.mvp_effort || 5),
    isHighPotential: (idea.score || 0) >= 8 && (idea.mvp_effort || 5) <= 4,
    isQuickWin: (idea.score || 0) >= 6 && (idea.mvp_effort || 5) <= 3,
    isRecent: new Date(idea.created_at || '').getTime() > Date.now() - 7 * 24 * 60 * 60 * 1000
  }));

  const filteredIdeas = ideasWithPotential.filter(idea => {
    switch (selectedFilter) {
      case 'high_potential':
        return idea.isHighPotential;
      case 'quick_wins':
        return idea.isQuickWin;
      case 'recent':
        return idea.isRecent;
      default:
        return true;
    }
  });

  const sortedIdeas = filteredIdeas.sort((a, b) => b.potential - a.potential);

  // If there is an id in the URL, handle detail page logic
  if (id) {
    if (loading) {
      return (
        <div className="flex items-center justify-center min-h-screen">
          <Loader2 className="w-8 h-8 animate-spin text-blue-500 mr-3" />
          <span className="text-gray-600">Loading idea...</span>
        </div>
      );
    }
    if (error) {
      return (
        <div className="flex items-center justify-center min-h-screen">
          <div className="text-center">
            <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
            <h2 className="text-xl font-semibold mb-2">Idea Not Found</h2>
            <p className="text-gray-600 mb-4">{error}</p>
            <Button onClick={() => navigate('/ideas')}>Back to Ideas</Button>
          </div>
        </div>
      );
    }
    if (idea) {
      // Render full-page detail with tabbed layout
      // Feature availability logic
      const canDeepDive = !!idea.deep_dive || idea.status !== 'suggested';
      const canLenses = !!idea.deep_dive;
      const canMarket = !!idea.deep_dive;
      const canDeck = !!idea.deep_dive;
      const repo = repos.find(r => r.id === idea.repo_id);
      const createdAt = idea.created_at ? new Date(idea.created_at).toLocaleString() : '';
      const type = idea.type || '';
      const typeLabel = type === 'side_hustle' ? 'Side Hustle' : type === 'full_scale' ? 'Full Scale' : '';
      const typeIcon = type === 'side_hustle' ? <Lightbulb className="w-4 h-4 text-orange-500 inline-block mr-1" /> : type === 'full_scale' ? <Briefcase className="w-4 h-4 text-blue-600 inline-block mr-1" /> : null;
      const typeColor = type === 'side_hustle' ? 'bg-orange-100 text-orange-800' : type === 'full_scale' ? 'bg-blue-100 text-blue-800' : 'bg-gray-100 text-gray-600';
      return (
        <div className="px-4 py-6 max-w-5xl mx-auto">
          <Button variant="ghost" size="sm" className="mb-2" onClick={() => navigate(-1)}>
            <ArrowLeft className="w-4 h-4 mr-1 inline-block" /> Back
          </Button>
          <h1 className="text-3xl font-bold text-blue-900 mb-2">
            {idea.title}
          </h1>
          <div className="flex items-center gap-2 mb-4">
            <Badge variant="secondary">{idea.status.toUpperCase()}</Badge>
            {repo && repo.language && <Badge variant="secondary">{repo.language}</Badge>}
            <span className="text-xs text-slate-500">Created: {createdAt}</span>
            {type && (
              <span className={`ml-2 w-24 h-10 flex items-center justify-center rounded-lg text-sm font-bold ${typeColor}`}>{typeIcon}{typeLabel}</span>
            )}
          </div>
          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <TabsList className="mb-6 w-full flex flex-wrap gap-2 justify-center">
              <TabsTrigger value="overview">Overview</TabsTrigger>
              <TabsTrigger value="deepdive" disabled={!canDeepDive}>Deep Dive</TabsTrigger>
              <TabsTrigger value="lenses" disabled={!canLenses}>Lenses</TabsTrigger>
              <TabsTrigger value="market" disabled={!canMarket}>Market</TabsTrigger>
              <TabsTrigger value="deck" disabled={!canDeck}>Deck</TabsTrigger>
            </TabsList>
            {/* Overview Tab */}
            <TabsContent value="overview">
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
                {/* <ChangeProposalList idea={idea} /> */}
              </div>
            </TabsContent>
            {/* Deep Dive Tab */}
            <TabsContent value="deepdive">
              {!canDeepDive ? (
                <div className="text-center py-10 px-6 bg-slate-50 rounded-lg text-slate-500">
                  Deep Dive is available after the idea is generated and analyzed.
                </div>
              ) : (
                <>
                  <div className="mb-6">
                    <h3 className="text-lg font-semibold mb-4 flex items-center gap-2"><Star className="w-5 h-5 text-purple-500" /> Deep Dive Analysis</h3>
                    {idea.deep_dive && idea.deep_dive.sections && idea.deep_dive.sections.length > 0 ? (
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
                            onClick={handleDeepDive}
                            disabled={deepDiveLoading}
                          >
                            {deepDiveLoading ? 'Retrying...' : 'Retry Deep Dive'}
                          </Button>
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
                          onClick={handleDeepDive}
                          disabled={deepDiveLoading}
                        >
                          {deepDiveLoading ? 'Generating...' : 'Generate Deep Dive'}
                        </Button>
                      </div>
                    )}
                  </div>
                  {/* Deep Dive Version History */}
                  {deepDiveVersions && deepDiveVersions.length > 0 && (
                    <div className="mt-6">
                      <h3 className="text-lg font-semibold mb-2 flex items-center gap-2"><History className="w-5 h-5 text-slate-500" /> Deep Dive Version History</h3>
                      <ul className="space-y-2">
                        {deepDiveVersions.map(version => (
                          <li key={version.version_number} className="bg-slate-50 rounded p-2 text-xs">
                            <div className="font-semibold">Version {version.version_number} - {version.created_at ? new Date(version.created_at).toLocaleString() : 'Unknown date'}</div>
                            <div className="truncate">{version.llm_raw_response?.slice(0, 120) || 'No raw response'}</div>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
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
                </>
              )}
            </TabsContent>
            {/* Lenses Tab */}
            <TabsContent value="lenses">
              {!canLenses ? (
                <div className="text-center py-10 px-6 bg-slate-50 rounded-lg text-slate-500">
                  Lenses are available after a deep dive is generated.
                </div>
              ) : (
                <LensSwitcher ideaId={idea.id} ideaTitle={idea.title} onClose={() => {}} />
              )}
            </TabsContent>
            {/* Market Tab */}
            <TabsContent value="market">
              {!canMarket ? (
                <div className="text-center py-10 px-6 bg-slate-50 rounded-lg text-slate-500">
                  Market insights are available after a deep dive is generated.
                </div>
              ) : (
                <>
                  <MarketSnapshotGenerator idea={idea} onClose={() => {}} />
                  <VCThesisComparison idea={idea} onClose={() => {}} />
                  <CaseStudyLookup ideaId={idea.id} ideaTitle={idea.title} onClose={() => {}} />
                </>
              )}
            </TabsContent>
            {/* Deck Tab */}
            <TabsContent value="deck">
              {!canDeck ? (
                <div className="text-center py-10 px-6 bg-slate-50 rounded-lg text-slate-500">
                  Export tools are available after a deep dive is generated.
                </div>
              ) : (
                <InvestorDeckExporter idea={idea} onClose={() => {}} />
              )}
            </TabsContent>
          </Tabs>
        </div>
      );
    }
    // If not loading, not error, and no idea, show nothing or a fallback
    return null;
  }

  // For /ideas (no id), render nothing (clean slate)
  return null;
} 