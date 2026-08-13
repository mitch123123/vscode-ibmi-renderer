import { expect, describe, it } from "vitest";
import { DdsLineRange, DisplayFile, FieldInfo, splitDocumentLines } from "../ui/dspf";

describe('DisplayFile tests', () => {

  const dspf1: string[] = [
    `     A                                      DSPSIZ(24 80 *DS3)                  `,
    `     A          R HEAD                                                          `,
    `     A                                  1 32'vscode-displayfile'                `,
    `     A          R FMT1                                                          `,
    `     A                                      SLNO(03)                            `,
    `     A                                  1  3'Opt'                               `,
    `     A                                      COLOR(BLU)                          `,
    `     A                                  1  8'Name'                              `,
    `     A                                      COLOR(BLU)                          `,
    `     A          R GLOBAL                                                        `,
    `     A                                      SLNO(04)                            `,
    `     A                                  1  3'---'                               `,
    `     A          R FORM1                                                         `,
    `     A                                      SLNO(06)                            `,
    `     A            FLD0101       10A  B  3  5                                    `,
    `     A  20                                  DSPATR(PR)                          `,
    `     A                                      COLOR(YLW)                          `,
    `     A            FLD0102       10   B  3  5                                    `,
  ];

  it('getRangeForFormat', () => {
    let dds = new DisplayFile();
    dds.parse(dspf1);

    expect(dds.getHeaderRangeForFormat(`DONOTEXIST`)).toBeUndefined();

    let range: DdsLineRange | undefined;

    range = dds.getHeaderRangeForFormat(`FMT1`);
    expect(range?.start).toBe(3);
    expect(range?.end).toBe(9);

    range = dds.getHeaderRangeForFormat(`HEAD`);
    expect(range?.start).toBe(1);
    expect(range?.end).toBe(3);
  });

  it('getRangeForField', () => {
    let dds = new DisplayFile();
    dds.parse(dspf1);

    let range: DdsLineRange | undefined;

    expect(dds.getRangeForField(`FORM1`, `UNKNOWN`)).toBeUndefined();

    range = dds.getRangeForField(`FORM1`, `FLD0101`);
    expect(range?.start).toBe(14);
    expect(range?.end).toBe(16);

    range = dds.getRangeForField(`FORM1`, `FLD0102`);
    expect(range?.start).toBe(17);
    expect(range?.end).toBe(17);
  });

  it('generates the same as what is provided', () => {
    let dds = new DisplayFile();
    dds.parse(dspf1);

    const form1 = dds.formats.find(f => f.name === `FORM1`);
    expect(form1).toBeDefined();

    const FLD0101 = form1?.fields.find(f => f.name === `FLD0101`);
    expect(FLD0101).toBeDefined();
    expect(FLD0101?.keywords.length).toBe(2);

    const DSPATR = FLD0101?.keywords.find(k => k.name === `DSPATR`);
    expect(DSPATR).toBeDefined();
    expect(DSPATR?.value).toBe(`PR`);
    expect(DSPATR?.conditions.length).toBe(1);

    const cond = DSPATR?.conditions[0];
    expect(cond).toBeDefined();
    expect(cond?.indicator).toBe(20);
    expect(cond?.negate).toBeFalsy();

    const generatedKeywordLines = DisplayFile.getLinesForKeyword(DSPATR!);
    expect(generatedKeywordLines.length).toBe(1);
    expect(generatedKeywordLines[0]).toBe(dspf1[15].trimEnd());

    const generateFieldLines = DisplayFile.getLinesForField(FLD0101!);
    expect(generateFieldLines.length).toBe(3);

    expect(generateFieldLines[0]).toBe(dspf1[14].trimEnd());
    expect(generateFieldLines[1]).toBe(dspf1[15].trimEnd());
    expect(generateFieldLines[2]).toBe(dspf1[16].trimEnd());

    const generatedRecordFormatLines = DisplayFile.getHeaderLinesForFormat(form1!.name, form1!.keywords);
    expect(generatedRecordFormatLines.length).toBe(2);
    expect(generatedRecordFormatLines[0]).toBe(dspf1[12].trimEnd());
    expect(generatedRecordFormatLines[1]).toBe(dspf1[13].trimEnd());

  });

  it('getLinesForField', () => {
    let field = new FieldInfo(0);
    field.displayType = `const`;
    field.value = `Some text`;
    field.position.x = 10;
    field.position.y = 4;

    let lines = DisplayFile.getLinesForField(field);

    expect(lines.length).toBe(1);
    expect(lines[0]).toBe(`     A                                  4 10'Some text'`);

    field.keywords.push(
      {
      name: "COLOR",
      value: "BLU",
      conditions: []
      },
      {
        name: "DSPATR",
        value: "PR",
        conditions: []
      }
    );

    lines = DisplayFile.getLinesForField(field);
    expect(lines.length).toBe(3);
    expect(lines[0]).toBe(`     A                                  4 10'Some text'`);
    expect(lines[1]).toBe(`     A                                      COLOR(BLU)`);
    expect(lines[2]).toBe(`     A                                      DSPATR(PR)`);
  });

  it(`wraps long constant text with column-80 continuation`, () => {
    const field = new FieldInfo(0);
    field.displayType = `const`;
    // 34 chars of body + quotes = 36 → fits one keyword area; longer needs wrap.
    field.value = `Bulk Customer................................Extra`;
    field.position.x = 10;
    field.position.y = 4;

    const lines = DisplayFile.getLinesForField(field);
    expect(lines.length).toBeGreaterThan(1);
    for (const line of lines) {
      expect(line.length).toBeLessThanOrEqual(80);
    }
    expect(lines[0].endsWith(`-`)).toBe(true);
    expect(lines[0].length).toBe(80);
    expect(lines[lines.length - 1].endsWith(`'`)).toBe(true);

    // Round-trip: parser rejoins `-` continuations into one const value.
    const dds = new DisplayFile();
    dds.parse([
      `     A          R FORM1`,
      ...lines,
    ]);
    const fmt = dds.formats.find((f) => f.name === `FORM1`);
    const consts = fmt?.fields.filter((f) => f.displayType === `const`) ?? [];
    expect(consts.length).toBe(1);
    expect(consts[0].value).toBe(field.value);
  });

  it(`wraps long keywords instead of truncating`, () => {
    const lines = DisplayFile.getLinesForKeyword({
      name: `TEXT`,
      value: `This is a deliberately long keyword value that must wrap`,
      conditions: [],
    });
    expect(lines.length).toBeGreaterThan(1);
    for (const line of lines) {
      expect(line.length).toBeLessThanOrEqual(80);
    }
    expect(lines[0].endsWith(`-`)).toBe(true);
    expect(lines[0]).toContain(`TEXT(`);
    expect(lines.join(``)).toContain(`must wrap`);
  });

  it('No duplicate RecordInfo', () => {
    let dds = new DisplayFile();
    dds.parse(dspf1);
    let names = dds.formats.map(rcd => rcd.name);
    expect(new Set(names).size).toBe(names.length);
  });

  it('preserves comments when updating a field (round-trip)', () => {
    const withComments: string[] = [
      `     A* File-level comment`,
      `     A                                      DSPSIZ(24 80 *DS3)`,
      `     A          R FORM1`,
      `     A* Before field`,
      `     A            FLD001        10A  O  2  5`,
      `     A                                      COLOR(GRN)`,
      `     A* Between fields`,
      `     A            FLD002        5A   B  3  5`,
      `     A* Trailing comment`,
    ];

    const dds = new DisplayFile();
    dds.parse(withComments);

    const form = dds.formats.find(f => f.name === `FORM1`);
    expect(form).toBeDefined();
    expect(form!.passthroughLines.length).toBeGreaterThan(0);

    const fld001 = form!.fields.find(f => f.name === `FLD001`)!;
    fld001.position.x = 10;
    fld001.keywords = [{ name: `COLOR`, value: `YLW`, conditions: [] }];

    const update = dds.updateField(`FORM1`, `FLD001`, fld001);
    expect(update?.range).toBeDefined();

    // Field range must not swallow the "Between fields" comment
    const between = withComments.findIndex(l => l.includes(`Between fields`));
    expect(update!.range!.end).toBeLessThan(between);

    const newLines = dds.applyUpdateToLines(withComments, update!);

    // Unrelated comment lines must be byte-identical
    expect(newLines.find(l => l.includes(`File-level comment`))).toBe(withComments[0]);
    expect(newLines.find(l => l.includes(`Before field`))).toBe(withComments[3]);
    expect(newLines.find(l => l.includes(`Between fields`))).toBe(withComments[6]);
    expect(newLines.find(l => l.includes(`Trailing comment`))).toBe(withComments[8]);

    // FLD002 untouched
    expect(newLines.some(l => l.includes(`FLD002`))).toBe(true);
  });

  it('parses reference fields (type R / REFFLD)', () => {
    const lines: string[] = [
      `     A          R FORM1`,
      `     A            CUSTNAME    R        O  2  5`,
      `     A                                      REFFLD(NAME CUSTFILE)`,
    ];
    const dds = new DisplayFile();
    dds.parse(lines);
    const form = dds.formats.find(f => f.name === `FORM1`);
    const field = form?.fields.find(f => f.name === `CUSTNAME`);
    expect(field).toBeDefined();
    expect(field?.isReference).toBe(true);
    expect(field?.reference).toBe(`NAME CUSTFILE`);
    // Blank length column parses to a falsy value so getLinesForField keeps
    // the source column blank on round-trip. The exact numeric (0 vs NaN)
    // depends on whether the R is at DDS col 35; only truthiness matters.
    expect(field?.length).toBeFalsy();
  });

  it('preserves blank length column on ref-field round-trip even with resolvedLength set', () => {
    // Properly aligned: R at DDS column 35 (index 34), length columns 30-34
    // (indexes 29-33) blank. That means 8 spaces between the end of the
    // 8-char name CUSTNAME and R (2 name-padding + 1 col-29 + 5 length).
    const lines: string[] = [
      `     A          R FORM1`,
      `     A            CUSTNAME        R  O  2  5`,
    ];
    const dds = new DisplayFile();
    dds.parse(lines);
    const field = dds.formats.find(f => f.name === `FORM1`)!.fields.find(f => f.name === `CUSTNAME`)!;
    expect(field.isReference).toBe(true);
    expect(field.length).toBeFalsy();

    // Simulate host-side resolution against SYSCOLUMNS.
    field.resolvedLength = 30;
    const generated = DisplayFile.getLinesForField(field);
    // Length column (idx 29-33) must stay blank — resolvedLength is a
    // render-only hint and must not leak into the DDS output.
    expect(generated[0].substring(29, 34)).toBe(`     `);
    // Type column (idx 34) is still R.
    expect(generated[0][34]).toBe(`R`);
  });

  it('parses printer-style X-only positions', () => {
    const lines: string[] = [
      `     A          R DETAIL`,
      `     A                                 10'Header'`,
      `     A            AMT           7  2     25`,
    ];
    const dds = new DisplayFile();
    dds.parse(lines);
    const form = dds.formats.find(f => f.name === `DETAIL`);
    expect(form).toBeDefined();
    expect(form!.fields.length).toBeGreaterThanOrEqual(1);
    const amt = form!.fields.find(f => f.name === `AMT`);
    expect(amt).toBeDefined();
    expect(amt!.position.x).toBe(25);
    expect(amt!.position.y).toBe(0);
  });

  it('preserves blank field type (never emits A 0)', () => {
    const dds = new DisplayFile();
    dds.parse(dspf1);
    const form1 = dds.formats.find(f => f.name === `FORM1`)!;
    const fld = form1.fields.find(f => f.name === `FLD0102`)!;
    expect(fld.type).toBeUndefined();

    fld.position.x = 8;
    const lines = DisplayFile.getLinesForField(fld);
    expect(lines[0]).toMatch(/10   B/);
    expect(lines[0]).not.toMatch(/10A/);
    expect(lines[0]).not.toMatch(/A 0B/);
  });

  it('parses and emits IBM-aligned N20 / zero-padded indicators', () => {
    const ibmLine = `     AN20                                  DSPATR(PR)`;
    const conds = DisplayFile.parseConditionals(ibmLine.substring(6, 16));
    expect(conds).toEqual([{ indicator: 20, negate: true }]);

    const emitted = DisplayFile.getLinesForKeyword({
      name: `DSPATR`,
      value: `PR`,
      conditions: [{ indicator: 5, negate: false }],
    });
    expect(emitted[0]).toContain(` 05`);
    // cols 8-16 live after `     A ` (index 7)
    expect(emitted[0].substring(7, 16)).toBe(` 05      `);
  });

  it('preserves mid-span comments inside a field on update', () => {
    const lines = [
      `     A          R FORM1`,
      `     A            FLD001        10A  O  2  5`,
      `     A* keep me`,
      `     A                                      COLOR(GRN)`,
    ];
    const dds = new DisplayFile();
    dds.parse(lines);
    const fld = dds.formats.find(f => f.name === `FORM1`)!.fields.find(f => f.name === `FLD001`)!;
    fld.keywords = [{ name: `COLOR`, value: `BLU`, conditions: [] }];
    const update = dds.updateField(`FORM1`, `FLD001`, fld)!;
    const next = dds.applyUpdateToLines(lines, update);
    const keepIdx = next.findIndex(l => l.includes(`keep me`));
    const defIdx = next.findIndex(l => l.includes(`FLD001`));
    const colorIdx = next.findIndex(l => l.includes(`COLOR(BLU)`));
    expect(keepIdx).toBeGreaterThan(defIdx);
    expect(colorIdx).toBeGreaterThan(keepIdx);
    expect(next.filter(l => l.includes(`keep me`)).length).toBe(1);
  });

  it('emits negated N20 indicator in IBM columns', () => {
    const emitted = DisplayFile.getLinesForKeyword({
      name: `DSPATR`,
      value: `PR`,
      conditions: [{ indicator: 20, negate: true }],
    });
    expect(emitted[0].substring(7, 16)).toBe(`N20      `);
  });

  it('emits field condition continuation lines beyond 3 indicators', () => {
    const field = new FieldInfo(0, `FLD1`);
    field.displayType = `both`;
    field.type = `A`;
    field.length = 5;
    field.position = { x: 1, y: 1 };
    field.conditions = [
      { indicator: 1, negate: false },
      { indicator: 2, negate: false },
      { indicator: 3, negate: false },
      { indicator: 4, negate: false },
    ];
    const lines = DisplayFile.getLinesForField(field);
    expect(lines.length).toBe(2);
    expect(lines[1]).toMatch(/^     A  04/);
  });

  it('empty format header update includes keyword lines', () => {
    const lines = [
      `     A          R CTL01`,
      `     A                                      SFLCTL(SFL01)`,
      `     A                                      SFLPAG(5)`,
      `     A          R SFL01`,
      `     A            COL1          5A  O  1  2`,
    ];
    const dds = new DisplayFile();
    dds.parse(lines);
    const range = dds.getHeaderRangeForFormat(`CTL01`);
    expect(range?.endHeader).toBe(2);

    const update = dds.updateFormatHeader(`CTL01`, [
      { name: `SFLCTL`, value: `SFL01`, conditions: [] },
      { name: `SFLPAG`, value: `10`, conditions: [] },
    ])!;
    expect(update.range!.end).toBe(2);
    expect(update.newLines.length).toBe(3);
    const next = dds.applyUpdateToLines(lines, update);
    expect(next.filter(l => l.includes(`SFLCTL`)).length).toBe(1);
    expect(next.some(l => l.includes(`SFLPAG(10)`))).toBe(true);
  });

  it('file-level _GLOBAL keywords can be updated', () => {
    const lines = [
      `     A                                      DSPSIZ(24 80 *DS3)`,
      `     A                                      INDARA`,
      `     A          R HEAD`,
      `     A                                  1  2'Hi'`,
    ];
    const dds = new DisplayFile();
    dds.parse(lines);

    const range = dds.getHeaderRangeForFormat(`_GLOBAL`);
    expect(range).toBeDefined();
    expect(range!.start).toBe(0);
    expect(range!.endHeader).toBe(1);

    const update = dds.updateFormatHeader(`_GLOBAL`, [
      { name: `DSPSIZ`, value: `*DS4`, conditions: [] },
      { name: `PRINT`, conditions: [] },
    ])!;
    expect(update.range!.start).toBe(0);
    expect(update.range!.end).toBe(1);
    expect(update.newLines.some(l => l.includes(`DSPSIZ(*DS4)`))).toBe(true);
    expect(update.newLines.some(l => l.includes(`PRINT`))).toBe(true);
    expect(update.newLines.every(l => !l.includes(` R `))).toBe(true);

    // Insert path when no file keywords yet
    const bare = [
      `     A          R HEAD`,
      `     A                                  1  2'Hi'`,
    ];
    const dds2 = new DisplayFile();
    dds2.parse(bare);
    const insertRange = dds2.getHeaderRangeForFormat(`_GLOBAL`);
    expect(insertRange!.start).toBe(0);
    expect(insertRange!.endHeader).toBe(-1);
    const insert = dds2.updateFormatHeader(`_GLOBAL`, [
      { name: `DSPSIZ`, value: `24 80 *DS3`, conditions: [] },
    ])!;
    expect(insert.range!.end).toBeLessThan(insert.range!.start);
    expect(insert.newLines.some(l => l.includes(`DSPSIZ`))).toBe(true);
  });

  it('insertFormats appends standard and subfile pairs', () => {
    const lines = [
      `     A          R HEAD`,
      `     A                                  1  2'Hi'`,
    ];
    const dds = new DisplayFile();
    dds.parse(lines);

    expect(DisplayFile.isValidRecordName(`REC01`)).toBe(true);
    expect(DisplayFile.isValidRecordName(`1BAD`)).toBe(false);
    expect(dds.insertFormats([{ name: `HEAD`, keywords: [] }])).toBeUndefined();

    const std = dds.insertFormats([
      { name: `BODY`, keywords: [{ name: `OVERLAY`, conditions: [] }] },
    ])!;
    expect(std.range!.start).toBe(2);
    expect(std.newLines[0]).toContain(`R BODY`);
    expect(std.newLines.some(l => l.includes(`OVERLAY`))).toBe(true);

    const pair = dds.insertFormats([
      { name: `SFL01`, keywords: [{ name: `SFL`, conditions: [] }] },
      {
        name: `CTL01`,
        keywords: [
          { name: `SFLCTL`, value: `SFL01`, conditions: [] },
          { name: `SFLPAG`, value: `10`, conditions: [] },
        ],
      },
    ])!;
    expect(pair.newLines.some(l => l.includes(`R SFL01`))).toBe(true);
    expect(pair.newLines.some(l => l.includes(`R CTL01`))).toBe(true);
    expect(pair.newLines.some(l => l.includes(`SFLCTL(SFL01)`))).toBe(true);

    const next = dds.applyUpdateToLines(lines, pair);
    expect(next.length).toBeGreaterThan(lines.length);
    const reparse = new DisplayFile();
    reparse.parse(next);
    expect(reparse.formats.some(f => f.name === `SFL01`)).toBe(true);
    expect(reparse.formats.some(f => f.name === `CTL01`)).toBe(true);
  });

  it('renameFormat deleteFormat copyFormat manage records', () => {
    const lines = [
      `     A          R HEAD`,
      `     A                                  1  2'Hi'`,
      `     A          R SFL01`,
      `     A                                      SFL`,
      `     A            F1             5A  O  1  2`,
      `     A          R CTL01`,
      `     A                                      SFLCTL(SFL01)`,
      `     A                                      SFLPAG(5)`,
    ];
    const dds = new DisplayFile();
    dds.parse(lines);

    const renamed = dds.renameFormat(`sfl01`, `SFL99`)!;
    expect(renamed.length).toBe(2);
    expect(renamed.every((u) => u.range && u.range.start === u.range.end)).toBe(true);
    expect(renamed[0].newLines[0]).toMatch(/R\s+SFL99/);
    expect(renamed.some((u) => u.newLines[0].includes(`SFLCTL(SFL99)`))).toBe(true);
    let afterRename = [...lines];
    for (const u of [...renamed].sort((a, b) => b.range!.start - a.range!.start)) {
      afterRename = dds.applyUpdateToLines(afterRename, u);
    }
    expect(afterRename.some((l) => /R\s+SFL99/.test(l))).toBe(true);
    expect(afterRename.some((l) => l.includes(`SFLCTL(SFL99)`))).toBe(true);
    expect(afterRename.some((l) => l.includes(`SFLCTL(SFL01)`))).toBe(false);
    expect(afterRename.length).toBe(lines.length);

    const dds2 = new DisplayFile();
    dds2.parse(lines);
    const copied = dds2.copyFormat(`head`, `HEAD2`)!;
    expect(copied.newLines[0]).toMatch(/R\s+HEAD2/);
    expect(copied.range!.end).toBe(copied.range!.start - 1);
    const afterCopy = dds2.applyUpdateToLines(lines, copied);
    expect(afterCopy.some(l => /R\s+HEAD2/.test(l))).toBe(true);

    const dds3 = new DisplayFile();
    dds3.parse(lines);
    const del = dds3.deleteFormat(`HEAD`)!;
    expect(del.newLines).toEqual([]);
    expect(del.range!.start).toBe(0);
    const afterDel = dds3.applyUpdateToLines(lines, del);
    expect(afterDel.some(l => /R\s+HEAD\b/.test(l))).toBe(false);
    expect(afterDel.some(l => /R\s+SFL01/.test(l))).toBe(true);
  });

  it('renameFormat returns only the R-line when nothing references it', () => {
    const lines = [
      `     A          R HEAD`,
      `     A                                  1  2'Hi'`,
      `     A          R BODY`,
      `     A            F1             5A  O  1  2`,
    ];
    const dds = new DisplayFile();
    dds.parse(lines);
    const renamed = dds.renameFormat(`HEAD`, `TITLE`)!;
    expect(renamed).toHaveLength(1);
    expect(renamed[0].range).toEqual({ start: 0, end: 0 });
    expect(renamed[0].newLines[0]).toMatch(/R\s+TITLE/);
  });

  it('deleteFormat blocks when SFLCTL still references the format', () => {
    const lines = [
      `     A          R SFL01`,
      `     A                                      SFL`,
      `     A            F1             5A  O  1  2`,
      `     A          R CTL01`,
      `     A                                      SFLCTL(SFL01)`,
    ];
    const dds = new DisplayFile();
    dds.parse(lines);
    expect(dds.formatsReferencing(`SFL01`)).toEqual([`CTL01`]);
    expect(dds.deleteFormat(`SFL01`)).toBeUndefined();
    expect(dds.deleteFormat(`CTL01`)).toBeDefined();
  });

  it('retargetFormatRefsInLine escapes regex special chars in names', () => {
    const line = `     A                                      SFLCTL($SFL1)`;
    const next = DisplayFile.retargetFormatRefsInLine(line, `$SFL1`, `$SFL2`);
    expect(next).toContain(`SFLCTL($SFL2)`);
    expect(next).not.toContain(`SFLCTL($SFL1)`);
  });

  it('applyUpdateToLines replaces a single-line field without duplicating', () => {
    const lines = [
      `     A          R FORM1`,
      `     A            FLD001        10A  O  2  5`,
    ];
    const dds = new DisplayFile();
    dds.parse(lines);
    const fld = dds.formats.find(f => f.name === `FORM1`)!.fields.find(f => f.name === `FLD001`)!;
    fld.length = 12;
    const update = dds.updateField(`FORM1`, `FLD001`, fld)!;
    expect(update.range!.start).toBe(update.range!.end);
    const next = dds.applyUpdateToLines(lines, update);
    expect(next.filter(l => l.includes(`FLD001`)).length).toBe(1);
    expect(next.some(l => l.includes(`12A`))).toBe(true);
    expect(next.length).toBe(2);
  });

  it('applyUpdateToLines deletes a single-line format', () => {
    const lines = [
      `     A          R ONLY`,
    ];
    const dds = new DisplayFile();
    dds.parse(lines);
    const del = dds.deleteFormat(`ONLY`)!;
    expect(del.range!.start).toBe(del.range!.end);
    const next = dds.applyUpdateToLines(lines, del);
    expect(next).toEqual([]);
  });

  it('updateField with unknown name does not insert', () => {
    const dds = new DisplayFile();
    dds.parse(dspf1);
    const field = new FieldInfo(0, `GHOST`);
    field.displayType = `both`;
    field.type = `A`;
    field.length = 5;
    field.position = { x: 1, y: 1 };
    expect(dds.updateField(`FORM1`, `GHOST`, field)).toBeUndefined();
  });

  it('splitDocumentLines drops trailing empty from final EOL', () => {
    const lines = splitDocumentLines(`A\nB\n`);
    expect(lines).toEqual([`A`, `B`]);
    expect(splitDocumentLines(`A\nB`)).toEqual([`A`, `B`]);
  });

  it('applyUpdateToLines inserts new field without replacing next R', () => {
    const lines = [
      `     A          R FORM1`,
      `     A            FLD1          5A  O  1  2`,
      `     A          R FORM2`,
      `     A            FLD2          5A  O  1  2`,
    ];
    const dds = new DisplayFile();
    dds.parse(lines);
    const form1 = dds.formats.find(f => f.name === `FORM1`)!;
    const newField = new FieldInfo(0, `NEW1`);
    newField.displayType = `both`;
    newField.type = `A`;
    newField.length = 3;
    newField.position = { x: 1, y: 2 };
    const update = dds.updateField(`FORM1`, undefined, newField)!;
    expect(update.range!.start).toBe(form1.range.end);
    expect(update.range!.end).toBe(form1.range.end - 1);
    const next = dds.applyUpdateToLines(lines, update);
    expect(next.filter(l => l.includes(`R FORM2`)).length).toBe(1);
    expect(next.some(l => l.includes(`NEW1`))).toBe(true);
  });

  it('printer +n as first field does not throw', () => {
    // y blank (cols 39-41), x = +5 (cols 42-44)
    const fieldLine = `${`     A`.padEnd(38)}   +5 'Hi'`;
    const lines = [
      `     A          R DETAIL`,
      fieldLine,
    ];
    const dds = new DisplayFile();
    expect(() => dds.parse(lines)).not.toThrow();
    const form = dds.formats.find(f => f.name === `DETAIL`);
    expect(form!.fields.length).toBeGreaterThanOrEqual(1);
    expect(form!.fields[0].position.x).toBe(5);
  });

  it('updates display type, length, and data type on a named field', () => {
    const lines = [
      `     A          R FORM1`,
      `     A            FLD001         5A  I  2  5`,
    ];
    const dds = new DisplayFile();
    dds.parse(lines);
    const fld = dds.formats.find(f => f.name === `FORM1`)!.fields.find(f => f.name === `FLD001`)!;
    expect(fld.displayType).toBe(`input`);

    fld.displayType = `both`;
    fld.type = `S`;
    fld.length = 7;
    fld.decimals = 2;
    const update = dds.updateField(`FORM1`, `FLD001`, fld)!;
    const next = dds.applyUpdateToLines(lines, update);
    const def = next.find(l => l.includes(`FLD001`))!;
    expect(def).toMatch(/FLD001\s+7S 2B/);
  });

  it('round-trips usage M and P without dropping the definition line', () => {
    const lines = [
      `     A          R FORM1`,
      `     A            MSGFLD        10A  M  2  5`,
      `     A            PGMFLD         5A  P  3  1`,
    ];
    const dds = new DisplayFile();
    dds.parse(lines);
    const form = dds.formats.find(f => f.name === `FORM1`)!;
    const msg = form.fields.find(f => f.name === `MSGFLD`)!;
    const pgm = form.fields.find(f => f.name === `PGMFLD`)!;
    expect(msg.displayType).toBe(`message`);
    expect(pgm.displayType).toBe(`program`);

    msg.position.x = 6;
    const update = dds.updateField(`FORM1`, `MSGFLD`, msg)!;
    const next = dds.applyUpdateToLines(lines, update);
    const def = next.find(l => l.includes(`MSGFLD`))!;
    expect(def[37]).toBe(`M`); // usage col 38
    expect(def.substring(41, 44).trim()).toBe(`6`);
    expect(next.some(l => l.includes(`PGMFLD`))).toBe(true);
  });

  it('preserves blank row (y=0) on printer-style re-emit', () => {
    const lines: string[] = [
      `     A          R DETAIL`,
      `     A            AMT           7  2     25`,
    ];
    const dds = new DisplayFile();
    dds.parse(lines);
    const amt = dds.formats.find(f => f.name === `DETAIL`)!.fields.find(f => f.name === `AMT`)!;
    expect(amt.position.y).toBe(0);

    amt.keywords = [{ name: `EDTCDE`, value: `1`, conditions: [] }];
    const generated = DisplayFile.getLinesForField(amt);
    // Cols 39-41 (indexes 38-40) must stay blank — never invent row 0.
    expect(generated[0].substring(38, 41)).toBe(`   `);
    expect(generated[0].substring(41, 44).trim()).toBe(`25`);
  });

  it('preserves blank length column on named (non-ref) field re-emit', () => {
    // Name FLD1 (4 chars) + pad to 10, blank col 29, blank length 30-34, type A at 35
    const lines = [
      `     A          R FORM1`,
      `     A            FLD1            A  O  2  5`,
    ];
    const dds = new DisplayFile();
    dds.parse(lines);
    const fld = dds.formats.find(f => f.name === `FORM1`)!.fields.find(f => f.name === `FLD1`)!;
    expect(fld.length).toBeUndefined();

    fld.position.x = 6;
    const generated = DisplayFile.getLinesForField(fld);
    expect(generated[0].substring(29, 34)).toBe(`     `);
    expect(generated[0][34]).toBe(`A`);
  });

  it('fitColumn keeps overflow from shifting type/usage/row/col', () => {
    const field = new FieldInfo(0, `THISISLONG1`); // 11 chars
    field.displayType = `both`;
    field.type = `A`;
    field.length = 100000; // 6 digits
    field.position = { x: 1000, y: 1000 };
    const line = DisplayFile.getLinesForField(field)[0];
    expect(line.substring(18, 28)).toBe(`THISISLONG`); // truncated to 10
    expect(line.substring(29, 34)).toBe(`00000`); // right-truncated to 5
    expect(line[34]).toBe(`A`);
    expect(line[37]).toBe(`B`);
    expect(line.substring(38, 41)).toBe(`000`); // 1000 → last 3
    expect(line.substring(41, 44)).toBe(`000`);
  });

  it('preserves H-spec lines across format header updates', () => {
    const lines = [
      `     A          R FORM1`,
      `     A          H SPECHELP`,
      `     A                                      HELP`,
      `     A            FLD1          5A  O  1  1`,
    ];
    const dds = new DisplayFile();
    dds.parse(lines);
    const form = dds.formats.find(f => f.name === `FORM1`)!;
    expect(form.passthroughLines.some(p => p.text.includes(`SPECHELP`))).toBe(true);

    const update = dds.updateFormatHeader(`FORM1`, [
      ...form.keywords,
      { name: `COLOR`, value: `BLU`, conditions: [] },
    ])!;
    const next = dds.applyUpdateToLines(lines, update);
    expect(next.some(l => l.includes(`SPECHELP`))).toBe(true);
    expect(next.some(l => l.includes(`COLOR(BLU)`))).toBe(true);
    expect(next.some(l => l.includes(`FLD1`))).toBe(true);
  });

  it('does not inject DATE/TIME keywords when parsing types L/T', () => {
    const lines = [
      `     A          R FORM1`,
      `     A            DATE1          8L  O  1  1`,
      `     A                                      DATFMT(*ISO)`,
      `     A            TIME1          8T  O  2  1`,
      `     A                                      TIMFMT(*HMS)`,
    ];
    const dds = new DisplayFile();
    dds.parse(lines);
    const form = dds.formats.find(f => f.name === `FORM1`)!;
    const date1 = form.fields.find(f => f.name === `DATE1`)!;
    const time1 = form.fields.find(f => f.name === `TIME1`)!;

    expect(date1.type).toBe(`L`);
    expect(date1.keywords.map(k => k.name)).toEqual([`DATFMT`]);
    expect(time1.type).toBe(`T`);
    expect(time1.keywords.map(k => k.name)).toEqual([`TIMFMT`]);
  });

  it('does not emit DATE/TIME stubs on typed L/T fields', () => {
    const dateField = FieldInfo.fromData({
      name: `DATE1`,
      type: `L`,
      length: 8,
      displayType: `output`,
      position: { x: 1, y: 1 },
      keywords: [
        { name: `DATE`, conditions: [] },
        { name: `DATFMT`, value: `*ISO`, conditions: [] },
      ],
    });
    const timeField = FieldInfo.fromData({
      name: `TIME1`,
      type: `T`,
      length: 8,
      displayType: `output`,
      position: { x: 1, y: 2 },
      keywords: [
        { name: `TIME`, conditions: [] },
        { name: `TIMFMT`, value: `*HMS`, conditions: [] },
      ],
    });

    const dateLines = DisplayFile.getLinesForField(dateField);
    expect(dateLines.some(l => /\bDATE\b/.test(l) && !l.includes(`DATFMT`))).toBe(false);
    expect(dateLines.some(l => l.includes(`DATFMT(*ISO)`))).toBe(true);

    const timeLines = DisplayFile.getLinesForField(timeField);
    expect(timeLines.some(l => /\bTIME\b/.test(l) && !l.includes(`TIMFMT`))).toBe(false);
    expect(timeLines.some(l => l.includes(`TIMFMT(*HMS)`))).toBe(true);
  });

  it('still emits DATE/TIME keywords on constants', () => {
    const field = FieldInfo.fromData({
      displayType: `const`,
      value: ``,
      position: { x: 1, y: 1 },
      keywords: [
        { name: `TIME`, conditions: [] },
        { name: `TIMFMT`, value: `*HMS`, conditions: [] },
      ],
    });
    const lines = DisplayFile.getLinesForField(field);
    expect(lines.some(l => l.trimEnd().endsWith(`TIME`))).toBe(true);
    expect(lines.some(l => l.includes(`TIMFMT(*HMS)`))).toBe(true);
  });
});
