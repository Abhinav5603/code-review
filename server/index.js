import express from "express";
import cors from "cors";
import bodyParser from "body-parser";
import fetch from "node-fetch";
import dotenv from "dotenv";
import { Octokit } from "@octokit/rest";
import path from "path";
import { createClient } from '@supabase/supabase-js';

dotenv.config();
const app = express();
app.use(cors());
app.use(bodyParser.json({ limit: '50mb' }));

// Initialize Supabase client
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY
);

// Cache configuration
const analysisCache = new Map();
const CACHE_DURATION = 10 * 60 * 1000;
const MAX_CACHE_ENTRIES = 1000;

setInterval(() => {
  const now = Date.now();
  let cleanedCount = 0;
  
  for (const [key, value] of analysisCache.entries()) {
    if (now - value.timestamp > CACHE_DURATION) {
      analysisCache.delete(key);
      cleanedCount++;
    }
  }
  
  if (cleanedCount > 0) {
    console.log(`🧹 Auto-cleaned ${cleanedCount} expired cache entries`);
  }
  
  if (analysisCache.size > MAX_CACHE_ENTRIES) {
    const entries = Array.from(analysisCache.entries())
      .sort((a, b) => a[1].timestamp - b[1].timestamp);
    
    const toRemove = entries.slice(0, analysisCache.size - MAX_CACHE_ENTRIES);
    toRemove.forEach(([key]) => analysisCache.delete(key));
    
    console.log(`🧹 Removed ${toRemove.length} oldest cache entries`);
  }
}, CACHE_DURATION);

// Language detection
function detectLanguage(filename) {
  const ext = path.extname(filename).toLowerCase();
  const langMap = {
    '.js': 'JavaScript', '.jsx': 'JavaScript (React)', '.mjs': 'JavaScript (ES Module)',
    '.ts': 'TypeScript', '.tsx': 'TypeScript (React)',
    '.py': 'Python', '.pyw': 'Python',
    '.java': 'Java', '.kt': 'Kotlin', '.kts': 'Kotlin',
    '.cpp': 'C++', '.cc': 'C++', '.cxx': 'C++', '.hpp': 'C++',
    '.c': 'C', '.h': 'C/C++ Header',
    '.cs': 'C#', '.vb': 'Visual Basic',
    '.php': 'PHP', '.rb': 'Ruby',
    '.go': 'Go', '.rs': 'Rust',
    '.html': 'HTML', '.htm': 'HTML',
    '.css': 'CSS', '.scss': 'SCSS', '.sass': 'Sass', '.less': 'Less',
    '.vue': 'Vue', '.svelte': 'Svelte',
    '.swift': 'Swift', '.m': 'Objective-C',
    '.sql': 'SQL', '.sh': 'Shell', '.bash': 'Bash',
    '.json': 'JSON', '.xml': 'XML', '.yaml': 'YAML', '.yml': 'YAML'
  };
  return langMap[ext] || 'Unknown';
}

// Check if file is supported
function isSupportedFile(filename) {
  const ext = path.extname(filename).toLowerCase();
  const supportedExts = [
    '.js', '.jsx', '.mjs', '.ts', '.tsx',
    '.py', '.pyw', '.java', '.kt', '.kts',
    '.cpp', '.cc', '.cxx', '.c', '.h', '.hpp',
    '.cs', '.vb', '.php', '.rb', '.go', '.rs',
    '.html', '.htm', '.css', '.scss', '.sass',
    '.vue', '.svelte', '.swift', '.m', '.sql'
  ];
  return supportedExts.includes(ext);
}

