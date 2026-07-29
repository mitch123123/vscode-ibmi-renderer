import * as vscode from "vscode";

const CODE_FOR_IBMI_ID = `halcyontechltd.code-for-ibmi`;

/**
 * IBM i system-object name (aka "short name"): 1–10 characters,
 * starting with A–Z / @ / # / $ and continuing with A–Z / 0–9 / @ / # / $.
 * Used to validate library and file names before we build SQL against QSYS2.SYSCOLUMNS.
 */
const IBMI_IDENTIFIER = /^[A-Z@#$][A-Z0-9@#$]{0,9}$/;

export type DbFieldDef = {
  name: string;
  type: string;
  length: number;
  decimals: number;
  heading?: string;
};

type SqlRow = Record<string, unknown>;

export function isIbmiConnectedForSql(): boolean {
  return !!getIbmiContent()?.runSQL;
}

function getIbmiContent(): { runSQL?: (sql: string) => Promise<SqlRow[]> } | undefined {
  const ext = vscode.extensions.getExtension<{
    instance?: {
      getConnection?: () => { getContent?: () => unknown } | undefined;
      getContent?: () => unknown;
    };
  }>(CODE_FOR_IBMI_ID);
  if (!ext?.isActive || !ext.exports?.instance) {
    return undefined;
  }
  const instance = ext.exports.instance;
  const conn = instance.getConnection?.();
  const content =
    (conn && typeof (conn as { getContent?: () => unknown }).getContent === `function`
      ? (conn as { getContent: () => unknown }).getContent()
      : undefined) ||
    (typeof instance.getContent === `function` ? instance.getContent() : undefined);
  return content as { runSQL?: (sql: string) => Promise<SqlRow[]> } | undefined;
}

function isValidIbmiIdentifier(value: string): boolean {
  return IBMI_IDENTIFIER.test((value || ``).trim().toUpperCase());
}

function mapSqlType(dataType: string, length: number, scale: number): { type: string; length: number; decimals: number } {
  const t = (dataType || ``).toUpperCase();
  if (t.includes(`DATE`)) {
    return { type: `L`, length: length || 10, decimals: 0 };
  }
  if (t.includes(`TIME`) && !t.includes(`STAMP`)) {
    return { type: `T`, length: length || 8, decimals: 0 };
  }
  if (t.includes(`TIMESTAMP`) || t.includes(`TIMESTMP`)) {
    return { type: `Z`, length: length || 26, decimals: 0 };
  }
  if (t.includes(`PACKED`) || t === `DECIMAL` || t === `NUMERIC` || t.includes(`ZONED`)) {
    return { type: t.includes(`PACKED`) ? `P` : `S`, length: length || 7, decimals: scale || 0 };
  }
  if (t.includes(`BINARY`) || t.includes(`INTEGER`) || t === `SMALLINT` || t === `BIGINT`) {
    return { type: `I`, length: length || 4, decimals: 0 };
  }
  if (t.includes(`FLOAT`) || t.includes(`DECFLOAT`) || t.includes(`DOUBLE`)) {
    return { type: `F`, length: length || 4, decimals: scale || 0 };
  }
  return { type: `A`, length: length || 10, decimals: 0 };
}

/**
 * Interactive browse: prompt library/file then load SYSCOLUMNS via Code for IBM i.
 * Returns undefined if cancelled or unavailable.
 */
export async function browseDatabaseFieldsInteractive(
  defaults?: { library?: string; file?: string }
): Promise<{ library: string; file: string; recordFormat: string; fields: DbFieldDef[]; error?: string } | undefined> {
  const content = getIbmiContent();
  if (!content?.runSQL) {
    vscode.window.showWarningMessage(
      `Connect with Code for IBM i to browse database fields, or add fields manually with REFFLD.`
    );
    return undefined;
  }

  const library = (
    await vscode.window.showInputBox({
      title: `Database library`,
      prompt: `Library containing the physical/logical file`,
      value: defaults?.library || ``,
      validateInput: (v) => {
        const t = v.trim().toUpperCase();
        if (!t) {
          return `Library is required`;
        }
        if (!isValidIbmiIdentifier(t)) {
          return `Invalid library name (1–10 chars, A–Z @ # $)`;
        }
        return undefined;
      },
    })
  )?.trim().toUpperCase();
  if (!library) {
    return undefined;
  }

  const file = (
    await vscode.window.showInputBox({
      title: `Database file`,
      prompt: `Physical or logical file name`,
      value: defaults?.file || ``,
      validateInput: (v) => {
        const t = v.trim().toUpperCase();
        if (!t) {
          return `File is required`;
        }
        if (!isValidIbmiIdentifier(t)) {
          return `Invalid file name (1–10 chars, A–Z @ # $)`;
        }
        return undefined;
      },
    })
  )?.trim().toUpperCase();
  if (!file) {
    return undefined;
  }

  // Defense-in-depth: the input-box validators already reject invalid names,
  // but we re-check before touching SQL so a future validator regression cannot
  // produce an unsafe query. Combined with the single-quote escape below this
  // keeps QSYS2.SYSCOLUMNS access free of injection risk.
  if (!isValidIbmiIdentifier(library) || !isValidIbmiIdentifier(file)) {
    return {
      library,
      file,
      recordFormat: file,
      fields: [],
      error: `Invalid library or file name`,
    };
  }

  try {
    const rows = await content.runSQL(
      `SELECT COLUMN_NAME, DATA_TYPE, LENGTH, NUMERIC_SCALE, COLUMN_HEADING, SYSTEM_COLUMN_NAME ` +
        `FROM QSYS2.SYSCOLUMNS ` +
        `WHERE TABLE_SCHEMA = '${library.replace(/'/g, `''`)}' ` +
        `AND TABLE_NAME = '${file.replace(/'/g, `''`)}' ` +
        `ORDER BY ORDINAL_POSITION`
    );

    if (!rows?.length) {
      return {
        library,
        file,
        recordFormat: file,
        fields: [],
        error: `No columns found for ${library}/${file}`,
      };
    }

    const fields: DbFieldDef[] = rows.map((row) => {
      const systemName = String(row.SYSTEM_COLUMN_NAME || ``).trim().toUpperCase();
      const sqlName = String(row.COLUMN_NAME || ``).trim().toUpperCase();
      // Prefer system (DDS) name when present; SQL long names are truncated poorly for REFFLD.
      const name = (systemName || sqlName).substring(0, 10);
      const dataType = String(row.DATA_TYPE || `CHARACTER`);
      const length = Number(row.LENGTH) || 10;
      const scale = Number(row.NUMERIC_SCALE) || 0;
      const mapped = mapSqlType(dataType, length, scale);
      const heading = row.COLUMN_HEADING !== null && row.COLUMN_HEADING !== undefined
        ? String(row.COLUMN_HEADING).trim()
        : undefined;
      return {
        name,
        type: mapped.type,
        length: mapped.length,
        decimals: mapped.decimals,
        heading: heading || undefined,
      };
    }).filter((f) => f.name);

    return { library, file, recordFormat: file, fields };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return { library, file, recordFormat: file, fields: [], error: msg };
  }
}

/**
 * Fetch every column of a database file via SYSCOLUMNS, keyed by uppercase
 * system (DDS) name. Used to resolve the *length* of reference fields declared
 * in DDS source with a blank length column so the designer can render them at
 * their true width. The library defaults to `*LIBL` (JOB's library list) when
 * only a file name is available.
 *
 * Returns `undefined` when Code for IBM i is not connected or the query fails,
 * so callers can gracefully fall back to the parsed length.
 */
export async function fetchFileFieldsByName(
  library: string | undefined,
  file: string
): Promise<Map<string, DbFieldDef> | undefined> {
  const content = getIbmiContent();
  if (!content?.runSQL) {
    return undefined;
  }

  const fileName = (file || ``).trim().toUpperCase();
  if (!isValidIbmiIdentifier(fileName)) {
    return undefined;
  }

  const libName = (library || ``).trim().toUpperCase();
  // `*LIBL`, `*CURLIB`, and other IBM specials aren't valid schemas for
  // SYSCOLUMNS; treat them as "no library filter" and let SYSCOLUMNS return
  // matches from any accessible schema.
  const useLibrary = libName && isValidIbmiIdentifier(libName) ? libName : ``;

  try {
    const whereLib = useLibrary
      ? `TABLE_SCHEMA = '${useLibrary.replace(/'/g, `''`)}' AND `
      : ``;
    const rows = await content.runSQL(
      `SELECT COLUMN_NAME, DATA_TYPE, LENGTH, NUMERIC_SCALE, COLUMN_HEADING, SYSTEM_COLUMN_NAME ` +
        `FROM QSYS2.SYSCOLUMNS ` +
        `WHERE ${whereLib}TABLE_NAME = '${fileName.replace(/'/g, `''`)}' ` +
        `ORDER BY ORDINAL_POSITION`
    );

    if (!rows?.length) {
      return new Map();
    }

    const map = new Map<string, DbFieldDef>();
    for (const row of rows) {
      const systemName = String(row.SYSTEM_COLUMN_NAME || ``).trim().toUpperCase();
      const sqlName = String(row.COLUMN_NAME || ``).trim().toUpperCase();
      const name = (systemName || sqlName).substring(0, 10);
      if (!name) {
        continue;
      }
      const dataType = String(row.DATA_TYPE || `CHARACTER`);
      const length = Number(row.LENGTH) || 10;
      const scale = Number(row.NUMERIC_SCALE) || 0;
      const mapped = mapSqlType(dataType, length, scale);
      const heading = row.COLUMN_HEADING !== null && row.COLUMN_HEADING !== undefined
        ? String(row.COLUMN_HEADING).trim()
        : undefined;
      // First match wins — SYSCOLUMNS may return the same field name from
      // multiple libraries if no schema filter was provided.
      if (!map.has(name)) {
        map.set(name, {
          name,
          type: mapped.type,
          length: mapped.length,
          decimals: mapped.decimals,
          heading: heading || undefined,
        });
      }
    }
    return map;
  } catch {
    return undefined;
  }
}
