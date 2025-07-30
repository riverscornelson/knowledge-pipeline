import * as fs from 'fs';
import * as crypto from 'crypto';
import * as path from 'path';

/**
 * Secure deletion utility for sensitive files and data
 */
export class SecureDeletion {
  // Overwrite patterns for different security levels
  private readonly PATTERNS = {
    ZEROS: Buffer.alloc(1024, 0),
    ONES: Buffer.alloc(1024, 0xFF),
    RANDOM: () => crypto.randomBytes(1024)
  };
  
  // Number of overwrite passes for different security levels
  private readonly PASS_COUNTS = {
    BASIC: 1,      // Single random overwrite
    STANDARD: 3,   // DoD 5220.22-M standard
    PARANOID: 7    // Gutmann-inspired (simplified)
  };
  
  /**
   * Securely delete a file
   */
  async secureDeleteFile(
    filePath: string,
    securityLevel: 'BASIC' | 'STANDARD' | 'PARANOID' = 'STANDARD'
  ): Promise<void> {
    try {
      if (!fs.existsSync(filePath)) {
        return;
      }
      
      const stats = fs.statSync(filePath);
      if (!stats.isFile()) {
        throw new Error('Path is not a file');
      }
      
      const fileSize = stats.size;
      const passes = this.PASS_COUNTS[securityLevel];
      
      // Perform overwrite passes
      await this.overwriteFile(filePath, fileSize, passes, securityLevel);
      
      // Rename file multiple times to obscure metadata
      await this.obscureFileName(filePath);
      
      // Finally delete the file
      fs.unlinkSync(filePath);
    } catch (error) {
      console.error('Secure deletion failed:', error);
      // Attempt standard deletion as fallback
      try {
        if (fs.existsSync(filePath)) {
          fs.unlinkSync(filePath);
        }
      } catch (fallbackError) {
        throw new Error(`Failed to delete file: ${error}`);
      }
    }
  }
  
  /**
   * Securely delete a directory and all its contents
   */
  async secureDeleteDirectory(
    dirPath: string,
    securityLevel: 'BASIC' | 'STANDARD' | 'PARANOID' = 'STANDARD'
  ): Promise<void> {
    try {
      if (!fs.existsSync(dirPath)) {
        return;
      }
      
      const stats = fs.statSync(dirPath);
      if (!stats.isDirectory()) {
        throw new Error('Path is not a directory');
      }
      
      // Recursively delete all files and subdirectories
      const entries = fs.readdirSync(dirPath, { withFileTypes: true });
      
      for (const entry of entries) {
        const fullPath = path.join(dirPath, entry.name);
        
        if (entry.isDirectory()) {
          await this.secureDeleteDirectory(fullPath, securityLevel);
        } else {
          await this.secureDeleteFile(fullPath, securityLevel);
        }
      }
      
      // Remove the empty directory
      fs.rmdirSync(dirPath);
    } catch (error) {
      console.error('Secure directory deletion failed:', error);
      throw error;
    }
  }
  
  /**
   * Overwrite file with patterns
   */
  private async overwriteFile(
    filePath: string,
    fileSize: number,
    passes: number,
    securityLevel: string
  ): Promise<void> {
    const fd = fs.openSync(filePath, 'r+');
    
    try {
      for (let pass = 0; pass < passes; pass++) {
        const pattern = this.getPatternForPass(pass, securityLevel);
        await this.writePattern(fd, fileSize, pattern);
        fs.fsyncSync(fd); // Ensure data is written to disk
      }
    } finally {
      fs.closeSync(fd);
    }
  }
  
  /**
   * Get pattern for specific pass
   */
  private getPatternForPass(pass: number, securityLevel: string): Buffer | (() => Buffer) {
    if (securityLevel === 'BASIC') {
      return this.PATTERNS.RANDOM;
    }
    
    if (securityLevel === 'STANDARD') {
      // DoD 5220.22-M pattern
      switch (pass % 3) {
        case 0: return this.PATTERNS.ZEROS;
        case 1: return this.PATTERNS.ONES;
        case 2: return this.PATTERNS.RANDOM;
        default: return this.PATTERNS.RANDOM;
      }
    }
    
    // PARANOID - Gutmann-inspired pattern
    const patterns = [
      this.PATTERNS.ZEROS,
      this.PATTERNS.ONES,
      Buffer.from([0x55, 0x55]), // 0101...
      Buffer.from([0xAA, 0xAA]), // 1010...
      this.PATTERNS.RANDOM,
      Buffer.from([0x92, 0x49, 0x24]), // specific patterns
      this.PATTERNS.RANDOM
    ];
    
    return patterns[pass % patterns.length];
  }
  
  /**
   * Write pattern to file
   */
  private async writePattern(
    fd: number,
    fileSize: number,
    pattern: Buffer | (() => Buffer)
  ): Promise<void> {
    let position = 0;
    const bufferSize = 1024 * 1024; // 1MB chunks
    
    while (position < fileSize) {
      const remaining = fileSize - position;
      const writeSize = Math.min(bufferSize, remaining);
      
      const buffer = typeof pattern === 'function' 
        ? pattern() 
        : this.repeatPattern(pattern, writeSize);
      
      fs.writeSync(fd, buffer, 0, writeSize, position);
      position += writeSize;
    }
  }
  
  /**
   * Repeat pattern to fill buffer
   */
  private repeatPattern(pattern: Buffer, size: number): Buffer {
    const buffer = Buffer.alloc(size);
    let offset = 0;
    
    while (offset < size) {
      const copySize = Math.min(pattern.length, size - offset);
      pattern.copy(buffer, offset, 0, copySize);
      offset += copySize;
    }
    
    return buffer;
  }
  
  /**
   * Obscure file name before deletion
   */
  private async obscureFileName(filePath: string): Promise<string> {
    let currentPath = filePath;
    const dir = path.dirname(filePath);
    
    // Rename multiple times with random names
    for (let i = 0; i < 5; i++) {
      const randomName = crypto.randomBytes(16).toString('hex');
      const newPath = path.join(dir, randomName);
      
      try {
        fs.renameSync(currentPath, newPath);
        currentPath = newPath;
      } catch (error) {
        // If rename fails, continue with current path
        break;
      }
    }
    
    return currentPath;
  }
  
  /**
   * Securely wipe free space on a volume (platform-specific)
   */
  async wipeFreespace(volumePath: string): Promise<void> {
    // This is a complex operation that requires platform-specific tools
    // On macOS: diskutil secureErase freespace
    // On Windows: cipher /w
    // On Linux: dd with random data to a temp file until disk is full
    
    console.warn('Free space wiping is platform-specific and not implemented');
    // Implementation would go here based on process.platform
  }
  
  /**
   * Securely clear memory buffer
   */
  static clearBuffer(buffer: Buffer): void {
    if (!buffer || buffer.length === 0) return;
    
    // Overwrite with random data
    crypto.randomFillSync(buffer);
    
    // Then overwrite with zeros
    buffer.fill(0);
  }
  
  /**
   * Securely clear string from memory (best effort)
   */
  static clearString(str: string): void {
    // JavaScript strings are immutable, so we can't truly clear them
    // This is a best-effort approach
    if (!str) return;
    
    // Force garbage collection if available
    if (global.gc) {
      global.gc();
    }
  }
  
  /**
   * Get secure deletion statistics
   */
  getStats(): {
    algorithm: string;
    passCount: number;
    bufferSize: number;
  } {
    return {
      algorithm: 'DoD 5220.22-M / Gutmann',
      passCount: this.PASS_COUNTS.STANDARD,
      bufferSize: 1024 * 1024
    };
  }
}