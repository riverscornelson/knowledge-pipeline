"""
Attribution UI components - Frontend JavaScript and CSS as Python strings.
Moved from root-level files for better organization.
"""

# JavaScript component as string
ATTRIBUTION_JAVASCRIPT = '''/**
 * Prompt Attribution Frontend Implementation
 * Handles interactive elements for the attribution system
 */

class PromptAttributionUI {
  constructor() {
    this.apiEndpoint = '/api/prompt-attribution';
    this.activeTooltips = new Map();
    this.feedbackModal = null;
    this.init();
  }

  init() {
    // Initialize event listeners
    this.attachEventListeners();
    this.createFeedbackModal();
    this.initializeTooltips();
  }

  attachEventListeners() {
    // Attach global event delegation
    document.addEventListener('click', (e) => {
      // View Prompt button
      if (e.target.matches('[data-action="view-prompt"]')) {
        this.viewPrompt(e.target.dataset.promptId);
      }
      
      // Rate Output button
      if (e.target.matches('[data-action="rate-output"]')) {
        this.showRatingModal(e.target.dataset.executionId);
      }
      
      // Suggest Improvement button
      if (e.target.matches('[data-action="suggest-improvement"]')) {
        this.showImprovementModal(e.target.dataset.promptId);
      }
      
      // View Alternatives button
      if (e.target.matches('[data-action="view-alternatives"]')) {
        this.showAlternatives(e.target.dataset.promptId, e.target.dataset.contentType);
      }
    });

    // Hover events for inline attributions
    document.addEventListener('mouseenter', (e) => {
      if (e.target.matches('.ai-generated-content')) {
        this.showAttributionTooltip(e.target);
      }
    }, true);

    document.addEventListener('mouseleave', (e) => {
      if (e.target.matches('.ai-generated-content')) {
        this.hideAttributionTooltip(e.target);
      }
    }, true);
  }

  /**
   * Create attribution header HTML
   */
  createAttributionHeader(execution, qualityScore = null) {
    const stars = this.generateStars(qualityScore);
    const timeAgo = this.formatTimeAgo(new Date(execution.timestamp));
    
    return `
      <div class="prompt-attribution" style="border-left-color: ${this.getAnalyzerColor(execution.analyzer_type)}">
        <div class="attribution-header">
          <span class="generated-by">
            ${this.getAnalyzerIcon(execution.analyzer_type)} Generated by: 
            <a href="#" data-action="view-prompt" data-prompt-id="${execution.prompt_id}">
              ${execution.prompt_name}
            </a>
          </span>
          <span class="version-badge">v${execution.prompt_version}</span>
          <span class="quality-score">${stars}</span>
          <span class="last-updated">Updated: ${timeAgo}</span>
        </div>
        <div class="attribution-metadata">
          Analyzer: ${execution.analyzer_type} | Temperature: ${execution.temperature} | 
          Web Search: ${execution.web_search_enabled ? '✅' : '❌'}
        </div>
        <div class="attribution-actions">
          <button data-action="view-prompt" data-prompt-id="${execution.prompt_id}">
            📋 View Prompt
          </button>
          <button data-action="rate-output" data-execution-id="${execution.execution_id}">
            ⭐ Rate Output
          </button>
          <button data-action="suggest-improvement" data-prompt-id="${execution.prompt_id}">
            💡 Suggest Improvement
          </button>
          <button data-action="view-alternatives" 
                  data-prompt-id="${execution.prompt_id}"
                  data-content-type="${execution.content_type}">
            🔄 Alternatives
          </button>
        </div>
      </div>
    `;
  }

  /**
   * Helper methods
   */
  getAnalyzerColor(analyzerType) {
    const colors = {
      'insights': '#8B5CF6',
      'summarizer': '#3B82F6',
      'classifier': '#10B981',
      'tagger': '#F59E0B',
      'technical': '#EF4444',
      'market': '#F97316',
      'legal': '#92400E'
    };
    return colors[analyzerType] || '#6B7280';
  }

  getAnalyzerIcon(analyzerType) {
    const icons = {
      'insights': '📊',
      'summarizer': '📝',
      'classifier': '🎯',
      'tagger': '🏷️',
      'technical': '🔧',
      'market': '📈',
      'legal': '⚖️'
    };
    return icons[analyzerType] || '🤖';
  }

  generateStars(rating) {
    if (!rating) return 'Not yet rated';
    
    const fullStars = Math.floor(rating);
    const hasHalfStar = rating % 1 >= 0.5;
    let stars = '⭐'.repeat(fullStars);
    if (hasHalfStar && fullStars < 5) stars += '⭐';
    
    return `${stars} (${rating.toFixed(1)}/5)`;
  }

  formatTimeAgo(date) {
    const now = new Date();
    const diff = now - date;
    
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);
    
    if (days > 0) return `${days} day${days > 1 ? 's' : ''} ago`;
    if (hours > 0) return `${hours} hour${hours > 1 ? 's' : ''} ago`;
    if (minutes > 0) return `${minutes} minute${minutes > 1 ? 's' : ''} ago`;
    return 'just now';
  }
}

// Initialize on DOM ready
document.addEventListener('DOMContentLoaded', () => {
  window.promptAttributionUI = new PromptAttributionUI();
});
'''

