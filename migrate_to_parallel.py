"""
Migration utility for transitioning to parallel enrichment
Provides safe rollout with monitoring and rollback capabilities
"""
import os
import sys
import shutil
import subprocess
from datetime import datetime
from pathlib import Path

from logger import setup_logger

class MigrationManager:
    """Manages migration from sequential to parallel processing"""
    
    def __init__(self):
        self.logger = setup_logger("migration")
        self.backup_dir = Path("backups") / f"migration_{datetime.now().strftime('%Y%m%d_%H%M%S')}"
        self.pipeline_script = Path("pipeline.sh")
        
    def backup_current_state(self):
        """Backup current pipeline files"""
        self.logger.info("Creating backup of current pipeline state")
        
        files_to_backup = [
            "pipeline.sh",
            "enrich.py", 
            "enrich_rss.py"
        ]
        
        self.backup_dir.mkdir(parents=True, exist_ok=True)
        
        for file_path in files_to_backup:
            if Path(file_path).exists():
                shutil.copy2(file_path, self.backup_dir / file_path)
                self.logger.info(f"Backed up {file_path}")
        
        self.logger.info(f"Backup completed: {self.backup_dir}")
        return self.backup_dir
    
    def create_enhanced_pipeline(self):
        """Create enhanced pipeline script with gradual rollout"""
        enhanced_script = '''#!/bin/bash
# Enhanced Knowledge Pipeline with Parallel Processing Support
# Migration-safe with gradual rollout capabilities

set -e

# Configuration
ENABLE_PARALLEL=${ENABLE_PARALLEL:-false}
USE_ENHANCED=${USE_ENHANCED:-true}
LOG_DIR=${LOG_DIR:-logs}

# Create logs directory
mkdir -p "$LOG_DIR"

echo "🚀 Starting Enhanced Knowledge Pipeline"
echo "   Parallel processing: $ENABLE_PARALLEL"
echo "   Enhanced logging: $USE_ENHANCED"
echo "   Log directory: $LOG_DIR"

# Step 1: Ingest Google Drive PDFs
echo "📄 Step 1: Ingesting Google Drive PDFs..."
python3 ingest_drive.py

# Step 2: Capture RSS feeds
echo "📡 Step 2: Capturing RSS feeds..."
python3 capture_rss.py

# Step 3: Capture websites (Firecrawl)
echo "🌐 Step 3: Capturing websites..."
python3 capture_websites.py

# Step 4: Capture Gmail emails
echo "📧 Step 4: Capturing Gmail emails..."
python3 capture_emails.py

# Step 5: Enrich PDFs
echo "📊 Step 5: Enriching PDFs..."
if [ "$USE_ENHANCED" = "true" ]; then
    echo "   Using enhanced PDF enrichment with logging"
    python3 enrich_enhanced.py
else
    echo "   Using original PDF enrichment"
    python3 enrich.py
fi

# Step 6: Enrich RSS articles & websites
echo "📝 Step 6: Enriching RSS articles & websites..."
if [ "$USE_ENHANCED" = "true" ]; then
    echo "   Using enhanced RSS enrichment with logging"
    if [ "$ENABLE_PARALLEL" = "true" ]; then
        echo "   🚀 Parallel processing enabled"
        python3 enrich_rss_enhanced.py --parallel
    else
        echo "   Sequential processing (enhanced logging)"
        python3 enrich_rss_enhanced.py
    fi
else
    echo "   Using original RSS enrichment"
    python3 enrich_rss.py
fi

echo "✅ Enhanced Knowledge Pipeline completed!"
echo "📊 Check $LOG_DIR/pipeline.jsonl for detailed logs"
'''
        
        # Write enhanced pipeline
        enhanced_path = Path("pipeline_enhanced.sh")
        with open(enhanced_path, 'w') as f:
            f.write(enhanced_script)
        
        # Make executable
        enhanced_path.chmod(0o755)
        
        self.logger.info(f"Created enhanced pipeline: {enhanced_path}")
        return enhanced_path
    
    def test_enhanced_pipeline(self, dry_run=True):
        """Test enhanced pipeline functionality"""
        self.logger.info("Testing enhanced pipeline functionality")
        
        test_commands = [
            "python3 -c 'from logger import setup_logger; print(\"✅ Logger import successful\")'",
            "python3 -c 'from enrich_enhanced import EnhancedPDFEnricher; print(\"✅ Enhanced PDF enricher import successful\")'",
            "python3 -c 'from enrich_rss_enhanced import EnhancedEnricher; print(\"✅ Enhanced RSS enricher import successful\")'",
        ]
        
        # Test parallel import if available
        try:
            import asyncio
            test_commands.append(
                "python3 -c 'from enrich_parallel import ParallelEnricher; print(\"✅ Parallel enricher import successful\")'"
            )
        except ImportError:
            self.logger.warning("Asyncio not available, parallel processing will be disabled")
        
        all_passed = True
        for cmd in test_commands:
            try:
                result = subprocess.run(cmd, shell=True, capture_output=True, text=True, check=True)
                print(result.stdout.strip())
            except subprocess.CalledProcessError as e:
                self.logger.error(f"Test failed: {cmd}")
                self.logger.error(f"Error: {e.stderr}")
                all_passed = False
        
        if all_passed:
            self.logger.info("All tests passed ✅")
        else:
            self.logger.error("Some tests failed ❌")
            
        return all_passed
    
    def rollback(self, backup_dir: Path):
        """Rollback to previous state"""
        self.logger.info(f"Rolling back from backup: {backup_dir}")
        
        if not backup_dir.exists():
            self.logger.error(f"Backup directory not found: {backup_dir}")
            return False
        
        for backup_file in backup_dir.glob("*"):
            if backup_file.is_file():
                shutil.copy2(backup_file, backup_file.name)
                self.logger.info(f"Restored {backup_file.name}")
        
        self.logger.info("Rollback completed")
        return True
    
    def migrate_gradual(self):
        """Perform gradual migration with safety checks"""
        self.logger.info("Starting gradual migration to parallel processing")
        
        # Step 1: Backup
        backup_dir = self.backup_current_state()
        
        # Step 2: Test imports
        if not self.test_enhanced_pipeline():
            self.logger.error("Pre-migration tests failed. Aborting migration.")
            return False
        
        # Step 3: Create enhanced pipeline
        enhanced_pipeline = self.create_enhanced_pipeline()
        
        # Step 4: Set conservative defaults
        env_vars = {
            "USE_ENHANCED": "true",
            "ENABLE_PARALLEL": "false",  # Start with sequential
            "LOG_DIR": "logs",
            "PARALLEL_MAX_WORKERS": "3",  # Conservative
            "PARALLEL_RATE_LIMIT": "0.2"  # Conservative
        }
        
        env_file = Path(".env.migration")
        with open(env_file, 'w') as f:
            f.write("# Migration environment variables\n")
            for key, value in env_vars.items():
                f.write(f"{key}={value}\n")
        
        self.logger.info(f"Created migration environment file: {env_file}")
        
        print(f"""
🚀 Migration Setup Complete!

Next steps:
1. Review the enhanced pipeline: {enhanced_pipeline}
2. Test with enhanced logging (sequential):
   source .env.migration && ./pipeline_enhanced.sh

3. When ready, enable parallel processing:
   export ENABLE_PARALLEL=true && ./pipeline_enhanced.sh

4. Monitor logs in: logs/pipeline.jsonl

5. If issues occur, rollback with:
   python3 migrate_to_parallel.py --rollback {backup_dir}

Migration files created:
- {enhanced_pipeline} (new pipeline script)
- {env_file} (migration environment)
- {backup_dir}/ (backup of original files)
        """)
        
        return True
    
    def enable_parallel(self):
        """Enable parallel processing after successful testing"""
        self.logger.info("Enabling parallel processing")
        
        # Update environment
        env_file = Path(".env")
        env_content = ""
        
        if env_file.exists():
            with open(env_file, 'r') as f:
                env_content = f.read()
        
        # Add or update parallel settings
        parallel_vars = {
            "ENABLE_PARALLEL": "true",
            "PARALLEL_MAX_WORKERS": "5",
            "PARALLEL_RATE_LIMIT": "0.1"
        }
        
        for key, value in parallel_vars.items():
            if f"{key}=" in env_content:
                # Update existing
                import re
                env_content = re.sub(f"{key}=.*", f"{key}={value}", env_content)
            else:
                # Add new
                env_content += f"\n{key}={value}"
        
        with open(env_file, 'w') as f:
            f.write(env_content)
        
        self.logger.info("Parallel processing enabled in .env")
        print("✅ Parallel processing enabled!")
        print("Run ./pipeline_enhanced.sh to use parallel processing")

def main():
    if len(sys.argv) < 2:
        print("""
Migration Utility for Parallel Processing

Usage:
  python3 migrate_to_parallel.py migrate     # Perform gradual migration
  python3 migrate_to_parallel.py test        # Test enhanced functionality
  python3 migrate_to_parallel.py enable      # Enable parallel processing
  python3 migrate_to_parallel.py rollback    # Rollback to original
        """)
        return
    
    manager = MigrationManager()
    command = sys.argv[1]
    
    if command == "migrate":
        manager.migrate_gradual()
    elif command == "test":
        manager.test_enhanced_pipeline()
    elif command == "enable":
        manager.enable_parallel()
    elif command == "rollback":
        if len(sys.argv) > 2:
            backup_path = Path(sys.argv[2])
            manager.rollback(backup_path)
        else:
            print("Please specify backup directory path")
    else:
        print(f"Unknown command: {command}")

if __name__ == "__main__":
    main()