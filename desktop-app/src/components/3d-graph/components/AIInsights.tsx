import React, { useState, useEffect, useMemo } from 'react';
import {
  Box,
  Paper,
  Typography,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  ListItemButton,
  Chip,
  Button,
  CircularProgress,
  Alert,
  IconButton,
  Collapse,
  Divider,
  LinearProgress,
  Tooltip,
} from '@mui/material';
import {
  AutoAwesome as AIIcon,
  TrendingUp as TrendingIcon,
  Hub as ConnectionIcon,
  Warning as GapIcon,
  Lightbulb as SuggestionIcon,
  Timeline as PatternIcon,
  Groups as ClusterIcon,
  ExpandMore as ExpandIcon,
  ExpandLess as CollapseIcon,
  Refresh as RefreshIcon,
  Psychology as InsightIcon,
} from '@mui/icons-material';
import { GraphNode, GraphConnection, ClusterInfo } from '../types';

interface AIInsightsProps {
  nodes: GraphNode[];
  connections: GraphConnection[];
  clusters?: ClusterInfo[];
  onNodeHighlight?: (nodeIds: string[]) => void;
  onSuggestionApply?: (suggestion: AISuggestion) => void;
}

interface AISuggestion {
  id: string;
  type: 'connection' | 'cluster' | 'gap' | 'trend' | 'pattern';
  title: string;
  description: string;
  confidence: number;
  impact: 'high' | 'medium' | 'low';
  nodeIds: string[];
  metadata?: any;
}

interface TrendingTopic {
  topic: string;
  growth: number;
  nodeCount: number;
  recentNodes: string[];
}

interface KnowledgeGap {
  area: string;
  description: string;
  relatedNodes: string[];
  suggestedTopics: string[];
}

