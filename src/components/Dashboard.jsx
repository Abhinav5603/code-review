import React, { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import {
  ArrowLeft,
  CheckCircle,
  Upload,
  Github,
  FileCode,
  AlertCircle,
  Clock,
  GitBranch,
  Users,
  Zap,
  LogOut,
  FolderOpen,
  File,
  AlertTriangle,
  Info,
  Bug,
  Shield,
  Cpu,
  Code,
  Settings,
  Target,
} from "lucide-react";

// Backend API URL
const API_BASE = "http://localhost:5000";

// Code Review UI Component for regular users
function CodeReviewUI({ onBack, profile, onLogout }) {
  const handleLogout = async () => {
    try {
      const { error } = await supabase.auth.signOut();
      if (error) {
        console.error("Error logging out:", error);
      } else {
        if (onLogout) onLogout();
      }
    } catch (error) {
      console.error("Unexpected error during logout:", error);
    }
  };

  const [activeTab, setActiveTab] = useState("upload");
  const [uploadedFiles, setUploadedFiles] = useState([]);
  const [githubConnected, setGithubConnected] = useState(false);
  const [githubToken, setGithubToken] = useState("");
  const [githubUser, setGithubUser] = useState(null);
  const [repositories, setRepositories] = useState([]);
  const [selectedRepo, setSelectedRepo] = useState(null);
  const [repoFiles, setRepoFiles] = useState([]);
  const [currentPath, setCurrentPath] = useState("");
  const [selectedFiles, setSelectedFiles] = useState([]);
  const [reviewResults, setReviewResults] = useState([]);
  const [loading, setLoading] = useState(false);

  // Handle file uploads
  const handleFileUpload = async (event) => {
    const files = Array.from(event.target.files);
    if (files.length > 2) {
      alert("You can only select up to 2 files for review.");
      return;
    }

    setLoading(true);

    for (let file of files) {
      const text = await file.text();

      // Mark as pending
      const pendingFile = {
        id: Date.now() + Math.random(),
        name: file.name,
        size: file.size,
        status: "pending",
      };
      setUploadedFiles((prev) => [...prev, pendingFile]);

      try {
        const res = await fetch(`${API_BASE}/analyze`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ 
            code: text, 
            filename: file.name 
          }),
        });

        if (!res.ok) {
          throw new Error(`HTTP error! status: ${res.status}`);
        }

        const results = await res.json();
        console.log("Analysis results:", results);

        setReviewResults((prev) => [
          ...prev,
          {
            id: pendingFile.id,
            name: file.name,
            code: text,
            status: "completed",
            ...results
          },
        ]);

        // Update uploaded file status
        setUploadedFiles((prev) =>
          prev.map((f) =>
            f.id === pendingFile.id ? { ...f, status: "completed" } : f
          )
        );
      } catch (err) {
        console.error("Error analyzing file:", err);
        setUploadedFiles((prev) =>
          prev.map((f) =>
            f.id === pendingFile.id ? { ...f, status: "error" } : f
          )
        );
        alert(`Error analyzing ${file.name}: ${err.message}`);
      }
    }
    setLoading(false);
  };

  // GitHub Integration Functions
  const connectGitHub = async () => {
    if (!githubToken.trim()) {
      alert("Please enter your GitHub personal access token");
      return;
    }

    try {
      setLoading(true);
      const res = await fetch(`${API_BASE}/github/connect`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token: githubToken }),
      });

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.message || "Failed to connect to GitHub");
      }

      const data = await res.json();
      setGithubUser(data.user);
      setGithubConnected(true);
      
      // Fetch repositories
      await fetchRepositories();
    } catch (error) {
      console.error("GitHub connection error:", error);
      alert(`GitHub connection failed: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const fetchRepositories = async () => {
    try {
      const res = await fetch(`${API_BASE}/github/repos?token=${githubToken}`);
      
      if (!res.ok) {
        throw new Error("Failed to fetch repositories");
      }

      const repos = await res.json();
      setRepositories(repos);
    } catch (error) {
      console.error("Error fetching repositories:", error);
      alert(`Failed to fetch repositories: ${error.message}`);
    }
  };

  const selectRepository = async (repo) => {
    setSelectedRepo(repo);
    setCurrentPath("");
    setSelectedFiles([]);
    await fetchRepoFiles(repo, "");
  };

  const fetchRepoFiles = async (repo, path) => {
    try {
      setLoading(true);
      const [owner, repoName] = repo.full_name.split("/");
      const res = await fetch(`${API_BASE}/github/files?token=${githubToken}&owner=${owner}&repo=${repoName}&path=${path}`);
      
      if (!res.ok) {
        throw new Error("Failed to fetch files");
      }

      const files = await res.json();
      setRepoFiles(files);
      setCurrentPath(path);
    } catch (error) {
      console.error("Error fetching files:", error);
      alert(`Failed to fetch files: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const navigateToFolder = (folder) => {
    fetchRepoFiles(selectedRepo, folder.path);
  };

  const toggleFileSelection = (file) => {
    if (selectedFiles.some(f => f.path === file.path)) {
      setSelectedFiles(prev => prev.filter(f => f.path !== file.path));
    } else {
      if (selectedFiles.length >= 2) {
        alert("You can only select up to 2 files for review.");
        return;
      }
      setSelectedFiles(prev => [...prev, file]);
    }
  };

  const reviewSelectedFiles = async () => {
    if (selectedFiles.length === 0) {
      alert("Please select at least one file to review");
      return;
    }

    setLoading(true);
    try {
      const [owner, repoName] = selectedRepo.full_name.split("/");

      for (let file of selectedFiles) {
        // Fetch file content
        const contentRes = await fetch(`${API_BASE}/github/file-content?token=${githubToken}&owner=${owner}&repo=${repoName}&path=${file.path}`);
        
        if (!contentRes.ok) {
          throw new Error(`Failed to fetch content for ${file.name}`);
        }

        const fileData = await contentRes.json();

        // Mark as pending
        const pendingFile = {
          id: Date.now() + Math.random(),
          name: file.name,
          size: file.size,
          status: "pending",
          source: "github",
        };
        setUploadedFiles((prev) => [...prev, pendingFile]);

        // Analyze with backend
        const analyzeRes = await fetch(`${API_BASE}/analyze`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ 
            code: fileData.content, 
            filename: file.name 
          }),
        });

        if (!analyzeRes.ok) {
          throw new Error(`Analysis failed for ${file.name}`);
        }

        const results = await analyzeRes.json();

        setReviewResults((prev) => [
          ...prev,
          {
            id: pendingFile.id,
            name: file.name,
            code: fileData.content,
            status: "completed",
            source: "github",
            ...results
          },
        ]);

        // Update uploaded file status
        setUploadedFiles((prev) =>
          prev.map((f) =>
            f.id === pendingFile.id ? { ...f, status: "completed" } : f
          )
        );
      }
    } catch (error) {
      console.error("Error reviewing files:", error);
      alert(`Error reviewing files: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  // Helper functions for error categorization
  const getLevelIcon = (level) => {
    switch (level) {
      case 'architectural':
        return <Settings className="w-4 h-4 text-violet-400" />;
      case 'syntax':
        return <Code className="w-4 h-4 text-rose-400" />;
      case 'logical':
        return <Target className="w-4 h-4 text-amber-400" />;
      case 'performance':
        return <Cpu className="w-4 h-4 text-emerald-400" />;
      case 'security':
        return <Shield className="w-4 h-4 text-red-400" />;
      default:
        return <AlertCircle className="w-4 h-4 text-slate-400" />;
    }
  };

  const getLevelColor = (level) => {
    switch (level) {
      case 'architectural':
        return 'bg-gradient-to-r from-violet-500/20 to-purple-500/20 border-violet-400/30 text-violet-200';
      case 'syntax':
        return 'bg-gradient-to-r from-rose-500/20 to-pink-500/20 border-rose-400/30 text-rose-200';
      case 'logical':
        return 'bg-gradient-to-r from-amber-500/20 to-orange-500/20 border-amber-400/30 text-amber-200';
      case 'performance':
        return 'bg-gradient-to-r from-emerald-500/20 to-green-500/20 border-emerald-400/30 text-emerald-200';
      case 'security':
        return 'bg-gradient-to-r from-red-500/20 to-rose-500/20 border-red-400/30 text-red-200';
      default:
        return 'bg-gradient-to-r from-slate-500/20 to-gray-500/20 border-slate-400/30 text-slate-200';
    }
  };

  const getSeverityIcon = (severity) => {
    switch (severity) {
      case 'critical':
        return <AlertTriangle className="w-4 h-4 text-red-400" />;
      case 'high':
        return <AlertCircle className="w-4 h-4 text-orange-400" />;
      case 'medium':
        return <Info className="w-4 h-4 text-yellow-400" />;
      case 'low':
        return <Bug className="w-4 h-4 text-cyan-400" />;
      default:
        return <AlertCircle className="w-4 h-4 text-slate-400" />;
    }
  };

  // Sort errors by level and then by line number
  const sortErrors = (errors) => {
    const levelOrder = ['architectural', 'syntax', 'logical', 'performance', 'security'];
    
    return [...errors].sort((a, b) => {
      const aLevelIndex = levelOrder.indexOf(a.level || 'logical');
      const bLevelIndex = levelOrder.indexOf(b.level || 'logical');
      
      if (aLevelIndex !== bLevelIndex) {
        return aLevelIndex - bLevelIndex;
      }
      
      return (a.line || 0) - (b.line || 0);
    });
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-indigo-900">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-cyan-400/20 via-blue-500/20 to-purple-600/20"></div>
      <div className="relative z-10 container mx-auto px-4 py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center space-x-4">
            <button
              onClick={onBack}
              className="p-3 bg-white/10 hover:bg-white/20 rounded-xl text-white transition-all duration-300 hover:scale-105 backdrop-blur-sm border border-white/10"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div className="flex items-center space-x-3">
              <div className="w-14 h-14 bg-gradient-to-r from-cyan-400 to-blue-500 rounded-2xl flex items-center justify-center shadow-lg shadow-cyan-500/30">
                <Zap className="w-7 h-7 text-white" />
              </div>
              <div>
                <h1 className="text-3xl font-bold bg-gradient-to-r from-cyan-300 to-blue-300 bg-clip-text text-transparent">
                  Code Review Bot
                </h1>
                <p className="text-slate-300">
                  AI-powered code analysis and optimization
                </p>
              </div>
            </div>
          </div>

          {/* User Info & Logout */}
          <div className="flex items-center space-x-4">
            <div className="text-right bg-white/5 backdrop-blur-sm rounded-xl p-3 border border-white/10">
              <p className="text-white font-semibold">{profile?.name || "User"}</p>
              <p className="text-slate-300 text-sm">{profile?.email}</p>
            </div>
            <button
              onClick={handleLogout}
              className="p-3 bg-gradient-to-r from-red-500/20 to-pink-500/20 hover:from-red-500/30 hover:to-pink-500/30 rounded-xl text-red-300 hover:text-white transition-all duration-300 group backdrop-blur-sm border border-red-500/20"
              title="Logout"
            >
              <LogOut className="w-5 h-5 group-hover:scale-110 transition-transform" />
            </button>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="flex space-x-2 bg-white/5 backdrop-blur-lg rounded-2xl p-2 mb-8 max-w-md border border-white/10">
          <button
            onClick={() => setActiveTab("upload")}
            className={`flex-1 py-3 px-6 rounded-xl text-sm font-semibold transition-all duration-300 ${
              activeTab === "upload"
                ? "bg-gradient-to-r from-cyan-500 to-blue-500 text-white shadow-lg shadow-cyan-500/30"
                : "text-slate-300 hover:text-white hover:bg-white/10"
            }`}
          >
            <Upload className="w-4 h-4 inline mr-2" />
            Manual Upload
          </button>
          <button
            onClick={() => setActiveTab("github")}
            className={`flex-1 py-3 px-6 rounded-xl text-sm font-semibold transition-all duration-300 ${
              activeTab === "github"
                ? "bg-gradient-to-r from-cyan-500 to-blue-500 text-white shadow-lg shadow-cyan-500/30"
                : "text-slate-300 hover:text-white hover:bg-white/10"
            }`}
          >
            <Github className="w-4 h-4 inline mr-2" />
            GitHub
          </button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Main Content */}
          <div className="lg:col-span-2 space-y-8">
            {activeTab === "upload" && (
              <div className="bg-white/5 backdrop-blur-xl rounded-3xl p-8 shadow-2xl border border-white/10">
                <h2 className="text-2xl font-bold text-white mb-8 bg-gradient-to-r from-cyan-300 to-blue-300 bg-clip-text text-transparent">
                  Upload Code Files
                </h2>

                {/* File Upload Area */}
                <div className="border-2 border-dashed border-cyan-400/40 rounded-2xl p-12 text-center mb-8 hover:border-cyan-400/60 transition-all duration-300 bg-gradient-to-br from-cyan-500/5 to-blue-500/5">
                  <div className="w-16 h-16 bg-gradient-to-r from-cyan-400 to-blue-500 rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-lg shadow-cyan-500/30">
                    <FileCode className="w-8 h-8 text-white" />
                  </div>
                  <p className="text-white text-lg mb-2 font-semibold">
                    Drag and drop your code files here
                  </p>
                  <p className="text-slate-300 mb-6">
                    Supports .js, .jsx, .ts, .tsx, .py, .java, .cpp, .c, .cs, .php, .rb, .go, .rs
                  </p>
                  <label className="inline-block">
                    <input
                      type="file"
                      multiple
                      accept=".js,.jsx,.ts,.tsx,.py,.java,.cpp,.c,.cs,.php,.rb,.go,.rs"
                      onChange={handleFileUpload}
                      className="hidden"
                      disabled={loading}
                    />
                    <span className={`px-8 py-4 rounded-xl cursor-pointer transition-all duration-300 font-semibold ${
                      loading 
                        ? 'bg-slate-600 text-slate-300 cursor-not-allowed' 
                        : 'bg-gradient-to-r from-cyan-500 to-blue-500 hover:from-cyan-600 hover:to-blue-600 text-white shadow-lg shadow-cyan-500/30 hover:scale-105'
                    }`}>
                      {loading ? 'Analyzing...' : 'Choose Files'}
                    </span>
                  </label>
                </div>

                {/* Uploaded Files */}
                {uploadedFiles.length > 0 && (
                  <div>
                    <h3 className="text-xl font-semibold text-white mb-6">
                      Uploaded Files
                    </h3>
                    <div className="space-y-4">
                      {uploadedFiles.map((file) => (
                        <div
                          key={file.id}
                          className="flex items-center justify-between p-6 bg-gradient-to-r from-white/5 to-white/10 rounded-2xl border border-white/10 backdrop-blur-sm"
                        >
                          <div className="flex items-center space-x-4">
                            <div className="w-12 h-12 bg-gradient-to-r from-blue-500 to-purple-500 rounded-xl flex items-center justify-center">
                              <FileCode className="w-6 h-6 text-white" />
                            </div>
                            <div>
                              <p className="text-white font-semibold text-lg">{file.name}</p>
                              <p className="text-slate-300">
                                {(file.size / 1024).toFixed(1)} KB
                                {file.source && ` • ${file.source}`}
                              </p>
                            </div>
                          </div>
                          <div className="flex items-center space-x-3">
                            {file.status === "pending" ? (
                              <Clock className="w-6 h-6 text-amber-400 animate-spin" />
                            ) : file.status === "completed" ? (
                              <CheckCircle className="w-6 h-6 text-emerald-400" />
                            ) : (
                              <AlertCircle className="w-6 h-6 text-red-400" />
                            )}
                            <span className="text-slate-200 font-medium capitalize">
                              {file.status}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {activeTab === "github" && (
              <div className="bg-white/5 backdrop-blur-xl rounded-3xl p-8 shadow-2xl border border-white/10">
                <h2 className="text-2xl font-bold text-white mb-8 bg-gradient-to-r from-cyan-300 to-blue-300 bg-clip-text text-transparent">
                  GitHub Integration
                </h2>
                {!githubConnected ? (
                  <div className="text-center py-16">
                    <div className="w-20 h-20 bg-gradient-to-r from-gray-700 to-gray-900 rounded-3xl flex items-center justify-center mx-auto mb-8 shadow-lg">
                      <Github className="w-10 h-10 text-white" />
                    </div>
                    <h3 className="text-2xl font-semibold text-white mb-6">
                      Connect Your GitHub Account
                    </h3>
                    <p className="text-slate-300 mb-8 max-w-md mx-auto text-lg">
                      Enter your GitHub personal access token to review files from your repositories.
                    </p>
                    <div className="max-w-md mx-auto mb-8">
                      <input
                        type="password"
                        placeholder="GitHub Personal Access Token"
                        value={githubToken}
                        onChange={(e) => setGithubToken(e.target.value)}
                        className="w-full px-6 py-4 bg-white/10 border border-white/20 rounded-xl text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-cyan-500 backdrop-blur-sm transition-all duration-300"
                      />
                      <p className="text-slate-400 text-sm mt-3">
                        Generate token at: Settings → Developer settings → Personal access tokens
                      </p>
                    </div>
                    <button
                      onClick={connectGitHub}
                      disabled={loading}
                      className={`px-10 py-4 rounded-xl font-semibold transition-all duration-300 flex items-center space-x-3 mx-auto ${
                        loading
                          ? 'bg-slate-600 cursor-not-allowed text-slate-300'
                          : 'bg-gradient-to-r from-gray-700 to-gray-900 hover:from-gray-600 hover:to-gray-800 text-white shadow-lg hover:scale-105'
                      }`}
                    >
                      <Github className="w-5 h-5" />
                      <span>{loading ? 'Connecting...' : 'Connect GitHub'}</span>
                    </button>
                  </div>
                ) : (
                  <div>
                    <div className="flex items-center space-x-4 text-emerald-300 mb-8 p-6 bg-gradient-to-r from-emerald-500/10 to-green-500/10 rounded-2xl border border-emerald-400/20">
                      <CheckCircle className="w-6 h-6" />
                      <div>
                        <p className="font-semibold text-lg">Connected as {githubUser?.name || githubUser?.login}</p>
                        <p className="text-emerald-300/70">@{githubUser?.login}</p>
                      </div>
                    </div>

                    {!selectedRepo ? (
                      <div>
                        <h3 className="text-xl font-semibold text-white mb-6">
                          Select Repository ({repositories.length} available)
                        </h3>
                        <div className="space-y-4 mb-6 max-h-96 overflow-y-auto">
                          {repositories.map((repo, index) => (
                            <div
                              key={index}
                              onClick={() => selectRepository(repo)}
                              className="p-6 rounded-2xl border bg-gradient-to-r from-white/5 to-white/10 border-white/10 hover:from-white/10 hover:to-white/20 cursor-pointer transition-all duration-300 backdrop-blur-sm hover:scale-105"
                            >
                              <div className="flex items-center justify-between">
                                <div>
                                  <div className="flex items-center space-x-3">
                                    <GitBranch className="w-5 h-5 text-cyan-400" />
                                    <span className="text-white font-semibold text-lg">
                                      {repo.name}
                                    </span>
                                    {repo.private && (
                                      <span className="px-3 py-1 bg-gradient-to-r from-amber-500/20 to-yellow-500/20 text-amber-300 text-sm rounded-lg border border-amber-400/20">
                                        Private
                                      </span>
                                    )}
                                  </div>
                                  <p className="text-slate-300 mt-2">
                                    {repo.language || 'No language'} • Updated {new Date(repo.updated_at).toLocaleDateString()}
                                  </p>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    ) : (
                      <div>
                        <div className="flex items-center justify-between mb-6">
                          <h3 className="text-xl font-semibold text-white">
                            Repository: {selectedRepo.name}
                          </h3>
                          <button
                            onClick={() => setSelectedRepo(null)}
                            className="px-6 py-3 bg-gradient-to-r from-white/10 to-white/20 hover:from-white/20 hover:to-white/30 text-white rounded-xl font-medium transition-all duration-300"
                          >
                            Change Repo
                          </button>
                        </div>
                        
                        {/* File Browser */}
                        <div className="mb-6">
                          <p className="text-slate-300 mb-3">
                            Path: /{currentPath || 'root'}
                          </p>
                          <div className="bg-gradient-to-r from-white/5 to-white/10 rounded-2xl border border-white/10 max-h-64 overflow-y-auto backdrop-blur-sm">
                            {repoFiles.map((file, index) => (
                              <div
                                key={index}
                                className={`p-4 border-b border-white/5 last:border-b-0 flex items-center justify-between hover:bg-white/10 cursor-pointer transition-all duration-300 ${
                                  file.type === 'file' && selectedFiles.some(f => f.path === file.path)
                                    ? 'bg-gradient-to-r from-cyan-500/20 to-blue-500/20 border-l-4 border-l-cyan-400'
                                    : ''
                                }`}
                                onClick={() => {
                                  if (file.type === 'dir') {
                                    navigateToFolder(file);
                                  } else {
                                    toggleFileSelection(file);
                                  }
                                }}
                              >
                                <div className="flex items-center space-x-3">
                                  {file.type === 'dir' ? (
                                    <FolderOpen className="w-5 h-5 text-amber-400" />
                                  ) : (
                                    <File className="w-5 h-5 text-cyan-400" />
                                  )}
                                  <span className="text-white font-medium">{file.name}</span>
                                </div>
                                {file.type === 'file' && (
                                  <div className="flex items-center space-x-2">
                                    <span className="text-slate-300 text-sm">
                                      {(file.size / 1024).toFixed(1)} KB
                                    </span>
                                    {selectedFiles.some(f => f.path === file.path) && (
                                      <CheckCircle className="w-4 h-4 text-emerald-400" />
                                    )}
                                  </div>
                                )}
                              </div>
                            ))}
                          </div>
                        </div>

                        {/* Selected Files & Review Button */}
                        {selectedFiles.length > 0 && (
                          <div className="mb-6 p-6 bg-gradient-to-r from-cyan-500/10 to-blue-500/10 rounded-2xl border border-cyan-400/20 backdrop-blur-sm">
                            <p className="text-cyan-300 font-semibold mb-3 text-lg">
                              Selected Files ({selectedFiles.length}/2):
                            </p>
                            <div className="space-y-2 mb-4">
                              {selectedFiles.map((file, index) => (
                                <p key={index} className="text-cyan-200">
                                  • {file.name}
                                </p>
                              ))}
                            </div>
                            <button
                              onClick={reviewSelectedFiles}
                              disabled={loading}
                              className={`w-full py-4 rounded-xl font-semibold transition-all duration-300 ${
                                loading
                                  ? 'bg-slate-600 cursor-not-allowed text-slate-300'
                                  : 'bg-gradient-to-r from-cyan-500 to-blue-500 hover:from-cyan-600 hover:to-blue-600 text-white shadow-lg shadow-cyan-500/30 hover:scale-105'
                              }`}
                            >
                              {loading ? 'Analyzing...' : `Review ${selectedFiles.length} File(s)`}
                            </button>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Review Results */}
            {reviewResults.length > 0 && (
              <div className="bg-white/5 backdrop-blur-xl rounded-3xl p-8 shadow-2xl border border-white/10">
                <h2 className="text-2xl font-bold text-white mb-8 bg-gradient-to-r from-cyan-300 to-blue-300 bg-clip-text text-transparent">
                  Review Results
                </h2>
                <div className="space-y-8">
                  {reviewResults.map((result) => (
                    <div
                      key={result.id}
                      className="p-8 bg-gradient-to-r from-white/5 to-white/10 rounded-3xl border border-white/10 backdrop-blur-sm"
                    >
                      <div className="flex items-center justify-between mb-6">
                        <div className="flex items-center space-x-4">
                          <div className="w-12 h-12 bg-gradient-to-r from-blue-500 to-purple-500 rounded-2xl flex items-center justify-center shadow-lg">
                            <FileCode className="w-6 h-6 text-white" />
                          </div>
                          <div>
                            <span className="text-white font-semibold text-lg">
                              {result.name}
                            </span>
                            {result.source && (
                              <span className="ml-3 px-3 py-1 bg-gradient-to-r from-purple-500/20 to-pink-500/20 text-purple-300 text-sm rounded-lg border border-purple-400/20">
                                {result.source}
                              </span>
                            )}
                          </div>
                        </div>
                        {result.summary && (
                          <div className="text-right">
                            <p className="text-slate-300">
                              Quality: <span className="font-semibold text-white capitalize">{result.summary.codeQuality}</span>
                            </p>
                          </div>
                        )}
                      </div>

                      {/* Summary Stats */}
                      {result.summary && (
                        <div className="grid grid-cols-3 gap-6 mb-8 p-6 bg-gradient-to-r from-slate-800/30 to-slate-700/30 rounded-2xl backdrop-blur-sm border border-white/5">
                          <div className="text-center">
                            <div className="w-16 h-16 bg-gradient-to-r from-red-500 to-rose-500 rounded-2xl flex items-center justify-center mx-auto mb-3 shadow-lg">
                              <p className="text-2xl font-bold text-white">{result.summary.totalErrors || 0}</p>
                            </div>
                            <p className="text-slate-300 text-sm font-medium">Total Errors</p>
                          </div>
                          <div className="text-center">
                            <div className="w-16 h-16 bg-gradient-to-r from-orange-500 to-amber-500 rounded-2xl flex items-center justify-center mx-auto mb-3 shadow-lg">
                              <p className="text-2xl font-bold text-white">{result.summary.criticalErrors || 0}</p>
                            </div>
                            <p className="text-slate-300 text-sm font-medium">Critical</p>
                          </div>
                          <div className="text-center">
                            <div className="w-16 h-16 bg-gradient-to-r from-yellow-500 to-amber-500 rounded-2xl flex items-center justify-center mx-auto mb-3 shadow-lg">
                              <p className="text-2xl font-bold text-white">{result.summary.warnings || 0}</p>
                            </div>
                            <p className="text-slate-300 text-sm font-medium">Warnings</p>
                          </div>
                        </div>
                      )}

                      {/* Errors */}
                      {result.errors && result.errors.length > 0 ? (
                        <div className="mb-6">
                          <h4 className="text-white font-semibold mb-4 flex items-center space-x-2 text-lg">
                            <AlertTriangle className="w-5 h-5 text-red-400" />
                            <span>Issues Found ({result.errors.length})</span>
                          </h4>
                          <div className="space-y-4">
                            {sortErrors(result.errors).map((err, idx) => (
                              <div
                                key={idx}
                                className={`p-6 rounded-2xl border-2 backdrop-blur-sm ${getLevelColor(err.level)}`}
                              >
                                <div className="flex items-start space-x-4">
                                  <div className="flex items-center space-x-2">
                                    {getLevelIcon(err.level)}
                                    {getSeverityIcon(err.severity)}
                                  </div>
                                  <div className="flex-1">
                                    <div className="flex items-center space-x-3 mb-3">
                                      <span className="font-semibold">
                                        Line {err.line || 'N/A'}
                                      </span>
                                      <span className="px-3 py-1 bg-black/30 rounded-lg text-sm uppercase font-semibold">
                                        {err.level || 'General'}
                                      </span>
                                      {err.severity && (
                                        <span className="px-3 py-1 bg-black/30 rounded-lg text-sm uppercase font-semibold">
                                          {err.severity}
                                        </span>
                                      )}
                                      {err.type && (
                                        <span className="px-3 py-1 bg-black/30 rounded-lg text-sm">
                                          {err.type}
                                        </span>
                                      )}
                                    </div>
                                    <p className="text-sm mb-3 font-medium">{err.message}</p>
                                    {err.word && (
                                      <p className="text-sm mb-2">
                                        <strong>Issue at:</strong> <code className="bg-black/30 px-2 py-1 rounded">{err.word}</code>
                                      </p>
                                    )}
                                    {err.suggestion && (
                                      <p className="text-sm bg-black/20 p-4 rounded-xl mt-3 border border-white/10">
                                        <strong>Suggestion:</strong> {err.suggestion}
                                      </p>
                                    )}
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      ) : (
                        <div className="mb-6 p-6 bg-gradient-to-r from-emerald-500/10 to-green-500/10 rounded-2xl border border-emerald-400/20 backdrop-blur-sm">
                          <div className="flex items-center space-x-3">
                            <CheckCircle className="w-6 h-6 text-emerald-400" />
                            <p className="text-emerald-300 font-semibold">No issues found - Code looks excellent!</p>
                          </div>
                        </div>
                      )}

                      {/* Suggestions */}
                      {result.suggestions && result.suggestions.length > 0 && (
                        <div>
                          <h4 className="text-white font-semibold mb-4 flex items-center space-x-2 text-lg">
                            <Info className="w-5 h-5 text-blue-400" />
                            <span>Suggestions ({result.suggestions.length})</span>
                          </h4>
                          <div className="space-y-4">
                            {result.suggestions.map((suggestion, idx) => (
                              <div
                                key={idx}
                                className="p-6 bg-gradient-to-r from-blue-500/10 to-cyan-500/10 rounded-2xl border border-blue-400/20 backdrop-blur-sm"
                              >
                                <div className="flex items-start space-x-3">
                                  <Info className="w-5 h-5 text-blue-400 mt-1" />
                                  <div className="flex-1">
                                    <p className="text-blue-300 font-semibold mb-2">
                                      Line {suggestion.line || 'N/A'} • {suggestion.type || 'Improvement'}
                                    </p>
                                    <p className="text-blue-200 mb-2">{suggestion.message}</p>
                                    {suggestion.fix && (
                                      <p className="text-blue-100 bg-black/20 p-4 rounded-xl mt-3 border border-blue-400/10">
                                        <strong>Suggested improvement:</strong> {suggestion.fix}
                                      </p>
                                    )}
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Sidebar */}
          <div className="space-y-8">
            {/* Quick Stats */}
            <div className="bg-white/5 backdrop-blur-xl rounded-3xl p-8 shadow-2xl border border-white/10">
              <h3 className="text-xl font-bold text-white mb-6 bg-gradient-to-r from-cyan-300 to-blue-300 bg-clip-text text-transparent">Statistics</h3>
              <div className="space-y-6">
                <div className="flex justify-between items-center p-4 bg-gradient-to-r from-white/5 to-white/10 rounded-xl">
                  <span className="text-slate-300 font-medium">Files Reviewed</span>
                  <span className="text-white font-bold text-lg">
                    {reviewResults.length}
                  </span>
                </div>
                <div className="flex justify-between items-center p-4 bg-gradient-to-r from-red-500/10 to-rose-500/10 rounded-xl border border-red-400/20">
                  <span className="text-slate-300 font-medium">Total Issues</span>
                  <span className="text-red-300 font-bold text-lg">
                    {reviewResults.reduce(
                      (acc, r) => acc + (r.errors?.length || 0),
                      0
                    )}
                  </span>
                </div>
                <div className="flex justify-between items-center p-4 bg-gradient-to-r from-orange-500/10 to-amber-500/10 rounded-xl border border-orange-400/20">
                  <span className="text-slate-300 font-medium">Critical Issues</span>
                  <span className="text-orange-300 font-bold text-lg">
                    {reviewResults.reduce(
                      (acc, r) => acc + (r.errors?.filter(e => e.severity === 'critical')?.length || 0),
                      0
                    )}
                  </span>
                </div>
                <div className="flex justify-between items-center p-4 bg-gradient-to-r from-yellow-500/10 to-amber-500/10 rounded-xl border border-yellow-400/20">
                  <span className="text-slate-300 font-medium">Suggestions</span>
                  <span className="text-yellow-300 font-bold text-lg">
                    {reviewResults.reduce(
                      (acc, r) => acc + (r.suggestions?.length || 0),
                      0
                    )}
                  </span>
                </div>
                
                {/* Issue Breakdown by Level */}
                {reviewResults.some(r => r.errors?.length > 0) && (
                  <div className="pt-6 border-t border-white/10">
                    <h4 className="text-white font-semibold mb-4">Issues by Level</h4>
                    <div className="space-y-3">
                      {['architectural', 'syntax', 'logical', 'performance', 'security'].map(level => {
                        const count = reviewResults.reduce(
                          (acc, r) => acc + (r.errors?.filter(e => e.level === level)?.length || 0),
                          0
                        );
                        if (count === 0) return null;
                        return (
                          <div key={level} className="flex justify-between items-center p-3 bg-gradient-to-r from-white/5 to-white/10 rounded-xl">
                            <div className="flex items-center space-x-3">
                              {getLevelIcon(level)}
                              <span className="text-slate-300 capitalize font-medium">{level}</span>
                            </div>
                            <span className="text-white font-bold">{count}</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Loading Indicator */}
            {loading && (
              <div className="bg-white/5 backdrop-blur-xl rounded-3xl p-8 shadow-2xl border border-white/10">
                <div className="flex items-center space-x-4">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-cyan-400"></div>
                  <span className="text-white font-medium">Processing your code...</span>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// Main Dashboard Component
export default function Dashboard({ onBack, profile, onLogout }) {
  const handleLogout = async () => {
    try {
      const { error } = await supabase.auth.signOut();
      if (error) {
        console.error("Error logging out:", error);
      } else {
        if (onLogout) onLogout();
      }
    } catch (error) {
      console.error("Unexpected error during logout:", error);
    }
  };

  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchUsers = async () => {
      if (profile?.role === "admin") {
        try {
          const { data, error } = await supabase
            .from("profiles")
            .select("id, name, email")
            .order("name");

          if (error) {
            console.error("Error fetching users:", error.message);
          } else {
            setUsers(data || []);
          }
        } catch (error) {
          console.error("Error fetching users:", error);
        }
      }
      setLoading(false);
    };

    fetchUsers();
  }, [profile]);

  const handleViewHistory = (user) => {
    alert(
      `View History for ${user.name}\n\nThis feature will show:\n- Code review history\n- Upload statistics\n- GitHub integration logs`
    );
  };

  if (profile?.role === "admin") {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-indigo-900 to-purple-900 text-white p-8">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_left,_var(--tw-gradient-stops))] from-indigo-400/20 via-purple-500/20 to-pink-600/20"></div>
        <div className="relative z-10 container mx-auto">
          <div className="flex items-center justify-between mb-8">
            <button
              onClick={onBack}
              className="p-3 bg-white/10 hover:bg-white/20 rounded-xl transition-all duration-300 hover:scale-105 backdrop-blur-sm border border-white/10"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div className="flex items-center space-x-4">
              <div className="w-16 h-16 bg-gradient-to-r from-indigo-500 to-purple-500 rounded-3xl flex items-center justify-center shadow-lg shadow-indigo-500/30">
                <Users className="w-8 h-8 text-white" />
              </div>
              <h1 className="text-4xl font-bold bg-gradient-to-r from-indigo-300 to-purple-300 bg-clip-text text-transparent">Admin Dashboard</h1>
            </div>

            <div className="flex items-center space-x-4">
              <div className="text-right bg-white/5 backdrop-blur-sm rounded-xl p-4 border border-white/10">
                <p className="text-white font-semibold text-lg">
                  {profile?.name || "Admin"}
                </p>
                <p className="text-slate-300">{profile?.email}</p>
              </div>
              <button
                onClick={handleLogout}
                className="p-3 bg-gradient-to-r from-red-500/20 to-pink-500/20 hover:from-red-500/30 hover:to-pink-500/30 rounded-xl text-red-300 hover:text-white transition-all duration-300 group backdrop-blur-sm border border-red-500/20"
                title="Logout"
              >
                <LogOut className="w-5 h-5 group-hover:scale-110 transition-transform" />
              </button>
            </div>
          </div>

          <div className="bg-white/5 backdrop-blur-xl rounded-3xl shadow-2xl border border-white/10 p-10">
            <div className="flex items-center justify-between mb-8">
              <h2 className="text-2xl font-bold bg-gradient-to-r from-indigo-300 to-purple-300 bg-clip-text text-transparent">User Management</h2>
              <div className="text-slate-300 bg-gradient-to-r from-white/5 to-white/10 px-4 py-2 rounded-xl border border-white/10">
                Total Users: <span className="font-bold text-white">{users.length}</span>
              </div>
            </div>

            {loading ? (
              <div className="text-center py-16">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-400 mx-auto mb-6"></div>
                <p className="text-slate-300 text-lg">Loading users...</p>
              </div>
            ) : users.length === 0 ? (
              <div className="text-center py-16">
                <div className="w-20 h-20 bg-gradient-to-r from-slate-600 to-slate-700 rounded-3xl flex items-center justify-center mx-auto mb-6">
                  <Users className="w-10 h-10 text-slate-400" />
                </div>
                <p className="text-slate-300 text-lg">No users found</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-gradient-to-r from-white/10 to-white/5 border-b border-white/20">
                      <th className="p-6 font-bold text-white text-lg">Name</th>
                      <th className="p-6 font-bold text-white text-lg">Email</th>
                      <th className="p-6 font-bold text-white text-lg">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {users.map((user) => (
                      <tr
                        key={user.id}
                        className="border-b border-white/10 hover:bg-gradient-to-r hover:from-white/5 hover:to-white/10 transition-all duration-300"
                      >
                        <td className="p-6">
                          <div className="flex items-center space-x-4">
                            <div className="w-12 h-12 bg-gradient-to-r from-blue-500 to-purple-500 rounded-2xl flex items-center justify-center text-white font-bold text-lg shadow-lg">
                              {user.name
                                ? user.name.charAt(0).toUpperCase()
                                : "U"}
                            </div>
                            <span className="text-white font-semibold text-lg">
                              {user.name || "Unnamed User"}
                            </span>
                          </div>
                        </td>
                        <td className="p-6">
                          <span className="text-slate-300 text-lg">{user.email}</span>
                        </td>
                        <td className="p-6">
                          <button
                            className="px-6 py-3 bg-gradient-to-r from-blue-500 to-indigo-500 hover:from-blue-600 hover:to-indigo-600 rounded-xl text-white font-semibold transition-all duration-300 flex items-center space-x-3 shadow-lg hover:scale-105"
                            onClick={() => handleViewHistory(user)}
                          >
                            <FileCode className="w-5 h-5" />
                            <span>View History</span>
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  return <CodeReviewUI onBack={onBack} profile={profile} onLogout={onLogout} />;
}