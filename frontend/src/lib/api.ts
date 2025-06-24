import axios from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

export const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Add response interceptor for error handling
api.interceptors.response.use(
  (response) => response,
  (error) => {
    console.error('API Error:', error);
    return Promise.reject(error);
  }
);

export interface Repo {
  id: string;
  name: string;
  url: string;
  summary?: string;
  language?: string;
  created_at?: string;
  trending_period: string;
  stargazers_count?: number;
  forks_count?: number;
  watchers_count?: number;
}

export type IdeaStatus = 'suggested' | 'deep_dive' | 'iterating' | 'considering' | 'closed';

export interface Idea {
  id: string;
  repo_id: string;
  title: string;
  hook?: string;
  value?: string;
  evidence?: string;
  differentiator?: string;
  call_to_action?: string;
  deep_dive?: DeepDive;
  score?: number;
  mvp_effort?: number;
  deep_dive_requested: boolean;
  deepDiveStatus?: 'loading' | 'ready' | 'error';
  created_at?: string;
  llm_raw_response?: string;
  deep_dive_raw_response?: string;
  status: IdeaStatus;
  type?: string;
  // Iteration fields
  business_model?: string;
  market_positioning?: string;
  revenue_streams?: string;
  target_audience?: string;
  competitive_advantage?: string;
  go_to_market_strategy?: string;
  success_metrics?: string;
  risk_factors?: string;
  iteration_notes?: string;
  // Business Intelligence fields
  business_intelligence?: {
    business_model?: {
      key_partners: string;
      key_activities: string;
      key_resources: string;
      value_propositions: string;
      customer_relationships: string;
      channels: string;
      customer_segments: string;
      cost_structure: string;
      revenue_streams: string;
    };
    roadmap?: {
      phase_1: { title: string; duration: string; tasks: string[]; progress: number };
      phase_2: { title: string; duration: string; tasks: string[]; progress: number };
      phase_3: { title: string; duration: string; tasks: string[]; progress: number };
    };
    metrics?: {
      user_metrics: Array<{ name: string; target: number; current: number; trend: string }>;
      business_metrics: Array<{ name: string; target: number; current: number; trend: string }>;
      product_metrics: Array<{ name: string; target: number; current: number; trend: string }>;
    };
    roi_projections?: {
      year_1: { revenue: number; costs: number; roi: number };
      year_2: { revenue: number; costs: number; roi: number };
      year_3: { revenue: number; costs: number; roi: number };
    };
    market_snapshot?: {
      market_size: string;
      growth_rate: string;
      key_players: string[];
      market_trends: string;
      regulatory_environment: string;
      competitive_landscape: string;
      entry_barriers: string;
    };
    vc_comparisons?: Array<{
      vc_firm: string;
      thesis_focus: string;
      alignment_score: number;
      key_alignment_points: string;
      potential_concerns: string;
      investment_likelihood: string;
    }>;
  };
}

export interface DeepDiveSection {
  title: string;
  content: string;
}

export interface DeepDive {
  sections: DeepDiveSection[];
  raw?: string;
  error?: string;
}

export interface DeepDiveResponse {
  status: string;
  deep_dive?: DeepDive;
  message?: string;
}

export interface DeepDiveVersion {
  id: string;
  idea_id: string;
  version_number: number;
  fields: DeepDive;
  llm_raw_response?: string;
  created_at?: string;
}

// API Functions
export const getRepos = async (lang?: string, search?: string, period?: string) => {
  try {
    const response = await api.get('/repos/', { 
      params: { 
        language: lang, 
        search,
        period: period || 'daily'
      } 
    });
    return response.data;
  } catch (error) {
    console.error('Error fetching repos:', error);
    throw error;
  }
};

export const getRepoStats = async () => {
  try {
    const response = await api.get('/repos/stats');
    return response.data;
  } catch (error: unknown) {
    console.error('Error fetching repo stats:', error);
    throw error;
  }
};

export const getRepoHealth = async () => {
  try {
    const response = await api.get('/repos/health');
    return response.data;
  } catch (error: unknown) {
    console.error('Error fetching repo health:', error);
    throw error;
  }
};

