#!/usr/bin/env node
// Starts the Expo dev server in a way that works for a physical phone on Windows.
//
//   npm run start:phone     LAN mode. Phone and PC on the same network, and Windows Firewall must allow
//                           inbound connections to node.exe (it is blocked on "Public" networks by default).
//   npm run start:tunnel    Tunnel mode. Metro is reached through an outbound ngrok tunnel, so no inbound
//                           firewall rule is needed for the dev server.
//
// Machines with WSL/Docker/Hyper-V have virtual network adapters, and Expo may advertise one of those
// addresses in the QR code. REACT_NATIVE_PACKAGER_HOSTNAME pins the real LAN address instead.
const os = require("node:os");
const path = require("node:path");
const { spawn } = require("node:child_process");

const root = path.resolve(__dirname, "..");
const expoBin = path.join(root, "node_modules", "expo", "bin", "cli");
const passthrough = process.argv.slice(2);

function lanAddress() {
  const virtual = /vethernet|wsl|docker|virtualbox|vmware|hyper-v|loopback|tailscale|zerotier/i;
  for (const [name, entries] of Object.entries(os.networkInterfaces())) {
    if (virtual.test(name)) continue;
    for (const entry of entries || []) {
      if (entry.family === "IPv4" && !entry.internal && !entry.address.startsWith("169.254.")) return entry.address;
    }
  }
  return null;
}

const env = { ...process.env };
const address = lanAddress();
if (address && !env.REACT_NATIVE_PACKAGER_HOSTNAME && !passthrough.includes("--tunnel")) {
  env.REACT_NATIVE_PACKAGER_HOSTNAME = address;
  console.log(`Advertising dev server at ${address} (virtual adapters ignored).`);
}

const child = spawn(process.execPath, [expoBin, "start", ...passthrough], { cwd: root, stdio: "inherit", env });
child.on("exit", (code) => process.exit(code ?? 0));
