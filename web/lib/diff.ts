// 충돌 시 "좌우 diff"에 쓰는 줄 단위 LCS diff. 외부 라이브러리 없이 자소서 분량
// (수십 줄)에서 충분히 빠르다 (§7).
export type DiffLine = { type: 'same' | 'mine' | 'theirs'; text: string };

export function diffLines(mine: string, theirs: string): DiffLine[] {
  const a = mine.split('\n');
  const b = theirs.split('\n');
  const n = a.length;
  const m = b.length;
  const dp: number[][] = Array.from({ length: n + 1 }, () => new Array(m + 1).fill(0) as number[]);

  for (let i = n - 1; i >= 0; i--) {
    for (let j = m - 1; j >= 0; j--) {
      dp[i]![j] = a[i] === b[j] ? dp[i + 1]![j + 1]! + 1 : Math.max(dp[i + 1]![j]!, dp[i]![j + 1]!);
    }
  }

  const result: DiffLine[] = [];
  let i = 0;
  let j = 0;
  while (i < n && j < m) {
    if (a[i] === b[j]) {
      result.push({ type: 'same', text: a[i]! });
      i++;
      j++;
    } else if (dp[i + 1]![j]! >= dp[i]![j + 1]!) {
      result.push({ type: 'mine', text: a[i]! });
      i++;
    } else {
      result.push({ type: 'theirs', text: b[j]! });
      j++;
    }
  }
  while (i < n) {
    result.push({ type: 'mine', text: a[i]! });
    i++;
  }
  while (j < m) {
    result.push({ type: 'theirs', text: b[j]! });
    j++;
  }
  return result;
}
