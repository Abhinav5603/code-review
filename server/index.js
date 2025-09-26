import express from "express";
import cors from "cors";
import bodyParser from "body-parser";
import fetch from "node-fetch";
import dotenv from "dotenv";
import { Octokit } from "@octokit/rest";
import path from "path";
import crypto from "crypto";

dotenv.config();
const app = express();
app.use(cors());
app.use(bodyParser.json({ limit: '50mb' }));

// Enhanced cache with metadata
const analysisCache = new Map();
const CACHE_DURATION = 10 * 60 * 1000; // 10 minutes

// Language detection with enhanced mapping
function detectLanguage(filename) {
  const ext = path.extname(filename).toLowerCase();
  const langMap = {
    '.js': 'JavaScript',
    '.jsx': 'JavaScript/React',
    '.java': 'Java',
    '.cpp': 'C++',
    '.c': 'C',
    '.cs': 'C#',
    '.php': 'PHP',
    '.rb': 'Ruby',
    '.go': 'Go',
    '.rs': 'Rust',
    '.html': 'HTML',
    '.css': 'CSS',
    '.scss': 'SCSS',
    '.less': 'LESS',
    '.sql': 'SQL',
    '.json': 'JSON',
    '.sh': 'Shell',
    '.vue': 'Vue.js',
    '.swift': 'Swift',
    '.kt': 'Kotlin',
    '.dart': 'Dart',
    '.r': 'R',
    '.scala': 'Scala',
    '.pl': 'Perl',
    '.config.js': 'Configuration',
    'eslint.config.js': 'ESLint Config',
    'vite.config.js': 'Vite Config',
    'webpack.config.js': 'Webpack Config'
  };
  
  // Check for specific config files
  const basename = path.basename(filename);
  if (langMap[basename]) return langMap[basename];
  
  return langMap[ext] || 'Unknown';
}

// Get language-specific context and common patterns
function getLanguageContext(language, filename) {
  const contexts = {
    'JavaScript': {
      commonErrors: ['undefined variables', 'type coercion issues', 'async/await misuse', 'closure problems'],
      frameworks: ['React', 'Node.js', 'Express'],
      modernFeatures: ['ES6+ syntax', 'modules', 'destructuring', 'arrow functions']
    },
    'TypeScript': {
      commonErrors: ['type mismatches', 'interface violations', 'generic type issues', 'strict mode violations'],
      frameworks: ['React', 'Angular', 'Node.js'],
      modernFeatures: ['strict typing', 'decorators', 'enums', 'utility types']
    },
    'Java': {
      commonErrors: ['null pointer exceptions', 'type mismatches', 'static context issues', 'access modifiers'],
      frameworks: ['Spring', 'Hibernate', 'Maven'],
      modernFeatures: ['lambdas', 'streams', 'optional', 'modules']
    },
    'Python': {
      commonErrors: ['indentation errors', 'undefined variables', 'type errors', 'import issues'],
      frameworks: ['Django', 'Flask', 'FastAPI'],
      modernFeatures: ['type hints', 'async/await', 'dataclasses', 'f-strings']
    },
    'ESLint Config': {
      commonErrors: ['version compatibility', 'plugin conflicts', 'rule conflicts', 'parser issues'],
      frameworks: ['ESLint v8', 'ESLint v9', 'TypeScript-ESLint'],
      modernFeatures: ['flat config', 'extends vs plugins', 'overrides']
    }
  };
  
  return contexts[language] || contexts['JavaScript'];
}