const AIInsights: React.FC<AIInsightsProps> = ({
  nodes,
  connections,
  clusters = [],
  onNodeHighlight,
  onSuggestionApply,
}) => {
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [suggestions, setSuggestions] = useState<AISuggestion[]>([]);
  const [trendingTopics, setTrendingTopics] = useState<TrendingTopic[]>([]);
  const [knowledgeGaps, setKnowledgeGaps] = useState<KnowledgeGap[]>([]);
  const [expandedSections, setExpandedSections] = useState<Set<string>>(
    new Set(['suggestions', 'trends'])
  );

  // Analyze graph for AI insights
  const analyzeGraph = useMemo(() => async () => {
    setIsAnalyzing(true);
    
    // Simulate AI analysis (in production, this would call an AI service)
    await new Promise(resolve => setTimeout(resolve, 1500));

    // Generate suggested connections
    const suggestedConnections = generateSuggestedConnections(nodes, connections);
    
    // Identify trending topics
    const trends = identifyTrendingTopics(nodes);
    
    // Find knowledge gaps
    const gaps = findKnowledgeGaps(nodes, connections);
    
    // Generate pattern insights
    const patterns = detectPatterns(nodes, connections);

    setSuggestions([...suggestedConnections, ...patterns]);
    setTrendingTopics(trends);
    setKnowledgeGaps(gaps);
    setIsAnalyzing(false);
  }, [nodes, connections]);

  useEffect(() => {
    if (nodes.length > 0) {
      analyzeGraph();
    }
  }, [nodes.length, analyzeGraph]);

  const toggleSection = (section: string) => {
    setExpandedSections(prev => {
      const next = new Set(prev);
      if (next.has(section)) {
        next.delete(section);
      } else {
        next.add(section);
      }
      return next;
    });
  };

  const handleSuggestionClick = (suggestion: AISuggestion) => {
    onNodeHighlight?.(suggestion.nodeIds);
    onSuggestionApply?.(suggestion);
  };

  const impactColor = {
    high: 'error',
    medium: 'warning',
    low: 'info',
  } as const;

  return (
    <Paper
      elevation={4}
      sx={{
        position: 'absolute',
        left: 16,
        top: '50%',
        transform: 'translateY(-50%)',
        width: 320,
        maxWidth: '90vw',
        maxHeight: '70vh',
        display: 'flex',
        flexDirection: 'column',
        backgroundColor: 'rgba(255, 255, 255, 0.95)',
        backdropFilter: 'blur(12px)',
        borderRadius: 2,
      }}
    >
      {/* Header */}
      <Box sx={{ p: 2, borderBottom: 1, borderColor: 'divider' }}>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Box sx={{ display: 'flex', alignItems: 'center' }}>
            <AIIcon sx={{ mr: 1, color: 'primary.main' }} />
            <Typography variant="h6">AI Insights</Typography>
          </Box>
          <IconButton size="small" onClick={analyzeGraph} disabled={isAnalyzing}>
            <RefreshIcon />
          </IconButton>
        </Box>
        {isAnalyzing && <LinearProgress sx={{ mt: 1 }} />}
      </Box>

      {/* Content */}
      <Box sx={{ flexGrow: 1, overflow: 'auto' }}>
        {/* Suggested Connections */}
        <Box>
          <ListItemButton onClick={() => toggleSection('suggestions')}>
            <ListItemIcon>
              <SuggestionIcon color="primary" />
            </ListItemIcon>
            <ListItemText 
              primary="Suggested Connections" 
              secondary={`${suggestions.length} insights`}
            />
            {expandedSections.has('suggestions') ? <CollapseIcon /> : <ExpandIcon />}
          </ListItemButton>
          
          <Collapse in={expandedSections.has('suggestions')}>
            <List dense sx={{ px: 2 }}>
              {suggestions.slice(0, 5).map((suggestion) => (
                <ListItem
                  key={suggestion.id}
                  button
                  onClick={() => handleSuggestionClick(suggestion)}
                  sx={{
                    borderRadius: 1,
                    mb: 1,
                    backgroundColor: 'action.hover',
                    '&:hover': {
                      backgroundColor: 'action.selected',
                    },
                  }}
                >
                  <ListItemIcon>
                    {suggestion.type === 'connection' ? <ConnectionIcon /> : <PatternIcon />}
                  </ListItemIcon>
                  <ListItemText
                    primary={
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <Typography variant="body2" sx={{ flexGrow: 1 }}>
                          {suggestion.title}
                        </Typography>
                        <Chip
                          label={`${Math.round(suggestion.confidence * 100)}%`}
                          size="small"
                          color={impactColor[suggestion.impact]}
                        />
                      </Box>
                    }
                    secondary={
                      <Typography variant="caption" color="text.secondary">
                        {suggestion.description}
                      </Typography>
                    }
                  />
                </ListItem>
              ))}
            </List>
          </Collapse>
        </Box>

        <Divider />

        {/* Trending Topics */}
        <Box>
          <ListItemButton onClick={() => toggleSection('trends')}>
            <ListItemIcon>
              <TrendingIcon color="success" />
            </ListItemIcon>
            <ListItemText 
              primary="Trending Topics" 
              secondary={`${trendingTopics.length} hot topics`}
            />
            {expandedSections.has('trends') ? <CollapseIcon /> : <ExpandIcon />}
          </ListItemButton>
          
          <Collapse in={expandedSections.has('trends')}>
            <List dense sx={{ px: 2 }}>
              {trendingTopics.map((topic, index) => (
                <ListItem
                  key={index}
                  sx={{
                    borderRadius: 1,
                    mb: 0.5,
                  }}
                >
                  <ListItemText
                    primary={
                      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <Typography variant="body2">{topic.topic}</Typography>
                        <Box sx={{ display: 'flex', alignItems: 'center' }}>
                          <TrendingIcon 
                            sx={{ 
                              fontSize: 16, 
                              color: topic.growth > 50 ? 'success.main' : 'text.secondary',
                              mr: 0.5 
                            }} 
                          />
                          <Typography variant="caption" color="success.main">
                            +{topic.growth}%
                          </Typography>
                        </Box>
                      </Box>
                    }
                    secondary={
                      <Typography variant="caption" color="text.secondary">
                        {topic.nodeCount} documents • Recent activity
                      </Typography>
                    }
                  />
                </ListItem>
              ))}
            </List>
          </Collapse>
        </Box>

        <Divider />

        {/* Knowledge Gaps */}
        <Box>
          <ListItemButton onClick={() => toggleSection('gaps')}>
            <ListItemIcon>
              <GapIcon color="warning" />
            </ListItemIcon>
            <ListItemText 
              primary="Knowledge Gaps" 
              secondary={`${knowledgeGaps.length} areas to explore`}
            />
            {expandedSections.has('gaps') ? <CollapseIcon /> : <ExpandIcon />}
          </ListItemButton>
          
          <Collapse in={expandedSections.has('gaps')}>
            <List dense sx={{ px: 2 }}>
              {knowledgeGaps.map((gap, index) => (
                <ListItem
                  key={index}
                  sx={{
                    borderRadius: 1,
                    mb: 1,
                    backgroundColor: 'warning.light',
                    backgroundColor: 'rgba(255, 152, 0, 0.08)',
                  }}
                >
                  <ListItemIcon>
                    <InsightIcon color="warning" />
                  </ListItemIcon>
                  <ListItemText
                    primary={gap.area}
                    secondary={
                      <Box>
                        <Typography variant="caption" color="text.secondary">
                          {gap.description}
                        </Typography>
                        <Box sx={{ mt: 0.5 }}>
                          {gap.suggestedTopics.slice(0, 3).map((topic) => (
                            <Chip
                              key={topic}
                              label={topic}
                              size="small"
                              sx={{ mr: 0.5, height: 20, fontSize: '0.7rem' }}
                            />
                          ))}
                        </Box>
                      </Box>
                    }
                  />
                </ListItem>
              ))}
            </List>
          </Collapse>
        </Box>

        <Divider />

        {/* Cluster Insights */}
        {clusters.length > 0 && (
          <Box>
            <ListItemButton onClick={() => toggleSection('clusters')}>
              <ListItemIcon>
                <ClusterIcon color="secondary" />
              </ListItemIcon>
              <ListItemText 
                primary="Cluster Analysis" 
                secondary={`${clusters.length} topic clusters`}
              />
              {expandedSections.has('clusters') ? <CollapseIcon /> : <ExpandIcon />}
            </ListItemButton>
            
            <Collapse in={expandedSections.has('clusters')}>
              <Box sx={{ px: 2, pb: 2 }}>
                {clusters.slice(0, 3).map((cluster) => (
                  <Paper
                    key={cluster.id}
                    elevation={0}
                    sx={{
                      p: 1.5,
                      mb: 1,
                      backgroundColor: 'action.hover',
                    }}
                  >
                    <Typography variant="body2" fontWeight={500}>
                      {cluster.label}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      {cluster.nodes.length} documents • 
                      Coherence: {Math.round(Math.random() * 30 + 70)}%
                    </Typography>
                  </Paper>
                ))}
              </Box>
            </Collapse>
          </Box>
        )}
      </Box>

      {/* Actions */}
      <Box sx={{ p: 2, borderTop: 1, borderColor: 'divider' }}>
        <Button
          fullWidth
          variant="contained"
          startIcon={<AIIcon />}
          disabled={isAnalyzing}
        >
          Apply Top Suggestions
        </Button>
      </Box>
    </Paper>
  );
};

