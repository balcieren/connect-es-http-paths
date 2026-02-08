/**
 * Type definitions for connect-rest-adapter plugin
 * @module types
 */

/**
 * HTTP methods supported by google.api.http annotations
 */
export type HttpMethod = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";

/**
 * Parsed RPC method information including HTTP annotation details
 */
export interface ParsedMethod {
  /** Method name (e.g., "GetUser") */
  name: string;
  /** Input message type (e.g., "GetUserRequest") */
  inputType: string;
  /** Output message type (e.g., "GetUserResponse") */
  outputType: string;
  /** HTTP method from google.api.http annotation */
  httpMethod: HttpMethod;
  /** HTTP path from google.api.http annotation (e.g., "/v1/users/{user_id}") */
  httpPath: string;
  /** Request body field, if specified (e.g., "*" or "user") */
  body?: string;
}

/**
 * Parsed service information containing all RPC methods
 */
export interface ParsedService {
  /** Package name (e.g., "users.v1") */
  packageName: string;
  /** Service name (e.g., "UserService") */
  serviceName: string;
  /** Full qualified name (e.g., "users.v1.UserService") */
  fullName: string;
  /** All parsed RPC methods with HTTP annotations */
  methods: ParsedMethod[];
}

/**
 * Path mapping from Connect path to HTTP path
 */
export interface PathMapping {
  /** HTTP REST path (e.g., "/v1/users/{user_id}") */
  path: string;
  /** HTTP method (e.g., "GET") */
  method: HttpMethod;
  /** Request body field (e.g., "*" for all fields, "user" for a specific field) */
  body?: string;
}
