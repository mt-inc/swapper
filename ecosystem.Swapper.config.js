module.exports = {
  apps: [
    {
      name: 'binanceFutureSaveData',
      interpreter: 'bash',
      script: 'yarn.sh',
      args: 'run',
      watch: false,
    },
  ],
}