export const loadTrendingRepos = async (period: string = 'daily', languages?: string) => {
  try {
    const response = await api.post('/repos/load', null, {
      params: {
        period,
        languages
      }
    });
    return response.data;
  } catch (error: unknown) {
    console.error('Error loading trending repos:', error);
    throw error;
  }
};

export const refreshTrendingRepos = async (period: string = 'daily', languages?: string) => {
  try {
    const response = await api.post('/repos/refresh', null, {
      params: {
        period,
        languages
      }
    });
    return response.data;
  } catch (error: unknown) {
    console.error('Error refreshing trending repos:', error);
    throw error;
  }
};

export const getIdeas = async (repoId: string) => {
  try {
    const response = await api.get(`/ideas/repo/${repoId}`);
    return response.data;
  } catch (error) {
    console.error('Error fetching ideas:', error);
    throw error;
  }
};

export const triggerDeepDive = async (ideaId: string) => {
  try {
    console.log('🔍 DEBUG: triggerDeepDive called for idea:', ideaId);
    const response = await api.post(`/ideas/${ideaId}/deepdive`);
    console.log('🔍 DEBUG: triggerDeepDive response:', response.data);
    return response.data;
  } catch (error: unknown) {
    console.error('❌ ERROR: triggerDeepDive failed:', error);
    if (error && typeof error === 'object' && 'response' in error) {
      const axiosError = error as { response: { data: unknown; status: number } };
      console.error('❌ ERROR: Response data:', axiosError.response.data);
      console.error('❌ ERROR: Response status:', axiosError.response.status);
    }
    throw error;
  }
};

// Business task triggers for different status transitions
export const triggerIterationTasks = async (ideaId: string) => {
  try {
    console.log('🔍 DEBUG: triggerIterationTasks called for idea:', ideaId);
    // This could trigger multiple tasks in parallel
    const tasks = [
      generateBusinessModelCanvas(ideaId),
      generateDevelopmentRoadmap(ideaId),
      generateSuccessMetrics(ideaId)
    ];
    
    const results = await Promise.allSettled(tasks);
    console.log('🔍 DEBUG: Iteration tasks completed:', results);
    return results;
  } catch (error: unknown) {
    console.error('❌ ERROR: triggerIterationTasks failed:', error);
    throw error;
  }
};

export const triggerConsiderationTasks = async (ideaId: string) => {
  try {
    console.log('🔍 DEBUG: triggerConsiderationTasks called for idea:', ideaId);
    // This could trigger multiple tasks in parallel
    const tasks = [
      generateMarketSnapshot(ideaId),
      generateVCThesisComparison(ideaId),
      generateROIProjections(ideaId)
    ];
    
    const results = await Promise.allSettled(tasks);
    console.log('🔍 DEBUG: Consideration tasks completed:', results);
    return results;
  } catch (error: unknown) {
    console.error('❌ ERROR: triggerConsiderationTasks failed:', error);
    throw error;
  }
};

export const triggerClosureTasks = async (ideaId: string) => {
  try {
    console.log('🔍 DEBUG: triggerClosureTasks called for idea:', ideaId);
    // Generate post-mortem analysis
    const response = await api.post(`/ideas/${ideaId}/post-mortem`);
    console.log('🔍 DEBUG: Closure tasks completed:', response.data);
    return response.data;
  } catch (error: unknown) {
    console.error('❌ ERROR: triggerClosureTasks failed:', error);
    throw error;
  }
};

// Helper functions for specific business tasks
export const generateBusinessModelCanvas = async (ideaId: string) => {
  try {
    const response = await api.post(`/ideas/${ideaId}/business-model`);
    return response.data;
  } catch (error) {
    console.error('Error generating business model canvas:', error);
    throw error;
  }
};

export const generateDevelopmentRoadmap = async (ideaId: string) => {
  try {
    const response = await api.post(`/ideas/${ideaId}/roadmap`);
    return response.data;
  } catch (error) {
    console.error('Error generating development roadmap:', error);
    throw error;
  }
};

