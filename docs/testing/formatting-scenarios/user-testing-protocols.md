# User Testing Protocols for AI Content Formatting

## Executive Summary
This document provides detailed protocols for testing the effectiveness of new AI-generated content formatting with real users. Each protocol is designed to measure specific aspects of the user experience and validate that our formatting improvements solve the identified pain points.

## Testing Overview

### User Segments
1. **Executives** - C-level, VPs needing quick insights
2. **Analysts** - Researchers requiring detailed information
3. **Product Managers** - Action-oriented, implementation focused
4. **Mobile Users** - Primarily phone/tablet readers
5. **International Users** - Non-native English speakers

### Testing Phases
- **Phase 1**: Lab Testing (Controlled environment)
- **Phase 2**: Beta Testing (Real workflows)
- **Phase 3**: Production Validation (Full rollout)

## Protocol 1: Time-to-Insight Testing

### Objective
Measure how quickly users can extract key information from formatted vs unformatted content.

### Setup
```
Participants: 20 users (4 from each segment)
Duration: 30 minutes per session
Environment: Recorded screen + eye tracking
Materials: 10 document pairs (before/after formatting)
```

### Test Tasks

#### Task 1: Executive Summary Extraction
**Instructions**: "Find the main business impact mentioned in this document"

**Measurement**:
- Time to first fixation on key insight
- Time to verbal confirmation
- Accuracy of identified insight
- Confidence rating (1-5)

**Success Criteria**:
- Before: 45-60 seconds average
- After: <10 seconds average
- Accuracy: >95%

#### Task 2: Specific Metric Location
**Instructions**: "What is the cost savings percentage mentioned?"

**Measurement**:
- Number of scroll actions
- Time to locate
- Reading pattern (eye tracking)

**Success Criteria**:
- Before: 30-45 seconds
- After: <5 seconds
- Scroll actions: <3

#### Task 3: Action Item Identification
**Instructions**: "List the top 3 recommended actions"

**Measurement**:
- Completeness of list
- Time to compile
- Missed items

**Success Criteria**:
- Before: 60% accuracy
- After: 95% accuracy
- Time reduction: 70%

### Data Collection Template
```csv
user_id,segment,task,version,time_seconds,accuracy,confidence,scroll_count,errors
U001,Executive,Summary,Before,52,0.8,3,12,missed_key_point
U001,Executive,Summary,After,8,1.0,5,1,none
```

## Protocol 2: Mobile Usability Testing

### Objective
Validate that formatting improvements work effectively on mobile devices.

### Setup
```
Participants: 15 mobile-primary users
Devices: Mix of phones (70%) and tablets (30%)
Duration: 20 minutes per session
Environment: Natural setting (commute simulation)
```

### Test Scenarios

#### Scenario 1: Quick Reference
**Context**: "You're in a meeting and need to quickly find a specific number"

**Tasks**:
1. Open document on phone
2. Find revenue projection
3. Share with colleague

**Measurements**:
- Task completion time
- Zoom/pinch actions
- Horizontal scroll occurrences
- Error taps

**Success Criteria**:
- No horizontal scrolling
- <3 taps to information
- No zoom required
- 90% task success

#### Scenario 2: Detailed Reading
**Context**: "Reading during commute, intermittent attention"

**Tasks**:
1. Read executive summary
2. Expand one detailed section
3. Return to summary
4. Extract key takeaway

**Measurements**:
- Reading completion
- Navigation patterns
- Interaction with expandables
- Retention test

**Success Criteria**:
- 85% completion rate
- Smooth expand/collapse
- Clear navigation path
- 70% retention

### Mobile-Specific Metrics
| Metric | Target | Measurement |
|--------|--------|-------------|
| Touch target size | ≥44px | Automated testing |
| Text size | ≥16px | Visual inspection |
| Line length | ≤65 chars | Character count |
| Contrast ratio | ≥4.5:1 | Accessibility tool |

## Protocol 3: A/B Format Preference Testing

### Objective
Determine user preference between current and new formatting approaches.

### Setup
```
Participants: 50 users (balanced across segments)
Method: Within-subjects design
Duration: 45 minutes
Randomization: Counterbalanced presentation
```

### Test Design

#### Document Pairs
Each user reviews 5 document pairs:
1. Research paper (technical)
2. Vendor announcement (product)
3. Market news (business)
4. Strategy document (thought leadership)
5. Internal report (mixed)

#### Presentation Method
```python
def present_documents(user, doc_pairs):
    for doc in doc_pairs:
        # Randomize which version shown first
        if random.random() > 0.5:
            show_version('current', doc)
            show_version('new', doc)
        else:
            show_version('new', doc)
            show_version('current', doc)
        
        collect_preference(user, doc)
        collect_reasoning(user, doc)
```

