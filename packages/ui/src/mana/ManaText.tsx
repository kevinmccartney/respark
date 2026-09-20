import { manaSymbolSvgUrl, resolveManaSymbol } from './resolve.js';
import { tokenizeManaText } from './tokenize.js';

export const ManaText = ({
  text,
  className,
  size = 16,
}: {
  text: string | null | undefined;
  className?: string;
  size?: number;
}) => {
  if (!text) return null;

  return (
    <span className={className} title={text}>
      {tokenizeManaText(text).map((part, index) => {
        if (part.kind === 'text') {
          return <span key={`t-${index}`}>{part.value}</span>;
        }

        const resolved = resolveManaSymbol(part.value);
        if (!resolved) {
          return <span key={`s-${index}`}>{`{${part.value}}`}</span>;
        }

        return (
          <img
            key={`s-${index}`}
            src={manaSymbolSvgUrl(resolved.svgCode)}
            alt={resolved.english}
            title={resolved.english}
            width={size}
            height={size}
            className="inline-block align-text-bottom"
            loading="lazy"
          />
        );
      })}
    </span>
  );
};
