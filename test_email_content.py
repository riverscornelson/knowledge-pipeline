"""
test_email_content.py - Test email content extraction with debug output

This script will test the content extraction on a few recent emails to verify
we're getting full content.
"""
import os
from dotenv import load_dotenv
from gmail_auth import GmailAuthenticator
from capture_emails import extract_email_content, search_gmail_messages

load_dotenv()

def test_content_extraction():
    """Test email content extraction with debug output."""
    print("🧪 Testing email content extraction...")
    
    # Authenticate with Gmail
    authenticator = GmailAuthenticator()
    service = authenticator.get_service()
    
    # Search for a few recent newsletter emails
    messages = search_gmail_messages(service, "from:substack", max_results=3)
    
    if not messages:
        print("❌ No test emails found")
        return
    
    print(f"\n📧 Testing content extraction on {len(messages)} emails:\n")
    
    for i, message in enumerate(messages[:3], 1):
        print(f"=" * 60)
        print(f"🔍 EMAIL {i}")
        print(f"=" * 60)
        
        try:
            # Get full message data
            msg = service.users().messages().get(
                userId='me',
                id=message['id'],
                format='full'
            ).execute()
            
            # Extract content with debug enabled
            subject, content = extract_email_content(msg, debug=True)
            
            print(f"\n📝 RESULTS:")
            print(f"   Subject: {subject}")
            print(f"   Content length: {len(content)} characters")
            print(f"   Content preview (first 200 chars):")
            print(f"   {repr(content[:200])}")
            
            if len(content) < 100:
                print(f"   ⚠️  WARNING: Content seems very short!")
            else:
                print(f"   ✅ Content extraction looks good")
                
        except Exception as exc:
            print(f"   ❌ Error processing email: {exc}")
        
        print()


if __name__ == "__main__":
    test_content_extraction()