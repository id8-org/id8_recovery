import React, { useState } from 'react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { api, uploadResume, processResume } from '@/lib/api';
import { 
  User, 
  MapPin, 
  Briefcase, 
  Target, 
  Heart, 
  Settings, 
  CheckCircle,
  ArrowRight,
  ArrowLeft,
  AlertCircle
} from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

interface OnboardingWizardProps {
  onComplete: () => void;
}

export const SKILLS_OPTIONS = [
  'Product Management', 'Software Development', 'Marketing', 'Sales', 'Design',
  'Data Analysis', 'AI/ML', 'Business Development', 'Customer Service', 'Finance',
  'Operations', 'Research', 'Writing', 'Public Speaking', 'Project Management'
];

export const INDUSTRIES_OPTIONS = [
  'Technology', 'Healthcare', 'Finance', 'Education', 'E-commerce', 'Real Estate',
  'Entertainment', 'Food & Beverage', 'Travel', 'Fitness', 'Fashion', 'Automotive',
  'Manufacturing', 'Consulting', 'Non-profit', 'Government'
];

export const BUSINESS_MODELS = [
  'SaaS/Subscription', 'Marketplace', 'E-commerce', 'Freemium', 'Consulting',
  'Advertising', 'Franchise', 'Licensing', 'Direct Sales', 'Affiliate'
];

export const RISK_TOLERANCE_OPTIONS = [
  { value: 'low', label: 'Low Risk', description: 'Prefer stable, proven concepts' },
  { value: 'medium', label: 'Medium Risk', description: 'Balance of innovation and stability' },
  { value: 'high', label: 'High Risk', description: 'Willing to try bold, innovative ideas' }
];

export const TIME_AVAILABILITY_OPTIONS = [
  { value: 'part_time', label: 'Part-time', description: 'Evenings and weekends' },
  { value: 'full_time', label: 'Full-time', description: 'Can dedicate full attention' },
  { value: 'weekends_only', label: 'Weekends Only', description: 'Limited time availability' }
];

