// pm2 process definition for the WS server (EC2 t4g.nano, 512 MB RAM).
// max_memory_restart caps a leak before it can starve the OS (docs/decisions.md D11).
module.exports = {
  apps: [
    {
      name: "airpair-server",
      script: "dist/server.js",
      max_memory_restart: "150M",
      exp_backoff_restart_delay: 1000,
    },
  ],
};
