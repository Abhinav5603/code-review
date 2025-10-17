import React, { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
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
  AlertTriangle,
  Info,
  Bug,
  Shield,
  Cpu,
  Code,
  Settings,
  Target,
  Loader,
  FolderOpen,
  File,
  CheckSquare,
  Square,
  Search,
  X,
  TrendingUp,
  Activity,
  Download,
  FileText,
  Check,
  XCircle,
  BarChart3
} from "lucide-react";

const API_BASE = "http://localhost:5000";

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
  const [repoUrl, setRepoUrl] = useState("");
  const [reviewResults, setReviewResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [repoAnalysis, setRepoAnalysis] = useState(null);
  
  // GitHub repo file selection states
  const [repoFiles, setRepoFiles] = useState([]);
  const [selectedFiles, setSelectedFiles] = useState(new Set());
  const [loadingRepo, setLoadingRepo] = useState(false);
  const [repoInfo, setRepoInfo] = useState(null);
  const [fileFilter, setFileFilter] = useState("");
  const [languageFilter, setLanguageFilter] = useState("all");

  // User history states
  const [myHistory, setMyHistory] = useState([]);
  const [loadingHistory, setLoadingHistory] = useState(false);

  // NEW: Accept/Reject state management
  const [acceptedErrors, setAcceptedErrors] = useState(new Set());
  const [rejectedErrors, setRejectedErrors] = useState(new Set());

  // NEW: Calculate statistics for graph
 // NEW: Calculate statistics for graph
  const calculateStats = () => {
    let critical = 0, high = 0, medium = 0, low = 0;
    let syntax = 0, architectural = 0, logical = 0, performance = 0, security = 0;
    let compileTime = 0, runtime = 0;
    
    reviewResults.forEach(result => {
      result.errors?.forEach(error => {
        const errorKey = `${result.id}-${error.line}-${error.message}`;
        
        // Skip if error is accepted (resolved)
        if (acceptedErrors.has(errorKey)) return;
        
        // Count by severity
        const severity = (error.severity || 'medium').toLowerCase();
        switch(severity) {
          case 'critical': critical++; break;
          case 'high': high++; break;
          case 'medium': medium++; break;
          case 'low': low++; break;
        }
        
        // Count by level
        const level = (error.level || 'logical').toLowerCase();
        switch(level) {
          case 'syntax': syntax++; break;
          case 'architectural': architectural++; break;
          case 'logical': logical++; break;
          case 'performance': performance++; break;
          case 'security': security++; break;
        }
        
        // Count by type (compile-time vs runtime)
        const type = (error.type || '').toLowerCase();
        if (type.includes('compile') || type.includes('syntax') || level === 'syntax') {
          compileTime++;
        } else {
          runtime++;
        }
      });
    });
    
    return { 
      critical, high, medium, low, 
      total: critical + high + medium + low,
      syntax, architectural, logical, performance, security,
      compileTime, runtime
    };
  };

  const stats = calculateStats();
  const maxCount = Math.max(stats.critical, stats.high, stats.medium, stats.low, 1);
  const maxLevelCount = Math.max(stats.syntax, stats.architectural, stats.logical, stats.performance, stats.security, 1);
  const maxTypeCount = Math.max(stats.compileTime, stats.runtime, 1);

  // NEW: Handle accept error
  const handleAcceptError = (resultId, error) => {
    const errorKey = `${resultId}-${error.line}-${error.message}`;
    setAcceptedErrors(prev => {
      const newSet = new Set(prev);
      newSet.add(errorKey);
      return newSet;
    });
    setRejectedErrors(prev => {
      const newSet = new Set(prev);
      newSet.delete(errorKey);
      return newSet;
    });
  };

  // NEW: Handle reject error
  const handleRejectError = (resultId, error) => {
    const errorKey = `${resultId}-${error.line}-${error.message}`;
    setRejectedErrors(prev => {
      const newSet = new Set(prev);
      newSet.add(errorKey);
      return newSet;
    });
    setAcceptedErrors(prev => {
      const newSet = new Set(prev);
      newSet.delete(errorKey);
      return newSet;
    });
  };

  // NEW: Check if error is accepted/rejected
  const getErrorStatus = (resultId, error) => {
    const errorKey = `${resultId}-${error.line}-${error.message}`;
    if (acceptedErrors.has(errorKey)) return 'accepted';
    if (rejectedErrors.has(errorKey)) return 'rejected';
    return 'pending';
  };

  // Fetch my analysis history
const fetchMyHistory = async () => {
  if (!profile?.id) {
    console.error('❌ No profile ID');
    return;
  }
  
  setLoadingHistory(true);
  try {
    console.log('📜 Fetching history for:', profile.id);
    
    const res = await fetch(`${API_BASE}/my-history/${profile.id}`);
    const data = await res.json();
    
    console.log('📊 History response:', data);
    
    if (data.success) {
      setMyHistory(data.history || []);
      console.log(`✅ Loaded ${data.history?.length || 0} records`);
    } else {
      console.error('❌ Failed:', data.error);
      setMyHistory([]);
    }
  } catch (error) {
    console.error('❌ Error:', error);
    setMyHistory([]);
  } finally {
    setLoadingHistory(false);
  }
};

  // Save analysis to history
const saveAnalysisToHistory = async (analysisData) => {
  if (!profile?.id) {
    console.error('❌ No user profile');
    return;
  }

  try {
    console.log('💾 Saving to history...');
    
    const resultsToUse = analysisData.results || reviewResults;
    
    const totalErrors = resultsToUse.reduce(
      (acc, r) => acc + (r.errors?.length || 0), 0
    );
    const criticalErrors = resultsToUse.reduce(
      (acc, r) => acc + (r.errors?.filter(e => e.severity === 'critical')?.length || 0), 0
    );
    const highErrors = resultsToUse.reduce(
      (acc, r) => acc + (r.errors?.filter(e => e.severity === 'high')?.length || 0), 0
    );
    const mediumErrors = resultsToUse.reduce(
      (acc, r) => acc + (r.errors?.filter(e => e.severity === 'medium')?.length || 0), 0
    );
    const lowErrors = resultsToUse.reduce(
      (acc, r) => acc + (r.errors?.filter(e => e.severity === 'low')?.length || 0), 0
    );

    const payload = {
      user_id: profile.id,
      analysis_type: analysisData.analysis_type || (repoAnalysis ? 'repository' : 'file'),
      repository_name: analysisData.repository || repoAnalysis?.repository || null,
      file_count: resultsToUse.length,
      total_errors: totalErrors,
      critical_errors: criticalErrors,
      high_errors: highErrors,
      medium_errors: mediumErrors,
      low_errors: lowErrors,
      analysis_data: {
        repository: analysisData.repository || repoAnalysis?.repository,
        branch: repoAnalysis?.branch,
        results: resultsToUse.map(r => ({
          filename: r.name || r.filename,
          errors: r.errors?.length || 0,
          language: r.language
        })),
        timestamp: new Date().toISOString()
      }
    };

    console.log('📤 Sending:', payload);

    const response = await fetch(`${API_BASE}/save-analysis`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    const result = await response.json();
    
    if (result.success) {
      console.log('✅ Saved:', result.data?.id);
    } else {
      console.error('❌ Failed:', result.error);
    }
  } catch (error) {
    console.error('❌ Error:', error);
  }
};

  // Enhanced PDF Download Function
  const downloadReviewAsPDF = () => {
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    let yPosition = 20;

    // Header
    doc.setFillColor(30, 41, 59);
    doc.rect(0, 0, pageWidth, 40, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(24);
    doc.setFont(undefined, 'bold');
    doc.text('Code Review Report', pageWidth / 2, 25, { align: 'center' });
    
    yPosition = 50;

    // Repository Info
    if (repoAnalysis) {
      doc.setFontSize(12);
      doc.setTextColor(0, 0, 0);
      doc.setFont(undefined, 'normal');
      doc.text(`Repository: ${repoAnalysis.repository}`, 15, yPosition);
      yPosition += 8;
      doc.text(`Branch: ${repoAnalysis.branch}`, 15, yPosition);
      yPosition += 8;
      doc.text(`Analysis Date: ${new Date().toLocaleDateString('en-US', { 
        year: 'numeric', 
        month: 'long', 
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      })}`, 15, yPosition);
      yPosition += 15;

      // Summary Statistics
      doc.setFontSize(16);
      doc.setFont(undefined, 'bold');
      doc.text('Summary Statistics', 15, yPosition);
      yPosition += 10;

      const summaryData = [
        ['Files Analyzed', repoAnalysis.filesAnalyzed?.toString() || '0'],
        ['Files with Errors', repoAnalysis.filesWithErrors?.toString() || '0'],
        ['Clean Files', repoAnalysis.filesWithoutErrors?.toString() || '0'],
        ['Total Issues', (repoAnalysis.aggregateMetrics?.totalErrors || 0).toString()],
        ['Critical Issues', (repoAnalysis.aggregateMetrics?.criticalErrors || 0).toString()],
        ['High Priority Issues', (repoAnalysis.aggregateMetrics?.highErrors || 0).toString()],
        ['Medium Priority Issues', (repoAnalysis.aggregateMetrics?.mediumErrors || 0).toString()],
        ['Low Priority Issues', (repoAnalysis.aggregateMetrics?.lowErrors || 0).toString()],
        ['Processing Time', `${(repoAnalysis.processingTime / 1000).toFixed(2)}s`]
      ];

      autoTable(doc,{
        startY: yPosition,
        head: [['Metric', 'Value']],
        body: summaryData,
        theme: 'grid',
        headStyles: { 
          fillColor: [59, 130, 246],
          fontSize: 11,
          fontStyle: 'bold'
        },
        bodyStyles: {
          fontSize: 10
        },
        alternateRowStyles: {
          fillColor: [248, 250, 252]
        }
      });

      yPosition = doc.lastAutoTable.finalY + 15;

      // Error Breakdown
      if (repoAnalysis.aggregateMetrics?.errorsByType) {
        const errorTypes = Object.entries(repoAnalysis.aggregateMetrics.errorsByType)
          .filter(([_, count]) => count > 0)
          .map(([type, count]) => [
            type.charAt(0).toUpperCase() + type.slice(1).replace('_', ' '),
            count.toString()
          ]);

        if (errorTypes.length > 0) {
          if (yPosition > pageHeight - 80) {
            doc.addPage();
            yPosition = 20;
          }

          doc.setFontSize(14);
          doc.setFont(undefined, 'bold');
          doc.text('Issues by Type', 15, yPosition);
          yPosition += 10;

          autoTable(doc,{
            startY: yPosition,
            head: [['Issue Type', 'Count']],
            body: errorTypes,
            theme: 'striped',
            headStyles: { 
              fillColor: [239, 68, 68],
              fontSize: 10,
              fontStyle: 'bold'
            },
            bodyStyles: {
              fontSize: 9
            }
          });

          yPosition = doc.lastAutoTable.finalY + 15;
        }
      }
    }

    // Detailed File Reports
    if (reviewResults && reviewResults.length > 0) {
      reviewResults.forEach((result, index) => {
        if (yPosition > pageHeight - 50) {
          doc.addPage();
          yPosition = 20;
        }

        doc.setFontSize(14);
        doc.setFont(undefined, 'bold');
        doc.setTextColor(0, 0, 0);
        doc.text(`${index + 1}. ${result.name || result.filename}`, 15, yPosition);
        yPosition += 8;

        doc.setFontSize(10);
        doc.setFont(undefined, 'normal');
        const language = result.language || 'Unknown';
        const lines = result.linesOfCode || 'N/A';
        const errorCount = result.errors?.length || 0;
        doc.text(`Language: ${language} | Lines: ${lines} | Issues Found: ${errorCount}`, 15, yPosition);
        yPosition += 12;

        if (result.errors && result.errors.length > 0) {
          const errorData = result.errors.map(err => {
            const line = err.line || 'N/A';
            const severity = (err.severity || 'medium').toUpperCase();
            const message = (err.message || 'No message').substring(0, 80);
            const suggestion = (err.suggestion || 'No suggestion').substring(0, 80);
            
            return [
              `Line ${line}`,
              severity,
              message,
              suggestion
            ];
          });

          autoTable(doc,{
            startY: yPosition,
            head: [['Line', 'Severity', 'Issue', 'Suggestion']],
            body: errorData,
            theme: 'striped',
            headStyles: { 
              fillColor: [239, 68, 68],
              fontSize: 9,
              fontStyle: 'bold',
              textColor: [255, 255, 255]
            },
            styles: { 
              fontSize: 8, 
              cellPadding: 3,
              overflow: 'linebreak'
            },
            columnStyles: {
              0: { cellWidth: 20 },
              1: { cellWidth: 25 },
              2: { cellWidth: 65 },
              3: { cellWidth: 65 }
            },
            alternateRowStyles: {
              fillColor: [254, 242, 242]
            }
          });

          yPosition = doc.lastAutoTable.finalY + 15;
        } else {
          doc.setFontSize(10);
          doc.setTextColor(34, 197, 94);
          doc.text('✓ No issues found in this file', 15, yPosition);
          yPosition += 15;
        }
      });
    }

    // Footer
    const pageCount = doc.internal.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
      doc.setPage(i);
      doc.setFontSize(8);
      doc.setTextColor(128, 128, 128);
      doc.text(
        `Page ${i} of ${pageCount} | Generated by Code Review Bot | ${new Date().toLocaleDateString()}`,
        pageWidth / 2,
        pageHeight - 10,
        { align: 'center' }
      );
    }

    const fileName = repoAnalysis 
      ? `code-review-${repoAnalysis.repository.replace(/\//g, '-')}-${new Date().toISOString().split('T')[0]}.pdf`
      : `code-review-${new Date().toISOString().split('T')[0]}.pdf`;
    
    doc.save(fileName);
  };

  // Handle file uploads
  const handleFileUpload = async (event) => {
    const files = Array.from(event.target.files);
    if (files.length > 10) {
      alert("You can select up to 10 files for review.");
      return;
    }

    setLoading(true);
    const uploadedResults = [];

    for (let file of files) {
      const text = await file.text();

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

        const resultWithId = {
          id: pendingFile.id,
          name: file.name,
          code: text,
          status: "completed",
          ...results
        };

        uploadedResults.push(resultWithId);

        setReviewResults((prev) => [...prev, resultWithId]);

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
    
    // Save to history after all files are processed
    if (uploadedResults.length > 0) {
      await saveAnalysisToHistory({
        results: uploadedResults,
        analysis_type: 'file'
      });
    }
  };

  // Fetch repository structure
  const fetchRepoStructure = async () => {
    if (!repoUrl.trim()) {
      alert("Please enter a GitHub repository URL");
      return;
    }

    setLoadingRepo(true);
    setRepoFiles([]);
    setSelectedFiles(new Set());
    setRepoInfo(null);
    setReviewResults([]);
    setRepoAnalysis(null);

    try {
      const res = await fetch(`${API_BASE}/fetch-repo-structure`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ repoUrl }),
      });

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.message || "Failed to fetch repository");
      }

      const data = await res.json();
      setRepoInfo(data.repoInfo);
      setRepoFiles(data.files);
    } catch (error) {
      console.error("Repository fetch error:", error);
      alert(`Failed to fetch repository: ${error.message}`);
    } finally {
      setLoadingRepo(false);
    }
  };

  // Toggle file selection
  const toggleFileSelection = (filePath) => {
    setSelectedFiles(prev => {
      const newSet = new Set(prev);
      if (newSet.has(filePath)) {
        newSet.delete(filePath);
      } else {
        if (newSet.size >= 20) {
          alert("You can select up to 20 files at a time");
          return prev;
        }
        newSet.add(filePath);
      }
      return newSet;
    });
  };

  // Select all filtered files
  const selectAllFiltered = () => {
    const filtered = getFilteredFiles();
    const newSet = new Set(selectedFiles);
    const remaining = 20 - selectedFiles.size;
    
    filtered.slice(0, remaining).forEach(file => {
      newSet.add(file.path);
    });
    
    setSelectedFiles(newSet);
    
    if (filtered.length > remaining) {
      alert(`Selected ${remaining} files. Maximum limit is 20 files.`);
    }
  };

  // Clear selection
  const clearSelection = () => {
    setSelectedFiles(new Set());
  };

  // Analyze selected files
  const analyzeSelectedFiles = async () => {
    if (selectedFiles.size === 0) {
      alert("Please select at least one file to analyze");
      return;
    }

    setLoading(true);
    setReviewResults([]);
    setRepoAnalysis(null);

    try {
      const res = await fetch(`${API_BASE}/analyze-selected-files`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          repoUrl,
          filePaths: Array.from(selectedFiles)
        }),
      });

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.message || "Failed to analyze files");
      }

      const data = await res.json();
      
      setRepoAnalysis({
        repository: data.repository,
        branch: data.branch,
        filesAnalyzed: data.stats.analyzedFiles,
        filesWithErrors: data.stats.filesWithErrors,
        filesWithoutErrors: data.stats.filesWithoutErrors,
        processingTime: data.processingTime,
        aggregateMetrics: data.aggregateMetrics
      });
      
      if (data.results && data.results.length > 0) {
        const results = data.results.map(r => ({
          id: Date.now() + Math.random(),
          name: r.filename,
          status: "completed",
          source: "github",
          ...r
        }));
        setReviewResults(results);
        
        // Save to history
        await saveAnalysisToHistory({
          repository: data.repository,
          results: results,
          aggregateMetrics: data.aggregateMetrics
        });
      }

    } catch (error) {
      console.error("Analysis error:", error);
      alert(`Failed to analyze files: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  // Get language from file extension
  const getLanguage = (filename) => {
    const ext = filename.split('.').pop().toLowerCase();
    const langMap = {
      js: 'JavaScript', jsx: 'JavaScript', ts: 'TypeScript', tsx: 'TypeScript',
      py: 'Python', java: 'Java', cpp: 'C++', c: 'C', cs: 'C#',
      php: 'PHP', rb: 'Ruby', go: 'Go', rs: 'Rust',
      html: 'HTML', css: 'CSS', vue: 'Vue', svelte: 'Svelte',
      scss: 'SCSS', sass: 'Sass', less: 'Less'
    };
    return langMap[ext] || ext.toUpperCase();
  };

  // Filter files
  const getFilteredFiles = () => {
    return repoFiles.filter(file => {
      const matchesSearch = file.path.toLowerCase().includes(fileFilter.toLowerCase());
      const matchesLanguage = languageFilter === "all" || getLanguage(file.path).toLowerCase() === languageFilter.toLowerCase();
      return matchesSearch && matchesLanguage;
    });
  };

  // Get unique languages
  const getLanguages = () => {
    const languages = new Set(repoFiles.map(f => getLanguage(f.path)));
    return Array.from(languages).sort();
  };

  // Helper functions for error display
  const getLevelIcon = (level) => {
    switch (level) {
      case 'architectural': return <Settings className="w-4 h-4 text-purple-400" />;
      case 'syntax': return <Code className="w-4 h-4 text-rose-400" />;
      case 'logical': return <Target className="w-4 h-4 text-amber-400" />;
      case 'performance': return <Cpu className="w-4 h-4 text-emerald-400" />;
      case 'security': return <Shield className="w-4 h-4 text-cyan-400" />;
      default: return <AlertCircle className="w-4 h-4 text-slate-400" />;
    }
  };

  const getLevelColor = (level) => {
    switch (level) {
      case 'architectural': return 'bg-purple-500/15 border-purple-400/30 text-purple-100';
      case 'syntax': return 'bg-rose-500/15 border-rose-400/30 text-rose-100';
      case 'logical': return 'bg-amber-500/15 border-amber-400/30 text-amber-100';
      case 'performance': return 'bg-emerald-500/15 border-emerald-400/30 text-emerald-100';
      case 'security': return 'bg-cyan-500/15 border-cyan-400/30 text-cyan-100';
      default: return 'bg-slate-500/15 border-slate-400/30 text-slate-100';
    }
  };

  const getSeverityIcon = (severity) => {
    switch (severity) {
      case 'critical': return <AlertTriangle className="w-4 h-4 text-rose-400" />;
      case 'high': return <AlertCircle className="w-4 h-4 text-orange-400" />;
      case 'medium': return <Info className="w-4 h-4 text-yellow-400" />;
      case 'low': return <Bug className="w-4 h-4 text-blue-400" />;
      default: return <AlertCircle className="w-4 h-4 text-slate-400" />;
    }
  };

  const sortErrors = (errors) => {
    const levelOrder = ['architectural', 'syntax', 'logical', 'performance', 'security'];
    return [...errors].sort((a, b) => {
      const aLevelIndex = levelOrder.indexOf(a.level || 'logical');
      const bLevelIndex = levelOrder.indexOf(b.level || 'logical');
      if (aLevelIndex !== bLevelIndex) return aLevelIndex - bLevelIndex;
      return (a.line || 0) - (b.line || 0);
    });
  };

  const formatFileSize = (bytes) => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(2) + ' MB';
  };

  const filteredFiles = getFilteredFiles();

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900">
      <div className="container mx-auto px-6 py-10">
        {/* Header */}
        <div className="flex items-center justify-between mb-10">
          <div className="flex items-center gap-4">
            <button
              onClick={onBack}
              className="p-2.5 bg-white/5 hover:bg-white/10 rounded-xl text-slate-200 transition-all duration-200 hover:scale-105 border border-white/10"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 bg-gradient-to-br from-cyan-400 via-blue-500 to-purple-600 rounded-2xl flex items-center justify-center shadow-lg shadow-blue-500/30">
                <Zap className="w-7 h-7 text-white" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-white tracking-tight">Code Review Bot</h1>
                <p className="text-slate-400 text-sm">Powered by Groq AI</p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <div className="text-right px-4 py-2 bg-white/5 rounded-xl border border-white/10">
              <p className="text-white font-medium text-sm">{profile?.name || "User"}</p>
              <p className="text-slate-400 text-xs">{profile?.email}</p>
            </div>
            <button
              onClick={handleLogout}
              className="p-2.5 bg-rose-500/10 hover:bg-rose-500/20 rounded-xl text-rose-300 hover:text-rose-200 transition-all duration-200 border border-rose-500/20 hover:border-rose-500/40"
              title="Logout"
            >
              <LogOut className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="flex gap-2 bg-slate-800/50 backdrop-blur-xl rounded-2xl p-1.5 mb-10 max-w-2xl border border-white/10">
          <button
            onClick={() => setActiveTab("upload")}
            className={`flex-1 py-3 px-5 rounded-xl text-sm font-medium transition-all duration-200 ${
              activeTab === "upload"
                ? "bg-gradient-to-r from-blue-500 to-cyan-500 text-white shadow-lg shadow-blue-500/30"
                : "text-slate-400 hover:text-white hover:bg-white/5"
            }`}
          >
            <Upload className="w-4 h-4 inline mr-2" />
            Upload Files
          </button>
          <button
            onClick={() => setActiveTab("github")}
            className={`flex-1 py-3 px-5 rounded-xl text-sm font-medium transition-all duration-200 ${
              activeTab === "github"
                ? "bg-gradient-to-r from-blue-500 to-cyan-500 text-white shadow-lg shadow-blue-500/30"
                : "text-slate-400 hover:text-white hover:bg-white/5"
            }`}
          >
            <Github className="w-4 h-4 inline mr-2" />
            GitHub Repo
          </button>
          <button
            onClick={() => {
              setActiveTab("history");
              fetchMyHistory();
            }}
            className={`flex-1 py-3 px-5 rounded-xl text-sm font-medium transition-all duration-200 ${
              activeTab === "history"
                ? "bg-gradient-to-r from-blue-500 to-cyan-500 text-white shadow-lg shadow-blue-500/30"
                : "text-slate-400 hover:text-white hover:bg-white/5"
            }`}
          >
            <Clock className="w-4 h-4 inline mr-2" />
            My History
          </button>
        </div>

      {/* NEW: Statistics Dashboard - Shows when there are review results */}
        {reviewResults.length > 0 && (
          <div className="bg-slate-800/40 backdrop-blur-xl rounded-2xl p-6 shadow-2xl border border-white/10 mb-8">
            <div className="flex items-center gap-3 mb-5">
              <BarChart3 className="w-5 h-5 text-cyan-400" />
              <h2 className="text-lg font-bold text-white">Error Statistics Dashboard</h2>
            </div>

            {/* Summary Cards */}
            <div className="grid grid-cols-5 gap-3 mb-5">
              <div className="bg-slate-900/50 rounded-lg p-3 text-center border border-white/5">
                <p className="text-2xl font-bold text-cyan-400">{stats.total}</p>
                <p className="text-slate-400 text-xs mt-0.5">Total</p>
              </div>
              <div className="bg-rose-500/10 rounded-lg p-3 text-center border border-rose-500/30">
                <p className="text-2xl font-bold text-rose-400">{stats.critical}</p>
                <p className="text-rose-400 text-xs mt-0.5">Critical</p>
              </div>
              <div className="bg-orange-500/10 rounded-lg p-3 text-center border border-orange-500/30">
                <p className="text-2xl font-bold text-orange-400">{stats.high}</p>
                <p className="text-orange-400 text-xs mt-0.5">High</p>
              </div>
              <div className="bg-yellow-500/10 rounded-lg p-3 text-center border border-yellow-500/30">
                <p className="text-2xl font-bold text-yellow-400">{stats.medium}</p>
                <p className="text-yellow-400 text-xs mt-0.5">Medium</p>
              </div>
              <div className="bg-blue-500/10 rounded-lg p-3 text-center border border-blue-500/30">
                <p className="text-2xl font-bold text-blue-400">{stats.low}</p>
                <p className="text-blue-400 text-xs mt-0.5">Low</p>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-5">
              {/* Severity Bar Graph */}
              <div className="bg-slate-900/30 rounded-xl p-4 border border-white/5">
                <h3 className="text-white font-semibold mb-3 text-sm text-center">By Severity</h3>
                <div className="flex items-end justify-between gap-3 h-40">
                  <div className="flex-1 flex flex-col items-center gap-2">
                    <div className="text-rose-400 font-bold text-lg">{stats.critical}</div>
                    <div 
                      className="w-full bg-gradient-to-t from-rose-500 to-rose-400 rounded-t-lg transition-all duration-500"
                      style={{ height: `${(stats.critical / maxCount) * 100}%`, minHeight: stats.critical > 0 ? '30px' : '0' }}
                    />
                    <div className="text-slate-300 text-xs">Crit</div>
                  </div>
                  <div className="flex-1 flex flex-col items-center gap-2">
                    <div className="text-orange-400 font-bold text-lg">{stats.high}</div>
                    <div 
                      className="w-full bg-gradient-to-t from-orange-500 to-orange-400 rounded-t-lg transition-all duration-500"
                      style={{ height: `${(stats.high / maxCount) * 100}%`, minHeight: stats.high > 0 ? '30px' : '0' }}
                    />
                    <div className="text-slate-300 text-xs">High</div>
                  </div>
                  <div className="flex-1 flex flex-col items-center gap-2">
                    <div className="text-yellow-400 font-bold text-lg">{stats.medium}</div>
                    <div 
                      className="w-full bg-gradient-to-t from-yellow-500 to-yellow-400 rounded-t-lg transition-all duration-500"
                      style={{ height: `${(stats.medium / maxCount) * 100}%`, minHeight: stats.medium > 0 ? '30px' : '0' }}
                    />
                    <div className="text-slate-300 text-xs">Med</div>
                  </div>
                  <div className="flex-1 flex flex-col items-center gap-2">
                    <div className="text-blue-400 font-bold text-lg">{stats.low}</div>
                    <div 
                      className="w-full bg-gradient-to-t from-blue-500 to-blue-400 rounded-t-lg transition-all duration-500"
                      style={{ height: `${(stats.low / maxCount) * 100}%`, minHeight: stats.low > 0 ? '30px' : '0' }}
                    />
                    <div className="text-slate-300 text-xs">Low</div>
                  </div>
                </div>
              </div>

              {/* Error Level Bar Graph */}
<div className="bg-slate-900/30 rounded-xl p-4 border border-white/5">
  <h3 className="text-white font-semibold mb-3 text-sm text-center">By Level</h3>
  <div className="flex items-end justify-between gap-4 h-40">
    {/* Syntax */}
    <div className="flex-1 flex flex-col items-center gap-2">
      <div className="text-rose-300 font-bold text-lg">{stats.syntax}</div>
      <div 
        className="w-full bg-gradient-to-t from-rose-600 to-rose-500 rounded-t-lg transition-all duration-500"
        style={{ height: `${(stats.syntax / maxLevelCount) * 100}%`, minHeight: stats.syntax > 0 ? '30px' : '0' }}
      />
      <div className="text-slate-300 text-xs text-center">Syntax</div>
    </div>

    {/* Architectural */}
    <div className="flex-1 flex flex-col items-center gap-2">
      <div className="text-purple-300 font-bold text-lg">{stats.architectural}</div>
      <div 
        className="w-full bg-gradient-to-t from-purple-600 to-purple-500 rounded-t-lg transition-all duration-500"
        style={{ height: `${(stats.architectural / maxLevelCount) * 100}%`, minHeight: stats.architectural > 0 ? '30px' : '0' }}
      />
      <div className="text-slate-300 text-xs text-center">Arch</div>
    </div>

    {/* Logical */}
    <div className="flex-1 flex flex-col items-center gap-2">
      <div className="text-amber-300 font-bold text-lg">{stats.logical}</div>
      <div 
        className="w-full bg-gradient-to-t from-amber-600 to-amber-500 rounded-t-lg transition-all duration-500"
        style={{ height: `${(stats.logical / maxLevelCount) * 100}%`, minHeight: stats.logical > 0 ? '30px' : '0' }}
      />
      <div className="text-slate-300 text-xs text-center">Logic</div>
    </div>
  </div>
</div>


              {/* Compile vs Runtime Bar Graph */}
              <div className="bg-slate-900/30 rounded-xl p-4 border border-white/5">
                <h3 className="text-white font-semibold mb-3 text-sm text-center">By Type</h3>
                <div className="flex items-end justify-center gap-6 h-40">
                  <div className="flex-1 flex flex-col items-center gap-2 max-w-[120px]">
                    <div className="text-indigo-300 font-bold text-lg">{stats.compileTime}</div>
                    <div 
                      className="w-full bg-gradient-to-t from-indigo-600 to-indigo-500 rounded-t-lg transition-all duration-500"
                      style={{ height: `${(stats.compileTime / maxTypeCount) * 100}%`, minHeight: stats.compileTime > 0 ? '30px' : '0' }}
                    />
                    <div className="text-slate-300 text-xs text-center">Compile</div>
                  </div>
                  <div className="flex-1 flex flex-col items-center gap-2 max-w-[120px]">
                    <div className="text-violet-300 font-bold text-lg">{stats.runtime}</div>
                    <div 
                      className="w-full bg-gradient-to-t from-violet-600 to-violet-500 rounded-t-lg transition-all duration-500"
                      style={{ height: `${(stats.runtime / maxTypeCount) * 100}%`, minHeight: stats.runtime > 0 ? '30px' : '0' }}
                    />
                    <div className="text-slate-300 text-xs text-center">Runtime</div>
                  </div>
                </div>
              </div>
            </div>

            {/* Action Summary */}
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-emerald-500/10 rounded-lg p-3 border border-emerald-500/30">
                <div className="flex items-center justify-between">
                  <span className="text-emerald-400 text-sm font-semibold">Resolved</span>
                  <span className="text-xl font-bold text-emerald-400">{acceptedErrors.size}</span>
                </div>
              </div>
              <div className="bg-rose-500/10 rounded-lg p-3 border border-rose-500/30">
                <div className="flex items-center justify-between">
                  <span className="text-rose-400 text-sm font-semibold">Won't Fix</span>
                  <span className="text-xl font-bold text-rose-400">{rejectedErrors.size}</span>
                </div>
              </div>
            </div>
          </div>
        )}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Main Content */}
          <div className="lg:col-span-2 space-y-8">
            {activeTab === "upload" && (
              <div className="bg-slate-800/40 backdrop-blur-xl rounded-3xl p-8 shadow-2xl border border-white/10">
                <h2 className="text-xl font-bold text-white mb-6">Upload Code Files</h2>

                <div className="border-2 border-dashed border-slate-600/50 rounded-2xl p-10 text-center mb-6 hover:border-cyan-500/50 transition-all duration-300 bg-slate-900/30">
                  <FileCode className="w-14 h-14 text-slate-500 mx-auto mb-4" />
                  <p className="text-slate-300 mb-2 font-medium">Drag and drop your code files here</p>
                  <p className="text-slate-500 text-sm mb-5">
                    Supports .js, .jsx, .ts, .tsx, .py, .java, .cpp, .c, .cs, .php, .rb, .go, .rs, .html, .css, .vue
                  </p>
                  <label className="inline-block">
                    <input
                      type="file"
                      multiple
                      accept=".js,.jsx,.ts,.tsx,.py,.java,.cpp,.c,.cs,.php,.rb,.go,.rs,.html,.css,.vue"
                      onChange={handleFileUpload}
                      className="hidden"
                      disabled={loading}
                    />
                    <span className={`px-8 py-3.5 rounded-xl font-medium cursor-pointer transition-all duration-200 inline-flex items-center gap-2 ${
                      loading 
                        ? 'bg-slate-600 text-slate-400 cursor-not-allowed' 
                        : 'bg-gradient-to-r from-blue-500 to-cyan-500 hover:from-blue-600 hover:to-cyan-600 text-white shadow-lg shadow-blue-500/30 hover:scale-105'
                    }`}>
                      {loading ? (
                        <>
                          <Loader className="w-4 h-4 animate-spin" />
                          Analyzing...
                        </>
                      ) : (
                        <>
                          <Upload className="w-4 h-4" />
                          Choose Files
                        </>
                      )}
                    </span>
                  </label>
                </div>

                {uploadedFiles.length > 0 && (
                  <div>
                    <h3 className="text-lg font-semibold text-white mb-4">Uploaded Files</h3>
                    <div className="space-y-3">
                      {uploadedFiles.map((file) => (
                        <div
                          key={file.id}
                          className="flex items-center justify-between p-4 bg-slate-900/50 rounded-xl border border-white/10 hover:border-cyan-500/30 transition-all duration-200"
                        >
                          <div className="flex items-center gap-3">
                            <div className="p-2 bg-blue-500/10 rounded-lg">
                              <FileCode className="w-5 h-5 text-blue-400" />
                            </div>
                            <div>
                              <p className="text-white font-medium">{file.name}</p>
                              <p className="text-slate-400 text-sm">{(file.size / 1024).toFixed(1)} KB</p>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            {file.status === "pending" ? (
                              <Clock className="w-5 h-5 text-amber-400 animate-spin" />
                            ) : file.status === "completed" ? (
                              <CheckCircle className="w-5 h-5 text-emerald-400" />
                            ) : (
                              <AlertCircle className="w-5 h-5 text-rose-400" />
                            )}
                            <span className="text-slate-300 text-sm capitalize font-medium">{file.status}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {activeTab === "github" && (
              <div className="bg-slate-800/40 backdrop-blur-xl rounded-3xl p-8 shadow-2xl border border-white/10">
                <h2 className="text-xl font-bold text-white mb-6">GitHub Repository Analysis</h2>
                
                <div className="mb-6">
                  <div className="flex gap-3 mb-4">
                    <input
                      type="text"
                      placeholder="https://github.com/username/repository"
                      value={repoUrl}
                      onChange={(e) => setRepoUrl(e.target.value)}
                      onKeyPress={(e) => e.key === 'Enter' && fetchRepoStructure()}
                      className="flex-1 px-5 py-4 bg-slate-900/50 border border-slate-700 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-transparent transition-all duration-200"
                    />
                    <button
                      onClick={fetchRepoStructure}
                      disabled={loadingRepo}
                      className={`px-8 py-4 rounded-xl font-semibold transition-all duration-200 flex items-center gap-3 ${
                        loadingRepo
                          ? 'bg-slate-600 cursor-not-allowed text-slate-400'
                          : 'bg-gradient-to-r from-blue-500 to-cyan-500 hover:from-blue-600 hover:to-cyan-600 text-white shadow-lg shadow-blue-500/30 hover:scale-105'
                      }`}
                    >
                      {loadingRepo ? (
                        <>
                          <Loader className="w-5 h-5 animate-spin" />
                          Loading...
                        </>
                      ) : (
                        <>
                          <FolderOpen className="w-5 h-5" />
                          Browse
                        </>
                      )}
                    </button>
                  </div>
                  <p className="text-slate-500 text-xs">
                    Example: https://github.com/facebook/react
                  </p>
                </div>

                {/* Repository Info */}
                {repoInfo && (
                  <div className="mb-6 p-5 bg-slate-900/50 rounded-2xl border border-white/10">
                    <div className="flex items-center gap-3 mb-3">
                      <Github className="w-6 h-6 text-cyan-400" />
                      <h3 className="text-lg font-bold text-white">{repoInfo.repository}</h3>
                    </div>
                    <div className="flex gap-4 text-sm text-slate-400">
                      <span>Branch: <span className="text-white font-medium">{repoInfo.branch}</span></span>
                      <span>•</span>
                      <span>Files: <span className="text-white font-medium">{repoFiles.length}</span></span>
                      <span>•</span>
                      <span>Selected: <span className="text-cyan-400 font-medium">{selectedFiles.size}</span></span>
                    </div>
                  </div>
                )}

                {/* File Selection */}
                {repoFiles.length > 0 && (
                  <div>
                    {/* Filters */}
                    <div className="mb-4 flex gap-3">
                      <div className="flex-1 relative">
                        <Search className="w-5 h-5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                        <input
                          type="text"
                          placeholder="Search files..."
                          value={fileFilter}
                          onChange={(e) => setFileFilter(e.target.value)}
                          className="w-full pl-10 pr-10 py-3 bg-slate-900/50 border border-slate-700 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-cyan-500 text-sm"
                        />
                        {fileFilter && (
                          <button
                            onClick={() => setFileFilter("")}
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-white"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                      <select
                        value={languageFilter}
                        onChange={(e) => setLanguageFilter(e.target.value)}
                        className="px-4 py-3 bg-slate-900/50 border border-slate-700 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-cyan-500 text-sm cursor-pointer"
                      >
                        <option value="all">All Languages</option>
                        {getLanguages().map(lang => (
                          <option key={lang} value={lang.toLowerCase()}>{lang}</option>
                        ))}
                      </select>
                    </div>

                    {/* Selection Actions */}
                    <div className="flex items-center justify-between mb-4 p-4 bg-slate-900/30 rounded-xl border border-white/5">
                      <span className="text-slate-400 text-sm">
                        <span className="text-cyan-400 font-bold">{selectedFiles.size}</span> of <span className="font-semibold">{filteredFiles.length}</span> files selected <span className="text-slate-500">(max 20)</span>
                      </span>
                      <div className="flex gap-2">
                        <button
                          onClick={selectAllFiltered}
                          disabled={selectedFiles.size >= 20 || filteredFiles.length === 0}
                          className="px-4 py-2 bg-blue-500/10 hover:bg-blue-500/20 text-blue-300 rounded-lg text-sm font-medium transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                        >
                          <CheckSquare className="w-4 h-4" />
                          Select All
                        </button>
                        <button
                          onClick={clearSelection}
                          disabled={selectedFiles.size === 0}
                          className="px-4 py-2 bg-rose-500/10 hover:bg-rose-500/20 text-rose-300 rounded-lg text-sm font-medium transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                        >
                          <X className="w-4 h-4" />
                          Clear
                        </button>
                      </div>
                    </div>

                    {/* File List */}
                    {filteredFiles.length > 0 ? (
                      <>
                        <div className="max-h-96 overflow-y-auto space-y-2 mb-6 pr-2 custom-scrollbar">
                          {filteredFiles.map((file) => (
                            <div
                              key={file.path}
                              onClick={() => toggleFileSelection(file.path)}
                              className={`p-4 rounded-xl border cursor-pointer transition-all ${
                                selectedFiles.has(file.path)
                                  ? 'bg-cyan-500/10 border-cyan-500/30 hover:bg-cyan-500/15'
                                  : 'bg-slate-900/30 border-white/5 hover:border-cyan-500/20 hover:bg-slate-900/50'
                              }`}
                            >
                              <div className="flex items-center gap-3">
                                <div className="flex-shrink-0">
                                  {selectedFiles.has(file.path) ? (
                                    <CheckSquare className="w-5 h-5 text-cyan-400" />
                                  ) : (
                                    <Square className="w-5 h-5 text-slate-500" />
                                  )}
                                </div>
                                <File className="w-5 h-5 text-slate-400 flex-shrink-0" />
                                <div className="flex-1 min-w-0">
                                  <p className="text-white font-medium text-sm truncate">{file.path}</p>
                                  <div className="flex gap-3 text-xs text-slate-400 mt-1">
                                    <span className="px-2 py-0.5 bg-blue-500/10 text-blue-300 rounded">
                                      {getLanguage(file.path)}
                                    </span>
                                    <span>{formatFileSize(file.size)}</span>
                                  </div>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>

                        {/* Analyze Button */}
                        <button
                          onClick={analyzeSelectedFiles}
                          disabled={loading || selectedFiles.size === 0}
                          className={`w-full px-10 py-4 rounded-xl font-semibold transition-all duration-200 flex items-center justify-center gap-3 ${
                            loading || selectedFiles.size === 0
                              ? 'bg-slate-600 cursor-not-allowed text-slate-400'
                              : 'bg-gradient-to-r from-blue-500 to-cyan-500 hover:from-blue-600 hover:to-cyan-600 text-white shadow-lg shadow-blue-500/30 hover:scale-105'
                          }`}
                        >
                          {loading ? (
                            <>
                              <Loader className="w-5 h-5 animate-spin" />
                              <span>Analyzing {selectedFiles.size} file{selectedFiles.size !== 1 ? 's' : ''}...</span>
                            </>
                          ) : (
                            <>
                              <Code className="w-5 h-5" />
                              <span>Analyze {selectedFiles.size} Selected File{selectedFiles.size !== 1 ? 's' : ''}</span>
                            </>
                          )}
                        </button>
                      </>
                    ) : (
                      <div className="text-center py-12">
                        <Search className="w-12 h-12 text-slate-600 mx-auto mb-3" />
                        <p className="text-slate-400">No files found matching your filters</p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {activeTab === "history" && (
              <div className="bg-slate-800/40 backdrop-blur-xl rounded-3xl p-8 shadow-2xl border border-white/10">
                <h2 className="text-xl font-bold text-white mb-6 flex items-center gap-3">
                  <Clock className="w-6 h-6 text-cyan-400" />
                  My Analysis History
                </h2>

                {loadingHistory ? (
                  <div className="text-center py-12">
                    <Loader className="w-12 h-12 text-cyan-400 mx-auto mb-4 animate-spin" />
                    <p className="text-slate-400">Loading history...</p>
                  </div>
                ) : myHistory.length === 0 ? (
                  <div className="text-center py-16">
                    <FileCode className="w-16 h-16 text-slate-600 mx-auto mb-4" />
                    <p className="text-slate-400 text-lg mb-2">No analysis history yet</p>
                    <p className="text-slate-500 text-sm">Start analyzing code to build your history</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {myHistory.map((item) => (
                      <div
                        key={item.id}
                        className="bg-slate-900/50 rounded-2xl p-6 border border-white/5 hover:border-cyan-500/30 transition-all"
                      >
                        <div className="flex items-start justify-between mb-4">
                          <div className="flex items-center gap-3">
                            <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${
                              item.analysis_type === 'repository' 
                                ? 'bg-purple-500/20' 
                                : 'bg-blue-500/20'
                            }`}>
                              {item.analysis_type === 'repository' ? (
                                <Github className="w-6 h-6 text-purple-400" />
                              ) : (
                                <FileCode className="w-6 h-6 text-blue-400" />
                              )}
                            </div>
                            <div>
                              <p className="text-white font-semibold text-lg">
                                {item.repository_name || 'File Upload Analysis'}
                              </p>
                              <p className="text-slate-400 text-sm">
                                {new Date(item.created_at).toLocaleString()}
                              </p>
                            </div>
                          </div>
                          <span className={`px-3 py-1 rounded-lg text-xs font-semibold ${
                            item.analysis_type === 'repository'
                              ? 'bg-purple-500/20 text-purple-300 border border-purple-500/30'
                              : 'bg-blue-500/20 text-blue-300 border border-blue-500/30'
                          }`}>
                            {item.analysis_type}
                          </span>
                        </div>

                        <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
                          <div className="bg-slate-800/50 rounded-xl p-4 text-center">
                            <p className="text-slate-400 text-xs mb-1">Files</p>
                            <p className="text-white font-bold text-xl">{item.file_count}</p>
                          </div>
                          <div className="bg-slate-800/50 rounded-xl p-4 text-center">
                            <p className="text-slate-400 text-xs mb-1">Total Issues</p>
                            <p className="text-white font-bold text-xl">{item.total_errors}</p>
                          </div>
                          <div className="bg-rose-500/10 rounded-xl p-4 text-center border border-rose-500/20">
                            <p className="text-rose-400 text-xs mb-1">Critical</p>
                            <p className="text-rose-300 font-bold text-xl">{item.critical_errors}</p>
                          </div>
                          <div className="bg-orange-500/10 rounded-xl p-4 text-center border border-orange-500/20">
                            <p className="text-orange-400 text-xs mb-1">High</p>
                            <p className="text-orange-300 font-bold text-xl">{item.high_errors}</p>
                          </div>
                          <div className="bg-yellow-500/10 rounded-xl p-4 text-center border border-yellow-500/20">
                            <p className="text-yellow-400 text-xs mb-1">Medium</p>
                            <p className="text-yellow-300 font-bold text-xl">{item.medium_errors}</p>
                          </div>
                          <div className="bg-blue-500/10 rounded-xl p-4 text-center border border-blue-500/20">
                            <p className="text-blue-400 text-xs mb-1">Low</p>
                            <p className="text-blue-300 font-bold text-xl">{item.low_errors}</p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Repository Analysis Summary */}
            {(repoAnalysis || (reviewResults.length > 0 && uploadedFiles.length > 0)) && (
              <div className="bg-slate-800/40 backdrop-blur-xl rounded-3xl p-8 shadow-2xl border border-white/10">
                <h2 className="text-xl font-bold text-white mb-6 flex items-center gap-3">
                  <Activity className="w-6 h-6 text-cyan-400" />
                  Analysis Summary
                </h2>
                
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                  <div className="bg-slate-900/50 p-5 rounded-xl text-center border border-white/5">
                    <p className="text-3xl font-bold text-blue-400 mb-1">
                      {repoAnalysis ? repoAnalysis.filesAnalyzed : reviewResults.length}
                    </p>
                    <p className="text-slate-400 text-sm">Files Analyzed</p>
                  </div>
                  <div className="bg-slate-900/50 p-5 rounded-xl text-center border border-white/5">
                    <p className="text-3xl font-bold text-rose-400 mb-1">
                      {repoAnalysis 
                        ? repoAnalysis.filesWithErrors 
                        : reviewResults.filter(r => r.errors?.length > 0).length
                      }
                    </p>
                    <p className="text-slate-400 text-sm">With Errors</p>
                  </div>
                  <div className="bg-slate-900/50 p-5 rounded-xl text-center border border-white/5">
                    <p className="text-3xl font-bold text-emerald-400 mb-1">
                      {repoAnalysis 
                        ? repoAnalysis.filesWithoutErrors 
                        : reviewResults.filter(r => !r.errors || r.errors.length === 0).length
                      }
                    </p>
                    <p className="text-slate-400 text-sm">Clean Files</p>
                  </div>
                  <div className="bg-slate-900/50 p-5 rounded-xl text-center border border-white/5">
                    <p className="text-3xl font-bold text-cyan-400 mb-1">
                      {repoAnalysis 
                        ? (repoAnalysis.aggregateMetrics?.totalErrors || 0)
                        : reviewResults.reduce((acc, r) => acc + (r.errors?.length || 0), 0)
                      }
                    </p>
                    <p className="text-slate-400 text-sm">Total Issues</p>
                  </div>
                </div>

                {/* Download Button */}
                <div className="mt-6">
                  <button
                    onClick={downloadReviewAsPDF}
                    disabled={reviewResults.length === 0}
                    className={`w-full px-6 py-4 rounded-xl font-semibold transition-all duration-200 flex items-center justify-center gap-3 ${
                      reviewResults.length === 0
                        ? 'bg-slate-600 cursor-not-allowed text-slate-400 opacity-50'
                        : 'bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 text-white shadow-lg shadow-emerald-500/30 hover:scale-105 active:scale-95'
                    }`}
                  >
                    <Download className="w-5 h-5" />
                    <span>Download Review as PDF</span>
                    <FileText className="w-5 h-5" />
                  </button>
                </div>
                    
                {repoAnalysis && (
                  <div className="flex items-center justify-between text-sm p-4 bg-slate-900/30 rounded-xl border border-white/5 mt-6">
                    <div className="flex items-center gap-2">
                      <GitBranch className="w-4 h-4 text-slate-400" />
                      <span className="text-slate-400">Repository:</span>
                      <span className="text-white font-medium">{repoAnalysis.repository}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Clock className="w-4 h-4 text-slate-400" />
                      <span className="text-slate-400">Time:</span>
                      <span className="text-white font-medium">{(repoAnalysis.processingTime / 1000).toFixed(1)}s</span>
                    </div>
                  </div>
                )}

                {!repoAnalysis && uploadedFiles.length > 0 && (
                  <div className="flex items-center justify-center text-sm p-4 bg-slate-900/30 rounded-xl border border-white/5 mt-6">
                    <div className="flex items-center gap-2">
                      <FileCode className="w-4 h-4 text-blue-400" />
                      <span className="text-slate-400">Source:</span>
                      <span className="text-white font-medium">Manual File Upload</span>
                    </div>
                  </div>
                )}
                
              </div>
            )}

            {/* Review Results with Accept/Reject Buttons */}
            {reviewResults.length > 0 && (
              <div className="bg-slate-800/40 backdrop-blur-xl rounded-3xl p-8 shadow-2xl border border-white/10">
                <h2 className="text-xl font-bold text-white mb-6">
                  Files with Issues ({reviewResults.length})
                </h2>
                <div className="space-y-6">
                  {reviewResults.map((result) => (
                    <div
                      key={result.id}
                      className="p-6 bg-slate-900/50 rounded-2xl border border-white/10 hover:border-cyan-500/30 transition-all duration-200"
                    >
                      <div className="flex items-center justify-between mb-5">
                        <div className="flex items-center gap-3">
                          <div className="p-2 bg-blue-500/10 rounded-lg">
                            <FileCode className="w-6 h-6 text-blue-400" />
                          </div>
                          <div>
                            <span className="text-white font-semibold text-lg">{result.name}</span>
                            {result.source && (
                              <span className="ml-3 px-3 py-1 bg-purple-500/15 text-purple-300 text-xs rounded-lg font-medium border border-purple-500/20">
                                {result.source}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Summary Stats */}
                      {result.summary && (
                        <div className="grid grid-cols-3 gap-4 mb-5 p-5 bg-slate-800/50 rounded-xl border border-white/5">
                          <div className="text-center">
                            <p className="text-2xl font-bold text-rose-400">{result.summary.totalErrors || 0}</p>
                            <p className="text-slate-400 text-sm mt-1">Total Errors</p>
                          </div>
                          <div className="text-center">
                            <p className="text-2xl font-bold text-orange-400">{result.summary.criticalErrors || 0}</p>
                            <p className="text-slate-400 text-sm mt-1">Critical</p>
                          </div>
                          <div className="text-center">
                            <p className="text-2xl font-bold text-yellow-400">{result.summary.highErrors || 0}</p>
                            <p className="text-slate-400 text-sm mt-1">High Priority</p>
                          </div>
                        </div>
                      )}

                      {/* Errors with Accept/Reject Buttons */}
                      {result.errors && result.errors.length > 0 && (
                        <div className="mb-5">
                          <h4 className="text-slate-300 font-semibold mb-4 flex items-center gap-2">
                            <AlertTriangle className="w-4 h-4 text-rose-400" />
                            <span>Issues Found ({result.errors.length})</span>
                          </h4>
                          <div className="space-y-3">
                            {sortErrors(result.errors).map((err, idx) => {
                              const status = getErrorStatus(result.id, err);
                              
                              return (
                                <div
                                  key={idx}
                                  className={`p-4 rounded-xl border transition-all ${
                                    status === 'accepted' 
                                      ? 'bg-emerald-500/10 border-emerald-500/30 opacity-60' 
                                      : status === 'rejected'
                                      ? 'bg-rose-500/10 border-rose-500/30 opacity-60'
                                      : `${getLevelColor(err.level)}`
                                  }`}
                                >
                                  <div className="flex items-start gap-3">
                                    <div className="flex items-center gap-2 mt-1">
                                      {getLevelIcon(err.level)}
                                      {getSeverityIcon(err.severity)}
                                    </div>
                                    <div className="flex-1">
                                      <div className="flex items-center gap-2 mb-2 flex-wrap">
                                        <span className="font-semibold text-sm">
                                          Line {err.line || 'N/A'}
                                        </span>
                                        <span className="px-2.5 py-1 bg-black/30 rounded-lg text-xs uppercase font-semibold">
                                          {err.level || 'General'}
                                        </span>
                                        {err.severity && (
                                          <span className="px-2.5 py-1 bg-black/30 rounded-lg text-xs uppercase font-semibold">
                                            {err.severity}
                                          </span>
                                        )}
                                        {err.type && (
                                          <span className="px-2.5 py-1 bg-black/30 rounded-lg text-xs font-medium">
                                            {err.type}
                                          </span>
                                        )}
                                        {status !== 'pending' && (
                                          <span className={`px-2.5 py-1 rounded-lg text-xs font-semibold ml-auto ${
                                            status === 'accepted' 
                                              ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30' 
                                              : 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                                          }`}>
                                            {status === 'accepted' ? '✓ Resolved' : '✗ Won\'t Fix'}
                                          </span>
                                        )}
                                      </div>
                                      <p className="text-sm mb-2 font-medium leading-relaxed">{err.message}</p>
                                      {err.suggestion && (
                                        <p className="text-sm bg-black/30 p-3 rounded-lg mt-2 leading-relaxed">
                                          <strong>Suggestion:</strong> {err.suggestion}
                                        </p>
                                      )}

                                      {/* Accept/Reject Buttons */}
                                      <div className="flex gap-2 mt-3">
                                        <button
                                          onClick={() => handleAcceptError(result.id, err)}
                                          disabled={status === 'accepted'}
                                          className={`flex-1 px-4 py-2.5 rounded-xl transition-all font-semibold text-sm flex items-center justify-center gap-2 ${
                                            status === 'accepted'
                                              ? 'bg-emerald-500/30 text-emerald-300 cursor-not-allowed'
                                              : 'bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-400 hover:text-emerald-300 border border-emerald-500/30 hover:scale-105 active:scale-95'
                                          }`}
                                          title="Accept & Mark as Resolved"
                                        >
                                          <Check className="w-4 h-4" />
                                          {status === 'accepted' ? 'Resolved' : 'Accept & Resolve'}
                                        </button>
                                        <button
                                          onClick={() => handleRejectError(result.id, err)}
                                          disabled={status === 'rejected'}
                                          className={`flex-1 px-4 py-2.5 rounded-xl transition-all font-semibold text-sm flex items-center justify-center gap-2 ${
                                            status === 'rejected'
                                              ? 'bg-rose-500/30 text-rose-300 cursor-not-allowed'
                                              : 'bg-rose-500/20 hover:bg-rose-500/30 text-rose-400 hover:text-rose-300 border border-rose-500/30 hover:scale-105 active:scale-95'
                                          }`}
                                          title="Reject & Mark as Won't Fix"
                                        >
                                          <XCircle className="w-4 h-4" />
                                          {status === 'rejected' ? 'Won\'t Fix' : 'Reject'}
                                        </button>
                                      </div>
                                    </div>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      )}

                      {/* Suggestions */}
                      {result.suggestions && result.suggestions.length > 0 && (
                        <div>
                          <h4 className="text-slate-300 font-semibold mb-4 flex items-center gap-2">
                            <Info className="w-4 h-4 text-blue-400" />
                            <span>Suggestions ({result.suggestions.length})</span>
                          </h4>
                          <div className="space-y-3">
                            {result.suggestions.map((suggestion, idx) => (
                              <div
                                key={idx}
                                className="p-4 bg-blue-500/10 rounded-xl border border-blue-500/20"
                              >
                                <div className="flex items-start gap-2">
                                  <Info className="w-4 h-4 text-blue-400 mt-0.5" />
                                  <div className="flex-1">
                                    <p className="text-blue-300 text-sm font-semibold mb-1">
                                      Line {suggestion.line || 'N/A'} • {suggestion.type || 'Improvement'}
                                    </p>
                                    <p className="text-blue-200 text-sm leading-relaxed">{suggestion.message}</p>
                                    {suggestion.fix && (
                                      <p className="text-blue-200/80 text-xs mt-2 bg-black/20 p-2 rounded">
                                        💡 {suggestion.fix}
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

            {/* No Errors Message */}
            {repoAnalysis && reviewResults.length === 0 && !loading && (
              <div className="bg-slate-800/40 backdrop-blur-xl rounded-3xl p-8 shadow-2xl border border-white/10">
                <div className="text-center py-16">
                  <div className="w-20 h-20 bg-gradient-to-br from-emerald-500 to-teal-500 rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-xl shadow-emerald-500/30">
                    <CheckCircle className="w-10 h-10 text-white" />
                  </div>
                  <h3 className="text-3xl font-bold text-white mb-3">
                    No Errors Found! 🎉
                  </h3>
                  <p className="text-slate-300 text-lg mb-2">
                    All {repoAnalysis.filesAnalyzed} analyzed files are error-free.
                  </p>
                  <p className="text-slate-400 text-sm">
                    Your code quality is excellent!
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Quick Stats */}
            <div className="bg-slate-800/40 backdrop-blur-xl rounded-3xl p-6 shadow-2xl border border-white/10">
              <h3 className="text-lg font-bold text-white mb-5 flex items-center gap-2">
                <TrendingUp className="w-5 h-5 text-cyan-400" />
                Statistics
              </h3>
              <div className="space-y-4">
                <div className="flex justify-between items-center p-3 bg-slate-900/30 rounded-xl">
                  <span className="text-slate-400">Files Reviewed</span>
                  <span className="text-white font-bold text-lg">
                    {repoAnalysis ? repoAnalysis.filesAnalyzed : reviewResults.length}
                  </span>
                </div>
                <div className="flex justify-between items-center p-3 bg-slate-900/30 rounded-xl">
                  <span className="text-slate-400">Files with Issues</span>
                  <span className="text-rose-400 font-bold text-lg">
                    {reviewResults.length}
                  </span>
                </div>
                <div className="flex justify-between items-center p-3 bg-slate-900/30 rounded-xl">
                  <span className="text-slate-400">Total Issues</span>
                  <span className="text-white font-bold text-lg">
                    {reviewResults.reduce(
                      (acc, r) => acc + (r.errors?.length || 0),
                      0
                    )}
                  </span>
                </div>
                <div className="flex justify-between items-center p-3 bg-slate-900/30 rounded-xl">
                  <span className="text-slate-400">Critical Issues</span>
                  <span className="text-rose-400 font-bold text-lg">
                    {reviewResults.reduce(
                      (acc, r) => acc + (r.errors?.filter(e => e.severity === 'critical')?.length || 0),
                      0
                    )}
                  </span>
                </div>
                
                {/* Issue Breakdown by Level */}
                {reviewResults.some(r => r.errors?.length > 0) && (
                  <div className="mt-6 pt-5 border-t border-white/10">
                    <h4 className="text-slate-300 font-semibold mb-4">Issues by Level</h4>
                    <div className="space-y-3">
                      {['architectural', 'syntax', 'logical', 'performance', 'security'].map(level => {
                        const count = reviewResults.reduce(
                          (acc, r) => acc + (r.errors?.filter(e => e.level === level)?.length || 0),
                          0
                        );
                        if (count === 0) return null;
                        return (
                          <div key={level} className="flex justify-between items-center p-3 bg-slate-900/30 rounded-xl">
                            <div className="flex items-center gap-2">
                              {getLevelIcon(level)}
                              <span className="text-slate-300 capitalize text-sm font-medium">{level}</span>
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
            {(loading || loadingRepo) && (
              <div className="bg-slate-800/40 backdrop-blur-xl rounded-3xl p-6 shadow-2xl border border-white/10">
                <div className="flex flex-col items-center space-y-4">
                  <div className="relative">
                    <div className="animate-spin rounded-full h-12 w-12 border-4 border-slate-700 border-t-cyan-400"></div>
                    <div className="absolute inset-0 rounded-full bg-gradient-to-r from-cyan-500/20 to-blue-500/20 blur-xl"></div>
                  </div>
                  <span className="text-white font-semibold">
                    {loadingRepo ? 'Loading repository...' : 'Analyzing code...'}
                  </span>
                  <p className="text-slate-400 text-sm text-center">
                    {loadingRepo ? 'Fetching file structure' : 'This may take a few moments'}
                  </p>
                </div>
              </div>
            )}

            {/* Help Card */}
            {!loading && !loadingRepo && repoFiles.length === 0 && reviewResults.length === 0 && activeTab !== "history" && (
              <div className="bg-gradient-to-br from-blue-500/10 to-purple-500/10 backdrop-blur-xl rounded-3xl p-6 shadow-2xl border border-blue-500/20">
                <h3 className="text-lg font-bold text-white mb-3 flex items-center gap-2">
                  <Info className="w-5 h-5 text-blue-400" />
                  How to Use
                </h3>
                <div className="space-y-3 text-sm text-slate-300">
                  <div className="flex gap-3">
                    <div className="flex-shrink-0 w-6 h-6 bg-blue-500/20 rounded-full flex items-center justify-center text-blue-400 font-bold text-xs">
                      1
                    </div>
                    <p>Enter a GitHub repository URL and click Browse</p>
                  </div>
                  <div className="flex gap-3">
                    <div className="flex-shrink-0 w-6 h-6 bg-blue-500/20 rounded-full flex items-center justify-center text-blue-400 font-bold text-xs">
                      2
                    </div>
                    <p>Select up to 20 files you want to analyze</p>
                  </div>
                  <div className="flex gap-3">
                    <div className="flex-shrink-0 w-6 h-6 bg-blue-500/20 rounded-full flex items-center justify-center text-blue-400 font-bold text-xs">
                      3
                    </div>
                    <p>Click "Analyze Selected Files" to start review</p>
                  </div>
                  <div className="flex gap-3">
                    <div className="flex-shrink-0 w-6 h-6 bg-blue-500/20 rounded-full flex items-center justify-center text-blue-400 font-bold text-xs">
                      4
                    </div>
                    <p>Review errors and use Accept/Reject buttons</p>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Custom Scrollbar Styles */}
      <style>{`
        .custom-scrollbar::-webkit-scrollbar {
          width: 8px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: rgba(15, 23, 42, 0.5);
          border-radius: 10px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: rgba(100, 116, 139, 0.5);
          border-radius: 10px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: rgba(148, 163, 184, 0.7);
        }
      `}</style>
    </div>
  );
}

// Admin Dashboard Component
function AdminDashboard({ onBack, profile, onLogout }) {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedUser, setSelectedUser] = useState(null);
  const [userHistory, setUserHistory] = useState([]);
  const [loadingHistory, setLoadingHistory] = useState(false);

  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/admin/users`);
      const data = await res.json();
      if (data.success) {
        setUsers(data.users);
      }
    } catch (error) {
      console.error('Error fetching users:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchUserHistory = async (userId, userName) => {
    setLoadingHistory(true);
    setSelectedUser({ id: userId, name: userName });
    try {
      const res = await fetch(`${API_BASE}/admin/user-history/${userId}`);
      const data = await res.json();
      if (data.success) {
        setUserHistory(data.history);
      }
    } catch (error) {
      console.error('Error fetching history:', error);
    } finally {
      setLoadingHistory(false);
    }
  };

  const closeHistoryModal = () => {
    setSelectedUser(null);
    setUserHistory([]);
  };

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

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900 text-white p-8">
      <div className="container mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-10">
          <button
            onClick={onBack}
            className="p-2.5 bg-white/5 hover:bg-white/10 rounded-xl transition-all duration-200 hover:scale-105 border border-white/10"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 bg-gradient-to-br from-purple-500 to-pink-500 rounded-2xl flex items-center justify-center shadow-lg shadow-purple-500/30">
              <Users className="w-7 h-7 text-white" />
            </div>
            <h1 className="text-3xl font-bold tracking-tight">Admin Dashboard</h1>
          </div>
          <div className="flex items-center gap-4">
            <div className="text-right px-4 py-2 bg-white/5 rounded-xl border border-white/10">
              <p className="text-white font-medium text-sm">
                {profile?.name || "Admin"}
              </p>
              <p className="text-slate-400 text-xs">{profile?.email}</p>
            </div>
            <button
              onClick={handleLogout}
              className="p-2.5 bg-rose-500/10 hover:bg-rose-500/20 rounded-xl text-rose-300 hover:text-rose-200 transition-all duration-200 border border-rose-500/20 hover:border-rose-500/40"
              title="Logout"
            >
              <LogOut className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-10">
          <div className="bg-slate-800/40 backdrop-blur-xl rounded-2xl p-6 border border-white/10">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-slate-400 text-sm mb-1">Total Users</p>
                <p className="text-3xl font-bold text-white">{users.length}</p>
              </div>
              <div className="w-12 h-12 bg-blue-500/20 rounded-xl flex items-center justify-center">
                <Users className="w-6 h-6 text-blue-400" />
              </div>
            </div>
          </div>

          <div className="bg-slate-800/40 backdrop-blur-xl rounded-2xl p-6 border border-white/10">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-slate-400 text-sm mb-1">Admin Users</p>
                <p className="text-3xl font-bold text-white">
                  {users.filter(u => u.role === 'admin').length}
                </p>
              </div>
              <div className="w-12 h-12 bg-purple-500/20 rounded-xl flex items-center justify-center">
                <Shield className="w-6 h-6 text-purple-400" />
              </div>
            </div>
          </div>

          <div className="bg-slate-800/40 backdrop-blur-xl rounded-2xl p-6 border border-white/10">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-slate-400 text-sm mb-1">Regular Users</p>
                <p className="text-3xl font-bold text-white">
                  {users.filter(u => u.role !== 'admin').length}
                </p>
              </div>
              <div className="w-12 h-12 bg-emerald-500/20 rounded-xl flex items-center justify-center">
                <Users className="w-6 h-6 text-emerald-400" />
              </div>
            </div>
          </div>
        </div>

        {/* Users Table */}
        <div className="bg-slate-800/40 backdrop-blur-xl rounded-3xl shadow-2xl border border-white/10 p-8">
          <div className="flex items-center justify-between mb-8">
            <h2 className="text-2xl font-bold">User Management</h2>
            <button
              onClick={fetchUsers}
              className="px-4 py-2 bg-blue-500/20 hover:bg-blue-500/30 rounded-xl text-blue-300 text-sm font-medium transition-all flex items-center gap-2"
            >
              <Activity className="w-4 h-4" />
              Refresh
            </button>
          </div>

          {loading ? (
            <div className="text-center py-12">
              <Loader className="w-12 h-12 text-cyan-400 mx-auto mb-4 animate-spin" />
              <p className="text-slate-400">Loading users...</p>
            </div>
          ) : users.length === 0 ? (
            <div className="text-center py-16">
              <Users className="w-16 h-16 text-slate-600 mx-auto mb-4" />
              <p className="text-slate-400">No users found</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-900/50 border-b border-white/10">
                    <th className="p-5 font-bold text-slate-300 rounded-tl-xl">User</th>
                    <th className="p-5 font-bold text-slate-300">Email</th>
                    <th className="p-5 font-bold text-slate-300">Role</th>
                    <th className="p-5 font-bold text-slate-300">Joined</th>
                    <th className="p-5 font-bold text-slate-300 rounded-tr-xl">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {users.map((user) => (
                    <tr
                      key={user.id}
                      className="border-b border-white/5 hover:bg-slate-900/30 transition-colors"
                    >
                      <td className="p-5">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-purple-600 rounded-xl flex items-center justify-center text-white font-bold text-sm shadow-lg">
                            {user.name ? user.name.charAt(0).toUpperCase() : "U"}
                          </div>
                          <span className="text-white font-semibold">
                            {user.name || "Unnamed User"}
                          </span>
                        </div>
                      </td>
                      <td className="p-5">
                        <span className="text-slate-300">{user.email}</span>
                      </td>
                      <td className="p-5">
                        <span className={`px-3 py-1 rounded-lg text-xs font-semibold ${
                          user.role === 'admin' 
                            ? 'bg-purple-500/20 text-purple-300 border border-purple-500/30' 
                            : 'bg-blue-500/20 text-blue-300 border border-blue-500/30'
                        }`}>
                          {user.role || 'user'}
                        </span>
                      </td>
                      <td className="p-5">
                        <span className="text-slate-400 text-sm">
                          {new Date(user.created_at).toLocaleDateString()}
                        </span>
                      </td>
                      <td className="p-5">
                        <button
                          className="px-5 py-2.5 bg-gradient-to-r from-blue-500 to-cyan-500 hover:from-blue-600 hover:to-cyan-600 rounded-xl text-white text-sm font-semibold transition-all duration-200 flex items-center gap-2 shadow-lg shadow-blue-500/30 hover:scale-105"
                          onClick={() => fetchUserHistory(user.id, user.name || user.email)}
                        >
                          <FileCode className="w-4 h-4" />
                          View History
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* History Modal */}
        {selectedUser && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="bg-slate-800 rounded-3xl shadow-2xl border border-white/10 max-w-4xl w-full max-h-[80vh] overflow-hidden">
              {/* Modal Header */}
              <div className="p-6 border-b border-white/10 flex items-center justify-between">
                <div>
                  <h3 className="text-2xl font-bold text-white">Analysis History</h3>
                  <p className="text-slate-400 text-sm mt-1">{selectedUser.name}</p>
                </div>
                <button
                  onClick={closeHistoryModal}
                  className="p-2 hover:bg-white/10 rounded-xl transition-all"
                >
                  <X className="w-6 h-6 text-slate-400" />
                </button>
              </div>

              {/* Modal Body */}
              <div className="p-6 overflow-y-auto max-h-[calc(80vh-140px)]">
                {loadingHistory ? (
                  <div className="text-center py-12">
                    <Loader className="w-12 h-12 text-cyan-400 mx-auto mb-4 animate-spin" />
                    <p className="text-slate-400">Loading history...</p>
                  </div>
                ) : userHistory.length === 0 ? (
                  <div className="text-center py-16">
                    <FileCode className="w-16 h-16 text-slate-600 mx-auto mb-4" />
                    <p className="text-slate-400">No analysis history found</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {userHistory.map((item) => (
                      <div
                        key={item.id}
                        className="bg-slate-900/50 rounded-2xl p-6 border border-white/5 hover:border-cyan-500/30 transition-all"
                      >
                        <div className="flex items-start justify-between mb-4">
                          <div className="flex items-center gap-3">
                            <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${
                              item.analysis_type === 'repository' 
                                ? 'bg-purple-500/20' 
                                : 'bg-blue-500/20'
                            }`}>
                              {item.analysis_type === 'repository' ? (
                                <Github className="w-6 h-6 text-purple-400" />
                              ) : (
                                <FileCode className="w-6 h-6 text-blue-400" />
                              )}
                            </div>
                            <div>
                              <p className="text-white font-semibold">
                                {item.repository_name || 'File Upload'}
                              </p>
                              <p className="text-slate-400 text-sm">
                                {new Date(item.created_at).toLocaleString()}
                              </p>
                            </div>
                          </div>
                          <span className={`px-3 py-1 rounded-lg text-xs font-semibold ${
                            item.analysis_type === 'repository'
                              ? 'bg-purple-500/20 text-purple-300'
                              : 'bg-blue-500/20 text-blue-300'
                          }`}>
                            {item.analysis_type}
                          </span>
                        </div>

                        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                          <div className="bg-slate-800/50 rounded-xl p-3 text-center">
                            <p className="text-slate-400 text-xs mb-1">Files</p>
                            <p className="text-white font-bold text-lg">{item.file_count}</p>
                          </div>
                          <div className="bg-slate-800/50 rounded-xl p-3 text-center">
                            <p className="text-slate-400 text-xs mb-1">Total</p>
                            <p className="text-white font-bold text-lg">{item.total_errors}</p>
                          </div>
                          <div className="bg-rose-500/10 rounded-xl p-3 text-center">
                            <p className="text-rose-400 text-xs mb-1">Critical</p>
                            <p className="text-rose-300 font-bold text-lg">{item.critical_errors}</p>
                          </div>
                          <div className="bg-orange-500/10 rounded-xl p-3 text-center">
                            <p className="text-orange-400 text-xs mb-1">High</p>
                            <p className="text-orange-300 font-bold text-lg">{item.high_errors}</p>
                          </div>
                          <div className="bg-yellow-500/10 rounded-xl p-3 text-center">
                            <p className="text-yellow-400 text-xs mb-1">Medium</p>
                            <p className="text-yellow-300 font-bold text-lg">{item.medium_errors}</p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// Main Dashboard Component
export default function Dashboard({ onBack, profile, onLogout }) {
  // Admin users see admin dashboard
  if (profile?.role === "admin") {
    return <AdminDashboard onBack={onBack} profile={profile} onLogout={onLogout} />;
  }

  // Regular users see code review UI
  return <CodeReviewUI onBack={onBack} profile={profile} onLogout={onLogout} />;
}