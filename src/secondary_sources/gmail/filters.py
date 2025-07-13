"""
Email filtering for quality control.
"""
import os
import re
from typing import Dict, List, Optional


class EmailFilter:
    """Filters emails to ensure quality content."""
    
    def __init__(self):
        """Initialize email filter with configuration."""
        # Load whitelists/blacklists from environment
        self.sender_whitelist = self._parse_list(
            os.getenv("EMAIL_SENDER_WHITELIST", "")
        )
        self.sender_blacklist = self._parse_list(
            os.getenv("EMAIL_SENDER_BLACKLIST", "")
        )
        
        # Default blacklist patterns
        self.blacklist_patterns = [
            r"noreply@",
            r"no-reply@",
            r"notifications@",
            r"alert@",
            r"promo@",
            r"marketing@",
            r"sales@",
            r"updates@github.com",
            r"notifications@linkedin.com",
            r"noreply@medium.com",
        ]
        
        # Subject patterns to skip
        self.skip_subject_patterns = [
            r"verification code",
            r"confirm your email",
            r"reset your password",
            r"your order",
            r"invoice",
            r"receipt",
            r"shipping",
            r"delivered",
            r"^re:",
            r"^fwd:",
        ]
    
    def should_process(self, sender: str, message: Dict) -> bool:
        """
        Determine if an email should be processed.
        
        Args:
            sender: Email sender address
            message: Full message data
            
        Returns:
            True if email should be processed
        """
        # Extract clean email address
        email_match = re.search(r'<(.+?)>', sender)
        sender_email = email_match.group(1) if email_match else sender
        sender_email = sender_email.lower()
        
        # Check whitelist first (overrides all)
        if self._matches_list(sender_email, self.sender_whitelist):
            return True
        
        # Check blacklist
        if self._matches_list(sender_email, self.sender_blacklist):
            return False
        
        # Check blacklist patterns
        for pattern in self.blacklist_patterns:
            if re.search(pattern, sender_email, re.IGNORECASE):
                return False
        
        # Check subject
        headers = message['payload'].get('headers', [])
        subject = ""
        for header in headers:
            if header['name'].lower() == 'subject':
                subject = header['value']
                break
        
        # Skip based on subject patterns
        for pattern in self.skip_subject_patterns:
            if re.search(pattern, subject, re.IGNORECASE):
                return False
        
        # Check content quality (basic heuristics)
        if len(subject) < 5:  # Too short
            return False
        
        return True
    
    def _parse_list(self, list_str: str) -> List[str]:
        """Parse comma-separated list from string."""
        if not list_str:
            return []
        return [item.strip().lower() for item in list_str.split(',') if item.strip()]
    
    def _matches_list(self, email: str, email_list: List[str]) -> bool:
        """Check if email matches any in the list."""
        for pattern in email_list:
            if pattern in email:
                return True
        return False