### Preference Metrics

#### Forced Choice
"Which version would you prefer to receive in your daily workflow?"
- [ ] Version A (Current)
- [ ] Version B (New)

#### Preference Strength
"How strong is your preference?"
- [ ] Slight preference
- [ ] Moderate preference
- [ ] Strong preference

#### Reasoning Categories
"Why do you prefer this version?" (Select all)
- [ ] Easier to scan
- [ ] Better visual hierarchy
- [ ] More professional
- [ ] Clearer information
- [ ] Better mobile experience
- [ ] More actionable
- [ ] Other: ___________

### Analysis Framework
```sql
-- Preference analysis query
SELECT 
    segment,
    document_type,
    COUNT(CASE WHEN preference = 'new' THEN 1 END) as prefer_new,
    COUNT(CASE WHEN preference = 'current' THEN 1 END) as prefer_current,
    AVG(CASE WHEN preference = 'new' THEN strength ELSE 0 END) as new_strength,
    COUNT(CASE WHEN preference = 'new' AND strength = 3 THEN 1 END) as strong_new
FROM preferences
GROUP BY segment, document_type;
```

## Protocol 4: Cognitive Load Assessment

### Objective
Measure mental effort required to process information.

### Setup
```
Participants: 30 users
Method: NASA Task Load Index (TLX)
Duration: 60 minutes
Measurement: After each document review
```

### NASA-TLX Dimensions

#### Rating Scales (0-100)
1. **Mental Demand**: How mentally demanding was the task?
2. **Physical Demand**: How physically demanding was the task?
3. **Temporal Demand**: How hurried or rushed was the pace?
4. **Performance**: How successful were you in accomplishing what you were asked to do?
5. **Effort**: How hard did you have to work to accomplish your level of performance?
6. **Frustration**: How insecure, discouraged, irritated, stressed, and annoyed were you?

### Cognitive Load Test Protocol

#### Pre-Test Baseline
1. Simple reading task (control)
2. Establish individual baseline TLX

#### Main Test
1. Present document (current format)
2. Ask comprehension questions
3. Administer NASA-TLX
4. 5-minute break
5. Present similar document (new format)
6. Ask equivalent questions
7. Administer NASA-TLX

#### Target Outcomes
| Dimension | Current | Target | Reduction |
|-----------|---------|--------|-----------|
| Mental Demand | 72 | 43 | -40% |
| Temporal Demand | 68 | 35 | -49% |
| Effort | 75 | 45 | -40% |
| Frustration | 61 | 25 | -59% |

## Protocol 5: Information Retention Study

### Objective
Measure how well users retain information from different formats.

### Setup
```
Participants: 40 users
Design: Between-subjects
Timeline: Initial + 24hr + 1 week
Incentive: Completion bonus for all phases
```

### Retention Test Design

#### Phase 1: Initial Reading (Day 0)
1. Random assignment to format (current/new)
2. 15-minute reading period
3. Immediate recall test (10 questions)
4. Confidence ratings

#### Phase 2: Short-term Retention (Day 1)
1. No document access
2. Same 10 questions
3. Additional application questions
4. Self-reported confidence

#### Phase 3: Long-term Retention (Day 7)
1. No document access
2. Core 5 questions
3. Concept application test
4. Format preference survey

### Question Types

#### Factual Recall
"What was the percentage improvement mentioned?"
- Tests: Specific number retention
- Scoring: Exact or within 5%

#### Conceptual Understanding
"Explain the main strategic advantage"
- Tests: Concept comprehension
- Scoring: Rubric-based (0-3 points)

#### Application
"How would you apply this to your work?"
- Tests: Practical understanding
- Scoring: Relevance + accuracy

### Retention Scoring Matrix
```python
retention_score = {
    'immediate': {
        'factual': score_1a,
        'conceptual': score_1b,
        'application': score_1c
    },
    '24_hour': {
        'factual': score_2a,
        'conceptual': score_2b,
        'application': score_2c
    },
    '1_week': {
        'factual': score_3a,
        'conceptual': score_3b,
        'application': score_3c
    }
}

# Calculate decay curves
decay_rate = (score_3 - score_1) / score_1
```

## Protocol 6: Real-World Workflow Integration

### Objective
Validate formatting effectiveness in actual work contexts.

### Setup
```
Participants: 25 power users
Duration: 2 weeks
Method: Diary study + analytics
Environment: Production with toggle
```

### Workflow Integration Tasks

