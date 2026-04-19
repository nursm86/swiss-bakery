import argon2 from "argon2";
import readline from "node:readline";

const rl = readline.createInterface({ input: process.stdin, output: process.stderr });
const q = (prompt: string) =>
  new Promise<string>((resolve) => {
    rl.question(prompt, (ans) => resolve(ans));
  });

const password = process.argv[2] ?? (await q("Enter admin password (min 12 chars): "));
rl.close();

if (!password || password.length < 12) {
  process.stderr.write("Password must be at least 12 characters.\n");
  process.exit(1);
}

const hash = await argon2.hash(password, { type: argon2.argon2id });
process.stdout.write(hash + "\n");
process.stderr.write("\nPaste the line above into .env as ADMIN_PASSWORD_HASH=<hash>\n");
