module.exports = {
  apps: [{
    name: 'discord-activity',
    script: 'server/dist/server.js',
    instances: 'max',
    exec_mode: 'cluster',
    autorestart: true,
    watch: false,
    max_memory_restart: '500M',
    env: {
      NODE_ENV: 'production',
    },
    log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
    merge_logs: true,
    out_file: 'logs/app.log',
    error_file: 'logs/error.log'
  }]
} 