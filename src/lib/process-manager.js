import { execSync } from 'node:child_process';

/**
 * Check if a pm2 process exists by name.
 * @param {string} name
 * @returns {boolean}
 */
function pm2Exists(name) {
  try {
    const output = execSync(`pm2 describe "${name}" 2>/dev/null`, { encoding: 'utf-8' });
    return output.includes(name);
  } catch {
    return false;
  }
}

/**
 * Restart the SillyTavern server via pm2.
 * @param {string} pm2Name - The pm2 process name
 * @returns {{ success: boolean, message: string }}
 */
export function restartServer(pm2Name) {
  if (!pm2Exists(pm2Name)) {
    return { success: false, message: `pm2 process "${pm2Name}" not found` };
  }

  try {
    execSync(`pm2 restart "${pm2Name}"`, { encoding: 'utf-8', stdio: 'pipe' });
    return { success: true, message: `pm2 restart "${pm2Name}" executed successfully` };
  } catch (err) {
    return { success: false, message: `pm2 restart failed: ${err.message}` };
  }
}

/**
 * Check if the server is responding on a given port.
 * @param {number} port
 * @param {number} [timeoutMs=5000]
 * @returns {Promise<boolean>}
 */
export async function checkServerHealth(port, timeoutMs = 5000) {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);

    const response = await fetch(`http://localhost:${port}`, {
      signal: controller.signal,
    });
    clearTimeout(timeout);
    return response.ok || response.status === 302 || response.status === 401;
  } catch {
    return false;
  }
}

/**
 * Get pm2 process status info.
 * @param {string} pm2Name
 * @returns {{ status: string, uptime: string, restarts: string } | null}
 */
export function getServerStatus(pm2Name) {
  try {
    const output = execSync(
      `pm2 jlist 2>/dev/null`,
      { encoding: 'utf-8' }
    );
    const processes = JSON.parse(output);
    const proc = processes.find(p => p.name === pm2Name);
    if (!proc) return null;

    return {
      status: proc.pm2_env?.status || 'unknown',
      uptime: proc.pm2_env?.pm_uptime
        ? `${Math.round((Date.now() - proc.pm2_env.pm_uptime) / 1000 / 60)} min`
        : 'unknown',
      restarts: String(proc.pm2_env?.restart_time ?? 'unknown'),
    };
  } catch {
    return null;
  }
}