#### Daily Logging
Participants log each interaction:
```json
{
  "timestamp": "2024-01-15T09:30:00Z",
  "document_id": "doc_123",
  "format_version": "new",
  "task_context": "morning review",
  "time_spent": 180,
  "actions_taken": ["shared", "extracted_data"],
  "satisfaction": 4,
  "notes": "Much easier to find key metrics"
}
```

#### Weekly Surveys
1. Overall format preference
2. Specific pain points encountered
3. Productivity self-assessment
4. Feature requests
5. Would recommend? (NPS)

#### Analytics Tracking
- Time on page comparison
- Scroll depth analysis
- Export/share frequency
- Return visit patterns
- Section engagement

### Success Metrics
| Metric | Week 1 Target | Week 2 Target |
|--------|---------------|---------------|
| Format preference | 60% new | 75% new |
| Time savings | 30% | 40% |
| NPS Score | +20 | +30 |
| Daily active use | 70% | 85% |

## Testing Tools & Resources

### Required Tools
1. **Eye Tracking**: Tobii Pro or equivalent
2. **Screen Recording**: Lookback.io or UserTesting
3. **Survey Platform**: Typeform or Qualtrics
4. **Analytics**: Mixpanel or Amplitude
5. **Heat Mapping**: Hotjar or FullStory

### Testing Scripts
```javascript
// Automated formatting validation
function validateFormatting(document) {
    const checks = {
        hasVisualHierarchy: checkHeadingStructure(document),
        hasDataTables: checkTablePresence(document),
        hasCalloutBlocks: checkCallouts(document),
        hasProgressiveDisclosure: checkCollapsibles(document),
        paragraphLength: checkParagraphSize(document),
        mobileOptimized: checkMobileLayout(document)
    };
    
    return {
        score: calculateScore(checks),
        failures: getFailures(checks),
        suggestions: generateSuggestions(checks)
    };
}
```

### Participant Recruitment

#### Screening Criteria
- Regular document consumers (daily)
- Mix of technical levels
- Device diversity (desktop/mobile)
- Geographic distribution
- Accessibility needs representation

#### Compensation
- Lab testing: $50/hour
- Diary study: $200/week
- Quick surveys: $10-20
- Full retention study: $150

## Results Analysis & Reporting

### Statistical Analysis Plan
```r
# Compare format effectiveness
t.test(time_new, time_current, paired = TRUE)

# Preference analysis
chisq.test(preference_table)

# Retention over time
retention_model <- lm(score ~ format * time, data = retention_data)

# Cognitive load reduction
wilcox.test(tlx_new, tlx_current, paired = TRUE)
```

### Reporting Template
1. **Executive Summary**
   - Key findings (3 bullets)
   - Go/no-go recommendation
   - Required adjustments

2. **Detailed Results**
   - Quantitative metrics + significance
   - Qualitative themes
   - Segment differences
   - Edge cases identified

3. **Recommendations**
   - Priority fixes
   - Enhancement opportunities
   - Rollout strategy
   - Training needs

4. **Appendices**
   - Raw data
   - Statistical outputs
   - Participant feedback
   - Test materials

## Implementation Timeline

### Week 1-2: Preparation
- [ ] Recruit participants
- [ ] Prepare test materials
- [ ] Set up tools
- [ ] Train moderators
- [ ] Pilot test protocols

### Week 3-4: Lab Testing
- [ ] Conduct Protocols 1-4
- [ ] Daily debrief sessions
- [ ] Preliminary analysis
- [ ] Iterate on formats

### Week 5-6: Field Testing
- [ ] Launch diary study
- [ ] Monitor analytics
- [ ] Weekly check-ins
- [ ] Collect feedback

### Week 7-8: Analysis & Reporting
- [ ] Statistical analysis
- [ ] Theme extraction
- [ ] Report creation
- [ ] Stakeholder presentation
- [ ] Implementation planning

## Success Criteria Summary

### Must-Have Outcomes
- ✅ 60% reduction in time-to-insight
- ✅ 75% user preference for new format
- ✅ 40% cognitive load reduction
- ✅ 2x improvement in retention
- ✅ Mobile usability score >4.5/5

### Nice-to-Have Outcomes
- 📈 90% task completion rate
- 📈 NPS improvement >40 points
- 📈 50% increase in document sharing
- 📈 Accessibility score 100%
- 📈 Zero formatting complaints

## Risk Mitigation

### Potential Issues & Solutions
1. **Low participation**: Over-recruit by 20%
2. **Technical problems**: Have backups ready
3. **Biased feedback**: Use multiple methods
4. **Edge cases**: Document and iterate
5. **Change resistance**: Provide toggle option

## Next Steps
1. Approve testing budget
2. Begin participant recruitment
3. Finalize test documents
4. Schedule testing slots
5. Prepare analysis framework