# Security Policy

## Deployment Model

This project is designed for **local deployment only**. It is intended to be run by individuals on their own machines for personal knowledge management, not as a public service or in multi-tenant environments.

## Security Considerations for Local Deployment

### Credential Storage
- OAuth tokens and API keys are stored in plain text files on your local machine
- Service account credentials are stored as JSON files
- This approach prioritizes simplicity and ease of use for local development
- **Your responsibility**: Secure your local environment and keep credentials private

### API Access
- The pipeline makes authenticated requests to external services (Google Drive, Gmail, OpenAI, Firecrawl)
- All API calls use your personal credentials and quotas
- **Your responsibility**: Monitor API usage and costs

### Data Processing
- Content is processed locally and stored in your personal Notion workspace
- Temporary files may be created during PDF processing
- **Your responsibility**: Ensure your Notion workspace access is properly secured

## Recommended Security Practices

### Environment Security
1. **Use isolated environments** (Docker, virtual machines, or dedicated development machines)
2. **Keep your system updated** with latest security patches
3. **Use strong authentication** for your Google, OpenAI, and Notion accounts
4. **Enable 2FA** on all connected services
5. **Regularly rotate API keys** as recommended by service providers

### File Permissions
```bash
# Ensure credential files are readable only by you
chmod 600 gmail_credentials/*.json
chmod 600 config/google_service_account.json
chmod 600 .env
```

### Docker Deployment (Recommended)
Running in a container provides additional isolation:
```bash
docker build -t knowledge-pipeline .
docker run -v $(pwd)/config:/app/config knowledge-pipeline
```

## Vulnerability Reporting

Since this is a local-only tool, security issues are typically:
- Configuration guidance improvements
- Documentation updates
- Best practice recommendations

To report security concerns:
1. **Open a GitHub issue** with the "security" label
2. **Email maintainer** for sensitive issues: rivers.cornelson@gmail.com
3. **Provide context** about your deployment scenario

## Not Recommended For

❌ **Do not use this project for:**
- Public web services
- Multi-tenant environments
- Processing sensitive data without proper isolation
- Production environments without security review
- Shared development machines

## Security Updates

- Monitor this repository for security-related updates
- Keep dependencies updated by running `pip install -r requirements.txt --upgrade`
- Check the [CHANGELOG.md](CHANGELOG.md) for security-related changes

## Disclaimer

This software is provided "as is" for local development and personal use. Users are responsible for securing their own environments and ensuring compliance with their organization's security policies.