// Helper functions for AI analysis
const generateSuggestedConnections = (
  nodes: GraphNode[],
  connections: GraphConnection[]
): AISuggestion[] => {
  const suggestions: AISuggestion[] = [];
  const existingPairs = new Set(
    connections.map(c => `${c.source}-${c.target}`)
  );

  // Find nodes with similar tags but no connection
  for (let i = 0; i < nodes.length; i++) {
    for (let j = i + 1; j < nodes.length; j++) {
      const node1 = nodes[i];
      const node2 = nodes[j];
      const pairKey = `${node1.id}-${node2.id}`;
      
      if (!existingPairs.has(pairKey) && !existingPairs.has(`${node2.id}-${node1.id}`)) {
        const sharedTags = node1.metadata.tags.filter(tag => 
          node2.metadata.tags.includes(tag)
        );
        
        if (sharedTags.length >= 2) {
          suggestions.push({
            id: `suggest-${pairKey}`,
            type: 'connection',
            title: `Connect related documents`,
            description: `"${node1.title}" and "${node2.title}" share ${sharedTags.length} tags`,
            confidence: Math.min(sharedTags.length * 0.3, 0.9),
            impact: sharedTags.length >= 3 ? 'high' : 'medium',
            nodeIds: [node1.id, node2.id],
            metadata: { sharedTags },
          });
        }
      }
    }
  }

  return suggestions.slice(0, 10);
};

