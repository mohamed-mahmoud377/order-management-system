module.exports = async () => {
  const container = (global as any).__PG_CONTAINER__;
  if (container) {
    try {
      await container.stop();
    } catch (e) {
      // ignore
    }
  }
};
