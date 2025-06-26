"""
email_filters.py - Smart filtering for newsletter and content emails

Filters out promotional emails, LinkedIn notifications, and other non-content
to avoid unnecessary AI processing costs.
"""
import re
from typing import Dict, List


# Newsletter and content sender patterns (INCLUDE these)
NEWSLETTER_PATTERNS = [
    # Substack newsletters
    r'.*@substack\.com$',
    r'.*substack.*',
    
    # Specific high-value newsletters
    r'oneusefulthing@substack\.com',
    r'simonw@substack\.com', 
    r'garymarcus@substack\.com',
    r'natesnewsletter@substack\.com',
    r'glennhopper@substack\.com',
    r'vinvashishta@substack\.com',
    
    # Other newsletter platforms
    r'.*@beehiiv\.com$',
    r'.*@convertkit\.com$',
    r'.*@mailchimp\.com$',
    r'.*newsletter.*',
    r'.*digest.*',
    
    # News organizations
    r'.*@platformer\.news$',
    r'.*@theverge\.com$',
    r'.*@techcrunch\.com$',
    r'.*@arstechnica\.com$',
]

# Promotional/spam patterns (EXCLUDE these)
EXCLUDE_PATTERNS = [
    # LinkedIn notifications
    r'.*@linkedin\.com$',
    r'.*linkedin.*',
    r'messaging-digest-noreply@linkedin\.com',
    
    # Generic promotional
    r'.*noreply.*',
    r'.*no-reply.*',
    r'.*marketing@.*',
    r'.*promo@.*',
    r'.*sales@.*',
    
    # Transactional emails
    r'.*receipt.*',
    r'.*billing.*',
    r'.*payment.*',
    r'.*invoice.*',
    
    # Social media notifications
    r'.*@facebook\.com$',
    r'.*@twitter\.com$',
    r'.*@instagram\.com$',
]

# Subject line patterns to exclude
EXCLUDE_SUBJECT_PATTERNS = [
    r'.*just messaged you.*',
    r'.*payment receipt.*',
    r'.*subscription.*receipt.*',
    r'.*thank you for.*subscription.*',
    r'.*unsubscribe.*',
    r'.*manage.*preferences.*',
    r'.*view.*browser.*',
]

# Content quality indicators (INCLUDE if found)
QUALITY_INDICATORS = [
    # AI/tech content keywords
    'artificial intelligence', 'machine learning', 'AI', 'ML',
    'ChatGPT', 'GPT', 'Claude', 'LLM', 'neural network',
    'deep learning', 'tech news', 'startup', 'venture capital',
    'programming', 'software', 'development', 'coding',
    
    # Newsletter indicators
    'newsletter', 'weekly update', 'digest', 'roundup',
    'analysis', 'insights', 'research', 'report',
]


