module.exports = {
  apps: [
    {
      name: 'Swapper',
      interpreter: 'bash',
      script: 'yarn.sh',
      args: 'dev',
      watch: false,
    },
  ],
}
