import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

export function SafeMarkdown({ children }: { children: string }) {
  return <div className="research-markdown"><ReactMarkdown skipHtml remarkPlugins={[remarkGfm]} components={{
    a: ({ href, children: label }) => href && /^https?:\/\//i.test(href)
      ? <a href={href} target="_blank" rel="noopener noreferrer">{label}</a>
      : <span>{label}</span>,
    img: ({ alt }) => <span>{alt}</span>
  }}>{children}</ReactMarkdown></div>;
}
