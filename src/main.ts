#!/usr/bin/env node
/**
 * Main entry point for connect-rest-adapter Buf plugin
 * Handles Buf plugin protocol (stdin/stdout) for CodeGeneratorRequest/Response
 * @module main
 */

import * as fs from "node:fs";
import * as path from "node:path";
import { generateRestAdapter } from "./generator";
import { parseProtoFile } from "./parser";
import type { ParsedService } from "./types";

/**
 * Read all input from stdin
 */
async function readStdin(): Promise<Buffer> {
  const chunks: Buffer[] = [];

  for await (const chunk of process.stdin) {
    chunks.push(chunk);
  }

  return Buffer.concat(chunks);
}

/**
 * Process proto files from a directory (for local testing)
 */
async function processLocalProtoFiles(
  protoDir: string,
  outputDir: string,
): Promise<void> {
  const protoFiles: string[] = [];

  // Read all .proto files from directory
  const files = fs.readdirSync(protoDir, { recursive: true }) as string[];
  for (const file of files) {
    if (typeof file === "string" && file.endsWith(".proto")) {
      const fullPath = path.join(protoDir, file);
      const content = fs.readFileSync(fullPath, "utf-8");
      protoFiles.push(content);
    }
  }

  if (protoFiles.length === 0) {
    console.error("No .proto files found");
    process.exit(1);
  }

  // Parse all proto files
  const allServices: ParsedService[] = [];
  for (const content of protoFiles) {
    const services = parseProtoFile(content);
    allServices.push(...services);
  }

  if (allServices.length === 0) {
    console.error("No services with google.api.http annotations found");
    process.exit(1);
  }

  // Generate output
  const restAdapterContent = generateRestAdapter(allServices);

  // Ensure output directory exists
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  // Write file
  fs.writeFileSync(path.join(outputDir, "rest-adapter.ts"), restAdapterContent);

  console.log(`Generated files in ${outputDir}:`);
  console.log("  - rest-adapter.ts");
  console.log(
    `\nFound ${allServices.length} service(s) with ${allServices.reduce((sum, s) => sum + s.methods.length, 0)} method(s)`,
  );
}

/**
 * Handle Buf plugin protocol
 * Reads CodeGeneratorRequest from stdin, writes CodeGeneratorResponse to stdout
 */
async function handleBufPlugin(): Promise<void> {
  const input = await readStdin();

  // For now, we'll parse a simple text-based protocol
  // In a full implementation, this would use protobuf encoding
  const inputStr = input.toString("utf-8");

  // Check if this is raw proto content (for testing) or a file list
  let protoContents: string[] = [];
  let outputDir = ".";

  // Try to parse as JSON config first
  try {
    const config = JSON.parse(inputStr);
    if (config.files && Array.isArray(config.files)) {
      protoContents = config.files;
    }
    if (config.outputDir) {
      outputDir = config.outputDir;
    }
  } catch {
    // If not JSON, treat as raw proto content
    protoContents = [inputStr];
  }

  // Parse all proto content
  const allServices: ParsedService[] = [];
  for (const content of protoContents) {
    const services = parseProtoFile(content);
    allServices.push(...services);
  }

  // Generate output
  const restAdapterContent = generateRestAdapter(allServices);

  // Output as JSON response
  const response = {
    files: [
      {
        name: "rest-adapter.ts",
        content: restAdapterContent,
      },
    ],
    services: allServices.map((s) => s.fullName),
    methodCount: allServices.reduce((sum, s) => sum + s.methods.length, 0),
  };

  process.stdout.write(JSON.stringify(response, null, 2));
}

/**
 * Main entry point
 */
async function main(): Promise<void> {
  const args = process.argv.slice(2);

  // Check for local mode
  if (args.includes("--local") || args.includes("-l")) {
    const protoDir = args.find((a) => !a.startsWith("-")) || "./proto";
    const outIndex =
      args.indexOf("--out") !== -1 ? args.indexOf("--out") : args.indexOf("-o");
    const outputDir =
      outIndex !== -1 && args[outIndex + 1]
        ? args[outIndex + 1]
        : "./generated";

    await processLocalProtoFiles(protoDir, outputDir);
    return;
  }

  // Check if stdin has data (piped input)
  if (!process.stdin.isTTY) {
    await handleBufPlugin();
    return;
  }

  // Show help
  console.log(`
connect-rest-adapter - Generate REST adapter for Connect-RPC

Usage:
  # Local mode - process proto files from a directory
  connect-rest-adapter --local [proto-dir] --out [output-dir]

  # Buf plugin mode - pipe proto content
  cat proto/user.proto | connect-rest-adapter

  # With Buf
  buf generate

Options:
  --local, -l    Process local proto files
  --out, -o      Output directory (default: ./generated)
  --help, -h     Show this help message

Examples:
  connect-rest-adapter --local ./proto --out ./src/generated
  echo "syntax = \\"proto3\\"; ..." | connect-rest-adapter
`);
}

main().catch((err) => {
  console.error("Error:", err);
  process.exit(1);
});
