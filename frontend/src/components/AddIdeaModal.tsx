import { useState, useEffect, useContext } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { api } from "@/lib/api";
import { useAuth } from '@/contexts/AuthContext';
import { Sparkles, Brain, Globe, Target, Zap, Lightbulb, CheckCircle } from 'lucide-react';

const INDUSTRIES = ["Technology", "Healthcare", "Finance", "Education", "Entertainment", "Retail", "Travel"];
const BUSINESS_MODELS = ["SaaS", "Marketplace", "E-commerce", "API as a Service", "Open Source"];

interface AddIdeaModalProps {
  isOpen: boolean;
  onClose: () => void;
  onIdeaCreated: () => void;
}

export const AddIdeaModal = ({ isOpen, onClose, onIdeaCreated }: AddIdeaModalProps) => {
  const [activeTab, setActiveTab] = useState("ai-suggested");
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();
  const { user } = useAuth();

  // State for AI-Suggested Idea
  const [industry, setIndustry] = useState("");
  const [businessModel, setBusinessModel] = useState("");
  const [freeform, setFreeform] = useState("");
  const [usePersonalization, setUsePersonalization] = useState(true);

  // State for Bring Your Own Idea
  const [userIdea, setUserIdea] = useState({
    title: "",
    hook: "",
    value: "",
    evidence: "",
    differentiator: "",
    call_to_action: "",
  });

  const hasCompletedOnboarding = user?.profile?.onboarding_completed ?? false;

  useEffect(() => {
    if (user && !hasCompletedOnboarding) {
      setUsePersonalization(false);
    }
  }, [user, hasCompletedOnboarding]);

  const handleGenerate = async () => {
    setLoading(true);
    try {
      const response = await api.post('/ideas/generate', {
        industry,
        business_model: businessModel,
        context: freeform,
        use_personalization: usePersonalization,
      });
      toast({
        title: "Ideas Generated!",
        description: "Your new ideas have been added to your workspace.",
      });
      onIdeaCreated();
      onClose();
    } catch (error) {
      toast({
        title: "Generation Failed",
        description: "Could not generate ideas. Please try again.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleCreateOwnIdea = async () => {
    if (!userIdea.title) {
      toast({
        title: "Title is Required",
        description: "Please provide a title for your idea.",
        variant: "destructive",
      });
      return;
    }
    setLoading(true);
    try {
      // The validation endpoint actually creates an idea, so it works perfectly here.
      await api.post('/ideas/validate', {
        idea_data: userIdea,
        use_personalization: usePersonalization,
      });
      toast({
        title: "Idea Created!",
        description: "Your new idea has been added to your workspace for analysis.",
      });
      onIdeaCreated();
      onClose();
    } catch (error) {
      toast({
        title: "Creation Failed",
        description: "Could not save your idea. Please try again.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };


  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[625px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Lightbulb className="h-6 w-6 text-primary" />
            Add a New Idea
          </DialogTitle>
          <DialogDescription>
            Choose a method to generate or create your next big idea.
          </DialogDescription>
        </DialogHeader>
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="ai-suggested">
              <Sparkles className="mr-2 h-4 w-4" /> AI-Suggested
            </TabsTrigger>
            <TabsTrigger value="bring-your-own">
              <Target className="mr-2 h-4 w-4" /> Bring Your Own
            </TabsTrigger>
          </TabsList>
          
          <TabsContent value="ai-suggested" className="pt-4">
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Let our AI craft ideas tailored to your profile and interests.
              </p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-foreground mb-1">Industry</label>
                  <select value={industry} onChange={e => setIndustry(e.target.value)} className="w-full border-input bg-background text-foreground border rounded-md px-3 py-2 text-sm">
                    <option value="">Any</option>
                    {INDUSTRIES.map(ind => <option key={ind} value={ind}>{ind}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-foreground mb-1">Business Model</label>
                  <select value={businessModel} onChange={e => setBusinessModel(e.target.value)} className="w-full border-input bg-background text-foreground border rounded-md px-3 py-2 text-sm">
                    <option value="">Any</option>
                    {BUSINESS_MODELS.map(model => <option key={model} value={model}>{model}</option>)}
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">
                  Additional Context (Optional)
                </label>
                <textarea value={freeform} onChange={e => setFreeform(e.target.value)} className="w-full border-input bg-background text-foreground border rounded-md px-3 py-2 text-sm" rows={2} placeholder="e.g., focus on tools for remote developers..." />
              </div>
              <Button onClick={handleGenerate} disabled={loading} className="w-full">
                {loading ? "Generating..." : "Generate Ideas"}
              </Button>
            </div>
          </TabsContent>

          <TabsContent value="bring-your-own" className="pt-4">
            <div className="space-y-3">
               <p className="text-sm text-muted-foreground">
                Input the core components of your idea for validation and refinement.
              </p>
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">Idea Title *</label>
                <input type="text" value={userIdea.title} onChange={e => setUserIdea(prev => ({ ...prev, title: e.target.value }))} className="w-full border-input bg-background text-foreground border rounded-md px-3 py-2 text-sm" placeholder="e.g., AI-Powered Code Review Assistant" />
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">Hook</label>
                <textarea value={userIdea.hook} onChange={e => setUserIdea(prev => ({ ...prev, hook: e.target.value }))} className="w-full border-input bg-background text-foreground border rounded-md px-3 py-2 text-sm" rows={2} placeholder="A catchy one-liner to grab attention." />
              </div>
               <div>
                <label className="block text-sm font-medium text-foreground mb-1">Value Proposition</label>
                <textarea value={userIdea.value} onChange={e => setUserIdea(prev => ({ ...prev, value: e.target.value }))} className="w-full border-input bg-background text-foreground border rounded-md px-3 py-2 text-sm" rows={2} placeholder="What is the primary value your idea provides?" />
              </div>
              <Button onClick={handleCreateOwnIdea} disabled={loading} className="w-full">
                {loading ? "Creating..." : "Create and Validate Idea"}
              </Button>
            </div>
          </TabsContent>

        </Tabs>
      </DialogContent>
    </Dialog>
  );
}; 