// Groq API analysis
async function analyzeWithGroq(code, filename) {
  const language = detectLanguage(filename);
  const cacheKey = `${filename}-${code.length}-${code.substring(0, 100)}`;
  
  if (analysisCache.has(cacheKey)) {
    const cached = analysisCache.get(cacheKey);
    if (Date.now() - cached.timestamp < CACHE_DURATION) {
      console.log(`✅ Using cached result for ${filename}`);
      return cached.data;
    }
    analysisCache.delete(cacheKey);
  }
  
  console.log(`\n${'='.repeat(70)}`);
  console.log(`🔍 ANALYZING: ${filename}`);
  console.log(`💻 Language: ${language}`);
  console.log(`📏 Size: ${code.length} chars, ${code.split('\n').length} lines`);
  
  if (!process.env.GROQ_API_KEY) {
    throw new Error('GROQ_API_KEY not configured');
  }

  const apiKey = process.env.GROQ_API_KEY.trim();

  const prompt = `You are an expert code reviewer with deep knowledge of ${language}. Perform a COMPREHENSIVE and ACCURATE analysis of this code.

FILE: ${filename}
LANGUAGE: ${language}
LINES: ${code.split('\n').length}

CODE:
\`\`\`${language.toLowerCase()}
${code}
\`\`\`

CRITICAL INSTRUCTIONS:
1. Only report REAL, ACTUAL issues that exist in the code
2. Be SPECIFIC about line numbers - count carefully from line 1
3. Verify each issue exists before reporting it
4. Don't report issues that don't actually exist in the code
5. Focus on issues that would prevent the code from working correctly

ANALYZE FOR:

🔴 CRITICAL ISSUES (Code won't run):
- Syntax errors: typos in keywords, variables, functions
- Missing brackets, parentheses, semicolons
- Undefined variables or functions being used
- Import/require statements for missing modules
- Type errors (wrong data types)

🟠 HIGH PRIORITY (Security & Logic):
- Security vulnerabilities (SQL injection, XSS, hardcoded secrets)
- Logic errors that cause wrong results
- Null/undefined reference errors
- Infinite loops or recursion issues
- Race conditions

🟡 MEDIUM PRIORITY (Performance & Quality):
- Inefficient algorithms (O(n²) when O(n) possible)
- Memory leaks or resource management
- Code duplication
- Poor error handling
- Missing input validation

🟢 LOW PRIORITY (Best Practices):
- Naming conventions
- Code organization
- Comments and documentation
- Style consistency

Return ONLY valid JSON (no markdown, no explanations):

{
  "errors": [
    {
      "line": 3,
      "message": "Variable 'userName' is used but never declared",
      "severity": "critical",
      "type": "runtime",
      "level": "syntax",
      "suggestion": "Add 'const userName = ...' or 'let userName = ...' before using it",
      "code_snippet": "console.log(userName);"
    }
  ],
  "suggestions": [
    {
      "line": 5,
      "message": "Add input validation for user data",
      "type": "improvement",
      "priority": "medium",
      "fix": "Check if data exists and is valid before processing"
    }
  ],
  "codeMetrics": {
    "complexity": "low|medium|high",
    "maintainability": "poor|fair|good|excellent",
    "security": "poor|fair|good|excellent",
    "performance": "poor|fair|good|excellent",
    "testability": "poor|fair|good|excellent"
  },
  "summary": {
    "codeQuality": "poor|fair|good|excellent",
    "strengths": ["specific strength 1", "specific strength 2"],
    "weaknesses": ["specific weakness 1", "specific weakness 2"],
    "overallAssessment": "Brief assessment of the code quality"
  }
}`;

  const requestBody = {
    model: "llama-3.3-70b-versatile",
    messages: [
      {
        role: "system",
        content: "You are an expert code analyzer. You MUST respond with valid JSON only. Be accurate and specific."
      },
      {
        role: "user",
        content: prompt
      }
    ],
    temperature: 0.1,
    max_tokens: 8192,
    top_p: 0.8,
    response_format: { type: "json_object" }
  };

  try {
    console.log(`📡 Sending request to Groq API...`);
    
    const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: { 
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKey}`
      },
      body: JSON.stringify(requestBody)
    });

    console.log(`📥 Response status: ${response.status}`);

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`❌ API Error Response:`, errorText);
      throw new Error(`Groq API error (${response.status})`);
    }

    const data = await response.json();
    const aiText = data?.choices?.[0]?.message?.content;
    
    if (!aiText) {
      throw new Error('Empty response from Groq API');
    }

    console.log(`✅ Got AI response: ${aiText.length} chars`);

    let analysisResult;
    try {
      let cleanedText = aiText.trim();
      cleanedText = cleanedText.replace(/```json\s*/gi, '');
      cleanedText = cleanedText.replace(/```\s*/gi, '');
      cleanedText = cleanedText.trim();
      
      const jsonMatch = cleanedText.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        cleanedText = jsonMatch[0];
      }

      analysisResult = JSON.parse(cleanedText);
      console.log(`✅ Successfully parsed JSON analysis`);
    } catch (parseErr) {
      console.error('⚠️ Failed to parse AI response as JSON');
      
      analysisResult = {
        errors: [],
        suggestions: [{
          line: 1,
          message: "AI analysis completed but response format was unclear",
          type: "info",
          priority: "low"
        }],
        codeMetrics: {
          complexity: "unknown",
          maintainability: "unknown",
          security: "unknown",
          performance: "unknown",
          testability: "unknown"
        },
        summary: {
          codeQuality: "unknown",
          strengths: [],
          weaknesses: ["Analysis format error"],
          overallAssessment: "Unable to parse analysis results"
        }
      };
    }

    const result = {
      errors: Array.isArray(analysisResult.errors) ? analysisResult.errors : [],
      suggestions: Array.isArray(analysisResult.suggestions) ? analysisResult.suggestions : [],
      codeMetrics: analysisResult.codeMetrics || {
        complexity: "medium",
        maintainability: "fair",
        security: "fair",
        performance: "fair",
        testability: "fair"
      },
      summary: {
        totalErrors: 0,
        criticalErrors: 0,
        highErrors: 0,
        mediumErrors: 0,
        lowErrors: 0,
        totalSuggestions: 0,
        codeQuality: analysisResult.summary?.codeQuality || "fair",
        strengths: analysisResult.summary?.strengths || [],
        weaknesses: analysisResult.summary?.weaknesses || [],
        overallAssessment: analysisResult.summary?.overallAssessment || "Code analysis completed",
        errorsByType: {
          syntax: 0,
          logical: 0,
          runtime: 0,
          security: 0,
          performance: 0,
          best_practices: 0
        },
        errorsByLevel: {
          architectural: 0,
          syntax: 0,
          logical: 0,
          performance: 0,
          security: 0
        }
      }
    };

    result.errors = result.errors.map(err => ({
      line: err.line || 1,
      message: err.message || 'Unknown error',
      severity: (err.severity || 'medium').toLowerCase(),
      type: err.type || 'best_practices',
      level: err.level || 'logical',
      suggestion: err.suggestion || 'Review this code section',
      code_snippet: err.code_snippet || ''
    }));

    result.suggestions = result.suggestions.map(sug => ({
      line: sug.line || 1,
      message: sug.message || 'Consider reviewing this section',
      type: sug.type || 'improvement',
      priority: sug.priority || 'medium',
      fix: sug.fix || ''
    }));

    result.summary.totalErrors = result.errors.length;
    result.summary.totalSuggestions = result.suggestions.length;

    result.errors.forEach(error => {
      const severity = error.severity.toLowerCase();
      switch (severity) {
        case 'critical': result.summary.criticalErrors++; break;
        case 'high': result.summary.highErrors++; break;
        case 'medium': result.summary.mediumErrors++; break;
        case 'low': result.summary.lowErrors++; break;
      }
      
      const type = error.type || 'best_practices';
      if (result.summary.errorsByType[type] !== undefined) {
        result.summary.errorsByType[type]++;
      }

      const level = error.level || 'logical';
      if (result.summary.errorsByLevel[level] !== undefined) {
        result.summary.errorsByLevel[level]++;
      }
    });

    console.log(`✅ Analysis complete:`);
    console.log(`   📊 Total Errors: ${result.summary.totalErrors}`);
    console.log(`   🔴 Critical: ${result.summary.criticalErrors}`);
    console.log(`   🟠 High: ${result.summary.highErrors}`);
    console.log(`   🟡 Medium: ${result.summary.mediumErrors}`);
    console.log(`   🟢 Low: ${result.summary.lowErrors}`);
    console.log(`${'='.repeat(70)}\n`);

    analysisCache.set(cacheKey, {
      timestamp: Date.now(),
      data: result
    });

    return result;

  } catch (error) {
    console.error(`\n❌ ANALYSIS FAILED:`);
    console.error(`   Error: ${error.message}`);
    console.error(`${'='.repeat(70)}\n`);
    throw error;
  }
}

// Parse GitHub URL
function parseGitHubUrl(url) {
  url = url.trim().replace(/\/$/, '').replace(/\.git$/, '');
  
  const patterns = [
    /github\.com\/([^\/]+)\/([^\/]+)/,
    /^([^\/]+)\/([^\/]+)$/
  ];
  
  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match) {
      return {
        owner: match[1],
        repo: match[2]
      };
    }
  }
  
  throw new Error('Invalid GitHub URL format');
}

// Generate recommendations
function generateRecommendations(metrics, stats) {
  const recommendations = [];
  
  const rules = [
    {
      condition: () => metrics.criticalErrors > 0,
      message: () => `🔴 ${metrics.criticalErrors} critical error${metrics.criticalErrors > 1 ? 's' : ''} require immediate attention`
    },
    {
      condition: () => metrics.errorsByType.security > 0,
      message: () => `🔒 ${metrics.errorsByType.security} security issue${metrics.errorsByType.security > 1 ? 's' : ''} detected`
    },
    {
      condition: () => stats.filesWithoutErrors === stats.analyzedFiles && stats.analyzedFiles > 0,
      message: () => `✅ Excellent! All ${stats.analyzedFiles} files are error-free`
    }
  ];
  
  rules.forEach(rule => {
    if (rule.condition()) {
      recommendations.push(rule.message());
    }
  });
  
  if (recommendations.length === 0) {
    recommendations.push(`📋 Analysis complete - review individual files`);
  }
  
  return recommendations;
}

// ============================================
// API ENDPOINTS
// ============================================

// Analyze single file
app.post("/analyze", async (req, res) => {
  const startTime = Date.now();
  
  try {
    const { code, filename = "unknown.js" } = req.body;
    
    if (!code || typeof code !== 'string' || code.trim().length === 0) {
      return res.status(400).json({ 
        error: "Invalid code",
        message: "Please provide valid code content"
      });
    }

    if (code.length > 500000) {
      return res.status(400).json({
        error: "File too large",
        message: "Maximum file size is 500KB"
      });
    }

    const results = await analyzeWithGroq(code, filename);
    
    results._metadata = {
      processingTime: Date.now() - startTime,
      timestamp: new Date().toISOString(),
      language: detectLanguage(filename),
      filename,
      linesOfCode: code.split('\n').length
    };
    
    res.json(results);
    
  } catch (error) {
    res.status(500).json({ 
      error: "Analysis failed",
      message: error.message
    });
  }
});

// Fetch repository structure
app.post("/fetch-repo-structure", async (req, res) => {
  try {
    const { repoUrl } = req.body;
    
    if (!repoUrl) {
      return res.status(400).json({ 
        error: "Missing repository URL"
      });
    }

    const { owner, repo } = parseGitHubUrl(repoUrl);
    const octokit = new Octokit();

    const { data: repoInfo } = await octokit.rest.repos.get({ owner, repo });
    const branch = repoInfo.default_branch;

    const { data: refData } = await octokit.rest.git.getRef({
      owner,
      repo,
      ref: `heads/${branch}`
    });
    
    const { data: treeData } = await octokit.rest.git.getTree({
      owner,
      repo,
      tree_sha: refData.object.sha,
      recursive: 'true'
    });

    const skipPaths = [
      'node_modules', 'dist', 'build', '.git', 'vendor', 'venv', 
      '__pycache__', '.next', 'coverage', 'target'
    ];

    const supportedFiles = [];
    
    for (const item of treeData.tree) {
      if (item.type !== 'blob') continue;
      
      const shouldSkip = skipPaths.some(skip => item.path.includes(skip));
      if (shouldSkip) continue;
      
      if (!isSupportedFile(item.path)) continue;
      
      if (item.size && item.size > 500000) continue;
      
      supportedFiles.push({
        path: item.path,
        sha: item.sha,
        size: item.size,
        language: detectLanguage(item.path)
      });
    }

    supportedFiles.sort((a, b) => a.path.localeCompare(b.path));

    res.json({
      repoInfo: {
        repository: `${owner}/${repo}`,
        branch,
        totalFiles: supportedFiles.length
      },
      files: supportedFiles
    });

  } catch (error) {
    res.status(500).json({
      error: "Failed to fetch repository structure",
      message: error.message
    });
  }
});

// Analyze selected files
app.post("/analyze-selected-files", async (req, res) => {
  const startTime = Date.now();
  
  try {
    const { repoUrl, filePaths } = req.body;
    
    if (!repoUrl || !filePaths || !Array.isArray(filePaths) || filePaths.length === 0) {
      return res.status(400).json({ 
        error: "Invalid request"
      });
    }

    if (filePaths.length > 20) {
      return res.status(400).json({ 
        error: "Maximum 20 files allowed"
      });
    }

    const { owner, repo } = parseGitHubUrl(repoUrl);
    const octokit = new Octokit();

    const { data: repoInfo } = await octokit.rest.repos.get({ owner, repo });
    const branch = repoInfo.default_branch;

    const stats = {
      analyzedFiles: 0,
      filesWithErrors: 0,
      filesWithoutErrors: 0,
      failedAnalysis: 0
    };

    const results = [];
    const failedFiles = [];

    for (const filePath of filePaths) {
      try {
        const { data: fileData } = await octokit.rest.repos.getContent({
          owner,
          repo,
          path: filePath,
          ref: branch
        });
        
        if (fileData.type !== 'file') continue;

        const content = Buffer.from(fileData.content, 'base64').toString('utf-8');
        
        if (content.length > 500000) {
          failedFiles.push({ path: filePath, error: 'File too large' });
          continue;
        }
        
        const analysis = await analyzeWithGroq(content, filePath);
        stats.analyzedFiles++;
        
        const hasErrors = analysis.errors && analysis.errors.length > 0;
        if (hasErrors) {
          stats.filesWithErrors++;
        } else {
          stats.filesWithoutErrors++;
        }
        
        results.push({
          filename: filePath,
          language: detectLanguage(filePath),
          linesOfCode: content.split('\n').length,
          fileSize: content.length,
          errors: analysis.errors || [],
          suggestions: analysis.suggestions || [],
          summary: analysis.summary,
          codeMetrics: analysis.codeMetrics,
          hasErrors,
          errorSummary: {
            total: analysis.errors.length,
            critical: analysis.summary.criticalErrors,
            high: analysis.summary.highErrors,
            medium: analysis.summary.mediumErrors,
            low: analysis.summary.lowErrors
          }
        });

        await new Promise(resolve => setTimeout(resolve, 200));
        
      } catch (error) {
        stats.failedAnalysis++;
        failedFiles.push({ path: filePath, error: error.message });
      }
    }

    const aggregateMetrics = {
      totalErrors: 0,
      criticalErrors: 0,
      highErrors: 0,
      mediumErrors: 0,
      lowErrors: 0,
      totalSuggestions: 0,
      errorsByType: {
        syntax: 0,
        logical: 0,
        runtime: 0,
        security: 0,
        performance: 0,
        best_practices: 0
      },
      errorsByLevel: {
        architectural: 0,
        syntax: 0,
        logical: 0,
        performance: 0,
        security: 0
      }
    };

    results.forEach(result => {
      aggregateMetrics.totalErrors += result.errors.length;
      aggregateMetrics.totalSuggestions += result.suggestions.length;
      
      result.errors.forEach(error => {
        const severity = error.severity?.toLowerCase() || 'medium';
        if (severity === 'critical') aggregateMetrics.criticalErrors++;
        else if (severity === 'high') aggregateMetrics.highErrors++;
        else if (severity === 'medium') aggregateMetrics.mediumErrors++;
        else if (severity === 'low') aggregateMetrics.lowErrors++;
        
        const type = error.type || 'best_practices';
        if (aggregateMetrics.errorsByType[type] !== undefined) {
          aggregateMetrics.errorsByType[type]++;
        }
        
        const level = error.level || 'logical';
        if (aggregateMetrics.errorsByLevel[level] !== undefined) {
          aggregateMetrics.errorsByLevel[level]++;
        }
      });
    });

    res.json({
      repository: `${owner}/${repo}`,
      branch,
      stats,
      aggregateMetrics,
      processingTime: Date.now() - startTime,
      results: results.filter(r => r.hasErrors),
      allResults: results,
      skippedFiles: { failed: failedFiles }
    });

  } catch (error) {
    res.status(500).json({
      error: "Analysis failed",
      message: error.message
    });
  }
});

// Save analysis to history
app.post("/save-analysis", async (req, res) => {
  try {
    const { 
      user_id, analysis_type, repository_name, file_count,
      total_errors, critical_errors, high_errors, 
      medium_errors, low_errors, analysis_data
    } = req.body;

    if (!user_id) {
      return res.status(400).json({
        success: false,
        error: 'Missing user_id'
      });
    }

    const { data, error } = await supabase
      .from('analysis_history')
      .insert([{
        user_id,
        analysis_type,
        repository_name: repository_name || null,
        file_count: file_count || 0,
        total_errors: total_errors || 0,
        critical_errors: critical_errors || 0,
        high_errors: high_errors || 0,
        medium_errors: medium_errors || 0,
        low_errors: low_errors || 0,
        analysis_data: analysis_data || {},
        created_at: new Date().toISOString()
      }])
      .select()
      .single();

    if (error) throw error;

    console.log('✅ Analysis saved:', data.id);
    res.json({ success: true, data });
  } catch (error) {
    console.error('❌ Error saving:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to save analysis',
      message: error.message
    });
  }
});

// Get user's own history
app.get("/my-history/:userId", async (req, res) => {
  try {
    const { userId } = req.params;

    const { data: history, error } = await supabase
      .from('analysis_history')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (error) throw error;

    res.json({
      success: true,
      history: history || [],
      totalAnalyses: history?.length || 0
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to fetch history',
      message: error.message
    });
  }
});

// Get all users (Admin)
app.get("/admin/users", async (req, res) => {
  try {
    const { data: users, error } = await supabase
      .from('profiles')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) throw error;

    res.json({
      success: true,
      users: users || []
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to fetch users',
      message: error.message
    });
  }
});

// Get user history (Admin)
app.get("/admin/user-history/:userId", async (req, res) => {
  try {
    const { userId } = req.params;

    const { data: history, error } = await supabase
      .from('analysis_history')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (error) throw error;

    res.json({
      success: true,
      history: history || []
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to fetch user history',
      message: error.message
    });
  }
});

// Health check
app.get("/health", (req, res) => {
  res.json({ 
    status: "healthy",
    service: "Code Review Bot API",
    groq_configured: !!process.env.GROQ_API_KEY,
    timestamp: new Date().toISOString(),
    version: "2.4.0"
  });
});

// Error handling
app.use((err, req, res, next) => {
  console.error('❌ Error:', err);
  res.status(500).json({
    error: 'Internal server error',
    message: err.message
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    error: 'Not found',
    message: `Endpoint ${req.method} ${req.path} not found`
  });
});

// Start server
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log('\n' + '█'.repeat(80));
  console.log('🚀  CODE REVIEW BOT - BACKEND v2.4');
  console.log('█'.repeat(80));
  console.log(`\n🌐  Server: http://localhost:${PORT}`);
  console.log(`🤖  Groq AI: ${process.env.GROQ_API_KEY ? '✅ CONFIGURED' : '❌ NOT FOUND'}`);
  console.log(`📅  Started: ${new Date().toLocaleString()}`);
  console.log('\n' + '█'.repeat(80) + '\n');
});