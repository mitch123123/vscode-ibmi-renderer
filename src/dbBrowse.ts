import * as vscode from "vscode";

const CODE_FOR_IBMI_ID = `halcyontechltd.code-for-ibmi`;

export type DbFieldDef = {
  name: string;
  type: string;
  length: number;
  decimals: number;
  heading?: string;
};

type SqlRow = Record<string, unknown>;

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
      validateInput: (v) => (v.trim() ? undefined : `Library is required`),
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
      validateInput: (v) => (v.trim() ? undefined : `File is required`),
    })
  )?.trim().toUpperCase();
  if (!file) {
    return undefined;
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
      const name = String(row.COLUMN_NAME || row.SYSTEM_COLUMN_NAME || ``).trim().toUpperCase();
      const dataType = String(row.DATA_TYPE || `CHARACTER`);
      const length = Number(row.LENGTH) || 10;
      const scale = Number(row.NUMERIC_SCALE) || 0;
      const mapped = mapSqlType(dataType, length, scale);
      const heading = row.COLUMN_HEADING !== null && row.COLUMN_HEADING !== undefined
        ? String(row.COLUMN_HEADING).trim()
        : undefined;
      return {
        name: name.substring(0, 10),
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
