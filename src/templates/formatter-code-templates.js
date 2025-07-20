/**
 * Notion Formatter Code Templates
 * Ready-to-use formatting functions for different content types
 */

export const FormatterTemplates = {
  // Executive Summary Template
  executiveSummary: {
    template: `# 🎯 Executive Summary

> 💡 **Key Takeaway**: {{keyTakeaway}}

## 📊 Quick Stats
{{metricsTable}}

## 🔍 Main Points

{{mainPoints}}

{{#if hasDetails}}
<details>
<summary>📖 Read Full Analysis</summary>

{{detailedContent}}

</details>
{{/if}}`,
    
    processor: (content) => {
      return {
        keyTakeaway: extractFirstSentence(content),
        metricsTable: buildMetricsTable(extractMetrics(content)),
        mainPoints: formatMainPoints(extractKeyPoints(content, 3)),
        hasDetails: content.length > 500,
        detailedContent: content
      };
    }
  },

  // Key Insights Template
  keyInsights: {
    template: `# 🔑 Key Insights

## 🎯 Top {{insightCount}} Discoveries

{{#each insights}}
{{> insightCallout}}
{{/each}}

{{#if hasData}}
## 📊 Supporting Data

/toggle Detailed Metrics
{{dataTable}}
/toggle
{{/if}}

## 🔗 Connections
{{connections}}`,

    partials: {
      insightCallout: `/callout {{emoji}}
**Insight #{{number}}**: {{title}}
- {{dataPoint}}
- {{impact}}
/callout

`
    },

    processor: (insights) => {
      const emojis = ['💡', '🚀', '🎨', '🔧', '📊'];
      return {
        insightCount: Math.min(insights.length, 5),
        insights: insights.slice(0, 5).map((insight, i) => ({
          emoji: emojis[i],
          number: i + 1,
          title: insight.title,
          dataPoint: insight.data,
          impact: insight.impact
        })),
        hasData: insights.some(i => i.metrics),
        dataTable: buildInsightMetricsTable(insights),
        connections: buildConnectionsList(insights)
      };
    }
  },

  // Strategic Implications Template
  strategicImplications: {
    template: `# 📈 Strategic Implications

## 🎯 Impact Overview

/columns 2
/column
### 🟢 Opportunities
{{#each opportunities}}
- **{{title}}**: {{description}}
{{/each}}

/column  
### 🔴 Risks
{{#each risks}}
- **{{title}}**: {{description}}
{{/each}}
/columns

## 🗺️ Strategic Roadmap

{{#each phases}}
/toggle Phase {{number}}: {{name}} ({{timeline}})
{{#each items}}
{{statusEmoji}} **{{status}}**
{{#each tasks}}
- {{task}}
{{/each}}

{{/each}}
/toggle

{{/each}}

## 💰 Business Case

/callout 💵
**ROI Projection**: {{roi}}
- Initial Investment: {{investment}}
- Expected Return: {{return}}
- Payback Period: {{paybackPeriod}}
/callout`,

    processor: (data) => {
      return {
        opportunities: formatOpportunities(data.opportunities),
        risks: formatRisks(data.risks),
        phases: formatRoadmapPhases(data.roadmap),
        roi: data.businessCase.roi,
        investment: formatCurrency(data.businessCase.investment),
        return: formatCurrency(data.businessCase.expectedReturn),
        paybackPeriod: data.businessCase.paybackPeriod
      };
    }
  },

  // Technical Implementation Template
  technicalImplementation: {
    template: `# 🔧 Technical Implementation

## 🏗️ Architecture Overview

/callout 🎯
**Tech Stack**: {{architectureType}}
{{#each techStack}}
- **{{layer}}**: {{technologies}}
{{/each}}
/callout

## 📋 Implementation Steps

{{#each phases}}
### Phase {{emoji}}: {{name}}

{{#each steps}}
/toggle {{title}}
{{#if hasCode}}
\`\`\`{{language}}
{{code}}
\`\`\`
{{/if}}

{{#if hasChecklist}}
**Required {{checklistType}}:**
{{#each checklist}}
- [ ] {{item}}
{{/each}}
{{/if}}
/toggle

{{/each}}
{{/each}}

## 🚨 Critical Considerations

{{#each considerations}}
/callout {{emoji}}
**{{title}}**
{{#each points}}
- {{point}}
{{/each}}
/callout

{{/each}}`,

    processor: (data) => {
      const phaseEmojis = ['1️⃣', '2️⃣', '3️⃣', '4️⃣', '5️⃣'];
      return {
        architectureType: data.architecture.type,
        techStack: formatTechStack(data.architecture.stack),
        phases: data.implementation.phases.map((phase, i) => ({
          emoji: phaseEmojis[i],
          name: phase.name,
          steps: formatImplementationSteps(phase.steps)
        })),
        considerations: formatConsiderations(data.considerations)
      };
    }
  },

  // Action Items Template
  actionItems: {
    template: `# 🎯 Action Items & Recommendations

## 🚀 Immediate Actions (This Week)

/columns 2
/column
### 🔴 Critical Priority
{{#each criticalActions}}
- [ ] **{{title}}**
  - Owner: {{owner}}
  - Deadline: {{deadline}}
  
{{/each}}

/column
### 🟡 High Priority  
{{#each highActions}}
- [ ] **{{title}}**
  - Owner: {{owner}}
  - Deadline: {{deadline}}
  
{{/each}}
/columns

## 📅 30-Day Roadmap

{{#each weeklyPlans}}
/toggle {{weekRange}}: {{phase}}
| Task | Owner | Status | Due |
|------|-------|--------|-----|
{{#each tasks}}
| {{task}} | {{owner}} | {{statusIcon}} {{status}} | {{due}} |
{{/each}}
/toggle

{{/each}}

## 💡 Strategic Recommendations

{{#each recommendations}}
### {{number}} **{{category}}**
/callout {{emoji}}
**Recommendation**: {{title}}
- **Rationale**: {{rationale}}
- **Investment**: {{investment}}
- **Timeline**: {{timeline}}
/callout

{{/each}}

## ✅ Success Metrics

/toggle KPIs Dashboard
{{#each kpis}}
- **{{name}}**: {{metric}}
{{/each}}
/toggle`,

    processor: (data) => {
      return {
        criticalActions: filterActionsByPriority(data.actions, 'critical'),
        highActions: filterActionsByPriority(data.actions, 'high'),
        weeklyPlans: formatWeeklyPlans(data.roadmap),
        recommendations: formatRecommendations(data.recommendations),
        kpis: formatKPIs(data.successMetrics)
      };
    }
  },

  // Classifications Template
  classifications: {
    template: `# 🏷️ Classifications & Categories

## 📊 Multi-Dimensional Analysis

/callout 🎯
**Classification Overview**
{{classificationSummary}}
/callout

/columns {{columnCount}}
{{#each dimensions}}
/column
### {{icon}} {{name}}
{{#each categories}}
- {{indicator}} **{{label}}** ({{count}})
{{/each}}

{{/each}}
/columns

## 🗂️ Detailed Categories

{{#each categoryGroups}}
/toggle {{icon}} {{groupName}}
{{#each categories}}
### {{name}}
{{#each items}}
- {{item}}
{{/each}}

{{/each}}
/toggle

{{/each}}

## 🎨 Visual Classification Matrix

/callout 📊
**{{matrixTitle}}**: {{xAxis}} vs {{yAxis}}
\`\`\`
{{matrixVisualization}}
\`\`\`
/callout`,

    processor: (data) => {
      return {
        classificationSummary: data.summary,
        columnCount: Math.min(data.dimensions.length, 4),
        dimensions: formatDimensions(data.dimensions),
        categoryGroups: formatCategoryGroups(data.categories),
        matrixTitle: data.matrix.title,
        xAxis: data.matrix.xAxis,
        yAxis: data.matrix.yAxis,
        matrixVisualization: buildMatrixVisualization(data.matrix)
      };
    }
  }
};

