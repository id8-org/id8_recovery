import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, ScatterChart, Scatter, ZAxis } from 'recharts';
import { TrendingUp, Target, Zap, Brain, Star, Lightbulb, CheckCircle, Rocket, ArrowRight, Eye, Calendar, Trophy, Crown, Activity } from 'lucide-react';
import { useState, useEffect } from "react";
import { getAllIdeas } from "../lib/api";
import type { Idea, Repo } from "../lib/api";
import { useNavigate } from "react-router-dom";

interface DashboardProps {
  ideas: Idea[];
  repos?: Repo[];
  onAddIdea: () => void;
  setModalIdea: (idea: Idea | null) => void;
}

interface IdeaWithPotential extends Idea {
    potential: number;
    isHighPotential: boolean;
    isQuickWin: boolean;
    isRecent: boolean;
}

export const Dashboard = ({ ideas, repos = [], setModalIdea, onAddIdea }: DashboardProps) => {
  const [loading, setLoading] = useState(true);
  const [selectedFilter, setSelectedFilter] = useState<'all' | 'high_potential' | 'quick_wins' | 'recent'>('all');
  const navigate = useNavigate();

  useEffect(() => {
    setLoading(false);
  }, [ideas]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        <span className="ml-2 text-gray-600">Loading your ideas...</span>
      </div>
    );
  }

  if (ideas.length === 1) {
    return (
      <div className="space-y-6">
        <Card className="bg-blue-50 border-blue-200 mb-6">
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
    );
  }

  if (ideas.length === 0) {
    return (
      <Card className="p-12 text-center">
        <Lightbulb className="w-16 h-16 mx-auto mb-4 text-slate-400" />
        <h3 className="text-xl font-semibold mb-2">No Ideas Yet</h3>
        <p className="text-slate-600 mb-4">Start generating ideas to see your dashboard</p>
        <Button onClick={onAddIdea}>
          Generate Ideas
        </Button>
      </Card>
    );
  }

  // Calculate idea potential (score - effort)
  const ideasWithPotential: IdeaWithPotential[] = ideas.map(idea => ({
    ...idea,
    potential: (idea.score || 0) - (idea.mvp_effort || 5),
    isHighPotential: (idea.score || 0) >= 8 && (idea.mvp_effort || 5) <= 4,
    isQuickWin: (idea.score || 0) >= 6 && (idea.mvp_effort || 5) <= 3,
    isRecent: new Date(idea.created_at || '').getTime() > Date.now() - 7 * 24 * 60 * 60 * 1000
  }));

  // Filter ideas based on selection
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

  // Sort by potential (highest first)
  const sortedIdeas = filteredIdeas.sort((a, b) => b.potential - a.potential);

  // Get top ideas for different categories
  const topIdeas = ideasWithPotential
    .sort((a, b) => b.potential - a.potential)
    .slice(0, 10);

  const highPotentialIdeas = ideasWithPotential.filter(i => i.isHighPotential);
  const quickWins = ideasWithPotential.filter(i => i.isQuickWin);
  const recentIdeas = ideasWithPotential.filter(i => i.isRecent);

  // Lifecycle distribution
  const lifecycleData = [
    { name: 'Suggested', value: ideas.filter(i => i.status === 'suggested').length, color: '#3b82f6' },
    { name: 'Deep Dive', value: ideas.filter(i => i.status === 'deep_dive').length, color: '#8b5cf6' },
    { name: 'Iterating', value: ideas.filter(i => i.status === 'iterating').length, color: '#f59e0b' },
    { name: 'Considering', value: ideas.filter(i => i.status === 'considering').length, color: '#10b981' },
    { name: 'Closed', value: ideas.filter(i => i.status === 'closed').length, color: '#6b7280' }
  ];

  // Score vs Effort scatter data
  const scatterData = ideasWithPotential.map(idea => ({
    x: idea.score || 0,
    y: idea.mvp_effort || 5,
    z: idea.potential || 0,
    name: idea.title,
    status: idea.status,
    id: idea.id
  }));

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'suggested': return 'bg-blue-100 text-blue-800';
      case 'deep_dive': return 'bg-purple-100 text-purple-800';
      case 'iterating': return 'bg-orange-100 text-orange-800';
      case 'considering': return 'bg-green-100 text-green-800';
      case 'closed': return 'bg-gray-100 text-gray-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'suggested': return <Lightbulb className="w-4 h-4" />;
      case 'deep_dive': return <Brain className="w-4 h-4" />;
      case 'iterating': return <Rocket className="w-4 h-4" />;
      case 'considering': return <Target className="w-4 h-4" />;
      case 'closed': return <CheckCircle className="w-4 h-4" />;
      default: return <Lightbulb className="w-4 h-4" />;
    }
  };

  return (
    <div className="space-y-6">
      {/* Header with Key Metrics */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card className="bg-gradient-to-r from-blue-50 to-blue-100 border-blue-200">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-blue-900">Total Ideas</CardTitle>
            <Lightbulb className="h-4 w-4 text-blue-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-900">{ideas.length}</div>
            <p className="text-xs text-blue-700">
              Across all repositories
            </p>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-r from-green-50 to-green-100 border-green-200">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-green-900">High Potential</CardTitle>
            <Crown className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-900">{highPotentialIdeas.length}</div>
            <p className="text-xs text-green-700">
              Score ≥8, Effort ≤4
            </p>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-r from-orange-50 to-orange-100 border-orange-200">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-orange-900">Quick Wins</CardTitle>
            <Zap className="h-4 w-4 text-orange-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-orange-900">{quickWins.length}</div>
            <p className="text-xs text-orange-700">
              Score ≥6, Effort ≤3
            </p>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-r from-purple-50 to-purple-100 border-purple-200">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-purple-900">Recent Ideas</CardTitle>
            <Calendar className="h-4 w-4 text-purple-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-purple-900">{recentIdeas.length}</div>
            <p className="text-xs text-purple-700">
              Last 7 days
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Filter Tabs */}
      <div className="flex space-x-2 overflow-x-auto pb-2">
        <Button
          variant={selectedFilter === 'all' ? 'default' : 'outline'}
          size="sm"
          onClick={() => setSelectedFilter('all')}
          className="whitespace-nowrap"
        >
          <Eye className="w-4 h-4 mr-2" />
          All Ideas ({ideas.length})
        </Button>
        <Button
          variant={selectedFilter === 'high_potential' ? 'default' : 'outline'}
          size="sm"
          onClick={() => setSelectedFilter('high_potential')}
          className="whitespace-nowrap"
        >
          <Crown className="w-4 h-4 mr-2" />
          High Potential ({highPotentialIdeas.length})
        </Button>
        <Button
          variant={selectedFilter === 'quick_wins' ? 'default' : 'outline'}
          size="sm"
          onClick={() => setSelectedFilter('quick_wins')}
          className="whitespace-nowrap"
        >
          <Zap className="w-4 h-4 mr-2" />
          Quick Wins ({quickWins.length})
        </Button>
        <Button
          variant={selectedFilter === 'recent' ? 'default' : 'outline'}
          size="sm"
          onClick={() => setSelectedFilter('recent')}
          className="whitespace-nowrap"
        >
          <Calendar className="w-4 h-4 mr-2" />
          Recent ({recentIdeas.length})
        </Button>
      </div>

      {/* Top Ideas Grid */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {sortedIdeas.slice(0, 9).map((idea, index) => (
          <Card key={idea.id} className="hover:shadow-lg transition-shadow cursor-pointer" onClick={() => setModalIdea(idea)}>
            <CardHeader className="pb-3">
              <div className="flex items-start justify-between">
                <div className="flex items-center space-x-2">
                  {index < 3 && (
                    <Trophy className={`w-5 h-5 ${index === 0 ? 'text-yellow-500' : index === 1 ? 'text-gray-400' : 'text-amber-600'}`} />
                  )}
                  <Badge variant="outline" className={getStatusColor(idea.status)}>
                    {getStatusIcon(idea.status)}
                    <span className="ml-1 capitalize">{idea.status.replace('_', ' ')}</span>
                  </Badge>
                </div>
                <div className="text-right">
                  <div className="text-sm font-semibold text-green-600">+{idea.potential}</div>
                  <div className="text-xs text-gray-500">Potential</div>
                </div>
              </div>
            </CardHeader>
            <CardContent className="pt-0">
              <h3 className="font-semibold text-sm mb-2 line-clamp-2">{idea.title}</h3>
              <p className="text-xs text-gray-600 mb-3 line-clamp-2">{idea.hook}</p>
              
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center space-x-4">
                  <div className="text-center">
                    <div className="text-sm font-semibold text-blue-600">{idea.score || 0}</div>
                    <div className="text-xs text-gray-500">Score</div>
                  </div>
                  <div className="text-center">
                    <div className="text-sm font-semibold text-orange-600">{idea.mvp_effort || 5}</div>
                    <div className="text-xs text-gray-500">Effort</div>
                  </div>
                </div>
                <ArrowRight className="w-4 h-4 text-gray-400" />
              </div>

              {idea.type && (
                <Badge variant="secondary" className="text-xs">
                  {idea.type === 'side_hustle' ? 'Side Hustle' : 'Full Scale'}
                </Badge>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Charts Section */}
      <div className="grid gap-6 md:grid-cols-2">
        {/* Lifecycle Distribution */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Activity className="w-5 h-5" />
              Idea Lifecycle Distribution
            </CardTitle>
            <CardDescription>Where your ideas are in the development process</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={lifecycleData}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                  outerRadius={80}
                  fill="#8884d8"
                  dataKey="value"
                >
                  {lifecycleData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Score vs Effort Scatter */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Target className="w-5 h-5" />
              Score vs Effort Matrix
            </CardTitle>
            <CardDescription>Ideas positioned by potential (higher score, lower effort = better)</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <ScatterChart
                margin={{ top: 20, right: 20, bottom: 20, left: 20 }}
              >
                <CartesianGrid />
                <XAxis 
                  type="number" 
                  dataKey="x" 
                  name="Score" 
                  domain={[0, 10]}
                  tickCount={11}
                />
                <YAxis 
                  type="number" 
                  dataKey="y" 
                  name="Effort" 
                  domain={[0, 10]}
                  tickCount={11}
                  reversed
                />
                <ZAxis type="number" dataKey="z" range={[60, 400]} />
                <Tooltip 
                  cursor={{ strokeDasharray: '3 3' }}
                  content={({ active, payload }) => {
                    if (active && payload && payload.length) {
                      const data = payload[0].payload;
                      return (
                        <div className="bg-white p-3 border rounded-lg shadow-lg">
                          <p className="font-semibold">{data.name}</p>
                          <p className="text-sm">Score: {data.x}</p>
                          <p className="text-sm">Effort: {data.y}</p>
                          <p className="text-sm">Potential: +{data.z}</p>
                          <p className="text-sm capitalize">Status: {data.status.replace('_', ' ')}</p>
                        </div>
                      );
                    }
                    return null;
                  }}
                />
                <Scatter data={scatterData} fill="#8884d8">
                  {scatterData.map((entry, index) => (
                    <Cell 
                      key={`cell-${index}`} 
                      fill={entry.z >= 3 ? '#10b981' : entry.z >= 0 ? '#f59e0b' : '#ef4444'} 
                    />
                  ))}
                </Scatter>
              </ScatterChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Top 10 Ideas Table */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Trophy className="w-5 h-5" />
            Top 10 Most Promising Ideas
          </CardTitle>
          <CardDescription>Ranked by potential (score - effort)</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b">
                  <th className="text-left py-2 px-2">Rank</th>
                  <th className="text-left py-2 px-2">Idea</th>
                  <th className="text-center py-2 px-2">Score</th>
                  <th className="text-center py-2 px-2">Effort</th>
                  <th className="text-center py-2 px-2">Potential</th>
                  <th className="text-center py-2 px-2">Status</th>
                  <th className="text-center py-2 px-2">Type</th>
                </tr>
              </thead>
              <tbody>
                {topIdeas.map((idea, index) => (
                  <tr 
                    key={idea.id} 
                    className="border-b hover:bg-gray-50 cursor-pointer"
                    onClick={() => setModalIdea(idea)}
                  >
                    <td className="py-3 px-2">
                      <div className="flex items-center gap-2">
                        {index < 3 && (
                          <Trophy className={`w-4 h-4 ${index === 0 ? 'text-yellow-500' : index === 1 ? 'text-gray-400' : 'text-amber-600'}`} />
                        )}
                        <span className="font-semibold">#{index + 1}</span>
                      </div>
                    </td>
                    <td className="py-3 px-2">
                      <div>
                        <div className="font-medium text-sm">{idea.title}</div>
                        <div className="text-xs text-gray-500 line-clamp-1">{idea.hook}</div>
                      </div>
                    </td>
                    <td className="py-3 px-2 text-center">
                      <Badge variant={idea.score >= 8 ? 'default' : idea.score >= 6 ? 'secondary' : 'outline'}>
                        {idea.score || 0}
                      </Badge>
                    </td>
                    <td className="py-3 px-2 text-center">
                      <Badge variant={idea.mvp_effort <= 3 ? 'default' : idea.mvp_effort <= 6 ? 'secondary' : 'outline'}>
                        {idea.mvp_effort || 5}
                      </Badge>
                    </td>
                    <td className="py-3 px-2 text-center">
                      <div className="font-semibold text-green-600">+{idea.potential}</div>
                    </td>
                    <td className="py-3 px-2 text-center">
                      <Badge className={getStatusColor(idea.status)}>
                        {getStatusIcon(idea.status)}
                        <span className="ml-1 capitalize">{idea.status.replace('_', ' ')}</span>
                      </Badge>
                    </td>
                    <td className="py-3 px-2 text-center">
                      {idea.type && (
                        <Badge variant="outline" className="text-xs">
                          {idea.type === 'side_hustle' ? 'Side Hustle' : 'Full Scale'}
                        </Badge>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}; 