// Enhanced prompt generation
function createAnalysisPrompt(code, filename, language, context) {
  const lineCount = code.split('\n').length;
  
  return `You are an expert code reviewer with deep knowledge of ${language} and modern development practices.

CRITICAL ANALYSIS INSTRUCTIONS:
1. This is ${language} code from "${filename}" (${code.length} chars, ${lineCount} lines)
2. Analyze ACTUAL CODE - not generic patterns
3. Be contextually aware of ${language} conventions and modern practices
4. Return ONLY valid JSON - no markdown, no extra text

LANGUAGE CONTEXT:
- Language: ${language}
- Common Issues: ${context.commonErrors.join(', ')}
- Frameworks/Tools: ${context.frameworks.join(', ')}
- Modern Features: ${context.modernFeatures.join(', ')}

SPECIFIC ANALYSIS REQUIREMENTS:
${getSpecificRequirements(language, filename)}

CODE TO ANALYZE:
\`\`\`${language.toLowerCase()}
${code}
\`\`\`

Return this EXACT JSON structure:
{
  "errors": [
    {
      "line": <number>,
      "column": <number>,
      "word": "<problematic_token>",
      "type": "<specific_error_type>",
      "level": "<architectural|syntax|logical|performance|security>",
      "message": "<detailed_description>",
      "severity": "<critical|high|medium|low>",
      "context": "<surrounding_code_context>"
    }
  ],
  "suggestions": [
    {
      "line": <number>,
      "type": "<improvement_type>",
      "level": "<architectural|syntax|logical|performance|security>",
      "message": "<detailed_suggestion>",
      "fix": "<specific_code_fix>",
      "reasoning": "<why_this_improvement>"
    }
  ],
  "codeMetrics": {
    "complexity": "<low|medium|high>",
    "maintainability": "<poor|fair|good|excellent>",
    "testability": "<poor|fair|good|excellent>",
    "performance": "<poor|fair|good|excellent>"
  },
  "summary": {
    "totalErrors": <number>,
    "criticalErrors": <number>,
    "warnings": <number>,
    "codeQuality": "<excellent|good|fair|poor>",
    "errorsByLevel": {
      "architectural": <number>,
      "syntax": <number>,
      "logical": <number>,
      "performance": <number>,
      "security": <number>
    },
    "confidence": "<high|medium|low>"
  }
}

ANALYSIS FOCUS AREAS:
- Syntax errors and typos
- Logic flaws and incorrect implementations
- Performance bottlenecks
- Security vulnerabilities
- Modern best practices violations
- Framework-specific issues
- Code organization and architecture
- Type safety (for typed languages)
- Error handling patterns
- Resource management`;
}

// Get specific requirements based on language/file type
function getSpecificRequirements(language, filename) {
  const requirements = {
    'JavaScript': 'Focus on: variable declarations, async/await usage, modern ES6+ features, React patterns if applicable',
    'TypeScript': 'Focus on: type annotations, interface compliance, generic usage, strict mode compatibility',
    'Java': 'Focus on: static/non-static context, access modifiers, exception handling, object-oriented principles',
    'Python': 'Focus on: indentation, variable scope, import statements, PEP 8 compliance',
    'ESLint Config': 'Focus on: ESLint version compatibility, plugin configurations, rule conflicts, flat vs legacy config',
    'CSS': 'Focus on: selector specificity, responsive design, modern CSS features, browser compatibility',
    'HTML': 'Focus on: semantic markup, accessibility, modern HTML5 features, validation'
  };
  
  return requirements[language] || 'Focus on: syntax correctness, logic flow, error handling, best practices';
}

// Generate cache key
function generateCacheKey(code, filename) {
  const content = `${filename}:${code}`;
  return crypto.createHash('sha256').update(content).digest('hex').substring(0, 16);
}

