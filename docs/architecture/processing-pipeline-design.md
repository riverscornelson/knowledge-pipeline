# Processing Pipeline Design

## Overview

This document details the new streamlined processing pipeline that replaces the current 3-prompt chain with a single unified processor, achieving sub-30s processing times while maintaining 8.5+/10 quality scores.

## Current Pipeline Problems

### Performance Bottlenecks
```
Current Flow (95.5s total):
┌─ Summarizer (30s) ─┐
│ • Extract content  │ → ┌─ Insights (35s) ─┐ → ┌─ Fallback (30.5s) ─┐
│ • Generate summary │   │ • Analyze content │   │ • Basic processing │
│ • Format output    │   │ • Extract insights │   │ • Minimal quality  │
└────────────────────┘   │ • Web search      │   │ • Store results    │
                         └───────────────────┘   └────────────────────┘
```

### Key Issues
1. **Sequential Processing**: Each step waits for the previous to complete
2. **Redundant Analysis**: Content analyzed 3 times with overlap
3. **No Quality Gating**: Accepts poor outputs (6.0/10 average)
4. **Content Redundancy**: Stores raw content + Drive links
5. **Token Waste**: Multiple API calls with repeated context

## New Pipeline Architecture

### Unified Processing Flow
```
New Flow (< 30s total):
┌─ Content Strategy (2s) ─┐
│ • Determine source type │ → ┌─ Unified Processor (20s) ─┐ → ┌─ Quality Gate (3s) ─┐
│ • Extract metadata      │   │ • Single comprehensive   │   │ • Assess quality    │
│ • Sample content        │   │   analysis               │   │ • Pass/Fail decision│
└─────────────────────────┘   │ • Generate all outputs   │   └─────────────────────┘
                              └───────────────────────────┘           │
                                                                      ↓
                                                            ┌─ Store Results (2s) ─┐
                                                            │ • Format blocks       │
                                                            │ • Update database     │
                                                            │ • Log metrics         │
                                                            └───────────────────────┘
```

## Component Design

### 1. Content Strategy Engine

```python
class ContentStrategyEngine:
    """Determines optimal content handling strategy based on available sources."""

    def __init__(self):
        self.extraction_limits = {
            'drive_pdf': 2000,      # chars for analysis
            'article_web': 1500,    # chars for analysis
            'notion_content': None  # use all available
        }

    def determine_strategy(self, notion_page: Dict) -> ContentStrategy:
        """Analyze available sources and determine optimal strategy."""
        strategy = ContentStrategy()

        # Priority 1: Drive PDF links (preferred)
        if drive_url := self._extract_drive_url(notion_page):
            strategy.source_type = 'drive_pdf'
            strategy.source_url = drive_url
            strategy.content_sample_size = self.extraction_limits['drive_pdf']
            strategy.store_content = False  # Link-only strategy
            strategy.confidence = 0.9

        # Priority 2: Article URLs
        elif article_url := self._extract_article_url(notion_page):
            strategy.source_type = 'article_web'
            strategy.source_url = article_url
            strategy.content_sample_size = self.extraction_limits['article_web']
            strategy.store_content = False  # Link-only strategy
            strategy.confidence = 0.7

        # Fallback: Existing Notion content
        else:
            strategy.source_type = 'notion_content'
            strategy.source_url = None
            strategy.content_sample_size = None
            strategy.store_content = True   # Only fallback stores content
            strategy.confidence = 0.5

        return strategy

    async def extract_content_sample(self, strategy: ContentStrategy) -> ContentSample:
        """Extract optimized content sample based on strategy."""
        if strategy.source_type == 'drive_pdf':
            return await self._extract_pdf_sample(strategy)
        elif strategy.source_type == 'article_web':
            return await self._extract_web_sample(strategy)
        else:
            return await self._extract_notion_sample(strategy)

    async def _extract_pdf_sample(self, strategy: ContentStrategy) -> ContentSample:
        """Extract structured sample from PDF for optimal analysis."""
        # Extract first N characters + document structure
        file_id = self._extract_file_id(strategy.source_url)

        # Download and analyze structure
        pdf_content = await self.pdf_processor.download_file(file_id)
        full_text = await self.pdf_processor.extract_text(pdf_content)

        # Intelligent sampling: beginning + structure + key sections
        structure = self._analyze_document_structure(full_text)

        sample_parts = []

        # Always include beginning
        sample_parts.append(full_text[:500])

        # Include table of contents if available
        if structure.has_toc:
            sample_parts.append(structure.toc_text[:300])

        # Include executive summary if detected
        if structure.executive_summary:
            sample_parts.append(structure.executive_summary[:400])

        # Include key sections based on headings
        for section in structure.key_sections[:3]:
            sample_parts.append(section.text[:300])

        # Combine with separators
        sample_text = "\n\n---\n\n".join(sample_parts)

        # Truncate to limit if needed
        if len(sample_text) > strategy.content_sample_size:
            sample_text = sample_text[:strategy.content_sample_size] + "..."

        return ContentSample(
            text=sample_text,
            structure=structure,
            confidence=0.9,
            method='intelligent_sampling'
        )
```

