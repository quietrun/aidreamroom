import { createHash } from "crypto"
export function sha1(str) {
    let sha = createHash('sha1');
    sha.update(str);
    return sha.digest('hex');
}