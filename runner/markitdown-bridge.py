import pathlib
import sys

from markitdown import MarkItDown


def main() -> None:
    if len(sys.argv) != 2:
        raise SystemExit("usage: markitdown-bridge.py <local-file>")
    source = pathlib.Path(sys.argv[1]).resolve(strict=True)
    # URL도 허용하는 convert() 대신 이미 검증·다운로드한 로컬 파일만 연다.
    result = MarkItDown().convert_local(source)
    sys.stdout.write(result.text_content)


if __name__ == "__main__":
    main()