class EmailFilter:
    """Smart email filtering for newsletters and content emails."""
    
    def __init__(self, custom_whitelist: List[str] = None, custom_blacklist: List[str] = None):
        self.custom_whitelist = custom_whitelist or []
        self.custom_blacklist = custom_blacklist or []
    
    def is_newsletter_sender(self, sender: str) -> bool:
        """Check if sender matches newsletter patterns."""
        sender_lower = sender.lower()
        
        # Check custom whitelist first
        for pattern in self.custom_whitelist:
            if re.search(pattern.lower(), sender_lower):
                return True
        
        # Check built-in newsletter patterns
        for pattern in NEWSLETTER_PATTERNS:
            if re.search(pattern, sender_lower):
                return True
        
        return False
    
    def is_excluded_sender(self, sender: str) -> bool:
        """Check if sender should be excluded."""
        sender_lower = sender.lower()
        
        # Check custom blacklist first
        for pattern in self.custom_blacklist:
            if re.search(pattern.lower(), sender_lower):
                return True
        
        # Check built-in exclude patterns
        for pattern in EXCLUDE_PATTERNS:
            if re.search(pattern, sender_lower):
                return True
        
        return False
    
    def is_excluded_subject(self, subject: str) -> bool:
        """Check if subject line should be excluded."""
        subject_lower = subject.lower()
        
        for pattern in EXCLUDE_SUBJECT_PATTERNS:
            if re.search(pattern, subject_lower):
                return True
        
        return False
    
    def has_quality_indicators(self, content: str) -> bool:
        """Check if content contains quality indicators."""
        content_lower = content.lower()
        
        # Count quality indicators
        quality_count = 0
        for indicator in QUALITY_INDICATORS:
            if indicator.lower() in content_lower:
                quality_count += 1
        
        # Require at least 2 quality indicators for non-whitelisted senders
        return quality_count >= 2
    
    def should_process_email(self, sender: str, subject: str, content: str = "") -> Dict[str, any]:
        """
        Determine if email should be processed for AI enrichment.
        
        Returns:
            dict: {
                'should_process': bool,
                'reason': str,
                'confidence': float  # 0.0 - 1.0
            }
        """
        # Quick exclusions first (save processing time)
        if self.is_excluded_sender(sender):
            return {
                'should_process': False,
                'reason': f'Excluded sender pattern: {sender}',
                'confidence': 0.95
            }
        
        if self.is_excluded_subject(subject):
            return {
                'should_process': False, 
                'reason': f'Excluded subject pattern: {subject}',
                'confidence': 0.90
            }
        
        # High-confidence inclusions
        if self.is_newsletter_sender(sender):
            return {
                'should_process': True,
                'reason': f'Newsletter sender: {sender}',
                'confidence': 0.90
            }
        
        # Content-based analysis (for edge cases)
        if content and self.has_quality_indicators(content):
            return {
                'should_process': True,
                'reason': 'Content contains quality indicators',
                'confidence': 0.75
            }
        
        # Default: exclude unknown senders to save costs
        return {
            'should_process': False,
            'reason': f'Unknown sender, no quality indicators: {sender}',
            'confidence': 0.60
        }
    
    def get_filter_stats(self, emails: List[Dict]) -> Dict:
        """Get filtering statistics for a batch of emails."""
        stats = {
            'total': len(emails),
            'included': 0,
            'excluded': 0,
            'reasons': {}
        }
        
        for email in emails:
            result = self.should_process_email(
                email.get('sender', ''),
                email.get('subject', ''),
                email.get('content', '')
            )
            
            if result['should_process']:
                stats['included'] += 1
            else:
                stats['excluded'] += 1
            
            reason = result['reason']
            stats['reasons'][reason] = stats['reasons'].get(reason, 0) + 1
        
        return stats


def test_email_filter():
    """Test the email filter with sample emails."""
    filter_engine = EmailFilter()
    
    test_emails = [
        {
            'sender': 'simonw@substack.com',
            'subject': 'Phoenix.new is Fly\'s entry into the prompt-driven app development space',
            'should_include': True
        },
        {
            'sender': 'messaging-digest-noreply@linkedin.com', 
            'subject': 'Matthew just messaged you',
            'should_include': False
        },
        {
            'sender': 'oneusefulthing@substack.com',
            'subject': 'Using AI Right Now: A Quick Guide',
            'should_include': True
        },
        {
            'sender': 'vinvashishta@substack.com',
            'subject': 'Your payment receipt from High ROI Data Science #GUZZ5DPU-0001',
            'should_include': False
        },
        {
            'sender': 'no-reply@substack.com',
            'subject': 'People you know are on Substack',
            'should_include': False
        }
    ]
    
    print("🧪 Testing Email Filter:")
    print("=" * 50)
    
    correct = 0
    for email in test_emails:
        result = filter_engine.should_process_email(
            email['sender'], 
            email['subject']
        )
        
        status = "✅" if result['should_process'] == email['should_include'] else "❌"
        action = "INCLUDE" if result['should_process'] else "EXCLUDE"
        
        print(f"{status} {action}: {email['subject']}")
        print(f"   From: {email['sender']}")
        print(f"   Reason: {result['reason']}")
        print(f"   Confidence: {result['confidence']:.2f}")
        print()
        
        if result['should_process'] == email['should_include']:
            correct += 1
    
    accuracy = correct / len(test_emails) * 100
    print(f"🎯 Filter Accuracy: {accuracy:.1f}% ({correct}/{len(test_emails)})")


if __name__ == "__main__":
    test_email_filter()