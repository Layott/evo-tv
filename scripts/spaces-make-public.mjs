/**
 * Repair every upload the bucket kept private.
 *
 * The presigned PUT asks for `public-read` in its query string and the bucket
 * did not apply it, so images the CMS uploaded answered `AccessDenied` on both
 * the CDN and the origin. The stream thumbnail on /admin/streams was the one
 * somebody noticed; everything uploaded the same way has the same problem.
 *
 * New uploads are fixed at the source (the finalize step sets the ACL server
 * side and reads the file back before saving the URL). This is for the files
 * already up there.
 *
 * Run it where the Spaces credentials are, which is the droplet:
 *
 *   node scripts/spaces-make-public.mjs           # report only
 *   node scripts/spaces-make-public.mjs --fix     # set ACLs and re-check
 */
import { config } from "dotenv";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import {
  S3Client,
  ListObjectsV2Command,
  PutObjectAclCommand,
} from "@aws-sdk/client-s3";

const __dirname = dirname(fileURLToPath(import.meta.url));
config({ path: resolve(__dirname, "..", ".env.local") });

const FIX = process.argv.includes("--fix");
const REGION = process.env.SPACES_REGION ?? "fra1";
const BUCKET = process.env.SPACES_BUCKET ?? "";
const KEY = process.env.SPACES_KEY ?? "";
const SECRET = process.env.SPACES_SECRET ?? "";
const ENDPOINT = (
  process.env.SPACES_ENDPOINT ?? `https://${REGION}.digitaloceanspaces.com`
).replace(/\/+$/, "");
const PUBLIC_BASE = (
  process.env.SPACES_CDN_URL ?? `https://${BUCKET}.${REGION}.digitaloceanspaces.com`
).replace(/\/+$/, "");

if (!BUCKET || !KEY || !SECRET) {
  console.error(
    "No Spaces credentials. This has to run where SPACES_KEY / SPACES_SECRET / SPACES_BUCKET are set, which is the droplet.",
  );
  process.exit(1);
}

const s3 = new S3Client({
  region: "us-east-1",
  endpoint: ENDPOINT,
  credentials: { accessKeyId: KEY, secretAccessKey: SECRET },
});

async function* allKeys(prefix) {
  let token;
  do {
    const page = await s3.send(
      new ListObjectsV2Command({
        Bucket: BUCKET,
        Prefix: prefix,
        ContinuationToken: token,
      }),
    );
    for (const obj of page.Contents ?? []) yield obj.Key;
    token = page.IsTruncated ? page.NextContinuationToken : undefined;
  } while (token);
}

async function readable(key) {
  try {
    const res = await fetch(`${PUBLIC_BASE}/${key}`, { method: "HEAD" });
    return res.status;
  } catch {
    return 0;
  }
}

let checked = 0;
let broken = 0;
let repaired = 0;
const stillBroken = [];

for (const prefix of ["admin-uploads/", "downloads/"]) {
  for await (const key of allKeys(prefix)) {
    checked++;
    const before = await readable(key);
    if (before === 200) continue;
    broken++;
    if (!FIX) {
      console.log(`private  ${before}  ${key}`);
      continue;
    }
    await s3.send(
      new PutObjectAclCommand({ Bucket: BUCKET, Key: key, ACL: "public-read" }),
    );
    const after = await readable(key);
    if (after === 200) {
      repaired++;
      console.log(`fixed         ${key}`);
    } else {
      stillBroken.push({ key, after });
      console.log(`STILL ${after}  ${key}`);
    }
  }
}

console.log(
  `\n${checked} objects, ${broken} not publicly readable${FIX ? `, ${repaired} repaired` : ""}.`,
);
if (!FIX && broken > 0) console.log("Re-run with --fix to set the ACLs.");
if (stillBroken.length > 0) {
  console.log(
    "\nThese did not become readable even after the ACL call. That points at a bucket policy rather than per-object ACLs:",
  );
  for (const s of stillBroken) console.log(`  ${s.after}  ${s.key}`);
  process.exitCode = 1;
}
