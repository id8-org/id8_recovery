import React, { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ArrowLeft, Edit, Save, X, User, MapPin, Globe, Linkedin, Github, Briefcase, Target, Clock, CheckCircle } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useToast } from "@/hooks/use-toast";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { SKILLS_OPTIONS, INDUSTRIES_OPTIONS, BUSINESS_MODELS, RISK_TOLERANCE_OPTIONS, TIME_AVAILABILITY_OPTIONS } from '@/components/onboarding/OnboardingWizard';
import { uploadResume } from '@/lib/api';

const Profile = () => {
  const { user, updateProfile } = useAuth();
  const { toast } = useToast();
  const [isEditing, setIsEditing] = useState(false);
  const [loading, setLoading] = useState(false);
  
  // Form state
  const [formData, setFormData] = useState({
    bio: user?.profile?.bio || '',
    location: user?.profile?.location || '',
    website: user?.profile?.website || '',
    linkedin_url: user?.profile?.linkedin_url || '',
    github_url: user?.profile?.github_url || '',
    experience_years: user?.profile?.experience_years || 0,
    skills: user?.profile?.skills || [],
    interests: user?.profile?.interests || [],
    goals: user?.profile?.goals || [],
    preferred_business_models: user?.profile?.preferred_business_models || [],
    preferred_industries: user?.profile?.preferred_industries || [],
    risk_tolerance: user?.profile?.risk_tolerance || '',
    time_availability: user?.profile?.time_availability || '',
  });

  const [resumeFile, setResumeFile] = useState<File | null>(null);
  const [resumeUploadStatus, setResumeUploadStatus] = useState<'idle' | 'uploading' | 'success' | 'error'>('idle');
  const [resumeError, setResumeError] = useState<string | null>(null);
  const [customSkill, setCustomSkill] = useState('');
  const [customIndustry, setCustomIndustry] = useState('');
  const [customInterest, setCustomInterest] = useState('');
  const [customGoal, setCustomGoal] = useState('');

  if (!user) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 flex items-center justify-center">
        <div className="text-center">
          <p className="text-lg text-red-600 mb-4">Please log in to view your profile</p>
          <Link to="/auth">
            <Button>Go to Login</Button>
          </Link>
        </div>
      </div>
    );
  }

  const handleSave = async () => {
    setLoading(true);
    try {
      await updateProfile(formData);
      setIsEditing(false);
      toast({
        title: "Profile Updated",
        description: "Your profile has been updated successfully.",
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to update profile. Please try again.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = () => {
    setFormData({
      bio: user?.profile?.bio || '',
      location: user?.profile?.location || '',
      website: user?.profile?.website || '',
      linkedin_url: user?.profile?.linkedin_url || '',
      github_url: user?.profile?.github_url || '',
      experience_years: user?.profile?.experience_years || 0,
      skills: user?.profile?.skills || [],
      interests: user?.profile?.interests || [],
      goals: user?.profile?.goals || [],
      preferred_business_models: user?.profile?.preferred_business_models || [],
      preferred_industries: user?.profile?.preferred_industries || [],
      risk_tolerance: user?.profile?.risk_tolerance || '',
      time_availability: user?.profile?.time_availability || '',
    });
    setIsEditing(false);
  };

  const handleResumeUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setResumeFile(file);
    setResumeUploadStatus('uploading');
    setResumeError(null);
    try {
      const data = await uploadResume(file);
      setResumeUploadStatus('success');
      setFormData(prev => ({
        ...prev,
        bio: data.bio || prev.bio,
        skills: Array.isArray(data.extracted_skills) ? data.extracted_skills : prev.skills,
        preferred_industries: Array.isArray(data.industries) ? data.industries : prev.preferred_industries,
        location: data.location || prev.location,
      }));
      toast({ title: 'Resume Uploaded', description: 'Resume parsed! Review and edit your info below.' });
    } catch (err: unknown) {
      setResumeUploadStatus('error');
      setResumeError(err instanceof Error ? err.message : 'Failed to upload resume');
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100">
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-8 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link to="/">
              <Button variant="ghost" size="sm">
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back to Dashboard
              </Button>
            </Link>
            <h1 className="text-2xl font-bold bg-gradient-to-r from-purple-600 to-blue-600 bg-clip-text text-transparent">
              Profile
            </h1>
          </div>
          
          {!isEditing ? (
            <Button onClick={() => setIsEditing(true)}>
              <Edit className="h-4 w-4 mr-2" />
              Edit Profile
            </Button>
          ) : (
            <div className="flex gap-2">
              <Button variant="outline" onClick={handleCancel}>
                <X className="h-4 w-4 mr-2" />
                Cancel
              </Button>
              <Button onClick={handleSave} disabled={loading}>
                <Save className="h-4 w-4 mr-2" />
                {loading ? 'Saving...' : 'Save Changes'}
              </Button>
            </div>
          )}
        </div>

        <div className="grid gap-6 md:grid-cols-3">
          {/* Profile Card */}
          <div className="md:col-span-1">
            <Card>
              <CardHeader className="text-center">
                <Avatar className="h-24 w-24 mx-auto mb-4">
                  <AvatarImage src={user.oauth_picture} alt={user.first_name} />
                  <AvatarFallback className="text-2xl">
                    {user.first_name?.[0]}{user.last_name?.[0]}
                  </AvatarFallback>
                </Avatar>
                <CardTitle className="text-xl">
                  {user.first_name} {user.last_name}
                </CardTitle>
                <CardDescription>{user.email}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {user.profile?.location && (
                  <div className="flex items-center gap-2 text-sm text-slate-600">
                    <MapPin className="h-4 w-4" />
                    {user.profile.location}
                  </div>
                )}
                {user.profile?.website && (
                  <div className="flex items-center gap-2 text-sm text-slate-600">
                    <Globe className="h-4 w-4" />
                    <a href={user.profile.website} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">
                      {user.profile.website}
                    </a>
                  </div>
                )}
                {user.profile?.linkedin_url && (
                  <div className="flex items-center gap-2 text-sm text-slate-600">
                    <Linkedin className="h-4 w-4" />
                    <a href={user.profile.linkedin_url} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">
                      LinkedIn Profile
                    </a>
                  </div>
                )}
                {user.profile?.github_url && (
                  <div className="flex items-center gap-2 text-sm text-slate-600">
                    <Github className="h-4 w-4" />
                    <a href={user.profile.github_url} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">
                      GitHub Profile
                    </a>
                  </div>
                )}
                <div className="flex items-center gap-2 text-sm text-slate-600">
                  <span>Tier:</span>
                  <Badge>{user.tier ? user.tier.charAt(0).toUpperCase() + user.tier.slice(1) : 'Free'}</Badge>
                </div>
                <div className="flex items-center gap-2 text-sm text-slate-600">
                  <span>Account Type:</span>
                  <Badge>{user.account_type ? user.account_type.charAt(0).toUpperCase() + user.account_type.slice(1) : 'Solo'}</Badge>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Profile Details */}
          <div className="md:col-span-2 space-y-6">
            {/* Basic Information */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <User className="h-5 w-5" />
                  Basic Information
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {isEditing ? (
                  <div className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <Label htmlFor="location">Location</Label>
                        <Input id="location" value={formData.location} onChange={e => setFormData({ ...formData, location: e.target.value })} placeholder="Enter your location" />
                      </div>
                      <div>
                        <Label htmlFor="experience">Years of Experience</Label>
                        <Input id="experience" type="number" value={formData.experience_years} onChange={e => setFormData({ ...formData, experience_years: parseInt(e.target.value) || 0 })} placeholder="0" />
                      </div>
                    </div>
                    <div>
                      <Label htmlFor="bio">Bio</Label>
                      <Textarea id="bio" value={formData.bio} onChange={e => setFormData({ ...formData, bio: e.target.value })} placeholder="Tell us about yourself..." rows={2} />
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <Label htmlFor="website">Website</Label>
                        <Input id="website" value={formData.website} onChange={e => setFormData({ ...formData, website: e.target.value })} placeholder="https://yourwebsite.com" />
                      </div>
                      <div>
                        <Label htmlFor="linkedin">LinkedIn URL</Label>
                        <Input id="linkedin" value={formData.linkedin_url} onChange={e => setFormData({ ...formData, linkedin_url: e.target.value })} placeholder="https://linkedin.com/in/username" />
                      </div>
                      <div>
                        <Label htmlFor="github">GitHub URL</Label>
                        <Input id="github" value={formData.github_url} onChange={e => setFormData({ ...formData, github_url: e.target.value })} placeholder="https://github.com/username" />
                      </div>
                    </div>
                    {/* Skills Multi-select with custom add */}
                    <div>
                      <Label>Skills</Label>
                      <div className="flex flex-wrap gap-1 mb-1">
                        {formData.skills.map(skill => (
                          <Badge key={skill} className="bg-blue-100 text-blue-800 cursor-pointer" onClick={() => setFormData(prev => ({ ...prev, skills: prev.skills.filter(s => s !== skill) }))}>
                            {skill} <span className="ml-1">×</span>
                          </Badge>
                        ))}
                      </div>
                      <div className="grid grid-cols-2 md:grid-cols-3 gap-1 mb-1">
                        {SKILLS_OPTIONS.filter(skill => !formData.skills.includes(skill)).map(skill => (
                          <Button
                            key={skill}
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => setFormData(prev => ({ ...prev, skills: [...prev.skills, skill] }))}
                            className="justify-start"
                          >
                            + {skill}
                          </Button>
                        ))}
                      </div>
                      <div className="flex gap-2 items-center mt-1">
                        <Input
                          value={customSkill}
                          onChange={e => setCustomSkill(e.target.value)}
                          placeholder="Add custom skill"
                          className="h-8 text-xs"
                        />
                        <Button
                          type="button"
                          size="sm"
                          variant="default"
                          className="h-8 px-3"
                          onClick={() => {
                            if (customSkill && !formData.skills.includes(customSkill)) {
                              setFormData(prev => ({ ...prev, skills: [...prev.skills, customSkill] }));
                              setCustomSkill('');
                            }
                          }}
                        >
                          Add
                        </Button>
                      </div>
                    </div>
                    {/* Interests Multi-select with custom add */}
                    <div>
                      <Label>Interests</Label>
                      <div className="flex flex-wrap gap-1 mb-1">
                        {formData.interests.map(interest => (
                          <Badge key={interest} className="bg-pink-100 text-pink-800 cursor-pointer" onClick={() => setFormData(prev => ({ ...prev, interests: prev.interests.filter(i => i !== interest) }))}>
                            {interest} <span className="ml-1">×</span>
                          </Badge>
                        ))}
                      </div>
                      <div className="grid grid-cols-2 md:grid-cols-3 gap-1 mb-1">
                        {[
                          'Technology', 'Healthcare', 'Education', 'Finance', 'Environment',
                          'Social Impact', 'Innovation', 'Business', 'Creative Arts', 'Sports',
                          'Travel', 'Food & Cooking', 'Fitness', 'Gaming', 'Reading', 'Music'
                        ].filter(interest => !formData.interests.includes(interest)).map(interest => (
                          <Button
                            key={interest}
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => setFormData(prev => ({ ...prev, interests: [...prev.interests, interest] }))}
                            className="justify-start"
                          >
                            + {interest}
                          </Button>
                        ))}
                      </div>
                      <div className="flex gap-2 items-center mt-1">
                        <Input
                          value={customInterest}
                          onChange={e => setCustomInterest(e.target.value)}
                          placeholder="Add custom interest"
                          className="h-8 text-xs"
                        />
                        <Button
                          type="button"
                          size="sm"
                          variant="default"
                          className="h-8 px-3"
                          onClick={() => {
                            if (customInterest && !formData.interests.includes(customInterest)) {
                              setFormData(prev => ({ ...prev, interests: [...prev.interests, customInterest] }));
                              setCustomInterest('');
                            }
                          }}
                        >
                          Add
                        </Button>
                      </div>
                    </div>
                    {/* Goals Multi-select with custom add */}
                    <div>
                      <Label>Goals</Label>
                      <div className="flex flex-wrap gap-1 mb-1">
                        {formData.goals.map(goal => (
                          <Badge key={goal} className="bg-green-100 text-green-800 cursor-pointer" onClick={() => setFormData(prev => ({ ...prev, goals: prev.goals.filter(g => g !== goal) }))}>
                            {goal} <span className="ml-1">×</span>
                          </Badge>
                        ))}
                      </div>
                      <div className="grid grid-cols-2 md:grid-cols-3 gap-1 mb-1">
                        {[
                          'Start a side hustle', 'Build a full-time business', 'Learn new skills',
                          'Network with others', 'Make an impact', 'Achieve financial freedom',
                          'Solve a problem', 'Innovate', 'Grow a team', 'Other'
                        ].filter(goal => !formData.goals.includes(goal)).map(goal => (
                          <Button
                            key={goal}
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => setFormData(prev => ({ ...prev, goals: [...prev.goals, goal] }))}
                            className="justify-start"
                          >
                            + {goal}
                          </Button>
                        ))}
                      </div>
                      <div className="flex gap-2 items-center mt-1">
                        <Input
                          value={customGoal}
                          onChange={e => setCustomGoal(e.target.value)}
                          placeholder="Add custom goal"
                          className="h-8 text-xs"
                        />
                        <Button
                          type="button"
                          size="sm"
                          variant="default"
                          className="h-8 px-3"
                          onClick={() => {
                            if (customGoal && !formData.goals.includes(customGoal)) {
                              setFormData(prev => ({ ...prev, goals: [...prev.goals, customGoal] }));
                              setCustomGoal('');
                            }
                          }}
                        >
                          Add
                        </Button>
                      </div>
                    </div>
                    {/* Preferences Section */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <Label>Preferred Business Models</Label>
                        <div className="grid grid-cols-2 gap-2">
                          {BUSINESS_MODELS.map(model => (
                            <Button
                              key={model}
                              type="button"
                              variant={formData.preferred_business_models.includes(model) ? "default" : "outline"}
                              size="sm"
                              onClick={() => setFormData(prev => ({ ...prev, preferred_business_models: prev.preferred_business_models.includes(model) ? prev.preferred_business_models.filter(m => m !== model) : [...prev.preferred_business_models, model] }))}
                              className="justify-start"
                            >
                              {formData.preferred_business_models.includes(model) && <CheckCircle className="w-4 h-4 mr-2" />}
                              {model}
                            </Button>
                          ))}
                        </div>
                      </div>
                      <div>
                        <Label>Preferred Industries</Label>
                        <div className="flex flex-wrap gap-1 mb-1">
                          {formData.preferred_industries.map(industry => (
                            <Badge key={industry} className="bg-green-100 text-green-800 cursor-pointer" onClick={() => setFormData(prev => ({ ...prev, preferred_industries: prev.preferred_industries.filter(i => i !== industry) }))}>
                              {industry} <span className="ml-1">×</span>
                            </Badge>
                          ))}
                        </div>
                        <div className="grid grid-cols-2 md:grid-cols-3 gap-1 mb-1">
                          {INDUSTRIES_OPTIONS.filter(ind => !formData.preferred_industries.includes(ind)).map(industry => (
                            <Button
                              key={industry}
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={() => setFormData(prev => ({ ...prev, preferred_industries: [...prev.preferred_industries, industry] }))}
                              className="justify-start"
                            >
                              + {industry}
                            </Button>
                          ))}
                        </div>
                        <div className="flex gap-2 items-center mt-1">
                          <Input
                            value={customIndustry}
                            onChange={e => setCustomIndustry(e.target.value)}
                            placeholder="Add custom industry"
                            className="h-8 text-xs"
                          />
                          <Button
                            type="button"
                            size="sm"
                            variant="default"
                            className="h-8 px-3"
                            onClick={() => {
                              if (customIndustry && !formData.preferred_industries.includes(customIndustry)) {
                                setFormData(prev => ({ ...prev, preferred_industries: [...prev.preferred_industries, customIndustry] }));
                                setCustomIndustry('');
                              }
                            }}
                          >
                            Add
                          </Button>
                        </div>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                      <div>
                        <Label>Risk Tolerance</Label>
                        <Select value={formData.risk_tolerance} onValueChange={v => setFormData(prev => ({ ...prev, risk_tolerance: v }))}>
                          <SelectTrigger><SelectValue placeholder="Select risk tolerance" /></SelectTrigger>
                          <SelectContent>
                            {RISK_TOLERANCE_OPTIONS.map(opt => (
                              <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label>Time Availability</Label>
                        <Select value={formData.time_availability} onValueChange={v => setFormData(prev => ({ ...prev, time_availability: v }))}>
                          <SelectTrigger><SelectValue placeholder="Select availability" /></SelectTrigger>
                          <SelectContent>
                            {TIME_AVAILABILITY_OPTIONS.map(opt => (
                              <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {user.profile?.bio && (
                      <div>
                        <Label className="text-sm font-medium text-slate-700">Bio</Label>
                        <p className="text-slate-600 mt-1">{user.profile.bio}</p>
                      </div>
                    )}
                    {user.profile?.experience_years && (
                      <div className="flex items-center gap-2">
                        <Briefcase className="h-4 w-4 text-slate-500" />
                        <span className="text-sm text-slate-600">
                          {user.profile.experience_years} years of experience
                        </span>
                      </div>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Skills */}
            {user.profile?.skills && user.profile.skills.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle>Skills</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex flex-wrap gap-2">
                    {user.profile.skills.map((skill, index) => (
                      <Badge key={index} variant="secondary">
                        {skill}
                      </Badge>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Interests */}
            {user.profile?.interests && user.profile.interests.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle>Interests</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex flex-wrap gap-2">
                    {user.profile.interests.map((interest, index) => (
                      <Badge key={index} variant="outline">
                        {interest}
                      </Badge>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Goals */}
            {user.profile?.goals && user.profile.goals.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Target className="h-5 w-5" />
                    Goals
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {user.profile.goals.map((goal, index) => (
                      <div key={index} className="flex items-center gap-2">
                        <div className="h-2 w-2 bg-blue-500 rounded-full"></div>
                        <span className="text-sm text-slate-600">{goal}</span>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Preferences */}
            {(user.profile?.preferred_business_models?.length > 0 || 
              user.profile?.preferred_industries?.length > 0 || 
              user.profile?.risk_tolerance || 
              user.profile?.time_availability) && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Clock className="h-5 w-5" />
                    Preferences
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {user.profile.preferred_business_models?.length > 0 && (
                    <div>
                      <Label className="text-sm font-medium text-slate-700">Preferred Business Models</Label>
                      <div className="flex flex-wrap gap-2 mt-1">
                        {user.profile.preferred_business_models.map((model, index) => (
                          <Badge key={index} variant="secondary">
                            {model}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  )}
                  {user.profile.preferred_industries?.length > 0 && (
                    <div>
                      <Label className="text-sm font-medium text-slate-700">Preferred Industries</Label>
                      <div className="flex flex-wrap gap-2 mt-1">
                        {user.profile.preferred_industries.map((industry, index) => (
                          <Badge key={index} variant="outline">
                            {industry}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  )}
                  {user.profile.risk_tolerance && (
                    <div>
                      <Label className="text-sm font-medium text-slate-700">Risk Tolerance</Label>
                      <Badge variant="secondary" className="mt-1">
                        {user.profile.risk_tolerance}
                      </Badge>
                    </div>
                  )}
                  {user.profile.time_availability && (
                    <div>
                      <Label className="text-sm font-medium text-slate-700">Time Availability</Label>
                      <Badge variant="secondary" className="mt-1">
                        {user.profile.time_availability}
                      </Badge>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

            {isEditing && (
              <Card className="mb-4">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Briefcase className="h-5 w-5" />
                    Upload Resume
                  </CardTitle>
                  <CardDescription>Upload a new resume to update your skills, industries, and bio. You can review and edit before saving.</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="flex flex-col md:flex-row gap-4 items-center">
                    <Input type="file" accept=".pdf,.doc,.docx" onChange={handleResumeUpload} disabled={resumeUploadStatus === 'uploading'} />
                    {resumeUploadStatus === 'uploading' && <span className="text-xs text-blue-600">Uploading...</span>}
                    {resumeUploadStatus === 'success' && <span className="text-xs text-green-600">Resume parsed!</span>}
                    {resumeUploadStatus === 'error' && <span className="text-xs text-red-600">{resumeError}</span>}
                  </div>
                  <div className="text-xs text-muted-foreground mt-2">Uploading a resume will help personalize your experience and generate better ideas.</div>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Profile; 