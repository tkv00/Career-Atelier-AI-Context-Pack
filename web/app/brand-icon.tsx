import Image from 'next/image';

type BrandIconProps = {
  priority?: boolean;
};

// 모든 진입점이 같은 자산을 써야 브라우저 아이콘과 화면 속 브랜드 표식이
// 어긋나지 않는다. 크기는 CSS가 맡고 원본 비율은 여기서 고정한다.
export function BrandIcon({ priority = false }: BrandIconProps) {
  return (
    <span className="brand-mark" aria-label="Career Atelier">
      <Image
        src="/assets/career-atelier-icon.png"
        alt=""
        width={640}
        height={640}
        priority={priority}
        sizes="42px"
      />
    </span>
  );
}
