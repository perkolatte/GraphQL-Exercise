// Shared CLI wrapper for Node.js scripts
// Usage: require('../lib/cli-wrapper')(main);

module.exports = function runCli(main) {
  if (require.main === module) {
    (async () => {
      try {
        const code = await main();
        process.exit(code || 0);
      } catch (err) {
        console.error(err.message || err);
        process.exit(1);
      }
    })();
  }
};
