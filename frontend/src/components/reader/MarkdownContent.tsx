"use client"

import ReactMarkdown from "react-markdown"
import remarkGfm from "remark-gfm"

interface MarkdownContentProps {
  content: string
  images?: string[]
  className?: string
}

export function MarkdownContent({ content, images, className }: MarkdownContentProps) {
  return (
    <div className={className}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          img: ({ src, alt }) => (
            <img src={src} alt={alt || ""} className="max-w-full rounded-lg my-2 border border-[var(--border-subtle)]" loading="lazy" />
          ),
          a: ({ href, children }) => (
            <a href={href} target="_blank" rel="noopener noreferrer" className="text-blue-500 underline">
              {children}
            </a>
          ),
          code: ({ className: codeClass, children, ...props }) => {
            const isInline = !codeClass
            if (isInline) {
              return <code className="px-1 py-0.5 bg-[var(--bg-hover)] rounded text-xs font-mono" {...props}>{children}</code>
            }
            return (
              <pre className="bg-[var(--bg-hover)] rounded-lg p-3 my-2 overflow-x-auto text-xs">
                <code className={codeClass} {...props}>{children}</code>
              </pre>
            )
          },
          blockquote: ({ children }) => (
            <blockquote className="border-l-2 border-[var(--accent)] pl-3 my-2 text-[var(--text-secondary)] text-sm">
              {children}
            </blockquote>
          ),
          table: ({ children }) => (
            <div className="overflow-x-auto my-2">
              <table className="min-w-full border-collapse border border-[var(--border-subtle)] text-sm">{children}</table>
            </div>
          ),
          th: ({ children }) => (
            <th className="border border-[var(--border-subtle)] px-2 py-1 bg-[var(--bg-hover)] font-medium text-left">{children}</th>
          ),
          td: ({ children }) => (
            <td className="border border-[var(--border-subtle)] px-2 py-1">{children}</td>
          ),
        }}
      >
        {content}
      </ReactMarkdown>
      {images && images.length > 0 && (
        <div className="flex flex-wrap gap-2 mt-2">
          {images.map((src, idx) => (
            <img key={idx} src={src} alt="" className="max-w-[200px] max-h-[150px] rounded-lg object-cover border border-[var(--border-subtle)]" loading="lazy" />
          ))}
        </div>
      )}
    </div>
  )
}
