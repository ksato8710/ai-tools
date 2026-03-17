import { spawn } from "child_process";

export function callClaude(
  prompt: string,
  model = "sonnet",
  timeoutMs = 600_000
): Promise<string> {
  return new Promise<string>((resolve, reject) => {
    const proc = spawn(
      "claude",
      ["-p", "--model", model, "--output-format", "json"],
      {
        env: { ...process.env },
        stdio: ["pipe", "pipe", "pipe"],
        timeout: timeoutMs,
      }
    );

    proc.stdin.end(prompt);

    let stdout = "";
    let stderr = "";

    proc.stdout.on("data", (chunk: Buffer) => {
      stdout += chunk.toString();
    });

    proc.stderr.on("data", (chunk: Buffer) => {
      stderr += chunk.toString();
    });

    proc.on("close", (code) => {
      if (code !== 0) {
        reject(new Error(`Claude exited with code ${code}: ${stderr || stdout}`));
        return;
      }
      try {
        const parsed = JSON.parse(stdout);
        resolve(parsed.result || "");
      } catch {
        resolve(stdout);
      }
    });

    proc.on("error", (err) => reject(err));
  });
}