export const generateSuccessMetrics = async (ideaId: string) => {
  try {
    const response = await api.post(`/ideas/${ideaId}/metrics`);
    return response.data;
  } catch (error) {
    console.error('Error generating success metrics:', error);
    throw error;
  }
};

export const generateROIProjections = async (ideaId: string) => {
  try {
    const response = await api.post(`/ideas/${ideaId}/roi`);
    return response.data;
  } catch (error) {
    console.error('Error generating ROI projections:', error);
    throw error;
  }
};

export const getStats = async () => {
  try {
    const response = await api.get('/admin/stats');
    return response.data;
  } catch (error) {
    console.error('Error fetching stats:', error);
    throw error;
  }
};

export const getShortlist = async () => {
  try {
    const response = await api.get('/ideas/shortlist');
    return response.data;
  } catch (error) {
    console.error('Error fetching shortlist:', error);
    throw error;
  }
};

export const addToShortlist = async (ideaId: string) => {
  try {
    const response = await api.post(`/ideas/${ideaId}/shortlist`);
    return response.data;
  } catch (error) {
    console.error('Error adding to shortlist:', error);
    throw error;
  }
};

export const removeFromShortlist = async (ideaId: string) => {
  try {
    const response = await api.delete(`/ideas/${ideaId}/shortlist`);
    return response.data;
  } catch (error) {
    console.error('Error removing from shortlist:', error);
    throw error;
  }
};

export const getDeepDiveVersions = async (ideaId: string) => {
  try {
    const response = await api.get(`/ideas/${ideaId}/deepdive_versions`);
    return response.data;
  } catch (error) {
    console.error('Error fetching deep dive versions:', error);
    throw error;
  }
};

export const createDeepDiveVersion = async (ideaId: string, fields: Record<string, unknown>, llm_raw_response: string, rerun_llm = false) => {
  try {
    const response = await api.post(`/ideas/${ideaId}/deepdive_versions`, { fields, llm_raw_response, rerun_llm });
    return response.data;
  } catch (error: unknown) {
    console.error('Error creating deep dive version:', error);
    throw error;
  }
};

export const deleteDeepDiveVersion = async (ideaId: string, versionNumber: number) => {
  try {
    const response = await api.delete(`/ideas/${ideaId}/deepdive_versions/${versionNumber}`);
    return response.data;
  } catch (error) {
    console.error('Error deleting deep dive version:', error);
    throw error;
  }
};

export const getDeepDiveVersion = async (ideaId: string, versionNumber: number) => {
  try {
    const response = await api.get(`/ideas/${ideaId}/deepdive_versions/${versionNumber}`);
    return response.data;
  } catch (error) {
    console.error('Error fetching deep dive version:', error);
    throw error;
  }
};

export const restoreDeepDiveVersion = async (ideaId: string, versionNumber: number) => {
  try {
    const response = await api.post(`/ideas/${ideaId}/deepdive_versions/${versionNumber}/restore`);
    return response.data;
  } catch (error) {
    console.error('Error restoring deep dive version:', error);
    throw error;
  }
};

export const getAllIdeas = async () => {
  try {
    const response = await api.get('/ideas/all');
    return response.data;
  } catch (error) {
    console.error('Error fetching all ideas:', error);
    throw error;
  }
};

export const getIdeaById = async (ideaId: string): Promise<Idea> => {
  try {
    const response = await api.get(`/ideas/${ideaId}`);
    return response.data;
  } catch (error) {
    console.error('Error fetching idea by id:', error);
    throw error;
  }
};

// Data transformation functions to match frontend expectations
export const transformRepo = (repo: Repo) => ({
  id: repo.id,
  name: repo.name,
  description: repo.summary || '',
  language: repo.language || 'Unknown',
  url: repo.url || '',
  stargazers_count: repo.stargazers_count || 0,
  forks_count: repo.forks_count || 0,
  watchers_count: repo.watchers_count || 0,
  created_at: repo.created_at || new Date().toISOString().split('T')[0],
  trending_period: repo.trending_period || 'daily',
});

