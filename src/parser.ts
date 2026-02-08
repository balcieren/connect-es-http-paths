/**
 * Proto file parser for extracting google.api.http annotations
 * Uses regex-based parsing (no external dependencies)
 * @module parser
 */

import type { HttpMethod, ParsedMethod, ParsedService } from "./types";

/**
 * Parse a proto file content and extract services with HTTP annotations
 * @param content - Raw proto file content
 * @returns Array of parsed services with their methods
 */
export function parseProtoFile(content: string): ParsedService[] {
  const services: ParsedService[] = [];

  // Extract package name
  const packageName = extractPackageName(content);

  // Extract all services
  const serviceMatches = extractServices(content);

  for (const serviceMatch of serviceMatches) {
    const serviceName = serviceMatch.name;
    const methods = extractMethods(serviceMatch.body);

    if (methods.length > 0) {
      services.push({
        packageName,
        serviceName,
        fullName: packageName ? `${packageName}.${serviceName}` : serviceName,
        methods,
      });
    }
  }

  return services;
}

/**
 * Parse multiple proto files and combine results
 * @param files - Array of proto file contents
 * @returns Combined array of parsed services
 */
export function parseProtoFiles(files: string[]): ParsedService[] {
  const allServices: ParsedService[] = [];

  for (const content of files) {
    const services = parseProtoFile(content);
    allServices.push(...services);
  }

  return allServices;
}

/**
 * Extract package name from proto file
 */
function extractPackageName(content: string): string {
  const match = content.match(/^\s*package\s+([\w.]+)\s*;/m);
  return match ? match[1] : "";
}

interface ServiceMatch {
  name: string;
  body: string;
}

/**
 * Extract all service definitions from proto content
 */
function extractServices(content: string): ServiceMatch[] {
  const services: ServiceMatch[] = [];
  const serviceRegex = /service\s+(\w+)\s*\{/g;

  let match: RegExpExecArray | null;
  while ((match = serviceRegex.exec(content)) !== null) {
    const serviceName = match[1];
    const startIndex = match.index + match[0].length;
    const body = extractBracedContent(content, startIndex);

    if (body) {
      services.push({ name: serviceName, body });
    }
  }

  return services;
}

/**
 * Extract content between matching braces
 */
function extractBracedContent(content: string, startIndex: number): string {
  let depth = 1;
  let i = startIndex;

  while (i < content.length && depth > 0) {
    if (content[i] === "{") {
      depth++;
    } else if (content[i] === "}") {
      depth--;
    }
    i++;
  }

  return content.slice(startIndex, i - 1);
}

/**
 * Extract RPC methods with HTTP annotations from service body
 */
function extractMethods(serviceBody: string): ParsedMethod[] {
  const methods: ParsedMethod[] = [];

  // Find all RPC definitions using a more flexible approach
  const rpcStartRegex =
    /rpc\s+(\w+)\s*\(\s*(\w+)\s*\)\s*returns\s*\(\s*([\w.]+)\s*\)\s*\{/g;

  let match: RegExpExecArray | null;
  while ((match = rpcStartRegex.exec(serviceBody)) !== null) {
    const methodName = match[1];
    const inputType = match[2];
    const outputType = match[3];
    const startIndex = match.index + match[0].length;

    // Extract the RPC body using brace matching
    const optionsBlock = extractBracedContent(serviceBody, startIndex);

    const httpAnnotation = parseHttpAnnotation(optionsBlock);

    if (httpAnnotation) {
      methods.push({
        name: methodName,
        inputType,
        outputType,
        httpMethod: httpAnnotation.method,
        httpPath: httpAnnotation.path,
        body: httpAnnotation.body,
      });
    }
  }

  return methods;
}

interface HttpAnnotation {
  method: HttpMethod;
  path: string;
  body?: string;
}

/**
 * Parse google.api.http annotation from options block
 */
function parseHttpAnnotation(optionsBlock: string): HttpAnnotation | null {
  // Check if google.api.http option exists
  if (!optionsBlock.includes("google.api.http")) {
    return null;
  }

  // Extract HTTP method and path
  const httpMethods: HttpMethod[] = ["GET", "POST", "PUT", "PATCH", "DELETE"];

  for (const method of httpMethods) {
    const methodLower = method.toLowerCase();
    // Match patterns like: get: "/v1/users/{user_id}" or get: '/v1/users/{user_id}'
    const pathRegex = new RegExp(
      `${methodLower}\\s*:\\s*["']([^"']+)["']`,
      "i",
    );
    const pathMatch = optionsBlock.match(pathRegex);

    if (pathMatch) {
      const path = pathMatch[1];

      // Extract optional body field
      const bodyRegex = /body\s*:\s*["']([^"']+)["']/;
      const bodyMatch = optionsBlock.match(bodyRegex);

      return {
        method,
        path,
        body: bodyMatch ? bodyMatch[1] : undefined,
      };
    }
  }

  return null;
}

/**
 * Get Connect path for a service method
 * @example "/users.v1.UserService/GetUser"
 */
export function getConnectPath(
  service: ParsedService,
  method: ParsedMethod,
): string {
  return `/${service.fullName}/${method.name}`;
}