export const OnboardingWizard: React.FC<OnboardingWizardProps> = ({ onComplete }) => {
  const [currentStep, setCurrentStep] = useState(1);
  const [isLoading, setIsLoading] = useState(false);
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    bio: '',
    location: '',
    industry: '',
    yearsExperience: '',
    skills: [] as string[],
    industries: [] as string[],
    interests: [] as string[],
    goals: [] as string[],
    preferredBusinessModels: [] as string[],
    preferredIndustries: [] as string[],
    riskTolerance: '',
    timeAvailability: '',
    intent: '',
    accountType: 'solo',
    teamInvites: [] as string[],
    _inviteInput: '',
  });

  const { user, updateProfile, config } = useAuth();
  const { toast } = useToast();

  const totalSteps = 8;
  const progress = (currentStep / totalSteps) * 100;

  const [resumeFile, setResumeFile] = useState<File | null>(null);
  const [resumeUploadStatus, setResumeUploadStatus] = useState<'idle' | 'uploading' | 'success' | 'error' | 'skipped'>('idle');
  const [resumeError, setResumeError] = useState<string | null>(null);

  const [customIndustry, setCustomIndustry] = useState('');

  const [privacyChecked, setPrivacyChecked] = useState(false);
  const [termsChecked, setTermsChecked] = useState(false);

  const resumeUploaded = resumeUploadStatus === 'success';

  const handleInputChange = (field: string, value: string | string[]) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const toggleArrayItem = (field: string, item: string) => {
    setFormData(prev => {
      const currentArray = prev[field as keyof typeof prev] as string[];
      const newArray = currentArray.includes(item)
        ? currentArray.filter(i => i !== item)
        : [...currentArray, item];
      return { ...prev, [field]: newArray };
    });
  };

  const handleResumeUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setResumeFile(file);
    setResumeUploadStatus('uploading');
    setResumeError(null);
    try {
      await uploadResume(file);
      // Now process the resume and get extracted fields
      const processed = await processResume();
      setResumeUploadStatus('success');
      const extracted = processed.extracted || {};
      setFormData(prev => ({
        ...prev,
        firstName: extracted.first_name || prev.firstName,
        lastName: extracted.last_name || prev.lastName,
        location: extracted.location || prev.location,
        industry: extracted.industry || prev.industry,
        bio: extracted.bio || prev.bio,
        skills: Array.isArray(extracted.skills) ? extracted.skills : (Array.isArray(extracted.extracted_skills) ? extracted.extracted_skills : prev.skills),
        industries: Array.isArray(extracted.industries) ? extracted.industries : prev.industries,
        // Optionally: work_experience, education, etc. can be stored in state if you want to show/edit them
      }));
    } catch (err: unknown) {
      setResumeUploadStatus('error');
      setResumeError(err instanceof Error ? err.message : 'Failed to process resume');
    }
  };

  const renderMappedSummary = () => (
    <div className="mb-2">
      {(formData.skills.length > 0 || formData.industries.length > 0) && (
        <div className="bg-blue-50 border border-blue-200 rounded p-2 mb-2 text-xs text-blue-900">
          <b>We mapped these skills and industries from your resume.</b> You can add, remove, or edit as needed.
        </div>
      )}
      {formData.skills.length > 0 && (
        <div className="mb-1">
          <Label>Skills</Label>
          <div className="flex flex-wrap gap-1 mb-1">
            {formData.skills.map(skill => (
              <Badge key={skill} className="bg-blue-100 text-blue-800 cursor-pointer" onClick={() => toggleArrayItem('skills', skill)}>
                {skill} <span className="ml-1">×</span>
              </Badge>
            ))}
          </div>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-1">
            {SKILLS_OPTIONS.filter(skill => !formData.skills.includes(skill)).map(skill => (
              <Button
                key={skill}
                type="button"
                variant="outline"
                size="sm"
                onClick={() => toggleArrayItem('skills', skill)}
                className="justify-start"
              >
                {`+ ${skill}`}
              </Button>
            ))}
          </div>
        </div>
      )}
      {formData.industries.length > 0 && (
        <div className="mb-1">
          <Label>Industries</Label>
          <div className="flex flex-wrap gap-1 mb-1">
            {formData.industries.map(industry => (
              <Badge key={industry} className="bg-green-100 text-green-800 cursor-pointer" onClick={() => toggleArrayItem('industries', industry)}>
                {industry} <span className="ml-1">×</span>
              </Badge>
            ))}
          </div>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-1">
            {INDUSTRIES_OPTIONS.filter(industry => !formData.industries.includes(industry)).map(industry => (
              <Button
                key={industry}
                type="button"
                variant="outline"
                size="sm"
                onClick={() => toggleArrayItem('industries', industry)}
                className="justify-start"
              >
                {`+ ${industry}`}
              </Button>
            ))}
          </div>
        </div>
      )}
    </div>
  );

  const renderStep1 = () => (
    <div className="space-y-4">
      <div className="flex flex-col md:flex-row md:items-center md:gap-4 mb-2">
        <div className="flex-1">
          <Label htmlFor="resume-upload">Upload Resume (Required)</Label>
          <Input id="resume-upload" type="file" accept=".pdf,.doc,.docx,.txt" onChange={handleResumeUpload} disabled={resumeUploadStatus === 'uploading'} />
          {resumeUploadStatus === 'uploading' && <span className="text-xs text-blue-600 ml-2">Uploading...</span>}
          {resumeUploadStatus === 'success' && <span className="text-xs text-green-600 ml-2">Uploaded!</span>}
          {resumeUploadStatus === 'skipped' && <span className="text-xs text-yellow-600 ml-2">Skipped (manual entry)</span>}
          {resumeError && <span className="text-xs text-red-600 ml-2">{resumeError}</span>}
        </div>
        <div className="flex-1 text-xs text-muted-foreground mt-2 md:mt-0">
          <span>Uploading your resume will help us personalize your experience and generate better ideas. <b>Required to continue.</b></span>
        </div>
      </div>
      <div className="flex items-center gap-2 mt-2">
        <Button
          type="button"
          variant="outline"
          className="text-yellow-700 border-yellow-400 hover:bg-yellow-50"
          onClick={() => setResumeUploadStatus('skipped')}
        >
          Skip / Continue without Resume (not advised)
        </Button>
        <span className="text-xs text-yellow-700">You will need to enter all information manually.</span>
      </div>
    </div>
  );

  const renderStep2 = () => (
    <div className="space-y-4">
      {renderMappedSummary()}
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1">
          <Label htmlFor="firstName">First Name</Label>
          <Input
            id="firstName"
            value={formData.firstName}
            onChange={(e) => handleInputChange('firstName', e.target.value)}
            placeholder="Your first name"
            autoComplete="given-name"
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor="lastName">Last Name</Label>
          <Input
            id="lastName"
            value={formData.lastName}
            onChange={(e) => handleInputChange('lastName', e.target.value)}
            placeholder="Your last name"
            autoComplete="family-name"
          />
        </div>
        <div className="col-span-2 space-y-1">
          <Label htmlFor="location">Location</Label>
          <div className="relative">
            <MapPin className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
            <Input
              id="location"
              value={formData.location}
              onChange={(e) => handleInputChange('location', e.target.value)}
              placeholder="City, State/Country"
              className="pl-10"
              autoComplete="address-level2"
            />
          </div>
        </div>
        {!resumeUploaded && (
          <><div className="col-span-2 space-y-1">
            <Label htmlFor="industry">Primary Industry (Optional)</Label>
            <Select value={formData.industry} onValueChange={(value) => handleInputChange('industry', value)}>
              <SelectTrigger>
                <SelectValue placeholder="Select your primary industry" />
              </SelectTrigger>
              <SelectContent>
                {INDUSTRIES_OPTIONS.map((industry) => (
                  <SelectItem key={industry} value={industry}>
                    {industry}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="col-span-2 space-y-1">
            <Label htmlFor="yearsExperience">Years of Experience (Optional)</Label>
            <Input id="yearsExperience" type="number" min="0" value={formData.yearsExperience} onChange={e => handleInputChange('yearsExperience', e.target.value)} placeholder="e.g. 5" />
          </div></>
        )}
        <div className="col-span-2 space-y-1">
          <Label htmlFor="bio">Bio (Optional)</Label>
          <Textarea
            id="bio"
            value={formData.bio}
            onChange={(e) => handleInputChange('bio', e.target.value)}
            placeholder="Tell us a bit about yourself..."
            rows={2}
          />
        </div>
      </div>
    </div>
  );

  const renderAccountTypeStep = () => (
    <div className="space-y-4">
      <Label>Account Type</Label>
      <div className="flex gap-4">
        <Button
          type="button"
          variant={formData.accountType === 'solo' ? 'default' : 'outline'}
          onClick={() => setFormData(prev => ({ ...prev, accountType: 'solo' }))}
        >
          Solo (Just Me)
        </Button>
        <Button
          type="button"
          variant={formData.accountType === 'team' ? 'default' : 'outline'}
          onClick={() => setFormData(prev => ({ ...prev, accountType: 'team' }))}
        >
          Team (Invite Others)
        </Button>
      </div>
      {formData.accountType === 'team' && (
        <div className="mt-4">
          <Label>Invite Team Members (by email)</Label>
          <div className="text-xs text-gray-500 mb-2">You can invite up to {config?.max_team_members || 5} team members. They'll receive an email to join your workspace.</div>
          <div className="flex gap-2 mb-2 flex-wrap">
            <Input
              type="email"
              placeholder="Enter email address"
              value={formData._inviteInput || ''}
              onChange={e => setFormData(prev => ({ ...prev, _inviteInput: e.target.value }))}
              className="w-64"
            />
            <Button
              type="button"
              onClick={() => {
                if (formData._inviteInput && /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(formData._inviteInput)) {
                  if (formData.teamInvites.length < (config?.max_team_members || 5)) {
                    setFormData(prev => ({
                      ...prev,
                      teamInvites: [...prev.teamInvites, prev._inviteInput],
                      _inviteInput: '',
                    }));
                  } else {
                    toast({ title: 'Team limit reached', description: `You can invite up to ${config?.max_team_members || 5} members.`, variant: 'destructive' });
                  }
                } else {
                  toast({ title: 'Invalid email', description: 'Please enter a valid email address.', variant: 'destructive' });
                }
              }}
            >
              Add
            </Button>
          </div>
          <ul className="list-disc pl-6">
            {formData.teamInvites.map((email, idx) => (
              <li key={email} className="flex items-center gap-2">
                <span className="text-sm">{email}</span>
                <Button type="button" size="sm" variant="ghost" onClick={() => setFormData(prev => ({ ...prev, teamInvites: prev.teamInvites.filter((e, i) => i !== idx) }))}>Remove</Button>
              </li>
            ))}
          </ul>
          {/* TODO: Show invite status from backend if available */}
        </div>
      )}
    </div>
  );

  const renderStep3 = () => (
    <div className="space-y-4">
      <Label>Skills (Select or add your own)</Label>
      <div className="flex flex-wrap gap-1 mb-1">
        {formData.skills.map(skill => (
          <Badge key={skill} className="bg-blue-100 text-blue-800 cursor-pointer" onClick={() => toggleArrayItem('skills', skill)}>{skill} <span className="ml-1">×</span></Badge>
        ))}
      </div>
      <div className="grid grid-cols-2 md:grid-cols-3 gap-1 mb-1">
        {SKILLS_OPTIONS.filter(skill => !formData.skills.includes(skill)).map(skill => (
          <Button key={skill} type="button" variant="outline" size="sm" onClick={() => toggleArrayItem('skills', skill)} className="justify-start">{`+ ${skill}`}</Button>
        ))}
      </div>
      <Input value={customIndustry} onChange={e => setCustomIndustry(e.target.value)} placeholder="Add custom skill" className="h-8 text-xs mt-2" />
      <Button type="button" size="sm" variant="default" className="h-8 px-3 mt-1" onClick={() => { if (customIndustry && !formData.skills.includes(customIndustry)) { toggleArrayItem('skills', customIndustry); setCustomIndustry(''); } }}>Add</Button>
    </div>
  );

  const renderStep4 = () => (
    <div className="space-y-4">
      <div className="text-base font-semibold mb-1">Tell us what you're into!</div>
      <div className="text-sm text-muted-foreground mb-2">
        The more you share about your interests, the better we can suggest ideas you'll love. Select as many as you like, or add your own.
      </div>
      <Label>Interests</Label>
      <div className="flex flex-wrap gap-1 mb-1">
        {formData.interests.map(interest => (
          <Badge key={interest} className="bg-green-100 text-green-800 cursor-pointer" onClick={() => toggleArrayItem('interests', interest)}>{interest} <span className="ml-1">×</span></Badge>
        ))}
      </div>
      <div className="grid grid-cols-2 md:grid-cols-3 gap-1 mb-1">
        {['Technology', 'Healthcare', 'Education', 'Finance', 'Environment', 'Social Impact', 'Innovation', 'Business', 'Creative Arts', 'Sports', 'Travel', 'Food & Cooking', 'Fitness', 'Gaming', 'Reading', 'Music'].filter(interest => !formData.interests.includes(interest)).map(interest => (
          <Button key={interest} type="button" variant="outline" size="sm" onClick={() => toggleArrayItem('interests', interest)} className="justify-start">{`+ ${interest}`}</Button>
        ))}
      </div>
      <Input value={customIndustry} onChange={e => setCustomIndustry(e.target.value)} placeholder="Add custom interest" className="h-8 text-xs mt-2" />
      <Button type="button" size="sm" variant="default" className="h-8 px-3 mt-1" onClick={() => { if (customIndustry && !formData.interests.includes(customIndustry)) { toggleArrayItem('interests', customIndustry); setCustomIndustry(''); } }}>Add</Button>
    </div>
  );

  const renderStep5 = () => (
    <div className="space-y-4">
      <div className="text-base font-semibold mb-1">What are your goals?</div>
      <div className="text-sm text-muted-foreground mb-2">
        Your goals help us match you with the right opportunities and ideas. Select all that apply, or add your own.
      </div>
      <Label>Goals</Label>
      <div className="flex flex-wrap gap-1 mb-1">
        {formData.goals.map(goal => (
          <Badge key={goal} className="bg-purple-100 text-purple-800 cursor-pointer" onClick={() => toggleArrayItem('goals', goal)}>{goal} <span className="ml-1">×</span></Badge>
        ))}
      </div>
      <div className="grid grid-cols-2 md:grid-cols-3 gap-1 mb-1">
        {['Start a side hustle', 'Build a full-time business', 'Learn new skills', 'Network with others', 'Make an impact', 'Achieve financial freedom', 'Solve a problem', 'Innovate', 'Grow a team', 'Other'].filter(goal => !formData.goals.includes(goal)).map(goal => (
          <Button key={goal} type="button" variant="outline" size="sm" onClick={() => toggleArrayItem('goals', goal)} className="justify-start">{`+ ${goal}`}</Button>
        ))}
      </div>
      <Input value={customIndustry} onChange={e => setCustomIndustry(e.target.value)} placeholder="Add custom goal" className="h-8 text-xs mt-2" />
      <Button type="button" size="sm" variant="default" className="h-8 px-3 mt-1" onClick={() => { if (customIndustry && !formData.goals.includes(customIndustry)) { toggleArrayItem('goals', customIndustry); setCustomIndustry(''); } }}>Add</Button>
    </div>
  );

  const renderStep6 = () => (
    <div className="space-y-4">
      <div className="text-base font-semibold mb-1">Let's get specific about your preferences</div>
      <div className="text-sm text-muted-foreground mb-2">
        What industries and business models excite you? Let us know your preferences so we can tailor ideas to your interests and risk profile. The more details you share, the better we can personalize your experience.
      </div>
      <Label>Preferred Industries</Label>
      <div className="flex flex-wrap gap-1 mb-1">
        {formData.preferredIndustries.map(industry => (
          <Badge key={industry} className="bg-green-100 text-green-800 cursor-pointer" onClick={() => toggleArrayItem('preferredIndustries', industry)}>{industry} <span className="ml-1">×</span></Badge>
        ))}
      </div>
      <div className="grid grid-cols-2 md:grid-cols-3 gap-1 mb-1">
        {INDUSTRIES_OPTIONS.filter(ind => !formData.preferredIndustries.includes(ind)).map(industry => (
          <Button key={industry} type="button" variant="outline" size="sm" onClick={() => toggleArrayItem('preferredIndustries', industry)} className="justify-start">{`+ ${industry}`}</Button>
        ))}
      </div>
      <Input value={customIndustry} onChange={e => setCustomIndustry(e.target.value)} placeholder="Add custom industry" className="h-8 text-xs" />
      <Button type="button" size="sm" variant="default" className="h-8 px-3" onClick={() => { if (customIndustry && !formData.preferredIndustries.includes(customIndustry)) { toggleArrayItem('preferredIndustries', customIndustry); setCustomIndustry(''); } }}>Add</Button>
      <div className="space-y-1">
        <Label>Preferred Business Models</Label>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-1">
          {BUSINESS_MODELS.map(model => (
            <Button key={model} type="button" variant={formData.preferredBusinessModels.includes(model) ? "default" : "outline"} size="sm" onClick={() => toggleArrayItem('preferredBusinessModels', model)} className="justify-start">{formData.preferredBusinessModels.includes(model) && <CheckCircle className="w-4 h-4 mr-2" />}{model}</Button>
          ))}
        </div>
      </div>
      <div className="space-y-1">
        <Label>Risk Tolerance</Label>
        <Select value={formData.riskTolerance} onValueChange={value => handleInputChange('riskTolerance', value)}>
          <SelectTrigger>
            <SelectValue placeholder="Select your risk tolerance" />
          </SelectTrigger>
          <SelectContent>
            {RISK_TOLERANCE_OPTIONS.map(opt => (
              <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-1">
        <Label>Time Availability</Label>
        <Select value={formData.timeAvailability} onValueChange={value => handleInputChange('timeAvailability', value)}>
          <SelectTrigger>
            <SelectValue placeholder="Select your time availability" />
          </SelectTrigger>
          <SelectContent>
            {TIME_AVAILABILITY_OPTIONS.map(opt => (
              <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </div>
  );

  const renderFinalStep = () => (
    <div className="space-y-4">
      {formData.accountType === 'team' && (
        <>
          <Label>Team Setup Summary</Label>
          <div className="text-sm text-gray-700">You've invited the following team members:</div>
          <ul className="list-disc pl-6">
            {formData.teamInvites.map(email => (
              <li key={email} className="text-sm">{email} <span className="text-xs text-gray-400">(Pending)</span></li>
            ))}
          </ul>
          <div className="text-xs text-gray-500 mt-2">Invited members will receive an email to join your workspace. You can manage your team in Settings after onboarding.</div>
          <hr className="my-4" />
        </>
      )}
      <Label>Final Confirmation</Label>
      <div className="flex items-center gap-2">
        <input type="checkbox" id="privacy" checked={privacyChecked} onChange={e => setPrivacyChecked(e.target.checked)} />
        <label htmlFor="privacy">I agree to the <a href="/privacy" target="_blank" rel="noopener noreferrer" className="underline">Privacy Policy</a></label>
      </div>
      <div className="flex items-center gap-2">
        <input type="checkbox" id="terms" checked={termsChecked} onChange={e => setTermsChecked(e.target.checked)} />
        <label htmlFor="terms">I agree to the <a href="/terms" target="_blank" rel="noopener noreferrer" className="underline">Terms of Service</a></label>
      </div>
      <div className="text-xs text-muted-foreground">You must agree to both to complete your profile.</div>
    </div>
  );

  const renderCurrentStep = () => {
    switch (currentStep) {
      case 1: return renderStep1();
      case 2: return renderStep2();
      case 3: return renderAccountTypeStep();
      case 4: return renderStep3();
      case 5: return renderStep4();
      case 6: return renderStep5();
      case 7: return renderStep6();
      case 8: return renderFinalStep();
      default: return null;
    }
  };

  const handleStepSubmit = async () => {
    setIsLoading(true);
    try {
      switch (currentStep) {
        case 1:
          if (resumeUploadStatus !== 'success') {
            setIsLoading(false);
            return;
          }
          setCurrentStep(2);
          setIsLoading(false);
          return;
        case 2: {
          let locationToSend: string = '';
          if (typeof formData.location === 'object' && formData.location !== null) {
            const loc = formData.location as { city?: string; state?: string; country?: string };
            locationToSend = [loc.city, loc.state, loc.country].filter(Boolean).join(', ');
          } else if (typeof formData.location === 'string') {
            locationToSend = formData.location;
          }
          await api.post('/auth/onboarding/step1', {
            first_name: formData.firstName,
            last_name: formData.lastName,
            location: locationToSend,
            industry: formData.industry,
            years_experience:
              formData.yearsExperience === "" ? null : Number(formData.yearsExperience),
            bio: formData.bio
          });
          break;
        }
        case 3:
          await api.post('/auth/onboarding/step2', {
            skills: formData.skills
          });
          break;
        case 4:
          await api.post('/auth/onboarding/step3', {
            interests: formData.interests
          });
          break;
        case 5:
          await api.post('/auth/onboarding/step4', {
            goals: formData.goals
          });
          break;
        case 6:
          await api.post('/auth/onboarding/step5', {
            preferred_business_models: formData.preferredBusinessModels,
            preferred_industries: formData.preferredIndustries,
            risk_tolerance: formData.riskTolerance,
            time_availability: formData.timeAvailability
          });
          break;
        case 7:
          setCurrentStep(8);
          setIsLoading(false);
          return;
        case 8:
          if (!privacyChecked || !termsChecked) {
            toast({
              title: "Agreement Required",
              description: "You must agree to the Privacy Policy and Terms of Service to complete onboarding.",
              variant: "destructive",
            });
            setIsLoading(false);
            return;
          }
          await api.post('/auth/onboarding/complete', {
            ...formData,
            teamInvites: formData.accountType === 'team' ? formData.teamInvites : [],
          });
          onComplete();
          setIsLoading(false);
          return;
      }
      setCurrentStep(currentStep + 1);
    } catch (error) {
      console.error('Onboarding error:', error);
      toast({
        title: "Error",
        description: "Failed to save your information. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const canProceed = () => {
    switch (currentStep) {
      case 1:
        return resumeUploadStatus === 'success' || resumeUploadStatus === 'skipped';
      case 2:
        return formData.firstName && formData.lastName && formData.industry && formData.location;
      case 3:
        return !!formData.accountType;
      case 4:
        return formData.skills.length > 0;
      case 5:
        return formData.interests.length > 0;
      case 6:
        return formData.goals.length > 0;
      case 7:
        return formData.preferredBusinessModels.length > 0 && formData.preferredIndustries.length > 0 && formData.riskTolerance && formData.timeAvailability;
      case 8:
        return privacyChecked && termsChecked;
      default:
        return false;
    }
  };

  let logoSrc: string;
  try {
    logoSrc = require('@/assets/logo.png');
  } catch {
    logoSrc = 'https://placehold.co/120x40?text=ID8';
  }

  return (
    <div>
      <img src={logoSrc} alt="App Logo" className="mx-auto mb-4" style={{ maxWidth: '120px' }} />
      <Card className="w-full max-w-2xl mx-auto">
        <CardHeader>
          <CardTitle className="text-xl font-bold text-center">Onboarding</CardTitle>
          <CardDescription className="text-center">Let's get to know you and personalize your experience.</CardDescription>
        </CardHeader>
        <CardContent style={{ minHeight: '480px' }}>
          {renderCurrentStep()}
          
          <div className="flex justify-between mt-8">
            <Button
              variant="outline"
              onClick={() => setCurrentStep(Math.max(1, currentStep - 1))}
              disabled={currentStep === 1 || isLoading}
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              Previous
            </Button>
            
            <Button
              onClick={handleStepSubmit}
              disabled={!canProceed() || isLoading}
            >
              {isLoading ? (
                "Saving..."
              ) : currentStep === totalSteps ? (
                <>
                  Complete Setup
                  <CheckCircle className="w-4 h-4 ml-2" />
                </>
              ) : (
                <>
                  Next
                  <ArrowRight className="w-4 h-4 ml-2" />
                </>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}; 