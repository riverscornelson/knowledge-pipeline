"""
Test suite for CLI functionality (run_pipeline.py).
"""
import sys
import argparse
import pytest
from unittest.mock import Mock, patch, MagicMock
from pathlib import Path

# Add src to path for imports
sys.path.insert(0, str(Path(__file__).parent.parent))

from scripts.run_pipeline import main


class TestCLI:
    """Test the CLI functionality of run_pipeline.py."""
    
    def test_argument_parsing_defaults(self, mocker):
        """Test default argument parsing."""
        mocker.patch('sys.argv', ['run_pipeline.py'])
        
        with patch('scripts.run_pipeline.PipelineConfig') as mock_config, \
             patch('scripts.run_pipeline.NotionClient') as mock_notion, \
             patch('scripts.run_pipeline.DriveIngester') as mock_ingester, \
             patch('scripts.run_pipeline.setup_logger') as mock_logger:
            
            mock_logger.return_value = Mock()
            mock_config.from_env.return_value = Mock()
            mock_notion.return_value = Mock()
            ingester_instance = Mock()
            ingester_instance.ingest.return_value = {"new": 1, "existing": 0}
            mock_ingester.return_value = ingester_instance
            
            # Mock enrichment processor (imported inside main function)
            with patch('src.enrichment.pipeline_processor.PipelineProcessor') as mock_processor:
                processor_instance = Mock()
                processor_instance.process_batch.return_value = {"processed": 1}
                mock_processor.return_value = processor_instance
                
                main()
                
                # Verify default behavior
                ingester_instance.ingest.assert_called_once()
                processor_instance.process_batch.assert_called_once()
    
    def test_dry_run_mode(self, mocker):
        """Test dry run mode prevents actual operations."""
        mocker.patch('sys.argv', ['run_pipeline.py', '--dry-run'])
        
        with patch('scripts.run_pipeline.PipelineConfig') as mock_config, \
             patch('scripts.run_pipeline.NotionClient') as mock_notion, \
             patch('scripts.run_pipeline.DriveIngester') as mock_ingester, \
             patch('scripts.run_pipeline.setup_logger') as mock_logger:
            
            mock_logger.return_value = Mock()
            mock_config.from_env.return_value = Mock()
            mock_notion.return_value = Mock()
            ingester_instance = Mock()
            mock_ingester.return_value = ingester_instance
            
            main()
            
            # Verify dry run behavior
            ingester_instance.ingest.assert_not_called()
    
    def test_skip_enrichment(self, mocker):
        """Test skipping enrichment phase."""
        mocker.patch('sys.argv', ['run_pipeline.py', '--skip-enrichment'])
        
        with patch('scripts.run_pipeline.PipelineConfig') as mock_config, \
             patch('scripts.run_pipeline.NotionClient') as mock_notion, \
             patch('scripts.run_pipeline.DriveIngester') as mock_ingester, \
             patch('scripts.run_pipeline.setup_logger') as mock_logger:
            
            mock_logger.return_value = Mock()
            mock_config.from_env.return_value = Mock()
            mock_notion.return_value = Mock()
            ingester_instance = Mock()
            ingester_instance.ingest.return_value = {"new": 1}
            mock_ingester.return_value = ingester_instance
            
            # Mock enrichment processor to verify it's not called
            with patch('scripts.run_pipeline.PipelineProcessor') as mock_processor:
                main()
                
                # Verify enrichment is skipped
                mock_processor.assert_not_called()
    
    def test_process_local_pdfs(self, mocker):
        """Test local PDF processing."""
        mocker.patch('sys.argv', ['run_pipeline.py', '--process-local'])
        
        with patch('scripts.run_pipeline.PipelineConfig') as mock_config, \
             patch('scripts.run_pipeline.NotionClient') as mock_notion, \
             patch('scripts.run_pipeline.DriveIngester') as mock_ingester, \
             patch('scripts.run_pipeline.setup_logger') as mock_logger, \
             patch('scripts.run_pipeline.process_local_pdfs') as mock_local:
            
            mock_logger.return_value = Mock()
            mock_config.from_env.return_value = Mock()
            mock_notion.return_value = Mock()
            ingester_instance = Mock()
            ingester_instance.ingest.return_value = {"new": 1}
            mock_ingester.return_value = ingester_instance
            mock_local.return_value = {"uploaded": 2, "skipped": 1}
            
            with patch('scripts.run_pipeline.PipelineProcessor') as mock_processor:
                processor_instance = Mock()
                processor_instance.process_batch.return_value = {"processed": 1}
                mock_processor.return_value = processor_instance
                
                main()
                
                # Verify local processing is called
                mock_local.assert_called_once()
    
    def test_process_specific_files(self, mocker):
        """Test processing specific Drive file IDs."""
        mocker.patch('sys.argv', ['run_pipeline.py', '--process-specific-files', '--drive-file-ids', 'file1,file2,file3'])
        
        with patch('scripts.run_pipeline.PipelineConfig') as mock_config, \
             patch('scripts.run_pipeline.NotionClient') as mock_notion, \
             patch('scripts.run_pipeline.DriveIngester') as mock_ingester, \
             patch('scripts.run_pipeline.setup_logger') as mock_logger:
            
            mock_logger.return_value = Mock()
            mock_config.from_env.return_value = Mock()
            mock_notion.return_value = Mock()
            ingester_instance = Mock()
            ingester_instance.process_specific_files.return_value = {"processed": 3}
            mock_ingester.return_value = ingester_instance
            
            with patch('scripts.run_pipeline.PipelineProcessor') as mock_processor:
                processor_instance = Mock()
                processor_instance.process_batch.return_value = {"processed": 3}
                mock_processor.return_value = processor_instance
                
                main()
                
                # Verify specific files processing
                ingester_instance.process_specific_files.assert_called_once_with(['file1', 'file2', 'file3'])
                ingester_instance.ingest.assert_not_called()
    
    def test_configuration_error(self, mocker):
        """Test handling of configuration errors."""
        mocker.patch('sys.argv', ['run_pipeline.py'])
        
        with patch('scripts.run_pipeline.PipelineConfig') as mock_config, \
             patch('scripts.run_pipeline.setup_logger') as mock_logger:
            
            mock_logger.return_value = Mock()
            mock_config.from_env.side_effect = Exception("Configuration error")
            
            with pytest.raises(SystemExit) as exc_info:
                main()
            
            assert exc_info.value.code == 1
    
    def test_ingestion_error(self, mocker):
        """Test handling of ingestion errors."""
        mocker.patch('sys.argv', ['run_pipeline.py'])
        
        with patch('scripts.run_pipeline.PipelineConfig') as mock_config, \
             patch('scripts.run_pipeline.NotionClient') as mock_notion, \
             patch('scripts.run_pipeline.DriveIngester') as mock_ingester, \
             patch('scripts.run_pipeline.setup_logger') as mock_logger:
            
            mock_logger.return_value = Mock()
            mock_config.from_env.return_value = Mock()
            mock_notion.return_value = Mock()
            ingester_instance = Mock()
            ingester_instance.ingest.side_effect = Exception("Ingestion failed")
            mock_ingester.return_value = ingester_instance
            
            with pytest.raises(SystemExit) as exc_info:
                main()
            
            assert exc_info.value.code == 1
    
    def test_enrichment_error(self, mocker):
        """Test handling of enrichment errors."""
        mocker.patch('sys.argv', ['run_pipeline.py'])
        
        with patch('scripts.run_pipeline.PipelineConfig') as mock_config, \
             patch('scripts.run_pipeline.NotionClient') as mock_notion, \
             patch('scripts.run_pipeline.DriveIngester') as mock_ingester, \
             patch('scripts.run_pipeline.setup_logger') as mock_logger:
            
            mock_logger.return_value = Mock()
            mock_config.from_env.return_value = Mock()
            mock_notion.return_value = Mock()
            ingester_instance = Mock()
            ingester_instance.ingest.return_value = {"new": 1}
            mock_ingester.return_value = ingester_instance
            
            with patch('scripts.run_pipeline.PipelineProcessor') as mock_processor:
                processor_instance = Mock()
                processor_instance.process_batch.side_effect = Exception("Enrichment failed")
                mock_processor.return_value = processor_instance
                
                with pytest.raises(SystemExit) as exc_info:
                    main()
                
                assert exc_info.value.code == 1
    
    def test_local_processing_dry_run(self, mocker):
        """Test local PDF processing in dry run mode."""
        mocker.patch('sys.argv', ['run_pipeline.py', '--process-local', '--dry-run'])
        
        with patch('scripts.run_pipeline.PipelineConfig') as mock_config, \
             patch('scripts.run_pipeline.NotionClient') as mock_notion, \
             patch('scripts.run_pipeline.DriveIngester') as mock_ingester, \
             patch('scripts.run_pipeline.setup_logger') as mock_logger, \
             patch('scripts.run_pipeline.process_local_pdfs') as mock_local:
            
            mock_logger.return_value = Mock()
            mock_config.from_env.return_value = Mock()
            mock_notion.return_value = Mock()
            ingester_instance = Mock()
            mock_ingester.return_value = ingester_instance
            
            main()
            
            # Verify local processing is skipped in dry run
            mock_local.assert_not_called()
    
    def test_argument_validation_specific_files_without_ids(self, mocker):
        """Test that specific files flag works without file IDs (falls back to normal)."""
        mocker.patch('sys.argv', ['run_pipeline.py', '--process-specific-files'])
        
        with patch('scripts.run_pipeline.PipelineConfig') as mock_config, \
             patch('scripts.run_pipeline.NotionClient') as mock_notion, \
             patch('scripts.run_pipeline.DriveIngester') as mock_ingester, \
             patch('scripts.run_pipeline.setup_logger') as mock_logger:
            
            mock_logger.return_value = Mock()
            mock_config.from_env.return_value = Mock()
            mock_notion.return_value = Mock()
            ingester_instance = Mock()
            ingester_instance.ingest.return_value = {"new": 1}
            mock_ingester.return_value = ingester_instance
            
            with patch('scripts.run_pipeline.PipelineProcessor') as mock_processor:
                processor_instance = Mock()
                processor_instance.process_batch.return_value = {"processed": 1}
                mock_processor.return_value = processor_instance
                
                main()
                
                # Should fall back to normal ingestion
                ingester_instance.ingest.assert_called_once()
                ingester_instance.process_specific_files.assert_not_called()


