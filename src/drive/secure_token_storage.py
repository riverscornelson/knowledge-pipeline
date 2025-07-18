"""Secure OAuth2 token storage using JSON with proper file permissions."""

import json
import os
import logging
from pathlib import Path
from typing import Optional, List
import pickle  # Only for migration from old format

from google.oauth2.credentials import Credentials

logger = logging.getLogger(__name__)


class SecureTokenStorage:
    """Securely store OAuth2 tokens in JSON format with proper permissions.
    
    This class replaces the insecure pickle-based storage with JSON serialization
    and enforces strict file permissions to protect sensitive tokens.
    """
    
    def __init__(self, token_file: str = None):
        """Initialize secure token storage.
        
        Args:
            token_file: Path to token file. If None, uses ~/.config/knowledge-pipeline/oauth2_token.json
        """
        if token_file is None:
            config_dir = Path.home() / '.config' / 'knowledge-pipeline'
            self.token_path = config_dir / 'oauth2_token.json'
        else:
            self.token_path = Path(token_file)
    
    def save_credentials(self, creds: Credentials) -> None:
        """Securely save credentials to JSON file with proper permissions.
        
        Args:
            creds: Google OAuth2 credentials object
        """
        try:
            # Ensure parent directory exists with secure permissions
            self.token_path.parent.mkdir(parents=True, exist_ok=True, mode=0o700)
            
            # Convert credentials to JSON
            token_data = json.loads(creds.to_json())
            
            # Write atomically with secure permissions
            temp_path = self.token_path.with_suffix('.tmp')
            
            # Write to temporary file first
            with open(temp_path, 'w', encoding='utf-8') as f:
                json.dump(token_data, f, indent=2)
            
            # Set secure permissions (owner read/write only)
            os.chmod(temp_path, 0o600)
            
            # Atomic move to final location
            temp_path.replace(self.token_path)
            
            logger.debug(f"Saved OAuth2 token securely to {self.token_path}")
            
        except Exception as e:
            logger.error(f"Failed to save OAuth2 token: {e}")
            # Clean up temp file if it exists
            if temp_path.exists():
                temp_path.unlink()
            raise
    
    def load_credentials(self, scopes: List[str]) -> Optional[Credentials]:
        """Load credentials from JSON file if valid and secure.
        
        Args:
            scopes: OAuth2 scopes required for the credentials
            
        Returns:
            Credentials object if valid, None otherwise
        """
        if not self.token_path.exists():
            logger.debug(f"Token file not found: {self.token_path}")
            return None
        
        try:
            # Check file permissions
            stat = self.token_path.stat()
            file_mode = stat.st_mode & 0o777  # Get permission bits
            
            # Check if file has insecure permissions (readable by group/others)
            if file_mode & 0o077:
                logger.warning(
                    f"Token file has insecure permissions ({oct(file_mode)}), "
                    "removing and re-authenticating for security"
                )
                self.token_path.unlink()
                return None
            
            # Load and parse JSON
            with open(self.token_path, 'r', encoding='utf-8') as f:
                token_data = json.load(f)
            
            # Reconstruct credentials object
            creds = Credentials.from_authorized_user_info(token_data, scopes)
            
            logger.debug("Loaded OAuth2 token from secure storage")
            return creds
            
        except json.JSONDecodeError as e:
            logger.error(f"Invalid JSON in token file: {e}")
            # Remove corrupted file
            self.token_path.unlink()
            return None
        except Exception as e:
            logger.error(f"Failed to load OAuth2 token: {e}")
            return None
    
    def migrate_from_pickle(self, pickle_file: str, scopes: List[str]) -> bool:
        """Migrate from old pickle-based token storage to secure JSON.
        
        Args:
            pickle_file: Path to old pickle token file
            scopes: OAuth2 scopes for the credentials
            
        Returns:
            True if migration successful, False otherwise
        """
        pickle_path = Path(pickle_file)
        
        if not pickle_path.exists():
            return False
        
        try:
            logger.info(f"Migrating OAuth2 token from pickle format: {pickle_file}")
            
            # Load from pickle (one last time)
            with open(pickle_path, 'rb') as f:
                creds = pickle.load(f)
            
            # Validate it's actually a Credentials object
            if not isinstance(creds, Credentials):
                logger.error("Pickle file does not contain valid OAuth2 credentials")
                return False
            
            # Save in new secure format
            self.save_credentials(creds)
            
            # Remove old pickle file
            pickle_path.unlink()
            logger.info("Successfully migrated OAuth2 token to secure JSON format")
            
            # Also remove .pickle backup if it exists
            backup_path = pickle_path.with_suffix('.pickle.bak')
            if backup_path.exists():
                backup_path.unlink()
            
            return True
            
        except Exception as e:
            logger.error(f"Failed to migrate pickle token: {e}")
            return False
    
    def delete_token(self) -> None:
        """Delete the stored token file."""
        if self.token_path.exists():
            self.token_path.unlink()
            logger.info(f"Deleted OAuth2 token file: {self.token_path}")