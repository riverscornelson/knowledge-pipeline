import React, { useState, useEffect } from 'react';
import {
  Box,
  Paper,
  Typography,
  TextField,
  Button,
  Grid,
  Alert,
  IconButton,
  InputAdornment,
  Switch,
  FormControlLabel,
  Divider,
  Tabs,
  Tab,
  Chip,
  CircularProgress,
  Tooltip,
} from '@mui/material';
import {
  Save as SaveIcon,
  Visibility as VisibilityIcon,
  VisibilityOff as VisibilityOffIcon,
  CheckCircle as CheckIcon,
  Error as ErrorIcon,
  FolderOpen as FolderIcon,
  Refresh as RefreshIcon,
  ContentCopy as CopyIcon,
} from '@mui/icons-material';
import { PipelineConfiguration, IPCChannel, ServiceTestResult, ValidationError } from '../../shared/types';

interface TabPanelProps {
  children?: React.ReactNode;
  index: number;
  value: number;
}

function TabPanel(props: TabPanelProps) {
  const { children, value, index, ...other } = props;
  return (
    <div role="tabpanel" hidden={value !== index} {...other}>
      {value === index && <Box sx={{ py: 3 }}>{children}</Box>}
    </div>
  );
}

function Configuration() {
  const [config, setConfig] = useState<PipelineConfiguration>({
    notionToken: '',
    notionDatabaseId: '',
    openaiApiKey: '',
    googleServiceAccountPath: '',
  });
  const [showSecrets, setShowSecrets] = useState<{ [key: string]: boolean }>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResults, setTestResults] = useState<ServiceTestResult[]>([]);
  const [errors, setErrors] = useState<ValidationError[]>([]);
  const [successMessage, setSuccessMessage] = useState('');
  const [tabValue, setTabValue] = useState(0);

  useEffect(() => {
    loadConfiguration();
  }, []);

  const loadConfiguration = async () => {
    try {
      const savedConfig = await window.electron.ipcRenderer.invoke(IPCChannel.CONFIG_LOAD);
      if (savedConfig) {
        setConfig(savedConfig);
      }
    } catch (error) {
      console.error('Failed to load configuration:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    setErrors([]);
    setSuccessMessage('');

    try {
      const validationErrors = validateConfiguration();
      if (validationErrors.length > 0) {
        setErrors(validationErrors);
        setSaving(false);
        return;
      }

      await window.electron.ipcRenderer.invoke(IPCChannel.CONFIG_SAVE, config);
      setSuccessMessage('Configuration saved successfully!');
      setTimeout(() => setSuccessMessage(''), 3000);
    } catch (error) {
      setErrors([{ field: 'general', message: 'Failed to save configuration' }]);
    } finally {
      setSaving(false);
    }
  };

  const handleTest = async () => {
    setTesting(true);
    setTestResults([]);

    try {
      const results = await window.electron.ipcRenderer.invoke(IPCChannel.CONFIG_TEST, config);
      setTestResults(results);
    } catch (error) {
      console.error('Failed to test services:', error);
    } finally {
      setTesting(false);
    }
  };

  const validateConfiguration = (): ValidationError[] => {
    const errors: ValidationError[] = [];

    if (!config.notionToken) {
      errors.push({ field: 'notionToken', message: 'Notion token is required' });
    }
    if (!config.notionDatabaseId) {
      errors.push({ field: 'notionDatabaseId', message: 'Notion database ID is required' });
    }
    if (!config.openaiApiKey) {
      errors.push({ field: 'openaiApiKey', message: 'OpenAI API key is required' });
    }
    if (!config.googleServiceAccountPath) {
      errors.push({ field: 'googleServiceAccountPath', message: 'Google service account path is required' });
    }

    return errors;
  };

  const handleFieldChange = (field: keyof PipelineConfiguration, value: any) => {
    setConfig({ ...config, [field]: value });
    // Clear field-specific error when user starts typing
    setErrors(errors.filter(e => e.field !== field));
  };

  const toggleSecretVisibility = (field: string) => {
    setShowSecrets({ ...showSecrets, [field]: !showSecrets[field] });
  };

  const selectServiceAccountFile = async () => {
    const result = await window.electron.dialog.showOpenDialog({
      properties: ['openFile'],
      filters: [{ name: 'JSON files', extensions: ['json'] }],
    });

    if (!result.canceled && result.filePaths.length > 0) {
      handleFieldChange('googleServiceAccountPath', result.filePaths[0]);
    }
  };

  const copyToClipboard = (text: string) => {
    window.electron.clipboard.writeText(text);
  };

  const getFieldError = (field: string): string | undefined => {
    return errors.find(e => e.field === field)?.message;
  };

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box className="fade-in">
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h4" sx={{ fontWeight: 600 }}>
          Configuration
        </Typography>
        <Box sx={{ display: 'flex', gap: 2 }}>
          <Button
            variant="outlined"
            startIcon={testing ? <CircularProgress size={16} /> : <RefreshIcon />}
            onClick={handleTest}
            disabled={testing || saving}
          >
            Test Services
          </Button>
          <Button
            variant="contained"
            startIcon={saving ? <CircularProgress size={16} /> : <SaveIcon />}
            onClick={handleSave}
            disabled={saving || testing}
          >
            Save Configuration
          </Button>
        </Box>
      </Box>

      {successMessage && (
        <Alert severity="success" sx={{ mb: 3 }} onClose={() => setSuccessMessage('')}>
          {successMessage}
        </Alert>
      )}

      {errors.length > 0 && errors.some(e => e.field === 'general') && (
        <Alert severity="error" sx={{ mb: 3 }}>
          {errors.find(e => e.field === 'general')?.message}
        </Alert>
      )}

      {testResults.length > 0 && (
        <Paper sx={{ p: 2, mb: 3 }}>
          <Typography variant="h6" sx={{ mb: 2 }}>Service Test Results</Typography>
          <Grid container spacing={2}>
            {testResults.map((result) => (
              <Grid item xs={12} md={4} key={result.service}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  {result.success ? (
                    <CheckIcon color="success" />
                  ) : (
                    <ErrorIcon color="error" />
                  )}
                  <Typography variant="body1" sx={{ textTransform: 'capitalize' }}>
                    {result.service}
                  </Typography>
                  <Chip
                    label={result.success ? 'Connected' : 'Failed'}
                    size="small"
                    color={result.success ? 'success' : 'error'}
                  />
                </Box>
                <Typography variant="body2" color="text.secondary" sx={{ mt: 1, ml: 4 }}>
                  {result.message}
                </Typography>
              </Grid>
            ))}
          </Grid>
        </Paper>
      )}

      <Paper sx={{ p: 3 }}>
        <Tabs value={tabValue} onChange={(_, newValue) => setTabValue(newValue)} sx={{ mb: 3 }}>
          <Tab label="Services" />
          <Tab label="Features" />
          <Tab label="Performance" />
        </Tabs>

        <TabPanel value={tabValue} index={0}>
          <Grid container spacing={3}>
            {/* Notion Configuration */}
            <Grid item xs={12}>
              <Typography variant="h6" sx={{ mb: 2 }}>Notion Integration</Typography>
              <Divider sx={{ mb: 3 }} />
            </Grid>
            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                label="Notion API Token"
                value={config.notionToken}
                onChange={(e) => handleFieldChange('notionToken', e.target.value)}
                error={!!getFieldError('notionToken')}
                helperText={getFieldError('notionToken') || 'Your Notion integration token'}
                type={showSecrets.notionToken ? 'text' : 'password'}
                InputProps={{
                  endAdornment: (
                    <InputAdornment position="end">
                      <IconButton onClick={() => toggleSecretVisibility('notionToken')} edge="end">
                        {showSecrets.notionToken ? <VisibilityOffIcon /> : <VisibilityIcon />}
                      </IconButton>
                    </InputAdornment>
                  ),
                }}
              />
            </Grid>
            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                label="Notion Database ID"
                value={config.notionDatabaseId}
                onChange={(e) => handleFieldChange('notionDatabaseId', e.target.value)}
                error={!!getFieldError('notionDatabaseId')}
                helperText={getFieldError('notionDatabaseId') || 'The ID of your Notion database'}
                InputProps={{
                  endAdornment: (
                    <InputAdornment position="end">
                      <Tooltip title="Copy to clipboard">
                        <IconButton onClick={() => copyToClipboard(config.notionDatabaseId)} edge="end">
                          <CopyIcon />
                        </IconButton>
                      </Tooltip>
                    </InputAdornment>
                  ),
                }}
              />
            </Grid>

            {/* OpenAI Configuration */}
            <Grid item xs={12}>
              <Typography variant="h6" sx={{ mb: 2, mt: 2 }}>OpenAI Integration</Typography>
              <Divider sx={{ mb: 3 }} />
            </Grid>
            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                label="OpenAI API Key"
                value={config.openaiApiKey}
                onChange={(e) => handleFieldChange('openaiApiKey', e.target.value)}
                error={!!getFieldError('openaiApiKey')}
                helperText={getFieldError('openaiApiKey') || 'Your OpenAI API key'}
                type={showSecrets.openaiApiKey ? 'text' : 'password'}
                InputProps={{
                  endAdornment: (
                    <InputAdornment position="end">
                      <IconButton onClick={() => toggleSecretVisibility('openaiApiKey')} edge="end">
                        {showSecrets.openaiApiKey ? <VisibilityOffIcon /> : <VisibilityIcon />}
                      </IconButton>
                    </InputAdornment>
                  ),
                }}
              />
            </Grid>
            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                label="OpenAI Model"
                value={config.openaiModel || 'gpt-4-turbo-preview'}
                onChange={(e) => handleFieldChange('openaiModel', e.target.value)}
                helperText="Model to use for AI processing"
              />
            </Grid>

            {/* Google Drive Configuration */}
            <Grid item xs={12}>
              <Typography variant="h6" sx={{ mb: 2, mt: 2 }}>Google Drive Integration</Typography>
              <Divider sx={{ mb: 3 }} />
            </Grid>
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Service Account JSON Path"
                value={config.googleServiceAccountPath}
                onChange={(e) => handleFieldChange('googleServiceAccountPath', e.target.value)}
                error={!!getFieldError('googleServiceAccountPath')}
                helperText={getFieldError('googleServiceAccountPath') || 'Path to your Google service account JSON file'}
                InputProps={{
                  endAdornment: (
                    <InputAdornment position="end">
                      <IconButton onClick={selectServiceAccountFile} edge="end">
                        <FolderIcon />
                      </IconButton>
                    </InputAdornment>
                  ),
                }}
              />
            </Grid>
            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                label="Drive Folder Name"
                value={config.driveFolderName || ''}
                onChange={(e) => handleFieldChange('driveFolderName', e.target.value)}
                helperText="Optional: Specific folder name to search"
              />
            </Grid>
            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                label="Drive Folder ID"
                value={config.driveFolderId || ''}
                onChange={(e) => handleFieldChange('driveFolderId', e.target.value)}
                helperText="Optional: Specific folder ID to search"
              />
            </Grid>
          </Grid>
        </TabPanel>

        <TabPanel value={tabValue} index={1}>
          <Grid container spacing={3}>
            <Grid item xs={12} md={6}>
              <FormControlLabel
                control={
                  <Switch
                    checked={config.useEnhancedFormatting || false}
                    onChange={(e) => handleFieldChange('useEnhancedFormatting', e.target.checked)}
                  />
                }
                label="Enhanced Formatting"
              />
              <Typography variant="body2" color="text.secondary" sx={{ ml: 4 }}>
                Use advanced formatting for better readability
              </Typography>
            </Grid>
            <Grid item xs={12} md={6}>
              <FormControlLabel
                control={
                  <Switch
                    checked={config.usePromptAttribution || false}
                    onChange={(e) => handleFieldChange('usePromptAttribution', e.target.checked)}
                  />
                }
                label="Prompt Attribution"
              />
              <Typography variant="body2" color="text.secondary" sx={{ ml: 4 }}>
                Track which prompts generated each insight
              </Typography>
            </Grid>
            <Grid item xs={12} md={6}>
              <FormControlLabel
                control={
                  <Switch
                    checked={config.enableExecutiveDashboard || false}
                    onChange={(e) => handleFieldChange('enableExecutiveDashboard', e.target.checked)}
                  />
                }
                label="Executive Dashboard"
              />
              <Typography variant="body2" color="text.secondary" sx={{ ml: 4 }}>
                Generate executive-level summaries
              </Typography>
            </Grid>
            <Grid item xs={12} md={6}>
              <FormControlLabel
                control={
                  <Switch
                    checked={config.mobileOptimization || false}
                    onChange={(e) => handleFieldChange('mobileOptimization', e.target.checked)}
                  />
                }
                label="Mobile Optimization"
              />
              <Typography variant="body2" color="text.secondary" sx={{ ml: 4 }}>
                Optimize content for mobile viewing
              </Typography>
            </Grid>
            <Grid item xs={12} md={6}>
              <FormControlLabel
                control={
                  <Switch
                    checked={config.enableWebSearch || false}
                    onChange={(e) => handleFieldChange('enableWebSearch', e.target.checked)}
                  />
                }
                label="Web Search Enhancement"
              />
              <Typography variant="body2" color="text.secondary" sx={{ ml: 4 }}>
                Enhance insights with web search results
              </Typography>
            </Grid>
          </Grid>
        </TabPanel>

        <TabPanel value={tabValue} index={2}>
          <Grid container spacing={3}>
            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                label="Rate Limit Delay (ms)"
                type="number"
                value={config.rateLimitDelay || 1000}
                onChange={(e) => handleFieldChange('rateLimitDelay', parseInt(e.target.value))}
                helperText="Delay between API calls to avoid rate limits"
                inputProps={{ min: 0, max: 10000, step: 100 }}
              />
            </Grid>
            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                label="Processing Timeout (ms)"
                type="number"
                value={config.processingTimeout || 60000}
                onChange={(e) => handleFieldChange('processingTimeout', parseInt(e.target.value))}
                helperText="Maximum time for processing a single document"
                inputProps={{ min: 10000, max: 300000, step: 1000 }}
              />
            </Grid>
          </Grid>
        </TabPanel>
      </Paper>
    </Box>
  );
}

export default Configuration;