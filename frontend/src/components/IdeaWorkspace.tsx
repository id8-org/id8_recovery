import React, { useState, useEffect, type ReactElement } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Star, Lightbulb, Target, TrendingUp, Users, ArrowRight, StickyNote, Save, Edit3, Rocket, Clock, Brain, Briefcase, BarChart, GripVertical, Filter, Eye, EyeOff, Calendar, Code, Zap, Loader2, CheckCircle } from 'lucide-react';
import { IdeaCard } from "./IdeaCard";
import { getShortlist, addToShortlist, removeFromShortlist, getDeepDiveVersions, createDeepDiveVersion, restoreDeepDiveVersion, fetchIdeas, updateIdeaStatus, getAllIdeas, triggerDeepDive, getIdeaById, triggerIterationTasks, triggerConsiderationTasks, triggerClosureTasks } from "../lib/api";
import type { IdeaStatus, Idea, DeepDiveVersion, Repo } from '../lib/api';
import { DragDropContext, Droppable, Draggable, DropResult } from '@hello-pangea/dnd';
import type { AxiosError } from 'axios';
import { useToast } from "@/hooks/use-toast";
import { ToastAction } from "@/components/ui/toast";
import { useNavigate, Link } from "react-router-dom";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Accordion, AccordionItem, AccordionTrigger, AccordionContent } from "@/components/ui/accordion";
import { getEffortColor } from '../lib/utils';
import { IdeaFilterBar } from './IdeaFilterBar';
import { IdeaDetailModal } from './IdeaDetailModal';

export const LIFECYCLE_STAGES: { key: IdeaStatus; label: string }[] = [
  { key: 'suggested', label: 'Suggested' },
  { key: 'deep_dive', label: 'Deep Dive' },
  { key: 'iterating', label: 'Iterating' },
  { key: 'considering', label: 'Considering' },
  { key: 'closed', label: 'Closed' },
];

interface IdeaWorkspaceProps {
  ideas: Idea[];
  repos?: Repo[];
  onIdeaDeleted: (ideaId: string) => void;
  onIdeaUpdated: (idea: Idea) => void;
  onStatusChange: (ideaId: string, status: IdeaStatus) => Promise<void>;
  onDeepDive: (ideaId: string) => Promise<void>;
  modalIdea: Idea | null;
  setModalIdea: (idea: Idea | null) => void;
}

interface FilterState {
  language: string;
  age: string;
  ideaType: string;
  showNew: boolean;
  showSeen: boolean;
  showManual: boolean;
  showGenerated: boolean;
  minScore: number;
  maxEffort: number;
}

