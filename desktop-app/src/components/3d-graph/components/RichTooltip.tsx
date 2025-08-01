import React from 'react';
import {
  Box,
  Typography,
  Paper,
  Chip,
  Stack,
  LinearProgress,
  Divider,
  Link,
  IconButton,
  Tooltip as MuiTooltip,
} from '@mui/material';
import {
  OpenInNew as OpenIcon,
  Article as DocumentIcon,
  Science as ResearchIcon,
  TrendingUp as MarketIcon,
  Newspaper as NewsIcon,
  CalendarToday as DateIcon,
  FolderOpen as SourceIcon,
  Star as QualityIcon,
  LocalOffer as TagIcon,
  Close as CloseIcon,
  ContentCopy as CopyIcon,
  Share as ShareIcon,
  Cloud as CloudIcon,
  Description as NotionIcon,
} from '@mui/icons-material';
import { format } from 'date-fns';
import { GraphNode } from '../types';

interface RichTooltipProps {
  node: GraphNode;
  position: { x: number; y: number };
  visible: boolean;
  frozen?: boolean;
  onOpenInDrive?: () => void;
  onOpenInNotion?: () => void;
  onViewRelated?: () => void;
  onClose?: () => void;
}

const contentTypeIcons = {
  document: DocumentIcon,
  research: ResearchIcon,
  'market-analysis': MarketIcon,
  news: NewsIcon,
};

const contentTypeColors = {
  document: '#4A90E2',
  research: '#7ED321',
  'market-analysis': '#F5A623',
  news: '#BD10E0',
};

const getContentTypeLabel = (type: string) => {
  const labels: Record<string, string> = {
    document: 'Document',
    research: 'Research Paper',
    'market-analysis': 'Market Analysis',
    news: 'News Article',
  };
  return labels[type] || type;
};

