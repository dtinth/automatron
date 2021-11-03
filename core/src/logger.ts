import pino from 'pino'

export const logger = pino({
  // https://github.com/pinojs/pino/issues/726#issuecomment-605814879
  messageKey: 'message',
  formatters: {
    level: (label) => {
      function getSeverity(label: string) {
        switch (label) {
          case 'trace':
            return 'DEBUG'
          case 'debug':
            return 'DEBUG'
          case 'info':
            return 'INFO'
          case 'warn':
            return 'WARNING'
          case 'error':
            return 'ERROR'
          case 'fatal':
            return 'CRITICAL'
          default:
            return 'DEFAULT'
        }
      }
      return { severity: getSeverity(label) }
    },
  },
}).child({ name: 'automatron' })
