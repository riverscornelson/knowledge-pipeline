"""
Cross-Prompt Intelligence Engine
===============================

This module implements advanced intelligence that operates across multiple prompt
outputs to detect relationships, consolidate insights, and create unified analyses.
"""

import re
import json
from typing import Dict, List, Set, Any, Tuple, Optional
from collections import defaultdict, Counter
from dataclasses import dataclass
from datetime import datetime
import hashlib
from ..utils.logging import setup_logger


@dataclass
class EntityMatch:
    """Represents a matched entity across multiple analyses."""
    entity: str
    mention_count: int
    analyzer_sources: Set[str]
    contexts: List[str]
    confidence: float
    entity_type: str  # person, organization, technology, concept


@dataclass
class TopicCluster:
    """Represents a cluster of related topics."""
    cluster_id: str
    primary_topic: str
    related_topics: List[str]
    strength: float
    analyzers_involved: Set[str]
    key_insights: List[str]


@dataclass
class ActionItemGroup:
    """Represents grouped and prioritized action items."""
    group_id: str
    primary_action: str
    similar_actions: List[str]
    priority_score: float
    source_analyzers: Set[str]
    confidence_scores: List[float]
    estimated_effort: str  # low, medium, high
    urgency_indicators: List[str]


@dataclass
class CrossReference:
    """Represents a relationship between different analyzer outputs."""
    source_analyzer: str
    target_analyzer: str
    relationship_type: str  # supports, contradicts, extends, duplicates
    evidence: str
    strength: float


