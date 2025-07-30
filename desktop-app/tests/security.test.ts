import { SecurityValidator } from '../src/main/utils/SecurityValidator';
import { RateLimiter } from '../src/main/utils/RateLimiter';
import { IPCSecurityValidator } from '../src/main/utils/IPCSecurityValidator';
import { SecureDeletion } from '../src/main/utils/SecureDeletion';
import * as crypto from 'crypto';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

describe('Security Features', () => {
  describe('SecurityValidator', () => {
    let validator: SecurityValidator;
    
    beforeEach(() => {
      validator = new SecurityValidator();
    });
    
    describe('Credential Validation', () => {
      test('should validate correct Notion token format', async () => {
        const validToken = 'secret_' + 'a'.repeat(40);
        expect(await validator.isValidNotionToken(validToken)).toBe(true);
      });
      
      test('should reject invalid Notion token format', async () => {
        const invalidTokens = [
          'invalid',
          'test_token',
          'secret_123', // too short
          'demo_' + 'a'.repeat(40)
        ];
        
        for (const token of invalidTokens) {
          expect(await validator.isValidNotionToken(token)).toBe(false);
        }
      });
      
      test('should validate correct OpenAI API key format', async () => {
        const validKey = 'sk-' + 'a'.repeat(48);
        expect(await validator.isValidOpenAIKey(validKey)).toBe(true);
      });
      
      test('should reject invalid OpenAI API key format', async () => {
        const invalidKeys = [
          'invalid',
          'pk-' + 'a'.repeat(48), // wrong prefix
          'sk-' + 'a'.repeat(47), // wrong length
          'sk-test123'
        ];
        
        for (const key of invalidKeys) {
          expect(await validator.isValidOpenAIKey(key)).toBe(false);
        }
      });
    });
    
    describe('Password Validation', () => {
      test('should validate strong passwords', () => {
        const strongPasswords = [
          'ComplexP@ssw0rd!',
          'Str0ng&Secure#2024',
          'MyV3ry$ecureP@ss'
        ];
        
        for (const password of strongPasswords) {
          const errors = validator.validatePasswordStrength(password);
          expect(errors).toHaveLength(0);
        }
      });
      
      test('should reject weak passwords', () => {
        const weakPasswords = [
          'password',    // too simple
          '12345678',    // no complexity
          'short',       // too short
          'aaaaaaaaaaa', // no variety
          'Password123'  // too common
        ];
        
        for (const password of weakPasswords) {
          const errors = validator.validatePasswordStrength(password);
          expect(errors.length).toBeGreaterThan(0);
        }
      });
      
      test('should generate secure passwords', () => {
        const password = validator.generateSecurePassword(20);
        
        expect(password).toHaveLength(20);
        expect(/[A-Z]/.test(password)).toBe(true);
        expect(/[a-z]/.test(password)).toBe(true);
        expect(/[0-9]/.test(password)).toBe(true);
        expect(/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)).toBe(true);
      });
    });
    
    describe('Input Sanitization', () => {
      test('should sanitize malicious input', () => {
        const maliciousInputs = [
          'normal\0text',              // null bytes
          'text\x00with\x01control',   // control characters
          '<script>alert(1)</script>', // script tags
          'a'.repeat(20000)           // excessive length
        ];
        
        for (const input of maliciousInputs) {
          const sanitized = validator.sanitizeInput(input);
          expect(sanitized).not.toContain('\0');
          expect(sanitized.length).toBeLessThanOrEqual(10000);
        }
      });
    });
  });
  
  describe('RateLimiter', () => {
    let rateLimiter: RateLimiter;
    
    beforeEach(() => {
      rateLimiter = new RateLimiter();
    });
    
    test('should allow requests within limit', () => {
      const clientId = 'test-client';
      const channel = 'config:load';
      
      // Should allow 10 requests (configured limit)
      for (let i = 0; i < 10; i++) {
        expect(rateLimiter.checkLimit(clientId, channel)).toBe(true);
      }
    });
    
    test('should block requests exceeding limit', () => {
      const clientId = 'test-client';
      const channel = 'config:save';
      
      // Should allow 5 requests (configured limit)
      for (let i = 0; i < 5; i++) {
        expect(rateLimiter.checkLimit(clientId, channel)).toBe(true);
      }
      
      // 6th request should be blocked
      expect(rateLimiter.checkLimit(clientId, channel)).toBe(false);
    });
    
    test('should track usage correctly', () => {
      const clientId = 'test-client';
      const channel = 'pipeline:status';
      
      // Make some requests
      rateLimiter.checkLimit(clientId, channel);
      rateLimiter.checkLimit(clientId, channel);
      
      const usage = rateLimiter.getUsage(clientId, channel);
      expect(usage).not.toBeNull();
      expect(usage?.count).toBe(2);
      expect(usage?.remaining).toBe(58); // 60 - 2
    });
    
    test('should reset client limits', () => {
      const clientId = 'test-client';
      const channel = 'config:load';
      
      // Use up some requests
      for (let i = 0; i < 5; i++) {
        rateLimiter.checkLimit(clientId, channel);
      }
      
      // Reset client
      rateLimiter.resetClient(clientId);
      
      // Should be able to make requests again
      expect(rateLimiter.checkLimit(clientId, channel)).toBe(true);
    });
  });
  
  describe('IPCSecurityValidator', () => {
    let validator: IPCSecurityValidator;
    
    beforeEach(() => {
      validator = new IPCSecurityValidator();
    });
    
    test('should validate correct config structure', async () => {
      const validConfig = {
        notionToken: 'secret_' + 'a'.repeat(40),
        notionDatabaseId: 'db123',
        openaiApiKey: 'sk-' + 'a'.repeat(48),
        googleServiceAccountPath: '/path/to/account.json',
        useEnhancedFormatting: true,
        rateLimitDelay: 1000
      };
      
      expect(await validator.isValidConfig(validConfig)).toBe(true);
    });
    
    test('should reject invalid config structure', async () => {
      const invalidConfigs = [
        null,
        'not an object',
        { notionToken: 123 }, // wrong type
        {}, // missing required fields
        { notionToken: 'test', notionDatabaseId: null } // null value
      ];
      
      for (const config of invalidConfigs) {
        expect(await validator.isValidConfig(config)).toBe(false);
      }
    });
    
    test('should detect injection patterns', () => {
      const injectionPayloads = [
        { script: '<script>alert(1)</script>' },
        { js: 'javascript:void(0)' },
        { eval: 'eval("malicious")' },
        { proto: '__proto__' },
        { constructor: 'constructor[\'constructor\']' }
      ];
      
      for (const payload of injectionPayloads) {
        expect(validator.hasInjectionPatterns(payload)).toBe(true);
      }
    });
    
    test('should validate file paths', () => {
      const validPaths = [
        '/home/user/file.json',
        'C:\\Users\\file.json',
        './relative/path.txt'
      ];
      
      const invalidPaths = [
        '../../../etc/passwd',  // path traversal
        '~/sensitive/file',     // home expansion
        'file\0name.txt',       // null byte
        'a'.repeat(1001)        // too long
      ];
      
      for (const path of validPaths) {
        expect(validator.isValidFilePath(path)).toBe(true);
      }
      
      for (const path of invalidPaths) {
        expect(validator.isValidFilePath(path)).toBe(false);
      }
    });
  });
  
  describe('SecureDeletion', () => {
    let secureDeletion: SecureDeletion;
    let testDir: string;
    
    beforeEach(() => {
      secureDeletion = new SecureDeletion();
      testDir = fs.mkdtempSync(path.join(os.tmpdir(), 'secure-delete-test-'));
    });
    
    afterEach(() => {
      // Clean up test directory
      if (fs.existsSync(testDir)) {
        fs.rmSync(testDir, { recursive: true, force: true });
      }
    });
    
    test('should securely delete a file', async () => {
      const testFile = path.join(testDir, 'test.txt');
      const testContent = 'sensitive data';
      fs.writeFileSync(testFile, testContent);
      
      await secureDeletion.secureDeleteFile(testFile, 'BASIC');
      
      expect(fs.existsSync(testFile)).toBe(false);
    });
    
    test('should handle non-existent files gracefully', async () => {
      const nonExistentFile = path.join(testDir, 'does-not-exist.txt');
      
      await expect(
        secureDeletion.secureDeleteFile(nonExistentFile)
      ).resolves.not.toThrow();
    });
    
    test('should securely delete a directory', async () => {
      const testSubDir = path.join(testDir, 'subdir');
      fs.mkdirSync(testSubDir);
      
      // Create some files
      fs.writeFileSync(path.join(testSubDir, 'file1.txt'), 'data1');
      fs.writeFileSync(path.join(testSubDir, 'file2.txt'), 'data2');
      
      await secureDeletion.secureDeleteDirectory(testSubDir, 'BASIC');
      
      expect(fs.existsSync(testSubDir)).toBe(false);
    });
    
    test('should clear buffers securely', () => {
      const buffer = Buffer.from('sensitive data');
      const originalData = buffer.toString();
      
      SecureDeletion.clearBuffer(buffer);
      
      // Buffer should be overwritten
      expect(buffer.toString()).not.toBe(originalData);
      expect(buffer.every(byte => byte === 0)).toBe(true);
    });
  });
  
  describe('Encryption Integration', () => {
    test('should generate cryptographically secure tokens', () => {
      const token1 = crypto.randomBytes(32).toString('hex');
      const token2 = crypto.randomBytes(32).toString('hex');
      
      expect(token1).toHaveLength(64); // 32 bytes = 64 hex chars
      expect(token2).toHaveLength(64);
      expect(token1).not.toBe(token2); // Should be unique
    });
    
    test('should perform timing-safe comparison', () => {
      const secret = 'my-secret-value';
      const correct = 'my-secret-value';
      const incorrect = 'wrong-secret-value';
      
      const secretBuffer = Buffer.from(secret);
      const correctBuffer = Buffer.from(correct);
      const incorrectBuffer = Buffer.from(incorrect);
      
      expect(crypto.timingSafeEqual(secretBuffer, correctBuffer)).toBe(true);
      
      // Should throw for different lengths
      expect(() => {
        crypto.timingSafeEqual(secretBuffer, incorrectBuffer);
      }).toThrow();
    });
  });
});