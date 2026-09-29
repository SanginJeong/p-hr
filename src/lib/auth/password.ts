import { randomBytes, scrypt as scryptCallback, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";

const scrypt = promisify(scryptCallback);

const KEY_LENGTH = 64;
const SALT_LENGTH = 16;
const PREFIX = "scrypt";

/**
 * 비밀번호를 scrypt 로 해싱한다. 외부 의존성 없이 Node 내장 crypto 만 쓴다.
 * 저장 형식: `scrypt$<salt-hex>$<hash-hex>`
 */
export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(SALT_LENGTH);
  const derived = (await scrypt(password, salt, KEY_LENGTH)) as Buffer;

  return `${PREFIX}$${salt.toString("hex")}$${derived.toString("hex")}`;
}

/** 저장된 해시와 비교한다. 형식이 깨져 있으면 조용히 false. */
export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const [prefix, saltHex, hashHex] = stored.split("$");

  if (prefix !== PREFIX || !saltHex || !hashHex) {
    return false;
  }

  const expected = Buffer.from(hashHex, "hex");
  const derived = (await scrypt(password, Buffer.from(saltHex, "hex"), expected.length)) as Buffer;

  return timingSafeEqual(expected, derived);
}
