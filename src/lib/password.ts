import { randomInt } from "crypto";

// Алфавит без неоднозначных символов (0/O, 1/l/I) для удобной передачи пароля
const PASSWORD_CHARS =
  "ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789";

/**
 * Генерирует криптостойкий временный пароль.
 * Использует crypto.randomInt вместо небезопасного Math.random.
 *
 * @param length длина пароля (по умолчанию 12)
 */
export function generatePassword(length = 12): string {
  let password = "";
  for (let i = 0; i < length; i++) {
    password += PASSWORD_CHARS[randomInt(0, PASSWORD_CHARS.length)];
  }
  return password;
}
