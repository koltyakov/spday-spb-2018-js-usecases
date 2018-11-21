import { LOGGING_LEVEL } from './const';

export interface ILoggerConfig {
  correlationId: string;
  libVersion: string;
  level?: number;
  piiLoggingEnabled?: boolean;
  log?: (message: string) => void;
}

export class Logger {

  private LOGGING_LEVEL = LOGGING_LEVEL;
  private LEVEL_STRING_MAP = {
    0: 'ERROR:',
    1: 'WARNING:',
    2: 'INFO:',
    3: 'VERBOSE:'
  };

  constructor(private config: ILoggerConfig) {
    /**/
  }

  /**
   * Logs messages when Logging Level is set to 0.
   * @param {string} message  -  Message to log.
   * @param {string} error  -  Error to log.
   */
  public error(message: string, error: Error): void {
    this.log(this.LOGGING_LEVEL.ERROR, message, error);
  }

  /**
   * Logs messages when Logging Level is set to 1.
   * @param {string} message  -  Message to log.
   */
  public warn(message: string): void {
    this.log(this.LOGGING_LEVEL.WARN, message, null);
  }

  /**
   * Logs messages when Logging Level is set to 2.
   * @param {string} message  -  Message to log.
   */
  public info(message: string): void {
    this.log(this.LOGGING_LEVEL.INFO, message, null);
  }

  /**
   * Logs messages when Logging Level is set to 3.
   * @param {string} message  -  Message to log.
   */
  public verbose(message: string): void {
    this.log(this.LOGGING_LEVEL.VERBOSE, message, null);
  }

  /**
   * Logs Pii messages when Logging Level is set to 0 and window.piiLoggingEnabled is set to true.
   * @param {string} message  -  Message to log.
   * @param {string} error  -  Error to log.
   */
  public errorPii(message: string, error: Error) {
    this.log(this.LOGGING_LEVEL.ERROR, message, error, true);
  }

  /**
   * Logs  Pii messages when Logging Level is set to 1 and window.piiLoggingEnabled is set to true.
   * @param {string} message  -  Message to log.
   */
  public warnPii(message: string) {
    this.log(this.LOGGING_LEVEL.WARN, message, null, true);
  }

  /**
   * Logs messages when Logging Level is set to 2 and window.piiLoggingEnabled is set to true.
   * @param {string} message  -  Message to log.
   */
  public infoPii(message: string) {
    this.log(this.LOGGING_LEVEL.INFO, message, null, true);
  }

  /**
   * Logs messages when Logging Level is set to 3 and window.piiLoggingEnabled is set to true.
   * @param {string} message  -  Message to log.
   */
  public verbosePii(message: string) {
    this.log(this.LOGGING_LEVEL.VERBOSE, message, null, true);
  }

  /**
   * Checks the Logging Level, constructs the Log message and logs it. Users need to implement/override this method to turn on Logging.
   * @param {number} level  -  Level can be set 0,1,2 and 3 which turns on 'error', 'warning', 'info' or 'verbose' level logging respectively.
   * @param {string} message  -  Message to log.
   * @param {string} error  -  Error to log.
   */
  private log(level: number, message: string, error: Error | null, containsPii: boolean = false) {
    if (level <= (window as any).Logging.level) {
      if (!(window as any).Logging.piiLoggingEnabled && containsPii) {
        return;
      }
      const timestamp = new Date().toUTCString();
      let formattedMessage = '';
      if (this.config.correlationId) {
        formattedMessage = `${timestamp}:${this.config.correlationId }-${this.config.libVersion}-${this.LEVEL_STRING_MAP[level]} ${message}`;
      } else {
        formattedMessage = `${timestamp}:${this.config.libVersion}-${this.LEVEL_STRING_MAP[level]} ${message}`;
      }
      if (error) {
        formattedMessage += '\nstack:\n' + error.stack;
      }
      (window as any).Logging.log(formattedMessage);
    }
  }

}
