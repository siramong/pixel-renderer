const { spawn } = require("child_process");
const readline = require("readline");

const npmCommand = process.platform === "win32" ? "npm.cmd" : "npm";

const processes = [
  {
    name: "backend",
    command: npmCommand,
    args: ["run", "dev", "--prefix", "backend"],
  },
  {
    name: "frontend",
    command: npmCommand,
    args: ["run", "dev", "--prefix", "frontend"],
  },
]

const children = new Map();
let shuttingDown = false;

function prefixStream(name, stream) {
  const reader = readline.createInterface({ input: stream });

  reader.on("line", (line) => {
    process.stdout.write(`[${name}] ${line}\n`);
  });
}

function stopAll(exitCode = 0) {
  if (shuttingDown) return;
  shuttingDown = true;

  for (const child of children.values()) {
    if (!child.killed) {
      child.kill("SIGTERM");
    }
  }

  setTimeout(() => {
    for (const child of children.values()) {
      if (!child.killed) {
        child.kill("SIGKILL");
      }
    }
    process.exit(exitCode);
  }, 800).unref();
}

for (const processConfig of processes) {
  const child = spawn(processConfig.command, processConfig.args, {
    cwd: process.cwd(),
    env: process.env,
    windowsHide: true,
    stdio: ["ignore", "pipe", "pipe"],
  });

  children.set(processConfig.name, child);

  process.stdout.write(`[${processConfig.name}] starting...\n`);
  if (child.stdout) prefixStream(processConfig.name, child.stdout);
  if (child.stderr) prefixStream(processConfig.name, child.stderr);

  child.on("exit", (code, signal) => {
    children.delete(processConfig.name);

    if (shuttingDown) {
      return;
    }

    const exitCode = typeof code === "number" ? code : 1;
    process.stderr.write(
      `[${processConfig.name}] exited ${signal ? `with signal ${signal}` : `with code ${exitCode}`}. Stopping the other process.\n`,
    );
    stopAll(exitCode);
  });

  child.on("error", (error) => {
    process.stderr.write(`[${processConfig.name}] failed to start: ${error.message}\n`);
    stopAll(1);
  });
}

process.on("SIGINT", () => stopAll(0));
process.on("SIGTERM", () => stopAll(0));