export const transformIdea = (idea: Idea) => ({
  id: idea.id,
  repo_id: idea.repo_id,
  title: idea.title || '',
  score: idea.score ?? 5,
  effort: idea.mvp_effort ?? 5,
  hook: idea.hook || '',
  value: idea.value || '',
  evidence: idea.evidence || '',
  differentiator: idea.differentiator || '',
  callToAction: idea.call_to_action || '',
  deepDiveGenerated: !!idea.deep_dive,
  deep_dive: idea.deep_dive,
  deep_dive_requested: idea.deep_dive_requested,
  created_at: idea.created_at,
  llm_raw_response: idea.llm_raw_response,
  deep_dive_raw_response: idea.deep_dive_raw_response,
  isError: idea.title && idea.title.startsWith('[ERROR]'),
  needsNewDeepDive: !(idea.deep_dive && Object.keys(idea.deep_dive).length > 0) && !idea.deep_dive_raw_response,
  status: idea.status,
  type: idea.type || '',
});

export async function fetchIdeas(repoId: string): Promise<Idea[]> {
  const res = await fetch(`/api/ideas?repo_id=${repoId}`);
  if (!res.ok) throw new Error('Failed to fetch ideas');
  return res.json();
}

export async function updateIdeaStatus(id: string, status: IdeaStatus): Promise<Idea> {
  try {
    console.log('🔍 DEBUG: updateIdeaStatus called:', { id, status });
    const response = await api.post(`/ideas/${id}/status`, status, {
      headers: { 'Content-Type': 'text/plain' }
    });
    console.log('🔍 DEBUG: updateIdeaStatus response:', response.data);
    return response.data;
  } catch (error: unknown) {
    console.error('❌ ERROR: updateIdeaStatus failed:', error);
    if (error && typeof error === 'object' && 'response' in error) {
      const axiosError = error as { response: { data: unknown; status: number } };
      console.error('❌ ERROR: Response data:', axiosError.response.data);
      console.error('❌ ERROR: Response status:', axiosError.response.status);
    }
    throw error;
  }
}

export const updateIdea = async (ideaId: string, updates: Partial<Idea>): Promise<Idea> => {
  try {
    console.log('🔍 DEBUG: updateIdea called:', { ideaId, updates });
    const response = await api.put(`/ideas/${ideaId}`, updates);
    console.log('🔍 DEBUG: updateIdea response:', response.data);
    return response.data;
  } catch (error: unknown) {
    console.error('❌ ERROR: updateIdea failed:', error);
    if (error && typeof error === 'object' && 'response' in error) {
      const axiosError = error as { response: { data: unknown; status: number } };
      console.error('❌ ERROR: Response data:', axiosError.response.data);
      console.error('❌ ERROR: Response status:', axiosError.response.status);
    }
    throw error;
  }
};

export const clearRepoCache = async () => {
  try {
    const response = await api.post('/repos/clear-cache');
    return response.data;
  } catch (error) {
    console.error('Error clearing repo cache:', error);
    throw error;
  }
};

// Advanced Features API Functions
export interface CaseStudy {
  id: string;
  idea_id: string;
  company_name: string;
  industry?: string;
  business_model?: string;
  success_factors?: string;
  challenges?: string;
  lessons_learned?: string;
  market_size?: string;
  funding_raised?: string;
  exit_value?: string;
  llm_raw_response?: string;
  created_at?: string;
}

export interface MarketSnapshot {
  id: string;
  idea_id: string;
  market_size?: string;
  growth_rate?: string;
  key_players: string[];
  market_trends?: string;
  regulatory_environment?: string;
  competitive_landscape?: string;
  entry_barriers?: string;
  llm_raw_response?: string;
  created_at?: string;
}

export interface LensInsight {
  id: string;
  idea_id: string;
  lens_type: string;
  insights?: string;
  opportunities?: string;
  risks?: string;
  recommendations?: string;
  llm_raw_response?: string;
  created_at?: string;
}

