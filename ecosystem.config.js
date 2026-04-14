module.exports = {
  apps: [
    {
      name: 'aawsa-billing-web',
      script: 'node_modules/next/dist/bin/next',
      args: 'start',
      instances: 'max', // Utilize all CPU cores
      exec_mode: 'cluster',
      env: {
        NODE_ENV: 'production',
        PORT: 3000
      }
    },
    {
      name: 'aawsa-billing-worker',
      script: 'node_modules/next/dist/bin/next',
      args: 'start', // In Next.js, workers are often part of same app or separate scripts
      instances: 2,  // Dedicated worker instances
      exec_mode: 'cluster',
      env: {
        NODE_ENV: 'production',
        ROLE: 'worker'
      }
    }
  ]
};
