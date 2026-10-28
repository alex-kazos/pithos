import { db } from '../lib/firebase';
import { addDoc, collection } from 'firebase/firestore';
import { v4 as uuidv4 } from 'uuid';

type LogLevel = 'info' | 'success' | 'warning' | 'error' | 'debug';

interface LogContext {
  fileName: string;
  processId?: string;
  userId?: string;
  timestamp?: string;
  [key: string]: any;
}

interface LogDetails {
  [key: string]: any;
}

interface LogEntry {
  level: LogLevel;
  component: string;
  message: string;
  context: LogContext;
  details?: LogDetails;
  timestamp: string;
  sessionId: string;
}

interface LogBatch {
  sessionId: string;
  logs: LogEntry[];
  createdAt: string;
  updatedAt: string;
}

class Logger {
  private static instance: Logger;
  private isDevelopment = typeof window !== 'undefined' && window.location.hostname === 'localhost';
  private sessionId: string;
  private logBuffer: LogEntry[] = [];
  private batchSize: number = 10;
  private batchTimeout: number = 5000; // 5 seconds
  private batchTimeoutId: NodeJS.Timeout | null = null;

  private constructor() {
    this.sessionId = uuidv4();
    window.addEventListener('beforeunload', () => {
      if (this.logBuffer.length > 0) {
        this.flushLogs(true);
      }
    });
  }

  static getInstance(): Logger {
    if (!Logger.instance) {
      Logger.instance = new Logger();
    }
    return Logger.instance;
  }

  private getTimestamp(): string {
    return new Date().toISOString();
  }

  private formatMessage(
    level: LogLevel,
    component: string,
    message: string,
    context: LogContext,
    details?: LogDetails
  ): string {
    const timestamp = this.getTimestamp();
    const contextStr = Object.entries(context || {})
      .map(([key, value]) => `${key}=${value}`)
      .join(' | ');
    
    let formattedMessage = `[${timestamp}] [${level.toUpperCase()}] [${component}] ${message}`;
    if (contextStr) {
      formattedMessage += `\nContext: ${contextStr}`;
    }
    if (details) {
      formattedMessage += `\nDetails: ${JSON.stringify(details, null, 2)}`;
    }
    return formattedMessage;
  }

  private getConsoleStyles(level: LogLevel): string[] {
    switch (level) {
      case 'info':
        return ['color: #3498db']; // Blue
      case 'success':
        return ['color: #2ecc71']; // Green
      case 'warning':
        return ['color: #f1c40f']; // Yellow
      case 'error':
        return ['color: #e74c3c']; // Red
      case 'debug':
        return ['color: #95a5a6']; // Gray
      default:
        return ['color: inherit'];
    }
  }

  private sanitizeData(data: any): any {
    if (data === null || data === undefined) {
      return null;
    }

    if (Array.isArray(data)) {
      return data.map(item => this.sanitizeData(item));
    }

    if (data instanceof Error) {
      return {
        name: data.name,
        message: data.message,
        stack: data.stack
      };
    }

    if (data instanceof Date) {
      return data.toISOString();
    }

    if (typeof data === 'object') {
      const sanitized: { [key: string]: any } = {};
      for (const [key, value] of Object.entries(data)) {
        if (value !== undefined) {
          sanitized[key] = this.sanitizeData(value);
        }
      }
      return sanitized;
    }

    if (typeof data === 'function') {
      return '[Function]';
    }

    return data;
  }

  private async saveToFirebase(batch: LogBatch): Promise<void> {
    try {
      const sanitizedBatch = this.sanitizeData(batch);
      const logsCollection = collection(db, 'logBatches');
      // await addDoc(logsCollection, sanitizedBatch);
    } catch (error) {
      console.error('Failed to save log batch to Firebase:', error);
    }
  }

  private scheduleBatchFlush(): void {
    if (this.batchTimeoutId === null) {
      this.batchTimeoutId = setTimeout(() => {
        this.flushLogs(false);
      }, this.batchTimeout);
    }
  }

  private async flushLogs(isUnloading: boolean = false): Promise<void> {
    if (this.logBuffer.length === 0) return;

    if (this.batchTimeoutId) {
      clearTimeout(this.batchTimeoutId);
      this.batchTimeoutId = null;
    }

    const batch: LogBatch = {
      sessionId: this.sessionId,
      logs: [...this.logBuffer],
      createdAt: this.logBuffer[0].timestamp,
      updatedAt: this.logBuffer[this.logBuffer.length - 1].timestamp
    };

    this.logBuffer = [];

    if (isUnloading) {
      // Use synchronous method for unload
      try {
        navigator.sendBeacon(
          '/api/logs',
          JSON.stringify(this.sanitizeData(batch))
        );
      } catch (error) {
        console.error('Failed to send logs via beacon:', error);
      }
    } else {
      await this.saveToFirebase(batch);
    }
  }

  private async log(
    level: LogLevel,
    component: string,
    message: string,
    context: LogContext,
    details?: LogDetails
  ): Promise<void> {
    const timestamp = this.getTimestamp();
    const formattedMessage = this.formatMessage(level, component, message, context, details);
    const styles = this.getConsoleStyles(level);

    // Console logging
    switch (level) {
      case 'info':
        console.info('%c%s', ...styles, formattedMessage);
        break;
      case 'success':
        console.log('%c%s', ...styles, formattedMessage);
        break;
      case 'warning':
        console.warn('%c%s', ...styles, formattedMessage);
        break;
      case 'error':
        console.error('%c%s', ...styles, formattedMessage);
        break;
      case 'debug':
        if (this.isDevelopment) {
          console.debug('%c%s', ...styles, formattedMessage);
        }
        break;
    }

    // Save to buffer (except debug logs in production)
    if (level !== 'debug' || this.isDevelopment) {
      const logEntry: LogEntry = {
        level,
        component,
        message,
        context,
        details,
        timestamp,
        sessionId: this.sessionId
      };

      this.logBuffer.push(logEntry);

      if (level === 'error' || this.logBuffer.length >= this.batchSize) {
        // Flush immediately for errors or when batch size is reached
        await this.flushLogs(false);
      } else {
        // Schedule a flush
        this.scheduleBatchFlush();
      }
    }
  }

  async info(component: string, message: string, context: LogContext = { fileName: 'unknown' }, details?: LogDetails): Promise<void> {
    await this.log('info', component, message, context, details);
  }

  async success(component: string, message: string, context: LogContext = { fileName: 'unknown' }, details?: LogDetails): Promise<void> {
    await this.log('success', component, message, context, details);
  }

  async warning(component: string, message: string, context: LogContext = { fileName: 'unknown' }, details?: LogDetails): Promise<void> {
    await this.log('warning', component, message, context, details);
  }

  async error(component: string, message: string, context: LogContext = { fileName: 'unknown' }, details?: LogDetails): Promise<void> {
    await this.log('error', component, message, context, details);
  }

  async debug(component: string, message: string, context: LogContext = { fileName: 'unknown' }, details?: LogDetails): Promise<void> {
    await this.log('debug', component, message, context, details);
  }
}

export const logger = Logger.getInstance();