### 2. Unified AI Processor

```python
class UnifiedAIProcessor:
    """Single-call processor that generates all required outputs."""

    def __init__(self, openai_client, quality_threshold=8.5):
        self.client = openai_client
        self.quality_threshold = quality_threshold
        self.unified_prompt = self._load_unified_prompt()

    async def process_comprehensive(
        self,
        content_sample: ContentSample,
        metadata: Dict
    ) -> ProcessingResult:
        """Comprehensive analysis in single API call."""

        # Prepare context
        context = self._build_context(content_sample, metadata)

        # Single API call with structured output
        response = await self.client.chat.completions.create(
            model="gpt-4o",  # Optimized for speed vs quality
            messages=[
                {"role": "system", "content": self.unified_prompt},
                {"role": "user", "content": context}
            ],
            temperature=0.3,
            max_tokens=2000,
            response_format={"type": "json_object"},  # Structured output
            timeout=25  # Hard limit for performance
        )

        # Parse structured response
        result_data = json.loads(response.choices[0].message.content)

        # Create comprehensive result
        result = ProcessingResult(
            executive_summary=result_data['executive_summary'],
            key_insights=result_data['key_insights'],
            action_items=result_data['action_items'],
            decision_points=result_data['decision_points'],
            content_classification=result_data['classification'],
            quality_indicators=result_data['quality_indicators'],
            processing_metadata={
                'model_used': 'gpt-4o',
                'tokens_used': response.usage.total_tokens,
                'processing_time': response.response_time,
                'api_calls': 1
            }
        )

        return result

    def _load_unified_prompt(self) -> str:
        """Load the optimized unified prompt template."""
        return """
You are an executive intelligence analyst. Transform the provided content into a decision-ready brief.

CRITICAL REQUIREMENTS:
- Generate EXACTLY 8-15 blocks (no more, no less)
- Every insight must be actionable within 30 days
- Executive must be able to make decisions in under 2 minutes
- Quality target: 8.5/10 minimum

OUTPUT STRUCTURE (JSON):
{
  "executive_summary": {
    "key_points": [3-4 bullet points maximum],
    "primary_decision": "What decision is needed?",
    "urgency_level": "low|medium|high|critical",
    "confidence_score": 0.0-1.0
  },
  "key_insights": [
    {
      "insight": "Specific insight text",
      "impact_level": "high|medium|low",
      "actionability": "immediate|short_term|long_term",
      "confidence": 0.0-1.0
    }
  ],
  "action_items": [
    {
      "action": "Specific action required",
      "timeframe": "1-7 days|1-4 weeks|1-3 months",
      "owner": "suggested role/department",
      "priority": "high|medium|low"
    }
  ],
  "decision_points": [
    {
      "decision": "Specific decision needed",
      "options": ["option1", "option2", "option3"],
      "recommendation": "preferred option with rationale",
      "deadline": "suggested timeframe"
    }
  ],
  "classification": {
    "content_type": "specific type from taxonomy",
    "ai_primitives": ["primitive1", "primitive2"],
    "vendor": "vendor name or null",
    "confidence": 0.0-1.0,
    "reasoning": "brief explanation"
  },
  "quality_indicators": {
    "conciseness_score": 0.0-1.0,
    "actionability_score": 0.0-1.0,
    "decision_focus_score": 0.0-1.0,
    "time_efficiency_score": 0.0-1.0,
    "overall_quality": 0.0-1.0
  }
}

QUALITY STANDARDS:
- Conciseness: Information density > 90%, no fluff
- Actionability: Every insight → specific action within 30 days
- Decision Focus: Clear decisions needed with timelines
- Time Efficiency: Executive can act within 2 minutes
- Relevance: 100% business-relevant content

CONTENT TO ANALYZE:
"""
```

