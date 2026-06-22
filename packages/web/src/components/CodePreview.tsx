import { Highlight, themes } from 'prism-react-renderer';
import { useStore } from '../store';

interface CodePreviewProps {
  code: string;
  language?: string;
}

export const CodePreview = ({ code, language = 'typescript' }: CodePreviewProps) => {
  const { settings } = useStore();
  const isDark = settings.theme === 'dark';

  return (
    <Highlight
      theme={isDark ? themes.nightOwl : themes.github}
      code={code.trim()}
      language={language}
    >
      {({ className, style, tokens, getLineProps, getTokenProps }) => (
        <pre
          className={`${className} p-4 overflow-x-auto text-sm font-mono`}
          style={{ ...style, backgroundColor: 'transparent' }}
        >
          {tokens.map((line, i) => (
            <div key={i} {...getLineProps({ line })} className="table-row">
              <span className="table-cell pr-4 text-slate-400 select-none text-right w-8">
                {i + 1}
              </span>
              <span className="table-cell">
                {line.map((token, key) => (
                  <span key={key} {...getTokenProps({ token })} />
                ))}
              </span>
            </div>
          ))}
        </pre>
      )}
    </Highlight>
  );
};
