import React, { useState, useCallback } from 'react';
import {
  Menu,
  MenuItem,
  ListItemIcon,
  ListItemText,
  Divider,
  Typography,
  Box,
} from '@mui/material';
import {
  OpenInNew as OpenIcon,
  ContentCopy as CopyIcon,
  Share as ShareIcon,
  Bookmark as BookmarkIcon,
  Timeline as TimelineIcon,
  Hub as ConnectionsIcon,
  Analytics as AnalyticsIcon,
  Label as LabelIcon,
  Delete as DeleteIcon,
  AddCircle as AddIcon,
  FolderOpen as FolderIcon,
} from '@mui/icons-material';
import { GraphNode } from '../types';

interface NodeInteractionsProps {
  node: GraphNode | null;
  anchorEl: HTMLElement | null;
  open: boolean;
  onClose: () => void;
  onOpenInDrive: (node: GraphNode) => void;
  onOpenInNotion: (node: GraphNode) => void;
  onViewConnections: (node: GraphNode) => void;
  onAnalyzePath: (node: GraphNode) => void;
  onAddAnnotation: (node: GraphNode) => void;
  onExportSubgraph: (node: GraphNode) => void;
  onShare: (node: GraphNode) => void;
}

export const NodeInteractions: React.FC<NodeInteractionsProps> = ({
  node,
  anchorEl,
  open,
  onClose,
  onOpenInDrive,
  onOpenInNotion,
  onViewConnections,
  onAnalyzePath,
  onAddAnnotation,
  onExportSubgraph,
  onShare,
}) => {
  const [bookmarked, setBookmarked] = useState(false);

  const handleAction = useCallback(
    (action: (node: GraphNode) => void) => {
      if (node) {
        action(node);
        onClose();
      }
    },
    [node, onClose]
  );

  const handleCopyId = useCallback(() => {
    if (node) {
      navigator.clipboard.writeText(node.id);
      onClose();
    }
  }, [node, onClose]);

  const handleBookmark = useCallback(() => {
    setBookmarked(!bookmarked);
    // In real implementation, this would persist the bookmark
    onClose();
  }, [bookmarked, onClose]);

  if (!node) return null;

  return (
    <Menu
      anchorEl={anchorEl}
      open={open}
      onClose={onClose}
      PaperProps={{
        elevation: 8,
        sx: {
          minWidth: 280,
          maxWidth: 320,
          '& .MuiMenuItem-root': {
            borderRadius: 1,
            mx: 0.5,
            '&:hover': {
              backgroundColor: 'action.hover',
            },
          },
        },
      }}
    >
      {/* Node Info Header */}
      <Box sx={{ px: 2, py: 1.5, backgroundColor: 'grey.50' }}>
        <Typography variant="subtitle2" noWrap sx={{ fontWeight: 600 }}>
          {node.title}
        </Typography>
        <Typography variant="caption" color="text.secondary">
          {node.type} • {node.connections.length} connections
        </Typography>
      </Box>

      <Divider />

      {/* Primary Actions */}
      <MenuItem onClick={() => handleAction(onOpenInDrive)}>
        <ListItemIcon>
          <FolderIcon fontSize="small" />
        </ListItemIcon>
        <ListItemText primary="Open in Google Drive" />
      </MenuItem>

      <MenuItem onClick={() => handleAction(onOpenInNotion)}>
        <ListItemIcon>
          <OpenIcon fontSize="small" />
        </ListItemIcon>
        <ListItemText primary="View in Notion" />
      </MenuItem>

      <Divider sx={{ my: 0.5 }} />

      {/* Analysis Actions */}
      <MenuItem onClick={() => handleAction(onViewConnections)}>
        <ListItemIcon>
          <ConnectionsIcon fontSize="small" />
        </ListItemIcon>
        <ListItemText 
          primary="View Connections" 
          secondary={`${node.connections.length} related documents`}
        />
      </MenuItem>

      <MenuItem onClick={() => handleAction(onAnalyzePath)}>
        <ListItemIcon>
          <TimelineIcon fontSize="small" />
        </ListItemIcon>
        <ListItemText primary="Analyze Paths" secondary="Find connections to other nodes" />
      </MenuItem>

      <MenuItem onClick={() => handleAction(onExportSubgraph)}>
        <ListItemIcon>
          <AnalyticsIcon fontSize="small" />
        </ListItemIcon>
        <ListItemText primary="Export Subgraph" secondary="Export this node and connections" />
      </MenuItem>

      <Divider sx={{ my: 0.5 }} />

      {/* Annotation Actions */}
      <MenuItem onClick={() => handleAction(onAddAnnotation)}>
        <ListItemIcon>
          <AddIcon fontSize="small" />
        </ListItemIcon>
        <ListItemText primary="Add Annotation" secondary="Add personal notes" />
      </MenuItem>

      <MenuItem onClick={handleBookmark}>
        <ListItemIcon>
          <BookmarkIcon fontSize="small" color={bookmarked ? 'primary' : 'inherit'} />
        </ListItemIcon>
        <ListItemText 
          primary={bookmarked ? "Remove Bookmark" : "Add Bookmark"} 
        />
      </MenuItem>

      {node.metadata.tags && node.metadata.tags.length > 0 && (
        <MenuItem disabled>
          <ListItemIcon>
            <LabelIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText 
            primary="Tags" 
            secondary={node.metadata.tags.slice(0, 3).join(', ')}
          />
        </MenuItem>
      )}

      <Divider sx={{ my: 0.5 }} />

      {/* Utility Actions */}
      <MenuItem onClick={() => handleAction(onShare)}>
        <ListItemIcon>
          <ShareIcon fontSize="small" />
        </ListItemIcon>
        <ListItemText primary="Share" />
      </MenuItem>

      <MenuItem onClick={handleCopyId}>
        <ListItemIcon>
          <CopyIcon fontSize="small" />
        </ListItemIcon>
        <ListItemText primary="Copy ID" />
      </MenuItem>
    </Menu>
  );
};

export default NodeInteractions;