### 3. Quality Gate System

```python
class QualityGateSystem:
    """Enforces quality standards with detailed assessment."""

    def __init__(self, threshold=8.5):
        self.threshold = threshold
        self.gates = [
            ConcisenesGate(weight=0.25),
            ActionabilityGate(weight=0.25),
            DecisionFocusGate(weight=0.20),
            TimeEfficiencyGate(weight=0.15),
            RelevanceGate(weight=0.15)
        ]

    def assess_quality(self, result: ProcessingResult) -> QualityAssessment:
        """Comprehensive quality assessment across all dimensions."""
        assessment = QualityAssessment()

        for gate in self.gates:
            gate_result = gate.evaluate(result)
            assessment.add_gate_result(gate, gate_result)

        # Calculate weighted overall score
        assessment.calculate_overall_score()

        # Determine pass/fail
        assessment.passed = assessment.overall_score >= self.threshold

        # Generate improvement suggestions if needed
        if not assessment.passed:
            assessment.generate_improvement_plan()

        return assessment

class ConcisenesGate(QualityGate):
    """Enforce executive-friendly conciseness."""

    def evaluate(self, result: ProcessingResult) -> GateResult:
        block_count = len(result.format_as_blocks())
        word_count = self._count_words(result)

        # Block count assessment (primary metric)
        if block_count <= 12:
            block_score = 1.0
        elif block_count <= 15:
            block_score = 0.8
        elif block_count <= 18:
            block_score = 0.6
        else:
            block_score = 0.2

        # Word density assessment (secondary metric)
        words_per_block = word_count / block_count if block_count > 0 else 0
        if words_per_block <= 50:  # Highly dense
            density_score = 1.0
        elif words_per_block <= 75:  # Good density
            density_score = 0.8
        elif words_per_block <= 100:  # Acceptable
            density_score = 0.6
        else:  # Too verbose
            density_score = 0.3

        # Combined score
        final_score = (block_score * 0.7) + (density_score * 0.3)

        return GateResult(
            gate_name="conciseness",
            score=final_score,
            passed=final_score >= 0.7,
            details={
                'block_count': block_count,
                'target_blocks': '8-15',
                'word_count': word_count,
                'words_per_block': words_per_block,
                'block_score': block_score,
                'density_score': density_score
            },
            suggestions=self._generate_conciseness_suggestions(block_count, density_score)
        )

    def _generate_conciseness_suggestions(self, block_count: int, density_score: float) -> List[str]:
        suggestions = []

        if block_count > 15:
            suggestions.append("Combine related insights into single blocks")
            suggestions.append("Remove redundant or low-value information")
            suggestions.append("Focus on decision-critical content only")

        if density_score < 0.6:
            suggestions.append("Increase information density per block")
            suggestions.append("Use bullet points instead of paragraphs")
            suggestions.append("Eliminate filler words and phrases")

        return suggestions

class ActionabilityGate(QualityGate):
    """Ensure content contains specific, executable actions."""

    ACTION_KEYWORDS = [
        'implement', 'deploy', 'approve', 'review', 'decide',
        'allocate', 'hire', 'purchase', 'negotiate', 'schedule',
        'prioritize', 'evaluate', 'assess', 'monitor', 'track'
    ]

    TIMEFRAME_KEYWORDS = {
        'immediate': ['immediately', 'asap', 'urgent', 'today', 'now'],
        'short_term': ['this week', 'next week', 'within days', '1-7 days'],
        'medium_term': ['this month', 'next month', 'within weeks', '1-4 weeks'],
        'long_term': ['this quarter', 'next quarter', 'within months']
    }

    def evaluate(self, result: ProcessingResult) -> GateResult:
        actions = result.action_items or []

        # Count specific actions
        specific_actions = 0
        timeframe_actions = 0
        assignable_actions = 0

        for action in actions:
            # Check for specific action verbs
            if any(keyword in action.get('action', '').lower() for keyword in self.ACTION_KEYWORDS):
                specific_actions += 1

            # Check for timeframes
            if action.get('timeframe') or self._has_timeframe_keywords(action.get('action', '')):
                timeframe_actions += 1

            # Check for assignability
            if action.get('owner') or self._has_role_assignment(action.get('action', '')):
                assignable_actions += 1

        # Calculate scores
        action_count_score = min(1.0, specific_actions / 3)  # Target: 3+ actions
        timeframe_score = (timeframe_actions / len(actions)) if actions else 0
        assignability_score = (assignable_actions / len(actions)) if actions else 0

        # Overall actionability score
        final_score = (action_count_score * 0.5) + (timeframe_score * 0.3) + (assignability_score * 0.2)

        return GateResult(
            gate_name="actionability",
            score=final_score,
            passed=final_score >= 0.7,
            details={
                'total_actions': len(actions),
                'specific_actions': specific_actions,
                'timeframe_actions': timeframe_actions,
                'assignable_actions': assignable_actions,
                'action_count_score': action_count_score,
                'timeframe_score': timeframe_score,
                'assignability_score': assignability_score
            },
            suggestions=self._generate_actionability_suggestions(specific_actions, timeframe_score, assignability_score)
        )
```

