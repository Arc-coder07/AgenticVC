// Suppress "Controller is already closed" unhandled rejections 
// that occur when clients disconnect during streaming responses.
// This is expected behavior (React Strict Mode, navigation, etc.)
// and not an actual error.

export function register() {
  // Only register the handler in Node.js runtime, not Edge
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    process.on('unhandledRejection', (reason: any) => {
      // Suppress stream controller errors from client disconnects
      if (
        reason?.code === 'ERR_INVALID_STATE' ||
        reason?.message?.includes('Controller is already closed')
      ) {
        // Silently ignore — client disconnected during streaming
        return;
      }
      // Let other unhandled rejections propagate normally
      console.error('Unhandled Rejection:', reason);
    });
  }
}
