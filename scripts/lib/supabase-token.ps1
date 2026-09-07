param([ValidateSet('supabase', 'access-token')][string]$Account)
$ErrorActionPreference = 'Stop'
# CLI의 두 로그인 항목만 읽는다. 전체 자격 증명 열거는 다른 서비스의 비밀까지 노출할 수 있다.
Add-Type -TypeDefinition @'
using System;
using System.Runtime.InteropServices;
using System.Text;
public static class CareerAtelierCredential {
    [StructLayout(LayoutKind.Sequential, CharSet = CharSet.Unicode)]
    public struct Credential {
        public uint Flags, Type;
        public string TargetName, Comment;
        public System.Runtime.InteropServices.ComTypes.FILETIME LastWritten;
        public uint CredentialBlobSize;
        public IntPtr CredentialBlob;
        public uint Persist, AttributeCount;
        public IntPtr Attributes;
        public string TargetAlias, UserName;
    }
    [DllImport("advapi32.dll", EntryPoint = "CredReadW", CharSet = CharSet.Unicode, SetLastError = true)]
    private static extern bool CredRead(string target, uint type, uint flags, out IntPtr credential);
    [DllImport("advapi32.dll")]
    private static extern void CredFree(IntPtr credential);
    public static string Read(string target) {
        IntPtr pointer;
        if (!CredRead(target, 1, 0, out pointer)) return null;
        try {
            var credential = (Credential)Marshal.PtrToStructure(pointer, typeof(Credential));
            byte[] bytes = new byte[credential.CredentialBlobSize];
            Marshal.Copy(credential.CredentialBlob, bytes, 0, bytes.Length);
            // Go CLI는 UTF-8, 일부 키링 구현은 UTF-16으로 저장한다.
            return (bytes.Length > 1 && bytes[1] == 0 ? Encoding.Unicode : Encoding.UTF8).GetString(bytes).TrimEnd('\0');
        } finally { CredFree(pointer); }
    }
}
'@
foreach ($target in @("Supabase CLI:$Account", "$Account.Supabase CLI")) {
    $token = [CareerAtelierCredential]::Read($target)
    if ($token) {
        # 설치기의 비공개 파이프로만 전달한다. 이 스크립트를 터미널에서 직접 실행하지 않는다.
        [Console]::Out.Write($token)
        exit 0
    }
}
exit 1
