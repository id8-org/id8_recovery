import React, { useState, useRef } from 'react';
import { ChevronRight, Plus, Eye, Brain, Users, TrendingUp, FileText, Archive, Target, Lightbulb, BarChart3, Zap, AlertCircle, CheckCircle2, X, Edit3, MessageSquare, Download } from 'lucide-react';

const IdeaKanbanBoard = () => {
  const [selectedIdea, setSelectedIdea] = useState(null);
  const [filter, setFilter] = useState('all');
  const [sortBy, setSortBy] = useState('score');
  const [ideas, setIdeas] = useState([
    {
      id: 1,
      title: "Smart Supply Chain AI",
      stage: "suggested",
      score: 9,
      mvp_effort: 3,
      hook: "AI-powered predictive analytics for supply chain optimization",
      value: "Reduce inventory costs by 30% and prevent stockouts",
      evidence: "Growing e-commerce demand, supply chain disruptions",
      differentiator: "Real-time market sentiment analysis integration",
      call_to_action: "Start with Shopify app beta",
      type: "full_scale",
      created: "2024-06-20",
      updated: "2024-06-20"
    },
    {
      id: 2,
      title: "Local Food Network",
      stage: "deep_dive",
      score: 7,
      mvp_effort: 5,
      hook: "Connect local farmers directly with restaurants",
      value: "Reduce food costs by 20%, support local economy",
      evidence: "Farm-to-table trend, rising restaurant costs",
      differentiator: "Blockchain-verified organic certification",
      call_to_action: "Pilot with 3 restaurants, 5 farms",
      type: "side_hustle",
      created: "2024-06-18",
      updated: "2024-06-21",
      deepDive: {
        product: "B2B marketplace with logistics coordination",
        timing: "Perfect - post-COVID focus on local sourcing",
        market: "$50B addressable market, growing 15% annually",
        moat: "Network effects and exclusive farmer partnerships",
        funding: "Seed round viable, $2M target",
        signalScore: {
          "Product-Market Fit Potential": 7,
          "Market Size & Timing": 9,
          "Technical Feasibility": 6,
          "Competitive Advantage": 8
        },
        goNoGo: "Go",
        summary: "Strong market opportunity with clear value proposition for both sides of marketplace"
      }
    },
    {
      id: 3,
      title: "Remote Team Wellness",
      stage: "iterating",
      score: 8,
      mvp_effort: 2,
      hook: "AI wellness coach for distributed teams",
      value: "Improve team productivity and reduce burnout by 40%",
      evidence: "Remote work permanence, mental health awareness",
      differentiator: "Predictive burnout detection using work patterns",
      call_to_action: "Launch Slack integration beta",
      type: "side_hustle",
      created: "2024-06-15",
      updated: "2024-06-22",
      deepDive: {
        product: "Slack/Teams bot with wellness insights dashboard",
        timing: "Excellent - remote work is permanent",
        market: "$15B corporate wellness market",
        moat: "Proprietary algorithms and behavior data",
        funding: "Bootstrap viable, potential VC interest",
        signalScore: {
          "Product-Market Fit Potential": 8,
          "Market Size & Timing": 9,
          "Technical Feasibility": 9,
          "Competitive Advantage": 7
        },
        goNoGo: "Go",
        summary: "High potential with low technical risk and clear monetization path"
      },
      lenses: {
        investor: {
          insights: "Strong recurring revenue model with high retention potential",
          recommendations: ["Focus on enterprise sales", "Build network effects"]
        },
        customer: {
          insights: "High pain point but privacy concerns around monitoring",
          recommendations: ["Emphasize opt-in controls", "Show clear ROI metrics"]
        },
        founder: {
          insights: "Aligns well with your technical background and market knowledge",
          recommendations: ["Start with pilot customers", "Build MVP quickly"]
        }
      }
    },
    {
      id: 4,
      title: "Carbon Credit Marketplace",
      stage: "considering",
      score: 6,
      mvp_effort: 8,
      hook: "Transparent marketplace for verified carbon credits",
      value: "Make carbon offsetting accessible and trustworthy",
      evidence: "ESG mandates, climate awareness growing",
      differentiator: "Satellite verification and blockchain tracking",
      call_to_action: "Partner with environmental NGOs",
      type: "full_scale",
      created: "2024-06-10",
      updated: "2024-06-23",
      deepDive: {
        product: "B2B marketplace with verification infrastructure",
        timing: "Good but competitive - ESG mandates increasing",
        market: "$1B carbon credit market, rapidly expanding",
        moat: "Verification technology and trust network",
        funding: "Requires significant VC investment - $10M+",
        signalScore: {
          "Product-Market Fit Potential": 6,
          "Market Size & Timing": 8,
          "Technical Feasibility": 4,
          "Competitive Advantage": 7
        },
        goNoGo: "Proceed with Caution",
        summary: "Large market opportunity but high execution risk and capital requirements"
      },
      lenses: {
        investor: {
          insights: "Massive TAM but crowded space with established players",
          recommendations: ["Find unique niche", "Prove verification tech first"]
        },
        customer: {
          insights: "Trust is the biggest barrier in current market",
          recommendations: ["Focus on transparency", "Start with smaller clients"]
        }
      },
      onePager: "Carbon Credit Marketplace addresses the $1B carbon offset market with satellite-verified, blockchain-tracked credits. While the market is large and growing due to ESG mandates, execution requires significant capital and faces established competition. Recommend starting with niche verification technology before full marketplace launch."
    },
    {
      id: 5,
      title: "Micro SaaS Analytics",
      stage: "closed",
      score: 4,
      mvp_effort: 3,
      hook: "Simple analytics for micro SaaS products",
      value: "Affordable analytics for small software products",
      evidence: "Growing indie hacker community",
      differentiator: "Privacy-first, no-code setup",
      call_to_action: "Build landing page and collect emails",
      type: "side_hustle",
      created: "2024-06-05",
      updated: "2024-06-20",
      closureReason: "Market too small, better alternatives exist",
      closureSummary: "Lacked clear differentiation from Google Analytics and existing solutions. Strong technical execution but unviable market positioning.",
      reopenPotential: false
    }
  ]);

  const [draggedItem, setDraggedItem] = useState(null);
  const dragCounter = useRef(0);

  const stages = [
    { id: 'suggested', name: 'Suggested', color: 'bg-blue-50 border-blue-200', icon: Lightbulb, accentColor: 'text-blue-600' },
    { id: 'deep_dive', name: 'Deep Dive', color: 'bg-purple-50 border-purple-200', icon: Brain, accentColor: 'text-purple-600' },
    { id: 'iterating', name: 'Iterating', color: 'bg-orange-50 border-orange-200', icon: Edit3, accentColor: 'text-orange-600' },
    { id: 'considering', name: 'Considering', color: 'bg-green-50 border-green-200', icon: Target, accentColor: 'text-green-600' },
    { id: 'closed', name: 'Closed', color: 'bg-gray-50 border-gray-200', icon: Archive, accentColor: 'text-gray-600' }
  ];

  const getStageIcon = (stage) => {
    const stageData = stages.find(s => s.id === stage);
    return stageData ? stageData.icon : Lightbulb;
  };

  const getScoreColor = (score) => {
    if (score >= 8) return 'text-green-600 bg-green-50';
    if (score >= 6) return 'text-yellow-600 bg-yellow-50';
    return 'text-red-600 bg-red-50';
  };

  const getEffortColor = (effort) => {
    if (effort <= 3) return 'text-green-600 bg-green-50';
    if (effort <= 6) return 'text-yellow-600 bg-yellow-50';
    return 'text-red-600 bg-red-50';
  };

  const handleDragStart = (e, idea) => {
    setDraggedItem(idea);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragEnd = () => {
    setDraggedItem(null);
    dragCounter.current = 0;
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };

  const handleDragEnter = (e) => {
    e.preventDefault();
    dragCounter.current++;
  };

  const handleDragLeave = (e) => {
    dragCounter.current--;
  };

  const handleDrop = (e, targetStage) => {
    e.preventDefault();
    dragCounter.current = 0;
    
    if (draggedItem && draggedItem.stage !== targetStage) {
      setIdeas(prev => prev.map(idea => 
        idea.id === draggedItem.id 
          ? { ...idea, stage: targetStage, updated: new Date().toISOString().split('T')[0] }
          : idea
      ));
    }
  };

  const openModal = (idea) => {
    setSelectedIdea(idea);
  };

  const closeModal = () => {
    setSelectedIdea(null);
  };

  const renderModalContent = (idea) => {
    const StageIcon = getStageIcon(idea.stage);
    
    return (
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center space-x-3">
            <StageIcon className="w-6 h-6 text-gray-600" />
            <h2 className="text-2xl font-bold text-gray-900">{idea.title}</h2>
            <span className="px-3 py-1 text-sm font-medium text-white bg-gray-800 rounded-full">
              {stages.find(s => s.id === idea.stage)?.name}
            </span>
          </div>
          <button onClick={closeModal} className="p-2 hover:bg-gray-100 rounded-full">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Core Idea */}
          <div className="lg:col-span-2 space-y-6">
            <div className="bg-gradient-to-r from-blue-50 to-purple-50 p-6 rounded-lg border">
              <h3 className="text-lg font-semibold mb-4 flex items-center">
                <Zap className="w-5 h-5 mr-2 text-blue-600" />
                Core Concept
              </h3>
              <div className="space-y-3">
                <div>
                  <span className="font-medium text-gray-700">Hook:</span>
                  <p className="text-gray-900 mt-1">{idea.hook}</p>
                </div>
                <div>
                  <span className="font-medium text-gray-700">Value:</span>
                  <p className="text-gray-900 mt-1">{idea.value}</p>
                </div>
                <div>
                  <span className="font-medium text-gray-700">Evidence:</span>
                  <p className="text-gray-900 mt-1">{idea.evidence}</p>
                </div>
                <div>
                  <span className="font-medium text-gray-700">Differentiator:</span>
                  <p className="text-gray-900 mt-1">{idea.differentiator}</p>
                </div>
                <div>
                  <span className="font-medium text-gray-700">Next Action:</span>
                  <p className="text-gray-900 mt-1">{idea.call_to_action}</p>
                </div>
              </div>
            </div>

            {/* Deep Dive Analysis */}
            {idea.deepDive && (
              <div className="bg-white p-6 rounded-lg border shadow-sm">
                <h3 className="text-lg font-semibold mb-4 flex items-center">
                  <Brain className="w-5 h-5 mr-2 text-purple-600" />
                  Strategic Analysis
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <span className="font-medium text-gray-700">Product:</span>
                    <p className="text-gray-900 mt-1 text-sm">{idea.deepDive.product}</p>
                  </div>
                  <div>
                    <span className="font-medium text-gray-700">Timing:</span>
                    <p className="text-gray-900 mt-1 text-sm">{idea.deepDive.timing}</p>
                  </div>
                  <div>
                    <span className="font-medium text-gray-700">Market:</span>
                    <p className="text-gray-900 mt-1 text-sm">{idea.deepDive.market}</p>
                  </div>
                  <div>
                    <span className="font-medium text-gray-700">Moat:</span>
                    <p className="text-gray-900 mt-1 text-sm">{idea.deepDive.moat}</p>
                  </div>
                </div>
                
                <div className="mt-4 p-4 bg-gray-50 rounded-lg">
                  <div className="flex items-center justify-between mb-3">
                    <span className="font-medium text-gray-700">Signal Scores</span>
                    <span className={`px-3 py-1 rounded-full text-sm font-medium ${
                      idea.deepDive.goNoGo === 'Go' ? 'bg-green-100 text-green-800' : 
                      idea.deepDive.goNoGo === 'Proceed with Caution' ? 'bg-yellow-100 text-yellow-800' : 
                      'bg-red-100 text-red-800'
                    }`}>
                      {idea.deepDive.goNoGo}
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    {Object.entries(idea.deepDive.signalScore).map(([key, value]) => (
                      <div key={key} className="flex justify-between text-sm">
                        <span className="text-gray-600">{key}:</span>
                        <div className="flex items-center">
                          <div className="w-12 bg-gray-200 rounded-full h-2 mr-2">
                            <div 
                              className="bg-blue-600 h-2 rounded-full" 
                              style={{width: `${(value/10)*100}%`}}
                            ></div>
                          </div>
                          <span className="font-medium">{value}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* Lens Feedback */}
            {idea.lenses && (
              <div className="bg-white p-6 rounded-lg border shadow-sm">
                <h3 className="text-lg font-semibold mb-4 flex items-center">
                  <Users className="w-5 h-5 mr-2 text-orange-600" />
                  Perspective Analysis
                </h3>
                <div className="space-y-4">
                  {Object.entries(idea.lenses).map(([lensType, lensData]) => (
                    <div key={lensType} className="border rounded-lg p-4">
                      <h4 className="font-medium text-gray-900 capitalize mb-2">{lensType} Lens</h4>
                      <p className="text-sm text-gray-700 mb-3">{lensData.insights}</p>
                      <div>
                        <span className="text-xs font-medium text-gray-600 uppercase tracking-wide">Recommendations:</span>
                        <ul className="mt-1 space-y-1">
                          {lensData.recommendations.map((rec, idx) => (
                            <li key={idx} className="text-sm text-gray-700 flex items-start">
                              <ChevronRight className="w-3 h-3 mt-1 mr-1 text-gray-400 flex-shrink-0" />
                              {rec}
                            </li>
                          ))}
                        </ul>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* One Pager */}
            {idea.onePager && (
              <div className="bg-white p-6 rounded-lg border shadow-sm">
                <h3 className="text-lg font-semibold mb-4 flex items-center">
                  <FileText className="w-5 h-5 mr-2 text-green-600" />
                  Investment Summary
                </h3>
                <p className="text-gray-900 leading-relaxed">{idea.onePager}</p>
                <div className="mt-4 flex space-x-2">
                  <button className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm">
                    <Download className="w-4 h-4 mr-2" />
                    Export Pitch Deck
                  </button>
                  <button className="flex items-center px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 text-sm">
                    <MessageSquare className="w-4 h-4 mr-2" />
                    Share for Feedback
                  </button>
                </div>
              </div>
            )}

            {/* Closure Info */}
            {idea.stage === 'closed' && (
              <div className="bg-red-50 p-6 rounded-lg border border-red-200">
                <h3 className="text-lg font-semibold mb-4 flex items-center text-red-800">
                  <AlertCircle className="w-5 h-5 mr-2" />
                  Closure Analysis
                </h3>
                <div className="space-y-3">
                  <div>
                    <span className="font-medium text-red-700">Reason:</span>
                    <p className="text-red-900 mt-1">{idea.closureReason}</p>
                  </div>
                  {idea.closureSummary && (
                    <div>
                      <span className="font-medium text-red-700">Summary:</span>
                      <p className="text-red-900 mt-1">{idea.closureSummary}</p>
                    </div>
                  )}
                  <div className="flex items-center mt-4">
                    <span className="font-medium text-red-700 mr-3">Reopen Potential:</span>
                    {idea.reopenPotential ? (
                      <CheckCircle2 className="w-5 h-5 text-green-600" />
                    ) : (
                      <X className="w-5 h-5 text-red-600" />
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Sidebar */}
          <div className="space-y-4">
            <div className="bg-white p-4 rounded-lg border shadow-sm">
              <h4 className="font-semibold mb-3">Metrics</h4>
              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-600">Score</span>
                  <span className={`px-2 py-1 rounded-full text-sm font-medium ${getScoreColor(idea.score)}`}>
                    {idea.score}/10
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-600">MVP Effort</span>
                  <span className={`px-2 py-1 rounded-full text-sm font-medium ${getEffortColor(idea.mvp_effort)}`}>
                    {idea.mvp_effort}/10
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-600">Type</span>
                  <span className="px-2 py-1 bg-gray-100 text-gray-800 rounded-full text-sm font-medium">
                    {idea.type.replace('_', ' ')}
                  </span>
                </div>
              </div>
            </div>

            <div className="bg-white p-4 rounded-lg border shadow-sm">
              <h4 className="font-semibold mb-3">Timeline</h4>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-600">Created:</span>
                  <span className="text-gray-900">{idea.created}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Updated:</span>
                  <span className="text-gray-900">{idea.updated}</span>
                </div>
              </div>
            </div>

            {/* Stage Actions */}
            <div className="bg-white p-4 rounded-lg border shadow-sm">
              <h4 className="font-semibold mb-3">Actions</h4>
              <div className="space-y-2">
                {idea.stage === 'suggested' && (
                  <button className="w-full px-3 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 text-sm">
                    Run Deep Dive Analysis
                  </button>
                )}
                {idea.stage === 'deep_dive' && (
                  <button className="w-full px-3 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 text-sm">
                    Start Iteration Process
                  </button>
                )}
                {idea.stage === 'iterating' && (
                  <div className="space-y-2">
                    <button className="w-full px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm">
                      Run Investor Lens
                    </button>
                    <button className="w-full px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm">
                      Run Customer Lens
                    </button>
                    <button className="w-full px-3 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 text-sm">
                      Ready for Review
                    </button>
                  </div>
                )}
                {idea.stage === 'considering' && (
                  <div className="space-y-2">
                    <button className="w-full px-3 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 text-sm">
                      Generate One-Pager
                    </button>
                    <button className="w-full px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm">
                      Export Analysis
                    </button>
                  </div>
                )}
                {idea.stage === 'closed' && idea.reopenPotential && (
                  <button className="w-full px-3 py-2 bg-yellow-600 text-white rounded-lg hover:bg-yellow-700 text-sm">
                    Reopen Idea
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto">
        <div className="mb-8">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Idea Pipeline</h1>
              <p className="text-gray-600 mt-2">Drag ideas between stages to track their evolution</p>
            </div>
            <button className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">
              <Plus className="w-5 h-5 mr-2" />
              Generate New Ideas
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6">
          {stages.map((stage) => {
            const stageIdeas = ideas.filter(idea => idea.stage === stage.id);
            const StageIcon = stage.icon;
            
            return (
              <div
                key={stage.id}
                className={`${stage.color} rounded-lg p-4 min-h-96`}
                onDragOver={handleDragOver}
                onDragEnter={handleDragEnter}
                onDragLeave={handleDragLeave}
                onDrop={(e) => handleDrop(e, stage.id)}
              >
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center space-x-2">
                    <StageIcon className={`w-5 h-5 ${stage.accentColor}`} />
                    <h3 className="font-semibold text-gray-900">{stage.name}</h3>
                  </div>
                  <span className="bg-white text-gray-600 px-2 py-1 rounded-full text-sm font-medium">
                    {stageIdeas.length}
                  </span>
                </div>

                <div className="space-y-3">
                  {stageIdeas.map((idea) => (
                    <div
                      key={idea.id}
                      draggable
                      onDragStart={(e) => handleDragStart(e, idea)}
                      onDragEnd={handleDragEnd}
                      className="bg-white p-4 rounded-lg shadow-sm border cursor-move hover:shadow-lg transition-all duration-200 hover:scale-[1.02] group"
                    >
                      {/* Header with Title and Actions */}
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex-1">
                          <div className="flex items-center space-x-2 mb-1">
                            <h4 
                              className="font-semibold text-gray-900 cursor-pointer hover:text-blue-600 transition-colors"
                              onClick={() => openModal(idea)}
                            >
                              {idea.title}
                            </h4>
                            {idea.type === 'full_scale' && (
                              <div className="w-2 h-2 bg-purple-500 rounded-full" title="Full Scale"></div>
                            )}
                          </div>
                          <div className="flex items-center space-x-2">
                            <span className={`px-2 py-1 text-xs font-bold rounded-full border-2 ${
                              idea.score >= 8 ? 'bg-green-50 text-green-700 border-green-200' : 
                              idea.score >= 6 ? 'bg-yellow-50 text-yellow-700 border-yellow-200' : 
                              'bg-red-50 text-red-700 border-red-200'
                            }`}>
                              ★ {idea.score}/10
                            </span>
                            <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                              idea.mvp_effort <= 3 ? 'bg-green-100 text-green-800' : 
                              idea.mvp_effort <= 6 ? 'bg-yellow-100 text-yellow-800' : 
                              'bg-red-100 text-red-800'
                            }`}>
                              ⚡ {idea.mvp_effort}
                            </span>
                          </div>
                        </div>
                        <div className="flex items-center space-x-1">
                          <Eye 
                            className="w-4 h-4 text-gray-400 hover:text-blue-500 cursor-pointer opacity-0 group-hover:opacity-100 transition-opacity"
                            onClick={() => openModal(idea)}
                          />
                        </div>
                      </div>
                      
                      {/* Visual Score Bar */}
                      <div className="mb-3">
                        <div className="flex justify-between text-xs text-gray-500 mb-1">
                          <span>Potential</span>
                          <span>{idea.score * 10}%</span>
                        </div>
                        <div className="w-full bg-gray-200 rounded-full h-2">
                          <div 
                            className={`h-2 rounded-full transition-all duration-500 ${
                              idea.score >= 8 ? 'bg-gradient-to-r from-green-400 to-green-600' : 
                              idea.score >= 6 ? 'bg-gradient-to-r from-yellow-400 to-yellow-600' : 
                              'bg-gradient-to-r from-red-400 to-red-600'
                            }`}
                            style={{width: `${(idea.score/10)*100}%`}}
                          ></div>
                        </div>
                      </div>
                      
                      <p className="text-sm text-gray-600 mb-3 line-clamp-2">{idea.hook}</p>
                      
                      {/* Key Metrics Visual */}
                      <div className="grid grid-cols-2 gap-2 mb-3">
                        <div className="bg-gray-50 rounded-lg p-2">
                          <div className="flex items-center justify-between">
                            <span className="text-xs text-gray-600">Market</span>
                            <TrendingUp className="w-3 h-3 text-blue-500" />
                          </div>
                          <div className="mt-1">
                            <div className="w-full bg-gray-200 rounded-full h-1">
                              <div 
                                className="bg-blue-500 h-1 rounded-full" 
                                style={{width: `${Math.min((idea.score * 8), 100)}%`}}
                              ></div>
                            </div>
                          </div>
                        </div>
                        <div className="bg-gray-50 rounded-lg p-2">
                          <div className="flex items-center justify-between">
                            <span className="text-xs text-gray-600">Effort</span>
                            <Zap className="w-3 h-3 text-orange-500" />
                          </div>
                          <div className="mt-1">
                            <div className="w-full bg-gray-200 rounded-full h-1">
                              <div 
                                className="bg-orange-500 h-1 rounded-full" 
                                style={{width: `${(idea.mvp_effort/10)*100}%`}}
                              ></div>
                            </div>
                          </div>
                        </div>
                      </div>
                      
                      {/* Stage-specific Indicators */}
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center space-x-1">
                          {idea.deepDive && (
                            <div className="flex items-center space-x-1 bg-purple-50 px-2 py-1 rounded-full">
                              <Brain className="w-3 h-3 text-purple-600" />
                              <span className="text-xs text-purple-600 font-medium">Analysis</span>
                            </div>
                          )}
                          {idea.lenses && (
                            <div className="flex items-center space-x-1 bg-orange-50 px-2 py-1 rounded-full">
                              <Users className="w-3 h-3 text-orange-600" />
                              <span className="text-xs text-orange-600 font-medium">{Object.keys(idea.lenses).length} Lenses</span>
                            </div>
                          )}
                          {idea.onePager && (
                            <div className="flex items-center space-x-1 bg-green-50 px-2 py-1 rounded-full">
                              <FileText className="w-3 h-3 text-green-600" />
                              <span className="text-xs text-green-600 font-medium">Ready</span>
                            </div>
                          )}
                          {idea.stage === 'closed' && (
                            <div className="flex items-center space-x-1 bg-gray-100 px-2 py-1 rounded-full">
                              <Archive className="w-3 h-3 text-gray-600" />
                              <span className="text-xs text-gray-600 font-medium">Archived</span>
                            </div>
                          )}
                        </div>
                        
                        {/* Go/No-Go Indicator */}
                        {idea.deepDive && (
                          <div className={`px-2 py-1 rounded-full text-xs font-bold ${
                            idea.deepDive.goNoGo === 'Go' ? 'bg-green-100 text-green-800' : 
                            idea.deepDive.goNoGo === 'Proceed with Caution' ? 'bg-yellow-100 text-yellow-800' : 
                            'bg-red-100 text-red-800'
                          }`}>
                            {idea.deepDive.goNoGo === 'Go' ? '🟢' : 
                             idea.deepDive.goNoGo === 'Proceed with Caution' ? '🟡' : '🔴'}
                          </div>
                        )}
                      </div>
                      
                      {/* Deep Dive Score Breakdown */}
                      {idea.deepDive && (
                        <div className="bg-gray-50 rounded-lg p-2 mb-2">
                          <div className="text-xs text-gray-600 mb-2 font-medium">Signal Scores</div>
                          <div className="grid grid-cols-2 gap-1 text-xs">
                            {Object.entries(idea.deepDive.signalScore).slice(0, 4).map(([key, value]) => (
                              <div key={key} className="flex items-center justify-between">
                                <span className="text-gray-600 truncate" title={key}>
                                  {key.split(' ')[0]}
                                </span>
                                <div className="flex items-center space-x-1">
                                  <div className="w-8 bg-gray-200 rounded-full h-1">
                                    <div 
                                      className={`h-1 rounded-full ${
                                        value >= 8 ? 'bg-green-500' : value >= 6 ? 'bg-yellow-500' : 'bg-red-500'
                                      }`}
                                      style={{width: `${(value/10)*100}%`}}
                                    ></div>
                                  </div>
                                  <span className="font-bold text-gray-700">{value}</span>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                      
                      {/* Footer */}
                      <div className="flex items-center justify-between text-xs text-gray-500 mt-2 pt-2 border-t border-gray-100">
                        <div className="flex items-center space-x-2">
                          <span className={`px-2 py-1 rounded-full font-medium ${
                            idea.type === 'full_scale' ? 'bg-purple-100 text-purple-700' : 'bg-blue-100 text-blue-700'
                          }`}>
                            {idea.type === 'full_scale' ? '🚀 Scale' : '💡 Side'}
                          </span>
                        </div>
                        <div className="flex items-center space-x-1">
                          <span>{idea.updated}</span>
                          {Date.now() - new Date(idea.updated).getTime() < 86400000 && (
                            <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse" title="Recently updated"></div>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Modal */}
      {selectedIdea && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg max-w-6xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              {renderModalContent(selectedIdea)}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default IdeaKanbanBoard;