export function IdeaWorkspace({ 
  ideas, 
  repos = [],
  onIdeaDeleted,
  onIdeaUpdated,
  onStatusChange,
  onDeepDive,
  modalIdea,
  setModalIdea
}: IdeaWorkspaceProps) {
  const [filteredIdeas, setFilteredIdeas] = useState<Idea[]>([]);
  const [activeStage, setActiveStage] = useState<string>('suggested');
  const [loading, setLoading] = useState(false);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  
  // Enhanced filter state
  const [filters, setFilters] = useState<FilterState>({
    language: 'all',
    age: 'all',
    ideaType: 'all',
    showNew: true,
    showSeen: true,
    showManual: true,
    showGenerated: true,
    minScore: 0,
    maxEffort: 10
  });

  // Track seen ideas in localStorage
  const [seenIdeas, setSeenIdeas] = useState<Set<string>>(new Set());

  const [ideaNotes, setIdeaNotes] = useState<Record<number, string>>({});
  const [editingNotes, setEditingNotes] = useState<Record<number, boolean>>({});

  // Shortlist state from backend
  const [shortlist, setShortlist] = useState<string[]>([]);
  const [shortlistLoading, setShortlistLoading] = useState(false);

  const [editingDeepDive, setEditingDeepDive] = useState<Record<string, Record<string, string>>>({});
  const [versionHistory, setVersionHistory] = useState<Record<string, DeepDiveVersion[]>>({});
  const [showVersionHistory, setShowVersionHistory] = useState<string | null>(null);
  const [versionLoading, setVersionLoading] = useState<boolean>(false);

  const { toast } = useToast();
  const navigate = useNavigate();

  const [deepDiveInProgress, setDeepDiveInProgress] = useState<string | null>(null);

  const [modalLoading, setModalLoading] = useState(false);

  // Load seen ideas from localStorage
  useEffect(() => {
    const savedSeenIdeas = localStorage.getItem('seenIdeas');
    if (savedSeenIdeas) {
      setSeenIdeas(new Set(JSON.parse(savedSeenIdeas)));
    }
  }, []);

  // Save seen ideas to localStorage
  const markIdeaAsSeen = (ideaId: string) => {
    const newSeenIdeas = new Set(seenIdeas);
    newSeenIdeas.add(ideaId);
    setSeenIdeas(newSeenIdeas);
    localStorage.setItem('seenIdeas', JSON.stringify([...newSeenIdeas]));
  };

  // Apply filters to ideas
  useEffect(() => {
    console.log('🔍 DEBUG: Starting filtering with:', { 
      totalIdeas: ideas?.length || 0, 
      filters: filters,
      seenIdeasCount: seenIdeas.size,
      repos: repos?.length || 0
    });

    let newFilteredIdeas = [...ideas];
    console.log('🔍 DEBUG: Initial ideas count:', newFilteredIdeas.length);

    // Filter by language
    if (filters.language !== 'all') {
      newFilteredIdeas = newFilteredIdeas.filter(idea => {
        if (!idea.repo_id) return true; // Always include manual ideas
        const repo = repos.find(r => r.id === idea.repo_id);
        return repo?.language === filters.language;
      });
      console.log('🔍 DEBUG: After language filter:', newFilteredIdeas.length);
    }

    // Filter by age
    if (filters.age !== 'all') {
      const now = new Date();
      const cutoffDate = new Date();
      
      switch (filters.age) {
        case 'today':
          cutoffDate.setHours(0, 0, 0, 0);
          break;
        case 'week':
          cutoffDate.setDate(cutoffDate.getDate() - 7);
          break;
        case 'month':
          cutoffDate.setMonth(cutoffDate.getMonth() - 1);
          break;
        case 'old':
          cutoffDate.setMonth(cutoffDate.getMonth() - 3);
          break;
      }
      
      newFilteredIdeas = newFilteredIdeas.filter(idea => {
        if (!idea.created_at) return false;
        const ideaDate = new Date(idea.created_at);
        return ideaDate >= cutoffDate;
      });
      console.log('🔍 DEBUG: After age filter:', newFilteredIdeas.length);
    }

    // Filter by idea type
    if (filters.ideaType !== 'all') {
      newFilteredIdeas = newFilteredIdeas.filter(idea => idea.type === filters.ideaType);
      console.log('🔍 DEBUG: After type filter:', newFilteredIdeas.length);
    }

    // Filter by seen status
    if (!filters.showNew || !filters.showSeen) {
      newFilteredIdeas = newFilteredIdeas.filter(idea => {
        const isSeen = seenIdeas.has(idea.id);
        return (filters.showNew && !isSeen) || (filters.showSeen && isSeen);
      });
      console.log('🔍 DEBUG: After seen filter:', newFilteredIdeas.length);
    }

    // Filter by source (manual vs generated)
    if (!filters.showManual || !filters.showGenerated) {
      newFilteredIdeas = newFilteredIdeas.filter(idea => {
        const isManual = !idea.repo_id;
        return (filters.showManual && isManual) || (filters.showGenerated && !isManual);
      });
      console.log('🔍 DEBUG: After source filter:', newFilteredIdeas.length);
    }

    // Filter by score
    if (filters.minScore > 0) {
      newFilteredIdeas = newFilteredIdeas.filter(idea => (idea.score || 0) >= filters.minScore);
      console.log('🔍 DEBUG: After score filter:', newFilteredIdeas.length);
    }

    // Filter by effort
    if (filters.maxEffort < 10) {
      newFilteredIdeas = newFilteredIdeas.filter(idea => (idea.mvp_effort || 10) <= filters.maxEffort);
      console.log('🔍 DEBUG: After effort filter:', newFilteredIdeas.length);
    }

    console.log('🔍 DEBUG: Final filtered ideas count:', newFilteredIdeas.length);
    setFilteredIdeas(newFilteredIdeas);
  }, [ideas, filters, repos, seenIdeas]);

  // Get available languages from repos
  const availableLanguages = React.useMemo(() => {
    const languages = new Set<string>();
    repos.forEach(repo => {
      if (repo.language) {
        languages.add(repo.language);
      }
    });
    return Array.from(languages).sort();
  }, [repos]);

  // Get available idea types
  const availableIdeaTypes = React.useMemo(() => {
    const types = new Set<string>();
    ideas.forEach(idea => {
      if (idea.type) {
        types.add(idea.type);
      }
    });
    return Array.from(types).sort();
  }, [ideas]);

  // Get statistics
  const stats = React.useMemo(() => {
    const total = ideas.length;
    const newIdeas = ideas.filter(idea => !seenIdeas.has(idea.id)).length;
    const seenIdeasCount = ideas.filter(idea => seenIdeas.has(idea.id)).length;
    const manualIdeas = ideas.filter(idea => !idea.repo_id).length;
    const generatedIdeas = ideas.filter(idea => idea.repo_id).length;
    
    return { total, newIdeas, seenIdeasCount, manualIdeas, generatedIdeas };
  }, [ideas, seenIdeas]);

  useEffect(() => {
    const fetchShortlist = async () => {
      setShortlistLoading(true);
      try {
        const shortlistIdeas = await getShortlist();
        setShortlist(shortlistIdeas);
      } catch (err) {
        setShortlist([]);
      } finally {
        setShortlistLoading(false);
      }
    };
    fetchShortlist();
  }, []);

  const handleAddToShortlist = async (ideaId: string) => {
    setShortlistLoading(true);
    try {
      await addToShortlist(ideaId);
      setShortlist(prev => [...prev, ideaId]);
    } catch (err) {
      // Handle error
    } finally {
      setShortlistLoading(false);
    }
  };

  const handleRemoveFromShortlist = async (ideaId: string) => {
    setShortlistLoading(true);
    try {
      await removeFromShortlist(ideaId);
      setShortlist(prev => prev.filter(id => id !== ideaId));
    } catch (err) {
      // Handle error
    } finally {
      setShortlistLoading(false);
    }
  };

  const handleNoteSave = (ideaIndex: number, note: string) => {
    setIdeaNotes(prev => ({ ...prev, [ideaIndex]: note }));
    setEditingNotes(prev => ({ ...prev, [ideaIndex]: false }));
  };

  const getScoreColor = (score: number) => {
    if (score > 7) return 'text-green-600';
    if (score > 4) return 'text-yellow-600';
    return 'text-red-600';
  };

  const handleDeepDiveFieldChange = (ideaId: string, field: string, value: string) => {
    setEditingDeepDive(prev => ({
      ...prev,
      [ideaId]: {
        ...prev[ideaId],
        [field]: value
      }
    }));
  };

  const handleSaveAndRerun = async (idea: Idea, rerun: boolean) => {
    try {
      const updatedIdea = await createDeepDiveVersion(idea.id, editingDeepDive[idea.id], idea.deep_dive_raw_response || '');
      onIdeaUpdated(updatedIdea);
      setEditingDeepDive(prev => {
        const newState = { ...prev };
        delete newState[idea.id];
        return newState;
      });
      // Refresh versions
      const versions = await getDeepDiveVersions(idea.id);
      setVersionHistory(prev => ({ ...prev, [idea.id]: versions }));
      if (rerun) {
        setDeepDiveInProgress(idea.id);
      }
    } catch (err) {
      // Handle error
    }
  };

  const handleShowVersionHistory = async (ideaId: string) => {
    if (showVersionHistory === ideaId) {
      setShowVersionHistory(null);
    } else {
      setVersionLoading(true);
      try {
        const versions = await getDeepDiveVersions(ideaId);
        setVersionHistory(prev => ({ ...prev, [ideaId]: versions }));
        setShowVersionHistory(ideaId);
      } catch (err) {
        // Handle error
      } finally {
        setVersionLoading(false);
      }
    }
  };

  const handleRestoreVersion = async (ideaId: string, versionNumber: number) => {
    try {
      const restoredIdea = await restoreDeepDiveVersion(ideaId, versionNumber);
      onIdeaUpdated(restoredIdea);
      setShowVersionHistory(null);
      // reload page to reflect changes
      window.location.reload();
    } catch (err) {
      // Handle error
    }
  };

  const handleDeleteVersion = (ideaId: string, versionNumber: number) => {
    // Implement if needed
  };

  const handleStatusChange = async (id: string, newStatus: IdeaStatus) => {
    try {
      await onStatusChange(id, newStatus);
      setFilteredIdeas(prev =>
        prev.map(idea => (idea.id === id ? { ...idea, status: newStatus } : idea))
      );
    } catch (err: unknown) {
      if (isAxios404Error(err)) {
        alert('This idea no longer exists in the backend. It will be removed from the board.');
        setFilteredIdeas(prev => prev.filter(idea => idea.id !== id));
      } else {
        alert('Failed to update status');
      }
    }
  };

  // Group ideas by status for kanban columns
  const ideasByStatus: Record<IdeaStatus, Idea[]> = {
    suggested: [],
    deep_dive: [],
    iterating: [],
    considering: [],
    closed: [],
  };
  
  console.log('🔍 DEBUG: Processing ideas for filtering:', { 
    totalIdeas: filteredIdeas?.length || 0, 
    filters: filters,
    ideas: filteredIdeas?.map(i => ({ id: i.id, title: i.title, status: i.status, repo_id: i.repo_id, hasDeepDive: !!(i.deep_dive || i.deep_dive_raw_response) }))
  });
  
  (filteredIdeas || []).forEach(idea => {
    // The filtering is now handled in the useEffect above, so we just add all ideas to their status columns
    ideasByStatus[idea.status].push(idea);
  });
  
  console.log('🔍 DEBUG: Ideas by status after filtering:', {
    suggested: ideasByStatus.suggested.length,
    deep_dive: ideasByStatus.deep_dive.length,
    iterating: ideasByStatus.iterating.length,
    considering: ideasByStatus.considering.length,
    closed: ideasByStatus.closed.length,
    deepDiveIdeas: ideasByStatus.deep_dive.map(i => ({ id: i.id, title: i.title, hasDeepDive: !!(i.deep_dive || i.deep_dive_raw_response) }))
  });

  // Sort each column by best ideas (highest score, lowest effort)
  Object.keys(ideasByStatus).forEach(status => {
    ideasByStatus[status as IdeaStatus].sort((a, b) => {
      const scoreA = a.score ?? 0;
      const scoreB = b.score ?? 0;
      const effortA = a.mvp_effort ?? 10;
      const effortB = b.mvp_effort ?? 10;
      if (scoreB !== scoreA) return scoreB - scoreA;
      return effortA - effortB;
    });
  });

  // Drag and drop handler
  const onDragEnd = async (result: DropResult) => {
    const { source, destination, draggableId } = result;
    console.log('🔍 DEBUG: onDragEnd called with:', { source, destination, draggableId });
    
    if (!destination) {
      console.log('🔍 DEBUG: No destination, returning early');
      return;
    }
    
    const sourceStatus = source.droppableId as IdeaStatus;
    const destStatus = destination.droppableId as IdeaStatus;
    
    console.log('🔍 DEBUG: Status transition:', { sourceStatus, destStatus });
    
    if (sourceStatus === destStatus && source.index === destination.index) {
      console.log('🔍 DEBUG: Same position, returning early');
      return;
    }
    
    // Find the idea from the original ideas array, not filtered
    const idea = ideas.find(i => i.id === draggableId);
    if (!idea) {
      console.error('❌ ERROR: Could not find idea with id:', draggableId);
      return;
    }
    
    console.log('🔍 DEBUG: Found idea:', { id: idea.id, title: idea.title, currentStatus: idea.status });
    console.log('🔍 DEBUG: Kanban move:', { id: idea.id, title: idea.title, from: sourceStatus, to: destStatus });
    
    // Optimistically update UI immediately
    const optimisticUpdate = (ideaId: string, updates: Partial<Idea>) => {
      setFilteredIdeas(prev => prev.map(i => i.id === ideaId ? { ...i, ...updates } : i));
    };
    
    // For deep dive transitions, immediately move the card and show loading state
    if (destStatus === 'deep_dive') {
      optimisticUpdate(idea.id, { 
        status: destStatus, 
        deepDiveStatus: 'loading' 
      });
      
      // Show immediate feedback toast
      toast({
        title: 'Deep Dive Started',
        description: `"${idea.title}" is being analyzed. This may take a few minutes...`,
      });
    } else {
      // For other transitions, just update the status
      optimisticUpdate(idea.id, { status: destStatus });
    }
    
    try {
      console.log('🔍 DEBUG: Calling onStatusChange with:', { ideaId: idea.id, newStatus: destStatus });
      // Update status in backend
      await onStatusChange(idea.id, destStatus);
      console.log('🔍 DEBUG: Status change completed successfully');
      
      // Handle different business tasks based on destination status
      const requiredTasks = getRequiredTasksForTransition(sourceStatus, destStatus);
      
      if (requiredTasks.length > 0) {
        console.log('🔍 DEBUG: Required tasks for transition:', requiredTasks);
        
        // For deep dive, start polling for completion
        if (destStatus === 'deep_dive') {
          // Start polling for deep dive completion
          const pollDeepDive = async (retries = 30) => {
            console.log('🔍 DEBUG: Starting deep dive polling for idea:', idea.id);
            for (let i = 0; i < retries; i++) {
              try {
                console.log(`🔍 DEBUG: Polling attempt ${i + 1}/${retries}`);
                const updated = await getIdeaById(idea.id);
                
                if ((updated.deep_dive_raw_response && updated.deep_dive_raw_response.length > 0) || 
                    (updated.deep_dive && Object.keys(updated.deep_dive).length > 0)) {
                  console.log('🔍 DEBUG: Deep dive completed');
                  // Update the card with the completed deep dive
                  optimisticUpdate(idea.id, { 
                    deepDiveStatus: 'ready',
                    deep_dive: updated.deep_dive,
                    deep_dive_raw_response: updated.deep_dive_raw_response
                  });
                  
                  toast({
                    title: 'Deep Dive Complete',
                    description: `"${idea.title}" analysis is ready!`,
                  });
                  return;
                }
                
                await new Promise(res => setTimeout(res, 2000));
              } catch (error) {
                console.error('❌ ERROR: Error polling for deep dive:', error);
                break;
              }
            }
            
            // If we get here, the deep dive didn't complete in time
            console.warn('⚠️ WARNING: Deep dive polling timed out');
            optimisticUpdate(idea.id, { deepDiveStatus: 'error' });
            toast({
              title: 'Deep Dive Timeout',
              description: `"${idea.title}" analysis is taking longer than expected. You can retry from the idea details.`,
              variant: 'destructive',
            });
          };
          
          // Start polling in the background
          pollDeepDive();
        } else {
          // Show appropriate toast based on the transition
          const getTransitionToast = () => {
            if (sourceStatus === 'suggested' && destStatus === 'considering') {
              return {
                title: 'Comprehensive Analysis Started',
                description: `"${idea.title}" is being fully analyzed. This may take a few minutes...`,
              };
            } else if (sourceStatus === 'suggested' && destStatus === 'iterating') {
              return {
                title: 'Analysis & Development Started',
                description: `"${idea.title}" is being analyzed and prepared for development...`,
              };
            } else if (sourceStatus === 'suggested' && destStatus === 'closed') {
              return {
                title: 'Full Analysis & Closure Started',
                description: `"${idea.title}" is being fully analyzed before closure...`,
              };
            } else {
              return {
                title: `${destStatus.charAt(0).toUpperCase() + destStatus.slice(1)} Started`,
                description: `"${idea.title}" is being processed...`,
              };
            }
          };
          
          const initialToast = getTransitionToast();
          toast(initialToast);
          
          try {
            await executeCascadingTasks(idea, requiredTasks);
            console.log('🔍 DEBUG: All cascading tasks completed successfully');
            
            // Show completion toast
            const getCompletionToast = () => {
              if (sourceStatus === 'suggested' && destStatus === 'considering') {
                return {
                  title: 'Comprehensive Analysis Complete',
                  description: `"${idea.title}" has been fully analyzed and is ready for evaluation!`,
                };
              } else if (sourceStatus === 'suggested' && destStatus === 'iterating') {
                return {
                  title: 'Development Ready',
                  description: `"${idea.title}" has been analyzed and is ready for active development!`,
                };
              } else if (sourceStatus === 'suggested' && destStatus === 'closed') {
                return {
                  title: 'Full Analysis & Closure Complete',
                  description: `"${idea.title}" has been fully analyzed and archived.`,
                };
              } else {
                return {
                  title: `${destStatus.charAt(0).toUpperCase() + destStatus.slice(1)} Complete`,
                  description: `"${idea.title}" has been processed successfully!`,
                };
              }
            };
            
            toast(getCompletionToast());
            
          } catch (cascadeError) {
            console.error('❌ ERROR: Cascading tasks failed:', cascadeError);
            toast({
              title: 'Processing Incomplete',
              description: 'Some tasks failed. You can retry individual steps from the idea details.',
              variant: 'destructive',
            });
          }
        }
      } else {
        // No tasks required, just show a simple status change toast
        if (sourceStatus !== destStatus) {
          toast({
            title: 'Status Updated',
            description: `"${idea.title}" moved to ${destStatus.replace('_', ' ')}`,
          });
        }
      }
    } catch (err) {
      console.error('❌ ERROR: Status update failed:', err);
      // Revert on error
      optimisticUpdate(idea.id, { status: sourceStatus, deepDiveStatus: undefined });
      toast({
        title: 'Failed to update status.',
        description: err instanceof Error ? err.message : 'Unknown error occurred',
        variant: 'destructive',
      });
    }
  };

  function isAxios404Error(err: unknown): err is AxiosError {
    return (
      typeof err === 'object' &&
      err !== null &&
      'response' in err &&
      (err as AxiosError).response !== undefined &&
      (err as AxiosError).response?.status === 404
    );
  }

  // When a card is clicked, open the modal
  const handleCardClick = async (idea: Idea) => {
    markIdeaAsSeen(idea.id);
    setModalLoading(true);
    try {
      const freshIdea = await getIdeaById(idea.id);
      setModalIdea(freshIdea);
    } catch (error) {
      setModalIdea(idea); // fallback to stale idea if fetch fails
    } finally {
      setModalLoading(false);
    }
  };

  // Helper function to determine required tasks based on status transition
  const getRequiredTasksForTransition = (fromStatus: IdeaStatus, toStatus: IdeaStatus): string[] => {
    const taskMap: Record<string, string[]> = {
      'suggested->deep_dive': ['deep_dive'],
      'suggested->iterating': ['deep_dive', 'iteration'],
      'suggested->considering': ['deep_dive', 'iteration', 'consideration'],
      'suggested->closed': ['deep_dive', 'iteration', 'consideration', 'closure'],
      'deep_dive->iterating': ['iteration'],
      'deep_dive->considering': ['iteration', 'consideration'],
      'deep_dive->closed': ['iteration', 'consideration', 'closure'],
      'iterating->considering': ['consideration'],
      'iterating->closed': ['consideration', 'closure'],
      'considering->closed': ['closure']
    };
    
    const key = `${fromStatus}->${toStatus}`;
    return taskMap[key] || [];
  };

  // Helper function to execute cascading tasks
  const executeCascadingTasks = async (idea: Idea, tasks: string[]): Promise<void> => {
    console.log('🔍 DEBUG: Executing cascading tasks:', tasks);
    
    for (const task of tasks) {
      console.log(`🔍 DEBUG: Executing task: ${task}`);
      
      switch (task) {
        case 'deep_dive': {
          await onDeepDive(idea.id);
          setFilteredIdeas(prev => prev.map(i => i.id === idea.id ? { ...i, deep_dive_requested: true } : i));
          
          // Poll for deep dive completion
          const pollDeepDive = async (retries = 30) => {
            console.log('🔍 DEBUG: Starting deep dive polling for idea:', idea.id);
            for (let i = 0; i < retries; i++) {
              try {
                console.log(`🔍 DEBUG: Polling attempt ${i + 1}/${retries}`);
                const updated = await getIdeaById(idea.id);
                
                if ((updated.deep_dive_raw_response && updated.deep_dive_raw_response.length > 0) || 
                    (updated.deep_dive && Object.keys(updated.deep_dive).length > 0)) {
                  console.log('🔍 DEBUG: Deep dive completed');
                  return;
                }
                
                await new Promise(res => setTimeout(res, 2000));
              } catch (error) {
                console.error('❌ ERROR: Error polling for deep dive:', error);
                break;
              }
            }
            
            console.log('🔍 DEBUG: Polling timeout reached');
          };
          
          await pollDeepDive();
          break;
        }
          
        case 'iteration':
          await triggerIterationTasks(idea.id);
          break;
          
        case 'consideration':
          await triggerConsiderationTasks(idea.id);
          break;
          
        case 'closure':
          await triggerClosureTasks(idea.id);
          break;
          
        default:
          console.warn(`🔍 WARNING: Unknown task type: ${task}`);
      }
    }
  };

  return (
    <div className="space-y-6">
      <IdeaFilterBar
        filters={filters}
        setFilters={setFilters}
        availableLanguages={availableLanguages}
        availableIdeaTypes={availableIdeaTypes}
        showToggles={true}
        stats={stats}
      />

      {filteredIdeas.length === 1 && (
        <div className="mb-4">
          <Card className="bg-blue-50 border-blue-200">
            <CardHeader>
              <CardTitle>Welcome to Your First Idea!</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-sm text-blue-900">
                Based on this and your profile, we'll generate and suggest ideas for you to evaluate.<br />
                You'll see ideas tailored to your interests, goals, and preferences.<br />
                Move ideas through the workflow to explore, iterate, and decide what to pursue.<br />
                <span className="font-semibold">Tip:</span> As you interact with ideas, the system will learn and improve its suggestions.
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          <span className="ml-2 text-gray-600">Loading ideas...</span>
        </div>
      ) : (
        <DragDropContext onDragEnd={onDragEnd}>
          <div className="overflow-x-auto">
            <div className="flex gap-2 w-full" style={{ minWidth: 0 }}>
              {LIFECYCLE_STAGES.map(stage => (
                <Droppable droppableId={stage.key} key={stage.key}>
                  {(provided, snapshot): ReactElement => (
                    <div
                      ref={provided.innerRef}
                      {...provided.droppableProps}
                      className={`flex-1 flex-shrink flex-grow min-w-0 bg-slate-100 rounded-xl border border-slate-200 shadow-sm p-2 flex flex-col max-h-[80vh] transition-colors duration-200 ${snapshot.isDraggingOver ? 'bg-blue-100 border-blue-400' : ''}`}
                      style={{ flexBasis: 0 }}
                    >
                      <div className="flex items-center justify-between mb-2 text-xs font-semibold text-slate-700">
                        <span>{stage.label}</span>
                        <span className="bg-slate-300 text-xs rounded px-2 py-0.5">{ideasByStatus[stage.key].length}</span>
                        <span
                          className="ml-2 text-slate-400 text-base font-bold cursor-not-allowed select-none"
                          title="Adding ideas from here coming soon"
                          aria-label="Add idea (coming soon)"
                        >
                          +
                        </span>
                      </div>
                      <div className="flex-1 overflow-y-auto flex flex-col space-y-2">
                        {ideasByStatus[stage.key].length === 0 ? (
                          <div className="text-slate-400 text-xs text-center py-2 col-span-full">No ideas</div>
                        ) : (
                          ideasByStatus[stage.key].map((idea, idx) => (
                            <Draggable
                              key={idea.id}
                              draggableId={idea.id}
                              index={idx}
                              isDragDisabled={idea.status === 'closed'}
                            >
                              {(provided, snapshot): ReactElement => {
                                if (!seenIdeas.has(idea.id)) {
                                  setTimeout(() => markIdeaAsSeen(idea.id), 0);
                                }
                                return (
                                  <div
                                    ref={provided.innerRef}
                                    {...provided.draggableProps}
                                    {...provided.dragHandleProps}
                                    className={`bg-white border border-slate-200 rounded-md shadow flex flex-col transition-all duration-200 ease-in-out cursor-grab active:cursor-grabbing
                                      ${snapshot.isDragging ? 'ring-2 ring-blue-400 scale-105 opacity-90 z-50 shadow-2xl' : ''}
                                      ${!seenIdeas.has(idea.id) ? 'ring-2 ring-green-400 bg-green-50' : ''}
                                      hover:shadow-md
                                    `}
                                    style={{
                                      fontSize: '0.85rem',
                                      padding: '0.5rem',
                                      minWidth: '300px',
                                      minHeight: '120px',
                                      maxWidth: '340px',
                                      ...provided.draggableProps.style
                                    }}
                                    aria-label={snapshot.isDragging ? 'Dragging idea card' : 'Idea card'}
                                    tabIndex={0}
                                  >
                                    {idea.deepDiveStatus === 'loading' && (
                                      <div className="absolute top-2 right-2 flex items-center gap-1 z-10">
                                        <div className="animate-spin rounded-full h-3 w-3 border-2 border-blue-500 border-t-transparent"></div>
                                        <span className="text-xs text-blue-600 font-medium">Analyzing...</span>
                                      </div>
                                    )}
                                    <div className="flex items-center justify-between mb-1">
                                      <button
                                        className="text-blue-700 hover:underline font-semibold text-sm truncate text-left bg-transparent border-none p-0 m-0 cursor-pointer"
                                        style={{ maxWidth: '140px', appearance: 'none' }}
                                        onClick={async e => {
                                          e.stopPropagation();
                                          if (idea.deepDiveStatus === 'loading') {
                                            return;
                                          }
                                          await handleCardClick(idea);
                                        }}
                                        title={idea.title}
                                      >
                                        {idea.title}
                                      </button>
                                      {idea.status === 'suggested' && <Lightbulb className="h-4 w-4 text-blue-500" />}
                                      {idea.status === 'deep_dive' && <Brain className="h-4 w-4 text-purple-500" />}
                                      {idea.status === 'iterating' && <Rocket className="h-4 w-4 text-orange-500" />}
                                      {idea.status === 'considering' && <Target className="h-4 w-4 text-green-500" />}
                                      {idea.status === 'closed' && <CheckCircle className="h-4 w-4 text-gray-500" />}
                                    </div>
                                    <div className="flex items-center gap-1 mb-1 flex-wrap">
                                      <Badge className={`h-5 px-2 py-0.5 text-xs ${getEffortColor(idea.mvp_effort || 5)}`}>Effort: {idea.mvp_effort ?? '?'}</Badge>
                                      <Badge variant="outline" className="h-5 px-2 py-0.5 text-xs">Score: {idea.score ?? '?'}</Badge>
                                      {idea.type && <Badge variant="secondary" className="h-5 px-2 py-0.5 text-xs">{idea.type}</Badge>}
                                    </div>
                                    <div className="text-xs text-gray-700 line-clamp-3 whitespace-pre-line flex-1 min-h-[2.5em]">
                                      {idea.hook || 'No elevator pitch.'}
                                    </div>
                                    {modalLoading && modalIdea?.id === idea.id && (
                                      <div className="absolute inset-0 flex items-center justify-center bg-white bg-opacity-70 z-20">
                                        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
                                      </div>
                                    )}
                                  </div>
                                );
                              }}
                            </Draggable>
                          ))
                        )}
                        {provided.placeholder}
                      </div>
                    </div>
                  )}
                </Droppable>
              ))}
            </div>
          </div>
        </DragDropContext>
      )}
    </div>
  );
}
