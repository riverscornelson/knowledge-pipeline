#!/usr/bin/env python3
"""
Migration script to transition from 3-prompt chain to optimized unified prompts.
Updates configuration, validates compatibility, and provides rollback capability.
"""
import os
import sys
import json
import yaml
import shutil
from pathlib import Path
from datetime import datetime
from typing import Dict, Any, List, Optional
import argparse

# Add src to path for imports
sys.path.insert(0, str(Path(__file__).parent.parent / "src"))

from utils.logging import setup_logger
from core.prompt_config_enhanced import EnhancedPromptConfig
from enrichment.enhanced_quality_validator import EnhancedQualityValidator


class OptimizedPromptMigrator:
    """Handles migration to optimized unified prompt system."""

    def __init__(self, dry_run: bool = False):
        """Initialize migrator."""
        self.dry_run = dry_run
        self.logger = setup_logger(__name__)
        self.backup_dir = Path("backups") / f"migration_{datetime.now().strftime('%Y%m%d_%H%M%S')}"
        self.config_dir = Path("config")
        self.src_dir = Path("src")

        # Migration tracking
        self.migration_log = []
        self.errors = []

    def run_migration(self) -> bool:
        """
        Execute the complete migration process.

        Returns:
            bool: True if migration successful, False otherwise
        """
        try:
            self.logger.info("🚀 Starting migration to optimized unified prompts")
            self.logger.info(f"Dry run mode: {self.dry_run}")

            # Step 1: Pre-migration validation
            if not self._validate_pre_migration():
                return False

            # Step 2: Create backups
            if not self._create_backups():
                return False

            # Step 3: Update configuration files
            if not self._update_configurations():
                return False

            # Step 4: Update source code
            if not self._update_source_code():
                return False

            # Step 5: Update environment variables
            if not self._update_environment_variables():
                return False

            # Step 6: Post-migration validation
            if not self._validate_post_migration():
                return False

            # Step 7: Generate migration report
            self._generate_migration_report()

            self.logger.info("✅ Migration completed successfully!")
            return True

        except Exception as e:
            self.logger.error(f"❌ Migration failed: {e}")
            self.errors.append(f"Migration error: {e}")
            return False

    def _validate_pre_migration(self) -> bool:
        """Validate system before migration."""
        self.logger.info("🔍 Validating pre-migration state...")

        # Check required files exist
        required_files = [
            "config/prompts.yaml",
            "src/formatters/prompt_aware_notion_formatter.py",
            "src/enrichment/quality_validator.py",
            "src/core/prompt_config_enhanced.py"
        ]

        for file_path in required_files:
            if not Path(file_path).exists():
                self.logger.error(f"Required file missing: {file_path}")
                self.errors.append(f"Missing file: {file_path}")
                return False

        # Check if optimized files already exist
        optimized_files = [
            "config/prompts-optimized.yaml",
            "src/formatters/optimized_notion_formatter.py",
            "src/enrichment/enhanced_quality_validator.py"
        ]

        existing_optimized = [f for f in optimized_files if Path(f).exists()]
        if existing_optimized:
            self.logger.warning(f"Optimized files already exist: {existing_optimized}")
            response = input("Continue migration? This will overwrite existing optimized files. (y/N): ")
            if response.lower() != 'y':
                return False

        # Validate current configuration
        try:
            current_config = EnhancedPromptConfig()
            stats = current_config.get_prompt_stats()
            self.logger.info(f"Current config stats: {stats}")
            self.migration_log.append(f"Pre-migration config: {stats}")
        except Exception as e:
            self.logger.error(f"Failed to validate current configuration: {e}")
            self.errors.append(f"Config validation error: {e}")
            return False

        self.logger.info("✅ Pre-migration validation passed")
        return True

    def _create_backups(self) -> bool:
        """Create backups of existing files."""
        if self.dry_run:
            self.logger.info("🔄 [DRY RUN] Would create backups...")
            return True

        self.logger.info(f"💾 Creating backups in {self.backup_dir}")

        try:
            self.backup_dir.mkdir(parents=True, exist_ok=True)

            # Backup configuration files
            config_backup = self.backup_dir / "config"
            config_backup.mkdir(exist_ok=True)

            for config_file in self.config_dir.glob("*.yaml"):
                shutil.copy2(config_file, config_backup)
                self.migration_log.append(f"Backed up: {config_file}")

            # Backup source files
            src_backup = self.backup_dir / "src"
            src_backup.mkdir(exist_ok=True)

            backup_paths = [
                "formatters/prompt_aware_notion_formatter.py",
                "enrichment/quality_validator.py",
                "core/prompt_config_enhanced.py"
            ]

            for backup_path in backup_paths:
                src_file = self.src_dir / backup_path
                if src_file.exists():
                    dest_file = src_backup / backup_path
                    dest_file.parent.mkdir(parents=True, exist_ok=True)
                    shutil.copy2(src_file, dest_file)
                    self.migration_log.append(f"Backed up: {src_file}")

            # Backup environment file if exists
            env_file = Path(".env")
            if env_file.exists():
                shutil.copy2(env_file, self.backup_dir)
                self.migration_log.append(f"Backed up: {env_file}")

            self.logger.info(f"✅ Backups created successfully in {self.backup_dir}")
            return True

        except Exception as e:
            self.logger.error(f"❌ Backup creation failed: {e}")
            self.errors.append(f"Backup error: {e}")
            return False

    def _update_configurations(self) -> bool:
        """Update configuration files for optimized system."""
        if self.dry_run:
            self.logger.info("🔄 [DRY RUN] Would update configurations...")
            return True

        self.logger.info("⚙️ Updating configuration files...")

        try:
            # 1. Load existing prompts.yaml
            with open("config/prompts.yaml", 'r') as f:
                current_config = yaml.safe_load(f)

            # 2. Create optimized configuration
            optimized_config = self._create_optimized_config(current_config)

            # 3. Write prompts-optimized.yaml (should already exist from implementation)
            optimized_path = Path("config/prompts-optimized.yaml")
            if not optimized_path.exists():
                with open(optimized_path, 'w') as f:
                    yaml.dump(optimized_config, f, default_flow_style=False)
                self.migration_log.append("Created prompts-optimized.yaml")

            # 4. Update main prompts.yaml to reference optimized config
            self._update_main_config(current_config)

            self.logger.info("✅ Configuration files updated")
            return True

        except Exception as e:
            self.logger.error(f"❌ Configuration update failed: {e}")
            self.errors.append(f"Config update error: {e}")
            return False

    def _create_optimized_config(self, current_config: Dict[str, Any]) -> Dict[str, Any]:
        """Create optimized configuration from current config."""
        # This would normally be complex, but since we've already created
        # the optimized config file, we'll load it instead
        try:
            with open("config/prompts-optimized.yaml", 'r') as f:
                return yaml.safe_load(f)
        except FileNotFoundError:
            # Fallback: create basic optimized config
            return {
                "defaults": {
                    "unified_analyzer": {
                        "system": "Unified analysis prompt...",
                        "temperature": 0.4,
                        "web_search": True,
                        "quality_threshold": 8.5,
                        "max_blocks": 15
                    }
                },
                "optimization": {
                    "max_total_processing_time": 30,
                    "quality_gate_threshold": 8.5,
                    "unified_prompt_enabled": True
                }
            }

    def _update_main_config(self, current_config: Dict[str, Any]) -> None:
        """Update main prompts.yaml to support optimized mode."""
        # Add optimization flags to current config
        current_config.setdefault("optimization", {})
        current_config["optimization"].update({
            "unified_prompt_enabled": True,
            "quality_gate_threshold": 8.5,
            "max_processing_time": 30,
            "max_notion_blocks": 15
        })

        # Write updated config
        with open("config/prompts.yaml", 'w') as f:
            yaml.dump(current_config, f, default_flow_style=False)

        self.migration_log.append("Updated main prompts.yaml with optimization flags")

    def _update_source_code(self) -> bool:
        """Update source code files for optimized system."""
        if self.dry_run:
            self.logger.info("🔄 [DRY RUN] Would update source code...")
            return True

        self.logger.info("💻 Updating source code...")

        try:
            # Update imports and references in key files
            updates = [
                {
                    "file": "src/formatters/prompt_aware_notion_formatter.py",
                    "updates": self._get_formatter_updates()
                },
                {
                    "file": "src/enrichment/quality_validator.py",
                    "updates": self._get_validator_updates()
                },
                {
                    "file": "src/core/prompt_config_enhanced.py",
                    "updates": self._get_config_updates()
                }
            ]

            for update in updates:
                if not self._apply_code_updates(update["file"], update["updates"]):
                    return False

            self.logger.info("✅ Source code updated")
            return True

        except Exception as e:
            self.logger.error(f"❌ Source code update failed: {e}")
            self.errors.append(f"Source update error: {e}")
            return False

    def _get_formatter_updates(self) -> List[Dict[str, str]]:
        """Get updates for formatter file."""
        return [
            {
                "type": "import_addition",
                "line": "from formatters.optimized_notion_formatter import OptimizedNotionFormatter, OptimizedAnalysisResult",
                "after": "from core.notion_client import NotionClient"
            },
            {
                "type": "class_method_addition",
                "class": "PromptAwareNotionFormatter",
                "method": """
    def use_optimized_formatter(self) -> bool:
        \"\"\"Check if optimized formatter should be used.\"\"\"
        return os.getenv("USE_OPTIMIZED_FORMATTER", "true").lower() == "true"

    def format_optimized_analysis(self, result: OptimizedAnalysisResult) -> List[Dict[str, Any]]:
        \"\"\"Format using optimized formatter.\"\"\"
        if self.use_optimized_formatter():
            optimizer = OptimizedNotionFormatter(self.notion)
            return optimizer.format_unified_analysis(result)
        else:
            # Fallback to original formatting
            return self.format_with_attribution(result.content, result.metadata, result.content_type)
"""
            }
        ]

    def _get_validator_updates(self) -> List[Dict[str, str]]:
        """Get updates for validator file."""
        return [
            {
                "type": "import_addition",
                "line": "from enrichment.enhanced_quality_validator import EnhancedQualityValidator, OptimizedQualityMetrics",
                "after": "from utils.logging import setup_logger"
            },
            {
                "type": "class_method_addition",
                "class": "EnrichmentQualityValidator",
                "method": """
    def use_enhanced_validation(self) -> bool:
        \"\"\"Check if enhanced validation should be used.\"\"\"
        return os.getenv("USE_ENHANCED_VALIDATION", "true").lower() == "true"

    def validate_with_optimization(self, content: str, content_type: str, processing_time: float, drive_link: str) -> OptimizedQualityMetrics:
        \"\"\"Validate using enhanced validator if enabled.\"\"\"
        if self.use_enhanced_validation():
            enhanced_validator = EnhancedQualityValidator()
            return enhanced_validator.validate_unified_analysis(content, content_type, processing_time, drive_link)
        else:
            # Convert to old format for compatibility
            return self._convert_to_optimized_metrics(
                self.validate_enrichment_results(content, [], {}, "", "")
            )
"""
            }
        ]

    def _get_config_updates(self) -> List[Dict[str, str]]:
        """Get updates for config file."""
        return [
            {
                "type": "method_update",
                "class": "EnhancedPromptConfig",
                "method": "get_prompt",
                "addition": """
        # Check for optimized unified prompt
        if analyzer == "unified_analyzer" or os.getenv("USE_UNIFIED_ANALYZER", "false").lower() == "true":
            return self._get_unified_prompt(content_type)
"""
            },
            {
                "type": "class_method_addition",
                "class": "EnhancedPromptConfig",
                "method": """
    def _get_unified_prompt(self, content_type: Optional[str] = None) -> Dict[str, Any]:
        \"\"\"Get unified analyzer prompt.\"\"\"
        # Try optimized config first
        optimized_config_path = self.config_path.parent / "prompts-optimized.yaml"
        if optimized_config_path.exists():
            try:
                with open(optimized_config_path) as f:
                    optimized_config = yaml.safe_load(f)

                base_config = optimized_config.get("defaults", {}).get("unified_analyzer", {})

                # Apply content-type specific overrides
                if content_type and "content_types" in optimized_config:
                    content_type_config = optimized_config.get("content_types", {}).get(content_type.lower(), {}).get("unified_analyzer", {})
                    base_config.update(content_type_config)

                base_config["source"] = "optimized"
                return base_config
            except Exception as e:
                self.logger.error(f"Failed to load optimized config: {e}")

        # Fallback to regular config
        return self.get_prompt("summarizer", content_type)
"""
            }
        ]

    def _apply_code_updates(self, file_path: str, updates: List[Dict[str, str]]) -> bool:
        """Apply code updates to a file."""
        try:
            with open(file_path, 'r') as f:
                content = f.read()

            original_content = content

            for update in updates:
                if update["type"] == "import_addition":
                    # Add import after specified line
                    if update["after"] in content and update["line"] not in content:
                        content = content.replace(
                            update["after"],
                            f"{update['after']}\n{update['line']}"
                        )

                elif update["type"] == "class_method_addition":
                    # Add method to class
                    class_pattern = f"class {update['class']}"
                    if class_pattern in content and update["method"] not in content:
                        # Find the end of the class to add method
                        content += f"\n{update['method']}\n"

                elif update["type"] == "method_update":
                    # Add code to existing method
                    method_pattern = f"def {update['method']}"
                    if method_pattern in content and update["addition"] not in content:
                        content = content.replace(
                            method_pattern,
                            f"{method_pattern}{update['addition']}"
                        )

            # Only write if content changed
            if content != original_content:
                with open(file_path, 'w') as f:
                    f.write(content)
                self.migration_log.append(f"Updated {file_path}")

            return True

        except Exception as e:
            self.logger.error(f"Failed to update {file_path}: {e}")
            self.errors.append(f"File update error ({file_path}): {e}")
            return False

    def _update_environment_variables(self) -> bool:
        """Update environment variables for optimized system."""
        if self.dry_run:
            self.logger.info("🔄 [DRY RUN] Would update environment variables...")
            return True

        self.logger.info("🌍 Updating environment variables...")

        try:
            env_updates = {
                "USE_OPTIMIZED_FORMATTER": "true",
                "USE_ENHANCED_VALIDATION": "true",
                "USE_UNIFIED_ANALYZER": "true",
                "QUALITY_GATE_THRESHOLD": "8.5",
                "MAX_PROCESSING_TIME": "30",
                "MAX_NOTION_BLOCKS": "15"
            }

            env_file = Path(".env")
            env_content = ""

            # Read existing .env if it exists
            if env_file.exists():
                with open(env_file, 'r') as f:
                    env_content = f.read()

            # Add new variables if they don't exist
            for key, value in env_updates.items():
                if f"{key}=" not in env_content:
                    env_content += f"\n{key}={value}"
                    self.migration_log.append(f"Added env var: {key}={value}")

            # Write updated .env file
            with open(env_file, 'w') as f:
                f.write(env_content)

            self.logger.info("✅ Environment variables updated")
            return True

        except Exception as e:
            self.logger.error(f"❌ Environment update failed: {e}")
            self.errors.append(f"Environment error: {e}")
            return False

    def _validate_post_migration(self) -> bool:
        """Validate system after migration."""
        self.logger.info("✅ Validating post-migration state...")

        try:
            # Test optimized configuration loading
            optimized_config_path = Path("config/prompts-optimized.yaml")
            if optimized_config_path.exists():
                with open(optimized_config_path, 'r') as f:
                    config = yaml.safe_load(f)

                if "defaults" not in config or "unified_analyzer" not in config["defaults"]:
                    self.logger.error("Optimized config missing required sections")
                    return False

            # Test enhanced validator import
            try:
                from enrichment.enhanced_quality_validator import EnhancedQualityValidator
                validator = EnhancedQualityValidator()
                self.logger.info("✅ Enhanced validator import successful")
            except ImportError as e:
                self.logger.error(f"Enhanced validator import failed: {e}")
                return False

            # Test optimized formatter import
            try:
                from formatters.optimized_notion_formatter import OptimizedNotionFormatter
                self.logger.info("✅ Optimized formatter import successful")
            except ImportError as e:
                self.logger.error(f"Optimized formatter import failed: {e}")
                return False

            self.logger.info("✅ Post-migration validation passed")
            return True

        except Exception as e:
            self.logger.error(f"❌ Post-migration validation failed: {e}")
            self.errors.append(f"Post-migration validation error: {e}")
            return False

    def _generate_migration_report(self) -> None:
        """Generate detailed migration report."""
        report_path = self.backup_dir / "migration_report.json"

        report = {
            "migration_timestamp": datetime.now().isoformat(),
            "dry_run": self.dry_run,
            "success": len(self.errors) == 0,
            "migration_log": self.migration_log,
            "errors": self.errors,
            "backup_location": str(self.backup_dir),
            "files_created": [
                "config/prompts-optimized.yaml",
                "src/formatters/optimized_notion_formatter.py",
                "src/enrichment/enhanced_quality_validator.py"
            ],
            "files_modified": [
                "config/prompts.yaml",
                "src/formatters/prompt_aware_notion_formatter.py",
                "src/enrichment/quality_validator.py",
                "src/core/prompt_config_enhanced.py",
                ".env"
            ],
            "rollback_instructions": f"To rollback: python {__file__} --rollback --backup-dir {self.backup_dir}"
        }

        if not self.dry_run:
            with open(report_path, 'w') as f:
                json.dump(report, f, indent=2)

        # Print summary
        print("\n" + "="*60)
        print("🚀 MIGRATION SUMMARY")
        print("="*60)
        print(f"Status: {'✅ SUCCESS' if len(self.errors) == 0 else '❌ FAILED'}")
        print(f"Dry Run: {self.dry_run}")
        print(f"Actions Performed: {len(self.migration_log)}")
        print(f"Errors: {len(self.errors)}")
        if not self.dry_run:
            print(f"Backup Location: {self.backup_dir}")
            print(f"Report: {report_path}")
        print("="*60)

        if self.errors:
            print("❌ ERRORS:")
            for error in self.errors:
                print(f"  - {error}")

    def rollback(self, backup_dir: Path) -> bool:
        """Rollback migration using backup."""
        self.logger.info(f"🔄 Rolling back migration from {backup_dir}")

        try:
            if not backup_dir.exists():
                self.logger.error(f"Backup directory not found: {backup_dir}")
                return False

            # Restore config files
            config_backup = backup_dir / "config"
            if config_backup.exists():
                for backup_file in config_backup.glob("*.yaml"):
                    shutil.copy2(backup_file, f"config/{backup_file.name}")
                    self.logger.info(f"Restored: config/{backup_file.name}")

            # Restore source files
            src_backup = backup_dir / "src"
            if src_backup.exists():
                for backup_file in src_backup.rglob("*.py"):
                    relative_path = backup_file.relative_to(src_backup)
                    dest_path = f"src/{relative_path}"
                    Path(dest_path).parent.mkdir(parents=True, exist_ok=True)
                    shutil.copy2(backup_file, dest_path)
                    self.logger.info(f"Restored: {dest_path}")

            # Restore .env file
            env_backup = backup_dir / ".env"
            if env_backup.exists():
                shutil.copy2(env_backup, ".env")
                self.logger.info("Restored: .env")

            self.logger.info("✅ Rollback completed successfully")
            return True

        except Exception as e:
            self.logger.error(f"❌ Rollback failed: {e}")
            return False


