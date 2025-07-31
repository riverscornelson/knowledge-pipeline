import React from 'react';
import { 
  Paper, 
  Typography, 
  Chip, 
  Box, 
  IconButton, 
  Divider,
  Button,
  Stack,
  Fade,
  Slide
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import AccountTreeIcon from '@mui/icons-material/AccountTree';
import AccessTimeIcon from '@mui/icons-material/AccessTime';
import { Node3D } from '../../../main/services/DataIntegrationService';

interface NodeInfoPanelProps {
  node: Node3D | null;
  onClose: () => void;
  onShowConnections?: (nodeId: string) => void;
}

export const NodeInfoPanel: React.FC<NodeInfoPanelProps> = ({
  node,
  onClose,
  onShowConnections
}) => {
  if (!node) return null;

  const typeColors: Record<string, string> = {
    document: '#3498db',
    insight: '#e74c3c',
    tag: '#2ecc71',
    person: '#f39c12',
    concept: '#9b59b6',
    source: '#1abc9c'
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  };

  return (
    <Slide direction="left" in={!!node} mountOnEnter unmountOnExit>
      <Paper
        sx={{
          position: 'absolute',
          right: 16,
          top: 16,
          width: 340,
          maxHeight: '85vh',
          overflow: 'auto',
          p: 3,
          backgroundColor: 'rgba(255, 255, 255, 0.97)',
          backdropFilter: 'blur(12px)',
          boxShadow: '0 8px 32px rgba(0, 0, 0, 0.12)',
          borderRadius: 3,
          border: '1px solid rgba(255, 255, 255, 0.2)',
          zIndex: 1000,
          transition: 'all 0.3s ease'
        }}
      >
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 2 }}>
        <Box sx={{ flex: 1 }}>
          <Typography variant="h5" sx={{ fontWeight: 700, mb: 1.5, color: 'primary.main' }}>
            {node.label}
          </Typography>
          <Chip
            label={node.type}
            size="medium"
            sx={{
              backgroundColor: typeColors[node.type] || '#999',
              color: 'white',
              fontWeight: 600,
              fontSize: '0.75rem',
              textTransform: 'uppercase',
              letterSpacing: '0.5px'
            }}
          />
        </Box>
        <IconButton size="small" onClick={onClose} sx={{ 
          '&:hover': { backgroundColor: 'action.hover' },
          transition: 'all 0.2s ease'
        }}>
          <CloseIcon />
        </IconButton>
      </Box>

      <Divider sx={{ my: 2 }} />

      {/* Metadata */}
      <Box sx={{ mb: 2 }}>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
          <AccessTimeIcon sx={{ fontSize: 16, mr: 0.5, verticalAlign: 'middle' }} />
          Created: {formatDate(node.metadata.createdAt)}
        </Typography>
        <Typography variant="body2" color="text.secondary">
          <AccessTimeIcon sx={{ fontSize: 16, mr: 0.5, verticalAlign: 'middle' }} />
          Updated: {formatDate(node.metadata.lastUpdated)}
        </Typography>
      </Box>

      {/* Content Preview */}
      {node.properties.content && (
        <>
          <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 1 }}>
            Content Preview
          </Typography>
          <Typography variant="body2" sx={{ mb: 2, color: 'text.secondary' }}>
            {node.properties.content}...
          </Typography>
        </>
      )}

      {/* Properties */}
      {node.properties.tags && node.properties.tags.length > 0 && (
        <>
          <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 1 }}>
            Tags
          </Typography>
          <Stack direction="row" spacing={1} flexWrap="wrap" sx={{ mb: 2 }}>
            {node.properties.tags.map((tag: string, index: number) => (
              <Chip
                key={index}
                label={tag}
                size="small"
                variant="outlined"
                sx={{ mb: 1 }}
              />
            ))}
          </Stack>
        </>
      )}

      {/* Metrics */}
      <Box sx={{ backgroundColor: 'action.hover', p: 1.5, borderRadius: 1, mb: 2 }}>
        <Typography variant="body2">
          <strong>Relevance Score:</strong> {(node.metadata.strength * 100).toFixed(0)}%
        </Typography>
        <Typography variant="body2">
          <strong>Node Size:</strong> {node.size.toFixed(1)}
        </Typography>
        {node.metadata.cluster && (
          <Typography variant="body2">
            <strong>Cluster:</strong> {node.metadata.cluster}
          </Typography>
        )}
      </Box>

      {/* Actions */}
      <Stack spacing={1.5}>
        {node.properties.url && (
          <Button
            size="medium"
            startIcon={<OpenInNewIcon />}
            onClick={() => window.open(node.properties.url, '_blank')}
            fullWidth
            variant="outlined"
            sx={{ 
              py: 1,
              fontWeight: 600,
              '&:hover': { 
                backgroundColor: 'primary.main',
                color: 'white',
                borderColor: 'primary.main'
              },
              transition: 'all 0.2s ease'
            }}
          >
            Open in Notion
          </Button>
        )}
        
        <Button
          size="medium"
          startIcon={<AccountTreeIcon />}
          onClick={() => onShowConnections?.(node.id)}
          fullWidth
          variant="contained"
          color="primary"
          sx={{ 
            py: 1,
            fontWeight: 600,
            boxShadow: 2,
            '&:hover': { 
              boxShadow: 4,
              transform: 'translateY(-1px)'
            },
            transition: 'all 0.2s ease'
          }}
        >
          Show Connections
        </Button>
      </Stack>
      </Paper>
    </Slide>
  );
};

export default NodeInfoPanel;