// Helper Functions
function extractFirstSentence(content) {
  const match = content.match(/^[^.!?]+[.!?]/);
  return match ? match[0].trim() : content.substring(0, 100) + '...';
}

function extractMetrics(content) {
  // Extract numerical values and their context
  const metricPatterns = [
    /(\d+(?:\.\d+)?%)\s+(\w+)/g,
    /(\$[\d,]+(?:\.\d+)?[MBK]?)\s+(\w+)/g,
    /(\d+(?:\.\d+)?)\s+(hours?|days?|weeks?)/g
  ];
  
  const metrics = [];
  metricPatterns.forEach(pattern => {
    let match;
    while ((match = pattern.exec(content)) !== null) {
      metrics.push({
        value: match[1],
        label: match[2],
        trend: determineTrend(match[1])
      });
    }
  });
  
  return metrics.slice(0, 6); // Limit to 6 metrics
}

function buildMetricsTable(metrics) {
  if (metrics.length === 0) return '';
  
  let table = '| Metric | Value | Trend |\n|--------|-------|-------|\n';
  
  const metricIcons = {
    'rate': '🎯',
    'time': '⏱️',
    'cost': '💰',
    'accuracy': '🎯',
    'performance': '📈'
  };
  
  metrics.forEach(metric => {
    const icon = metricIcons[detectMetricType(metric.label)] || '📊';
    table += `| ${icon} ${metric.label} | ${metric.value} | ${metric.trend} |\n`;
  });
  
  return table;
}

