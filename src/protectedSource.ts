import * as vscode from "vscode";

const CODE_FOR_IBMI_ID = `halcyontechltd.code-for-ibmi`;

type ObjectFilter = {
  name: string;
  protected: boolean;
};

type ConnectionConfig = {
  readOnlyMode?: boolean;
  protectedPaths?: string[];
  objectFilters?: ObjectFilter[];
};

type CodeForIbmiConnection = {
  getConfig(): ConnectionConfig;
  getContent?: () => { isProtectedPath?(path: string): boolean };
  upperCaseName?(value: string): string;
};

type CodeForIbmiInstance = {
  getConnection(): CodeForIbmiConnection | undefined;
};

/** Loose Object Browser / IFS node fields used for protection checks. */
export type BrowserProtectionNode = {
  path?: string;
  resourceUri?: vscode.Uri;
  filter?: string | { name?: string; protected?: boolean };
  protected?: boolean;
  parent?: BrowserProtectionNode;
  member?: {
    asp?: string;
    library: string;
    file: string;
    name: string;
    extension: string;
  };
};

function getIbmiInstance(): CodeForIbmiInstance | undefined {
  const ext = vscode.extensions.getExtension<{ instance?: CodeForIbmiInstance }>(CODE_FOR_IBMI_ID);
  return ext?.isActive ? ext.exports?.instance : undefined;
}

function parseReadonlyQuery(uri: vscode.Uri): boolean {
  if (!uri.query) {
    return false;
  }
  const params = new URLSearchParams(uri.query);
  return params.get(`readonly`) === `true`;
}

function upper(connection: CodeForIbmiConnection | undefined, value: string): string {
  return connection?.upperCaseName?.(value) ?? value.toUpperCase();
}

function filterName(filter: BrowserProtectionNode[`filter`]): string | undefined {
  if (!filter) {
    return undefined;
  }
  if (typeof filter === `string`) {
    return filter;
  }
  return filter.name;
}

function filterMarkedProtected(filter: BrowserProtectionNode[`filter`]): boolean {
  return typeof filter === `object` && !!filter?.protected;
}

/** True when `uriPath` is exactly `protectedPath` or a nested path under it (not a sibling prefix). */
export function uriPathMatchesProtectedPath(uriPath: string, protectedPath: string): boolean {
  if (uriPath === protectedPath) {
    return true;
  }
  const prefix = protectedPath.endsWith(`/`) ? protectedPath : `${protectedPath}/`;
  return uriPath.startsWith(prefix);
}

/**
 * True when Code for IBM i considers this source protected (filter / path /
 * connection browse / readonly URI) and it must not open in the designer.
 */
export async function isProtectedDdsSource(
  uri: vscode.Uri,
  browserNode?: BrowserProtectionNode
): Promise<boolean> {
  // Explicit readonly URI (protected filter / browse open)
  if (parseReadonlyQuery(uri)) {
    return true;
  }

  if (browserNode) {
    if (browserNode.protected === true || filterMarkedProtected(browserNode.filter)) {
      return true;
    }
    if (browserNode.parent?.protected === true || filterMarkedProtected(browserNode.parent?.filter)) {
      return true;
    }
  }

  const instance = getIbmiInstance();
  const connection = instance?.getConnection();
  const config = connection?.getConfig();

  if (config?.readOnlyMode) {
    return true;
  }

  // Named filter from Object Browser → objectFilters[].protected
  const named =
    filterName(browserNode?.filter) ??
    filterName(browserNode?.parent?.filter);
  if (named && config?.objectFilters?.some((f) => f.name === named && f.protected)) {
    return true;
  }

  // Protected paths (library or IFS) — cannot be overridden in Code for IBM i
  const content = connection?.getContent?.();
  if (uri.scheme === `member`) {
    const parts = uri.path.split(`/`).filter(Boolean);
    // /LIB/FILE/MBR.ext or /ASP/LIB/FILE/MBR.ext
    const library = parts.length >= 4 ? parts[1] : parts[0];
    if (library) {
      const qsysPath = `${upper(connection, library)}`;
      if (content?.isProtectedPath?.(qsysPath) || content?.isProtectedPath?.(uri.path.replace(/^\//, ``))) {
        return true;
      }
      if (config?.protectedPaths?.some((p) => upper(connection, p) === upper(connection, library))) {
        return true;
      }
    }
  }

  if (uri.scheme === `streamfile`) {
    if (content?.isProtectedPath?.(uri.path)) {
      return true;
    }
    if (
      config?.protectedPaths?.some((p) => uriPathMatchesProtectedPath(uri.path, p))
    ) {
      return true;
    }
  }

  // FS provider marks the resource readonly (protected filter / browse)
  if (uri.scheme === `member` || uri.scheme === `streamfile` || uri.scheme === `object`) {
    try {
      const stat = await vscode.workspace.fs.stat(uri);
      if (stat.permissions === vscode.FilePermission.Readonly) {
        return true;
      }
    } catch {
      // Not readable / not connected — don't block solely on this
    }
  }

  return false;
}

export function protectedSourceMessage(uri: vscode.Uri): string {
  const name = uri.path.split(`/`).pop() || uri.path;
  return `"${name}" is from a protected / read-only IBM i source and cannot be opened in the Display File Designer. Open it in the text editor to browse.`;
}
