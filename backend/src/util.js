// Broadcast system error to client
const broadcastSystemError = (wsClient, message) => {
  if (wsClient.readyState === WebSocket.OPEN) {
    wsClient.send(
      JSON.stringify({
        type: 'SYSTEM_ERROR',
        payload: { message }
      })
    );
    // Force close client connection
    wsClient.close();
  }
};

module.exports = {
  broadcastSystemError
};