### 4. Performance Optimization Engine

```python
class PerformanceOptimizer:
    """Optimize processing pipeline for sub-30s performance."""

    def __init__(self):
        self.cache = TTLCache(maxsize=1000, ttl=3600)  # 1-hour content cache
        self.rate_limiter = AsyncRateLimiter(rate=10, period=1)  # 10/sec
        self.circuit_breaker = CircuitBreaker(failure_threshold=5, timeout=30)

    async def optimized_processing(self, content_ref: ContentReference) -> ProcessingResult:
        """Execute processing with all optimizations enabled."""

        # Performance tracking
        start_time = time.time()
        performance_log = PerformanceLog()

        try:
            # Stage 1: Smart caching check (0.1s)
            cache_key = self._generate_cache_key(content_ref)
            if cached_result := self.cache.get(cache_key):
                performance_log.add_stage('cache_hit', 0.1)
                return cached_result

            # Stage 2: Parallel content extraction (2-5s)
            extraction_start = time.time()

            tasks = [
                self._extract_content_sample(content_ref),
                self._extract_metadata(content_ref),
                self._check_duplicate_hash(content_ref)
            ]

            content_sample, metadata, is_duplicate = await asyncio.gather(*tasks)
            performance_log.add_stage('content_extraction', time.time() - extraction_start)

            if is_duplicate:
                return self._handle_duplicate(content_ref, performance_log)

            # Stage 3: AI processing with circuit breaker (15-20s)
            processing_start = time.time()

            async with self.circuit_breaker:
                async with self.rate_limiter:
                    result = await self.ai_processor.process_comprehensive(
                        content_sample, metadata
                    )

            performance_log.add_stage('ai_processing', time.time() - processing_start)

            # Stage 4: Quality assessment (1-3s)
            quality_start = time.time()
            quality_assessment = await self.quality_gate.assess_quality(result)
            performance_log.add_stage('quality_assessment', time.time() - quality_start)

            # Stage 5: Handle quality gate result
            if not quality_assessment.passed:
                return await self._handle_quality_failure(
                    content_sample, metadata, quality_assessment, performance_log
                )

            # Stage 6: Result formatting and caching (1s)
            format_start = time.time()

            final_result = self._finalize_result(result, quality_assessment, performance_log)

            # Cache successful high-quality results
            if final_result.quality_score >= 9.0:
                self.cache[cache_key] = final_result

            performance_log.add_stage('formatting', time.time() - format_start)
            performance_log.total_time = time.time() - start_time

            final_result.performance_log = performance_log

            return final_result

        except Exception as e:
            performance_log.add_error(str(e))
            performance_log.total_time = time.time() - start_time

            # Log performance metrics even for failures
            await self._log_performance_metrics(performance_log, success=False)

            raise ProcessingException(f"Processing failed: {e}") from e

    async def _handle_quality_failure(
        self,
        content_sample: ContentSample,
        metadata: Dict,
        quality_assessment: QualityAssessment,
        performance_log: PerformanceLog
    ) -> ProcessingResult:
        """Handle quality gate failure with retry logic."""

        retry_start = time.time()

        # Generate enhancement prompt based on specific failures
        enhancement_prompt = self._generate_enhancement_prompt(quality_assessment)

        # Single retry with enhanced prompt
        enhanced_result = await self.ai_processor.process_with_enhancement(
            content_sample, metadata, enhancement_prompt
        )

        # Re-assess quality
        retry_assessment = await self.quality_gate.assess_quality(enhanced_result)

        performance_log.add_stage('quality_retry', time.time() - retry_start)

        if retry_assessment.passed:
            return self._finalize_result(enhanced_result, retry_assessment, performance_log)
        else:
            # Fallback to basic processing
            return await self._fallback_processing(content_sample, metadata, performance_log)

    def _generate_enhancement_prompt(self, quality_assessment: QualityAssessment) -> str:
        """Generate targeted improvement prompt based on specific quality failures."""

        failed_gates = [gate for gate in quality_assessment.gate_results if not gate.passed]

        enhancement_instructions = []

        for gate in failed_gates:
            if gate.gate_name == 'conciseness':
                enhancement_instructions.append(
                    f"CRITICAL: Reduce to {gate.details.get('target_blocks', '8-15')} blocks maximum. "
                    f"Current: {gate.details.get('block_count')} blocks. "
                    "Combine related points and eliminate redundancy."
                )
            elif gate.gate_name == 'actionability':
                enhancement_instructions.append(
                    "CRITICAL: Add specific, executable actions with timeframes and ownership. "
                    f"Need {3 - gate.details.get('specific_actions', 0)} more actionable items."
                )
            elif gate.gate_name == 'decision_focus':
                enhancement_instructions.append(
                    "CRITICAL: Identify specific decisions needed and provide clear recommendations. "
                    "Executive must know exactly what to decide and when."
                )

        return f"""
QUALITY ENHANCEMENT REQUIRED:

{' '.join(enhancement_instructions)}

Re-process the content with these specific improvements:
1. Exact block count limit: 8-15 blocks
2. Every insight must have specific action within 30 days
3. Clear decision points with recommendations
4. Executive-ready format (2-minute reading time)

Maintain quality score ≥8.5/10.
"""
```