const RichTooltip: React.FC<RichTooltipProps> = ({
  node,
  position,
  visible,
  frozen = false,
  onOpenInDrive,
  onOpenInNotion,
  onViewRelated,
  onClose,
}) => {
  if (!visible) return null;

  const Icon = contentTypeIcons[node.metadata.contentType] || DocumentIcon;
  const color = contentTypeColors[node.metadata.contentType] || '#666';

  return (
    <Paper
      elevation={8}
      sx={{
        position: 'absolute',
        left: frozen ? '50%' : position.x + 20,
        top: frozen ? '50%' : position.y - 10,
        transform: frozen ? 'translate(-50%, -50%)' : 'translateY(-50%)',
        width: frozen ? 420 : 320,
        maxWidth: '90vw',
        p: 2,
        pointerEvents: frozen ? 'auto' : 'none',
        backgroundColor: 'rgba(255, 255, 255, 0.98)',
        backdropFilter: 'blur(12px)',
        border: '1px solid rgba(0, 0, 0, 0.08)',
        borderRadius: 2,
        zIndex: 1000,
        transition: 'all 0.2s ease-in-out',
        '&::before': {
          content: '""',
          position: 'absolute',
          left: -8,
          top: '50%',
          transform: 'translateY(-50%)',
          width: 0,
          height: 0,
          borderTop: '8px solid transparent',
          borderBottom: '8px solid transparent',
          borderRight: '8px solid rgba(255, 255, 255, 0.98)',
        },
      }}
    >
      {/* Header */}
      <Box sx={{ display: 'flex', alignItems: 'flex-start', mb: 1.5 }}>
        <Icon sx={{ color, mr: 1, mt: 0.5, fontSize: 28 }} />
        <Box sx={{ flexGrow: 1 }}>
          <Typography variant="h6" sx={{ fontWeight: 600, lineHeight: 1.2 }}>
            {node.title}
          </Typography>
          <Typography variant="caption" color="text.secondary">
            {getContentTypeLabel(node.metadata.contentType)}
          </Typography>
        </Box>
        {frozen && onClose && (
          <IconButton size="small" onClick={onClose} sx={{ ml: 1 }}>
            <CloseIcon fontSize="small" />
          </IconButton>
        )}
      </Box>

      {/* Quality Score */}
      <Box sx={{ mb: 2 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', mb: 0.5 }}>
          <QualityIcon sx={{ fontSize: 16, mr: 0.5, color: 'warning.main' }} />
          <Typography variant="body2" sx={{ fontWeight: 500 }}>
            Quality Score: {node.metadata.qualityScore}/100
          </Typography>
        </Box>
        <LinearProgress
          variant="determinate"
          value={node.metadata.qualityScore}
          sx={{
            height: 6,
            borderRadius: 3,
            backgroundColor: 'rgba(0, 0, 0, 0.08)',
            '& .MuiLinearProgress-bar': {
              borderRadius: 3,
              backgroundColor:
                node.metadata.qualityScore >= 80
                  ? 'success.main'
                  : node.metadata.qualityScore >= 60
                  ? 'warning.main'
                  : 'error.main',
            },
          }}
        />
      </Box>

      {/* Content Preview */}
      {node.metadata.preview && (
        <Paper
          elevation={0}
          sx={{
            p: 1.5,
            mb: 2,
            backgroundColor: 'rgba(0, 0, 0, 0.03)',
            borderRadius: 1,
          }}
        >
          <Typography
            variant="body2"
            sx={{
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              display: '-webkit-box',
              WebkitLineClamp: frozen ? 5 : 3,
              WebkitBoxOrient: 'vertical',
              lineHeight: 1.5,
              color: 'text.secondary',
            }}
          >
            {node.metadata.preview}
          </Typography>
        </Paper>
      )}

      {/* Metadata */}
      <Stack spacing={1} sx={{ mb: 2 }}>
        <Box sx={{ display: 'flex', alignItems: 'center' }}>
          <DateIcon sx={{ fontSize: 16, mr: 1, color: 'text.secondary' }} />
          <Typography variant="caption" color="text.secondary">
            Created: {format(new Date(node.metadata.createdAt), 'MMM d, yyyy')}
          </Typography>
        </Box>
        <Box sx={{ display: 'flex', alignItems: 'center' }}>
          <DateIcon sx={{ fontSize: 16, mr: 1, color: 'text.secondary' }} />
          <Typography variant="caption" color="text.secondary">
            Modified: {format(new Date(node.metadata.lastModified), 'MMM d, yyyy')}
          </Typography>
        </Box>
        {node.metadata.source && (
          <Box sx={{ display: 'flex', alignItems: 'center' }}>
            <SourceIcon sx={{ fontSize: 16, mr: 1, color: 'text.secondary' }} />
            <Typography variant="caption" color="text.secondary" noWrap>
              Source: {node.metadata.source}
            </Typography>
          </Box>
        )}
      </Stack>

      {/* Tags */}
      {node.metadata.tags && node.metadata.tags.length > 0 && (
        <>
          <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
            <TagIcon sx={{ fontSize: 16, mr: 0.5, color: 'text.secondary' }} />
            <Typography variant="caption" color="text.secondary">
              Tags
            </Typography>
          </Box>
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5, mb: 2 }}>
            {node.metadata.tags.slice(0, 5).map((tag) => (
              <Chip
                key={tag}
                label={tag}
                size="small"
                sx={{
                  height: 20,
                  fontSize: '0.75rem',
                  backgroundColor: 'rgba(0, 0, 0, 0.06)',
                  '&:hover': {
                    backgroundColor: 'rgba(0, 0, 0, 0.12)',
                  },
                }}
              />
            ))}
            {node.metadata.tags.length > 5 && (
              <Chip
                label={`+${node.metadata.tags.length - 5}`}
                size="small"
                sx={{
                  height: 20,
                  fontSize: '0.75rem',
                  backgroundColor: 'rgba(0, 0, 0, 0.06)',
                }}
              />
            )}
          </Box>
        </>
      )}

      <Divider sx={{ mb: 1 }} />

      {/* Actions */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 1 }}>
        <Stack direction="row" spacing={1}>
          {frozen && (
            <>
              <MuiTooltip title="Copy Node ID">
                <IconButton size="small" onClick={() => navigator.clipboard.writeText(node.id)}>
                  <CopyIcon fontSize="small" />
                </IconButton>
              </MuiTooltip>
              <MuiTooltip title="Copy Node Data">
                <IconButton size="small" onClick={() => {
                  const nodeData = {
                    title: node.title,
                    type: node.type,
                    metadata: node.metadata,
                  };
                  navigator.clipboard.writeText(JSON.stringify(nodeData, null, 2));
                }}>
                  <ShareIcon fontSize="small" />
                </IconButton>
              </MuiTooltip>
            </>
          )}
        </Stack>
        {onViewRelated && (
          <Link
            component="button"
            variant="caption"
            onClick={onViewRelated}
            sx={{
              textDecoration: 'none',
              '&:hover': {
                textDecoration: 'underline',
              },
            }}
          >
            View {node.connections.length} related documents
          </Link>
        )}
      </Box>

      {/* Drive and Notion Links for frozen state */}
      {frozen && (
        <Box sx={{ mt: 2, display: 'flex', flexDirection: 'column', gap: 1 }}>
          {node.metadata.driveUrl && (
            <Link
              href={node.metadata.driveUrl}
              target="_blank"
              rel="noopener noreferrer"
              sx={{
                display: 'flex',
                alignItems: 'center',
                gap: 1,
                textDecoration: 'none',
                color: 'primary.main',
                '&:hover': {
                  textDecoration: 'underline',
                },
              }}
            >
              <CloudIcon fontSize="small" />
              Open in Google Drive
              <OpenIcon fontSize="small" />
            </Link>
          )}
          {node.metadata.notionUrl && (
            <Link
              href={node.metadata.notionUrl}
              target="_blank"
              rel="noopener noreferrer"
              sx={{
                display: 'flex',
                alignItems: 'center',
                gap: 1,
                textDecoration: 'none',
                color: 'primary.main',
                '&:hover': {
                  textDecoration: 'underline',
                },
              }}
            >
              <NotionIcon fontSize="small" />
              View in Notion
              <OpenIcon fontSize="small" />
            </Link>
          )}
        </Box>
      )}

      {/* Connection Strength Indicator */}
      {node.metadata.weight > 0 && (
        <Box
          sx={{
            position: 'absolute',
            bottom: -8,
            left: '50%',
            transform: 'translateX(-50%)',
            backgroundColor: 'primary.main',
            color: 'white',
            px: 1,
            py: 0.25,
            borderRadius: 1,
            fontSize: '0.7rem',
            fontWeight: 600,
          }}
        >
          Importance: {Math.round(node.metadata.weight * 100)}%
        </Box>
      )}
    </Paper>
  );
};

export default RichTooltip;