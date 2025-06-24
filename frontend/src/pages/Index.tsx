import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Star, GitFork, Eye, TrendingUp, Lightbulb, Target, Clock, DollarSign, Rocket, Loader2, CheckCircle, XCircle, RefreshCw, User, LogOut, Settings, AlertCircle, Calendar, ChevronLeft, ChevronRight, Plus, Brain, Zap } from 'lucide-react';
import { RepoCard } from "@/components/RepoCard";
import { IdeaWorkspace } from "@/components/IdeaWorkspace";
import { Dashboard } from "@/components/Dashboard";
import { getRepos, getIdeas, getAllIdeas, triggerDeepDive, getIdeaById, updateIdeaStatus, Idea, Repo, transformRepo, IdeaStatus, refreshTrendingRepos, clearRepoCache, deleteIdea } from "@/lib/api";
import { Toaster } from "@/components/ui/toaster";
import { useToast } from "@/hooks/use-toast";
import { IdeaCard } from "@/components/IdeaCard";
import { Accordion, AccordionItem, AccordionTrigger, AccordionContent } from "@/components/ui/accordion";
import { Link, useNavigate, Outlet, useLocation } from 'react-router-dom';
import { LIFECYCLE_STAGES } from '@/components/IdeaWorkspace';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose, DialogDescription } from "@/components/ui/dialog";
import { IdeaDetailModal } from '@/components/IdeaDetailModal';
import { useAuth } from '@/contexts/AuthContext';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ProductTour } from '@/components/ProductTour';
import { AddIdeaModal } from '@/components/AddIdeaModal';

import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import { DragOverlay } from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { Droppable } from '@/components/Droppable';
import { Draggable } from '@/components/Draggable';
import logo from '@/assets/logo.png';

const VALID_STATUSES = LIFECYCLE_STAGES.map(stage => stage.key);