### 5. Results Storage Engine

```python
class ResultsStorageEngine:
    """Optimized storage with quality tracking and performance metrics."""

    def __init__(self, notion_client, db_client):
        self.notion = notion_client
        self.db = db_client

    async def store_processing_results(
        self,
        source_id: str,
        result: ProcessingResult,
        performance_log: PerformanceLog
    ) -> StorageResult:
        """Store results with comprehensive tracking."""

        storage_start = time.time()

        try:
            # Parallel storage operations
            tasks = [
                self._update_notion_page(source_id, result),
                self._update_database_record(source_id, result, performance_log),
                self._store_quality_metrics(source_id, result.quality_assessment),
                self._store_performance_analytics(source_id, performance_log)
            ]

            notion_result, db_result, quality_result, analytics_result = await asyncio.gather(*tasks)

            storage_time = time.time() - storage_start

            return StorageResult(
                success=True,
                storage_time=storage_time,
                notion_blocks_created=len(result.notion_blocks),
                database_updated=db_result.success,
                quality_tracked=quality_result.success,
                analytics_stored=analytics_result.success
            )

        except Exception as e:
            return StorageResult(
                success=False,
                error=str(e),
                storage_time=time.time() - storage_start
            )

    async def _update_notion_page(self, source_id: str, result: ProcessingResult) -> NotionResult:
        """Update Notion page with optimized block structure."""

        # Generate exactly 8-15 blocks as per quality requirements
        blocks = self._generate_notion_blocks(result)

        # Validate block count
        if not (8 <= len(blocks) <= 15):
            raise ValueError(f"Block count {len(blocks)} outside allowed range (8-15)")

        # Update page properties
        properties = {
            "Status": {"select": {"name": "Enriched"}},
            "Content-Type": {"select": {"name": result.content_classification.content_type}},
            "Quality Score": {"number": result.quality_score * 10},  # Convert to 0-100 scale
        }

        if result.content_classification.ai_primitives:
            properties["AI-Primitive"] = {
                "multi_select": [{"name": p} for p in result.content_classification.ai_primitives]
            }

        if result.content_classification.vendor:
            properties["Vendor"] = {"select": {"name": result.content_classification.vendor}}

        # Parallel updates
        await asyncio.gather(
            self.notion.client.pages.update(page_id=source_id, properties=properties),
            self.notion.add_content_blocks(source_id, blocks)
        )

        return NotionResult(success=True, blocks_added=len(blocks))

    def _generate_notion_blocks(self, result: ProcessingResult) -> List[Dict]:
        """Generate exactly 8-15 optimized Notion blocks."""

        blocks = []

        # Block 1: Executive Summary Header
        blocks.append({
            "type": "heading_2",
            "heading_2": {
                "rich_text": [{"type": "text", "text": {"content": f"📊 Executive Intelligence Brief"}}]
            }
        })

        # Block 2: Quality & Metrics Callout
        quality_indicator = "⭐" if result.quality_score >= 9.0 else "✅" if result.quality_score >= 8.5 else "⚠️"
        blocks.append({
            "type": "callout",
            "callout": {
                "rich_text": [{"type": "text", "text": {"content":
                    f"Quality Score: {result.quality_score:.1f}/10 {quality_indicator} | "
                    f"Processing: {result.performance_log.total_time:.1f}s | "
                    f"Blocks: {len(blocks)+13}"  # Predict final count
                }}],
                "icon": {"type": "emoji", "emoji": "📈"},
                "color": "blue_background"
            }
        })

        # Block 3: Executive Summary
        summary_text = "\n".join(f"• {point}" for point in result.executive_summary.key_points)
        blocks.append({
            "type": "toggle",
            "toggle": {
                "rich_text": [{"type": "text", "text": {"content": "📋 Executive Summary"}}],
                "children": [{
                    "type": "paragraph",
                    "paragraph": {
                        "rich_text": [{"type": "text", "text": {"content": summary_text}}]
                    }
                }]
            }
        })

        # Block 4: Primary Decision
        blocks.append({
            "type": "callout",
            "callout": {
                "rich_text": [{"type": "text", "text": {"content":
                    f"🎯 Primary Decision: {result.executive_summary.primary_decision}"
                }}],
                "icon": {"type": "emoji", "emoji": "🎯"},
                "color": "yellow_background"
            }
        })

        # Block 5: Action Items
        if result.action_items:
            action_children = []
            for action in result.action_items[:5]:  # Limit to 5 actions
                priority_emoji = {"high": "🔴", "medium": "🟡", "low": "🟢"}.get(action.get('priority', 'medium'), "⚪")
                action_text = f"{priority_emoji} {action['action']} ({action.get('timeframe', 'TBD')})"
                if action.get('owner'):
                    action_text += f" - {action['owner']}"

                action_children.append({
                    "type": "to_do",
                    "to_do": {
                        "rich_text": [{"type": "text", "text": {"content": action_text}}],
                        "checked": False
                    }
                })

            blocks.append({
                "type": "toggle",
                "toggle": {
                    "rich_text": [{"type": "text", "text": {"content": f"⚡ Action Items ({len(result.action_items)})"}}],
                    "children": action_children
                }
            })

        # Block 6: Key Insights
        if result.key_insights:
            insight_children = []
            for insight in result.key_insights[:4]:  # Limit to 4 insights
                impact_emoji = {"high": "🔥", "medium": "📈", "low": "💡"}.get(insight.get('impact_level', 'medium'), "💡")
                insight_text = f"{impact_emoji} {insight['insight']}"
                if insight.get('confidence'):
                    insight_text += f" (Confidence: {insight['confidence']:.0%})"

                insight_children.append({
                    "type": "bulleted_list_item",
                    "bulleted_list_item": {
                        "rich_text": [{"type": "text", "text": {"content": insight_text}}]
                    }
                })

            blocks.append({
                "type": "toggle",
                "toggle": {
                    "rich_text": [{"type": "text", "text": {"content": f"💡 Strategic Insights ({len(result.key_insights)})"}}],
                    "children": insight_children
                }
            })

        # Block 7: Decision Points (if any)
        if result.decision_points:
            decision_children = []
            for decision in result.decision_points[:3]:  # Limit to 3 decisions
                decision_text = f"**Decision**: {decision['decision']}\n"
                if decision.get('options'):
                    decision_text += f"**Options**: {', '.join(decision['options'])}\n"
                if decision.get('recommendation'):
                    decision_text += f"**Recommendation**: {decision['recommendation']}\n"
                if decision.get('deadline'):
                    decision_text += f"**Timeline**: {decision['deadline']}"

                decision_children.append({
                    "type": "paragraph",
                    "paragraph": {
                        "rich_text": [{"type": "text", "text": {"content": decision_text}}]
                    }
                })

            blocks.append({
                "type": "toggle",
                "toggle": {
                    "rich_text": [{"type": "text", "text": {"content": f"🤔 Decision Points ({len(result.decision_points)})"}}],
                    "children": decision_children
                }
            })

        # Block 8: Classification & Tags
        classification = result.content_classification
        class_text = f"**Type**: {classification.content_type}\n"
        if classification.ai_primitives:
            class_text += f"**AI Capabilities**: {', '.join(classification.ai_primitives)}\n"
        if classification.vendor:
            class_text += f"**Vendor**: {classification.vendor}\n"
        class_text += f"**Confidence**: {classification.confidence:.0%}"

        blocks.append({
            "type": "toggle",
            "toggle": {
                "rich_text": [{"type": "text", "text": {"content": "🎯 Classification"}}],
                "children": [{
                    "type": "paragraph",
                    "paragraph": {
                        "rich_text": [{"type": "text", "text": {"content": class_text}}]
                    }
                }]
            }
        })

        # Optional Block 9: Quality Breakdown (only if detailed metrics available)
        if hasattr(result, 'quality_assessment') and result.quality_assessment.gate_results:
            quality_text = ""
            for gate_result in result.quality_assessment.gate_results:
                status_emoji = "✅" if gate_result.passed else "❌"
                quality_text += f"{status_emoji} {gate_result.gate_name.title()}: {gate_result.score:.2f}\n"

            blocks.append({
                "type": "toggle",
                "toggle": {
                    "rich_text": [{"type": "text", "text": {"content": "📊 Quality Metrics"}}],
                    "children": [{
                        "type": "paragraph",
                        "paragraph": {
                            "rich_text": [{"type": "text", "text": {"content": quality_text}}]
                        }
                    }]
                }
            })

        # Ensure we're within the 8-15 block limit
        while len(blocks) > 15:
            # Remove optional blocks from the end
            blocks.pop()

        # Add final metadata block if we have room
        if len(blocks) < 15:
            metadata_text = f"Processed: {datetime.utcnow().strftime('%Y-%m-%d %H:%M UTC')}\n"
            metadata_text += f"Pipeline: v2.0 Unified\n"
            metadata_text += f"Model: {result.processing_metadata.get('model_used', 'gpt-4o')}\n"
            metadata_text += f"Tokens: {result.processing_metadata.get('tokens_used', 0):,}"

            blocks.append({
                "type": "toggle",
                "toggle": {
                    "rich_text": [{"type": "text", "text": {"content": "ℹ️ Processing Metadata"}}],
                    "children": [{
                        "type": "paragraph",
                        "paragraph": {
                            "rich_text": [{"type": "text", "text": {"content": metadata_text}}]
                        }
                    }]
                }
            })

        return blocks
```