class TestMainPipelineFlow:
    """Test the main pipeline execution flow."""
    
    @pytest.fixture
    def mock_components(self, mocker):
        """Mock all pipeline components."""
        return {
            'config': mocker.Mock(),
            'notion': mocker.Mock(),
            'ingester': mocker.Mock(),
            'processor': mocker.Mock(),
            'logger': mocker.Mock()
        }
    
    def test_successful_complete_pipeline(self, mock_components, mocker):
        """Test successful execution of complete pipeline."""
        # Configure mocks
        mock_components['ingester'].ingest.return_value = {"new": 5, "existing": 10}
        mock_components['processor'].process_batch.return_value = {"processed": 5, "failed": 0}
        
        mocker.patch('sys.argv', ['run_pipeline.py'])
        
        with patch('scripts.run_pipeline.PipelineConfig') as mock_config_cls, \
             patch('scripts.run_pipeline.NotionClient') as mock_notion_cls, \
             patch('scripts.run_pipeline.DriveIngester') as mock_ingester_cls, \
             patch('scripts.run_pipeline.setup_logger') as mock_logger, \
             patch('src.enrichment.pipeline_processor.PipelineProcessor') as mock_processor_cls:
            
            mock_logger.return_value = mock_components['logger']
            mock_config_cls.from_env.return_value = mock_components['config']
            mock_notion_cls.return_value = mock_components['notion']
            mock_ingester_cls.return_value = mock_components['ingester']
            mock_processor_cls.return_value = mock_components['processor']
            
            main()
            
            # Verify full pipeline execution
            mock_config_cls.from_env.assert_called_once()
            mock_notion_cls.assert_called_once_with(mock_components['config'].notion)
            mock_ingester_cls.assert_called_once_with(mock_components['config'], mock_components['notion'])
            mock_components['ingester'].ingest.assert_called_once()
            mock_processor_cls.assert_called_once_with(mock_components['config'], mock_components['notion'])
            mock_components['processor'].process_batch.assert_called_once()
    
    def test_pipeline_stats_logging(self, mock_components, mocker):
        """Test that pipeline statistics are properly logged."""
        # Configure mocks with specific stats
        mock_components['ingester'].ingest.return_value = {"new": 3, "existing": 7, "errors": 1}
        mock_components['processor'].process_batch.return_value = {"processed": 3, "failed": 0}
        
        mocker.patch('sys.argv', ['run_pipeline.py'])
        
        with patch('scripts.run_pipeline.PipelineConfig') as mock_config_cls, \
             patch('scripts.run_pipeline.NotionClient') as mock_notion_cls, \
             patch('scripts.run_pipeline.DriveIngester') as mock_ingester_cls, \
             patch('scripts.run_pipeline.setup_logger') as mock_logger, \
             patch('src.enrichment.pipeline_processor.PipelineProcessor') as mock_processor_cls:
            
            mock_logger.return_value = mock_components['logger']
            mock_config_cls.from_env.return_value = mock_components['config']
            mock_notion_cls.return_value = mock_components['notion']
            mock_ingester_cls.return_value = mock_components['ingester']
            mock_processor_cls.return_value = mock_components['processor']
            
            main()
            
            # Check that stats are logged
            mock_components['logger'].info.assert_any_call(
                f"Drive ingestion complete: {{'new': 3, 'existing': 7, 'errors': 1}}"
            )
            mock_components['logger'].info.assert_any_call(
                f"Enrichment complete: {{'processed': 3, 'failed': 0}}"
            )