// Enhanced Gemini analysis with retry logic
async function analyzeWithGemini(code, filename, retryCount = 0) {
  const language = detectLanguage(filename);
  const context = getLanguageContext(language, filename);
  const cacheKey = generateCacheKey(code, filename);
  
  // Check cache
  const cached = analysisCache.get(cacheKey);
  if (cached && (Date.now() - cached.timestamp) < CACHE_DURATION) {
    console.log(`📋 Cache hit for ${filename}`);
    return cached.result;
  }

  const prompt = createAnalysisPrompt(code, filename, language, context);
  
  try {
    console.log(`🔍 Analyzing ${filename} with Gemini (attempt ${retryCount + 1})...`);
    
    const requestBody = {
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: {
        temperature: 0.2,           // Lower for more consistent analysis
        topK: 30,                  // Balanced diversity
        topP: 0.9,                 // Good response quality
        maxOutputTokens: 4000,     // Increased for detailed analysis
        candidateCount: 1          // Single response
      },
      safetySettings: [
        { category: "HARM_CATEGORY_HARASSMENT", threshold: "BLOCK_NONE" },
        { category: "HARM_CATEGORY_HATE_SPEECH", threshold: "BLOCK_NONE" },
        { category: "HARM_CATEGORY_SEXUALLY_EXPLICIT", threshold: "BLOCK_NONE" },
        { category: "HARM_CATEGORY_DANGEROUS_CONTENT", threshold: "BLOCK_NONE" }
      ]
    };

    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${process.env.GEMINI_API_KEY}`,
      {
        method: "POST",
        headers: { 
          "Content-Type": "application/json",
          "User-Agent": "CodeAnalyzer/1.0"
        },
        body: JSON.stringify(requestBody),
      }
    );
    
    if (!res.ok) {
      const errorData = await res.text();
      console.error(`❌ Gemini API error: ${res.status}`, errorData);
      
      // Retry logic for rate limits or temporary errors
      if ((res.status === 429 || res.status >= 500) && retryCount < 2) {
        const delay = Math.pow(2, retryCount) * 1000; // Exponential backoff
        console.log(`⏳ Retrying in ${delay}ms...`);
        await new Promise(resolve => setTimeout(resolve, delay));
        return analyzeWithGemini(code, filename, retryCount + 1);
      }
      
      throw new Error(`Gemini API error: ${res.status} - ${errorData}`);
    }
    
    const data = await res.json();
    const responseText = data?.candidates?.[0]?.content?.parts?.[0]?.text;
    
    if (!responseText) {
      throw new Error("Empty response from Gemini API");
    }

    // Enhanced response cleaning
    let cleanedText = responseText
      .replace(/```json\s*/gi, '')
      .replace(/```\s*/gi, '')
      .replace(/^[^{]*({.*})[^}]*$/s, '$1')  // Extract JSON object
      .trim();

    console.log(`📝 Response length: ${cleanedText.length} chars`);
    
    try {
      const parsedResult = JSON.parse(cleanedText);
      
      // Validate and enhance the result
      const validatedResult = validateAndEnhanceResult(parsedResult, code, filename, language);
      
      // Cache the result
      analysisCache.set(cacheKey, {
        result: validatedResult,
        timestamp: Date.now(),
        language,
        filename
      });
      
      console.log(`✅ Analysis complete for ${filename}: ${validatedResult.errors?.length || 0} errors, ${validatedResult.suggestions?.length || 0} suggestions`);
      
      return validatedResult;
      
    } catch (parseError) {
      console.error("❌ JSON parse error:", parseError.message);
      console.error("Raw response preview:", cleanedText.substring(0, 500) + "...");
      
      // Attempt to extract partial information
      return createFallbackResult(cleanedText, filename, language, parseError);
    }
    
  } catch (error) {
    console.error(`❌ Analysis failed for ${filename}:`, error.message);
    return createErrorResult(error, filename, language);
  }
}

// Validate and enhance analysis result
function validateAndEnhanceResult(result, code, filename, language) {
  const lines = code.split('\n');
  const enhanced = {
    errors: [],
    suggestions: [],
    codeMetrics: {
      complexity: "medium",
      maintainability: "fair", 
      testability: "fair",
      performance: "fair"
    },
    summary: {
      totalErrors: 0,
      criticalErrors: 0,
      warnings: 0,
      codeQuality: "fair",
      errorsByLevel: {
        architectural: 0,
        syntax: 0,
        logical: 0,
        performance: 0,
        security: 0
      },
      confidence: "medium"
    },
    ...result
  };

  // Validate errors
  if (result.errors && Array.isArray(result.errors)) {
    enhanced.errors = result.errors
      .filter(error => error.line > 0 && error.line <= lines.length)
      .map(error => ({
        ...error,
        column: error.column || 1,
        context: error.context || getLineContext(lines, error.line - 1)
      }));
  }

  // Validate suggestions
  if (result.suggestions && Array.isArray(result.suggestions)) {
    enhanced.suggestions = result.suggestions.map(suggestion => ({
      reasoning: "Improves code quality",
      ...suggestion
    }));
  }

  // Recalculate summary
  enhanced.summary.totalErrors = enhanced.errors.length;
  enhanced.summary.criticalErrors = enhanced.errors.filter(e => e.severity === 'critical').length;
  enhanced.summary.warnings = enhanced.suggestions.length;

  // Count by level
  enhanced.errors.forEach(error => {
    const level = error.level || 'logical';
    if (enhanced.summary.errorsByLevel[level] !== undefined) {
      enhanced.summary.errorsByLevel[level]++;
    }
  });

  return enhanced;
}

// Get context around a line of code
function getLineContext(lines, lineIndex) {
  if (lineIndex < 0 || lineIndex >= lines.length) return "";
  
  const start = Math.max(0, lineIndex - 1);
  const end = Math.min(lines.length, lineIndex + 2);
  
  return lines.slice(start, end)
    .map((line, idx) => `${start + idx + 1}: ${line}`)
    .join('\n');
}

// Create fallback result when JSON parsing fails
function createFallbackResult(rawResponse, filename, language, error) {
  return {
    errors: [{
      line: 1,
      column: 1,
      word: "response",
      type: "parse_error",
      level: "syntax",
      message: `Failed to parse AI analysis. This might indicate an issue with the AI response format. Error: ${error.message}`,
      severity: "medium",
      context: `Raw response preview: ${rawResponse.substring(0, 200)}...`
    }],
    suggestions: [{
      line: 1,
      type: "retry_analysis",
      level: "syntax", 
      message: "The code analysis could not be completed due to a parsing error. Try analyzing this file again.",
      fix: "Re-upload the file or check if the code contains unusual characters",
      reasoning: "Parser errors can be temporary or caused by edge cases in the code"
    }],
    codeMetrics: {
      complexity: "unknown",
      maintainability: "unknown",
      testability: "unknown", 
      performance: "unknown"
    },
    summary: {
      totalErrors: 1,
      criticalErrors: 0,
      warnings: 1,
      codeQuality: "unknown",
      errorsByLevel: { architectural: 0, syntax: 1, logical: 0, performance: 0, security: 0 },
      confidence: "low"
    }
  };
}

// Create error result for API failures
function createErrorResult(error, filename, language) {
  const isRateLimit = error.message.includes('429');
  const isQuotaExceeded = error.message.includes('quota') || error.message.includes('limit');
  
  return {
    errors: [{
      line: 1,
      column: 1,
      word: "api",
      type: isRateLimit ? "rate_limit" : isQuotaExceeded ? "quota_exceeded" : "api_error",
      level: "syntax",
      message: `Analysis failed: ${error.message}. ${isRateLimit ? 'Rate limit exceeded. Try again in a few minutes.' : 'Check your API configuration.'}`,
      severity: isRateLimit ? "medium" : "high",
      context: `File: ${filename}, Language: ${language}`
    }],
    suggestions: [{
      line: 1,
      type: "configuration_check",
      level: "syntax",
      message: isRateLimit ? "Wait before retrying" : "Verify API setup",
      fix: isRateLimit ? "Wait 1-2 minutes before analyzing more files" : "Check Gemini API key and quota limits",
      reasoning: "API errors prevent code analysis from completing"
    }],
    codeMetrics: {
      complexity: "unknown",
      maintainability: "unknown", 
      testability: "unknown",
      performance: "unknown"
    },
    summary: {
      totalErrors: 1,
      criticalErrors: isRateLimit ? 0 : 1,
      warnings: 1,
      codeQuality: "unknown",
      errorsByLevel: { architectural: 0, syntax: 1, logical: 0, performance: 0, security: 0 },
      confidence: "low"
    }
  };
}

// Clean cache periodically
setInterval(() => {
  const now = Date.now();
  let cleaned = 0;
  for (const [key, value] of analysisCache.entries()) {
    if (now - value.timestamp > CACHE_DURATION) {
      analysisCache.delete(key);
      cleaned++;
    }
  }
  if (cleaned > 0) {
    console.log(`🧹 Cleaned ${cleaned} expired cache entries`);
  }
}, 15 * 60 * 1000); // Clean every 15 minutes

// Enhanced analysis endpoint
app.post("/analyze", async (req, res) => {
  const startTime = Date.now();
  
  try {
    const { code, filename = "unknown.js" } = req.body;
    
    // Validation
    if (!code || code.trim().length === 0) {
      return res.status(400).json({ 
        error: "Empty code",
        message: "Please provide non-empty code content for analysis"
      });
    }

    if (code.length > 100000) {
      return res.status(400).json({
        error: "Code too large", 
        message: "Please provide code smaller than 100KB for analysis"
      });
    }

    const language = detectLanguage(filename);
    
    console.log(`\n🚀 ANALYSIS REQUEST`);
    console.log(`📁 File: ${filename}`);
    console.log(`🔤 Language: ${language}`);
    console.log(`📏 Size: ${code.length} chars, ${code.split('\n').length} lines`);
    console.log(`⏱️  Started: ${new Date().toLocaleTimeString()}`);
    
    const results = await analyzeWithGemini(code, filename);
    
    const duration = Date.now() - startTime;
    console.log(`\n✅ ANALYSIS COMPLETE`);
    console.log(`📁 File: ${filename}`);
    console.log(`⚠️  Errors: ${results.errors?.length || 0}`);
    console.log(`💡 Suggestions: ${results.suggestions?.length || 0}`);
    console.log(`🏆 Quality: ${results.summary?.codeQuality || 'unknown'}`);
    console.log(`⏱️  Duration: ${duration}ms`);
    console.log(`🎯 Confidence: ${results.summary?.confidence || 'medium'}`);
    
    // Add metadata to response
    results._metadata = {
      processingTime: duration,
      timestamp: new Date().toISOString(),
      language,
      filename,
      cacheHit: analysisCache.has(generateCacheKey(code, filename))
    };
    
    res.json(results);
    
  } catch (error) {
    const duration = Date.now() - startTime;
    console.error(`❌ Analysis error (${duration}ms):`, error.message);
    
    res.status(500).json({ 
      error: "Analysis failed",
      message: error.message,
      processingTime: duration
    });
  }
});

// GitHub Integration Routes (unchanged)
app.post("/github/connect", async (req, res) => {
  try {
    const { token } = req.body;
    
    if (!token) {
      return res.status(400).json({ error: "GitHub token is required" });
    }

    const octokit = new Octokit({ auth: token });
    
    const { data: user } = await octokit.rest.users.getAuthenticated();
    
    res.json({
      success: true,
      user: {
        login: user.login,
        name: user.name,
        avatar_url: user.avatar_url
      }
    });
  } catch (error) {
    console.error("GitHub connection error:", error);
    res.status(401).json({ 
      error: "Invalid GitHub token or API error",
      message: error.message 
    });
  }
});

app.get("/github/repos", async (req, res) => {
  try {
    const { token } = req.query;
    
    if (!token) {
      return res.status(400).json({ error: "GitHub token is required" });
    }

    const octokit = new Octokit({ auth: token });
    
    const { data: repos } = await octokit.rest.repos.listForAuthenticatedUser({
      sort: 'updated',
      per_page: 20
    });

    const formattedRepos = repos.map(repo => ({
      name: repo.name,
      full_name: repo.full_name,
      private: repo.private,
      updated_at: repo.updated_at,
      language: repo.language,
      default_branch: repo.default_branch
    }));

    res.json(formattedRepos);
  } catch (error) {
    console.error("GitHub repos error:", error);
    res.status(500).json({ 
      error: "Failed to fetch repositories",
      message: error.message 
    });
  }
});

app.get("/github/files", async (req, res) => {
  try {
    const { token, owner, repo, path: filePath = '' } = req.query;
    
    if (!token || !owner || !repo) {
      return res.status(400).json({ error: "Missing required parameters" });
    }

    const octokit = new Octokit({ auth: token });
    
    const { data: contents } = await octokit.rest.repos.getContent({
      owner,
      repo,
      path: filePath
    });

    const supportedExtensions = ['.js', '.jsx', '.ts', '.tsx', '.py', '.java', '.cpp', '.c', '.cs', '.php', '.rb', '.go', '.rs', '.html', '.css', '.vue', '.swift', '.kt', '.dart', '.r', '.scala', '.pl'];
    
    const files = (Array.isArray(contents) ? contents : [contents])
      .filter(item => {
        if (item.type === 'file') {
          const ext = path.extname(item.name).toLowerCase();
          return supportedExtensions.includes(ext);
        }
        return item.type === 'dir';
      })
      .map(item => ({
        name: item.name,
        path: item.path,
        type: item.type,
        size: item.size,
        download_url: item.download_url
      }));

    res.json(files);
  } catch (error) {
    console.error("GitHub files error:", error);
    res.status(500).json({ 
      error: "Failed to fetch repository files",
      message: error.message 
    });
  }
});

app.get("/github/file-content", async (req, res) => {
  try {
    const { token, owner, repo, path: filePath } = req.query;
    
    if (!token || !owner || !repo || !filePath) {
      return res.status(400).json({ error: "Missing required parameters" });
    }

    const octokit = new Octokit({ auth: token });
    
    const { data: fileData } = await octokit.rest.repos.getContent({
      owner,
      repo,
      path: filePath
    });

    if (fileData.type !== 'file') {
      return res.status(400).json({ error: "Path is not a file" });
    }

    const content = Buffer.from(fileData.content, 'base64').toString('utf-8');
    
    res.json({
      name: fileData.name,
      path: fileData.path,
      content: content,
      size: fileData.size
    });
  } catch (error) {
    console.error("GitHub file content error:", error);
    res.status(500).json({ 
      error: "Failed to fetch file content",
      message: error.message 
    });
  }
});

// Enhanced health check
app.get("/health", (req, res) => {
  res.json({ 
    status: "OK", 
    timestamp: new Date().toISOString(),
    gemini_key_configured: !!process.env.GEMINI_API_KEY,
    cache_size: analysisCache.size,
    cache_keys_sample: Array.from(analysisCache.keys()).slice(0, 5),
    memory_usage: process.memoryUsage(),
    uptime_seconds: process.uptime()
  });
});

// Analytics endpoint
app.get("/analytics", (req, res) => {
  const cacheEntries = Array.from(analysisCache.values());
  const languageStats = {};
  
  cacheEntries.forEach(entry => {
    const lang = entry.language || 'unknown';
    languageStats[lang] = (languageStats[lang] || 0) + 1;
  });
  
  res.json({
    total_analyses: cacheEntries.length,
    languages_analyzed: languageStats,
    cache_hit_rate: "Not implemented yet",
    average_errors_per_file: cacheEntries.length > 0 
      ? cacheEntries.reduce((sum, entry) => sum + (entry.result.errors?.length || 0), 0) / cacheEntries.length 
      : 0
  });
});

// Cache management endpoints
app.get("/cache/status", (req, res) => {
  const entries = Array.from(analysisCache.entries()).map(([key, value]) => ({
    key: key.substring(0, 8) + '...',
    filename: value.filename,
    language: value.language,
    age_minutes: Math.round((Date.now() - value.timestamp) / 60000),
    errors: value.result.errors?.length || 0
  }));

  res.json({
    size: analysisCache.size,
    entries: entries.slice(0, 20), // Show latest 20
    total_memory_kb: Math.round(JSON.stringify(Array.from(analysisCache.values())).length / 1024)
  });
});

app.post("/cache/clear", (req, res) => {
  const oldSize = analysisCache.size;
  analysisCache.clear();
  console.log(`🧹 Cache manually cleared: ${oldSize} entries removed`);
  
  res.json({ 
    message: "Cache cleared successfully",
    entries_removed: oldSize,
    timestamp: new Date().toISOString()
  });
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`\n🚀 Code Analysis Server Started`);
  console.log(`📍 URL: http://localhost:${PORT}`);
  console.log(`🔑 Gemini API: ${process.env.GEMINI_API_KEY ? '✅ Configured' : '❌ Missing'}`);
  console.log(`💾 Cache: ✅ Initialized`);
  console.log(`⏰ Time: ${new Date().toLocaleString()}`);
  console.log(`\nEndpoints:`);
  console.log(`  POST /analyze - Code analysis`);
  console.log(`  GET  /health - System status`);
  console.log(`  GET  /analytics - Usage statistics`);
  console.log(`  GET  /cache/status - Cache information`);
  console.log(`\n🎯 Ready for enhanced code analysis!\n`);
});