const Index = ({ refreshFlag }: { refreshFlag?: number }) => {
  const [selectedRepo, setSelectedRepo] = useState(null);
  const [repoIdeas, setRepoIdeas] = useState([]);
  const [allRepoIdeas, setAllRepoIdeas] = useState<Record<string, Idea[]>>({});
  const [allUserIdeas, setAllUserIdeas] = useState<Idea[]>([]);
  const [currentRepos, setCurrentRepos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const { toast } = useToast();
  const [pollingDeepDiveId, setPollingDeepDiveId] = useState<string | null>(null);
  const [pollingTimeout, setPollingTimeout] = useState<ReturnType<typeof setTimeout> | null>(null);
  const [activeTab, setActiveTab] = useState('dashboard'); // Always default to dashboard
  const [repoStatus, setRepoStatus] = useState({}); // { [repoId]: { status: 'idle'|'loading'|'success'|'error', error?: string } }
  const [deepDiveInProgress, setDeepDiveInProgress] = useState<string | null>(null);
  const [modalIdea, setModalIdea] = useState<Idea | null>(null);
  const { user, logout } = useAuth();
  const [showProductTour, setShowProductTour] = useState(false);
  const [tourCompleted, setTourCompleted] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isAddIdeaModalOpen, setAddIdeaModalOpen] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    })
  );
  const [activeIdeaId, setActiveIdeaId] = useState<string | null>(null);

  const allIdeas = [...allUserIdeas, ...Object.values(allRepoIdeas).flat()];

  const transformIdea = (idea: Idea): Idea => {
    // This function can be used to add any client-side transformations if needed.
    // For now, it just ensures the type.
    return idea;
  };

  const fetchAllIdeas = useCallback(async (repos: Repo[]) => {
    if (!repos || repos.length === 0) return;
    try {
      const ideasMap = {};
      await Promise.all(repos.map(async (repo) => {
        const ideas = await getIdeas(repo.id);
        if (ideas && Array.isArray(ideas)) {
          // Filter out unparsed/error ideas
          const validIdeas = ideas.filter(idea => 
            idea && 
            idea.id && 
            idea.title && 
            !idea.title.startsWith('[ERROR]') &&
            idea.title.trim() !== '' &&
            idea.title !== 'Error parsing idea'
          ).map(transformIdea);
          ideasMap[repo.id] = validIdeas;
        } else {
          ideasMap[repo.id] = [];
        }
      }));
      setAllRepoIdeas(ideasMap);
    } catch (error) {
      console.error("Failed to fetch all ideas:", error);
      toast({
        title: 'Error',
        description: 'Could not fetch ideas. Please try again later.',
        variant: 'destructive'
      });
    }
  }, [setAllRepoIdeas, currentRepos]);

  const fetchUserIdeas = useCallback(async () => {
    try {
      const response = await getAllIdeas();
      const userIdeas = response.ideas || [];
      // Filter out unparsed/error ideas
      const validIdeas = userIdeas.filter(idea => 
        idea && 
        idea.id && 
        idea.title && 
        !idea.title.startsWith('[ERROR]') &&
        idea.title.trim() !== '' &&
        idea.title !== 'Error parsing idea'
      ).map(transformIdea);
      setAllUserIdeas(validIdeas);
    } catch (error) {
      console.error("Failed to fetch user ideas:", error);
      toast({
        title: 'Error',
        description: 'Could not fetch your ideas. Please try again later.',
        variant: 'destructive'
      });
    }
  }, []);

  useEffect(() => {
    const fetchRepos = async () => {
      try {
        setLoading(true);
        setError(null);
        const repos = await getRepos();
        const transformedRepos = repos.map(transformRepo);
        setCurrentRepos(transformedRepos);
      } catch (err) {
        console.error('Error fetching repos:', err);
        setError('Failed to load repositories');
        toast({
          title: "Error",
          description: "Failed to load repositories. Please try again.",
          variant: "destructive",
        });
      } finally {
        setLoading(false);
      }
    };

    fetchRepos();
  }, []);

  useEffect(() => {
    if (currentRepos.length > 0) {
      fetchAllIdeas(currentRepos);
    }
  }, [currentRepos, fetchAllIdeas]);

  useEffect(() => {
    // Fetch user ideas when component mounts
    fetchUserIdeas();
  }, [fetchUserIdeas]);

  useEffect(() => {
    if (refreshFlag !== undefined) {
      fetchUserIdeas();
      fetchAllIdeas(currentRepos);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [refreshFlag]);

  // Calculate total ideas count across all repos and user ideas
  const totalIdeasCount = allIdeas.length;

  // Show product tour when loading and no ideas yet
  useEffect(() => {
    console.log('🔍 DEBUG: Tour trigger check:', { 
      loading, 
      tourCompleted, 
      totalIdeasCount, 
      showProductTour 
    });
    
    if (!loading && !tourCompleted && totalIdeasCount === 0) {
      console.log('🔍 DEBUG: Setting showProductTour to true');
      setShowProductTour(true);
    }
  }, [loading, totalIdeasCount, tourCompleted]);

  const handleTourComplete = () => {
    setShowProductTour(false);
    setTourCompleted(true);
  };

  const handleRepoSelect = (repo) => {
    setSelectedRepo(repo);
    // Filter out unparsed/error ideas
    const ideas = (allRepoIdeas[repo.id] || []).filter(idea => 
      idea && 
      idea.id && 
      idea.title && 
      !idea.title.startsWith('[ERROR]') &&
      idea.title.trim() !== '' &&
      idea.title !== 'Error parsing idea'
    );
    setRepoIdeas(ideas);
  };

  // Clean up polling on unmount or repo/idea change
  useEffect(() => {
    return () => {
      if (pollingTimeout) clearTimeout(pollingTimeout);
      setPollingDeepDiveId(null);
    };
  }, []);

  // Refetch ideas for a repo and update state
  const refetchIdeasForRepo = async (repoId) => {
    try {
      const ideas = await getIdeas(repoId);
      // Filter out unparsed/error ideas
      const validIdeas = ideas.filter(idea => 
        idea && 
        idea.id && 
        idea.title && 
        !idea.title.startsWith('[ERROR]') &&
        idea.title.trim() !== '' &&
        idea.title !== 'Error parsing idea'
      ).map(transformIdea);
      
      setAllRepoIdeas(prev => ({ ...prev, [repoId]: validIdeas }));
    } catch (err) {
      // Optionally handle error
    }
  };

  const isToday = (dateString) => {
    if (!dateString) return false;
    const date = new Date(dateString);
    const today = new Date();
    return date.getDate() === today.getDate() &&
           date.getMonth() === today.getMonth() &&
           date.getFullYear() === today.getFullYear();
  };

  const isNewIdea = (idea: Idea) => {
    if (!idea.created_at) return false;
    const ideaDate = new Date(idea.created_at);
    const now = new Date();
    const diff = now.getTime() - ideaDate.getTime();
    return diff < 24 * 60 * 60 * 1000; // less than 24 hours
  };

  const handleRefreshTrendingRepos = async () => {
    setIsRefreshing(true);
    try {
      await clearRepoCache();
      const repos = await getRepos();
      const transformedRepos = repos.map(transformRepo);
      setCurrentRepos(transformedRepos);
      await fetchAllIdeas(transformedRepos);
      toast({
        title: "Refreshed!",
        description: "Trending repos and ideas have been updated.",
      });
    } catch (error) {
      toast({
        title: "Refresh Failed",
        description: "Could not refresh trending repos.",
        variant: "destructive",
      });
    } finally {
      setIsRefreshing(false);
    }
  };

  const handleIdeaUpdated = (updatedIdea: Idea) => {
    // This function can be called from child components to update an idea in the central state
    const updateList = (list: Idea[]) => list.map(idea => idea.id === updatedIdea.id ? updatedIdea : idea);

    setAllUserIdeas(updateList);
    setAllRepoIdeas(prev => {
        const newRepoIdeas = {...prev};
        for(const repoId in newRepoIdeas) {
            newRepoIdeas[repoId] = updateList(newRepoIdeas[repoId]);
        }
        return newRepoIdeas;
    });
    
    // Also update modal if it's showing the same idea
    if (modalIdea?.id === updatedIdea.id) {
        setModalIdea(updatedIdea);
    }
  };

  const handleIdeaDeleted = async (ideaId: string) => {
    try {
      await deleteIdea(ideaId);

      const filterOut = (list: Idea[]) => list.filter(idea => idea.id !== ideaId);
      
      setAllUserIdeas(filterOut);
      setAllRepoIdeas(prev => {
        const newRepoIdeas = {...prev};
        for(const repoId in newRepoIdeas) {
            newRepoIdeas[repoId] = filterOut(newRepoIdeas[repoId]);
        }
        return newRepoIdeas;
      });

      toast({
          title: "Idea Deleted",
          description: "The idea has been removed from your workspace.",
      });
    } catch (error) {
        toast({
            title: "Deletion Failed",
            description: "Could not delete the idea. Please try again.",
            variant: "destructive",
        });
    }
  };

  const handleStatusChangeWrapper = async (ideaId: string, status: IdeaStatus): Promise<void> => {
    // Update local state optimistically
    setAllUserIdeas(prev => prev.map(idea => 
      idea.id === ideaId ? { ...idea, status } : idea
    ));
    
    setAllRepoIdeas(prev => {
      const updated = { ...prev };
      Object.keys(updated).forEach(repoId => {
        updated[repoId] = updated[repoId].map(idea => 
          idea.id === ideaId ? { ...idea, status } : idea
        );
      });
      return updated;
    });
    
    // Update backend
    await updateIdeaStatus(ideaId, status);
  };

  const refreshIdeas = useCallback(async () => {
    setIsRefreshing(true);
    await fetchUserIdeas();
    await fetchAllIdeas(currentRepos);
    setIsRefreshing(false);
  }, [currentRepos, fetchAllIdeas, fetchUserIdeas]);

  // Detect navigation back from /ideas/:id and refresh ideas, reset tab
  useEffect(() => {
    if (!location.pathname.startsWith('/ideas/')) {
      // If we just left a detail page, refresh ideas and reset tab
      fetchUserIdeas();
      fetchAllIdeas(currentRepos);
      setActiveTab('workspace');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.pathname]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-lg text-slate-600">Loading trending repositories...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 flex items-center justify-center">
        <div className="text-center">
          <p className="text-lg text-red-600 mb-4">{error}</p>
          <Button onClick={() => window.location.reload()}>Retry</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white">
      {/* Product Tour */}
      <ProductTour
        isVisible={showProductTour}
        onComplete={handleTourComplete}
        ideasCount={totalIdeasCount}
        isLoading={loading}
      />
      
      {/* Professional Header */}
      <header className="border-b border-gray-200 bg-white">
        <div className="container mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            {/* Logo */}
            <div className="flex items-center">
              <img src={logo} alt="App Logo" style={{ height: '40px' }} className="mr-3" />
            </div>
            
            {/* Navigation and Actions */}
            <div className="flex items-center space-x-4">
              <Button onClick={() => setAddIdeaModalOpen(true)} data-tour="add-idea">
                <Plus className="mr-2 h-4 w-4" />
                Add Idea
              </Button>
              
              {/* User Menu */}
              {user && (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" className="relative h-8 w-8 rounded-full border border-gray-200 hover:border-gray-300" data-tour="sidebar">
                      <Avatar className="h-8 w-8">
                        <AvatarImage src={user.oauth_picture} alt={user.first_name} />
                        <AvatarFallback className="text-xs font-medium">
                          {user.first_name?.[0]}{user.last_name?.[0]}
                        </AvatarFallback>
                      </Avatar>
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent className="w-56" align="end" forceMount>
                    <DropdownMenuLabel className="font-normal">
                      <div className="flex flex-col space-y-1">
                        <p className="text-sm font-medium leading-none text-gray-900">
                          {user.first_name} {user.last_name}
                        </p>
                        <p className="text-xs leading-none text-gray-500">
                          {user.email}
                        </p>
                      </div>
                    </DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem asChild>
                      <Link to="/profile" className="flex items-center" data-tour="profile">
                        <User className="mr-2 h-4 w-4" />
                        <span>Profile</span>
                      </Link>
                    </DropdownMenuItem>
                    <DropdownMenuItem asChild>
                      <Link to="/settings" className="flex items-center">
                        <Settings className="mr-2 h-4 w-4" />
                        <span>Settings</span>
                      </Link>
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={logout} className="flex items-center text-red-600">
                      <LogOut className="mr-2 h-4 w-4" />
                      <span>Log out</span>
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-6 py-8">
        {/* Render nested route (full detail view) above tabs if present */}
        <Outlet />
        {/* Dynamic Page Header */}
        <div className="mb-2 flex items-center gap-2" style={{alignItems: 'center'}}>
          {activeTab === 'workspace' && <Brain className="h-5 w-5 text-purple-500" style={{marginBottom: 0}} />}
          {activeTab === 'dashboard' && <Target className="h-5 w-5 text-blue-500" style={{marginBottom: 0}} />}
          <h2 className="text-lg font-semibold text-gray-900" style={{marginBottom: 0}}>
            {activeTab === 'workspace' && 'Workspace'}
            {activeTab === 'dashboard' && 'Dashboard'}
          </h2>
        </div>

        <AddIdeaModal
          isOpen={isAddIdeaModalOpen}
          onClose={() => setAddIdeaModalOpen(false)}
          onIdeaCreated={() => {
            fetchUserIdeas();
            fetchAllIdeas(currentRepos);
          }}
        />

        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full mt-2">
          <TabsList className="grid w-full grid-cols-2 mb-6">
            <TabsTrigger value="workspace" className="flex items-center gap-2" data-tour="workspace">
              <Brain className="h-4 w-4" />
              Workspace
            </TabsTrigger>
            <TabsTrigger value="dashboard" className="flex items-center gap-2">
              <Target className="h-4 w-4" />
              Dashboard
            </TabsTrigger>
          </TabsList>

          <TabsContent value="workspace">
            <IdeaWorkspace 
              ideas={allIdeas}
              repos={currentRepos}
              onIdeaDeleted={handleIdeaDeleted} 
              onIdeaUpdated={handleIdeaUpdated} 
              onStatusChange={handleStatusChangeWrapper}
              onDeepDive={triggerDeepDive}
              modalIdea={modalIdea}
              setModalIdea={setModalIdea}
            />
          </TabsContent>
          <TabsContent value="dashboard">
            <Dashboard
              repos={currentRepos}
              ideas={allIdeas}
              onAddIdea={() => setAddIdeaModalOpen(true)}
              setModalIdea={setModalIdea}
            />
          </TabsContent>
        </Tabs>
      </main>
      <Toaster />
      {/* Idea Detail Modal */}
      <Dialog open={!!modalIdea} onOpenChange={open => {
        if (!open) {
          setModalIdea(null);
          // Refetch all ideas to update Kanban
          fetchAllIdeas(currentRepos);
          fetchUserIdeas();
        }
      }}>
        <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto" aria-describedby="idea-detail-desc">
          <DialogHeader>
            <DialogTitle>Idea Details</DialogTitle>
            <DialogDescription id="idea-detail-desc">
              View and manage all details, deep dives, and Q&A for this idea.
            </DialogDescription>
          </DialogHeader>
          {modalIdea && (
            <IdeaDetailModal
              idea={modalIdea}
              repos={currentRepos}
              onDeepDive={triggerDeepDive}
            />
          )}
          <DialogFooter className="flex flex-row gap-2 justify-end">
            {modalIdea?.status === 'suggested' && (
              <Button variant="default" onClick={async () => {
                if (!modalIdea) return;
                setDeepDiveInProgress(modalIdea.id);
                try {
                  await triggerDeepDive(modalIdea.id);
                  // Poll for completion and update modal state
                  const pollDeepDive = async (retries = 30) => {
                    console.log('🔍 DEBUG: Starting deep dive polling for idea:', modalIdea.id);
                    for (let i = 0; i < retries; i++) {
                      try {
                        console.log(`🔍 DEBUG: Polling attempt ${i + 1}/${retries}`);
                        const updated = await getIdeaById(modalIdea.id);
                        console.log('🔍 DEBUG: Polling response:', updated);
                        
                        if ((updated.deep_dive_raw_response && updated.deep_dive_raw_response.length > 0) || (updated.deep_dive && Object.keys(updated.deep_dive).length > 0)) {
                          console.log('🔍 DEBUG: Deep dive completed, updating modal');
                          setModalIdea(updated);
                          setDeepDiveInProgress(null);
                          toast({
                            title: 'Deep Dive Complete',
                            description: `Analysis for "${modalIdea.title}" is ready!`,
                          });
                          return;
                        }
                        console.log('🔍 DEBUG: Deep dive not ready yet, waiting...');
                        await new Promise(res => setTimeout(res, 2000));
                      } catch (error) {
                        console.error('❌ ERROR: Error polling for deep dive:', error);
                        break;
                      }
                    }
                    console.log('🔍 DEBUG: Polling timeout reached');
                    setDeepDiveInProgress(null);
                    toast({
                      title: 'Deep Dive Timeout',
                      description: 'The deep dive is taking longer than expected. Please try again.',
                      variant: 'destructive',
                    });
                  };
                  pollDeepDive();
                } catch (error) {
                  console.error('Error triggering deep dive:', error);
                  setDeepDiveInProgress(null);
                  toast({
                    title: 'Deep Dive Failed',
                    description: 'Failed to generate deep dive. Please try again.',
                    variant: 'destructive',
                  });
                }
              }}
              disabled={!!deepDiveInProgress}
            >
              {deepDiveInProgress ? 'Generating...' : 'Get Deep Dive'}
            </Button>
            )}
            {modalIdea?.status === 'deep_dive' && (
              <Button variant="secondary" onClick={() => {
                setModalIdea(null);
                navigate(`/ideas/${modalIdea.id}`);
              }}>
                Iterate
              </Button>
            )}
            {modalIdea && modalIdea.status !== 'suggested' && modalIdea.status !== 'deep_dive' && (
              <Button variant="secondary" onClick={() => {
                setModalIdea(null);
                navigate(`/ideas/${modalIdea.id}`);
              }}>
                Edit
              </Button>
            )}
            {/* Save button can be implemented here if editing is enabled */}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Index;