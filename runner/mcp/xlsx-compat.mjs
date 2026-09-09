import JSZip from 'jszip';
import { SaxesParser } from 'saxes';

const MAIN = 'http://schemas.openxmlformats.org/spreadsheetml/2006/main';
const REL = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships';
const DEFAULT_NAMESPACES = new Set([MAIN, 'http://schemas.openxmlformats.org/package/2006/relationships', 'http://schemas.openxmlformats.org/package/2006/content-types']);
const escapeText = value => value.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');
const escapeAttribute = value => escapeText(value).replaceAll('"', '&quot;').replaceAll('\n', '&#10;').replaceAll('\r', '&#13;').replaceAll('\t', '&#9;');

// XML 접두사는 작성 도구마다 다르다. 셀 본문을 치환하지 않고 네임스페이스 URI로만 정규화한다.
export function normalizeExcelXml(xml) {
  const parser = new SaxesParser({ xmlns: true });
  const output = [], names = [];
  let cells = 0;
  parser.on('doctype', () => { throw new Error('외부 문서 정의가 포함된 엑셀 XML은 지원하지 않습니다.'); });
  parser.on('opentag', node => {
    const canonical = DEFAULT_NAMESPACES.has(node.uri);
    const name = canonical ? node.local : node.name;
    const attributes = Object.values(node.attributes).filter(a => !(canonical && a.name === 'xmlns'))
      .map(a => [a.uri === REL ? `r:${a.local}` : a.name, a.value]);
    if (canonical) attributes.push(['xmlns', node.uri]);
    if (Object.values(node.attributes).some(a => a.uri === REL) && !attributes.some(([key]) => key === 'xmlns:r')) attributes.push(['xmlns:r', REL]);
    if (node.uri === MAIN && node.local === 'c') {
      cells++;
      const address = node.attributes.r?.value || '';
      const match = address.match(/^([A-Z]+)(\d+)$/);
      const column = match?.[1].split('').reduce((n, c) => n * 26 + c.charCodeAt(0) - 64, 0);
      if (cells > 1000100 || (match && (Number(match[2]) > 10001 || column > 100))) throw new Error('시트당 10,000개 데이터 행·100개 열까지 지원합니다.');
    }
    names.push(name);
    output.push(`<${name}${attributes.map(([key, value]) => ` ${key}="${escapeAttribute(value)}"`).join('')}>`);
  });
  parser.on('closetag', () => output.push(`</${names.pop()}>`));
  parser.on('text', value => output.push(escapeText(value)));
  parser.on('cdata', value => output.push(escapeText(value)));
  parser.write(xml).close();
  return output.join('');
}

// 압축 파일 크기만 검사하면 작은 ZIP으로 큰 메모리를 점유할 수 있어 해제 중에도 제한한다.
export async function compatibleExcelBuffer(buffer, { maxExpandedBytes = 40 * 1024 * 1024 } = {}) {
  let archive;
  try { archive = await JSZip.loadAsync(buffer); }
  catch { throw new Error('XLSX 파일을 읽을 수 없습니다. 암호를 해제하거나 Excel에서 XLSX로 다시 저장해 주세요.'); }
  const files = Object.values(archive.files).filter(file => !file.dir);
  if (files.length > 2000 || !archive.file('xl/workbook.xml')) throw new Error('지원하는 XLSX 통합 문서가 아닙니다.');
  const normalized = new JSZip();
  let total = 0;
  for (const file of files) {
    const chunks = [];
    await new Promise((resolve,reject)=>{
      const stream=file.nodeStream();
      stream.on('data',chunk=>{
        total+=chunk.length;
        if(total>maxExpandedBytes) { reject(new Error('엑셀 압축 해제 크기가 너무 큽니다. 시트나 이미지를 나눠 주세요.')); stream.destroy(); return; }
        chunks.push(chunk);
      });
      stream.on('error',reject);
      stream.on('end',resolve);
    });
    const data = Buffer.concat(chunks);
    try { normalized.file(file.name, /\.(xml|rels)$/.test(file.name) ? normalizeExcelXml(data.toString('utf8')) : data); }
    catch (error) { throw new Error(`${file.name}: ${error.message}`); }
  }
  return normalized.generateAsync({ type: 'nodebuffer' });
}