# CSS styles as string
ATTRIBUTION_CSS = '''/**
 * Prompt Attribution System Styles
 * Complete CSS for the attribution and traceability system
 */

/* ===== MAIN ATTRIBUTION COMPONENTS ===== */

.prompt-attribution {
  border-left: 4px solid var(--prompt-color, #6B7280);
  padding: 16px;
  margin: 16px 0;
  background: linear-gradient(135deg, rgba(255,255,255,0.8) 0%, rgba(248,250,252,0.9) 100%);
  border-radius: 0 8px 8px 0;
  box-shadow: 0 2px 8px rgba(0,0,0,0.1);
  transition: all 0.3s ease;
}

.prompt-attribution:hover {
  box-shadow: 0 4px 16px rgba(0,0,0,0.15);
  transform: translateY(-1px);
}

.attribution-header {
  display: flex;
  align-items: center;
  gap: 12px;
  flex-wrap: wrap;
  margin-bottom: 8px;
}

.generated-by {
  font-weight: 600;
  color: #374151;
}

.generated-by a {
  color: #3B82F6;
  text-decoration: none;
  border-bottom: 1px dotted #3B82F6;
  transition: all 0.2s ease;
}

.generated-by a:hover {
  color: #1D4ED8;
  border-bottom-style: solid;
}

.version-badge {
  background: linear-gradient(135deg, #F3F4F6 0%, #E5E7EB 100%);
  padding: 4px 8px;
  border-radius: 12px;
  font-size: 11px;
  font-weight: 600;
  color: #6B7280;
  border: 1px solid #D1D5DB;
}

.quality-score {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 14px;
}

.last-updated {
  color: #6B7280;
  font-size: 12px;
  opacity: 0.8;
}

.attribution-metadata {
  font-size: 12px;
  color: #6B7280;
  margin-bottom: 12px;
  padding: 8px 12px;
  background: rgba(249,250,251,0.8);
  border-radius: 6px;
  border: 1px solid rgba(229,231,235,0.5);
}

.attribution-actions {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}

.attribution-actions button {
  padding: 6px 12px;
  background: linear-gradient(135deg, #F9FAFB 0%, #F3F4F6 100%);
  border: 1px solid #E5E7EB;
  border-radius: 6px;
  cursor: pointer;
  font-size: 13px;
  font-weight: 500;
  color: #374151;
  transition: all 0.2s ease;
  position: relative;
  overflow: hidden;
}

.attribution-actions button:hover {
  background: linear-gradient(135deg, #F3F4F6 0%, #E5E7EB 100%);
  transform: translateY(-1px);
  box-shadow: 0 2px 8px rgba(0,0,0,0.1);
}

/* ===== ANALYZER TYPE COLORS ===== */

.prompt-attribution.insights { --prompt-color: #8B5CF6; }
.prompt-attribution.summarizer { --prompt-color: #3B82F6; }
.prompt-attribution.classifier { --prompt-color: #10B981; }
.prompt-attribution.tagger { --prompt-color: #F59E0B; }
.prompt-attribution.technical { --prompt-color: #EF4444; }
.prompt-attribution.market { --prompt-color: #F97316; }
.prompt-attribution.legal { --prompt-color: #92400E; }

/* ===== RESPONSIVE DESIGN ===== */

@media (max-width: 768px) {
  .prompt-attribution {
    padding: 12px;
    margin: 12px 0;
  }
  
  .attribution-header {
    flex-direction: column;
    align-items: flex-start;
    gap: 8px;
  }
  
  .attribution-actions {
    flex-wrap: wrap;
    gap: 6px;
  }
  
  .attribution-actions button {
    padding: 8px 12px;
    font-size: 12px;
  }
}
'''


def get_attribution_javascript() -> str:
    """Get the attribution JavaScript code."""
    return ATTRIBUTION_JAVASCRIPT


def get_attribution_css() -> str:
    """Get the attribution CSS code."""
    return ATTRIBUTION_CSS


def inject_attribution_ui(html_content: str) -> str:
    """Inject attribution UI components into HTML content."""
    css_tag = f"<style>{ATTRIBUTION_CSS}</style>"
    js_tag = f"<script>{ATTRIBUTION_JAVASCRIPT}</script>"
    
    # Insert before closing head tag if present, otherwise before body
    if "</head>" in html_content:
        html_content = html_content.replace("</head>", f"{css_tag}\n</head>")
    else:
        html_content = css_tag + "\n" + html_content
        
    # Insert before closing body tag if present, otherwise at end
    if "</body>" in html_content:
        html_content = html_content.replace("</body>", f"{js_tag}\n</body>")
    else:
        html_content = html_content + "\n" + js_tag
        
    return html_content