export interface VCThesisComparison {
  id: string;
  idea_id: string;
  vc_firm: string;
  thesis_focus?: string;
  alignment_score?: number;
  key_alignment_points?: string;
  potential_concerns?: string;
  investment_likelihood?: string;
  llm_raw_response?: string;
  created_at?: string;
}

export interface DeckSlide {
  slide_number: number;
  slide_type: string;
  title: string;
  content: string;
  key_points: string[];
}

export interface InvestorDeck {
  id: string;
  idea_id: string;
  deck_content: {
    title: string;
    slides: DeckSlide[];
  };
  generated_at?: string;
  llm_raw_response?: string;
}

// Case Study API
export const generateCaseStudy = async (ideaId: string, companyName?: string): Promise<{ case_study: CaseStudy; llm_raw_response: string }> => {
  try {
    const response = await api.post('/advanced/case-study', {
      idea_id: ideaId,
      company_name: companyName
    });
    return response.data;
  } catch (error) {
    console.error('Error generating case study:', error);
    throw error;
  }
};

export const getCaseStudy = async (ideaId: string): Promise<{ case_study: CaseStudy; llm_raw_response: string }> => {
  try {
    const response = await api.get(`/advanced/case-study/${ideaId}`);
    return response.data;
  } catch (error) {
    console.error('Error fetching case study:', error);
    throw error;
  }
};

// Market Snapshot API
export const generateMarketSnapshot = async (ideaId: string): Promise<{ market_snapshot: MarketSnapshot; llm_raw_response: string }> => {
  try {
    const response = await api.post('/advanced/market-snapshot', {
      idea_id: ideaId
    });
    return response.data;
  } catch (error) {
    console.error('Error generating market snapshot:', error);
    throw error;
  }
};

export const getMarketSnapshot = async (ideaId: string): Promise<{ market_snapshot: MarketSnapshot; llm_raw_response: string }> => {
  try {
    const response = await api.get(`/advanced/market-snapshot/${ideaId}`);
    return response.data;
  } catch (error) {
    console.error('Error fetching market snapshot:', error);
    throw error;
  }
};

// Lens Insights API
export const generateLensInsight = async (ideaId: string, lensType: string): Promise<{ lens_insight: LensInsight; llm_raw_response: string }> => {
  try {
    const response = await api.post('/advanced/lens-insight', {
      idea_id: ideaId,
      lens_type: lensType
    });
    return response.data;
  } catch (error) {
    console.error('Error generating lens insight:', error);
    throw error;
  }
};

export const getLensInsights = async (ideaId: string): Promise<{ lens_insights: LensInsight[]; llm_raw_responses: Record<string, string> }> => {
  try {
    const response = await api.get(`/advanced/lens-insights/${ideaId}`);
    return response.data;
  } catch (error) {
    console.error('Error fetching lens insights:', error);
    throw error;
  }
};

// VC Thesis Comparison API
export const generateVCThesisComparison = async (ideaId: string, vcFirm?: string): Promise<{ vc_thesis_comparison: VCThesisComparison; llm_raw_response: string }> => {
  try {
    const response = await api.post('/advanced/vc-thesis-comparison', {
      idea_id: ideaId,
      vc_firm: vcFirm
    });
    return response.data;
  } catch (error) {
    console.error('Error generating VC thesis comparison:', error);
    throw error;
  }
};

export const getVCThesisComparisons = async (ideaId: string): Promise<{ vc_thesis_comparisons: VCThesisComparison[]; llm_raw_responses: Record<string, string> }> => {
  try {
    const response = await api.get(`/advanced/vc-thesis-comparisons/${ideaId}`);
    return response.data;
  } catch (error) {
    console.error('Error fetching VC thesis comparisons:', error);
    throw error;
  }
};