class CrossPromptIntelligenceEngine:
    """Advanced engine for analyzing relationships across prompt outputs."""
    
    def __init__(self):
        """Initialize the intelligence engine."""
        self.logger = setup_logger(__name__)
        
        # Entity recognition patterns
        self.entity_patterns = {
            "technology": [
                r'\b(?:AI|ML|API|SDK|REST|GraphQL|Docker|Kubernetes|AWS|Azure|GCP)\b',
                r'\b\w+(?:\.js|\.py|\.go|\.rs)\b',  # File extensions
                r'\b[A-Z][a-z]+(?:[A-Z][a-z]+)*\b'  # CamelCase (potential tech names)
            ],
            "organization": [
                r'\b(?:Google|Microsoft|Amazon|Apple|Meta|Tesla|Netflix|Uber)\b',
                r'\b[A-Z][a-z]+ (?:Inc\.|Corp\.|LLC|Ltd\.)\b',
                r'\b[A-Z]{2,}\b'  # Acronyms
            ],
            "person": [
                r'\b[A-Z][a-z]+ [A-Z][a-z]+\b',  # First Last
                r'\bCEO\b|\bCTO\b|\bCFO\b'  # Titles that imply people
            ],
            "concept": [
                r'\b(?:machine learning|artificial intelligence|blockchain|quantum computing)\b',
                r'\b(?:strategy|methodology|framework|approach|paradigm)\b'
            ]
        }
        
        # Topic similarity thresholds
        self.topic_similarity_threshold = 0.6
        self.entity_confidence_threshold = 0.7
        
        # Action item patterns
        self.action_patterns = [
            r'\b(?:should|must|need to|recommend|suggest)\b',
            r'\b(?:implement|develop|create|build|design)\b',
            r'\b(?:review|analyze|assess|evaluate)\b',
            r'\b(?:update|modify|change|improve)\b'
        ]
        
        # Urgency indicators
        self.urgency_patterns = [
            r'\b(?:urgent|immediate|asap|critical|emergency)\b',
            r'\b(?:deadline|time-sensitive|quickly|soon)\b',
            r'\b(?:priority|important|essential|crucial)\b'
        ]
    
    def analyze_cross_intelligence(self, results: List['TrackedAnalyzerResult']) -> Dict[str, Any]:
        """
        Perform comprehensive cross-prompt intelligence analysis.
        
        Args:
            results: List of tracked analyzer results
            
        Returns:
            Dictionary containing all cross-intelligence insights
        """
        if len(results) < 2:
            return {"message": "Cross-intelligence requires at least 2 analyzer results"}
        
        self.logger.info(f"Analyzing cross-intelligence for {len(results)} analyzer results")
        
        # Extract and analyze entities
        entities = self._extract_and_match_entities(results)
        
        # Cluster topics
        topic_clusters = self._cluster_topics(results)
        
        # Consolidate action items
        action_groups = self._consolidate_action_items(results)
        
        # Find cross-references
        cross_refs = self._find_cross_references(results)
        
        # Analyze citation overlap
        citation_analysis = self._analyze_citation_overlap(results)
        
        # Generate complementary insights
        complementary = self._generate_complementary_insights(results, entities, topic_clusters)
        
        # Create unified knowledge graph
        knowledge_graph = self._build_knowledge_graph(entities, topic_clusters, cross_refs)
        
        # Quality comparison
        quality_comparison = self._compare_analyzer_quality(results)
        
        return {
            "common_entities": entities,
            "topic_clusters": topic_clusters,
            "consolidated_actions": action_groups,
            "cross_references": cross_refs,
            "citation_overlap": citation_analysis,
            "complementary_insights": complementary,
            "knowledge_graph": knowledge_graph,
            "quality_comparison": quality_comparison,
            "meta_analysis": self._generate_meta_analysis(results, entities, topic_clusters, action_groups)
        }
    
    def _extract_and_match_entities(self, results: List['TrackedAnalyzerResult']) -> List[EntityMatch]:
        """Extract and match entities across all analyzer outputs."""
        entity_mentions = defaultdict(lambda: {
            "count": 0,
            "sources": set(),
            "contexts": [],
            "types": set()
        })
        
        for result in results:
            text = result.content
            analyzer = result.analyzer_type
            
            # Extract entities using patterns
            for entity_type, patterns in self.entity_patterns.items():
                for pattern in patterns:
                    matches = re.finditer(pattern, text, re.IGNORECASE)
                    for match in matches:
                        entity = match.group().strip()
                        if len(entity) > 2:  # Skip very short matches
                            # Get context around the entity
                            start = max(0, match.start() - 50)
                            end = min(len(text), match.end() + 50)
                            context = text[start:end].strip()
                            
                            entity_mentions[entity.lower()]["count"] += 1
                            entity_mentions[entity.lower()]["sources"].add(analyzer)
                            entity_mentions[entity.lower()]["contexts"].append(context)
                            entity_mentions[entity.lower()]["types"].add(entity_type)
        
        # Convert to EntityMatch objects and filter by confidence
        entities = []
        for entity, data in entity_mentions.items():
            if data["count"] >= 2:  # Mentioned at least twice
                confidence = min(1.0, data["count"] / len(results))
                
                # Determine primary entity type
                type_counter = Counter()
                for t in data["types"]:
                    type_counter[t] += 1
                primary_type = type_counter.most_common(1)[0][0]
                
                entities.append(EntityMatch(
                    entity=entity,
                    mention_count=data["count"],
                    analyzer_sources=data["sources"],
                    contexts=data["contexts"][:3],  # Keep top 3 contexts
                    confidence=confidence,
                    entity_type=primary_type
                ))
        
        # Sort by confidence and mention count
        entities.sort(key=lambda x: (x.confidence, x.mention_count), reverse=True)
        
        self.logger.info(f"Found {len(entities)} common entities")
        return entities[:20]  # Return top 20
    
    def _cluster_topics(self, results: List['TrackedAnalyzerResult']) -> List[TopicCluster]:
        """Cluster related topics from different analyzers."""
        # Extract topics from key points and entities
        all_topics = []
        topic_sources = defaultdict(set)
        
        for result in results:
            topics = []
            
            # From key points
            for point in result.key_points:
                topic_words = self._extract_topic_words(point)
                topics.extend(topic_words)
            
            # From topics covered
            if hasattr(result, 'topics_covered'):
                topics.extend(result.topics_covered)
            
            # From entities mentioned
            if hasattr(result, 'entities_mentioned'):
                topics.extend(result.entities_mentioned)
            
            # Track which analyzer mentioned each topic
            for topic in topics:
                if topic:
                    topic_sources[topic.lower()].add(result.analyzer_type)
                    all_topics.append(topic.lower())
        
        # Count topic frequencies
        topic_counts = Counter(all_topics)
        
        # Create clusters for topics mentioned by multiple analyzers
        clusters = []
        processed_topics = set()
        
        for topic, count in topic_counts.most_common():
            if topic in processed_topics or count < 2:
                continue
            
            # Find related topics using simple word overlap
            related = self._find_related_topics(topic, topic_counts, processed_topics)
            
            if related:
                cluster_id = hashlib.md5(f"{topic}_{len(clusters)}".encode()).hexdigest()[:8]
                
                cluster = TopicCluster(
                    cluster_id=cluster_id,
                    primary_topic=topic,
                    related_topics=related,
                    strength=count / len(results),
                    analyzers_involved=topic_sources[topic],
                    key_insights=self._extract_insights_for_topic(topic, results)
                )
                
                clusters.append(cluster)
                processed_topics.add(topic)
                processed_topics.update(related)
        
        self.logger.info(f"Created {len(clusters)} topic clusters")
        return clusters[:10]  # Return top 10 clusters
    
    def _consolidate_action_items(self, results: List['TrackedAnalyzerResult']) -> List[ActionItemGroup]:
        """Consolidate and group similar action items."""
        all_actions = []
        
        # Collect all action items
        for result in results:
            for action in result.action_items:
                all_actions.append({
                    "text": action,
                    "analyzer": result.analyzer_type,
                    "confidence": result.confidence_score,
                    "quality": result.quality_score
                })
        
        if not all_actions:
            return []
        
        # Group similar actions
        groups = []
        processed_actions = set()
        
        for action in all_actions:
            if action["text"] in processed_actions:
                continue
            
            # Find similar actions
            similar = self._find_similar_actions(action["text"], all_actions, processed_actions)
            
            if similar:
                group_id = hashlib.md5(f"{action['text']}_{len(groups)}".encode()).hexdigest()[:8]
                
                # Calculate priority based on frequency, confidence, and quality
                total_confidence = sum(a["confidence"] for a in similar)
                total_quality = sum(a["quality"] for a in similar)
                priority = (len(similar) * (total_confidence + total_quality)) / (2 * len(results))
                
                # Extract urgency indicators
                urgency = self._extract_urgency_indicators(action["text"])
                
                # Estimate effort
                effort = self._estimate_effort(action["text"])
                
                group = ActionItemGroup(
                    group_id=group_id,
                    primary_action=action["text"],
                    similar_actions=[a["text"] for a in similar[1:]],  # Exclude primary
                    priority_score=priority,
                    source_analyzers={a["analyzer"] for a in similar},
                    confidence_scores=[a["confidence"] for a in similar],
                    estimated_effort=effort,
                    urgency_indicators=urgency
                )
                
                groups.append(group)
                processed_actions.update(a["text"] for a in similar)
        
        # Sort by priority
        groups.sort(key=lambda x: x.priority_score, reverse=True)
        
        self.logger.info(f"Consolidated {len(all_actions)} actions into {len(groups)} groups")
        return groups
    
    def _find_cross_references(self, results: List['TrackedAnalyzerResult']) -> List[CrossReference]:
        """Find relationships between different analyzer outputs."""
        cross_refs = []
        
        for i, result1 in enumerate(results):
            for j, result2 in enumerate(results[i+1:], i+1):
                # Check for supporting relationships
                support_strength = self._calculate_support_strength(result1, result2)
                if support_strength > 0.6:
                    cross_refs.append(CrossReference(
                        source_analyzer=result1.analyzer_type,
                        target_analyzer=result2.analyzer_type,
                        relationship_type="supports",
                        evidence=self._find_supporting_evidence(result1, result2),
                        strength=support_strength
                    ))
                
                # Check for contradictions
                contradiction_strength = self._calculate_contradiction_strength(result1, result2)
                if contradiction_strength > 0.5:
                    cross_refs.append(CrossReference(
                        source_analyzer=result1.analyzer_type,
                        target_analyzer=result2.analyzer_type,
                        relationship_type="contradicts",
                        evidence=self._find_contradicting_evidence(result1, result2),
                        strength=contradiction_strength
                    ))
                
                # Check for extensions
                extension_strength = self._calculate_extension_strength(result1, result2)
                if extension_strength > 0.5:
                    cross_refs.append(CrossReference(
                        source_analyzer=result1.analyzer_type,
                        target_analyzer=result2.analyzer_type,
                        relationship_type="extends",
                        evidence=self._find_extending_evidence(result1, result2),
                        strength=extension_strength
                    ))
        
        return cross_refs
    
    def _analyze_citation_overlap(self, results: List['TrackedAnalyzerResult']) -> Dict[str, Any]:
        """Analyze overlap in citations between different analyzers."""
        if not any(result.citations for result in results):
            return {"message": "No citations found"}
        
        citation_map = defaultdict(set)
        all_citations = set()
        
        for result in results:
            for citation in result.citations:
                citation_key = citation.url or citation.title
                citation_map[citation_key].add(result.analyzer_type)
                all_citations.add(citation_key)
        
        # Find overlapping citations
        overlapping = {url: analyzers for url, analyzers in citation_map.items() if len(analyzers) > 1}
        
        # Find unique citations per analyzer
        unique_per_analyzer = defaultdict(set)
        for result in results:
            for citation in result.citations:
                citation_key = citation.url or citation.title
                if len(citation_map[citation_key]) == 1:
                    unique_per_analyzer[result.analyzer_type].add(citation_key)
        
        return {
            "total_unique_sources": len(all_citations),
            "overlapping_sources": len(overlapping),
            "overlap_percentage": len(overlapping) / len(all_citations) if all_citations else 0,
            "overlapping_citations": overlapping,
            "unique_per_analyzer": dict(unique_per_analyzer),
            "source_coverage": {
                analyzer: len([c for c in result.citations])
                for result in results
                for analyzer in [result.analyzer_type]
            }
        }
    
    def _generate_complementary_insights(self, results: List['TrackedAnalyzerResult'], 
                                       entities: List[EntityMatch],
                                       clusters: List[TopicCluster]) -> List[Dict[str, Any]]:
        """Generate insights that complement the individual analyzer outputs."""
        complementary = []
        
        # Gap analysis - what topics are missing?
        expected_topics = self._get_expected_topics_for_content(results[0].content_type)
        covered_topics = {cluster.primary_topic for cluster in clusters}
        missing_topics = expected_topics - covered_topics
        
        if missing_topics:
            complementary.append({
                "type": "gap_analysis",
                "title": "Potential Knowledge Gaps",
                "insight": f"Analysis may benefit from exploring: {', '.join(list(missing_topics)[:3])}",
                "confidence": 0.7,
                "source": "cross_analysis"
            })
        
        # Entity relationship insights
        if len(entities) >= 2:
            top_entities = [e.entity for e in entities[:3]]
            complementary.append({
                "type": "entity_relationships",
                "title": "Key Entity Interactions",
                "insight": f"Primary entities ({', '.join(top_entities)}) appear to be interconnected across multiple analysis dimensions",
                "confidence": 0.8,
                "source": "entity_analysis"
            })
        
        # Quality variance insights
        quality_scores = [r.quality_score for r in results]
        if max(quality_scores) - min(quality_scores) > 0.3:
            complementary.append({
                "type": "quality_variance",
                "title": "Analysis Quality Variance",
                "insight": f"Quality scores vary significantly ({min(quality_scores):.0%} - {max(quality_scores):.0%}), suggesting some aspects may need deeper analysis",
                "confidence": 0.9,
                "source": "quality_analysis"
            })
        
        # Consensus vs divergence
        consensus_score = self._calculate_consensus_score(results)
        if consensus_score < 0.6:
            complementary.append({
                "type": "divergence_alert",
                "title": "Analytical Divergence Detected",
                "insight": f"Different analyzers show varied perspectives (consensus: {consensus_score:.0%}), suggesting complex or ambiguous content",
                "confidence": 0.8,
                "source": "consensus_analysis"
            })
        
        return complementary
    
    def _build_knowledge_graph(self, entities: List[EntityMatch], 
                             clusters: List[TopicCluster],
                             cross_refs: List[CrossReference]) -> Dict[str, Any]:
        """Build a simple knowledge graph representation."""
        nodes = []
        edges = []
        
        # Add entity nodes
        for entity in entities:
            nodes.append({
                "id": f"entity_{entity.entity}",
                "type": "entity",
                "label": entity.entity,
                "size": entity.mention_count,
                "confidence": entity.confidence,
                "entity_type": entity.entity_type
            })
        
        # Add topic cluster nodes
        for cluster in clusters:
            nodes.append({
                "id": f"topic_{cluster.cluster_id}",
                "type": "topic",
                "label": cluster.primary_topic,
                "size": len(cluster.analyzers_involved),
                "strength": cluster.strength
            })
        
        # Add analyzer nodes
        analyzer_types = set()
        for entity in entities:
            analyzer_types.update(entity.analyzer_sources)
        
        for analyzer in analyzer_types:
            nodes.append({
                "id": f"analyzer_{analyzer}",
                "type": "analyzer",
                "label": analyzer,
                "size": 1
            })
        
        # Add edges based on cross-references
        for ref in cross_refs:
            edges.append({
                "source": f"analyzer_{ref.source_analyzer}",
                "target": f"analyzer_{ref.target_analyzer}",
                "type": ref.relationship_type,
                "strength": ref.strength
            })
        
        return {
            "nodes": nodes,
            "edges": edges,
            "node_count": len(nodes),
            "edge_count": len(edges)
        }
    
    # Helper methods
    
    def _extract_topic_words(self, text: str) -> List[str]:
        """Extract topic words from text using simple NLP."""
        # Remove common words and extract nouns/concepts
        stop_words = {'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by', 'is', 'are', 'was', 'were', 'be', 'been', 'being', 'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'should', 'could', 'can', 'may', 'might'}
        
        words = re.findall(r'\b[A-Za-z]{3,}\b', text.lower())
        return [word for word in words if word not in stop_words]
    
    def _find_related_topics(self, topic: str, topic_counts: Counter, processed: Set[str]) -> List[str]:
        """Find topics related to the given topic using word overlap."""
        related = []
        topic_words = set(topic.split())
        
        for other_topic, count in topic_counts.items():
            if other_topic in processed or other_topic == topic or count < 2:
                continue
            
            other_words = set(other_topic.split())
            overlap = len(topic_words & other_words)
            total = len(topic_words | other_words)
            
            if total > 0 and overlap / total > self.topic_similarity_threshold:
                related.append(other_topic)
        
        return related
    
    def _extract_insights_for_topic(self, topic: str, results: List['TrackedAnalyzerResult']) -> List[str]:
        """Extract key insights related to a specific topic."""
        insights = []
        
        for result in results:
            for insight in result.key_points:
                if topic.lower() in insight.lower():
                    insights.append(insight)
        
        return insights[:3]  # Return top 3
    
    def _find_similar_actions(self, action: str, all_actions: List[Dict], processed: Set[str]) -> List[Dict]:
        """Find actions similar to the given action."""
        similar = [next(a for a in all_actions if a["text"] == action)]
        action_words = set(action.lower().split())
        
        for other_action in all_actions:
            if other_action["text"] in processed or other_action["text"] == action:
                continue
            
            other_words = set(other_action["text"].lower().split())
            overlap = len(action_words & other_words)
            total = len(action_words | other_words)
            
            if total > 0 and overlap / total > 0.4:  # 40% word overlap
                similar.append(other_action)
        
        return similar
    
    def _extract_urgency_indicators(self, text: str) -> List[str]:
        """Extract urgency indicators from action text."""
        indicators = []
        
        for pattern in self.urgency_patterns:
            matches = re.findall(pattern, text, re.IGNORECASE)
            indicators.extend(matches)
        
        return list(set(indicators))
    
    def _estimate_effort(self, action: str) -> str:
        """Estimate effort level for an action."""
        high_effort_words = ['implement', 'develop', 'build', 'create', 'design', 'restructure']
        medium_effort_words = ['update', 'modify', 'improve', 'optimize', 'enhance']
        low_effort_words = ['review', 'check', 'verify', 'document', 'monitor']
        
        action_lower = action.lower()
        
        if any(word in action_lower for word in high_effort_words):
            return "high"
        elif any(word in action_lower for word in medium_effort_words):
            return "medium"
        elif any(word in action_lower for word in low_effort_words):
            return "low"
        else:
            return "medium"  # Default
    
    def _calculate_support_strength(self, result1: 'TrackedAnalyzerResult', result2: 'TrackedAnalyzerResult') -> float:
        """Calculate how much one result supports another."""
        # Simple implementation based on entity overlap
        entities1 = set(getattr(result1, 'entities_mentioned', []))
        entities2 = set(getattr(result2, 'entities_mentioned', []))
        
        if not entities1 or not entities2:
            return 0.0
        
        overlap = len(entities1 & entities2)
        total = len(entities1 | entities2)
        
        return overlap / total if total > 0 else 0.0
    
    def _calculate_contradiction_strength(self, result1: 'TrackedAnalyzerResult', result2: 'TrackedAnalyzerResult') -> float:
        """Calculate contradiction strength between results."""
        # Look for opposing sentiment or conflicting recommendations
        contradiction_pairs = [
            ('positive', 'negative'),
            ('increase', 'decrease'),
            ('implement', 'avoid'),
            ('recommend', 'discourage')
        ]
        
        text1 = result1.content.lower()
        text2 = result2.content.lower()
        
        contradictions = 0
        total_pairs = 0
        
        for word1, word2 in contradiction_pairs:
            if word1 in text1 and word2 in text2:
                contradictions += 1
            total_pairs += 1
        
        return contradictions / total_pairs if total_pairs > 0 else 0.0
    
    def _calculate_extension_strength(self, result1: 'TrackedAnalyzerResult', result2: 'TrackedAnalyzerResult') -> float:
        """Calculate how much one result extends another."""
        # Check if result2 has additional insights building on result1
        if result1.analyzer_type == 'summarizer' and result2.analyzer_type == 'insights':
            return 0.8  # Insights typically extend summaries
        elif result1.analyzer_type == 'insights' and result2.analyzer_type == 'technical':
            return 0.7  # Technical analysis extends insights
        else:
            return 0.3  # Default low extension
    
    def _find_supporting_evidence(self, result1: 'TrackedAnalyzerResult', result2: 'TrackedAnalyzerResult') -> str:
        """Find evidence of how one result supports another."""
        return f"{result1.analyzer_type} and {result2.analyzer_type} identify similar key themes and entities"
    
    def _find_contradicting_evidence(self, result1: 'TrackedAnalyzerResult', result2: 'TrackedAnalyzerResult') -> str:
        """Find evidence of contradiction between results."""
        return f"{result1.analyzer_type} and {result2.analyzer_type} present conflicting recommendations or assessments"
    
    def _find_extending_evidence(self, result1: 'TrackedAnalyzerResult', result2: 'TrackedAnalyzerResult') -> str:
        """Find evidence of how one result extends another."""
        return f"{result2.analyzer_type} provides additional depth and specificity to themes identified by {result1.analyzer_type}"
    
    def _get_expected_topics_for_content(self, content_type: str) -> Set[str]:
        """Get expected topics for a given content type."""
        topic_map = {
            "technical_paper": {"methodology", "results", "limitations", "future_work"},
            "market_analysis": {"trends", "competition", "opportunities", "risks"},
            "product_announcement": {"features", "benefits", "pricing", "availability"},
            "research_report": {"findings", "methodology", "implications", "recommendations"}
        }
        
        return topic_map.get(content_type, {"analysis", "insights", "recommendations"})
    
    def _calculate_consensus_score(self, results: List['TrackedAnalyzerResult']) -> float:
        """Calculate consensus score across all results."""
        if len(results) < 2:
            return 1.0
        
        # Simple consensus based on entity overlap
        all_entities = []
        for result in results:
            all_entities.extend(getattr(result, 'entities_mentioned', []))
        
        if not all_entities:
            return 0.5  # Default when no entities
        
        entity_counts = Counter(all_entities)
        common_entities = [e for e, count in entity_counts.items() if count > 1]
        
        return len(common_entities) / len(set(all_entities)) if all_entities else 0.5
    
    def _compare_analyzer_quality(self, results: List['TrackedAnalyzerResult']) -> List[Dict[str, Any]]:
        """Compare quality metrics across analyzers."""
        comparison = []
        
        for result in results:
            efficiency = result.quality_score / (result.generation_time_ms / 1000) if result.generation_time_ms > 0 else 0
            
            comparison.append({
                "analyzer": result.analyzer_type,
                "quality": result.quality_score,
                "confidence": result.confidence_score,
                "speed_ms": result.generation_time_ms,
                "efficiency": efficiency,
                "tokens": result.token_count,
                "cost_per_quality": result.token_count / result.quality_score if result.quality_score > 0 else 0
            })
        
        return sorted(comparison, key=lambda x: x["quality"], reverse=True)
    
    def _generate_meta_analysis(self, results: List['TrackedAnalyzerResult'],
                              entities: List[EntityMatch],
                              clusters: List[TopicCluster],
                              actions: List[ActionItemGroup]) -> Dict[str, Any]:
        """Generate meta-analysis across all intelligence components."""
        return {
            "summary": f"Cross-analysis of {len(results)} AI outputs identified {len(entities)} common entities, {len(clusters)} topic clusters, and {len(actions)} action groups",
            "key_findings": [
                f"Primary entities: {', '.join([e.entity for e in entities[:3]])}",
                f"Main topics: {', '.join([c.primary_topic for c in clusters[:3]])}",
                f"Top priority actions: {actions[0].primary_action if actions else 'None identified'}"
            ],
            "intelligence_score": self._calculate_intelligence_score(entities, clusters, actions),
            "coverage_assessment": self._assess_coverage(results, entities, clusters),
            "recommended_next_steps": self._recommend_next_steps(entities, clusters, actions)
        }
    
    def _calculate_intelligence_score(self, entities: List[EntityMatch],
                                    clusters: List[TopicCluster],
                                    actions: List[ActionItemGroup]) -> float:
        """Calculate overall intelligence score for the cross-analysis."""
        entity_score = min(1.0, len(entities) / 10)  # Normalize to 10 entities
        cluster_score = min(1.0, len(clusters) / 5)  # Normalize to 5 clusters
        action_score = min(1.0, len(actions) / 5)   # Normalize to 5 action groups
        
        return (entity_score + cluster_score + action_score) / 3
    
    def _assess_coverage(self, results: List['TrackedAnalyzerResult'],
                        entities: List[EntityMatch],
                        clusters: List[TopicCluster]) -> str:
        """Assess how comprehensive the cross-analysis coverage is."""
        if len(entities) >= 5 and len(clusters) >= 3:
            return "comprehensive"
        elif len(entities) >= 3 and len(clusters) >= 2:
            return "good"
        elif len(entities) >= 1 or len(clusters) >= 1:
            return "basic"
        else:
            return "limited"
    
    def _recommend_next_steps(self, entities: List[EntityMatch],
                            clusters: List[TopicCluster],
                            actions: List[ActionItemGroup]) -> List[str]:
        """Recommend next steps based on the cross-analysis."""
        recommendations = []
        
        if actions:
            recommendations.append(f"Prioritize {actions[0].primary_action}")
        
        if entities:
            top_entity = entities[0]
            recommendations.append(f"Investigate relationships involving {top_entity.entity}")
        
        if clusters:
            top_cluster = clusters[0]
            recommendations.append(f"Deep dive into {top_cluster.primary_topic} themes")
        
        if len(recommendations) == 0:
            recommendations.append("Consider additional analysis with different prompt strategies")
        
        return recommendations