## Performance Monitoring

### Real-Time Performance Tracking

```python
class PipelinePerformanceMonitor:
    """Monitor and optimize pipeline performance in real-time."""

    def __init__(self):
        self.metrics_collector = MetricsCollector()
        self.performance_targets = {
            'total_processing_time': 30,  # seconds
            'content_extraction_time': 5,   # seconds
            'ai_processing_time': 20,       # seconds
            'quality_assessment_time': 3,   # seconds
            'storage_time': 2,              # seconds
            'quality_score_minimum': 8.5,   # 0-10 scale
            'block_count_maximum': 15,      # blocks
            'success_rate_minimum': 0.95    # 95%
        }

    def track_processing_session(self, session: ProcessingSession):
        """Track comprehensive metrics for a processing session."""

        # Performance metrics
        self.metrics_collector.record_timing('total_processing', session.total_time)
        self.metrics_collector.record_timing('content_extraction', session.extraction_time)
        self.metrics_collector.record_timing('ai_processing', session.ai_processing_time)
        self.metrics_collector.record_timing('quality_assessment', session.quality_time)
        self.metrics_collector.record_timing('storage', session.storage_time)

        # Quality metrics
        self.metrics_collector.record_quality('quality_score', session.quality_score)
        self.metrics_collector.record_count('block_count', session.block_count)
        self.metrics_collector.record_boolean('success', session.success)
        self.metrics_collector.record_count('retry_count', session.retry_count)

        # Resource utilization
        self.metrics_collector.record_count('tokens_used', session.tokens_used)
        self.metrics_collector.record_cost('processing_cost', session.estimated_cost)
        self.metrics_collector.record_count('api_calls', session.api_calls)

        # Check for SLA violations
        self._check_sla_violations(session)

    def _check_sla_violations(self, session: ProcessingSession):
        """Check for performance SLA violations and alert if needed."""

        violations = []

        if session.total_time > self.performance_targets['total_processing_time']:
            violations.append(f"Processing time exceeded: {session.total_time}s > {self.performance_targets['total_processing_time']}s")

        if session.quality_score < self.performance_targets['quality_score_minimum']:
            violations.append(f"Quality score below minimum: {session.quality_score} < {self.performance_targets['quality_score_minimum']}")

        if session.block_count > self.performance_targets['block_count_maximum']:
            violations.append(f"Block count exceeded: {session.block_count} > {self.performance_targets['block_count_maximum']}")

        if violations:
            self._send_performance_alert(session.source_id, violations)

    def generate_performance_report(self, timeframe: str = '24h') -> PerformanceReport:
        """Generate comprehensive performance report."""

        metrics = self.metrics_collector.get_metrics(timeframe)

        return PerformanceReport(
            timeframe=timeframe,
            total_processed=metrics['total_sessions'],
            average_processing_time=metrics['avg_total_processing'],
            average_quality_score=metrics['avg_quality_score'],
            success_rate=metrics['success_rate'],
            sla_compliance_rate=metrics['sla_compliance_rate'],
            cost_analysis={
                'total_cost': metrics['total_cost'],
                'cost_per_document': metrics['avg_cost_per_document'],
                'token_efficiency': metrics['tokens_per_second']
            },
            performance_breakdown={
                'content_extraction': metrics['avg_content_extraction'],
                'ai_processing': metrics['avg_ai_processing'],
                'quality_assessment': metrics['avg_quality_assessment'],
                'storage': metrics['avg_storage']
            },
            quality_distribution={
                'excellent': metrics['quality_9_plus_count'],
                'good': metrics['quality_8_5_to_9_count'],
                'acceptable': metrics['quality_7_to_8_5_count'],
                'poor': metrics['quality_below_7_count']
            },
            recommendations=self._generate_optimization_recommendations(metrics)
        )

    def _generate_optimization_recommendations(self, metrics: Dict) -> List[str]:
        """Generate specific optimization recommendations based on metrics."""

        recommendations = []

        if metrics['avg_total_processing'] > 25:
            recommendations.append("Consider caching frequently accessed content")
            recommendations.append("Optimize AI prompt length to reduce token usage")

        if metrics['avg_quality_score'] < 8.7:
            recommendations.append("Review and enhance quality gate thresholds")
            recommendations.append("Analyze failed quality assessments for pattern improvements")

        if metrics['success_rate'] < 0.95:
            recommendations.append("Investigate error patterns and add more robust error handling")
            recommendations.append("Consider implementing more graceful fallback strategies")

        if metrics['avg_cost_per_document'] > 0.05:  # $0.05 target
            recommendations.append("Optimize prompt engineering to reduce token usage")
            recommendations.append("Implement more aggressive content sampling strategies")

        return recommendations
```

This processing pipeline design delivers the required performance improvements while maintaining high quality standards:

- **Processing Time**: 95.5s → <30s (68% improvement)
- **Quality Score**: 6.0/10 → 8.5+/10 (42% improvement)
- **Block Count**: 40+ → 8-15 blocks (62% reduction)
- **API Efficiency**: 3+ calls → 1 call (66% reduction)
- **Storage Optimization**: Eliminates redundant content storage

The unified architecture with quality gates ensures consistent, high-value outputs that enable executives to make informed decisions quickly.