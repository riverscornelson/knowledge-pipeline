import { GoogleAuthService } from './GoogleAuthService';
import { ConfigService } from '../config';

export interface GmailMessage {
  id: string;
  threadId: string;
  subject: string;
  from: string;
  date: Date;
  snippet: string;
  hasAttachments: boolean;
  attachments?: GmailAttachment[];
}

export interface GmailAttachment {
  id: string;
  filename: string;
  mimeType: string;
  size: number;
}

export interface GmailListResult {
  success: boolean;
  messages: GmailMessage[];
  error?: string;
}

export class GmailService {
  private configService: ConfigService;
  private authService: GoogleAuthService;
  
  constructor(configService: ConfigService) {
    this.configService = configService;
    this.authService = GoogleAuthService.getInstance(configService);
  }
  
  /**
   * List Gmail messages with PDF attachments
   */
  async listMessagesWithPDFs(daysBack: number = 7): Promise<GmailListResult> {
    try {
      const gmail = await this.authService.getGmailService();
      
      // Build query for messages with PDFs from the last N days
      const afterDate = new Date();
      afterDate.setDate(afterDate.getDate() - daysBack);
      const dateString = afterDate.toISOString().split('T')[0];
      
      const query = `has:attachment filename:pdf after:${dateString}`;
      
      // List messages
      const listResponse = await gmail.users.messages.list({
        userId: 'me',
        q: query,
        maxResults: 100,
      });
      
      const messageIds = listResponse.data.messages || [];
      const messages: GmailMessage[] = [];
      
      // Get details for each message
      for (const { id } of messageIds) {
        try {
          const messageResponse = await gmail.users.messages.get({
            userId: 'me',
            id: id,
          });
          
          const message = messageResponse.data;
          const headers = message.payload.headers || [];
          
          // Extract header information
          const subject = headers.find(h => h.name === 'Subject')?.value || 'No Subject';
          const from = headers.find(h => h.name === 'From')?.value || 'Unknown';
          const dateStr = headers.find(h => h.name === 'Date')?.value || '';
          
          // Find PDF attachments
          const attachments: GmailAttachment[] = [];
          this.findAttachments(message.payload, attachments);
          
          const pdfAttachments = attachments.filter(
            att => att.mimeType === 'application/pdf' || att.filename.toLowerCase().endsWith('.pdf')
          );
          
          if (pdfAttachments.length > 0) {
            messages.push({
              id: message.id!,
              threadId: message.threadId!,
              subject,
              from,
              date: new Date(dateStr),
              snippet: message.snippet || '',
              hasAttachments: true,
              attachments: pdfAttachments,
            });
          }
        } catch (error) {
          console.error(`Failed to get message ${id}:`, error);
        }
      }
      
      // Sort by date (newest first)
      messages.sort((a, b) => b.date.getTime() - a.date.getTime());
      
      return {
        success: true,
        messages,
      };
    } catch (error) {
      console.error('Failed to list Gmail messages:', error);
      
      let errorMessage = error instanceof Error ? error.message : 'Failed to list messages';
      if (errorMessage.includes('invalid_grant') || errorMessage.includes('Token has been expired')) {
        errorMessage = 'Gmail authentication expired. Please re-authenticate.';
      } else if (errorMessage.includes('ENOENT') || errorMessage.includes('credentials')) {
        errorMessage = 'Gmail not configured. Please set up Gmail authentication.';
      }
      
      return {
        success: false,
        messages: [],
        error: errorMessage,
      };
    }
  }
  
  /**
   * Download a PDF attachment
   */
  async downloadAttachment(messageId: string, attachmentId: string): Promise<Buffer> {
    const gmail = await this.authService.getGmailService();
    
    const response = await gmail.users.messages.attachments.get({
      userId: 'me',
      messageId,
      id: attachmentId,
    });
    
    // Decode base64 data
    const data = response.data.data!;
    return Buffer.from(data, 'base64');
  }
  
  /**
   * Download all PDF attachments from a message
   */
  async downloadMessagePDFs(
    message: GmailMessage
  ): Promise<{ filename: string; data: Buffer }[]> {
    const results: { filename: string; data: Buffer }[] = [];
    
    if (!message.attachments) {
      return results;
    }
    
    for (const attachment of message.attachments) {
      if (attachment.mimeType === 'application/pdf' || 
          attachment.filename.toLowerCase().endsWith('.pdf')) {
        try {
          const data = await this.downloadAttachment(message.id, attachment.id);
          results.push({
            filename: attachment.filename,
            data,
          });
        } catch (error) {
          console.error(`Failed to download ${attachment.filename}:`, error);
        }
      }
    }
    
    return results;
  }
  
  /**
   * Recursively find attachments in message parts
   */
  private findAttachments(part: any, attachments: GmailAttachment[]): void {
    if (part.filename && part.body?.attachmentId) {
      attachments.push({
        id: part.body.attachmentId,
        filename: part.filename,
        mimeType: part.mimeType || 'application/octet-stream',
        size: part.body.size || 0,
      });
    }
    
    if (part.parts) {
      for (const subPart of part.parts) {
        this.findAttachments(subPart, attachments);
      }
    }
  }
}