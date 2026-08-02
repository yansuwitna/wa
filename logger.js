const MAX_LOGS = 500;
const logs = [];

// Helper to format arguments
const formatArgs = (args) => {
  return args.map(a => {
    if (a instanceof Error) return a.stack || a.message;
    if (typeof a === 'object') {
      try {
        return JSON.stringify(a);
      } catch (e) {
        return '[Object]';
      }
    }
    return String(a);
  }).join(' ');
};

const addLog = (level, ...args) => {
  const timestamp = new Date().toISOString();
  const message = formatArgs(args);
  logs.push(`[${timestamp}] [${level}] ${message}`);
  if (logs.length > MAX_LOGS) {
    logs.shift();
  }
};

// Override original console methods
const originalLog = console.log;
const originalError = console.error;
const originalInfo = console.info;
const originalWarn = console.warn;

console.log = (...args) => {
  addLog('LOG', ...args);
  originalLog.apply(console, args);
};

console.error = (...args) => {
  addLog('ERROR', ...args);
  originalError.apply(console, args);
};

console.info = (...args) => {
  addLog('INFO', ...args);
  originalInfo.apply(console, args);
};

console.warn = (...args) => {
  addLog('WARN', ...args);
  originalWarn.apply(console, args);
};

// Menyimpan log awal
console.log("Logger diaktifkan. Sistem siap merekam log.");

module.exports = {
  getLogs: () => logs
};
