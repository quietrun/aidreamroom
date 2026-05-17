import { mkdir, readdir, rename, rm, stat, writeFile } from 'fs/promises';
import { dirname, extname, join, relative, resolve } from 'path';
import sharp, { FormatEnum, Sharp } from 'sharp';

const IMAGE_EXTENSIONS = new Set(['.jpg', '.jpeg', '.png', '.webp', '.avif']);
const DEFAULT_TARGET_BYTES = 600 * 1024;

type CliOptions = {
  apply: boolean;
  backup: boolean;
  dir: string;
  includeSmall: boolean;
  targetBytes: number;
};

type ImageCandidate = {
  buffer: Buffer;
  height?: number;
  quality: number;
  width?: number;
};

type Summary = {
  changed: number;
  failed: number;
  scanned: number;
  skipped: number;
  totalSaved: number;
};

function parseArgs(): CliOptions {
  const args = process.argv.slice(2);
  const options: CliOptions = {
    apply: false,
    backup: false,
    dir: resolve(process.cwd(), process.env.LOCAL_UPLOAD_DIR ?? 'uploads'),
    includeSmall: false,
    targetBytes: DEFAULT_TARGET_BYTES,
  };

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    const next = args[index + 1];

    if (arg === '--apply') {
      options.apply = true;
    } else if (arg === '--backup') {
      options.backup = true;
    } else if (arg === '--include-small') {
      options.includeSmall = true;
    } else if (arg === '--dir' && next) {
      options.dir = resolve(process.cwd(), next);
      index += 1;
    } else if (arg === '--max-kb' && next) {
      options.targetBytes = Math.max(1, Number(next)) * 1024;
      index += 1;
    } else if (arg === '--help' || arg === '-h') {
      printHelp();
      process.exit(0);
    } else {
      throw new Error(`Unknown option: ${arg}`);
    }
  }

  return options;
}

function printHelp() {
  console.log(`
Compress images in uploads.

Usage:
  npm run uploads:compress
  npm run uploads:compress -- --apply

Options:
  --apply           Write compressed images. Without this, only prints a dry-run report.
  --backup          Keep a .bak copy before overwriting. Only works with --apply.
  --dir <path>      Directory to scan. Default: LOCAL_UPLOAD_DIR or ./uploads.
  --max-kb <n>      Target max size in KB. Default: 600.
  --include-small   Also try to recompress images already under the target.
`);
}

async function walkImages(root: string): Promise<string[]> {
  const entries = await readdir(root, { withFileTypes: true });
  const files = await Promise.all(
    entries.map(async (entry) => {
      const fullPath = join(root, entry.name);
      if (entry.isDirectory()) {
        return walkImages(fullPath);
      }
      if (entry.isFile() && IMAGE_EXTENSIONS.has(extname(entry.name).toLowerCase())) {
        return [fullPath];
      }
      return [];
    }),
  );

  return files.flat();
}

function getOutputPipeline(input: Sharp, extension: string, quality: number): Sharp {
  const normalizedExtension = extension.toLowerCase();

  if (normalizedExtension === '.jpg' || normalizedExtension === '.jpeg') {
    return input.jpeg({
      mozjpeg: true,
      quality,
    });
  }

  if (normalizedExtension === '.png') {
    return input.png({
      adaptiveFiltering: true,
      compressionLevel: 9,
      effort: 10,
      palette: true,
      quality,
    });
  }

  if (normalizedExtension === '.webp') {
    return input.webp({
      effort: 6,
      quality,
    });
  }

  if (normalizedExtension === '.avif') {
    return input.avif({
      effort: 9,
      quality,
    });
  }

  return input.toFormat(extname(extension).slice(1) as keyof FormatEnum);
}

async function makeCandidate(
  filePath: string,
  extension: string,
  quality: number,
): Promise<ImageCandidate> {
  const pipeline = sharp(filePath, { limitInputPixels: false }).rotate();
  const metadata = await sharp(filePath, { limitInputPixels: false }).metadata();

  const buffer = await getOutputPipeline(pipeline, extension, quality).toBuffer();

  return {
    buffer,
    height: metadata.height,
    quality,
    width: metadata.width,
  };
}

async function compressImage(filePath: string, options: CliOptions): Promise<ImageCandidate | null> {
  const extension = extname(filePath);
  const qualitySteps = extension.toLowerCase() === '.png'
    ? [90, 80, 70, 60, 50, 40, 32, 24]
    : [86, 78, 70, 62, 54, 46, 38, 30];

  let best: ImageCandidate | null = null;

  for (const quality of qualitySteps) {
    const candidate = await makeCandidate(filePath, extension, quality);
    if (!best || candidate.buffer.length < best.buffer.length) {
      best = candidate;
    }
    if (candidate.buffer.length <= options.targetBytes) {
      return candidate;
    }
  }

  return best;
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
}

async function replaceFile(filePath: string, buffer: Buffer, keepBackup: boolean) {
  const tempPath = `${filePath}.tmp-compressed`;
  const backupPath = `${filePath}.bak`;

  await writeFile(tempPath, buffer);

  if (keepBackup) {
    await rm(backupPath, { force: true });
    await rename(filePath, backupPath);
  } else {
    await rm(filePath);
  }

  await rename(tempPath, filePath);
}

async function run() {
  const options = parseArgs();
  const summary: Summary = {
    changed: 0,
    failed: 0,
    scanned: 0,
    skipped: 0,
    totalSaved: 0,
  };

  await mkdir(options.dir, { recursive: true });
  const files = await walkImages(options.dir);
  console.log(`Scanning ${files.length} image(s) in ${options.dir}`);
  console.log(`Mode: ${options.apply ? 'apply' : 'dry-run'}, target: ${formatBytes(options.targetBytes)}`);

  for (const filePath of files) {
    summary.scanned += 1;

    try {
      const fileStat = await stat(filePath);
      const originalSize = fileStat.size;

      if (!options.includeSmall && originalSize <= options.targetBytes) {
        summary.skipped += 1;
        console.log(`skip ${relative(options.dir, filePath)} (${formatBytes(originalSize)})`);
        continue;
      }

      const candidate = await compressImage(filePath, options);
      if (!candidate || candidate.buffer.length >= originalSize) {
        summary.skipped += 1;
        console.log(`skip ${relative(options.dir, filePath)} (${formatBytes(originalSize)}, no smaller output)`);
        continue;
      }

      const saved = originalSize - candidate.buffer.length;
      summary.changed += 1;
      summary.totalSaved += saved;

      const detail = `quality=${candidate.quality}, size=${candidate.width ?? '?'}x${candidate.height ?? '?'}`;
      console.log(
        `${options.apply ? 'write' : 'would write'} ${relative(options.dir, filePath)} ` +
        `${formatBytes(originalSize)} -> ${formatBytes(candidate.buffer.length)} ` +
        `saved ${formatBytes(saved)} (${detail})`,
      );

      if (options.apply) {
        await mkdir(dirname(filePath), { recursive: true });
        await replaceFile(filePath, candidate.buffer, options.backup);
      }
    } catch (error) {
      summary.failed += 1;
      console.error(`fail ${relative(options.dir, filePath)}:`, error instanceof Error ? error.message : error);
    }
  }

  console.log(
    `Done. scanned=${summary.scanned}, changed=${summary.changed}, skipped=${summary.skipped}, ` +
    `failed=${summary.failed}, saved=${formatBytes(summary.totalSaved)}`,
  );

  if (!options.apply) {
    console.log('Dry-run only. Re-run with --apply to overwrite files.');
  }
}

run().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
