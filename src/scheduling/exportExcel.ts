import { addDateOnlyDays, formatDateShort, formatWeekOfMonth } from "../lib/week";
import { entryLabel } from "./overlap";
import { buildScheduleGroups } from "./scheduleSheetModel";
import { formatShiftLabel, resolvedShiftColor } from "./shiftStyle";
import { periodCounts } from "./staffing";
import { compareScheduleEntriesByTime } from "../admin/SchedulerTable";
import type { CloudEmployee, Group, ScheduleEntry, ShiftType } from "./types";

const xml = (value: string) => value.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const encoder = new TextEncoder();

// Store-only ZIP: XLSX is a package of XML files, with CRC32 checksums.
function zip(files: Record<string, string>): Blob {
  const parts: Uint8Array<ArrayBuffer>[] = [];
  const directory: Uint8Array<ArrayBuffer>[] = [];
  let offset = 0;
  for (const [name, value] of Object.entries(files)) {
    const n = encoder.encode(name), data = encoder.encode(value);
    let crc = 0xffffffff;
    for (const byte of data) {
      crc ^= byte;
      for (let bit = 0; bit < 8; bit++) crc = (crc >>> 1) ^ ((crc & 1) ? 0xedb88320 : 0);
    }
    crc = (crc ^ 0xffffffff) >>> 0;
    const local = new Uint8Array(30 + n.length);
    const l = new DataView(local.buffer);
    l.setUint32(0, 0x04034b50, true); l.setUint16(4, 20, true);
    l.setUint16(12, 33, true); l.setUint32(14, crc, true);
    l.setUint32(18, data.length, true); l.setUint32(22, data.length, true);
    l.setUint16(26, n.length, true); local.set(n, 30);
    const central = new Uint8Array(46 + n.length);
    const c = new DataView(central.buffer);
    c.setUint32(0, 0x02014b50, true); c.setUint16(4, 20, true); c.setUint16(6, 20, true);
    c.setUint16(14, 33, true); c.setUint32(16, crc, true);
    c.setUint32(20, data.length, true); c.setUint32(24, data.length, true);
    c.setUint16(28, n.length, true); c.setUint32(42, offset, true); central.set(n, 46);
    parts.push(local, data); directory.push(central); offset += local.length + data.length;
  }
  const end = new Uint8Array(22), e = new DataView(end.buffer);
  e.setUint32(0, 0x06054b50, true); e.setUint16(8, directory.length, true); e.setUint16(10, directory.length, true);
  e.setUint32(12, directory.reduce((sum, item) => sum + item.length, 0), true); e.setUint32(16, offset, true);
  return new Blob([...parts, ...directory, end], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
}

const ns = "http://schemas.openxmlformats.org/spreadsheetml/2006/main";
const rel = "http://schemas.openxmlformats.org/officeDocument/2006/relationships";
const packageRel = "http://schemas.openxmlformats.org/package/2006/relationships";
const declaration = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>';

export function createScheduleExcel(groups: Group[], employees: CloudEmployee[], entries: ScheduleEntry[], shifts: ShiftType[], weekStart: string): Blob {
  const colors = ["FFFFFF", "263B36", "E8EFEC", "DCE8E3", "F2F5F4", "E4EBE8"];
  const styles: { fill: number; font: number; left: boolean; border: number }[] = [
    {fill:0,font:0,left:false,border:0}, {fill:1,font:1,left:true,border:0},
    {fill:2,font:2,left:true,border:0}, {fill:3,font:2,left:false,border:1},
    {fill:4,font:2,left:true,border:1}, {fill:0,font:2,left:true,border:1},
    {fill:0,font:0,left:false,border:1}, {fill:5,font:2,left:false,border:1},
  ];
  function shiftStyleIndex(color: string) {
    const hex = /^#[0-9a-f]{6}$/i.test(color) ? color.slice(1) : "A6A6A6";
    const pastel = [0,2,4].map(i => Math.round(parseInt(hex.slice(i,i+2),16)*0.42+255*0.58).toString(16).padStart(2,"0")).join("").toUpperCase();
    let fill = colors.indexOf(pastel);
    if (fill < 0) { fill = colors.length; colors.push(pastel); }
    let index = styles.findIndex(s => s.fill === fill && s.font === 2 && !s.left && s.border === 1);
    if (index < 0) { index = styles.length; styles.push({fill,font:2,left:false,border:1}); }
    return index;
  }
  const rows: string[] = [], merges: string[] = [];
  function row(cells: { value: string | number; style: number }[], height: number, merged = false) {
    const n = rows.length+1;
    const values = cells.map(({value,style}, i) => {
      const ref = String.fromCharCode(65+i)+n;
      return typeof value === "number" ? `<c r="${ref}" s="${style}"><v>${value}</v></c>` : `<c r="${ref}" s="${style}" t="inlineStr"><is><t xml:space="preserve">${xml(value)}</t></is></c>`;
    });
    if (merged) {
      merges.push(`A${n}:H${n}`);
      for(let i=1;i<8;i++) values.push(`<c r="${String.fromCharCode(65+i)}${n}" s="${cells[0].style}"/>`);
    }
    rows.push(`<row r="${n}" ht="${height}" customHeight="1">${values.join("")}</row>`);
  }
  row([{value:"LỊCH LÀM VIỆC",style:1}],32,true);
  row([{value:`${formatWeekOfMonth(weekStart)} · ${formatDateShort(weekStart)} – ${formatDateShort(addDateOnlyDays(weekStart,6))} · ${weekStart.slice(0,4)}`,style:2}],25,true);
  row([{value:"Nhân viên",style:3}, ...["Thứ hai","Thứ ba","Thứ tư","Thứ năm","Thứ sáu","Thứ bảy","Chủ nhật"].map((day,i)=>({value:day+"\n"+formatDateShort(addDateOnlyDays(weekStart,i)),style:i>=5?7:3}))],34);
  for (const section of buildScheduleGroups(groups,employees)) {
    row([{value:section.group.name.toLocaleUpperCase("vi"),style:4}],23,true);
    for (const employee of section.employees) {
      let lines = 2;
      const cells = [{value:employee.name+(employee.positionName?"\n"+employee.positionName:""),style:5}];
      for (let day=1;day<=7;day++) {
        const assigned = entries.filter(e=>e.employeeId===employee.id&&e.dayOfWeek===day).sort((a,b)=>compareScheduleEntriesByTime(a,b,shifts));
        const labels = assigned.map(e=>formatShiftLabel(entryLabel(e,shifts)).replace(/ \/ /g,"\n"));
        const value = labels.join("\n");
        lines=Math.max(lines,value.split("\n").length);
        const shiftColors = assigned.map(e=>resolvedShiftColor(entryLabel(e,shifts),shifts.find(s=>s.id===e.shiftTypeId)?.color??"#A6A6A6",Boolean(e.customLabel||e.customStart||e.customEnd)));
        cells.push({value,style:shiftColors.length ? shiftStyleIndex(shiftColors.every(c=>c===shiftColors[0])?shiftColors[0]:"#A6A6A6"):6});
      }
      row(cells,Math.min(409,Math.max(38,lines*16+8)));
    }
  }
  row([{value:"TỔNG CA THEO BUỔI",style:1}],25,true);
  const counts=periodCounts(entries,shifts);
  for(const [key,label] of [["S","Sáng"],["T","Trưa"],["Đ","Tối"]] as const) {
    row([{value:label,style:4},...counts.map(c=>({value:c[key],style:7}))],24);
  }
  const sheet=`<worksheet xmlns="${ns}"><sheetViews><sheetView showGridLines="0" workbookViewId="0"><pane xSplit="1" ySplit="3" topLeftCell="B4" activePane="bottomRight" state="frozen"/></sheetView></sheetViews><sheetFormatPr defaultRowHeight="20"/><cols><col min="1" max="1" width="34" customWidth="1"/><col min="2" max="8" width="23" customWidth="1"/></cols><sheetData>${rows.join("")}</sheetData><mergeCells count="${merges.length}">${merges.map(ref=>`<mergeCell ref="${ref}"/>`).join("")}</mergeCells><pageMargins left="0.25" right="0.25" top="0.35" bottom="0.35" header="0.1" footer="0.1"/><pageSetup orientation="landscape" paperSize="9" fitToWidth="1" fitToHeight="0"/></worksheet>`;
  const font=(size:number,bold:boolean,color:string)=>`<font>${bold?"<b/>":""}<sz val="${size}"/><color rgb="FF${color}"/><name val="Calibri"/></font>`;
  const styleXml=`<styleSheet xmlns="${ns}"><fonts count="3">${font(11,false,"263B36")}${font(16,true,"FFFFFF")}${font(11,true,"263B36")}</fonts><fills count="${colors.length+2}"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill>${colors.map(c=>`<fill><patternFill patternType="solid"><fgColor rgb="FF${c}"/><bgColor indexed="64"/></patternFill></fill>`).join("")}</fills><borders count="2"><border><left/><right/><top/><bottom/><diagonal/></border><border>${["left","right","top","bottom"].map(side=>`<${side} style="thin"><color rgb="FFD8E1DD"/></${side}>`).join("")}<diagonal/></border></borders><cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs><cellXfs count="${styles.length}">${styles.map(s=>`<xf numFmtId="0" fontId="${s.font}" fillId="${s.fill+2}" borderId="${s.border}" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment horizontal="${s.left?"left":"center"}" vertical="center" wrapText="1"/></xf>`).join("")}</cellXfs><cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles></styleSheet>`;
  return zip(Object.fromEntries(Object.entries({
    "[Content_Types].xml": '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/></Types>',
    "_rels/.rels": `<Relationships xmlns="${packageRel}"><Relationship Id="rId1" Type="${rel}/officeDocument" Target="xl/workbook.xml"/></Relationships>`,
    "xl/workbook.xml": `<workbook xmlns="${ns}" xmlns:r="${rel}"><bookViews><workbookView/></bookViews><sheets><sheet name="Lịch làm việc" sheetId="1" r:id="rId1"/></sheets></workbook>`,
    "xl/_rels/workbook.xml.rels": `<Relationships xmlns="${packageRel}"><Relationship Id="rId1" Type="${rel}/worksheet" Target="worksheets/sheet1.xml"/><Relationship Id="rId2" Type="${rel}/styles" Target="styles.xml"/></Relationships>`,
    "xl/styles.xml": styleXml, "xl/worksheets/sheet1.xml":sheet,
  }).map(([name,content])=>[name,declaration+content])));
}

export function exportScheduleExcel(groups: Group[], employees: CloudEmployee[], entries: ScheduleEntry[], shifts: ShiftType[], weekStart: string) {
  const url=URL.createObjectURL(createScheduleExcel(groups,employees,entries,shifts,weekStart));
  const anchor=document.createElement("a");
  anchor.href=url; anchor.download=`lich-lam-viec-${weekStart}.xlsx`; anchor.click();
  window.setTimeout(()=>URL.revokeObjectURL(url),1000);
}