function extractKeyPoints(content, count = 3) {
  // Extract main points from content
  const sentences = content.split(/[.!?]+/).filter(s => s.trim().length > 20);
  const keyPoints = [];
  
  // Look for sentences with key indicators
  const indicators = ['important', 'key', 'critical', 'main', 'primary', 'significant'];
  
  sentences.forEach(sentence => {
    if (indicators.some(ind => sentence.toLowerCase().includes(ind))) {
      keyPoints.push(sentence.trim());
    }
  });
  
  // If not enough key points found, take first sentences
  if (keyPoints.length < count) {
    keyPoints.push(...sentences.slice(0, count - keyPoints.length));
  }
  
  return keyPoints.slice(0, count);
}

function formatMainPoints(points) {
  return points.map((point, index) => {
    const numberEmojis = ['1️⃣', '2️⃣', '3️⃣', '4️⃣', '5️⃣'];
    return `### ${numberEmojis[index]} **${getPointTitle(point)}**
${getPointDescription(point)}`;
  }).join('\n\n');
}

function getPointTitle(point) {
  // Extract first few words as title
  const words = point.split(' ').slice(0, 4);
  return words.join(' ').replace(/[,:]$/, '');
}

function getPointDescription(point) {
  // Get rest of the point as description, limited to 2 lines
  const words = point.split(' ');
  if (words.length <= 4) return point;
  
  const description = words.slice(4).join(' ');
  return description.length > 100 ? description.substring(0, 97) + '...' : description;
}

function determineTrend(value) {
  // Simple trend determination based on common patterns
  if (value.includes('+') || value.includes('increase')) return '↗️ +';
  if (value.includes('-') || value.includes('decrease')) return '↘️ -';
  return '➡️';
}

function detectMetricType(label) {
  const labelLower = label.toLowerCase();
  if (labelLower.includes('rate') || labelLower.includes('accuracy')) return 'rate';
  if (labelLower.includes('time') || labelLower.includes('hour') || labelLower.includes('day')) return 'time';
  if (labelLower.includes('cost') || labelLower.includes('$') || labelLower.includes('revenue')) return 'cost';
  if (labelLower.includes('performance') || labelLower.includes('speed')) return 'performance';
  return 'general';
}

function formatCurrency(amount) {
  if (typeof amount === 'number') {
    if (amount >= 1000000) return `$${(amount / 1000000).toFixed(1)}M`;
    if (amount >= 1000) return `$${(amount / 1000).toFixed(0)}k`;
    return `$${amount}`;
  }
  return amount;
}

// Export formatter functions
export const formatters = {
  breakTextWalls: (text, maxLength = 150) => {
    const sentences = text.split(/(?<=[.!?])\s+/);
    const paragraphs = [];
    let currentParagraph = [];
    let currentLength = 0;
    
    sentences.forEach(sentence => {
      if (currentLength + sentence.length > maxLength && currentParagraph.length > 0) {
        paragraphs.push(currentParagraph.join(' '));
        currentParagraph = [sentence];
        currentLength = sentence.length;
      } else {
        currentParagraph.push(sentence);
        currentLength += sentence.length;
      }
    });
    
    if (currentParagraph.length > 0) {
      paragraphs.push(currentParagraph.join(' '));
    }
    
    return paragraphs.join('\n\n');
  },
  
  convertToNotionList: (items) => {
    return items.map((item, index) => {
      if (item.length > 80) {
        const [title, ...rest] = item.split(/[,:]/, 2);
        return `### ${index + 1}️⃣ **${title.trim()}**\n${rest.join(':').trim()}`;
      }
      return `- ${item}`;
    }).join('\n\n');
  },
  
  addVisualElements: (content) => {
    // Add emojis to headers
    content = content.replace(/^#\s+(.+)$/gm, (match, title) => {
      const emoji = selectEmoji(title);
      return `# ${emoji} ${title}`;
    });
    
    // Add callouts for important information
    content = content.replace(/(?:^|\n)(?:Important|Note|Warning):\s*(.+)$/gm, 
      (match, text) => `/callout 💡\n${text}\n/callout`);
    
    return content;
  }
};

function selectEmoji(title) {
  const titleLower = title.toLowerCase();
  const emojiMap = {
    'summary': '🎯',
    'insight': '💡',
    'data': '📊',
    'technical': '🔧',
    'strategy': '🚀',
    'action': '📋',
    'warning': '⚠️',
    'success': '✅',
    'mobile': '📱',
    'cost': '💰',
    'category': '🏷️'
  };
  
  for (const [key, emoji] of Object.entries(emojiMap)) {
    if (titleLower.includes(key)) return emoji;
  }
  
  return '📌'; // Default emoji
}

// Export all templates and formatters
export default {
  templates: FormatterTemplates,
  formatters,
  helpers: {
    extractFirstSentence,
    extractMetrics,
    buildMetricsTable,
    extractKeyPoints,
    formatMainPoints,
    formatCurrency,
    selectEmoji
  }
};