// Investor Deck API
export const generateInvestorDeck = async (
  ideaId: string, 
  includeCaseStudies: boolean = true,
  includeMarketAnalysis: boolean = true,
  includeFinancialProjections: boolean = true
): Promise<{ investor_deck: InvestorDeck; llm_raw_response: string }> => {
  try {
    const response = await api.post('/advanced/investor-deck', {
      idea_id: ideaId,
      include_case_studies: includeCaseStudies,
      include_market_analysis: includeMarketAnalysis,
      include_financial_projections: includeFinancialProjections
    });
    return response.data;
  } catch (error) {
    console.error('Error generating investor deck:', error);
    throw error;
  }
};

export const getInvestorDeck = async (ideaId: string): Promise<{ investor_deck: InvestorDeck; llm_raw_response: string }> => {
  try {
    const response = await api.get(`/advanced/investor-deck/${ideaId}`);
    return response.data;
  } catch (error) {
    console.error('Error fetching investor deck:', error);
    throw error;
  }
};

// Collaboration API

export interface IdeaCollaborator {
  id: string;
  idea_id: string;
  user_id: string;
  role: 'editor' | 'viewer';
  created_at: string;
}

export const addCollaborator = async (ideaId: string, userId: string, role: 'editor' | 'viewer'): Promise<IdeaCollaborator> => {
  const response = await api.post(`/collaboration/ideas/${ideaId}/collaborators`, { user_id: userId, role });
  return response.data;
};

export const getCollaborators = async (ideaId: string): Promise<IdeaCollaborator[]> => {
  const response = await api.get(`/collaboration/ideas/${ideaId}/collaborators`);
  return response.data;
};

export const removeCollaborator = async (ideaId: string, userId: string): Promise<void> => {
  await api.delete(`/collaboration/ideas/${ideaId}/collaborators/${userId}`);
};

// Change Proposal API

export interface IdeaChangeProposal {
  id: string;
  idea_id: string;
  proposer_id: string;
  changes: Partial<Idea>;
  status: 'pending' | 'approved' | 'rejected';
  created_at: string;
}

export const submitChangeProposal = async (ideaId: string, changes: Partial<Idea>): Promise<IdeaChangeProposal> => {
  try {
    const response = await api.post(`/ideas/${ideaId}/proposals`, { changes });
    return response.data;
  } catch (error: unknown) {
    console.error('❌ ERROR: submitChangeProposal failed:', error);
    if (error && typeof error === 'object' && 'response' in error) {
      const axiosError = error as { response: { data: unknown; status: number } };
      console.error('❌ ERROR: Response data:', axiosError.response.data);
      console.error('❌ ERROR: Response status:', axiosError.response.status);
    }
    throw error;
  }
};

export const getChangeProposals = async (ideaId: string): Promise<IdeaChangeProposal[]> => {
  const response = await api.get(`/collaboration/ideas/${ideaId}/proposals`);
  return response.data;
};

export const approveChangeProposal = async (proposalId: string): Promise<IdeaChangeProposal> => {
  const response = await api.post(`/collaboration/proposals/${proposalId}/approve`);
  return response.data;
};

export const rejectChangeProposal = async (proposalId: string): Promise<IdeaChangeProposal> => {
  const response = await api.post(`/collaboration/proposals/${proposalId}/reject`);
  return response.data;
};

// Comment API

export interface Comment {
  id: string;
  idea_id: string;
  user_id: string;
  content: string;
  parent_comment_id: string | null;
  created_at: string;
}

export const addComment = async (ideaId: string, content: string, parentCommentId?: string): Promise<Comment> => {
  const response = await api.post(`/collaboration/ideas/${ideaId}/comments`, { content, parent_comment_id: parentCommentId });
  return response.data;
};

export const getComments = async (ideaId: string): Promise<Comment[]> => {
  const response = await api.get(`/collaboration/ideas/${ideaId}/comments`);
  return response.data;
};

export const deleteIdea = async (ideaId: string): Promise<void> => {
  await api.delete(`/ideas/${ideaId}`);
};

// ... and so on for change proposals and comments 

export const uploadResume = async (file: File) => {
  const formData = new FormData();
  formData.append('file', file);
  const response = await api.post('/resume/upload', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return response.data;
};

export const processResume = async () => {
  const response = await api.post('/resume/process');
  return response.data;
}; 