def main():
    """Main migration script entry point."""
    parser = argparse.ArgumentParser(description="Migrate to optimized unified prompts")
    parser.add_argument("--dry-run", action="store_true",
                       help="Run migration in dry-run mode (no changes)")
    parser.add_argument("--rollback", action="store_true",
                       help="Rollback previous migration")
    parser.add_argument("--backup-dir", type=Path,
                       help="Backup directory for rollback")
    parser.add_argument("--force", action="store_true",
                       help="Force migration even if optimized files exist")

    args = parser.parse_args()

    if args.rollback:
        if not args.backup_dir:
            print("❌ --backup-dir required for rollback")
            sys.exit(1)

        migrator = OptimizedPromptMigrator()
        success = migrator.rollback(args.backup_dir)
        sys.exit(0 if success else 1)

    # Run migration
    migrator = OptimizedPromptMigrator(dry_run=args.dry_run)
    success = migrator.run_migration()

    if success:
        print("\n🎉 Migration completed successfully!")
        print("Next steps:")
        print("1. Test the optimized system with sample documents")
        print("2. Monitor performance and quality metrics")
        print("3. Run: python -m pytest tests/test_optimized_implementation.py")
    else:
        print("\n❌ Migration failed. Check logs for details.")
        print("Use --rollback to restore previous state if needed.")

    sys.exit(0 if success else 1)


if __name__ == "__main__":
    main()