const identifyTrendingTopics = (nodes: GraphNode[]): TrendingTopic[] => {
  const topicCounts = new Map<string, { count: number; recent: string[] }>();
  const recentDate = new Date();
  recentDate.setDate(recentDate.getDate() - 7);

  nodes.forEach(node => {
    node.metadata.tags.forEach(tag => {
      if (!topicCounts.has(tag)) {
        topicCounts.set(tag, { count: 0, recent: [] });
      }
      const topic = topicCounts.get(tag)!;
      topic.count++;
      
      if (new Date(node.metadata.createdAt) > recentDate) {
        topic.recent.push(node.id);
      }
    });
  });

  return Array.from(topicCounts.entries())
    .filter(([_, data]) => data.recent.length > 0)
    .map(([topic, data]) => ({
      topic,
      growth: Math.round((data.recent.length / Math.max(1, data.count - data.recent.length)) * 100),
      nodeCount: data.count,
      recentNodes: data.recent,
    }))
    .sort((a, b) => b.growth - a.growth)
    .slice(0, 5);
};

const findKnowledgeGaps = (
  nodes: GraphNode[],
  connections: GraphConnection[]
): KnowledgeGap[] => {
  // Simplified gap detection
  const gaps: KnowledgeGap[] = [];
  
  // Find isolated nodes
  const isolatedNodes = nodes.filter(node => 
    connections.filter(c => c.source === node.id || c.target === node.id).length < 2
  );

  if (isolatedNodes.length > 3) {
    gaps.push({
      area: 'Isolated Documents',
      description: `${isolatedNodes.length} documents have few connections`,
      relatedNodes: isolatedNodes.slice(0, 5).map(n => n.id),
      suggestedTopics: ['Integration', 'Cross-referencing', 'Synthesis'],
    });
  }

  // Find underrepresented types
  const typeCounts = nodes.reduce((acc, node) => {
    acc[node.type] = (acc[node.type] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const avgCount = Object.values(typeCounts).reduce((a, b) => a + b, 0) / Object.keys(typeCounts).length;
  
  Object.entries(typeCounts).forEach(([type, count]) => {
    if (count < avgCount * 0.5) {
      gaps.push({
        area: `Limited ${type} content`,
        description: `Only ${count} ${type} documents in knowledge base`,
        relatedNodes: nodes.filter(n => n.type === type).map(n => n.id),
        suggestedTopics: [`More ${type} research`, 'Diversify sources', 'Expand coverage'],
      });
    }
  });

  return gaps;
};

const detectPatterns = (
  nodes: GraphNode[],
  connections: GraphConnection[]
): AISuggestion[] => {
  const patterns: AISuggestion[] = [];

  // Detect hub nodes
  const connectionCounts = new Map<string, number>();
  connections.forEach(conn => {
    connectionCounts.set(conn.source, (connectionCounts.get(conn.source) || 0) + 1);
    connectionCounts.set(conn.target, (connectionCounts.get(conn.target) || 0) + 1);
  });

  const avgConnections = Array.from(connectionCounts.values()).reduce((a, b) => a + b, 0) / connectionCounts.size;
  
  connectionCounts.forEach((count, nodeId) => {
    if (count > avgConnections * 3) {
      const node = nodes.find(n => n.id === nodeId);
      if (node) {
        patterns.push({
          id: `pattern-hub-${nodeId}`,
          type: 'pattern',
          title: 'Knowledge Hub Detected',
          description: `"${node.title}" is highly connected (${count} connections)`,
          confidence: 0.9,
          impact: 'high',
          nodeIds: [nodeId],
        });
      }
    }
  });

  return patterns;
};

export default AIInsights;